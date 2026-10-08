import './dashboard.css'
import { amplitudeToDbfs, advanceNeedle, applyIntegration, frequencyForX, noteFromFrequency } from './audio/math'

type MeterMode = 'VU' | 'PPM' | 'PEAK'
type MeterState = { rms: number; ppm: number; peak: number; heldPeak: number; holdUntil: number; clipUntil: number; needle: number; velocity: number }

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="SoundCraft Pro, accueil"><span class="brand-mark">SC</span><span>soundcraft<span class="brand-light">pro</span></span></a>
    <div class="top-context"><span class="live-dot" id="header-dot"></span><span id="header-status">SYSTÈME EN VEILLE</span><span class="top-divider"></span><span>ANALYSE ACOUSTIQUE</span></div>
    <div class="top-right"><span class="latency-chip"><span class="tiny-led"></span> LATENCE <b id="latency">-- ms</b></span><button class="icon-button" id="fullscreen" title="Plein écran" aria-label="Activer le plein écran"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg></button></div>
  </header>
  <main class="workspace">
    <section class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> POSTE DE MESURE <span class="eyebrow-index">01 / 04</span></div><h1>Analyse <span>acoustique</span></h1><p>Mesure en temps réel de la réponse fréquentielle et des niveaux d'entrée.</p></div><div class="session-clock"><span class="clock-label">SESSION</span><strong id="session-clock">00:00:00</strong></div></section>
    <section class="control-strip" aria-label="Réglages de l'acquisition">
      <div class="control-item device-control"><label for="device-select">ENTRÉE AUDIO</label><div class="select-wrap"><select id="device-select"><option value="">Sélectionner une entrée…</option></select><span class="select-chevron">⌄</span></div></div>
      <div class="control-item channel-control"><label for="channel-select">CANAUX</label><div class="select-wrap"><select id="channel-select"><option value="1">Mono</option><option value="2">Stéréo</option></select><span class="select-chevron">⌄</span></div></div>
      <div class="control-item gain-control"><label for="gain-slider">GAIN NUMÉRIQUE <strong id="gain-readout">1.0×</strong></label><input id="gain-slider" type="range" min="0" max="2" step="0.01" value="1" aria-label="Gain numérique d'entrée"></div>
      <div class="control-actions"><button class="text-button" id="refresh-devices" title="Actualiser les entrées"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.9-2L20 12M4 12l2.5 5a7 7 0 0 0 11.9-2"/></svg><span>Actualiser</span></button><button class="start-button" id="start-analysis"><span class="start-icon">▶</span><span>Démarrer l’analyse</span></button></div>
    </section>
    <div class="notice" id="notice" role="status"><span class="notice-icon">i</span><span id="notice-text">Autorisez l’accès au microphone pour commencer. La mesure reste locale à cet appareil.</span><button id="dismiss-notice" aria-label="Fermer l'information">×</button></div>
    <section class="instrument-grid">
      <article class="panel spectrum-panel">
        <div class="panel-heading"><div><span class="section-kicker">01 / SPECTRE</span><h2>Analyseur RTA</h2></div><div class="panel-tools"><label class="compact-control"><span>FFT</span><select id="fft-size" aria-label="Taille FFT"><option>512</option><option>1024</option><option selected>2048</option><option>4096</option><option>8192</option></select></label><label class="compact-control"><span>LISSAGE</span><input id="smoothing" type="range" min="0" max="0.95" step="0.05" value="0.65" aria-label="Lissage du spectre"></label></div></div>
        <div class="spectrum-readout"><div><span class="readout-label">FRÉQUENCE</span><strong id="cursor-frequency">— <small>Hz</small></strong></div><div><span class="readout-label">NIVEAU</span><strong id="cursor-level">— <small>dBFS</small></strong></div><div class="spectrum-range"><span>20 Hz</span><span>20 kHz</span></div></div>
        <div class="spectrum-chart"><canvas id="spectrum-canvas" aria-label="Spectre audio de 20 Hz à 20 kHz"></canvas><div class="chart-empty" id="chart-empty"><span class="empty-wave">∿</span><strong>En attente du signal</strong><span>Le spectre apparaîtra dès le démarrage de la mesure</span></div><div class="chart-tooltip" id="chart-tooltip"></div></div>
        <div class="chart-legend"><span><i class="legend-current"></i> Spectre temps réel</span><span><i class="legend-hold"></i> Peak hold</span><span class="chart-note" id="chart-note">FFT 2 048 · Fenêtre de Hann</span></div>
      </article>
      <article class="panel pitch-panel"><div class="panel-heading"><div><span class="section-kicker">02 / ACCORDAGE</span><h2>Fréquence dominante</h2></div><span class="worklet-badge">AUDIO WORKLET</span></div><div class="pitch-display"><span class="pitch-frequency" id="pitch-frequency">—<small>Hz</small></span><div class="pitch-note" id="pitch-note">--</div><div class="pitch-cents" id="pitch-cents">En attente de signal</div></div><div class="tuning-track"><div class="tuning-labels"><span>−50 ¢</span><span>JUSTE</span><span>+50 ¢</span></div><div class="tuning-line"><span class="tuning-center"></span><span class="tuning-marker" id="tuning-marker"></span></div></div><p class="pitch-footnote">Autocorrélation · fenêtre 85 ms</p></article>
      <article class="panel meters-panel" id="meters-panel"><div class="panel-heading"><div><span class="section-kicker">03 / NIVEAUX</span><h2>Vu-mètres</h2></div><button class="icon-button compact-screen" id="meter-fullscreen" title="Plein écran vumètres" aria-label="Plein écran vumètres"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg></button></div><div class="meter-toolbar"><div class="mode-switch" role="group" aria-label="Mode de vumètre"><button class="mode-button active" data-mode="VU">VU</button><button class="mode-button" data-mode="PPM">PPM</button><button class="mode-button" data-mode="PEAK">Peak</button></div><label class="reference-control"><span>0 VU =</span><select id="reference-select" aria-label="Référence 0 VU"><option value="-18">−18 dBFS</option><option value="-20">−20 dBFS</option></select></label></div><div class="meter-pair" id="meter-pair"><div class="meter-unit"><div class="meter-canvas-wrap"><canvas class="meter-canvas" id="meter-left" aria-label="Vu-mètre canal gauche"></canvas><span class="meter-leds"><i id="peak-led-left"></i><i id="clip-led-left"></i></span></div><span class="channel-label" id="left-label">ENTRÉE</span><div class="digital-level"><span>RMS <b id="rms-left">−∞</b></span><span>PK <b id="peak-left">−∞</b></span></div></div><div class="meter-unit meter-right-unit" id="right-unit"><div class="meter-canvas-wrap"><canvas class="meter-canvas" id="meter-right" aria-label="Vu-mètre canal droit"></canvas><span class="meter-leds"><i id="peak-led-right"></i><i id="clip-led-right"></i></span></div><span class="channel-label">DROITE</span><div class="digital-level"><span>RMS <b id="rms-right">−∞</b></span><span>PK <b id="peak-right">−∞</b></span></div></div></div><div class="meter-footer"><label class="calibration"><span>OFFSET SPL</span><input type="number" id="spl-offset" value="94" min="0" max="140" aria-label="Offset de calibration SPL"><span>dB</span></label><div class="spl-readout"><span>SPL ESTIMÉ</span><strong id="spl-value">— <small>dB</small></strong></div></div></article>
    </section>
    <section class="bottom-strip"><div class="signal-state"><span class="state-icon">⌁</span><div><strong id="signal-label">Aucun signal</strong><span id="signal-detail">Connectez une entrée audio pour commencer</span></div></div><div class="bottom-guidance"><span class="guidance-mark">i</span><span>Réglez le préampli pour viser <b>−18 dBFS en moyenne</b> et garder les crêtes sous −6 dBFS.</span></div><span class="build-label">SOUNDCRAFT PRO <b>v0.1 · PHASE 01</b></span></section>
  </main>`

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const spectrumCanvas = $('#spectrum-canvas') as HTMLCanvasElement
const spectrumContext = spectrumCanvas.getContext('2d')!
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('.mode-button')]
const state: { context?: AudioContext; stream?: MediaStream; source?: MediaStreamAudioSourceNode; gain?: GainNode; analyser?: AnalyserNode; splitter?: ChannelSplitterNode; leftAnalyser?: AnalyserNode; rightAnalyser?: AnalyserNode; pitchNode?: AudioWorkletNode; running: boolean; mode: MeterMode; reference: number; smoothing: number; spectrum: Float32Array; peakHold: Float32Array; meters: MeterState[]; lastFrame: number; sessionStarted: number; sessionTimer?: number; latencyTimer?: number; pitchFrequency?: number; cursorFrequency?: number; cursorLevel?: number } = {
  running: false, mode: 'VU', reference: -18, smoothing: 0.65, spectrum: new Float32Array(0), peakHold: new Float32Array(0), meters: [{ rms: 0, ppm: 0, peak: 0, heldPeak: 0, holdUntil: 0, clipUntil: 0, needle: 0, velocity: 0 }, { rms: 0, ppm: 0, peak: 0, heldPeak: 0, holdUntil: 0, clipUntil: 0, needle: 0, velocity: 0 }], lastFrame: 0, sessionStarted: 0,
}

const formatDb = (value: number) => value < -119 ? '−∞' : `${value.toFixed(1)} dBFS`
const frequencyLabels = [20, 31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 12000, 20000]

function showNotice(message: string, kind: 'info' | 'warning' | 'error' = 'info') {
  const notice = $('#notice')
  notice.className = `notice ${kind}`
  $('#notice-text').textContent = message
  notice.classList.remove('hidden')
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, height?: number) {
  const bounds = canvas.getBoundingClientRect()
  if (!bounds.width) return
  const ratio = window.devicePixelRatio || 1
  const targetHeight = height ?? bounds.height
  const width = Math.round(bounds.width * ratio)
  const pixelHeight = Math.round(targetHeight * ratio)
  if (canvas.width !== width || canvas.height !== pixelHeight) {
    canvas.width = width
    canvas.height = pixelHeight
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function drawSpectrum() {
  resizeCanvas(spectrumCanvas, spectrumContext)
  const ctx = spectrumContext
  const { width, height } = spectrumCanvas.getBoundingClientRect()
  if (!width || !height) return
  ctx.clearRect(0, 0, width, height)
  const left = 43, right = width - 12, top = 13, bottom = height - 27
  const plotWidth = right - left, plotHeight = bottom - top
  ctx.fillStyle = '#121a26'
  ctx.fillRect(left, top, plotWidth, plotHeight)
  ctx.font = '10px "IBM Plex Mono", monospace'
  ctx.textBaseline = 'middle'
  for (let db = 0; db >= -100; db -= 20) {
    const y = top + ((0 - db) / 100) * plotHeight
    ctx.strokeStyle = db === 0 ? '#304052' : '#243142'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke()
    ctx.fillStyle = '#7f90a5'; ctx.textAlign = 'right'; ctx.fillText(`${db}`, left - 8, y)
  }
  const sampleRate = state.context?.sampleRate ?? 48000
  const binWidth = sampleRate / (state.analyser?.fftSize ?? 2048)
  for (const frequency of frequencyLabels) {
    const x = left + (Math.log10(frequency / 20) / Math.log10(20000 / 20)) * plotWidth
    ctx.strokeStyle = '#243142'; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke()
    ctx.fillStyle = '#8d9aab'; ctx.textAlign = 'center'
    ctx.fillText(frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`, x, bottom + 15)
  }
  if (!state.running || state.spectrum.length === 0) return
  const nyquist = sampleRate / 2
  const valueAt = (frequency: number, values: Float32Array) => {
    const bin = Math.max(0, Math.min(values.length - 1, Math.round(frequency / binWidth)))
    return values[bin] ?? -100
  }
  const xFor = (frequency: number) => left + (Math.log10(frequency / 20) / Math.log10(20000 / 20)) * plotWidth
  const yFor = (db: number) => top + Math.max(0, Math.min(100, -db)) / 100 * plotHeight
  ctx.beginPath()
  for (let x = 0; x <= plotWidth; x += 2) {
    const frequency = 20 * (20000 / 20) ** (x / plotWidth)
    const db = valueAt(Math.min(frequency, nyquist), state.spectrum)
    const y = yFor(db)
    if (x === 0) ctx.moveTo(left + x, y); else ctx.lineTo(left + x, y)
  }
  ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath()
  const fill = ctx.createLinearGradient(0, top, 0, bottom)
  fill.addColorStop(0, 'rgba(0, 150, 255, .34)'); fill.addColorStop(1, 'rgba(0, 150, 255, .015)')
  ctx.fillStyle = fill; ctx.fill()
  ctx.beginPath()
  for (let x = 0; x <= plotWidth; x += 2) {
    const frequency = 20 * (20000 / 20) ** (x / plotWidth)
    const db = valueAt(Math.min(frequency, nyquist), state.spectrum)
    if (x === 0) ctx.moveTo(left + x, yFor(db)); else ctx.lineTo(left + x, yFor(db))
  }
  ctx.strokeStyle = '#19a5ff'; ctx.lineWidth = 1.7; ctx.stroke()
  ctx.beginPath()
  for (let x = 0; x <= plotWidth; x += 3) {
    const frequency = 20 * (20000 / 20) ** (x / plotWidth)
    const db = valueAt(Math.min(frequency, nyquist), state.peakHold)
    if (x === 0) ctx.moveTo(left + x, yFor(db)); else ctx.lineTo(left + x, yFor(db))
  }
  ctx.strokeStyle = 'rgba(255, 193, 7, .76)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([])
  if (state.cursorFrequency && state.cursorLevel !== undefined) {
    const x = xFor(state.cursorFrequency), y = yFor(state.cursorLevel)
    ctx.strokeStyle = 'rgba(240,247,255,.55)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#f4f8fc'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
  }
}

