const DEFAULT_TONES = [1200, 1500, 1900, 2300]

export interface ToneMeasurement {
  frequency: number
  magnitude: number
  confidence: number
}

function goertzel(samples: Float32Array, sampleRate: number, frequency: number): number {
  const k = Math.round((samples.length * frequency) / sampleRate)
  const omega = (2 * Math.PI * k) / samples.length
  const coeff = 2 * Math.cos(omega)
  let q0 = 0
  let q1 = 0
  let q2 = 0
  for (const sample of samples) {
    q0 = coeff * q1 - q2 + sample
    q2 = q1
    q1 = q0
  }
  return Math.sqrt(Math.max(0, q1 * q1 + q2 * q2 - coeff * q1 * q2)) / samples.length
}

export function detectTone(
  samples: Float32Array,
  sampleRate: number,
  tones = DEFAULT_TONES
): ToneMeasurement {
  const measurements = tones.map((frequency) => ({
    frequency,
    magnitude: goertzel(samples, sampleRate, frequency)
  }))
  measurements.sort((a, b) => b.magnitude - a.magnitude)
  const best = measurements[0]
  const second = measurements[1]?.magnitude ?? 0
  return {
    ...best,
    confidence: best.magnitude > 0 ? Math.max(0, Math.min(1, (best.magnitude - second) / best.magnitude)) : 0
  }
}
