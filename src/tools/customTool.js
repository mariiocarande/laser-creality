import { FONTS, loadAllFonts, textBlock, textMarkup } from '../textPaths.js'
import { state, onMachineChange } from '../state.js'
import { MACHINES } from '../machines.js'
import { layoutPiece } from '../pieceOutline.js'
import { packSheets, buildSheetSvg, renderSheetPreviews, downloadSvgs } from '../sheets.js'

const CONTENT_GAP = 3
const TEXT_OVERFLOW = 1.15   // text may be this much wider than the design before shrinking
const MAX_FILE_BYTES = 20 * 1024 * 1024

const custom = {
  design: null,        // { kind: 'svg' | 'image', markup, minX, minY, vbW, vbH, attrs, name }
  designWidth: 60,
  names: '',
  font: 'pacifico',
  fontSize: 12,
  textPos: 'below',    // 'below' | 'above' | 'over'
  outline: 'round',    // 'none' | 'rect' | 'round' | 'circle'
  margin: 4,
  radius: 6,
  hole: false,
  holeDiameter: 4,
}

let loadedFonts = {}
let exportSvgs = []

const el = id => document.getElementById(id)
const fmt = n => Number(n.toFixed(3)).toString()
const escapeAttr = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

// ── DESIGN LOADING ─────────────────────────────────────────────

const BLOCKED_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'metadata', 'title', 'desc']
const ROOT_ATTRS_SKIPPED = ['width', 'height', 'viewBox', 'x', 'y', 'version', 'id', 'preserveAspectRatio']

function sanitize(root) {
  root.querySelectorAll(BLOCKED_TAGS.join(',')).forEach(node => node.remove())
  ;[root, ...root.querySelectorAll('*')].forEach(node => {
    ;[...node.attributes].forEach(attr => {
      const isHandler = attr.name.toLowerCase().startsWith('on')
      const isScriptUrl = /^\s*javascript:/i.test(attr.value)
      if (isHandler || isScriptUrl) node.removeAttribute(attr.name)
    })
  })
}

function measureByBBox(root) {
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden'
  holder.appendChild(document.importNode(root, true))
  document.body.appendChild(holder)
  const b = holder.firstChild.getBBox()
  holder.remove()
  return [b.x, b.y, b.width, b.height]
}

function parseSvgDesign(text, name) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('El archivo no es un SVG válido.')
  }
  sanitize(root)

  let box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) {
    const w = parseFloat(root.getAttribute('width'))
    const h = parseFloat(root.getAttribute('height'))
    box = w > 0 && h > 0 ? [0, 0, w, h] : measureByBBox(root)
  }
  if (!(box[2] > 0 && box[3] > 0)) throw new Error('No pude leer el tamaño del SVG.')

  const attrs = [...root.attributes]
    .filter(a => !a.name.startsWith('xmlns') && !ROOT_ATTRS_SKIPPED.includes(a.name))
    .map(a => `${a.name}="${escapeAttr(a.value)}"`)
    .join(' ')

  const serializer = new XMLSerializer()
  const markup = [...root.childNodes].map(node => serializer.serializeToString(node)).join('')

  return { kind: 'svg', markup, attrs, minX: box[0], minY: box[1], vbW: box[2], vbH: box[3], name }
}

function readAs(file, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader[method](file)
  })
}

function loadImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight])
    img.onerror = () => reject(new Error('No se pudo abrir la imagen.'))
    img.src = src
  })
}

async function handleFile(file) {
  if (!file) return
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera los 20 MB.')
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    if (isSvg) {
      custom.design = parseSvgDesign(await readAs(file, 'readAsText'), file.name)
    } else if (file.type.startsWith('image/')) {
      const src = await readAs(file, 'readAsDataURL')
      const [w, h] = await loadImageSize(src)
      custom.design = { kind: 'image', markup: src, minX: 0, minY: 0, vbW: w, vbH: h, name: file.name }
    } else {
      throw new Error('Formato no soportado. Usá SVG, PNG o JPG.')
    }
    showFileError('')
  } catch (err) {
    showFileError(err.message)
  }
  syncDesignUi()
  update()
}

