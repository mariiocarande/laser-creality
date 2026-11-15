// Interactive 2D sheet viewer: zoom and pan, mm rulers, cursor readout,
// layer toggles, piece names on hover and one tab per sheet.
//
// The sheet itself is rendered through an <img> (never inline SVG), so
// user-supplied artwork inside the preview can never run scripts. The img is
// resized rather than CSS-scaled, so the browser re-rasterises it crisp at
// every zoom level.

const MM_TO_PX_100 = 96 / 25.4      // 100 % zoom ≈ real size on a typical screen
const MAX_SCALE = 60                // px per mm
const FIT_PADDING = 28
const RULER = 22
const WHEEL_STEP = 1.0018
const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]

const viewers = new WeakMap()

const LAYERS = [
  { key: 'engrave', label: 'Grabado', css: '.layer-engrave' },
  { key: 'cut', label: 'Corte', css: '.layer-cut' },
  { key: 'label', label: 'Nombres', css: '.layer-label' },
]

function sheetSizeOf(svg) {
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/)
  return m ? { w: Number(m[3]), h: Number(m[4]) } : { w: 100, h: 100 }
}

function withLayerStyle(svg, layers) {
  const hidden = LAYERS.filter(l => !layers[l.key]).map(l => `${l.css}{display:none}`).join('')
  const style = `<style>.layer-cut *{vector-effect:non-scaling-stroke}${hidden}</style>`
  return svg.replace(/<svg([^>]*)>/, `<svg$1>${style}`)
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function createViewer(container) {
  container.innerHTML = ''
  const root = el('div', 'sv')
  const toolbar = el('div', 'sv-toolbar')
  const tabs = el('div', 'sv-tabs')
  const layerBar = el('div', 'sv-group')
  const zoomBar = el('div', 'sv-group')
  toolbar.append(tabs, layerBar, zoomBar)

  const stage = el('div', 'sv-stage')
  stage.tabIndex = 0
  stage.setAttribute('aria-label', 'Plano de corte: arrastrá para mover, rueda o pellizco para zoom')
  const rulerX = el('canvas', 'sv-ruler sv-ruler-x')
  const rulerY = el('canvas', 'sv-ruler sv-ruler-y')
  const corner = el('div', 'sv-corner', 'mm')
  const viewport = el('div', 'sv-viewport')
  const img = el('img', 'sv-sheet')
  img.alt = 'Vista previa de la plancha'
  img.draggable = false
  viewport.appendChild(img)
  const readout = el('div', 'sv-readout')
  const tip = el('div', 'sv-tip')
  stage.append(rulerX, rulerY, corner, viewport, readout, tip)
  root.append(toolbar, stage)
  container.appendChild(root)

  const v = {
    root, stage, viewport, img, rulerX, rulerY, readout, tip, tabs, layerBar, zoomBar,
    svgs: [], pieces: [], index: 0, url: null,
    layers: { engrave: true, cut: true, label: true },
    size: { w: 100, h: 100 }, scale: 1, x: 0, y: 0, fitted: false, sizeKey: '',
  }

  // ── Toolbar ──
  LAYERS.forEach(layer => {
    const b = el('button', 'sv-chip on', layer.label)
    b.type = 'button'
    b.dataset.layer = layer.key
    b.setAttribute('aria-pressed', 'true')
    b.addEventListener('click', () => {
      v.layers[layer.key] = !v.layers[layer.key]
      b.classList.toggle('on', v.layers[layer.key])
      b.setAttribute('aria-pressed', String(v.layers[layer.key]))
      showSheet(v)
    })
    layerBar.appendChild(b)
  })
  const zoomBtn = (label, title, action) => {
    const b = el('button', 'sv-chip', label)
    b.type = 'button'
    b.title = title
    b.setAttribute('aria-label', title)
    b.addEventListener('click', action)
    zoomBar.appendChild(b)
    return b
  }
  zoomBtn('−', 'Alejar', () => zoomAt(v, 1 / 1.25))
  v.zoomLabel = zoomBtn('100%', 'Tamaño real (100 %)', () => setScale(v, MM_TO_PX_100))
  zoomBtn('+', 'Acercar', () => zoomAt(v, 1.25))
  zoomBtn('Ajustar', 'Ajustar a la vista', () => fit(v))

  // ── Interaction ──
  const pointers = new Map()
  let pinch = null
  stage.addEventListener('wheel', e => {
    e.preventDefault()
    const rect = viewport.getBoundingClientRect()
    zoomAt(v, Math.pow(WHEEL_STEP, -e.deltaY), e.clientX - rect.left, e.clientY - rect.top)
  }, { passive: false })

  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    stage.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: v.scale }
    }
    stage.classList.add('grabbing')
  })
  stage.addEventListener('pointermove', e => {
    const rect = viewport.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    updateReadout(v, px, py)
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2 - rect.left, cy = (a.y + b.y) / 2 - rect.top
      zoomAt(v, (pinch.scale * dist) / pinch.dist / v.scale, cx, cy)
    } else if (pointers.size === 1) {
      v.x += e.clientX - prev.x
      v.y += e.clientY - prev.y
      layout(v)
    }
  })
  const release = e => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (!pointers.size) stage.classList.remove('grabbing')
  }
  stage.addEventListener('pointerup', release)
  stage.addEventListener('pointercancel', release)
  stage.addEventListener('pointerleave', () => { readout.textContent = ''; tip.style.display = 'none' })
  stage.addEventListener('dblclick', () => fit(v))
  stage.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoomAt(v, 1.25)
    else if (e.key === '-') zoomAt(v, 1 / 1.25)
    else if (e.key === '0') fit(v)
    else return
    e.preventDefault()
  })

  new ResizeObserver(() => { if (v.fitted || v.needsFit) fit(v); else layout(v) }).observe(stage)
  return v
}