function drawMeter(canvas: HTMLCanvasElement, meter: MeterState) {
  const context = canvas.getContext('2d')!
  resizeCanvas(canvas, context)
  const { width, height } = canvas.getBoundingClientRect()
  if (!width || !height) return
  const ctx = context
  ctx.clearRect(0, 0, width, height)
  const cx = width / 2, cy = height * 0.84, radius = Math.min(width * 0.43, height * 0.72)
  const start = Math.PI * 1.16, end = Math.PI * 1.84
  const angleForDb = (db: number) => start + ((db + 20) / 23) * (end - start)
  ctx.fillStyle = '#e7e2d4'
  ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#2b3138'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.stroke()
  for (let db = -20; db <= 3; db++) {
    const angle = angleForDb(db), major = db % 5 === 0 || db === 3
    const outer = radius - 3, inner = radius - (major ? 12 : 7)
    ctx.strokeStyle = db >= 0 ? '#a23836' : '#42464a'; ctx.lineWidth = major ? 1.25 : 0.7
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner); ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer); ctx.stroke()
    if (major) {
      const tx = cx + Math.cos(angle) * (radius - 21), ty = cy + Math.sin(angle) * (radius - 21)
      ctx.fillStyle = db >= 0 ? '#a23836' : '#272b30'; ctx.font = '600 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(db > 0 ? `+${db}` : `${db}`, tx, ty)
    }
  }
  const needleDb = Math.max(-20, Math.min(3, meter.needle))
  const needleAngle = angleForDb(needleDb), needleLength = radius * 0.73
  ctx.strokeStyle = '#c93535'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needleAngle) * needleLength, cy + Math.sin(needleAngle) * needleLength); ctx.stroke()
  ctx.fillStyle = '#31363b'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#42464a'; ctx.font = '700 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(state.mode, cx, cy - 10)
}

