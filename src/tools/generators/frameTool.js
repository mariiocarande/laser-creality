import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, SCORE_STROKE, fontFieldOptions } from './output.js'
import { roundedRectPath, circlePath, cut, scoreLine } from './shapes.js'

const STAND_TILT = 15   // degrees the frame leans back on its stand

const PHOTO_SIZES = {
  '10x15': [100, 150],
  '13x18': [130, 180],
  '9x13': [90, 130],
  'polaroid': [79, 79],
}

const model = {
  photo: '10x15',
  photoW: 100,
  photoH: 150,
  landscape: false,
  style: 'classic',
  border: 18,
  bottomExtra: 30,
  radius: 4,
  overlap: 3,
  text: 'Familia',
  subtext: 'Navidad 2026',
  font: 'pacifico',
  back: true,
  hanger: true,
  stand: true,
}

const sections = [
  { title: 'Foto', fields: [
    { type: 'choice', key: 'photo', label: 'Tamaño de la foto', options: [['10x15', '10×15'], ['13x18', '13×18'], ['9x13', '9×13'], ['custom', 'Otro']] },
    { type: 'row', fields: [
      { type: 'number', key: 'photoW', label: 'Ancho foto (mm)', min: 30, step: 1, showIf: m => m.photo === 'custom' },
      { type: 'number', key: 'photoH', label: 'Alto foto (mm)', min: 30, step: 1, showIf: m => m.photo === 'custom' },
    ] },
    { type: 'toggle', key: 'landscape', label: 'Foto horizontal' },
  ] },
  { title: 'Marco', fields: [
    { type: 'choice', key: 'style', options: [['classic', 'Clásico'], ['polaroid', 'Tipo Polaroid']] },
    { type: 'row', fields: [
      { type: 'number', key: 'border', label: 'Borde (mm)', min: 8, step: 1 },
      { type: 'number', key: 'radius', label: 'Radio esquinas (mm)', min: 0, step: 0.5 },
    ] },
    { type: 'number', key: 'bottomExtra', label: 'Borde inferior extra (mm)', min: 0, step: 1, showIf: m => m.style === 'polaroid' },
    { type: 'number', key: 'overlap', label: 'Cuánto tapa el marco la foto por lado (mm)', min: 1, step: 0.5 },
  ] },
  { title: 'Texto grabado', fields: [
    { type: 'text', key: 'text', label: 'Texto principal (va en el borde de abajo)', maxLength: 30 },
    { type: 'text', key: 'subtext', label: 'Segunda línea', maxLength: 40 },
    { type: 'select', key: 'font', label: 'Letra del texto principal', options: fontFieldOptions(FONTS) },
  ] },
  { title: 'Piezas', fields: [
    { type: 'toggle', key: 'back', label: 'Espaciador y tapa trasera (la foto entra por arriba)' },
    { type: 'toggle', key: 'hanger', label: 'Agujero para colgar en la tapa', showIf: m => m.back },
    { type: 'toggle', key: 'stand', label: 'Pie para apoyar en la mesa (se pega atrás)', showIf: m => m.back },
  ] },
]

let refs = null
let syncControls = null
let exportSvgs = []
let timer = 0
let token = 0

export const frameTool = {
  id: 'frame',
  icon: '🖼',
  title: 'Portarretratos',
  description: 'Marco para cualquier tamaño de foto, clásico o tipo Polaroid, con texto grabado, tapa trasera y pie.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Tres capas que se pegan: frente con ventana, espaciador abierto arriba para deslizar la foto, y tapa trasera.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado. Pegá el espaciador entre el frente y la tapa dejando libre el lado de arriba: por ahí entra la foto. El pie se pega parado sobre la línea marcada en la tapa trasera, con el lado recto contra la tapa y el ángulo hacia abajo.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG del portarretratos' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    syncControls = bindControls(refs.controls, sections, model, key => {
      if (key === 'photo' && PHOTO_SIZES[model.photo]) {
        ;[model.photoW, model.photoH] = PHOTO_SIZES[model.photo]
        syncControls()
      }
      clearTimeout(timer)
      timer = setTimeout(update, 150)
    })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'portarretratos'))
    update()
  },
}

