import { dropZoneHtml, bindDropZone, canvasToGray } from '../../imageInput.js'
import { makeSampler, halftonePath, estimateCells, MAX_HALFTONE_CELLS } from '../../halftone.js'
import { buildSheetSvg, renderSheetPreviews, downloadSvgs } from '../../sheets.js'
import { state } from '../../state.js'
import { MACHINES } from '../../machines.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'

const TRACE_PX = 900
const HEAVY_SHAPES = 60000

const model = {
  pattern: 'dots',
  width: 120,
  cell: 1.6,
  angle: 45,
  scale: 1.1,
  minSize: 0.15,
  brightness: 0,
  contrast: 0.2,
  gamma: 1,
  invert: false,
  border: false,
}

const sections = [
  { title: 'Patrón', fields: [
    { type: 'choice', key: 'pattern', options: [['dots', 'Puntos'], ['squares', 'Cuadrados'], ['lines', 'Líneas']] },
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho final (mm)', min: 10, step: 1 },
      { type: 'number', key: 'cell', label: 'Trama (mm)', min: 0.4, step: 0.1 },
    ] },
    { type: 'range', key: 'angle', label: 'Ángulo', min: 0, max: 90, step: 1, format: v => `${v}°` },
    { type: 'range', key: 'scale', label: 'Tamaño máximo del punto', min: 0.5, max: 1.5, step: 0.05, format: v => `${Math.round(v * 100)}%` },
    { type: 'range', key: 'minSize', label: 'Descartar puntos menores a', min: 0, max: 1, step: 0.05, format: v => `${v.toFixed(2)} mm` },
    { type: 'hint', text: 'Trama más chica = más detalle y más tiempo de grabado. Con un diodo, menos de 0,5 mm casi no se distingue.' },
  ] },
  { title: 'Tono', fields: [
    { type: 'range', key: 'brightness', label: 'Brillo', min: -0.5, max: 0.5, step: 0.01, format: v => v.toFixed(2) },
    { type: 'range', key: 'contrast', label: 'Contraste', min: -0.5, max: 1.5, step: 0.05, format: v => v.toFixed(2) },
    { type: 'range', key: 'gamma', label: 'Gamma (medios tonos)', min: 0.4, max: 2.5, step: 0.05, format: v => v.toFixed(2) },
    { type: 'toggle', key: 'invert', label: 'Invertir (para materiales oscuros o pizarra)' },
    { type: 'toggle', key: 'border', label: 'Contorno de corte alrededor' },
  ] },
]

let source = null
let exportSvg = null
let refs = null
let timer = 0

export const halftoneTool = {
  id: 'halftone',
  icon: '◉',
  title: 'Halftone',
  description: 'Foto → puntos, cuadrados o líneas reales en SVG. Cada punto es una forma, listo para grabar.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Convierte una foto en una trama de formas vectoriales: negro = grabado.',
      sourceHtml: dropZoneHtml(),
      controls: controlsHtml(sections),
      note: 'Cada punto es una forma vectorial en milímetros reales; grabalo como relleno (Fill). Las fotos con buen contraste dan mejor resultado.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, schedule)
    bindDropZone(root, {
      maxPx: TRACE_PX,
      isActive: () => state.view === 'generators' && root.isConnected && !root.hidden,
      onLoad: image => { source = { ...image, gray: canvasToGray(image.canvas) }; update() },
      onClear: () => { source = null; update() },
    })
    refs.download('svg').addEventListener('click', () => exportSvg && downloadSvgs([exportSvg], `halftone_${model.pattern}`))
    update()
  },
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(update, 80)
}

function update() {
  exportSvg = null
  refs.download('svg').disabled = true
  if (!source) {
    renderSheetPreviews(refs.preview, [])
    refs.setEmpty('Subí una foto para empezar')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  const W = model.width
  const H = (W * source.h) / source.w
  const cells = estimateCells(W, H, model.cell)
  if (cells > MAX_HALFTONE_CELLS) {
    renderSheetPreviews(refs.preview, [])
    refs.setEmpty('')
    refs.setInfo('')
    refs.setWarn(`⚠ Con esa trama salen unas ${cells.toLocaleString('es')} celdas. Agrandá la trama o achicá el ancho.`)
    return
  }

  const sample = makeSampler(source.gray, source.w, source.h, W, H, model)
  const { d, count } = halftonePath(sample, { ...model, height: H })
  const placement = {
    x: 0, y: 0, w: W, h: H,
    engrave: d ? `<path fill="#000000" d="${d}"/>` : '',
    cut: model.border ? `<rect x="0" y="0" width="${W.toFixed(3)}" height="${H.toFixed(3)}"/>` : '',
  }
  exportSvg = buildSheetSvg([placement], W, H)
  renderSheetPreviews(refs.preview, [buildSheetSvg([placement], W, H, { preview: true, previewStroke: Math.max(0.15, W / 400) })])
  refs.setEmpty('')
  refs.setInfo(`<strong>${W.toFixed(1)} × ${H.toFixed(1)} mm</strong> &nbsp;·&nbsp; ${count.toLocaleString('es')} formas`)

  const machine = MACHINES[state.machine]
  const warnings = []
  if (W > machine.area.w || H > machine.area.h) warnings.push(`⚠ No entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm).`)
  if (count > HEAVY_SHAPES) warnings.push('⚠ Archivo pesado: tu programa de grabado puede tardar en abrirlo. Probá una trama más grande.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !count
}
