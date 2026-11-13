import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { traceDrawing } from '../../weld.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'
import { names as splitNames } from './shapes.js'

const model = {
  names: 'Sofía\nMateo\nValentina\nTomás',
  font: 'pacifico',
  shape: 'tag',
  width: 55,
  height: 22,
  slotWidth: 2.6,
  slotDepth: 12,
}

const sections = [
  { title: 'Invitados', fields: [
    { type: 'textarea', key: 'names', label: 'Un nombre por línea — sale un marcador por invitado', rows: 6 },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
  ] },
  { title: 'Marcador', fields: [
    { type: 'choice', key: 'shape', options: [['tag', 'Etiqueta'], ['round', 'Redondo'], ['heart', 'Corazón']] },
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho (mm)', min: 25, step: 1 },
      { type: 'number', key: 'height', label: 'Alto (mm)', min: 12, step: 1, showIf: m => m.shape === 'tag' },
    ] },
  ] },
  { title: 'Ranura para el borde de la copa', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'slotWidth', label: 'Ancho (mm)', min: 1, step: 0.1 },
      { type: 'number', key: 'slotDepth', label: 'Profundidad (mm)', min: 4, step: 0.5 },
    ] },
    { type: 'hint', text: 'El marcador se encaja en el borde de la copa. Medí el grosor del vidrio y sumale unos 0,4 mm: si queda flojo, achicá el ancho.' },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const drinkMarkerTool = {
  id: 'drink',
  icon: '🥂',
  title: 'Marcadores de copa',
  description: 'Etiquetas con el nombre de cada invitado que se encajan en el borde de la copa. Para casamientos y fiestas.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Una pieza por invitado, con una ranura que se calza en el borde del vidrio.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado. Cortá uno de prueba para ajustar el ancho de la ranura a tus copas antes de hacer todos.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG de los marcadores' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 200) })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'marcadores_copa'))
    update()
  },
}

function heart(ctx, w, h) {
  const x = w / 2
  ctx.beginPath()
  ctx.moveTo(x, h * 0.95)
  ctx.bezierCurveTo(w * 0.1, h * 0.62, -w * 0.02, h * 0.3, w * 0.22, h * 0.1)
  ctx.bezierCurveTo(w * 0.36, -0.01 * h, x, h * 0.1, x, h * 0.26)
  ctx.bezierCurveTo(x, h * 0.1, w * 0.64, -0.01 * h, w * 0.78, h * 0.1)
  ctx.bezierCurveTo(w * 1.02, h * 0.3, w * 0.9, h * 0.62, x, h * 0.95)
  ctx.closePath()
  ctx.fill()
}

function shapeFor() {
  const W = model.width
  if (model.shape === 'round') {
    return { w: W, h: W, text: { w: W * 0.72, h: W * 0.26, cy: W * 0.42 }, slotX: W / 2, draw: ctx => { ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); ctx.fill() } }
  }
  if (model.shape === 'heart') {
    const H = W * 0.9
    return { w: W, h: H, text: { w: W * 0.62, h: H * 0.22, cy: H * 0.4 }, slotX: W / 2, draw: ctx => heart(ctx, W, H) }
  }
  const H = model.height
  const r = Math.min(H / 2, 6)
  return {
    w: W, h: H,
    // Text sits in the part of the tag away from the slot.
    text: { w: W * 0.62, h: H * 0.55, cy: H / 2, cx: W * 0.6 },
    slotX: Math.max(model.slotWidth + 3, W * 0.14),
    draw: ctx => {
      ctx.beginPath()
      ctx.roundRect(0, 0, W, H, r)
      ctx.fill()
    },
  }
}

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const list = splitNames(model.names)
  if (!list.length) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Escribí al menos un nombre')
    refs.setInfo('')
    refs.setWarn('')
    return
  }
  let font
  try { font = await loadFont(model.font) } catch {
    refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
    return
  }
  if (run !== token) return

  const s = shapeFor()
  // The slot runs up from the bottom edge; for tags it sits at one end.
  const slotTop = Math.max(2, s.h - model.slotDepth)
  const outline = traceDrawing({
    width: s.w, height: s.h, pxPerMm: 24,
    draw: ctx => {
      s.draw(ctx)
      ctx.globalCompositeOperation = 'destination-out'
      const half = model.slotWidth / 2
      ctx.beginPath()
      ctx.moveTo(s.slotX - half, s.h + 1)
      ctx.lineTo(s.slotX - half, slotTop + half)
      ctx.arc(s.slotX, slotTop + half, half, Math.PI, 0)
      ctx.lineTo(s.slotX + half, s.h + 1)
      ctx.closePath()
      ctx.fill()
    },
  }).outline

  // For round and heart shapes the text sits above the slot.
  const textCx = s.text.cx ?? s.w / 2
  const textCy = model.shape === 'tag' ? s.text.cy : Math.min(s.text.cy, slotTop - s.text.h / 2 - 1.5)
  const pieces = list.map(name => {
    const t = textBlock(font, name, 10, s.text.w, s.text.h)
    return {
      w: s.w, h: s.h,
      cut: `<path d="${outline}"/>`,
      engrave: t ? textMarkup(t, textCx - t.w / 2, textCy - t.h / 2) : '',
    }
  })

  const { svgs, sheets, oversize } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(`${pieces.length} marcador${pieces.length === 1 ? '' : 'es'} de <strong>${s.w.toFixed(0)} × ${s.h.toFixed(0)} mm</strong> &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`)
  const warnings = []
  if (model.slotDepth > s.h * 0.7) warnings.push('⚠ La ranura es casi tan alta como la pieza: puede quebrarse.')
  if (oversize.length) warnings.push('⚠ El marcador no entra en el área de la máquina.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
