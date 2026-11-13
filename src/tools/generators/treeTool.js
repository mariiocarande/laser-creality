import { FONTS, loadFont, textBlock, textMarkup, blockMatrix } from '../../textPaths.js'
import { traceDrawing } from '../../weld.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'

const model = {
  names: 'Abuela\nAbuelo\nMamá\nPapá\nSofía\nMateo',
  year: '2026',
  font: 'pacifico',
  width: 150,
  mode: 'engrave',
  star: true,
  trunk: true,
  hole: 4,
  thicken: 0.15,
  bridge: 1.2,
}

const sections = [
  { title: 'Familia', fields: [
    { type: 'textarea', key: 'names', label: 'Un nombre por línea (se ordenan solos: el más corto arriba)', rows: 6 },
    { type: 'text', key: 'year', label: 'Año o texto del tronco', placeholder: '2026', maxLength: 12, showIf: m => m.trunk },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
  ] },
  { title: 'Árbol', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho total (mm)', min: 50, step: 1 },
      { type: 'number', key: 'hole', label: 'Agujero (mm)', min: 2, step: 0.5, showIf: m => m.star },
    ] },
    { type: 'toggle', key: 'star', label: 'Estrella arriba (para colgar)' },
    { type: 'toggle', key: 'trunk', label: 'Tronco' },
  ] },
  { title: 'Los nombres van', fields: [
    { type: 'choice', key: 'mode', options: [['engrave', 'Grabados'], ['cut', 'Calados']] },
    { type: 'range', key: 'thicken', label: 'Engrosar letras', min: 0, max: 1.2, step: 0.05, format: v => `${v.toFixed(2)} mm`, showIf: m => m.mode === 'cut' },
    { type: 'range', key: 'bridge', label: 'Ancho de los puentes', min: 0.6, max: 3, step: 0.1, format: v => `${v.toFixed(1)} mm`, showIf: m => m.mode === 'cut' },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const treeTool = {
  id: 'tree',
  icon: '🌲',
  title: 'Árbol familiar',
  description: 'Un arbolito hecho con los nombres de la familia: el más corto arriba, el año en el tronco y una estrella para colgar.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Cada nombre arma un piso del árbol. Sale en una sola pieza lista para cortar.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado. Con muchos nombres conviene un ancho mayor para que las letras no queden muy chicas.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG del árbol' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 200) })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'arbol_familiar'))
    update()
  },
}

const ROW = 15        // base units, scaled to the requested width at the end
const PAD = 4
const TEXT_SIZE = 10

const scaled = (t, k) => ({ ...t, scale: t.scale * k, w: t.w * k, h: t.h * k })

function starPoints(cx, cy, R) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? R * 0.48 : R
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
}

// Builds the tree in base units: tiers, star, trunk and where each text goes.
function layout(font, names, yearBlock) {
  const blocks = names
    .map(name => textBlock(font, name, TEXT_SIZE, 0, ROW * 0.5))
    .filter(Boolean)
    .sort((a, b) => a.w - b.w)

  const tiers = []
  let y = 0
  blocks.forEach((t, i) => {
    const first = i === 0
    const height = first ? ROW * 1.3 : ROW
    const textFrom = first ? 0.5 : 0.35        // fraction of the tier where the text starts
    const topRatio = first ? 0.12 : 0.62
    const need = t.w + 2 * PAD
    let bottom = need / (topRatio + (1 - topRatio) * textFrom)
    if (tiers.length) bottom = Math.max(bottom, tiers[tiers.length - 1].bottom + 6)
    const top = first ? bottom * topRatio : Math.min(bottom * topRatio, tiers[tiers.length - 1].bottom * 0.82)
    tiers.push({ y, height, top, bottom, text: t, textY: y + height * textFrom + (height * (1 - textFrom) - t.h) / 2 - height * 0.04 })
    y += height
  })

  const base = tiers[tiers.length - 1].bottom
  const trunkW = model.trunk ? Math.max((yearBlock?.w || 0) + 2 * PAD, base * 0.16) : 0
  const trunkH = model.trunk ? ROW * 0.95 : 0
  const starR = model.star ? ROW * 0.85 : 0
  const starCy = -starR * 0.45

  return { tiers, base, treeH: y, trunkW, trunkH, starR, starCy, top: model.star ? starCy - starR : 0 }
}

