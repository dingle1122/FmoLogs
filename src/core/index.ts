// core/ 目录：存放与平台无关的纯业务逻辑
// 本文件仅为目录占位，具体模块随后续 PR 逐步填充：
// - aprsCodec.ts：HMAC 签名与 APRS packet 构造（PR-2）
// - audioGain.ts：音量百分比→gain 映射（PR-4）
// - gridValidator.ts：grid 规整校验（PR-1）
// - adif/：从 src/adif/ 迁入（可选）
// - sync/：同步算法（PR-6）
export {}

export * from './sstv/sstvTypes'
export * from './sstv/sstvModes'
export * from './sstv/toneDetector'
export * from './sstv/wavReader'
export * from './sstv/modeDetector'
export * from './sstv/imageDecoder'
export { SstvDecoder } from './sstv/sstvDecoder'
