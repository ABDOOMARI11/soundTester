class PitchDetector extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samples = new Float32Array(2048)
    this.position = 0
    this.blocks = 0
  }

  detectPitch() {
    const mean = this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length
    let energy = 0
    for (const sample of this.samples) energy += (sample - mean) ** 2
    if (energy / this.samples.length < 1e-7) return null
    const minLag = Math.max(2, Math.floor(sampleRate / 2 / 1000))
    const maxLag = Math.min(Math.ceil(sampleRate / 2 / 40), Math.floor(this.samples.length / 2))
    const correlations = new Float32Array(maxLag + 1)
    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0, leftEnergy = 0, rightEnergy = 0
      for (let index = 0; index < this.samples.length - lag; index++) {
        const left = this.samples[index] - mean
        const right = this.samples[index + lag] - mean
        cross += left * right
        leftEnergy += left * left
        rightEnergy += right * right
      }
      correlations[lag] = cross / Math.sqrt(leftEnergy * rightEnergy || 1)
    }
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (correlations[lag] >= 0.8 && correlations[lag] >= correlations[lag - 1] && correlations[lag] > correlations[lag + 1]) {
        const correction = 0.5 * (correlations[lag - 1] - correlations[lag + 1]) / (correlations[lag - 1] - 2 * correlations[lag] + correlations[lag + 1])
        return sampleRate / 2 / (lag + correction)
      }
    }
    return null
  }

  process(inputs) {
    const channels = inputs[0]
    if (!channels?.length) return true
    const left = channels[0]
    const right = channels[1]
    for (let index = 0; index < left.length; index += 2) {
      this.samples[this.position] = right ? (left[index] + right[index]) * 0.5 : left[index]
      this.position = (this.position + 1) % this.samples.length
    }
    this.blocks++
    if (this.blocks >= 24) {
      this.blocks = 0
      const ordered = new Float32Array(this.samples.length)
      ordered.set(this.samples.subarray(this.position))
      ordered.set(this.samples.subarray(0, this.position), this.samples.length - this.position)
      const detector = Object.create(PitchDetector.prototype)
      detector.samples = ordered
      this.port.postMessage({ frequency: detector.detectPitch() })
    }
    return true
  }
}

registerProcessor('pitch-detector', PitchDetector)