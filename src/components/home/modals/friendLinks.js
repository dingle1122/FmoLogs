/**
 * 友情链接配置
 * 支持从 RSS 订阅获取数据，失败时降级到静态配置
 */
import { CapacitorHttp } from '@capacitor/core'
import { getEffectivePlatform } from '../../../platform/runtime'
import { parseRssXml, extractCategory, extractDisplayUrl } from '../../../utils/rssParser'

const RSS_URL = import.meta.env.VITE_RSS_URL || 'http://localhost:4321/rss.xml'
const CACHE_KEY = 'fmo-rss-cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存
let rssChannelLink = ''

export function getRssSourceUrl() {
  return rssChannelLink || RSS_URL.replace(/\/[^/]*$/, '')
}

/**
 * 静态降级数据（原有链接）
 */
const staticLinks = [
  {
    id: 'fmo-map',
    name: 'FMO 地图',
    url: 'https://map.fmo.net.cn/',
    displayUrl: 'map.fmo.net.cn',
    icon: { type: 'emoji', content: '🗺️' }
  },
  {
    id: 'fmodeck',
    name: 'FMODECK',
    url: 'https://fmologs.wh0am1i.com/logs',
    displayUrl: 'fmologs.wh0am1i.com',
    description: '业余无线电 FMO 平台的日志与控制台 · 战术 HUD 主题',
    icon: { type: 'url', content: 'https://fmologs.wh0am1i.com/icon.svg' }
  },
  {
    id: 'fmo-dashboard',
    name: 'FMO 仪表盘',
    url: 'https://fmo.bh1jss.net/v2',
    displayUrl: 'fmo.bh1jss.net',
    icon: { type: 'url', content: 'https://cdn.lzyike.cn/fmoLogs/icon/fmo-dashboard.png' }
  },
  {
    id: 'fmo-docs',
    name: 'FMO实践分享',
    url: 'https://bg5esn.com/docs/fmo-user-shares/',
    displayUrl: 'bg5esn.com',
    icon: { type: 'emoji', content: '📖' }
  },
  {
    id: 'bg5esn',
    name: '大船地下室',
    url: 'https://bg5esn.com/',
    displayUrl: 'bg5esn.com',
    icon: { type: 'emoji', content: '⚓' }
  },
  {
    id: 'fmoc',
    name: 'FMOC',
    url: 'http://fmo.bg5eit.cn/',
    displayUrl: 'fmo.bg5eit.cn',
    icon: {
      type: 'svg',
      content: `<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="44" rx="10" fill="#ff9800" />
        <text x="22" y="30" font-size="24" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial, sans-serif">F</text>
      </svg>`
    }
  }
]

/**
 * 从 RSS 获取友链数据
 * @returns {Promise<Array>} 友链数组
 */
export async function fetchFriendLinks() {
  // 检查缓存
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) {
    try {
      const { data, timestamp, channelLink: cachedLink } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL) {
        if (cachedLink) rssChannelLink = cachedLink
        return { links: data, fromRss: true }
      }
    } catch {
      // 缓存解析失败，继续请求
    }
  }

  try {
    let xml
    if (getEffectivePlatform() === 'android') {
      const response = await CapacitorHttp.request({ url: RSS_URL, method: 'GET', responseType: 'text' })
      xml = response.data
    } else {
      const response = await fetch(RSS_URL)
      xml = await response.text()
    }
    const { channelLink, items } = parseRssXml(xml)
    if (channelLink) rssChannelLink = channelLink

    const links = items.map((item) => {
      const { category, name } = extractCategory(item.title)
      return {
        id: item.link,
        name,
        url: item.link,
        displayUrl: extractDisplayUrl(item.link),
        description: item.description,
        icon: item.imageUrl
          ? { type: 'url', content: item.imageUrl }
          : { type: 'emoji', content: '🔗' },
        tag: category || null,
        tagType: 'info'
      }
    })

    // 缓存
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: links,
        timestamp: Date.now(),
        channelLink: rssChannelLink
      })
    )

    return { links, fromRss: true }
  } catch (error) {
    console.error('Failed to fetch RSS:', error)
    // 降级到静态数据
    return { links: staticLinks, fromRss: false }
  }
}
