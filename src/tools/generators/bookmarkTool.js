import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { readImageFile } from '../../imageInput.js'
import { toGray, floydSteinberg, applyThreshold } from '../../imageProcessing.js'
import { downloadSvgs } from '../../sheets.js'
import { SHAPES } from '../../holidays.js'
import { attachDxf } from '../../dxfButton.js'
import { state } from '../../state.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'

// Bookmarks and hanging tags made from the user's own artwork: the image is
// fitted, processed for engraving (dither, grayscale or threshold) and masked
// to the piece; the outline and hanging hole are vector cuts.

const SOURCE_PX = 3200
const MAX_PIECES = 40
const LABEL_BAND = 12      // mm reserved at the bottom when a piece has text
const FRAME_LINE = 0.5
const FRAME_LINE_THIN = 0.25

const model = {
  source: 'files',        // 'files' (one image per piece) | 'sheet' (split one image)
  cols: 8, rows: 1, trim: 3,
  width: 40, height: 150,
  top: 'tab', radius: 5,
  holeDiameter: 5, ring: 3,
  frame: true, inset: 2.5,
  process: 'dither', brightness: 0, contrast: 1.2, threshold: 128, dpi: 254, focus: 50, invert: false,
  labels: '', font: 'bebas',
  copies: 1,
}

const sections = [
  { title: 'Imágenes', fields: [
    { type: 'html', html: `
      <div class="drop-zone" data-role="drop">
        <input type="file" accept="image/*" multiple aria-label="Elegir imágenes">
        <span class="up-ico">⬆</span>
        <div class="up-title">Arrastrá tus ilustraciones o hacé click</div>
        <div class="up-sub">Una o varias imágenes (JPG, PNG, WEBP) — también podés pegar con Ctrl+V</div>
      </div>
      <div class="bm-files" data-role="files"></div>
      <button class="mini-btn" data-role="demo">Probar con un ejemplo</button>` },
    { type: 'choice', key: 'source', label: 'Cómo usar las imágenes', options: [['files', 'Una por señalador'], ['sheet', 'Lámina con varios']] },
    { type: 'row', fields: [
      { type: 'number', key: 'cols', label: 'Columnas', min: 1, max: 20, step: 1, showIf: m => m.source === 'sheet' },
      { type: 'number', key: 'rows', label: 'Filas', min: 1, max: 6, step: 1, showIf: m => m.source === 'sheet' },
      { type: 'number', key: 'trim', label: 'Recorte borde (%)', min: 0, max: 25, step: 0.5, showIf: m => m.source === 'sheet' },
    ] },
    { type: 'hint', text: 'Lámina con varios: la app divide la imagen en columnas y filas iguales. Subí el recorte si se cuelan los marcos o agujeros de la lámina original.' },
  ] },
  { title: 'Forma', fields: [
    { type: 'choice', key: 'top', options: [['tab', 'Con oreja'], ['arch', 'Arco'], ['flat', 'Rectangular']] },
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho (mm)', min: 20, step: 1 },
      { type: 'number', key: 'height', label: 'Alto (mm)', min: 40, step: 1 },
      { type: 'number', key: 'radius', label: 'Esquinas (mm)', min: 0, step: 0.5 },
    ] },
    { type: 'row', fields: [
      { type: 'number', key: 'holeDiameter', label: 'Agujero (mm)', min: 0, max: 20, step: 0.5 },
      { type: 'number', key: 'ring', label: 'Borde del agujero (mm)', min: 1.5, max: 10, step: 0.5 },
    ] },
    { type: 'hint', text: 'Agujero en 0 = sin agujero. Para borla o cinta usá 4–5 mm; para argolla de llavero, 6–8 mm.' },
    { type: 'toggle', key: 'frame', label: 'Marco grabado doble' },
    { type: 'number', key: 'inset', label: 'Margen del marco (mm)', min: 1, step: 0.5, showIf: m => m.frame },
  ] },
  { title: 'Imagen para grabar', fields: [
    { type: 'choice', key: 'process', options: [['dither', 'Tramado'], ['gray', 'Escala de grises'], ['threshold', 'Blanco y negro']] },
    { type: 'range', key: 'brightness', label: 'Brillo', min: -80, max: 80, step: 1, format: v => v },
    { type: 'range', key: 'contrast', label: 'Contraste', min: 0.5, max: 2.5, step: 0.05, format: v => v.toFixed(2) },
    { type: 'range', key: 'threshold', label: 'Umbral', min: 30, max: 225, step: 1, format: v => v, showIf: m => m.process === 'threshold' },
    { type: 'range', key: 'focus', label: 'Encuadre vertical', min: 0, max: 100, step: 1, format: v => `${v}%` },
    { type: 'number', key: 'dpi', label: 'Resolución (DPI)', min: 100, max: 600, step: 1 },
    { type: 'toggle', key: 'invert', label: 'Invertir (para pizarra o madera oscura)' },
    { type: 'hint', text: 'Tramado: para grabar como imagen en 1 bit. Escala de grises: para el modo Grayscale de LightBurn. Blanco y negro: para dibujos de línea como manga.' },
  ] },
  { title: 'Texto y copias', fields: [
    { type: 'textarea', key: 'labels', label: 'Texto abajo de cada señalador (uno por línea, en orden; opcional)', rows: 3 },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
    { type: 'number', key: 'copies', label: 'Copias de cada uno', min: 1, max: 20, step: 1 },
  ] },
]

