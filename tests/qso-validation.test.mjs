import assert from 'node:assert/strict'
import { build } from 'esbuild'

import {
  FUTURE_TIMESTAMP_TOLERANCE_SECONDS,
  getLatestValidQsoTimestamp,
  getStoredQsoRecordInvalidReason,
  isValidQsoRecord
} from '../src/core/qsoValidation.ts'

const now = 2_000_000_000

assert.equal(getLatestValidQsoTimestamp(now - 1, now), now - 1)
assert.equal(
  getLatestValidQsoTimestamp(now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS, now),
  now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS
)
assert.equal(getLatestValidQsoTimestamp(now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS + 1, now), null)
assert.equal(getLatestValidQsoTimestamp(0, now), null)
assert.equal(getLatestValidQsoTimestamp('123', now), null)

const baseRecord = {
  timestamp: now - 1,
  fromCallsign: 'BG1ABC',
  toCallsign: 'BG1DEF'
}
assert.equal(isValidQsoRecord(baseRecord, now), true)
assert.equal(
  isValidQsoRecord({ ...baseRecord, timestamp: now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS + 1 }, now),
  false
)
assert.equal(
  isValidQsoRecord({ timestamp: now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS + 1 }, now),
  false
)
assert.equal(isValidQsoRecord({ timestamp: now - 1 }, now), true)
assert.equal(getStoredQsoRecordInvalidReason(baseRecord, now), '')
const importedSourceRecord = {
  timestamp: now - 1,
  fromCallsign: 'BG1ABC',
  toCallsign: 'BG1DEF'
}
const importedRecordCopy = { ...importedSourceRecord }
importedRecordCopy.fromCallsign = 'BG1XYZ'
importedRecordCopy.toCallsign = 'BG1QWE'
assert.equal(importedSourceRecord.fromCallsign, 'BG1ABC')
assert.equal(importedSourceRecord.toCallsign, 'BG1DEF')
assert.equal(
  getStoredQsoRecordInvalidReason(
    { ...baseRecord, timestamp: now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS + 1 },
    now
  ),
  'future-timestamp'
)

const compiledSyncEngine = await build({
  entryPoints: ['src/core/sync/syncEngine.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})
const syncModule = await import(
  `data:text/javascript;base64,${globalThis.Buffer.from(
    compiledSyncEngine.outputFiles[0].contents
  ).toString('base64')}`
)

assert.equal(
  await syncModule.processSingleQsoItem(
    {
      logId: 7,
      ...baseRecord,
      timestamp: now + FUTURE_TIMESTAMP_TOLERANCE_SECONDS + 1
    },
    now - 100,
    {
      async getQsoDetail() {
        throw new Error('不应拉取明显异常的列表数据')
      }
    },
    {
      currentFromCallsign: 'BG1ABC',
      onSkipped(record) {
        assert.equal(record.reason, 'future-timestamp')
      }
    },
    now
  ),
  null
)
