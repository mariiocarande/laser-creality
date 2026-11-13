import { FONTS, loadFont, textBlock, textMarkup, blockMatrix } from '../../textPaths.js'
import { traceDrawing } from '../../weld.js'
import { downloadSvgs } from '../../sheets.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, SCORE_STROKE, fontFieldOptions } from './output.js'

// Below this height, cut-out letters get too thin for a diode laser.
const MIN_CUT_TEXT_MM = 8

const model = {
  names: 'Sofía\nMateo\nAbuela Rosa',
  subtitle: 'Navidad 2026',
  shape: 'bauble',
  diameter: 80,
  font: 'pacifico',
  mode: 'engrave',
  textSize: 1,
  thicken: 0.15,
  bridge: 1.2,
  hole: 4,
  deco: 'snow',
}

const sections = [
  { title: 'Nombres', fields: [
    { type: 'textarea', key: 'names', label: 'Uno por línea — sale una esfera por nombre', rows: 4, placeholder: 'Sofía\nMateo' },
    { type: 'text', key: 'subtitle', label: 'Segunda línea (opcional)', placeholder: 'Navidad 2026', maxLength: 30 },
    { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
    { type: 'range', key: 'textSize', label: 'Tamaño del nombre', min: 0.6, max: 1.3, step: 0.05, format: v => `${Math.round(v * 100)}%` },
  ] },
  { title: 'Forma', fields: [
    { type: 'choice', key: 'shape', options: [['bauble', 'Esfera'], ['disc', 'Disco'], ['star', 'Estrella']] },
    { type: 'row', fields: [
      { type: 'number', key: 'diameter', label: 'Diámetro (mm)', min: 40, step: 1 },
      { type: 'number', key: 'hole', label: 'Agujero (mm)', min: 2, step: 0.5 },
    ] },
    { type: 'choice', key: 'deco', label: 'Decoración grabada', options: [['none', 'Ninguna'], ['ring', 'Aro'], ['snow', 'Copos']] },
  ] },
  { title: 'El nombre va', fields: [
    { type: 'choice', key: 'mode', options: [['engrave', 'Grabado'], ['cut', 'Calado']] },
    { type: 'range', key: 'thicken', label: 'Engrosar letras', min: 0, max: 1.2, step: 0.05, format: v => `${v.toFixed(2)} mm`, showIf: m => m.mode === 'cut' },
    { type: 'range', key: 'bridge', label: 'Ancho de los puentes', min: 0.6, max: 3, step: 0.1, format: v => `${v.toFixed(1)} mm`, showIf: m => m.mode === 'cut' },
    { type: 'hint', text: 'Calado: las letras se cortan y la O, A, B, D… llevan puentes automáticos para que el centro no se caiga. El puente tiene que ser más ancho que el kerf de tu láser. Las letras rectas (Bebas, DM Sans) se calan más limpio que las cursivas.' },
  ] },
]

let refs = null
let exportSvgs = []
let timer = 0
let token = 0

export const ornamentTool = {
  id: 'ornament',
  icon: '🎄',
  title: 'Esferas con nombre',
  description: 'Esferas, discos o estrellas para el árbol con el nombre grabado o calado. Una por cada nombre.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Escribí los nombres y descargá todas las esferas acomodadas en planchas de tu máquina.',
      controls: controlsHtml(sections),
      note: 'Rojo = corte, negro = grabado (relleno y líneas finas). Grabá primero y cortá al final. En calado, revisá que las letras no queden más finas que tu kerf: si pasa, engrosalas.',
      downloads: [{ id: 'svg', label: '⬇ Descargar SVG de las esferas' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 200) })
    refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, 'esferas_navidad'))
    update()
  },
}

// ── GEOMETRY (mm) ───────────────────────────────────────────────

function starPoints(cx, cy, R, r) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 ? r : R
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
  })
}