let refs = null
let images = []           // [{ canvas, name }]
let exportSvgs = []
let timer = 0
let token = 0
let rootEl = null
let pasteBound = false

function onPaste(e) {
  if (!rootEl?.isConnected || state.view !== 'generators') return
  const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile())
  if (files.length) { e.preventDefault(); addFiles(files) }
}

const f = n => Number(n.toFixed(3)).toString()

// ── geometry (mm) ────────────────────────────────────────────────

function geometry() {
  const W = model.width, H = model.height
  const holeR = model.holeDiameter / 2
  const hasHole = holeR > 0
  const R = hasHole ? holeR + model.ring : 0
  const r = Math.max(0, Math.min(model.radius, W / 2 - 0.5))
  let outline, hole = null, bodyTop

  if (model.top === 'tab' && hasHole) {
    const ear = Math.min(R, W / 2 - r - 0.5)
    const y0 = ear
    bodyTop = y0
    outline = `M${f(r)} ${f(y0)}H${f(W / 2 - ear)}A${f(ear)} ${f(ear)} 0 1 1 ${f(W / 2 + ear)} ${f(y0)}H${f(W - r)}` +
      `A${f(r)} ${f(r)} 0 0 1 ${f(W)} ${f(y0 + r)}V${f(H - r)}A${f(r)} ${f(r)} 0 0 1 ${f(W - r)} ${f(H)}` +
      `H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(H - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(y0)}Z`
    hole = { x: W / 2, y: y0, r: Math.min(holeR, ear - 1.2) }
  } else if (model.top === 'arch') {
    const a = W / 2
    bodyTop = 0
    outline = `M0 ${f(a)}A${f(a)} ${f(a)} 0 0 1 ${f(W)} ${f(a)}V${f(H - r)}A${f(r)} ${f(r)} 0 0 1 ${f(W - r)} ${f(H)}` +
      `H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(H - r)}Z`
    if (hasHole) hole = { x: W / 2, y: R + 2, r: holeR }
  } else {
    bodyTop = 0
    outline = `M${f(r)} 0H${f(W - r)}A${f(r)} ${f(r)} 0 0 1 ${f(W)} ${f(r)}V${f(H - r)}A${f(r)} ${f(r)} 0 0 1 ${f(W - r)} ${f(H)}` +
      `H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(H - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`
    if (hasHole) hole = { x: W / 2, y: R + 2, r: holeR }
  }

  // Inner shape (frame and artwork) offset inward by `k`.
  const inner = k => {
    const ri = Math.max(0.5, r - k)
    const x0 = k, x1 = W - k, y1 = H - k
    if (model.top === 'arch') {
      const a = W / 2 - k
      return `M${f(x0)} ${f(W / 2)}A${f(a)} ${f(a)} 0 0 1 ${f(x1)} ${f(W / 2)}V${f(y1 - ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x1 - ri)} ${f(y1)}` +
        `H${f(x0 + ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x0)} ${f(y1 - ri)}Z`
    }
    const y0 = bodyTop + k
    return `M${f(x0 + ri)} ${f(y0)}H${f(x1 - ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x1)} ${f(y0 + ri)}V${f(y1 - ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x1 - ri)} ${f(y1)}` +
      `H${f(x0 + ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x0)} ${f(y1 - ri)}V${f(y0 + ri)}A${f(ri)} ${f(ri)} 0 0 1 ${f(x0 + ri)} ${f(y0)}Z`
  }
  return { W, H, outline, hole, R, bodyTop, inner }
}

