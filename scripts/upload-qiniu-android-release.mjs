import crypto from 'node:crypto'
import fs from 'node:fs'
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

async function uploadFile({ uploadHost, uploadToken, key, filePath }) {
  const form = new FormData()
  form.set('token', uploadToken)
  form.set('key', key)
  form.set('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath))

  const response = await fetch(uploadHost, {
    method: 'POST',
    body: form
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Qiniu upload failed for ${key}: ${response.status} ${text}`)
  }

  return text ? JSON.parse(text) : {}
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
  const apkKey = `${releasePrefix}/${apkFileName}`
  const manifestKey = `${releasePrefix}/latest.json`
  const versionManifestKey = `${releasePrefix}/v${versionName}.json`
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
  console.log(`Android APK: ${apkUrl}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