function viewportSize(v) {
  return { w: v.viewport.clientWidth, h: v.viewport.clientHeight }
}

function fit(v) {
  const { w, h } = viewportSize(v)
  if (!w || !h) { v.needsFit = true; return }
  v.needsFit = false
  v.scale = Math.max(0.05, Math.min((w - 2 * FIT_PADDING) / v.size.w, (h - 2 * FIT_PADDING) / v.size.h))
  v.x = (w - v.size.w * v.scale) / 2
  v.y = (h - v.size.h * v.scale) / 2
  v.fitted = true
  layout(v)
}

function setScale(v, scale) {
  const { w, h } = viewportSize(v)
  zoomAt(v, scale / v.scale, w / 2, h / 2)
}

function zoomAt(v, factor, px, py) {
  const { w, h } = viewportSize(v)
  if (px === undefined) { px = w / 2; py = h / 2 }
  const next = Math.min(MAX_SCALE, Math.max(0.05, v.scale * factor))
  const mmX = (px - v.x) / v.scale
  const mmY = (py - v.y) / v.scale
  v.scale = next
  v.x = px - mmX * next
  v.y = py - mmY * next
  v.fitted = false
  layout(v)
}

function layout(v) {
  const { img } = v
  img.style.left = `${v.x}px`
  img.style.top = `${v.y}px`
  img.style.width = `${v.size.w * v.scale}px`
  img.style.height = `${v.size.h * v.scale}px`
  v.zoomLabel.textContent = `${Math.round((v.scale / MM_TO_PX_100) * 100)}%`
  drawRulers(v)
}