// ── sources ──────────────────────────────────────────────────────

// Crop rectangles (in source pixels) for every piece.
function sourceCrops() {
  if (!images.length) return []
  if (model.source === 'files') return images.map(img => ({ canvas: img.canvas, sx: 0, sy: 0, sw: img.canvas.width, sh: img.canvas.height }))
  const img = images[0].canvas
  const cols = Math.max(1, Math.round(model.cols)), rows = Math.max(1, Math.round(model.rows))
  const cw = img.width / cols, ch = img.height / rows
  const tx = (cw * model.trim) / 100, ty = (ch * model.trim) / 100
  const crops = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      crops.push({ canvas: img, sx: i * cw + tx, sy: j * ch + ty, sw: cw - 2 * tx, sh: ch - 2 * ty })
    }
  }
  return crops
}

// ── artwork rendering ────────────────────────────────────────────

function renderArt(crop, g, artTop, artBottom) {
  const k = (model.frame ? model.inset + 2.2 : 1.2)
  const box = { x: k, y: model.top === 'arch' ? k : g.bodyTop + k, w: g.W - 2 * k }
  box.h = artBottom - box.y
  if (box.w <= 2 || box.h <= 2) return ''
  const pxPerMm = model.dpi / 25.4
  const w = Math.max(4, Math.round(box.w * pxPerMm)), h = Math.max(4, Math.round(box.h * pxPerMm))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  // Cover-fit the crop, sliding it vertically with the focus control.
  const scale = Math.max(w / crop.sw, h / crop.sh)
  const dw = crop.sw * scale, dh = crop.sh * scale
  const dx = (w - dw) / 2, dy = (h - dh) * (model.focus / 100)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(crop.canvas, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh)

  const image = ctx.getImageData(0, 0, w, h)
  toGray(image.data, model.contrast, model.brightness, model.invert)
  if (model.process === 'dither') floydSteinberg(image.data, w, h)
  else if (model.process === 'threshold') applyThreshold(image.data, model.threshold)
  ctx.putImageData(image, 0, 0)

  // Keep only the inside of the frame, and leave the area round the hole clear.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, -box.x * pxPerMm, -box.y * pxPerMm)
  ctx.fill(new Path2D(g.inner(k)))
  ctx.restore()
  ctx.save()
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, -box.x * pxPerMm, -box.y * pxPerMm)
  if (g.hole) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(g.hole.x, g.hole.y, g.hole.r + model.ring * 0.85, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)

  const url = canvas.toDataURL('image/png')
  return `<image x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" preserveAspectRatio="none" href="${url}" xlink:href="${url}"/>`
}

