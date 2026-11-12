import type { SstvMode, SstvModeId } from './sstvTypes'

export const SSTV_MODES: Record<SstvModeId, SstvMode> = {
  pd50: {
    id: 'pd50', name: 'PD 50', visCode: 93, width: 320, height: 256,
    lineDurationMs: 388.16, syncDurationMs: 20, nominalDurationSec: 50
  },
  pd90: {
    id: 'pd90', name: 'PD 90', visCode: 99, width: 320, height: 256,
    lineDurationMs: 703.04, syncDurationMs: 20, nominalDurationSec: 90
  },
  pd120: {
    id: 'pd120', name: 'PD 120', visCode: 95, width: 640, height: 496,
    lineDurationMs: 508.48, syncDurationMs: 20, nominalDurationSec: 126
  },
  pd160: {
    id: 'pd160', name: 'PD 160', visCode: 98, width: 512, height: 400,
    lineDurationMs: 804.416, syncDurationMs: 20, nominalDurationSec: 160
  },
  pd180: {
    id: 'pd180', name: 'PD 180', visCode: 96, width: 640, height: 496,
    lineDurationMs: 754.24, syncDurationMs: 20, nominalDurationSec: 187
  },
  pd240: {
    id: 'pd240', name: 'PD 240', visCode: 97, width: 640, height: 496,
    lineDurationMs: 1000, syncDurationMs: 20, nominalDurationSec: 248
  },
  pd290: {
    id: 'pd290', name: 'PD 290', visCode: 94, width: 800, height: 616,
    lineDurationMs: 937.28, syncDurationMs: 20, nominalDurationSec: 289
  },
  robot36: {
    id: 'robot36', name: 'Robot 36', visCode: 8, width: 320, height: 240,
    lineDurationMs: 150, syncDurationMs: 9, nominalDurationSec: 36
  },
  robot72: {
    id: 'robot72', name: 'Robot 72', visCode: 12, width: 320, height: 240,
    lineDurationMs: 300, syncDurationMs: 9, nominalDurationSec: 72
  },
}

export function modeByVisCode(visCode: number): SstvMode | null {
  return Object.values(SSTV_MODES).find((mode) => mode.visCode === visCode) ?? null
}

/**
 * 仅作为 VIS 缺失时的候选提示，不能替代正式的 VIS 校验。
 * 录音通常包含前后静音，因此使用较宽的容差。
 */
export function modesByDuration(durationSec: number): SstvMode[] {
  return Object.values(SSTV_MODES)
    .map((mode) => ({ mode, distance: Math.abs(durationSec - mode.nominalDurationSec) }))
    .filter(({ mode, distance }) => distance <= Math.max(8, mode.nominalDurationSec * 0.18))
    .sort((a, b) => a.distance - b.distance)
    .map(({ mode }) => mode)
}