function drawRuler(canvas, length, offset, scale, horizontal, highlight) {
  const dpr = window.devicePixelRatio || 1
  const cssW = horizontal ? length : RULER
  const cssH = horizontal ? RULER : length
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  const styles = getComputedStyle(canvas)
  ctx.fillStyle = styles.getPropertyValue('--sv-ruler-bg') || '#0c1318'
  ctx.fillRect(0, 0, cssW, cssH)
  if (highlight) {
    ctx.fillStyle = 'rgba(255, 107, 26, 0.12)'
    const a = offset, b = offset + highlight * scale
    if (horizontal) ctx.fillRect(a, 0, b - a, cssH)
    else ctx.fillRect(0, a, cssW, b - a)
  }

  const step = TICK_STEPS.find(s => s * scale >= 48) || 1000
  const minor = step / (step >= 10 && (step / 10) * scale >= 6 ? 10 : 5)
  const first = Math.floor(-offset / scale / minor) * minor
  const last = (length - offset) / scale
  ctx.strokeStyle = '#3d5163'
  ctx.fillStyle = '#7d93a3'
  ctx.font = '9px "JetBrains Mono", monospace'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let mm = first; mm <= last; mm += minor) {
    const p = Math.round(offset + mm * scale) + 0.5
    const major = Math.abs(mm / step - Math.round(mm / step)) < 1e-6
    const size = major ? RULER * 0.6 : RULER * 0.25
    if (horizontal) { ctx.moveTo(p, RULER); ctx.lineTo(p, RULER - size) } else { ctx.moveTo(RULER, p); ctx.lineTo(RULER - size, p) }
    if (major) {
      const text = String(Math.round(mm * 10) / 10)
      if (horizontal) ctx.fillText(text, p + 3, 10)
      else { ctx.save(); ctx.translate(10, p - 3); ctx.rotate(-Math.PI / 2); ctx.fillText(text, 0, 0); ctx.restore() }
    }
  }
  ctx.stroke()
}

function drawRulers(v) {
  const { w, h } = viewportSize(v)
  drawRuler(v.rulerX, w, v.x, v.scale, true, v.size.w)
  drawRuler(v.rulerY, h, v.y, v.scale, false, v.size.h)
}

function updateReadout(v, px, py) {
  const x = (px - v.x) / v.scale
  const y = (py - v.y) / v.scale
  const inside = x >= 0 && y >= 0 && x <= v.size.w && y <= v.size.h
  v.readout.textContent = inside ? `x ${x.toFixed(1)}  y ${y.toFixed(1)} mm` : ''
  const piece = inside && (v.pieces[v.index] || []).find(p => p.label && x >= p.x && y >= p.y && x <= p.x + p.w && y <= p.y + p.h)
  if (piece) {
    v.tip.textContent = `${piece.label} · ${piece.w.toFixed(1)} × ${piece.h.toFixed(1)} mm`
    v.tip.style.display = 'block'
    v.tip.style.left = `${px + RULER + 14}px`
    v.tip.style.top = `${py + RULER + 14}px`
  } else {
    v.tip.style.display = 'none'
  }
}

function showSheet(v) {
  if (v.url) URL.revokeObjectURL(v.url)
  const svg = v.svgs[v.index]
  v.url = URL.createObjectURL(new Blob([withLayerStyle(svg, v.layers)], { type: 'image/svg+xml' }))
  v.img.src = v.url
  const size = sheetSizeOf(svg)
  const key = `${size.w}x${size.h}`
  v.size = size
  // Keep the user's zoom while they tweak settings; refit when the sheet size changes.
  if (key !== v.sizeKey || v.needsFit) { v.sizeKey = key; fit(v) } else layout(v)
}

function renderTabs(v) {
  v.tabs.innerHTML = ''
  if (v.svgs.length < 2) return
  v.svgs.forEach((_, i) => {
    const b = el('button', 'sv-chip' + (i === v.index ? ' on' : ''), `Plancha ${i + 1}`)
    b.type = 'button'
    b.addEventListener('click', () => { v.index = i; renderTabs(v); showSheet(v) })
    v.tabs.appendChild(b)
  })
}

// svgs: preview SVG strings (one per sheet). options.pieces: per sheet,
// [{ x, y, w, h, label }] for hover names.
export function renderSheetViewer(container, svgs, options = {}) {
  let v = viewers.get(container)
  if (!svgs.length) {
    if (v && v.url) URL.revokeObjectURL(v.url)
    viewers.delete(container)
    container.innerHTML = ''
    return
  }
  if (!v || !container.contains(v.root)) {
    v = createViewer(container)
    viewers.set(container, v)
  }
  v.svgs = svgs
  v.pieces = options.pieces || []
  v.index = Math.min(v.index, svgs.length - 1)
  v.layerBar.querySelector('[data-layer="label"]').hidden = !svgs.some(s => s.includes('layer-label'))
  renderTabs(v)
  showSheet(v)
}
