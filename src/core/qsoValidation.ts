export const FUTURE_TIMESTAMP_TOLERANCE_SECONDS = 120
export const MIN_QSO_TIMESTAMP = 1
export const MAX_QSO_TIMESTAMP = 2147483647

export function isValidQsoTimestamp(timestamp: unknown): boolean {
  return (
    typeof timestamp === 'number' &&
    Number.isFinite(timestamp) &&
    Number.isSafeInteger(timestamp) &&
    timestamp >= MIN_QSO_TIMESTAMP &&
    timestamp <= MAX_QSO_TIMESTAMP
  )
}

export function getLatestValidQsoTimestamp(
  timestamp: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  futureToleranceSeconds = FUTURE_TIMESTAMP_TOLERANCE_SECONDS
): number | null {
  if (typeof timestamp !== 'number') return null
  if (!isValidQsoTimestamp(timestamp)) return null
  if (timestamp > nowSeconds + futureToleranceSeconds) return null
  return timestamp
}

export function getQsoValidationReason(
  timestamp: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  futureToleranceSeconds = FUTURE_TIMESTAMP_TOLERANCE_SECONDS
): string {
  if (typeof timestamp !== 'number') return 'invalid-timestamp'
  if (!isValidQsoTimestamp(timestamp)) return 'invalid-timestamp'
  if (timestamp > nowSeconds + futureToleranceSeconds) return 'future-timestamp'
  return ''
}

export function isValidQsoRecord(
  record: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  futureToleranceSeconds = FUTURE_TIMESTAMP_TOLERANCE_SECONDS
): boolean {
  if (!record || typeof record !== 'object') return false
  const value = record as Record<string, unknown>
  return (
    isValidQsoTimestamp(value.timestamp) &&
    getLatestValidQsoTimestamp(value.timestamp, nowSeconds, futureToleranceSeconds) !== null
  )
}

export function getStoredQsoRecordInvalidReason(
  record: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  futureToleranceSeconds = FUTURE_TIMESTAMP_TOLERANCE_SECONDS
): string {
  if (!record || typeof record !== 'object') return 'invalid-record'
  const value = record as Record<string, unknown>
  if (typeof value.timestamp !== 'number') return 'invalid-timestamp'
  if (!isValidQsoTimestamp(value.timestamp)) return 'invalid-timestamp'
  if (value.timestamp > nowSeconds + futureToleranceSeconds) return 'future-timestamp'
  if (typeof value.fromCallsign !== 'string' || value.fromCallsign.trim().length === 0) {
    return 'invalid-from-callsign'
  }
  if (typeof value.toCallsign !== 'string' || value.toCallsign.trim().length === 0) {
    return 'invalid-to-callsign'
  }
  return ''
}
