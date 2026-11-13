import { state, onMachineChange } from '../state.js'
import { MACHINES } from '../machines.js'
import { vectorize, loopToPath } from '../vectorize.js'
import { layoutPiece } from '../pieceOutline.js'
import { buildSheetSvg, renderSheetPreviews, downloadSvgs } from '../sheets.js'

const MAX_TRACE_PX = 1000          // longest side used for tracing
const MAX_UPSCALE = 4
const MAX_FILE_BYTES = 20 * 1024 * 1024
const DOC_PADDING = 1              // mm around the piece so edge strokes are not clipped
const REFRESH_DELAY_MS = 60

const vec = {
  source: null,        // { data, w, h, url, name }
  threshold: 128,
  blur: 1,
  minArea: 30,
  precision: 0.8,
  invert: false,
  curves: true,
  outerOnly: false,
  width: 80,           // final width of the traced shape, mm
  output: 'engrave',   // 'cut' | 'engrave' | 'both'
  outline: 'none',     // 'none' | 'rect' | 'round' | 'circle'
  margin: 4,
  radius: 6,
  hole: false,
  holeDiameter: 4,
}

let exportSvg = null
let refreshTimer = 0

const el = id => document.getElementById(id)

// ── IMAGE LOADING ──────────────────────────────────────────────

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')) }
    img.src = url
  })
}

async function handleFile(file) {
  if (!file) return
  try {
    if (!file.type.startsWith('image/')) throw new Error('Formato no soportado. Usá PNG, JPG, WEBP o SVG.')
    if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera los 20 MB.')

    const { img, url } = await readImage(file)
    const naturalW = img.naturalWidth || 600
    const naturalH = img.naturalHeight || 600
    // Small images are enlarged first so their edges trace smoothly.
    const ratio = Math.min(MAX_UPSCALE, MAX_TRACE_PX / Math.max(naturalW, naturalH))
    const w = Math.max(1, Math.round(naturalW * ratio))
    const h = Math.max(1, Math.round(naturalH * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)

    if (vec.source) URL.revokeObjectURL(vec.source.url)
    vec.source = { data: ctx.getImageData(0, 0, w, h).data, w, h, url, name: file.name || 'imagen pegada' }
    showFileError('')
  } catch (err) {
    showFileError(err.message)
  }
  syncSourceUi()
  update()
}

function showFileError(text) {
  const box = el('vec-file-error')
  box.textContent = text
  box.style.display = text ? 'block' : 'none'
}

function syncSourceUi() {
  const has = Boolean(vec.source)
  el('vec-drop').style.display = has ? 'none' : ''
  el('vec-file-row').style.display = has ? 'flex' : 'none'
  el('vec-file-name').textContent = has ? vec.source.name : ''
  el('vec-original').src = has ? vec.source.url : ''
}

// ── TRACING ────────────────────────────────────────────────────

function loopLength(points) {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return total
}

function showMessage(text) {
  const warn = el('vec-warn')
  warn.textContent = text || ''
  warn.style.display = text ? 'block' : 'none'
}

function showEmpty(text) {
  renderSheetPreviews(el('vec-preview'), [])
  el('vec-empty-txt').textContent = text
  el('vec-empty').style.display = el('vec-original').hidden ? 'block' : 'none'
  el('vec-info').style.display = 'none'
  el('vec-dl-btn').disabled = true
  exportSvg = null
}

function update() {
  if (!vec.source) { showMessage(''); showEmpty('Subí una imagen para empezar'); return }

  const { data, w, h } = vec.source
  const traced = vectorize(data, w, h, vec)
  if (!traced.bounds || !traced.bounds.w || !traced.bounds.h) {
    showMessage('')
    showEmpty('No quedó ninguna forma. Probá mover el umbral o invertir.')
    return
  }

  const { bounds, loops } = traced
  const scale = vec.width / bounds.w
  const content = { w: vec.width, h: bounds.h * scale }
  const piece = layoutPiece(content, vec)

  const toMm = ([x, y]) => [(x - bounds.x) * scale + piece.x, (y - bounds.y) * scale + piece.y]
  const d = loops.map(loop => loopToPath(loop.points.map(toMm), vec.curves)).join('')

  const wantsCut = vec.output !== 'engrave'
  const wantsEngrave = vec.output !== 'cut'
  const placement = {
    x: DOC_PADDING,
    y: DOC_PADDING,
    w: piece.w,
    h: piece.h,
    cut: (wantsCut ? `<path d="${d}"/>` : '') + piece.cut,
    engrave: wantsEngrave ? `<path fill="#000000" fill-rule="evenodd" d="${d}"/>` : '',
  }
  const docW = Number((piece.w + 2 * DOC_PADDING).toFixed(3))
  const docH = Number((piece.h + 2 * DOC_PADDING).toFixed(3))

  exportSvg = buildSheetSvg([placement], docW, docH)
  renderSheetPreviews(el('vec-preview'), [buildSheetSvg([placement], docW, docH, { preview: true, previewStroke: Math.max(0.12, docW / 350) })])
  el('vec-empty').style.display = 'none'

  const traceLength = wantsCut ? loops.reduce((sum, loop) => sum + loopLength(loop.points), 0) * scale : 0
  const cutLength = traceLength + piece.cutLength
  let info =
    `<strong>${piece.w.toFixed(1)} × ${piece.h.toFixed(1)} mm</strong>` +
    ` &nbsp;·&nbsp; ${loops.length} trazado${loops.length === 1 ? '' : 's'}` +
    ` &nbsp;·&nbsp; ${traced.nodeCount} nodos`
  if (cutLength > 0) info += ` &nbsp;·&nbsp; ${(cutLength / 1000).toFixed(2)} m de corte`
  el('vec-info').innerHTML = info
  el('vec-info').style.display = 'block'

  const machine = MACHINES[state.machine]
  const messages = []
  if (piece.w > machine.area.w || piece.h > machine.area.h) {
    messages.push(`⚠ La pieza no entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm).`)
  }
  if (traced.nodeCount > 6000) {
    messages.push('⚠ Salieron muchos nodos. Para fotos conviene "Preparar imagen"; para logos, subí la precisión o el filtro de manchas.')
  }
  showMessage(messages.join(' '))
  el('vec-dl-btn').disabled = false
}

function scheduleUpdate() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(update, REFRESH_DELAY_MS)
}

