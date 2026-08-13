const VIRTUAL_ID = 'virtual:about-config'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
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
 * 未配置地址时返回空配置（赞助/感谢/赞赏二维码均为空）。
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
        const raw = url ? await fetchJson(url) : null
        cache = normalizeConfig(raw)
      }

      return [`export const aboutConfig = ${JSON.stringify(cache)}`, ''].join('\n')
    }
  }
}