function frame() {
  const D = model.diameter
  const R = D / 2
  const holeR = model.hole / 2
  if (model.shape === 'bauble') {
    const capH = Math.max(0.11 * D, model.hole + 5)
    const capW = Math.max(0.26 * D, model.hole + 8)
    const cy = capH + R - 0.04 * D
    // Exact outline: cap with rounded top corners, then the circle.
    const half = capW / 2
    const joinY = cy - Math.sqrt(R * R - half * half)
    const r = Math.min(3, capW / 4)
    const outline =
      `M${f3(R - half)} ${f3(joinY)}L${f3(R - half)} ${f3(r)}Q${f3(R - half)} 0 ${f3(R - half + r)} 0` +
      `L${f3(R + half - r)} 0Q${f3(R + half)} 0 ${f3(R + half)} ${f3(r)}L${f3(R + half)} ${f3(joinY)}` +
      `A${f3(R)} ${f3(R)} 0 1 1 ${f3(R - half)} ${f3(joinY)}Z`
    return {
      w: D, h: cy + R, cx: R, cy, R, outline,
      hole: [R, capH * 0.48, holeR],
      drawShape(ctx) {
        ctx.beginPath(); ctx.arc(R, cy, R, 0, Math.PI * 2); ctx.fill()
        roundRect(ctx, R - capW / 2, 0, capW, capH + 0.08 * D, Math.min(3, capW / 4)); ctx.fill()
      },
      text: { w: 0.8 * D, h: 0.3 * D, cy: cy - 0.03 * D },
      sub: { w: 0.55 * D, h: 0.075 * D, cy: cy + 0.25 * D },
    }
  }
  if (model.shape === 'star') {
    const cy = R + 0.03 * D
    const points = starPoints(R, cy, R * 0.95, R * 0.5)
    return {
      w: D, h: cy + R * 0.82, cx: R, cy, R,
      hole: [R, cy - R * 0.62, holeR],
      drawShape(ctx) {
        ctx.beginPath()
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.lineJoin = 'round'
        ctx.lineWidth = 0.06 * D
        ctx.fill(); ctx.stroke()
      },
      points,
      text: { w: 0.6 * D, h: 0.17 * D, cy: cy - 0.02 * D },
      sub: { w: 0.32 * D, h: 0.05 * D, cy: cy + 0.17 * D },
    }
  }
  const cy = R
  return {
    w: D, h: D, cx: R, cy, R,
    outline: `M0 ${f3(R)}A${f3(R)} ${f3(R)} 0 1 0 ${f3(D)} ${f3(R)}A${f3(R)} ${f3(R)} 0 1 0 0 ${f3(R)}Z`,
    hole: [R, Math.max(holeR + 2.5, 0.075 * D), holeR],
    drawShape(ctx) { ctx.beginPath(); ctx.arc(R, cy, R, 0, Math.PI * 2); ctx.fill() },
    text: { w: 0.8 * D, h: 0.3 * D, cy: cy },
    sub: { w: 0.55 * D, h: 0.075 * D, cy: cy + 0.25 * D },
  }
}

const f3 = n => Number(n.toFixed(3)).toString()

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function snowflake(x, y, size) {
  let d = ''
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    const ex = x + Math.cos(a) * size, ey = y + Math.sin(a) * size
    d += `M${x.toFixed(2)} ${y.toFixed(2)}L${ex.toFixed(2)} ${ey.toFixed(2)}`
    const bx = x + Math.cos(a) * size * 0.55, by = y + Math.sin(a) * size * 0.55
    for (const side of [-1, 1]) {
      const b = a + side * 0.7
      d += `M${bx.toFixed(2)} ${by.toFixed(2)}L${(bx + Math.cos(b) * size * 0.35).toFixed(2)} ${(by + Math.sin(b) * size * 0.35).toFixed(2)}`
    }
  }
  return d
}