function showFileError(text) {
  const box = el('custom-file-error')
  box.textContent = text
  box.style.display = text ? 'block' : 'none'
}

function syncDesignUi() {
  const has = Boolean(custom.design)
  el('custom-drop').style.display = has ? 'none' : ''
  el('custom-file-row').style.display = has ? 'flex' : 'none'
  el('custom-file-name').textContent = has ? custom.design.name : ''
  el('custom-raster-note').style.display = has && custom.design.kind === 'image' ? 'block' : 'none'
}

// ── PIECE BUILDING ─────────────────────────────────────────────

function designMarkup(x, y, w, h) {
  const d = custom.design
  if (d.kind === 'image') {
    const src = escapeAttr(d.markup)
    return `<image x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" href="${src}" xlink:href="${src}"/>`
  }
  const s = w / d.vbW
  return `<g transform="translate(${fmt(x - d.minX * s)},${fmt(y - d.minY * s)}) scale(${s.toFixed(6)})" ${d.attrs}>${d.markup}</g>`
}

function measureText(font, text, maxWidth) {
  return textBlock(font, text, custom.fontSize, maxWidth) || { w: 0, h: 0 }
}

function buildPieces() {
  const names = custom.names.split('\n').map(s => s.trim()).filter(Boolean)
  const font = loadedFonts[custom.font]
  const d = custom.design
  if (!d && !names.length) return []
  if (names.length && !font) return []

  const dw = d ? custom.designWidth : 0
  const dh = d ? (dw * d.vbH) / d.vbW : 0

  const texts = names.map(name => measureText(font, name, d ? dw * TEXT_OVERFLOW : 0))
    .filter(t => t.w > 0 && t.h > 0)
  const tw = Math.max(0, ...texts.map(t => t.w))
  const th = Math.max(0, ...texts.map(t => t.h))
  const stacked = custom.textPos !== 'over'
  const gap = d && texts.length && stacked ? CONTENT_GAP : 0

  const cw = Math.max(dw, tw)
  const ch = stacked ? dh + gap + th : Math.max(dh, th)

  const piece = layoutPiece({ w: cw, h: ch }, custom)
  const { w: pw, h: ph, x: ox, y: oy, cut: outlineCut } = piece

  const designY = stacked && custom.textPos === 'above' ? oy + th + gap : oy + (stacked ? 0 : (ch - dh) / 2)
  const textBlockY = stacked ? (custom.textPos === 'above' ? oy : oy + dh + gap) : oy + (ch - th) / 2
  const designPart = d ? designMarkup(ox + (cw - dw) / 2, designY, dw, dh) : ''

  const list = texts.length ? texts : [null]
  return list.map(t => ({
    w: pw,
    h: ph,
    cut: outlineCut,
    engrave: designPart + (t ? textMarkup(t, ox + (cw - t.w) / 2, textBlockY + (th - t.h) / 2) : ''),
  }))
}

// ── RENDER ─────────────────────────────────────────────────────

function showMessage(text) {
  const warn = el('custom-warn')
  warn.textContent = text || ''
  warn.style.display = text ? 'block' : 'none'
}

