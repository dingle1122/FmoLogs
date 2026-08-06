/**
 * RSS XML 解析工具
 */

/**
 * 解析 RSS XML 为结构化数据
 * @param {string} xmlString - RSS XML 字符串
 * @returns {Array} 解析后的条目数组
 */
export function parseRssXml(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')
  const items = doc.querySelectorAll('item')

  return Array.from(items).map((item) => ({
    title: item.querySelector('title')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    description: item.querySelector('description')?.textContent || '',
    pubDate: item.querySelector('pubDate')?.textContent || '',
    imageUrl: item.querySelector('enclosure')?.getAttribute('url') || ''
  }))
}

/**
 * 从 title 提取分类
 * @param {string} title - 如 "[网页版] FMO APRS 实时地图"
 * @returns {{ category: string|null, name: string }}
 */
export function extractCategory(title) {
  const match = title.match(/^\[(.+?)\]\s*(.+)$/)
  if (match) {
    return { category: match[1], name: match[2] }
  }
  return { category: null, name: title }
}

/**
 * 从 URL 提取 displayUrl
 * @param {string} url
 * @returns {string}
 */
export function extractDisplayUrl(url) {
  try {
    const { hostname } = new URL(url)
    return hostname
  } catch {
    return url
  }
}