// ── CONTROLS ───────────────────────────────────────────────────

const SLIDERS = [
  { id: 'vec-threshold', key: 'threshold', label: v => v },
  { id: 'vec-blur',      key: 'blur',      label: v => v },
  { id: 'vec-min-area',  key: 'minArea',   label: v => `${v} px²` },
  { id: 'vec-precision', key: 'precision', label: v => `${v.toFixed(1)} px` },
]

const TOGGLES = [
  { id: 'vec-invert', key: 'invert' },
  { id: 'vec-curves', key: 'curves' },
  { id: 'vec-outer-only', key: 'outerOnly' },
  { id: 'vec-hole', key: 'hole' },
]

function readNumber(id, fallback, min) {
  const value = parseFloat(el(id).value.replace(',', '.'))
  return Number.isFinite(value) && value >= min ? value : fallback
}

function syncOutlineUi() {
  const hasOutline = vec.outline !== 'none'
  el('vec-margin-field').style.display = hasOutline ? '' : 'none'
  el('vec-radius-field').style.display = vec.outline === 'round' ? '' : 'none'
  el('vec-hole-row').style.display = hasOutline ? 'flex' : 'none'
  el('vec-hole-field').style.display = hasOutline && vec.hole ? '' : 'none'
}

function bindChoice(selector, key, after) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', () => {
      vec[key] = btn.dataset.value
      document.querySelectorAll(selector).forEach(b => b.classList.toggle('on', b === btn))
      if (after) after()
      update()
    })
  })
}

function setPreviewTab(view) {
  document.querySelectorAll('.vec-view-tab').forEach(tab =>
    tab.classList.toggle('on', tab.dataset.vecview === view)
  )
  const showOriginal = view === 'original'
  el('vec-original').hidden = !showOriginal || !vec.source
  el('vec-preview').hidden = showOriginal
  el('vec-empty').style.display = (showOriginal ? !vec.source : !exportSvg) ? 'block' : 'none'
}

export function initVectorTool() {
  const drop = el('vec-drop')
  const fileInput = el('vec-file')
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag') })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'))
  drop.addEventListener('drop', e => {
    e.preventDefault()
    drop.classList.remove('drag')
    handleFile(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', e => handleFile(e.target.files[0]))
  el('vec-remove').addEventListener('click', () => {
    if (vec.source) URL.revokeObjectURL(vec.source.url)
    vec.source = null
    fileInput.value = ''
    syncSourceUi()
    update()
    setPreviewTab('vector')
  })

  // Paste an image straight from the clipboard while this tab is open.
  document.addEventListener('paste', e => {
    if (state.view !== 'vector') return
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); handleFile(item.getAsFile()) }
  })

  SLIDERS.forEach(({ id, key, label }) => {
    const input = el(id)
    const apply = () => {
      vec[key] = parseFloat(input.value)
      el(`lbl-${id}`).textContent = label(vec[key])
    }
    input.addEventListener('input', () => { apply(); scheduleUpdate() })
    apply()
  })

  TOGGLES.forEach(({ id, key }) => {
    el(id).classList.toggle('on', vec[key])
    el(id).addEventListener('click', () => {
      vec[key] = !vec[key]
      el(id).classList.toggle('on', vec[key])
      syncOutlineUi()
      update()
    })
  })

  ;['vec-width', 'vec-margin', 'vec-radius', 'vec-hole-d'].forEach(id => {
    el(id).addEventListener('input', () => {
      vec.width        = readNumber('vec-width', vec.width, 1)
      vec.margin       = readNumber('vec-margin', vec.margin, 0)
      vec.radius       = readNumber('vec-radius', vec.radius, 0)
      vec.holeDiameter = readNumber('vec-hole-d', vec.holeDiameter, 0.5)
      scheduleUpdate()
    })
  })

  bindChoice('.vec-output-btn', 'output')
  bindChoice('.vec-outline-btn', 'outline', syncOutlineUi)

  document.querySelectorAll('.vec-view-tab').forEach(tab => {
    tab.addEventListener('click', () => setPreviewTab(tab.dataset.vecview))
  })

  el('vec-dl-btn').addEventListener('click', () => {
    if (exportSvg) downloadSvgs([exportSvg], 'vectorizado')
  })

  onMachineChange(update)
  syncSourceUi()
  syncOutlineUi()
  update()
}
