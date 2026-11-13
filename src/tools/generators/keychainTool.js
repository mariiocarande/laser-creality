import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { LETTER_POINTS, normalizeWord } from '../../crossword.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, SCORE_STROKE, fontFieldOptions } from './output.js'
import { cut, scoreLine, names as splitNames } from './shapes.js'

const model = {
  names: 'Sofía\nMateo',
  font: 'bebas',
  tile: 14,
  radius: 2,
  points: true,
  layout: 'row',
  holeDiameter: 4.5,
}

const sections = [
  { title: 'Nombres', fields: [
    { type: 'textarea', key: 'names', label: 'Uno por línea — sale un llavero por nombre', rows: 4 },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
  ] },
  { title: 'Fichas', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'tile', label: 'Tamaño de ficha (mm)', min: 8, step: 0.5 },
      { type: 'number', key: 'radius', label: 'Radio (mm)', min: 0, step: 0.5 },
    ] },
    { type: 'toggle', key: 'points', label: 'Puntaje en la esquina' },
    { type: 'choice', key: 'layout', label: 'Disposición', options: [['row', 'Horizontal'], ['column', 'Vertical']] },
    { type: 'number', key: 'holeDiameter', label: 'Agujero para la argolla (mm)', min: 2, step: 0.5 },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const keychainTool = {
  id: 'keychain',
  icon: '🔑',
  title: 'Llavero de fichas',
  description: 'Un nombre en fichas tipo juego de palabras, en una sola pieza con oreja y agujero para la argolla.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Cada letra va en su ficha con su puntaje; las líneas entre fichas se graban finas.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado. Las líneas que separan las fichas son de grabado en línea (no relleno). En 3 mm queda firme; en materiales más finos usá fichas de 12 mm o más.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG de los llaveros' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 150) })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'llaveros'))
    update()
  },
}

const f3 = n => Number(n.toFixed(3)).toString()

// Strip of `count` tiles with a round ear before the first one.
// Built along +x, then rotated for the vertical layout.
function strip(count, T, r, holeR) {
  const ear = Math.max(T * 0.62, 2 * holeR + 4)
  const L = ear + count * T
  const er = T / 2                 // ear end is a full half circle
  const rr = Math.min(r, T / 2)
  const outline =
    `M${f3(er)} 0H${f3(L - rr)}A${f3(rr)} ${f3(rr)} 0 0 1 ${f3(L)} ${f3(rr)}V${f3(T - rr)}` +
    `A${f3(rr)} ${f3(rr)} 0 0 1 ${f3(L - rr)} ${f3(T)}H${f3(er)}A${f3(er)} ${f3(er)} 0 0 1 ${f3(er)} 0Z`
  return { L, ear, outline, hole: [Math.max(er, holeR + 2.5), T / 2] }
}

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const list = splitNames(model.names).map(n => ({ raw: n, letters: [...normalizeWord(n)] })).filter(n => n.letters.length)
  if (!list.length) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Escribí al menos un nombre')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  let font, pointsFont
  try {
    ;[font, pointsFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
  } catch {
    refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
    return
  }
  if (run !== token) return

  const T = model.tile
  const holeR = model.holeDiameter / 2
  const vertical = model.layout === 'column'
  const letterBox = { w: T * 0.6, h: T * (model.points ? 0.5 : 0.58) }
  const glyphCache = new Map()
  const glyph = l => {
    if (!glyphCache.has(l)) glyphCache.set(l, textBlock(font, l, 10, letterBox.w, letterBox.h))
    return glyphCache.get(l)
  }

  const pieces = list.map(({ letters }) => {
    const s = strip(letters.length, T, model.radius, holeR)
    // (u, v) along/across the strip → piece coordinates
    const map = (u, v) => (vertical ? [v, u] : [u, v])
    const [w, h] = map(s.L, T)

    let engrave = ''
    letters.forEach((letter, i) => {
      const u0 = s.ear + i * T
      const g = glyph(letter)
      const [cx, cy] = map(u0 + T / 2, T / 2)
      if (g) engrave += textMarkup(g, cx - g.w / 2, cy - g.h / 2 - (model.points ? T * 0.04 : 0))
      if (model.points) {
        const p = textBlock(pointsFont, String(LETTER_POINTS[letter] ?? 1), 10, T * 0.22, T * 0.16)
        const [px, py] = map(u0 + T, T)
        if (p) engrave += textMarkup(p, px - p.w - T * 0.1, py - p.h - T * 0.09)
      }
    })
    // Score lines: before the first tile and between tiles.
    let lines = ''
    for (let i = 0; i < letters.length; i++) {
      const u = s.ear + i * T
      const [x1, y1] = map(u, T * 0.08)
      const [x2, y2] = map(u, T * 0.92)
      lines += `M${f3(x1)} ${f3(y1)}L${f3(x2)} ${f3(y2)}`
    }
    engrave += scoreLine(lines, SCORE_STROKE)

    const outline = vertical
      ? `<path transform="matrix(0 1 1 0 0 0)" d="${s.outline}"/>`
      : cut(s.outline)
    const [hx, hy] = map(s.hole[0], s.hole[1])
    return { w, h, cut: outline + `<circle cx="${f3(hx)}" cy="${f3(hy)}" r="${f3(holeR)}"/>`, engrave }
  })

  const { svgs, sheets, oversize } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `${pieces.length} llavero${pieces.length === 1 ? '' : 's'} &nbsp;·&nbsp; el más largo mide <strong>${Math.max(...pieces.map(p => Math.max(p.w, p.h))).toFixed(0)} mm</strong>` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`,
  )
  const dropped = splitNames(model.names).length - list.length
  const warnings = []
  if (dropped) warnings.push('⚠ Algún nombre no tiene letras válidas y se omitió.')
  if (oversize.length) warnings.push('⚠ Algún llavero no entra en el área de la máquina.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
