const VIRTUAL_ID = 'virtual:about-config'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

const REQUEST_TIMEOUT_MS = 15000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1500

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, { retries = MAX_RETRIES } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        console.warn(
          `[fmo-about-config] 拉取 ${url} 失败（第 ${attempt}/${retries} 次）：${error.message}，${RETRY_DELAY_MS}ms 后重试`
        )
        await delay(RETRY_DELAY_MS)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

function normalizeConfig(raw) {
  if (raw == null) {
    return { sponsors: [], thanks: [], coffee: [] }
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('关于页配置必须是 JSON 对象')
  }

  const sponsors = raw.sponsors
  if (
    sponsors != null &&
    (!Array.isArray(sponsors) || sponsors.some((item) => typeof item !== 'string'))
  ) {
    throw new Error('sponsors 必须是字符串数组')
  }

  const thanks = raw.thanks
  if (
    thanks != null &&
    (!Array.isArray(thanks) ||
      thanks.some(
        (item) => !item || typeof item.name !== 'string' || typeof item.contribution !== 'string'
      ))
  ) {
    throw new Error('thanks 每项必须包含 name 和 contribution 字符串字段')
  }

  const coffee = raw.coffee
  if (
    coffee != null &&
    (!Array.isArray(coffee) ||
      coffee.some(
        (item) => !item || typeof item.label !== 'string' || typeof item.url !== 'string'
      ))
  ) {
    throw new Error('coffee 每项必须包含 label 和 url 字符串字段')
  }

  return {
    sponsors: sponsors ?? [],
    thanks: thanks ?? [],
    coffee: coffee ?? []
  }
}

/**
 * 在构建时从环境变量指定的 JSON 地址拉取“关于页”配置并打包进产物。
 * 未配置地址时返回空配置；配置了地址但拉取失败时降级为空配置并告警，
 * 避免远端 CDN 波动阻断整个构建。
 */
export function aboutConfigPlugin(env = {}) {
  const url = (env.VITE_ABOUT_CONFIG_URL || process.env.VITE_ABOUT_CONFIG_URL || '').trim()

  let cache = null

  return {
    name: 'fmo-about-config',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null

      if (!cache) {
        let raw = null
        if (url) {
          try {
            raw = await fetchJson(url)
          } catch (error) {
            console.warn(
              `[fmo-about-config] 拉取关于页配置失败，将使用空配置继续构建：${error.message}`
            )
          }
        }
        cache = normalizeConfig(raw)
      }

      return [`export const aboutConfig = ${JSON.stringify(cache)}`, ''].join('\n')
    }
  }
}