function getMeterData(analyser: AnalyserNode | undefined) {
  if (!analyser) return { rms: 0, peak: 0 }
  const samples = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(samples)
  let sum = 0, peak = 0
  for (const sample of samples) { sum += sample * sample; peak = Math.max(peak, Math.abs(sample)) }
  return { rms: Math.sqrt(sum / samples.length), peak }
}

function frame(timestamp: number) {
  const dt = state.lastFrame ? Math.min((timestamp - state.lastFrame) / 1000, 0.05) : 1 / 60
  state.lastFrame = timestamp
  if (state.running && state.analyser && state.leftAnalyser) {
    const bins = new Float32Array(state.analyser.frequencyBinCount)
    state.analyser.getFloatFrequencyData(bins)
    if (state.peakHold.length !== bins.length) state.peakHold = new Float32Array(bins.length).fill(-120)
    for (let index = 0; index < bins.length; index++) {
      const previous = state.spectrum[index] ?? bins[index]
      state.spectrum[index] = previous + (bins[index] - previous) * (1 - state.smoothing)
      state.peakHold[index] = Math.max(state.peakHold[index] - 0.08, state.spectrum[index])
    }
    const data = [getMeterData(state.leftAnalyser), getMeterData(state.rightAnalyser ?? state.leftAnalyser)]
    const now = performance.now()
    for (let index = 0; index < (state.stream?.getAudioTracks()[0]?.getSettings().channelCount ?? 1); index++) {
      const meter = state.meters[index], reading = data[index]
      meter.rms = applyIntegration(meter.rms, reading.rms, dt, 0.3)
      meter.ppm = applyIntegration(meter.ppm, reading.peak, dt, reading.peak > meter.ppm ? 0.01 : 1.5)
      meter.peak = reading.peak
      if (reading.peak > meter.heldPeak) { meter.heldPeak = reading.peak; meter.holdUntil = now + 2000 }
      if (reading.peak >= 0.999) meter.clipUntil = now + 2000
      else if (now > meter.holdUntil) meter.heldPeak = applyIntegration(meter.heldPeak, 0, dt, 0.65)
      const amplitude = state.mode === 'VU' ? meter.rms : state.mode === 'PPM' ? meter.ppm : meter.heldPeak
      const targetDb = amplitudeToDbfs(amplitude) - state.reference
      const advanced = advanceNeedle({ position: meter.needle, velocity: meter.velocity }, targetDb, dt)
      meter.needle = advanced.position; meter.velocity = advanced.velocity
      const channelId = index === 0 ? 'left' : 'right'
      $(`#rms-${channelId}`).textContent = formatDb(amplitudeToDbfs(meter.rms))
      $(`#peak-${channelId}`).textContent = formatDb(amplitudeToDbfs(meter.peak))
      $(`#peak-led-${channelId}`).classList.toggle('lit', now < meter.holdUntil)
      $(`#clip-led-${channelId}`).classList.toggle('lit', now < meter.clipUntil)
      drawMeter($(`#meter-${channelId}`), meter)
    }
    const rmsDb = amplitudeToDbfs(state.meters[0].rms)
    $('#spl-value').innerHTML = `${Math.max(0, rmsDb + Number(($('#spl-offset') as HTMLInputElement).value)).toFixed(1)} <small>dB</small>`
    $('#chart-empty').classList.add('hidden')
  }
  drawSpectrum()
  requestAnimationFrame(frame)
}

