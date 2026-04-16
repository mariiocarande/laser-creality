import '../style.css'
import { DB } from './db.js'
import { state } from './state.js'
import {
  toGray, floydSteinberg, applyThreshold,
  sobelEdges, traceContours, edgesToSVG,
} from './imageProcessing.js'
import { buildMaterialGrid, buildColorOpts, updateSettingsDisplay } from './ui.js'

// ── STATE SETTERS ──────────────────────────────────────────────

function setMaterial(key) {
  state.material = key
  state.color = 'medium'
  document.querySelectorAll('.mat-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.mat === key)
  )
  buildColorOpts(setColor)
  if (DB[key].noCut && state.mode === 'cut') setMode('engrave')
  updateSettingsDisplay()
}

function setColor(key) {
  state.color = key
  document.querySelectorAll('.col-opt').forEach(b =>
    b.classList.toggle('on', b.dataset.col === key)
  )
  updateSettingsDisplay()
}

function setMode(m) {
  state.mode = m
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === m)
  )
  const thickRow      = document.getElementById('thick-row')
  const threshGrp     = document.getElementById('thresh-group')
  const ditherRow     = document.getElementById('dither-row')
  const edgeThreshGrp = document.getElementById('edge-thresh-group')
  const dlBtn         = document.getElementById('dl-btn')
  const svgDlBtn      = document.getElementById('svg-dl-btn')

  thickRow.style.display      = m === 'cut'     ? 'grid'  : 'none'
  threshGrp.style.display     = m === 'cut'     ? 'block' : 'none'
  ditherRow.style.display     = m === 'engrave' ? 'flex'  : 'none'
  edgeThreshGrp.style.display = m === 'vector'  ? 'block' : 'none'
  dlBtn.style.display         = m === 'vector'  ? 'none'  : 'block'
  svgDlBtn.style.display      = m === 'vector'  ? 'block' : 'none'

  updateSettingsDisplay()
}

function setThick(t) {
  state.thickness = t
  document.querySelectorAll('.thick-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.t === t)
  )
  updateSettingsDisplay()
}

// ── IMAGE UPLOAD ───────────────────────────────────────────────

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return

  const reader = new FileReader()
  reader.onload = ev => {
    state.originalSrc  = ev.target.result
    state.processedSrc = null
    state.svgSrc       = null
    state.outputWidth  = 0
    state.outputHeight = 0
    state.pathCount    = 0

    document.getElementById('drop-zone').style.display = 'none'
    const thumbRow = document.getElementById('thumb-row')
    thumbRow.style.display = 'flex'
    document.getElementById('thumb-img').src          = ev.target.result
    document.getElementById('thumb-name').textContent = file.name
    document.getElementById('thumb-size').textContent = (file.size / 1024).toFixed(0) + ' KB'

    showOriginal()
    document.getElementById('proc-btn').disabled = false
  }
  reader.readAsDataURL(file)
}

function showOriginal() {
  const img   = document.getElementById('prev-img')
  const empty = document.getElementById('prev-empty')
  empty.style.display = 'none'
  img.src             = state.originalSrc
  img.style.display   = 'block'
  state.activeTab     = 'original'
  document.querySelectorAll('.prev-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === 'original')
  )
}

function switchTab(tab) {
  state.activeTab = tab
  document.querySelectorAll('.prev-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === tab)
  )

  const img   = document.getElementById('prev-img')
  const empty = document.getElementById('prev-empty')

  if (tab === 'original') {
    if (state.originalSrc) {
      img.src = state.originalSrc
      img.style.display   = 'block'
      empty.style.display = 'none'
    } else {
      img.style.display   = 'none'
      empty.style.display = 'block'
    }
  } else {
    if (state.processedSrc) {
      img.src = state.processedSrc
      img.style.display   = 'block'
      empty.style.display = 'none'
    } else {
      img.style.display   = 'none'
      empty.style.display = 'block'
      empty.querySelector('.prev-empty-txt').textContent =
        'Presioná "Procesar imagen" primero'
    }
  }
}

// ── IMAGE PROCESSING ───────────────────────────────────────────

