import { modesByDuration } from './sstvModes'
import type { SstvMode } from './sstvTypes'

export interface ModeCandidate {
  mode: SstvMode
  confidence: number
  reason: 'duration'
}

export function estimateModesFromDuration(durationSec: number): ModeCandidate[] {
  const modes = modesByDuration(durationSec)
  return modes.map((mode, index) => ({
    mode,
    reason: 'duration',
    confidence: Math.max(0.1, 0.55 - index * 0.12)
  }))
}