async function refreshDevices() {
  const select = $('#device-select') as HTMLSelectElement
  const selected = select.value
  if (!navigator.mediaDevices?.enumerateDevices) {
    showNotice('L’API audio est indisponible. Utilisez un navigateur récent via HTTPS ou localhost.', 'error')
    return
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices.filter(device => device.kind === 'audioinput')
    select.innerHTML = '<option value="">Sélectionner une entrée…</option>' + inputs.map((device, index) => `<option value="${device.deviceId}">${device.label || `Entrée audio ${index + 1}`}</option>`).join('')
    if (selected && inputs.some(device => device.deviceId === selected)) select.value = selected
    if (!inputs.length) showNotice('Aucune entrée audio détectée. Vérifiez votre micro ou votre interface USB.', 'warning')
  } catch {
    showNotice('Impossible de lister les entrées audio. Vérifiez les autorisations du navigateur.', 'error')
  }
}

function stopAnalysis() {
  state.running = false
  state.pitchNode?.disconnect(); state.source?.disconnect(); state.gain?.disconnect(); state.analyser?.disconnect(); state.splitter?.disconnect(); state.leftAnalyser?.disconnect(); state.rightAnalyser?.disconnect()
  state.stream?.getTracks().forEach(track => track.stop())
  void state.context?.close()
  state.context = undefined; state.stream = undefined; state.pitchNode = undefined
  window.clearInterval(state.sessionTimer); window.clearInterval(state.latencyTimer)
  $('#start-analysis').innerHTML = '<span class="start-icon">▶</span><span>Démarrer l’analyse</span>'
  $('#start-analysis').classList.remove('active')
  $('#header-dot').classList.remove('active'); $('#header-status').textContent = 'SYSTÈME EN VEILLE'
  $('#signal-label').textContent = 'Aucun signal'; $('#signal-detail').textContent = 'Connectez une entrée audio pour commencer'
  $('#chart-empty').classList.remove('hidden')
}

