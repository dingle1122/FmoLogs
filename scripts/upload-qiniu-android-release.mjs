import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

const REQUIRED_ENV = [
  'QINIU_ACCESS_KEY',
  'QINIU_SECRET_KEY',
  'QINIU_BUCKET',
  'QINIU_REGION',
  'QINIU_PUBLIC_BASE_URL',
  'QINIU_RELEASE_PREFIX',
  'APK_PATH'
]

const UPLOAD_HOSTS = {
  z0: 'https://upload.qiniup.com',
  z1: 'https://upload-z1.qiniup.com',
  z2: 'https://upload-z2.qiniup.com',
  na0: 'https://upload-na0.qiniup.com',
  as0: 'https://upload-as0.qiniup.com',
  'cn-east-2': 'https://upload-cn-east-2.qiniup.com'
}

const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const UPLOAD_RETRIES = 3

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function normalizePrefix(prefix) {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function joinUrl(base, ...parts) {
  const cleanBase = base.replace(/\/+$/g, '')
  const cleanParts = parts.map((part) => String(part).replace(/^\/+|\/+$/g, '')).filter(Boolean)
  return [cleanBase, ...cleanParts].join('/')
}

function getVersionCode(versionName) {
  const cleanVersion = versionName.replace(/[^0-9.].*$/, '')
  const [major = '0', minor = '0', patch = '0'] = cleanVersion.split('.')
  return Number(major) * 10000 + Number(minor) * 100 + Number(patch)
}

function getUploadToken({ accessKey, secretKey, bucket, key }) {
  const deadline = Math.floor(Date.now() / 1000) + 3600
  const putPolicy = {
    scope: `${bucket}:${key}`,
    deadline,
    returnBody:
      '{"key":"$(key)","hash":"$(etag)","bucket":"$(bucket)","fname":"$(fname)","size":$(fsize)}'
  }
  const encodedPolicy = base64Url(JSON.stringify(putPolicy))
  const sign = crypto.createHmac('sha1', secretKey).update(encodedPolicy).digest()
  return `${accessKey}:${base64Url(sign)}:${encodedPolicy}`
}

function getSha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function getMultipartMeta({ uploadToken, key, filePath, boundary }) {
  const fileName = path.basename(filePath)
  const fileSize = fs.statSync(filePath).size
  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="token"\r\n\r\n` +
      `${uploadToken}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="key"\r\n\r\n` +
      `${key}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)

  return {
    header,
    footer,
    contentLength: header.length + fileSize + footer.length
  }
}

function uploadFileOnce({ uploadHost, uploadToken, key, filePath }) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadHost)
    const boundary = `----FmoLogsQiniu${crypto.randomBytes(12).toString('hex')}`
    const { header, footer, contentLength } = getMultipartMeta({
      uploadToken,
      key,
      filePath,
      boundary
    })
    const client = url.protocol === 'http:' ? http : https

    const req = client.request(
      {
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': contentLength
        },
        timeout: UPLOAD_TIMEOUT_MS
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Qiniu upload failed for ${key}: ${res.statusCode} ${text}`))
            return
          }

          try {
            resolve(text ? JSON.parse(text) : {})
          } catch (err) {
            reject(new Error(`Qiniu upload returned invalid JSON for ${key}: ${text}`))
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error(`Qiniu upload timeout for ${key}`))
    })
    req.on('error', reject)

    req.write(header)
    const fileStream = fs.createReadStream(filePath)
    fileStream.on('error', (err) => req.destroy(err))
    fileStream.on('end', () => req.end(footer))
    fileStream.pipe(req, { end: false })
  })
}

async function uploadFile({ uploadHost, uploadToken, key, filePath }) {
  let lastError

  for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`Retry upload ${key} (${attempt}/${UPLOAD_RETRIES})`)
      }
      return await uploadFileOnce({ uploadHost, uploadToken, key, filePath })
    } catch (err) {
      lastError = err
      if (attempt === UPLOAD_RETRIES) break
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
    }
  }

  throw lastError
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim())
  if (missing.length > 0) {
    console.log(`Skip Qiniu upload: missing ${missing.join(', ')}`)
    return
  }

  const accessKey = requireEnv('QINIU_ACCESS_KEY')
  const secretKey = requireEnv('QINIU_SECRET_KEY')
  const bucket = requireEnv('QINIU_BUCKET')
  const region = requireEnv('QINIU_REGION')
  const publicBaseUrl = requireEnv('QINIU_PUBLIC_BASE_URL')
  const releasePrefix = normalizePrefix(requireEnv('QINIU_RELEASE_PREFIX'))
  const apkPath = requireEnv('APK_PATH')
  const uploadHost = UPLOAD_HOSTS[region] ?? region

  if (!uploadHost.startsWith('https://')) {
    throw new Error(
      'QINIU_REGION must be a known region code or an https upload host, such as z0 or https://upload.qiniup.com'
    )
  }

  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`)
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const versionName = process.env.VERSION_NAME?.trim() || packageJson.version
  const versionCode = Number(process.env.VERSION_CODE || getVersionCode(versionName))
  const apkFileName = path.basename(apkPath)
  const versionDir = `v${versionName}`
  const apkKey = `${releasePrefix}/${versionDir}/${apkFileName}`
  const manifestKey = `${releasePrefix}/latest.json`
  const versionManifestKey = `${releasePrefix}/${versionDir}/version.json`
  const sha256 = getSha256(apkPath)
  const apkUrl = joinUrl(publicBaseUrl, apkKey)

  const manifest = {
    platform: 'android',
    versionName,
    versionCode,
    apkUrl,
    sha256,
    releaseNotes: process.env.RELEASE_NOTES?.trim() || '',
    force: process.env.UPDATE_FORCE === 'true',
    publishedAt: new Date().toISOString()
  }

  const manifestPath = path.join(path.dirname(apkPath), 'latest.json')
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  for (const [key, filePath] of [
    [apkKey, apkPath],
    [manifestKey, manifestPath],
    [versionManifestKey, manifestPath]
  ]) {
    const uploadToken = getUploadToken({ accessKey, secretKey, bucket, key })
    await uploadFile({ uploadHost, uploadToken, key, filePath })
    console.log(`Uploaded ${key}`)
  }

  console.log(`Android update manifest: ${joinUrl(publicBaseUrl, manifestKey)}`)
  console.log(`Android version manifest: ${joinUrl(publicBaseUrl, versionManifestKey)}`)
  console.log(`Android APK: ${apkUrl}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
