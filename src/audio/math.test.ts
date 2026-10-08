import { describe, expect, it } from 'vitest'
import { amplitudeToDbfs, advanceNeedle, applyIntegration, detectPitch, noteFromFrequency } from './math'

describe('conversion dBFS', () => {
  it('convertit les amplitudes de référence et borne le silence', () => {
    expect(amplitudeToDbfs(1)).toBe(0)
    expect(amplitudeToDbfs(0.5)).toBeCloseTo(-6.02, 1)
    expect(amplitudeToDbfs(0)).toBe(-120)
  })
})

describe('détection de pitch', () => {
  it('retrouve un La 440 dans une fenêtre sinusoïdale', () => {
    const sampleRate = 48000
    const samples = Float32Array.from({ length: 4096 }, (_, index) => Math.sin(2 * Math.PI * 440 * index / sampleRate))
    expect(detectPitch(samples, sampleRate)).toBeCloseTo(440, 0)
    expect(noteFromFrequency(440)).toEqual({ name: 'La4', cents: 0 })
  })

  it('ignore le silence', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull()
  })
})

describe('balistique du vumètre', () => {
  it('intègre le niveau RMS avec une constante de temps', () => {
    expect(applyIntegration(0, 1, 0.3, 0.3)).toBeCloseTo(1 - Math.exp(-1))
  })

  it('fait monter le PPM plus vite qu’il ne retombe', () => {
    const attack = applyIntegration(0, 1, 0.02, 0.01)
    const release = applyIntegration(1, 0, 0.02, 1.5)
    expect(attack).toBeGreaterThan(0.8)
    expect(release).toBeGreaterThan(0.9)
  })

  it('fait progresser l’aiguille vers la cible sans dépasser le cadran', () => {
    const next = advanceNeedle({ position: -20, velocity: 0 }, 0, 1 / 60)
    expect(next.position).toBeGreaterThan(-20)
    expect(advanceNeedle({ position: 3, velocity: 0 }, 12, 1 / 60).position).toBeLessThanOrEqual(3)
  })
})