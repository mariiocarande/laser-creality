import { loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { downloadSvgs } from '../../sheets.js'
import { attachDxf } from '../../dxfButton.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces } from './output.js'
import { roundedRectPath, cut } from './shapes.js'

const SLOT_DEPTH = 12
const SLOT_PITCH = 9

export const KERF_EVENT = 'laser:set-kerf'

const model = { size: 30, thickness: 3, measured: 29.7 }

const sections = [
  { title: '1. Cortá la prueba', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'size', label: 'Cuadrado de prueba (mm)', min: 10, step: 1 },
      { type: 'number', key: 'thickness', label: 'Grosor del material (mm)', min: 1, step: 0.1 },
    ] },
    { type: 'hint', text: 'Sale un cuadrado y un peine con ranuras de distinto ancho. Cortalos con la misma potencia y velocidad que vas a usar en tus cajas.' },
  ] },
  { title: '2. Medí con calibre', fields: [
    { type: 'number', key: 'measured', label: 'Medida real del cuadrado (mm)', min: 1, step: 0.01 },
    { type: 'html', html: '<div class="kerf-result" data-role="kerf"></div><button class="mini-btn" data-role="apply">Usar este kerf en Cajas</button>' },
    { type: 'hint', text: 'Probá también qué ranura del peine encastra justo con un retazo del mismo material: esa es tu holgura ideal para los encastres.' },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0

function kerfValue() {
  return Math.max(0, (model.size - model.measured) / 2)
}

export const kerfTool = {
  id: 'kerf',
  icon: '📏',
  title: 'Prueba de kerf y encastre',
  description: 'Cortá un cuadrado y un peine de ranuras, medí y obtené el kerf exacto de tu láser. Lo pasa directo a Cajas.',
  categories: ['herramientas'],

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'El kerf es lo que el láser se come al cortar. Medirlo una vez por material hace que las cajas encastren justo.',
      controls: controlsHtml(sections),
      note: 'kerf = (medida diseñada − medida real) ÷ 2. Cambia con el material, el enfoque y la potencia: medilo cada vez que cambies alguno.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG de la prueba' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 120) })
    root.querySelector('[data-role="apply"]').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent(KERF_EVENT, { detail: { kerf: Number(kerfValue().toFixed(3)) } }))
      refs.setWarn(`Listo: el kerf de Cajas quedó en ${kerfValue().toFixed(2)} mm.`)
    })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'prueba_kerf'))
    attachDxf(refs.download('svg'), () => exportSvgs, 'prueba_kerf')
    update()
  },
}

async function update() {
  const k = kerfValue()
  refs.controls.querySelector('[data-role="kerf"]').innerHTML =
    `Tu kerf: <strong>${k.toFixed(2)} mm</strong>` + (k > 0.4 ? ' <span>(alto: revisá el enfoque)</span>' : '')

  let font = null
  try { font = await loadFont('dmsans') } catch { /* labels skipped */ }
  const S = model.size
  const t = model.thickness
  const deltas = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]
  const combW = deltas.length * SLOT_PITCH + 10
  const combH = SLOT_DEPTH + 14

  const label = (text, cx, cy, h) => {
    const b = font && textBlock(font, text, 200, 40, h)
    return b ? textMarkup(b, cx - b.w / 2, cy - b.h / 2) : ''
  }

  let combCut = `M0 0`
  deltas.forEach((d, i) => {
    const w = Math.max(0.5, t + d)
    const cx = 5 + SLOT_PITCH * (i + 0.5)
    combCut += `H${(cx - w / 2).toFixed(3)}V${SLOT_DEPTH}H${(cx + w / 2).toFixed(3)}V0`
  })
  combCut += `H${combW}V${combH}H0Z`
  const combLabels = deltas.map((d, i) => label((t + d).toFixed(1), 5 + SLOT_PITCH * (i + 0.5), SLOT_DEPTH + 7, 3)).join('')

  const pieces = [
    { w: S, h: S, label: 'Cuadrado', cut: cut(roundedRectPath(0, 0, S, S, 0)), engrave: label(`${S} mm`, S / 2, S / 2, Math.min(5, S / 6)) },
    { w: combW, h: combH, label: 'Peine', cut: cut(combCut), engrave: combLabels },
  ]
  const { svgs } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(`Cuadrado de <strong>${S} mm</strong> &nbsp;·&nbsp; peine con ranuras de ${(t - 0.3).toFixed(1)} a ${(t + 0.3).toFixed(1)} mm`)
  refs.download('svg').disabled = false
}