// ── update ───────────────────────────────────────────────────────

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true
  const crops = sourceCrops().slice(0, MAX_PIECES)
  if (!crops.length) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Subí una o más ilustraciones para empezar')
    refs.setInfo('')
    refs.setWarn('')
    return
  }
  refs.setEmpty('Procesando imágenes…')

  const labels = model.labels.split('\n').map(s => s.trim())
  let font = null
  if (labels.some(Boolean)) {
    try { font = await loadFont(model.font) } catch { /* text skipped */ }
    if (run !== token) return
  }

  const g = geometry()
  const line = (d, w) => `<path fill="none" stroke="#000000" stroke-width="${w}" d="${d}"/>`
  const pieces = []

  for (let i = 0; i < crops.length; i++) {
    const label = labels[i] || ''
    const k = model.frame ? model.inset : 0
    const artBottom = g.H - (model.frame ? model.inset + 2.2 : 1.2) - (label && font ? LABEL_BAND : 0)

    let engrave = renderArt(crops[i], g, 0, artBottom)
    if (model.frame) {
      engrave += line(g.inner(k), FRAME_LINE) + line(g.inner(k + 1.2), FRAME_LINE_THIN)
      if (g.hole) engrave += line(`M${f(g.hole.x - g.hole.r - model.ring * 0.6)} ${f(g.hole.y)}a${f(g.hole.r + model.ring * 0.6)} ${f(g.hole.r + model.ring * 0.6)} 0 1 0 ${f(2 * (g.hole.r + model.ring * 0.6))} 0a${f(g.hole.r + model.ring * 0.6)} ${f(g.hole.r + model.ring * 0.6)} 0 1 0 ${f(-2 * (g.hole.r + model.ring * 0.6))} 0`, FRAME_LINE_THIN)
    }
    if (label && font) {
      const band = { x: k + 3, y: artBottom + 1.5, w: g.W - 2 * k - 6, h: LABEL_BAND - 3.5 }
      engrave += line(`M${f(k + 2)} ${f(artBottom + 0.6)}H${f(g.W - k - 2)}`, FRAME_LINE_THIN)
      const t = textBlock(font, label, 200, band.w, band.h * 0.75)
      if (t) engrave += textMarkup(t, band.x + (band.w - t.w) / 2, band.y + (band.h - t.h) / 2)
    }
    const cut = `<path d="${g.outline}"/>` + (g.hole ? `<circle cx="${f(g.hole.x)}" cy="${f(g.hole.y)}" r="${f(g.hole.r)}"/>` : '')
    for (let c = 0; c < Math.max(1, Math.round(model.copies)); c++) {
      pieces.push({ w: g.W, h: g.H, cut, engrave, label: label || `Señalador ${i + 1}` })
    }
    await new Promise(resolve => setTimeout(resolve, 0))
    if (run !== token) return
  }

  const { svgs, sheets, oversize, machine } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `${pieces.length} pieza${pieces.length === 1 ? '' : 's'} de <strong>${g.W} × ${g.H} mm</strong>` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'} de ${machine.area.w} × ${machine.area.h} mm` +
    ` &nbsp;·&nbsp; imagen a ${Math.round(model.dpi)} DPI`,
  )
  const warnings = []
  if (oversize.length) warnings.push('⚠ La pieza no entra en el área de la máquina.')
  if (sourceCrops().length > MAX_PIECES) warnings.push(`⚠ Se usan las primeras ${MAX_PIECES} imágenes.`)
  if (g.hole && model.top === 'tab' && g.hole.r < model.holeDiameter / 2 - 0.01) warnings.push('⚠ El agujero se achicó para que entre en la oreja: agrandá el ancho o bajá el borde del agujero.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(update, 300)
}

// ── image list ───────────────────────────────────────────────────

function renderFiles() {
  const list = rootEl.querySelector('[data-role="files"]')
  list.innerHTML = ''
  images.forEach((img, i) => {
    const chip = document.createElement('span')
    chip.className = 'bm-chip'
    chip.textContent = img.name
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = '✕'
    remove.setAttribute('aria-label', `Quitar ${img.name}`)
    remove.addEventListener('click', () => { images.splice(i, 1); renderFiles(); schedule() })
    chip.appendChild(remove)
    list.appendChild(chip)
  })
}

async function addFiles(files) {
  for (const file of files) {
    try {
      const img = await readImageFile(file, SOURCE_PX)
      images.push({ canvas: img.canvas, name: img.name })
      URL.revokeObjectURL(img.url)
    } catch (err) {
      refs.setWarn(err.message)
    }
  }
  renderFiles()
  schedule()
}