const f3 = n => Number(n.toFixed(3)).toString()

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  let [pw, ph] = [model.photoW, model.photoH]
  if (model.landscape) [pw, ph] = [ph, pw]
  const b = model.border
  const extra = model.style === 'polaroid' ? model.bottomExtra : 0
  const W = pw + 2 * b - 2 * model.overlap
  const H = ph + 2 * b + extra - 2 * model.overlap
  const win = { x: b, y: b, w: pw - 2 * model.overlap, h: ph - 2 * model.overlap }
  const r = model.radius

  // Engraved text in the bottom border.
  let engrave = ''
  const bandTop = win.y + win.h
  const bandH = H - bandTop
  const text = model.text.trim()
  const sub = model.subtext.trim()
  if (text || sub) {
    try {
      const [font, subFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
      if (run !== token) return
      const main = text ? textBlock(font, text, 10, W * 0.8, bandH * (sub ? 0.42 : 0.6)) : null
      const second = sub ? textBlock(subFont, sub, 10, W * 0.7, Math.min(bandH * 0.2, 6)) : null
      const total = (main?.h || 0) + (second?.h || 0) + (main && second ? bandH * 0.08 : 0)
      let y = bandTop + (bandH - total) / 2
      if (main) { engrave += textMarkup(main, W / 2 - main.w / 2, y); y += main.h + bandH * 0.08 }
      if (second) engrave += textMarkup(second, W / 2 - second.w / 2, y)
    } catch {
      refs.setWarn('No se pudo cargar la letra; el texto se omite.')
    }
  }

  const pieces = [{
    w: W, h: H, label: 'Frente',
    cut: cut(roundedRectPath(0, 0, W, H, r) + roundedRectPath(win.x, win.y, win.w, win.h, Math.min(r / 2, 2))),
    engrave,
  }]

  if (model.back) {
    // Spacer: a U open at the top, a little wider than the photo so it slides in.
    const slack = 1
    const sx = (W - pw) / 2 - slack
    const sy = b - model.overlap - slack
    const sw = pw + 2 * slack
    const sh = ph + slack
    const spacer =
      `M${f3(0)} ${f3(0)}H${f3(sx)}V${f3(sy + sh)}H${f3(sx + sw)}V0H${f3(W)}V${f3(H)}H0Z`
    pieces.push({ w: W, h: H, label: 'Espaciador', cut: cut(spacer), engrave: '' })

    let backCut = roundedRectPath(0, 0, W, H, r)
    if (model.hanger) backCut += circlePath(W / 2, Math.max(8, b * 0.6), 2.5)
    let backEngrave = ''
    if (model.stand) {
      // Easel: a triangle glued upright on the back. Its bottom edge drops
      // STAND_TILT degrees so the frame leans back instead of standing straight.
      const hs = H * 0.5
      const bs = hs * 0.45
      const drop = bs * Math.tan((STAND_TILT * Math.PI) / 180)
      const d = `M0 0V${f3(hs)}L${f3(bs)} ${f3(hs + drop)}Z`
      pieces.push({ w: bs, h: hs + drop, label: 'Pie', cut: cut(d), engrave: '' })
      // Guide on the back showing where the pie's long edge gets glued.
      backEngrave = scoreLine(`M${f3(W / 2)} ${f3(H - hs)}V${f3(H)}`, SCORE_STROKE)
    }
    pieces.splice(2, 0, { w: W, h: H, label: 'Tapa trasera', cut: cut(backCut), engrave: backEngrave })
  }

  const { svgs, sheets, oversize } = showPieces(refs, pieces, { allowRotate: true })
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `Marco <strong>${W.toFixed(0)} × ${H.toFixed(0)} mm</strong> para foto de ${pw} × ${ph} mm` +
    ` &nbsp;·&nbsp; ventana ${win.w.toFixed(0)} × ${win.h.toFixed(0)} mm &nbsp;·&nbsp; ${pieces.length} pieza${pieces.length === 1 ? '' : 's'}` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`,
  )
  refs.setWarn(oversize.length ? '⚠ El marco no entra en el área de la máquina.' : '')
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
