/**
 * 根据呼号计算 APRS passcode
 * 算法参考: http://www.aprs-is.net/Connecting.aspx
 * @param {string} callsign - 呼号（可包含 -SSID 后缀）
 * @returns {number} - 计算出的 15 位 passcode
 */
export function calculateAPRS(callsign) {
  if (!callsign) return 0

  let stophere = callsign.indexOf('-')
  if (stophere !== -1) callsign = callsign.substring(0, stophere)
  let realcall = callsign.toUpperCase().substring(0, 10)

  let hash = 0x73e2
  let i = 0
  let len = realcall.length

  while (i < len) {
    hash ^= realcall.charCodeAt(i) << 8
    if (i + 1 < len) {
      hash ^= realcall.charCodeAt(i + 1)
    }
    i += 2
  }

  return hash & 0x7fff
}

/**
 * 校验用户输入的 APRS 密钥是否正确
 * @param {string} callsign - 呼号
 * @param {string|number} passcode - 用户输入的密钥
 * @returns {boolean} - 是否正确
 */
export function validateAPRS(callsign, passcode) {
  if (!callsign || passcode === undefined || passcode === null || passcode === '') {
    return false
  }
  const expected = calculateAPRS(callsign)
  const input = parseInt(passcode, 10)
  if (isNaN(input)) return false
  return expected === input
}
