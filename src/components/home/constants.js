// 从 db.js 重新导出常量，保持兼容性
export {
  QueryTypes,
  QueryTypeNames,
  ColumnNames,
  formatTimestamp,
  formatFreqHz
} from '../../services/db'

// 默认列（查看所有模式）
export const DEFAULT_COLUMNS = [
  'timestamp',
  'toCallsign',
  'fromCallsign',
  'freqHz',
  'toComment',
  'mode',
  'relayName'
]

// 分页大小
export const PAGE_SIZE = 100
export const OLD_FRIENDS_PAGE_SIZE = 50
export const CALLSIGN_RECORDS_PAGE_SIZE = 10

// 判断是否今日通联（使用UTC时间）
export function isTodayContact(timestamp) {
  if (!timestamp) return false
  const contactDate = new Date(timestamp * 1000)
  const today = new Date()
  return (
    contactDate.getUTCFullYear() === today.getUTCFullYear() &&
    contactDate.getUTCMonth() === today.getUTCMonth() &&
    contactDate.getUTCDate() === today.getUTCDate()
  )
}

// 格式化时间为"X分钟前"
export function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes === 1) return '1分钟前'
  return `${minutes}分钟前`
}
