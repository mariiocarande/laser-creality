import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { qrMatrix, qrPath } from '../../qr.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'
import { roundedRectPath, circlePath, cut } from './shapes.js'

const model = {
  content: 'https://instagram.com/',
  label: 'Seguinos',
  font: 'dmsans',
  qrSize: 40,
  level: 'M',
  shape: 'rect',
  margin: 5,
  radius: 5,
  hole: true,
  holeDiameter: 4,
  copies: 1,
}

const sections = [
  { title: 'Contenido', fields: [
    { type: 'textarea', key: 'content', label: 'Link o texto del QR (wifi, Instagram, menú, Mercado Pago…)', rows: 3 },
    { type: 'text', key: 'label', label: 'Texto debajo (opcional)', maxLength: 30 },
    { type: 'select', key: 'font', label: 'Letra del texto', options: fontFieldOptions(FONTS) },
  ] },
  { title: 'QR', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'qrSize', label: 'Tamaño del QR (mm)', min: 15, step: 1 },
      { type: 'number', key: 'copies', label: 'Copias', min: 1, max: 60, step: 1 },
    ] },
    { type: 'choice', key: 'level', label: 'Corrección de errores', options: [['L', 'Baja'], ['M', 'Media'], ['Q', 'Alta'], ['H', 'Máxima']] },
    { type: 'hint', text: 'Más corrección = el QR se sigue leyendo aunque se queme o raye un poco, pero tiene puntos más chicos. Con un diodo, que cada punto mida al menos 0,8 mm.' },
  ] },
  { title: 'Etiqueta', fields: [
    { type: 'choice', key: 'shape', options: [['rect', 'Rectangular'], ['circle', 'Redonda']] },
    { type: 'row', fields: [
      { type: 'number', key: 'margin', label: 'Margen (mm)', min: 2, step: 0.5 },
      { type: 'number', key: 'radius', label: 'Radio esquinas (mm)', min: 0, step: 0.5, showIf: m => m.shape === 'rect' },
    ] },
    { type: 'toggle', key: 'hole', label: 'Agujero para colgar' },
    { type: 'number', key: 'holeDiameter', label: 'Diámetro del agujero (mm)', min: 2, step: 0.5, showIf: m => m.hole },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const qrTagTool = {
  id: 'qr',
  icon: '▦',
  title: 'Etiqueta con QR',
  description: 'Un llavero o cartelito con un QR grabado: link, wifi, redes o menú, con texto y agujero para colgar.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'El QR sale como formas vectoriales reales, listo para grabar en relleno.',
      controls: controlsHtml(sections),
      note: 'Probá leer el QR con el celular en la vista previa antes de grabar. En madera clara se lee mejor: grabá con buen contraste y sin pasarte de potencia, que los puntos se "comen" entre sí.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 150) })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'etiqueta_qr'))
    update()
  },
}

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const content = model.content.trim()
  if (!content) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Escribí el link o texto del QR')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  let matrix
  try {
    matrix = qrMatrix(content, model.level)
  } catch {
    refs.preview.innerHTML = ''
    refs.setEmpty('El texto es demasiado largo para un QR')
    return
  }

  const label = model.label.trim()
  let labelBlock = null
  if (label) {
    try {
      const font = await loadFont(model.font)
      if (run !== token) return
      labelBlock = textBlock(font, label, 10, model.qrSize, model.qrSize * 0.16)
    } catch {
      refs.setWarn('No se pudo cargar la letra; el texto se omite.')
    }
  }

  // QR keeps a quiet zone of 2 modules inside the margin so phones read it.
  const cell = model.qrSize / matrix.size
  const quiet = 2 * cell
  const holeR = model.holeDiameter / 2
  const holeSpace = model.hole ? model.holeDiameter + 3 : 0
  const labelSpace = labelBlock ? labelBlock.h + cell * 2 : 0
  const contentW = model.qrSize + 2 * quiet
  const contentH = model.qrSize + 2 * quiet + labelSpace

  let w, h, qx, qy, outline
  if (model.shape === 'circle') {
    const r = Math.hypot(contentW, contentH) / 2 + model.margin + (model.hole ? holeSpace * 0.4 : 0)
    w = h = 2 * r
    qx = r - model.qrSize / 2
    qy = r - contentH / 2 + quiet + (model.hole ? holeSpace * 0.25 : 0)
    outline = circlePath(r, r, r)
  } else {
    w = contentW + 2 * model.margin
    h = contentH + 2 * model.margin + holeSpace
    qx = model.margin + quiet
    qy = model.margin + holeSpace + quiet
    outline = roundedRectPath(0, 0, w, h, model.radius)
  }

  let cutMarkup = cut(outline)
  if (model.hole) {
    const hy = model.shape === 'circle' ? Math.max(holeR + 3, qy - quiet - holeR - 2) : model.margin + holeR + 1
    cutMarkup += cut(circlePath(w / 2, hy, holeR))
  }
  let engrave = `<path fill="#000000" d="${qrPath(matrix, qx, qy, cell)}"/>`
  if (labelBlock) engrave += textMarkup(labelBlock, w / 2 - labelBlock.w / 2, qy + model.qrSize + quiet + cell)

  const copies = Math.max(1, Math.min(60, Math.round(model.copies)))
  const pieces = Array.from({ length: copies }, () => ({ w, h, cut: cutMarkup, engrave }))
  const { svgs, sheets, oversize } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `<strong>${w.toFixed(1)} × ${h.toFixed(1)} mm</strong> &nbsp;·&nbsp; QR ${matrix.size} × ${matrix.size} módulos de ${cell.toFixed(2)} mm` +
    ` &nbsp;·&nbsp; ${copies} copia${copies === 1 ? '' : 's'} en ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`,
  )
  const warnings = []
  if (cell < 0.8) warnings.push(`⚠ Cada punto mide ${cell.toFixed(2)} mm: con un diodo puede no leerse. Agrandá el QR, acortá el link o bajá la corrección.`)
  if (oversize.length) warnings.push('⚠ La etiqueta no entra en el área de la máquina.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