function treePolygon(tiers) {
  const right = []
  tiers.forEach(t => { right.push([t.top / 2, t.y], [t.bottom / 2, t.y + t.height]) })
  const left = right.map(([x, y]) => [-x, y]).reverse()
  return [...right, ...left]
}

function drawText(ctx, t, x, y, thicken) {
  ctx.save()
  ctx.setTransform(ctx.getTransform().multiply(blockMatrix(t, x, y)))
  const path = new Path2D(t.d)
  ctx.fill(path)
  if (thicken > 0) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = (2 * thicken) / t.scale
    ctx.stroke(path)
  }
  ctx.restore()
}

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const names = model.names.split('\n').map(s => s.trim()).filter(Boolean)
  if (names.length < 2) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Escribí al menos dos nombres')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  refs.setEmpty('Cargando letra…')
  let font, yearFont
  try {
    ;[font, yearFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
  } catch {
    refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
    return
  }
  if (run !== token) return

  const year = model.year.trim()
  const yearBlock = model.trunk && year ? textBlock(yearFont, year, TEXT_SIZE * 0.8, 0, ROW * 0.45) : null
  const L = layout(font, names, yearBlock)
  if (!L.tiers.length) return

  // Scale base units so the widest tier matches the requested width.
  const k = model.width / L.base
  const margin = 1
  const W = L.base * k + 2 * margin
  const H = (L.treeH + L.trunkH - L.top) * k + 2 * margin
  const X = v => (v + L.base / 2) * k + margin          // base x (centred) → mm
  const Y = v => (v - L.top) * k + margin               // base y → mm

  const polygon = treePolygon(L.tiers).map(([x, y]) => [X(x), Y(y)])
  const star = model.star ? starPoints(X(0), Y(L.starCy), L.starR * k) : null
  const holeR = model.hole / 2

  const texts = L.tiers.map(t => {
    const block = scaled(t.text, k)
    return { block, x: X(0) - block.w / 2, y: Y(t.textY) }
  })
  let yearText = null
  if (yearBlock) {
    const block = scaled(yearBlock, k)
    yearText = { block, x: X(0) - block.w / 2, y: Y(L.treeH + (L.trunkH - yearBlock.h) / 2) - 0.5 }
  }

  const traced = traceDrawing({
    width: W, height: H, pxPerMm: 18, bridge: model.mode === 'cut' ? model.bridge : 0,
    draw: ctx => {
      ctx.beginPath()
      polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
      if (star) {
        ctx.beginPath()
        star.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.lineJoin = 'round'
        ctx.lineWidth = L.starR * k * 0.12
        ctx.fill(); ctx.stroke()
      }
      if (model.trunk) {
        ctx.fillRect(X(-L.trunkW / 2), Y(L.treeH) - 1, L.trunkW * k, L.trunkH * k + 1)
      }
    },
    drawCutouts: model.mode === 'cut'
      ? ctx => {
        texts.forEach(t => drawText(ctx, t.block, t.x, t.y, model.thicken))
        if (yearText) drawText(ctx, yearText.block, yearText.x, yearText.y, model.thicken)
      }
      : null,
  })
  const holeMarkup = star
    ? `<circle cx="${X(0).toFixed(3)}" cy="${Y(L.starCy).toFixed(3)}" r="${holeR.toFixed(3)}"/>`
    : ''


  const engrave = model.mode === 'engrave'
    ? texts.map(t => textMarkup(t.block, t.x, t.y)).join('') + (yearText ? textMarkup(yearText.block, yearText.x, yearText.y) : '')
    : ''
  const { svgs, oversize, machine } = showPieces(refs, [{ w: W, h: H, cut: `<path d="${traced.d}"/>` + holeMarkup, engrave }])
  exportSvgs = svgs
  refs.setEmpty('')

  const smallest = Math.min(...texts.map(t => t.block.h))
  refs.setInfo(
    `<strong>${W.toFixed(0)} × ${H.toFixed(0)} mm</strong> &nbsp;·&nbsp; ${texts.length} nombres` +
    ` &nbsp;·&nbsp; letra más chica ${smallest.toFixed(1)} mm de alto` +
    (model.mode === 'cut' ? ` &nbsp;·&nbsp; ${traced.bridges} puentes` : ''),
  )
  const warnings = []
  if (oversize.length) warnings.push(`⚠ No entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm). Bajá el ancho.`)
  if (smallest < 4) warnings.push('⚠ Letras muy chicas: subí el ancho total.')
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