// A sample sheet drawn with the app's own silhouettes, so the tool can be
// tried without uploading anything.
function demoSheet() {
  const cols = 3, pw = 480, ph = 1500
  const canvas = document.createElement('canvas')
  canvas.width = pw * cols
  canvas.height = ph
  const ctx = canvas.getContext('2d')
  const scenes = [
    { sky: ['#0b1020', '#3a4a7a'], shapes: [['moon', 0.5, 0.18, 2.4], ['bat', 0.3, 0.42, 1.6], ['bat', 0.7, 0.5, 1.2], ['ghost', 0.5, 0.78, 3.2]] },
    { sky: ['#0d2a1a', '#5f8a5a'], shapes: [['star', 0.5, 0.12, 1.6], ['tree', 0.5, 0.5, 4.4], ['gingerbread', 0.5, 0.86, 2]] },
    { sky: ['#3a1020', '#c06a7a'], shapes: [['heart', 0.5, 0.2, 2.4], ['flower', 0.3, 0.55, 1.6], ['flower', 0.72, 0.62, 1.3], ['hearts', 0.5, 0.85, 2.4]] },
  ]
  scenes.forEach((scene, i) => {
    const x0 = i * pw
    const grad = ctx.createLinearGradient(0, 0, 0, ph)
    grad.addColorStop(0, scene.sky[0]); grad.addColorStop(1, scene.sky[1])
    ctx.fillStyle = grad
    ctx.fillRect(x0, 0, pw, ph)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (let s = 0; s < 70; s++) { ctx.beginPath(); ctx.arc(x0 + ((s * 97) % pw), (s * 211) % ph, 1 + (s % 3), 0, Math.PI * 2); ctx.fill() }
    scene.shapes.forEach(([id, fx, fy, k]) => {
      const shape = SHAPES[id]
      const [bw, bh] = shape.size
      ctx.save()
      ctx.translate(x0 + fx * pw - (bw * k) / 2, fy * ph - (bh * k) / 2)
      ctx.scale(k, k)
      ctx.fillStyle = '#f4e6c8'
      ctx.strokeStyle = '#f4e6c8'
      shape.draw(ctx)
      ctx.restore()
    })
  })
  return canvas
}

export const bookmarkTool = {
  id: 'bookmarks',
  icon: '🎴',
  title: 'Señaladores y colgantes ilustrados',
  description: 'Tus ilustraciones o personajes favoritos grabados en señaladores con oreja, arco o recto, marco doble y agujero a medida. Divide láminas con varios.',
  categories: ['personajes', 'regalos'],

  mount(root, { onBack }) {
    rootEl = root
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Subí tus imágenes (o una lámina con varios personajes) y armá señaladores listos para grabar y cortar.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, la imagen y el marco van como grabado. Grabá primero y cortá después sin mover la madera. Las imágenes ya vienen procesadas: en LightBurn usá el modo "Pass-Through" (o Grayscale si elegiste escala de grises). Usá imágenes propias o con permiso del autor; si vas a vender, ojo con los derechos de los personajes.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG de los señaladores' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    const syncControls = bindControls(refs.controls, sections, model, schedule)
    renderFiles()

    const zone = root.querySelector('[data-role="drop"]')
    const input = zone.querySelector('input')
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag') })
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'))
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); addFiles([...e.dataTransfer.files]) })
    input.addEventListener('change', e => { addFiles([...e.target.files]); input.value = '' })
    if (!pasteBound) { document.addEventListener('paste', onPaste); pasteBound = true }
    root.querySelector('[data-role="demo"]').addEventListener('click', () => {
      images = [{ canvas: demoSheet(), name: 'Lámina de ejemplo' }]
      model.source = 'sheet'; model.cols = 3; model.rows = 1; model.trim = 0
      syncControls()
      renderFiles()
      update()
    })

    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'senaladores'))
    attachDxf(refs.download('svg'), () => exportSvgs, 'senaladores', text => refs.setWarn(text))
    update()
  },
}