async function startAnalysis() {
  if (state.running) { stopAnalysis(); return }
  if (!navigator.mediaDevices?.getUserMedia) {
    showNotice('L’accès au microphone exige HTTPS ou localhost. Ouvrez l’adresse sécurisée affichée par Vite.', 'error')
    return
  }
  try {
    const deviceId = ($('#device-select') as HTMLSelectElement).value
    const channelCount = Number(($('#channel-select') as HTMLSelectElement).value)
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), channelCount: { ideal: channelCount }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    state.context = new AudioContext({ latencyHint: 'interactive' })
    await state.context.resume()
    await state.context.audioWorklet.addModule('/worklets/pitch-processor.js')
    state.source = state.context.createMediaStreamSource(state.stream)
    state.gain = state.context.createGain(); state.gain.gain.value = Number(($('#gain-slider') as HTMLInputElement).value)
    state.analyser = state.context.createAnalyser(); state.analyser.fftSize = Number(($('#fft-size') as HTMLSelectElement).value); state.analyser.smoothingTimeConstant = 0
    state.splitter = state.context.createChannelSplitter(2)
    state.leftAnalyser = state.context.createAnalyser(); state.leftAnalyser.fftSize = 2048
    state.rightAnalyser = state.context.createAnalyser(); state.rightAnalyser.fftSize = 2048
    state.pitchNode = new AudioWorkletNode(state.context, 'pitch-detector', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' })
    state.pitchNode.port.onmessage = event => {
      const frequency = event.data.frequency as number | null
      if (!frequency) return
      state.pitchFrequency = frequency
      const note = noteFromFrequency(frequency)
      $('#pitch-frequency').innerHTML = `${frequency.toFixed(1)}<small>Hz</small>`
      $('#pitch-note').textContent = note.name
      $('#pitch-cents').textContent = `${note.cents > 0 ? '+' : ''}${note.cents} cents`
      $('#tuning-marker').style.left = `${50 + Math.max(-50, Math.min(50, note.cents))}%`
    }
    state.source.connect(state.gain)
    state.gain.connect(state.analyser)
    state.gain.connect(state.splitter)
    state.gain.connect(state.pitchNode)
    state.splitter.connect(state.leftAnalyser, 0)
    if ((state.stream.getAudioTracks()[0]?.getSettings().channelCount ?? channelCount) > 1) state.splitter.connect(state.rightAnalyser, 1)
    state.running = true; state.lastFrame = 0; state.sessionStarted = Date.now()
    state.spectrum = new Float32Array(state.analyser.frequencyBinCount); state.peakHold = new Float32Array(state.analyser.frequencyBinCount).fill(-120)
    $('#right-unit').classList.toggle('hidden', (state.stream.getAudioTracks()[0]?.getSettings().channelCount ?? channelCount) < 2)
    $('#start-analysis').innerHTML = '<span class="start-icon stop-icon">■</span><span>Arrêter l’analyse</span>'; $('#start-analysis').classList.add('active')
    $('#header-dot').classList.add('active'); $('#header-status').textContent = 'ANALYSE EN COURS'
    $('#signal-label').textContent = 'Signal actif'; $('#signal-detail').textContent = `${state.stream.getAudioTracks()[0]?.label || 'Entrée audio'} · ${state.context.sampleRate} Hz`
    $('#chart-note').textContent = `FFT ${state.analyser.fftSize.toLocaleString('fr-FR')} · Fenêtre Blackman`
    state.sessionTimer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.sessionStarted) / 1000)
      $('#session-clock').textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(value => `${value}`.padStart(2, '0')).join(':')
    }, 1000)
    state.latencyTimer = window.setInterval(() => { $('#latency').textContent = `${(state.context?.baseLatency ? state.context.baseLatency * 1000 : 0).toFixed(1)} ms` }, 1000)
    showNotice('Mesure en cours. Le traitement reste local; aucun signal n’est renvoyé vers les haut-parleurs.', 'info')
    await refreshDevices()
  } catch (error) {
    stopAnalysis()
    const name = (error as DOMException)?.name
    const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
      ? 'Accès au microphone refusé. Autorisez le microphone dans les réglages du site puis réessayez.'
      : name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Aucun microphone disponible. Branchez une entrée audio puis actualisez la liste.'
        : name === 'NotReadableError' || name === 'TrackStartError'
          ? 'L’entrée audio est utilisée par une autre application ou ne peut pas être ouverte.'
          : `Impossible de démarrer l’analyse${(error as Error)?.message ? ` : ${(error as Error).message}` : '.'}`
    showNotice(message, 'error')
  }
}

