export function amplitudeToDbfs(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return -120
  return Math.max(-120, 20 * Math.log10(amplitude))
}

export function noteFromFrequency(frequency: number): { name: string; cents: number } {
  if (!Number.isFinite(frequency) || frequency <= 0) return { name: '--', cents: 0 }
  const names = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
  const midi = 69 + 12 * Math.log2(frequency / 440)
  const nearest = Math.round(midi)
  const octave = Math.floor(nearest / 12) - 1
  return { name: `${names[((nearest % 12) + 12) % 12]}${octave}`, cents: Math.round((midi - nearest) * 100) }
}

export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  if (samples.length < 64 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null
  let mean = 0
  for (const sample of samples) mean += sample
  mean /= samples.length
  let energy = 0
  for (const sample of samples) energy += (sample - mean) ** 2
  if (energy / samples.length < 1e-7) return null
  const minLag = Math.max(2, Math.floor(sampleRate / 1000))
  const maxLag = Math.min(Math.ceil(sampleRate / 40), Math.floor(samples.length / 2))
  const correlations = new Float64Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let cross = 0, leftEnergy = 0, rightEnergy = 0
    for (let index = 0; index < samples.length - lag; index++) {
      const left = samples[index] - mean, right = samples[index + lag] - mean
      cross += left * right; leftEnergy += left * left; rightEnergy += right * right
    }
    correlations[lag] = cross / Math.sqrt(leftEnergy * rightEnergy || 1)
  }
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (correlations[lag] >= 0.8 && correlations[lag] >= correlations[lag - 1] && correlations[lag] > correlations[lag + 1]) {
      const correction = 0.5 * (correlations[lag - 1] - correlations[lag + 1]) / (correlations[lag - 1] - 2 * correlations[lag] + correlations[lag + 1])
      return sampleRate / (lag + correction)
    }
  }
  return null
}

export function applyIntegration(previous: number, input: number, elapsedSeconds: number, timeConstant: number): number {
  if (elapsedSeconds <= 0 || timeConstant <= 0) return input
  return previous + (input - previous) * (1 - Math.exp(-elapsedSeconds / timeConstant))
}

export function advanceNeedle(state: { position: number; velocity: number }, target: number, elapsedSeconds: number): { position: number; velocity: number } {
  const dt = Math.min(Math.max(elapsedSeconds, 0), 0.05)
  const position = Math.max(-20, Math.min(3, state.position))
  const acceleration = (target - position) * 72 - state.velocity * 16
  const velocity = state.velocity + acceleration * dt
  return { position: Math.max(-20, Math.min(3, position + velocity * dt)), velocity }
}

export function frequencyForX(x: number, left: number, right: number, minFrequency: number, maxFrequency: number): { frequency: number } {
  const ratio = Math.max(0, Math.min(1, (x - left) / (right - left)))
  return { frequency: minFrequency * (maxFrequency / minFrequency) ** ratio }
}