function decoration(f) {
  const D = model.diameter
  const stroke = d => `<path fill="none" stroke="#000000" stroke-width="${SCORE_STROKE}" stroke-linecap="round" d="${d}"/>`
  if (model.deco === 'none') return ''
  if (model.shape === 'star') {
    const inner = starPoints(f.cx, f.cy, f.R * 0.82, f.R * 0.43)
    return stroke('M' + inner.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z')
  }
  if (model.deco === 'ring') {
    const r = f.R - 0.055 * D
    return stroke(`M${(f.cx - r).toFixed(2)} ${f.cy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`)
  }
  return stroke(
    snowflake(f.cx, f.cy - 0.3 * D, 0.06 * D) +
    snowflake(f.cx - 0.3 * D, f.cy + 0.2 * D, 0.04 * D) +
    snowflake(f.cx + 0.3 * D, f.cy + 0.2 * D, 0.04 * D),
  )
}

// ── BUILD ───────────────────────────────────────────────────────

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

let outlineCache = { key: '', d: '' }

async function update() {
  const run = ++token
  exportSvgs = []
  refs.download('svg').disabled = true

  const names = model.names.split('\n').map(s => s.trim()).filter(Boolean)
  if (!names.length) {
    refs.preview.innerHTML = ''
    refs.setEmpty('Escribí al menos un nombre')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  refs.setEmpty('Cargando letra…')
  let font, subFont
  try {
    ;[font, subFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
  } catch {
    refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
    return
  }
  if (run !== token) return

  const f = frame()
  const sub = model.subtitle.trim()
  const subBlock = sub ? textBlock(subFont, sub, 10, f.sub.w, f.sub.h) : null
  const textBox = { w: f.text.w * model.textSize, h: f.text.h * model.textSize }
  const nameCy = subBlock ? f.text.cy - 0.03 * model.diameter : f.text.cy
  const deco = decoration(f)
  const holeMarkup = `<circle cx="${f3(f.hole[0])}" cy="${f3(f.hole[1])}" r="${f3(f.hole[2])}"/>`

  const pieces = []
  let totalBridges = 0
  let thinWarning = false

  for (const name of names) {
    const t = textBlock(font, name, 10, textBox.w, textBox.h)
    if (!t) continue
    const tx = f.cx - t.w / 2
    const ty = nameCy - t.h / 2
    const subMarkup = subBlock ? textMarkup(subBlock, f.cx - subBlock.w / 2, f.sub.cy - subBlock.h / 2) : ''

    let cut
    if (model.mode === 'cut') {
      const traced = traceDrawing({
        width: f.w, height: f.h, pxPerMm: 24, bridge: model.bridge,
        outline: !f.outline,
        draw: ctx => f.drawShape(ctx),
        drawCutouts: ctx => drawText(ctx, t, tx, ty, model.thicken),
      })
      totalBridges += traced.bridges
      cut = `<path d="${(f.outline || traced.outline) + traced.cutouts}"/>` + holeMarkup
      if (t.h < MIN_CUT_TEXT_MM) thinWarning = true
    } else {
      const key = JSON.stringify([model.shape, model.diameter, model.hole])
      if (outlineCache.key !== key) {
        const d = f.outline || traceDrawing({ width: f.w, height: f.h, pxPerMm: 24, draw: ctx => f.drawShape(ctx) }).outline
        outlineCache = { key, d }
      }
      cut = `<path d="${outlineCache.d}"/>` + holeMarkup
    }

    pieces.push({
      w: f.w, h: f.h, cut,
      engrave: (model.mode === 'engrave' ? textMarkup(t, tx, ty) : '') + subMarkup + deco,
    })
    // Yield so long lists keep the page responsive.
    await new Promise(resolve => setTimeout(resolve, 0))
    if (run !== token) return
  }

  const { svgs, sheets, oversize, machine } = showPieces(refs, pieces)
  exportSvgs = svgs
  refs.setEmpty('')
  refs.setInfo(
    `${pieces.length} pieza${pieces.length === 1 ? '' : 's'} de <strong>${f.w.toFixed(0)} × ${f.h.toFixed(0)} mm</strong>` +
    ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'} de ${machine.area.w} × ${machine.area.h} mm` +
    (model.mode === 'cut' ? ` &nbsp;·&nbsp; ${totalBridges} puente${totalBridges === 1 ? '' : 's'}` : ''),
  )
  const warnings = []
  if (oversize.length) warnings.push('⚠ La esfera no entra en el área de la máquina.')
  if (thinWarning) warnings.push(`⚠ Algún nombre queda de menos de ${MIN_CUT_TEXT_MM} mm de alto: calado puede salir frágil. Agrandá la esfera, engrosá las letras o usá grabado.`)
  refs.setWarn(warnings.join(' '))
  refs.download('svg').disabled = !svgs.length || oversize.length > 0
}
