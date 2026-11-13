import { dropZoneHtml, bindDropZone } from '../../imageInput.js'
import { puzzlePaths } from '../../puzzle.js'
import { buildSheetSvg, renderSheetPreviews, downloadSvgs } from '../../sheets.js'
import { state } from '../../state.js'
import { MACHINES, applyMachine } from '../../machines.js'
import { DB } from '../../db.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'

const IMAGE_PX = 2000
const MIN_PIECE_MM = 12

const model = {
  width: 200,
  height: 150,
  cols: 6,
  rows: 4,
  tab: 0.22,
  jitter: 0.04,
  radius: 3,
  seed: 1,
  preset: null,
  engraveImage: true,
}

const sections = [
  { title: 'Tamaño', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho (mm)', min: 20, step: 1 },
      { type: 'number', key: 'height', label: 'Alto (mm)', min: 20, step: 1 },
    ] },
    { type: 'hint', text: 'Con una imagen cargada, el alto sigue la proporción de la foto.' },
    { type: 'choice', key: 'preset', label: 'Cantidad de piezas', options: [['12', '12'], ['24', '24'], ['48', '48'], ['96', '96']] },
    { type: 'row', fields: [
      { type: 'number', key: 'cols', label: 'Columnas', min: 2, max: 30, step: 1 },
      { type: 'number', key: 'rows', label: 'Filas', min: 2, max: 30, step: 1 },
    ] },
  ] },
  { title: 'Forma de las piezas', fields: [
    { type: 'range', key: 'tab', label: 'Tamaño del encastre', min: 0.12, max: 0.32, step: 0.01, format: v => `${Math.round(v * 100)}%` },
    { type: 'range', key: 'jitter', label: 'Variación entre piezas', min: 0, max: 0.1, step: 0.01, format: v => `${Math.round(v * 100)}%` },
    { type: 'range', key: 'radius', label: 'Esquinas redondeadas', min: 0, max: 15, step: 0.5, format: v => `${v} mm` },
    { type: 'html', html: '<button class="mini-btn gen-shuffle" data-role="shuffle">🎲 Mezclar forma de las piezas</button>' },
    { type: 'toggle', key: 'engraveImage', label: 'Grabar la imagen en el puzzle', showIf: () => Boolean(source) },
  ] },
]

let source = null
let exportSvg = null
let refs = null
let syncControls = null
let timer = 0

export const puzzleTool = {
  id: 'puzzle',
  icon: '🧩',
  title: 'Rompecabezas',
  description: 'Foto opcional + piezas con encastre clásico. SVG con líneas de corte continuas.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Genera las líneas de corte de un rompecabezas y, si querés, graba tu foto encima.',
      sourceHtml: dropZoneHtml('Foto para el puzzle (opcional)', 'JPG, PNG o WEBP — se graba antes de cortar'),
      controls: controlsHtml(sections),
      note: 'Rojo = corte, la foto va como capa de grabado. Grabá primero y cortá después, sin mover el material. En madera de 3 mm las piezas de menos de 15 mm se rompen fácil.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG del rompecabezas' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    syncControls = bindControls(refs.controls, sections, model, onChange)
    root.querySelector('[data-role="shuffle"]').addEventListener('click', () => { model.seed += 1; update() })
    bindDropZone(root, {
      maxPx: IMAGE_PX,
      isActive: () => state.view === 'generators' && root.isConnected && !root.hidden,
      onLoad: image => {
        source = { ...image, dataUrl: image.canvas.toDataURL('image/jpeg', 0.9) }
        fitHeightToImage()
        syncControls()
        update()
      },
      onClear: () => { source = null; syncControls(); update() },
    })
    refs.download('svg').addEventListener('click', () =>
      exportSvg && downloadSvgs([exportSvg], `rompecabezas_${model.cols * model.rows}piezas`))
    update()
  },
}

function fitHeightToImage() {
  if (source) model.height = Math.round((model.width * source.h) / source.w)
}

// Picks columns × rows close to the target count with near-square pieces.
function gridFor(count) {
  let best = null
  for (let cols = 2; cols <= 30; cols++) {
    const rows = Math.max(2, Math.round(count / cols))
    const score = Math.abs(cols * rows - count) * 4 + Math.abs(Math.log((model.width / cols) / (model.height / rows)))
    if (!best || score < best.score) best = { cols, rows, score }
  }
  return best
}

function onChange(key) {
  if (key === 'preset') {
    const { cols, rows } = gridFor(Number(model.preset))
    model.cols = cols
    model.rows = rows
    syncControls()
  } else if (key === 'cols' || key === 'rows') {
    model.preset = null
    syncControls()
  } else if (key === 'width') {
    fitHeightToImage()
    syncControls()
  }
  clearTimeout(timer)
  timer = setTimeout(update, 60)
}

function update() {
  const cols = Math.round(model.cols)
  const rows = Math.round(model.rows)
  const W = model.width
  const H = model.height
  const result = puzzlePaths({ ...model, cols, rows })

  const engrave = source && model.engraveImage
    ? `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${source.dataUrl}" xlink:href="${source.dataUrl}"/>`
    : ''
  const placement = {
    x: 0, y: 0, w: W, h: H,
    engrave,
    cut: result.lines.map(d => `<path d="${d}"/>`).join('') + result.border,
  }
  exportSvg = buildSheetSvg([placement], W, H)
  renderSheetPreviews(refs.preview, [buildSheetSvg([placement], W, H, { preview: true, previewStroke: Math.max(0.3, W / 300) })])
  refs.setEmpty('')

  const machine = MACHINES[state.machine]
  const cut = applyMachine(DB.plywood.colors.light.cut3mm, state.machine, 'cut')
  const minutes = cut ? (result.cutLength / cut.speed) * cut.passes : 0
  refs.setInfo(
    `<strong>${W.toFixed(0)} × ${H.toFixed(0)} mm</strong> &nbsp;·&nbsp; ${cols * rows} piezas de ` +
    `${result.pieceSize.w.toFixed(1)} × ${result.pieceSize.h.toFixed(1)} mm &nbsp;·&nbsp; ` +
    `${(result.cutLength / 1000).toFixed(2)} m de corte` +
    (cut ? ` &nbsp;·&nbsp; ~${Math.ceil(minutes)} min en triplay 3 mm` : ''),
  )

  const warnings = []
  if (W > machine.area.w || H > machine.area.h) warnings.push(`⚠ No entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm).`)
  if (Math.min(result.pieceSize.w, result.pieceSize.h) < MIN_PIECE_MM) warnings.push('⚠ Piezas muy chicas: pueden quebrarse al cortar o al armar.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = false
}
