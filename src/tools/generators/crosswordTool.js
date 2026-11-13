import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { buildCrossword, LETTER_POINTS } from '../../crossword.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, SCORE_STROKE, fontFieldOptions } from './output.js'

const MAX_NAMES = 15

const model = {
  names: 'Mario\nLucía\nTomás\nAna\nPedro\nValentina',
  font: 'bebas',
  tile: 22,
  gap: 2,
  radius: 2,
  points: true,
  mode: 'board',
  padding: 10,
  boardRadius: 4,
  seed: 1,
}

const sections = [
  { title: 'Nombres', fields: [
    { type: 'textarea', key: 'names', label: `Uno por línea (hasta ${MAX_NAMES}); tienen que compartir letras para cruzarse`, rows: 6 },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
    { type: 'html', html: '<button class="mini-btn gen-shuffle" data-role="shuffle">🎲 Probar otra disposición</button>' },
  ] },
  { title: 'Fichas', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'tile', label: 'Tamaño (mm)', min: 8, step: 1 },
      { type: 'number', key: 'gap', label: 'Separación (mm)', min: 0, step: 0.5 },
      { type: 'number', key: 'radius', label: 'Radio (mm)', min: 0, step: 0.5 },
    ] },
    { type: 'toggle', key: 'points', label: 'Puntaje en la esquina' },
  ] },
  { title: 'Armado', fields: [
    { type: 'choice', key: 'mode', options: [['board', 'Una pieza'], ['tiles', 'Fichas sueltas + base']] },
    { type: 'hint', text: 'Una pieza: base cortada con las fichas y letras grabadas. Fichas sueltas: cada ficha se corta y se pega sobre la base, que trae marcadas las posiciones.' },
    { type: 'row', fields: [
      { type: 'number', key: 'padding', label: 'Margen de la base (mm)', min: 0, step: 1 },
      { type: 'number', key: 'boardRadius', label: 'Radio de la base (mm)', min: 0, step: 0.5 },
    ] },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const crosswordTool = {
  id: 'crossword',
  icon: '🔤',
  title: 'Crucigrama familiar',
  description: 'Los nombres de la familia cruzados como en el juego de palabras, en fichas con puntaje. Para un cartel de pared.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Acomoda los nombres solos para que se crucen en letras compartidas.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado; las líneas finas negras marcan dónde va cada ficha. Las tildes se ignoran al cruzar (José cruza con una E), la Ñ cuenta como letra propia.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG del crucigrama' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 150) })
    root.querySelector('[data-role="shuffle"]').addEventListener('click', () => { model.seed += 1; update() })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'crucigrama_familiar'))
    update()
  },
}

const fmt = n => Number(n.toFixed(3)).toString()

function rect(x, y, w, h, r, attrs = '') {
  const rr = Math.min(r, w / 2, h / 2)
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(rr)}" ry="${fmt(rr)}"${attrs}/>`
}

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const names = model.names.split('\n').map(s => s.trim()).filter(Boolean).slice(0, MAX_NAMES)
  const crossword = names.length >= 2 ? buildCrossword(names, { seed: model.seed }) : null
  if (!crossword || crossword.placed.length < 2) {
    refs.preview.innerHTML = ''
    refs.setEmpty(names.length < 2 ? 'Escribí al menos dos nombres' : 'Esos nombres no comparten letras para cruzarse')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  refs.setEmpty('Cargando letra…')
  let font, pointsFont
  try {
    ;[font, pointsFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
  } catch {
    refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
    return
  }
  if (run !== token) return

  const T = model.tile
  const step = T + model.gap
  const pad = model.padding
  const gridW = crossword.cols * step - model.gap
  const gridH = crossword.rows * step - model.gap
  const letterBox = { w: T * 0.62, h: T * (model.points ? 0.5 : 0.58) }

  const glyphs = new Map()
  const letterFor = letter => {
    if (!glyphs.has(letter)) glyphs.set(letter, textBlock(font, letter, 10, letterBox.w, letterBox.h))
    return glyphs.get(letter)
  }
  const pointsFor = letter => textBlock(pointsFont, String(LETTER_POINTS[letter] ?? 1), 10, T * 0.22, T * 0.16)

  // Content of one tile (letter + points) with its top-left corner at (x, y).
  const tileEngrave = (cell, x, y) => {
    const t = letterFor(cell.letter)
    let out = t ? textMarkup(t, x + (T - t.w) / 2, y + (T - t.h) / 2 - (model.points ? T * 0.04 : 0)) : ''
    if (model.points) {
      const p = pointsFor(cell.letter)
      if (p) out += textMarkup(p, x + T - p.w - T * 0.1, y + T - p.h - T * 0.09)
    }
    return out
  }
  const scoreAttrs = ` fill="none" stroke="#000000" stroke-width="${SCORE_STROKE}"`

  const pieces = []
  const boardW = gridW + 2 * pad
  const boardH = gridH + 2 * pad

  if (model.mode === 'board') {
    let engrave = ''
    crossword.cells.forEach(cell => {
      const x = pad + cell.x * step, y = pad + cell.y * step
      engrave += rect(x, y, T, T, model.radius, scoreAttrs) + tileEngrave(cell, x, y)
    })
    pieces.push({ w: boardW, h: boardH, cut: rect(0, 0, boardW, boardH, model.boardRadius), engrave })
  } else {
    let cut = '', engrave = ''
    crossword.cells.forEach(cell => {
      const x = cell.x * step, y = cell.y * step
      cut += rect(x, y, T, T, model.radius)
      engrave += tileEngrave(cell, x, y)
    })
    pieces.push({ w: gridW, h: gridH, cut, engrave })
    const guides = crossword.cells.map(cell => rect(pad + cell.x * step, pad + cell.y * step, T, T, model.radius, scoreAttrs)).join('')
    pieces.push({ w: boardW, h: boardH, cut: rect(0, 0, boardW, boardH, model.boardRadius), engrave: guides })
  }

  const { svgs, sheets, oversize, machine } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `Base <strong>${boardW.toFixed(0)} × ${boardH.toFixed(0)} mm</strong> &nbsp;·&nbsp; ${crossword.cells.length} fichas` +
    ` &nbsp;·&nbsp; ${crossword.cols} × ${crossword.rows} casillas` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`,
  )
  const warnings = []
  if (crossword.skipped.length) warnings.push(`⚠ No se pudieron cruzar: ${crossword.skipped.join(', ')}. Probá otra disposición o cambiá algún nombre.`)
  if (oversize.length) warnings.push(`⚠ No entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm). Achicá las fichas.`)
  if (names.length < model.names.split('\n').filter(s => s.trim()).length) warnings.push(`⚠ Solo se usan los primeros ${MAX_NAMES} nombres.`)
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