function update() {
  const machine = MACHINES[state.machine]
  const pieces = buildPieces()
  const preview = el('custom-preview')
  const info = el('custom-info')
  const empty = el('custom-empty')
  exportSvgs = []

  if (!pieces.length) {
    renderSheetPreviews(preview, [])
    empty.style.display = 'block'
    info.style.display = 'none'
    showMessage('')
    el('custom-dl-btn').disabled = true
    return
  }
  empty.style.display = 'none'

  const { sheets, oversize } = packSheets(pieces, machine.area.w, machine.area.h, { allowRotate: false })
  const sheetPlacements = sheets.map(sheet => sheet.map(p => ({
    x: p.x, y: p.y, w: p.w, h: p.h, cut: p.item.cut, engrave: p.item.engrave,
  })))

  exportSvgs = sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h))
  renderSheetPreviews(
    preview,
    sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h, { preview: true })),
  )

  info.innerHTML =
    `${pieces.length} pieza${pieces.length === 1 ? '' : 's'} de <strong>${pieces[0].w.toFixed(1)} × ${pieces[0].h.toFixed(1)} mm</strong>` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'} de ${machine.area.w} × ${machine.area.h} mm`
  info.style.display = 'block'

  showMessage(oversize.length
    ? `⚠ La pieza mide ${pieces[0].w.toFixed(0)} × ${pieces[0].h.toFixed(0)} mm y no entra en el área de la máquina. Achicá el diseño.`
    : '')
  el('custom-dl-btn').disabled = exportSvgs.length === 0
}

function readNumber(id, fallback, min) {
  const value = parseFloat(el(id).value.replace(',', '.'))
  return Number.isFinite(value) && value >= min ? value : fallback
}

function onInput() {
  custom.designWidth  = readNumber('custom-width', custom.designWidth, 1)
  custom.names        = el('custom-names').value
  custom.fontSize     = readNumber('custom-font-size', custom.fontSize, 1)
  custom.margin       = readNumber('custom-margin', custom.margin, 0)
  custom.radius       = readNumber('custom-radius', custom.radius, 0)
  custom.holeDiameter = readNumber('custom-hole-d', custom.holeDiameter, 0.5)
  update()
}

function syncOutlineUi() {
  const hasOutline = custom.outline !== 'none'
  el('custom-margin-field').style.display = hasOutline ? '' : 'none'
  el('custom-radius-field').style.display = custom.outline === 'round' ? '' : 'none'
  el('custom-hole-row').style.display = hasOutline ? 'flex' : 'none'
  el('custom-hole-field').style.display = hasOutline && custom.hole ? '' : 'none'
}

function bindChoice(selector, key, after) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', () => {
      custom[key] = btn.dataset.value
      document.querySelectorAll(selector).forEach(b => b.classList.toggle('on', b === btn))
      if (after) after()
      update()
    })
  })
}

async function loadFonts() {
  loadedFonts = await loadAllFonts()
  update()
}

export function initCustomTool() {
  const fontSelect = el('custom-font')
  Object.entries(FONTS).forEach(([key, font]) => {
    const opt = document.createElement('option')
    opt.value = key
    opt.textContent = font.label
    fontSelect.appendChild(opt)
  })
  fontSelect.value = custom.font
  fontSelect.addEventListener('change', () => { custom.font = fontSelect.value; update() })

  const drop = el('custom-drop')
  const fileInput = el('custom-file')
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag') })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'))
  drop.addEventListener('drop', e => {
    e.preventDefault()
    drop.classList.remove('drag')
    handleFile(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', e => handleFile(e.target.files[0]))
  el('custom-remove').addEventListener('click', () => {
    custom.design = null
    fileInput.value = ''
    syncDesignUi()
    update()
  })

  ;['custom-width', 'custom-names', 'custom-font-size', 'custom-margin', 'custom-radius', 'custom-hole-d']
    .forEach(id => el(id).addEventListener('input', onInput))

  bindChoice('.custom-pos-btn', 'textPos')
  bindChoice('.custom-outline-btn', 'outline', syncOutlineUi)

  el('custom-hole').addEventListener('click', () => {
    custom.hole = !custom.hole
    el('custom-hole').classList.toggle('on', custom.hole)
    syncOutlineUi()
    update()
  })

  el('custom-dl-btn').addEventListener('click', () => downloadSvgs(exportSvgs, 'personalizado'))

  onMachineChange(update)
  syncDesignUi()
  syncOutlineUi()
  update()
  loadFonts()
}