function processImage() {
  if (!state.originalSrc) return

  const overlay = document.getElementById('processing-overlay')
  overlay.classList.add('show')

  setTimeout(() => {
    const img = new Image()
    img.onload = () => {
      const cv  = document.getElementById('cv')
      const MAX = 1200
      let w = img.naturalWidth
      let h = img.naturalHeight

      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }

      cv.width  = w
      cv.height = h
      const ctx = cv.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      const id = ctx.getImageData(0, 0, w, h)
      const d  = id.data

      toGray(d, state.contrast, state.brightness, state.invert)

      state.outputWidth  = w
      state.outputHeight = h
      state.pathCount    = 0

      if (state.mode === 'cut') {
        applyThreshold(d, state.threshold)
        ctx.putImageData(id, 0, 0)
        state.processedSrc = cv.toDataURL('image/png')
        state.svgSrc = null
      } else if (state.mode === 'vector') {
        const edges = sobelEdges(d, w, h, state.edgeThreshold)

        for (let i = 0; i < w * h; i++) {
          const v = edges[i] ? 255 : 0
          d[i*4] = d[i*4+1] = d[i*4+2] = v
          d[i*4+3] = 255
        }
        ctx.putImageData(id, 0, 0)
        state.processedSrc = cv.toDataURL('image/png')

        const contours  = traceContours(edges, w, h)
        state.pathCount = contours.length
        state.svgSrc    = edgesToSVG(contours, w, h)
      } else {
        if (state.dither) floydSteinberg(d, w, h)
        ctx.putImageData(id, 0, 0)
        state.processedSrc = cv.toDataURL('image/png')
        state.svgSrc = null
      }

      overlay.classList.remove('show')
      switchTab('processed')
      document.getElementById('dl-btn').disabled     = state.mode === 'vector' || !state.processedSrc
      document.getElementById('svg-dl-btn').disabled = state.mode !== 'vector' || !state.svgSrc
      updateSettingsDisplay()
    }
    img.src = state.originalSrc
  }, 50)
}

// ── DOWNLOADS ─────────────────────────────────────────────────

function downloadProcessed() {
  if (!state.processedSrc) return
  const a = document.createElement('a')
  a.download = `laser_${state.material}_${state.color}_${state.mode}.png`
  a.href     = state.processedSrc
  a.click()
}

function downloadSVG() {
  if (!state.svgSrc) return
  const blob = new Blob([state.svgSrc], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.download = `laser_bordes_${state.material}.svg`
  a.href     = url
  a.click()
  URL.revokeObjectURL(url)
}

// ── INIT ──────────────────────────────────────────────────────

function init() {
  buildMaterialGrid(setMaterial)
  buildColorOpts(setColor)
  updateSettingsDisplay()

  // Upload
  const dropZone = document.getElementById('drop-zone')
  const fileInput = document.getElementById('file-input')

  dropZone.addEventListener('dragover', e => {
    e.preventDefault()
    dropZone.classList.add('drag')
  })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'))
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.classList.remove('drag')
    handleFile(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', e => handleFile(e.target.files[0]))
  document.getElementById('change-btn').addEventListener('click', () => fileInput.click())

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  })

  // Thickness buttons
  document.querySelectorAll('.thick-btn').forEach(btn => {
    btn.addEventListener('click', () => setThick(btn.dataset.t))
  })

  // Tabs
  document.querySelectorAll('.prev-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })

  // Sliders
  const sliders = ['sl-contrast', 'sl-bright', 'sl-thresh', 'sl-edge-thresh']
  sliders.forEach(id => {
    document.getElementById(id).addEventListener('input', onSlider)
  })

  // Toggles
  document.getElementById('tog-dither').addEventListener('click', () => {
    state.dither = !state.dither
    document.getElementById('tog-dither').classList.toggle('on', state.dither)
  })
  document.getElementById('tog-invert').addEventListener('click', () => {
    state.invert = !state.invert
    document.getElementById('tog-invert').classList.toggle('on', state.invert)
  })

  // Action buttons
  document.getElementById('proc-btn').addEventListener('click', processImage)
  document.getElementById('dl-btn').addEventListener('click', downloadProcessed)
  document.getElementById('svg-dl-btn').addEventListener('click', downloadSVG)

  // Keyboard shortcut: Enter → process
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.target.matches('input, button') &&
        state.originalSrc && !document.getElementById('proc-btn').disabled) {
      processImage()
    }
  })
}

function onSlider() {
  state.contrast      = parseFloat(document.getElementById('sl-contrast').value)
  state.brightness    = parseFloat(document.getElementById('sl-bright').value)
  state.threshold     = parseInt(document.getElementById('sl-thresh').value)
  state.edgeThreshold = parseInt(document.getElementById('sl-edge-thresh').value)
  document.getElementById('lbl-contrast').textContent    = state.contrast.toFixed(2)
  document.getElementById('lbl-bright').textContent      = state.brightness
  document.getElementById('lbl-thresh').textContent      = state.threshold
  document.getElementById('lbl-edge-thresh').textContent = state.edgeThreshold
}

init()