$('#start-analysis').addEventListener('click', () => void startAnalysis())
$('#refresh-devices').addEventListener('click', () => void refreshDevices())
$('#dismiss-notice').addEventListener('click', () => $('#notice').classList.add('hidden'))
$('#gain-slider').addEventListener('input', event => {
  const value = Number((event.currentTarget as HTMLInputElement).value)
  $('#gain-readout').textContent = `${value.toFixed(2)}×`
  if (state.gain) state.gain.gain.setTargetAtTime(value, state.context!.currentTime, 0.015)
})
$('#fft-size').addEventListener('change', event => {
  if (state.analyser) {
    state.analyser.fftSize = Number((event.currentTarget as HTMLSelectElement).value)
    state.spectrum = new Float32Array(state.analyser.frequencyBinCount); state.peakHold = new Float32Array(state.analyser.frequencyBinCount).fill(-120)
  }
  $('#chart-note').textContent = `FFT ${Number((event.currentTarget as HTMLSelectElement).value).toLocaleString('fr-FR')} · Fenêtre Blackman`
})
$('#smoothing').addEventListener('input', event => { state.smoothing = Number((event.currentTarget as HTMLInputElement).value) })
$('#reference-select').addEventListener('change', event => { state.reference = Number((event.currentTarget as HTMLSelectElement).value) })
$('#channel-select').addEventListener('change', () => { if (state.running) { stopAnalysis(); showNotice('Le nombre de canaux a changé. Redémarrez l’analyse pour appliquer le réglage.', 'warning') } })
$('#device-select').addEventListener('change', () => { if (state.running) { stopAnalysis(); showNotice('L’entrée a changé. Redémarrez l’analyse pour utiliser ce périphérique.', 'warning') } })
$('#spl-offset').addEventListener('input', () => { if (!state.running) $('#spl-value').innerHTML = `${($('#spl-offset') as HTMLInputElement).value} <small>dB</small>` })
modeButtons.forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode as MeterMode
  modeButtons.forEach(item => item.classList.toggle('active', item === button))
}))
$('#fullscreen').addEventListener('click', () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()))
$('#meter-fullscreen').addEventListener('click', () => void ($('#meters-panel').requestFullscreen?.()))
spectrumCanvas.addEventListener('pointermove', event => {
  const bounds = spectrumCanvas.getBoundingClientRect(), left = 43, right = bounds.width - 12
  const { frequency } = frequencyForX(event.clientX - bounds.left, left, right, 20, 20000)
  const bin = Math.round(frequency / ((state.context?.sampleRate ?? 48000) / (state.analyser?.fftSize ?? 2048)))
  state.cursorFrequency = frequency
  state.cursorLevel = state.spectrum[Math.min(bin, state.spectrum.length - 1)] ?? -100
  $('#cursor-frequency').innerHTML = `${frequency < 1000 ? frequency.toFixed(1) : (frequency / 1000).toFixed(2)} <small>${frequency < 1000 ? 'Hz' : 'kHz'}</small>`
  $('#cursor-level').innerHTML = `${state.running ? state.cursorLevel.toFixed(1) : '—'} <small>dBFS</small>`
  const tooltip = $('#chart-tooltip')
  tooltip.textContent = `${frequency.toFixed(1)} Hz · ${state.running ? `${state.cursorLevel.toFixed(1)} dBFS` : '— dBFS'}`
  tooltip.style.left = `${Math.min(bounds.width - 156, Math.max(10, event.clientX - bounds.left + 12))}px`
  tooltip.style.top = `${Math.max(6, event.clientY - bounds.top - 30)}px`; tooltip.classList.add('visible')
})
spectrumCanvas.addEventListener('pointerleave', () => $('#chart-tooltip').classList.remove('visible'))
window.addEventListener('resize', () => { drawSpectrum(); document.querySelectorAll<HTMLCanvasElement>('.meter-canvas').forEach((canvas, index) => drawMeter(canvas, state.meters[index])) })
navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshDevices())
void refreshDevices()
requestAnimationFrame(frame)
