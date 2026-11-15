import { FONTS, loadFont, textBlock, textMarkup, blockMatrix } from '../../textPaths.js'
import { traceDrawing } from '../../weld.js'
import { downloadSvgs } from '../../sheets.js'
import { shapesFor, shapeThumb, HOLIDAYS } from '../../holidays.js'
import { attachDxf } from '../../dxfButton.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'

const MIN_CUT_TEXT_MM = 7
const DETAIL_LINE_MM = 0.3

const DEFAULT_NAMES = {
  navidad: 'Sofía\nMateo\nAbuela Rosa',
  pascua: 'Valentina\nBruno\nEmma',
  halloween: 'Lucas\nMía\nTomás',
  sanvalentin: 'Ana & Juan',
  madrepadre: 'Mamá\nPapá',
  cumple: 'Feliz cumple\nMartina',
}

const DEFAULT_SUB = {
  navidad: 'Navidad 2026', pascua: 'Felices Pascuas', halloween: 'Halloween 2026',
  sanvalentin: 'Te quiero', madrepadre: 'Te quiero', cumple: '7 años',
}

// One tool instance per holiday, each with its own state.
export function themedTagTool(holiday) {
  const meta = HOLIDAYS.find(h => h.id === holiday)
  // Shapes that belong mainly to this holiday come first (a star is Christmas before birthdays).
  const shapes = shapesFor(holiday).sort((a, b) => (b.holidays[0] === holiday) - (a.holidays[0] === holiday))
  const model = {
    shape: shapes[0].id,
    names: DEFAULT_NAMES[holiday],
    subtitle: DEFAULT_SUB[holiday],
    font: 'pacifico',
    width: 80,
    mode: 'engrave',
    details: true,
    hole: true,
    holeDiameter: 4,
    thicken: 0.15,
    bridge: 1.2,
  }

  const picker = `<div class="shape-grid" data-role="shapes">${shapes.map(s => `
    <button type="button" class="shape-btn" data-shape="${s.id}" title="${s.label}">
      <img alt="" data-thumb="${s.id}"><span>${s.label}</span>
    </button>`).join('')}</div>`

  const sections = [
    { title: 'Forma', fields: [{ type: 'html', html: picker }] },
    { title: 'Nombres', fields: [
      { type: 'textarea', key: 'names', label: 'Uno por línea — sale una pieza por cada uno', rows: 4 },
      { type: 'text', key: 'subtitle', label: 'Segunda línea (opcional)', maxLength: 30 },
      { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
    ] },
    { title: 'Tamaño y detalles', fields: [
      { type: 'row', fields: [
        { type: 'number', key: 'width', label: 'Ancho (mm)', min: 30, step: 1 },
        { type: 'number', key: 'holeDiameter', label: 'Agujero (mm)', min: 2, step: 0.5, showIf: m => m.hole },
      ] },
      { type: 'toggle', key: 'details', label: 'Detalles grabados del dibujo' },
      { type: 'toggle', key: 'hole', label: 'Agujero para colgar' },
    ] },
    { title: 'El nombre va', fields: [
      { type: 'choice', key: 'mode', options: [['engrave', 'Grabado'], ['cut', 'Calado']] },
      { type: 'range', key: 'thicken', label: 'Engrosar letras', min: 0, max: 1.2, step: 0.05, format: v => `${v.toFixed(2)} mm`, showIf: m => m.mode === 'cut' },
      { type: 'range', key: 'bridge', label: 'Ancho de los puentes', min: 0.6, max: 3, step: 0.1, format: v => `${v.toFixed(1)} mm`, showIf: m => m.mode === 'cut' },
    ] },
  ]

  let refs = null
  let exportSvgs = []
  let timer = 0
  let token = 0
  const outlineCache = new Map()

  function syncShapes(root) {
    root.querySelectorAll('.shape-btn').forEach(b => b.classList.toggle('on', b.dataset.shape === model.shape))
  }

  async function update() {
    const run = ++token
    exportSvgs = []
    refs.download('svg').disabled = true
    const shape = shapes.find(s => s.id === model.shape)
    const names = model.names.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 80)
    if (!names.length) {
      refs.preview.innerHTML = ''
      refs.setEmpty('Escribí al menos un nombre')
      refs.setInfo('')
      refs.setWarn('')
      return
    }
    let font, subFont
    try {
      ;[font, subFont] = await Promise.all([loadFont(model.font), loadFont('dmsans')])
    } catch {
      refs.setEmpty('No se pudo cargar la letra. Revisá tu conexión.')
      return
    }
    if (run !== token) return

    const [bw, bh] = shape.size
    const s = model.width / bw
    const W = model.width, H = bh * s
    const box = ([x, y, w, h]) => ({ x: x * s, y: y * s, w: w * s, h: h * s })
    const tb = box(shape.text)
    const sb = shape.sub ? box(shape.sub) : null
    const subText = model.subtitle.trim()
    const subBlock = sb && subText ? textBlock(subFont, subText, 200, sb.w, sb.h) : null
    const subMarkup = subBlock ? textMarkup(subBlock, sb.x + (sb.w - subBlock.w) / 2, sb.y + (sb.h - subBlock.h) / 2) : ''
    const details = model.details ? `<g transform="scale(${s.toFixed(5)})">${shape.details(DETAIL_LINE_MM / s)}</g>` : ''
    const hole = shape.hole && model.hole
      ? `<circle cx="${(shape.hole[0] * s).toFixed(3)}" cy="${(shape.hole[1] * s).toFixed(3)}" r="${(model.holeDiameter / 2).toFixed(3)}"/>`
      : ''
    const drawShape = ctx => { ctx.save(); ctx.scale(s, s); shape.draw(ctx); ctx.restore() }

    const outlineKey = `${shape.id}|${W}`
    if (!outlineCache.has(outlineKey)) {
      outlineCache.set(outlineKey, traceDrawing({ width: W, height: H, pxPerMm: 20, draw: drawShape }).outline)
    }
    const outline = outlineCache.get(outlineKey)

    const pieces = []
    let bridges = 0
    let small = false
    for (const name of names) {
      const t = textBlock(font, name, 200, tb.w, tb.h)
      if (!t) continue
      const tx = tb.x + (tb.w - t.w) / 2, ty = tb.y + (tb.h - t.h) / 2
      let cut = `<path d="${outline}"/>` + hole
      let engrave = details + subMarkup
      if (model.mode === 'cut') {
        const traced = traceDrawing({
          width: W, height: H, pxPerMm: 24, bridge: model.bridge, outline: false,
          draw: drawShape,
          drawCutouts: ctx => {
            ctx.save()
            ctx.setTransform(ctx.getTransform().multiply(blockMatrix(t, tx, ty)))
            const path = new Path2D(t.d)
            ctx.fill(path)
            if (model.thicken > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = (2 * model.thicken) / t.scale; ctx.stroke(path) }
            ctx.restore()
          },
        })
        bridges += traced.bridges
        cut += `<path d="${traced.cutouts}"/>`
        if (t.h < MIN_CUT_TEXT_MM) small = true
      } else {
        engrave += textMarkup(t, tx, ty)
      }
      pieces.push({ w: W, h: H, cut, engrave, label: name })
      await new Promise(resolve => setTimeout(resolve, 0))
      if (run !== token) return
    }

    // Pieces stay upright on the sheet so names read naturally in the preview.
    const { svgs, sheets, oversize, machine } = showPieces(refs, pieces)
    exportSvgs = svgs
    refs.setEmpty('')
    refs.setInfo(
      `${pieces.length} pieza${pieces.length === 1 ? '' : 's'} de <strong>${W.toFixed(0)} × ${H.toFixed(0)} mm</strong>` +
      ` &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'} de ${machine.area.w} × ${machine.area.h} mm` +
      (model.mode === 'cut' ? ` &nbsp;·&nbsp; ${bridges} puente${bridges === 1 ? '' : 's'}` : ''),
    )
    const warnings = []
    if (oversize.length) warnings.push('⚠ La pieza no entra en el área de la máquina.')
    if (small) warnings.push(`⚠ Algún nombre queda de menos de ${MIN_CUT_TEXT_MM} mm de alto: calado puede salir frágil. Agrandá la pieza o grabalo.`)
    refs.setWarn(warnings.join(' '))
    refs.download('svg').disabled = !svgs.length || oversize.length > 0
  }

  return {
    id: `tags-${holiday}`,
    icon: meta.icon,
    title: `Etiquetas y adornos de ${meta.label}`,
    description: `${shapes.map(s => s.label).join(', ')} con el nombre grabado o calado. Una pieza por nombre.`,
    categories: [holiday],
    thumb: () => shapeThumb(shapes[0]),

    mount(root, { onBack }) {
      root.innerHTML = toolLayout({
        icon: meta.icon,
        title: this.title,
        intro: 'Elegí el dibujo, escribí los nombres y descargá todas las piezas acomodadas en planchas.',
        controls: controlsHtml(sections),
        note: 'Rojo = corte, negro = grabado. Los detalles del dibujo son líneas finas: en LightBurn asignales una capa de línea. En calado, las letras rectas (Bebas, DM Sans) quedan más limpias.',
        downloads: [{ id: 'svg', label: '⬇ Descargar SVG' }],
      })
      refs = layoutRefs(root)
      refs.back.addEventListener('click', onBack)
      root.querySelectorAll('[data-thumb]').forEach(img => {
        img.src = shapeThumb(shapes.find(s => s.id === img.dataset.thumb))
      })
      root.querySelectorAll('.shape-btn').forEach(btn => btn.addEventListener('click', () => {
        model.shape = btn.dataset.shape
        syncShapes(root)
        update()
      }))
      syncShapes(root)
      bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 200) })
      refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, `${holiday}_${model.shape}`))
      attachDxf(refs.download('svg'), () => exportSvgs, () => `${holiday}_${model.shape}`, text => refs.setWarn(text))
      update()
    },
  }
}
