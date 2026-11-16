import { FONTS, loadFont, textBlock, textMarkup } from '../../textPaths.js'
import { buildBox } from '../../boxGeometry.js'
import { traceDrawing } from '../../weld.js'
import { pointsToPath, holesToMarkup, downloadSvgs } from '../../sheets.js'
import { mulberry32 } from '../../puzzle.js'
import { shapesFor, shapeThumb, lanternThumb, HOLIDAYS } from '../../holidays.js'
import { attachDxf } from '../../dxfButton.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs, bindViewTabs } from './layout.js'
import { showPieces, fontFieldOptions } from './output.js'

const WOOD = '#e8d0a0'
const WALLS = ['front', 'back', 'left', 'right']
const DENSITY = { low: 4, mid: 7, high: 11 }
const ICON_GAP = 5          // mm between cut-outs
const BRIDGE = 1.4          // keeps islands (e.g. inside a mug handle) attached

const DEFAULT_TEXT = { navidad: 'Feliz Navidad', halloween: 'Boo!', pascua: 'Felices Pascuas', sanvalentin: 'Te quiero' }

export function lanternTool(holiday) {
  const meta = HOLIDAYS.find(h => h.id === holiday)
  const icons = shapesFor(holiday, { lantern: true })
  const model = {
    width: 110, depth: 110, height: 150, thickness: 3, kerf: 0.15,
    iconSize: 34, density: 'mid', seed: 1,
    text: DEFAULT_TEXT[holiday] || '', font: 'pacifico',
    baseHole: true, glow: true,
    enabled: Object.fromEntries(icons.map(i => [i.id, true])),
  }

  const picker = `<div class="shape-grid" data-role="icons">${icons.map(s => `
    <button type="button" class="shape-btn on" data-icon="${s.id}" title="${s.label}">
      <img alt="" data-thumb="${s.id}"><span>${s.label}</span>
    </button>`).join('')}</div>`

  const sections = [
    { title: 'Dibujos calados', fields: [
      { type: 'html', html: picker },
      { type: 'choice', key: 'density', label: 'Cantidad por cara', options: [['low', 'Pocos'], ['mid', 'Medio'], ['high', 'Muchos']] },
      { type: 'range', key: 'iconSize', label: 'Tamaño máximo', min: 14, max: 70, step: 1, format: v => `${v} mm` },
      { type: 'html', html: '<button class="mini-btn gen-shuffle" data-role="shuffle">🎲 Otra distribución</button>' },
    ] },
    { title: 'Farol', fields: [
      { type: 'row', fields: [
        { type: 'number', key: 'width', label: 'Ancho', min: 50, step: 1 },
        { type: 'number', key: 'depth', label: 'Fondo', min: 50, step: 1 },
        { type: 'number', key: 'height', label: 'Alto', min: 60, step: 1 },
      ] },
      { type: 'row', fields: [
        { type: 'number', key: 'thickness', label: 'Grosor (mm)', min: 1, step: 0.5 },
        { type: 'number', key: 'kerf', label: 'Kerf (mm)', min: 0, step: 0.01 },
      ] },
      { type: 'toggle', key: 'baseHole', label: 'Agujero en la base (para prender la vela LED)' },
    ] },
    { title: 'Texto grabado en el frente', fields: [
      { type: 'text', key: 'text', label: 'Texto (opcional)', maxLength: 30 },
      { type: 'select', key: 'font', label: 'Letra', options: fontFieldOptions(FONTS) },
    ] },
  ]

  let refs = null
  let viewer = null
  let lastResult = null
  let exportSvgs = []
  let timer = 0
  let token = 0

  // Scatter icons on a wall (outside coords: x right, y down) without overlaps.
  function scatter(wall, w, h, margin, reserved, random) {
    const pool = icons.filter(i => model.enabled[i.id])
    const placed = []
    if (!pool.length) return placed
    const target = DENSITY[model.density]
    for (let tries = 0; tries < 600 && placed.length < target; tries++) {
      const icon = pool[Math.floor(random() * pool.length)]
      const [bw, bh] = icon.size
      const size = model.iconSize * (0.55 + 0.45 * random())
      const scale = size / Math.max(bw, bh)
      const r = (Math.hypot(bw, bh) * scale) / 2
      const x = margin + r + random() * (w - 2 * margin - 2 * r)
      const y = margin + r + random() * (h - 2 * margin - 2 * r)
      if (!(w - 2 * margin > 2 * r && h - 2 * margin > 2 * r)) continue
      if (reserved && x + r > reserved.x && x - r < reserved.x + reserved.w && y + r > reserved.y && y - r < reserved.y + reserved.h) continue
      if (placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + ICON_GAP)) continue
      placed.push({ icon, x, y, r, scale, rot: (random() - 0.5) * 0.5 })
    }
    return placed
  }

  async function update() {
    const run = ++token
    exportSvgs = []
    refs.download('svg').disabled = true
    const t = model.thickness
    const result = buildBox({
      kind: 'box', width: model.width, depth: model.depth, height: model.height, thickness: t,
      fingerWidth: Math.max(8, t * 3), kerf: model.kerf, lid: 'open', innerDims: false, cols: 1, rows: 1,
    })
    if (result.error) {
      refs.preview.innerHTML = ''
      refs.setEmpty(result.error)
      refs.setInfo('')
      return
    }

    let font = null
    if (model.text.trim()) {
      try { font = await loadFont(model.font) } catch { /* text skipped */ }
      if (run !== token) return
    }

    const random = mulberry32(model.seed * 7919 + holiday.length)
    const half = model.kerf / 2
    const margin = t + 6
    let iconCount = 0

    for (const panel of result.panels) {
      const xs = panel.shape.map(q => q[0]), ys = panel.shape.map(q => q[1])
      const w = Math.max(...xs), h = Math.max(...ys)
      panel.extraCut = ''

      if (panel.id === 'bottom' && model.baseHole) {
        const r = Math.min(22, (Math.min(w, h) - 2 * margin) / 2 - 4)
        if (r > 6) panel.extraCut = `<circle cx="${(w / 2 + half).toFixed(3)}" cy="${(h / 2 + half).toFixed(3)}" r="${(r - half).toFixed(3)}"/>`
        if (r > 6) panel.shapeHoles = panel.shapeHoles.concat([{ cx: w / 2, cy: h / 2, r }])
      }
      if (!WALLS.includes(panel.id)) continue

      // Front text: engraved low on the front, kept clear of cut-outs.
      let reserved = null
      if (panel.id === 'front' && font) {
        const block = textBlock(font, model.text.trim(), 200, w - 2 * margin - 8, Math.min(h * 0.14, 22))
        if (block) {
          const bx = (w - block.w) / 2, by = h - margin - 8 - block.h
          reserved = { x: bx - 4, y: by - 4, w: block.w + 8, h: block.h + 8 }
          const markup = textMarkup(block, bx, by)
          panel.engrave3d = markup
          panel.engraveExport = `<g transform="translate(${half} ${half}) rotate(180 ${(w / 2).toFixed(3)} ${(h / 2).toFixed(3)})">${markup}</g>`
        }
      }

      const placed = scatter(panel.id, w, h, margin + 2, reserved, random)
      iconCount += placed.length
      if (!placed.length) continue
      const traced = traceDrawing({
        width: w, height: h, pxPerMm: 12, bridge: BRIDGE, outline: false,
        draw: ctx => ctx.fillRect(0, 0, w, h),
        drawCutouts: ctx => {
          // Icons are placed in outside coords (y down from the top edge); the
          // canvas row is panel v (up from the bottom joint), hence the flip.
          ctx.translate(0, h); ctx.scale(1, -1)
          placed.forEach(p => {
            const [bw, bh] = p.icon.size
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rot)
            ctx.scale(p.scale, p.scale)
            ctx.translate(-bw / 2, -bh / 2)
            p.icon.draw(ctx)
            ctx.restore()
          })
        },
      })
      panel.shapeHoles = panel.shapeHoles.concat(traced.cutoutLoops.map(points => ({ poly: points })))
      panel.extraCut += `<g transform="translate(${half} ${half})"><path d="${traced.cutouts}"/></g>`
      await new Promise(resolve => setTimeout(resolve, 0))
      if (run !== token) return
    }

    lastResult = result
    if (viewer) { viewer.setBox(result); viewer.setGlow(model.glow) }

    const pieces = result.panels.map(p => ({
      w: p.w, h: p.h, label: p.name,
      cut: `<path d="${pointsToPath(p.points)}"/>${holesToMarkup(p.holes)}${p.extraCut || ''}`,
      engrave: p.engraveExport || '',
    }))
    const { svgs, sheets, oversize } = showPieces(refs, pieces, { allowRotate: true })
    exportSvgs = svgs
    refs.setEmpty('')
    refs.setInfo(
      `<strong>${result.outer.width} × ${result.outer.depth} × ${result.outer.height} mm</strong> &nbsp;·&nbsp; ${iconCount} calados` +
      ` &nbsp;·&nbsp; ${pieces.length} piezas &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'}`,
    )
    refs.setWarn([
      oversize.length ? '⚠ Alguna pieza no entra en el área de la máquina.' : '',
      'Usá solo velas LED: la madera se quema con una vela de verdad.',
    ].filter(Boolean).join(' '))
    refs.download('svg').disabled = !svgs.length || oversize.length > 0
  }

  async function loadViewer() {
    try {
      const { createBoxViewer } = await import('../../box3d.js')
      viewer = createBoxViewer(refs.stage3d)
      viewer.setMaterial(WOOD, 'wood')
      if (lastResult) { viewer.setBox(lastResult); viewer.setGlow(model.glow) }
    } catch (err) {
      console.warn('3D preview unavailable', err)
    }
  }

  return {
    id: `lantern-${holiday}`,
    icon: '🏮',
    title: `Farol de ${meta.label}`,
    description: `Caja de luz con ${icons.map(i => i.label.toLowerCase()).join(', ')} calados en las paredes. Con vista 3D iluminada.`,
    categories: [holiday],
    thumb: () => lanternThumb(icons[Math.min(1, icons.length - 1)]),

    mount(root, { onBack }) {
      root.innerHTML = toolLayout({
        icon: '🏮',
        title: this.title,
        intro: 'Un farol con dibujos calados en las cuatro caras. Poné una vela LED adentro y proyecta las figuras.',
        controls: controlsHtml(sections),
        note: 'Rojo = corte, negro = grabado. Cada dibujo calado queda unido a la pared; si alguno tiene una isla (como el asa de una taza) lleva un puente fino automático.',
        downloads: [{ id: 'svg', label: '⬇ Descargar SVG del farol' }],
        with3d: true,
      })
      refs = layoutRefs(root)
      refs.back.addEventListener('click', onBack)
      bindViewTabs(root)
      root.querySelectorAll('[data-thumb]').forEach(img => { img.src = shapeThumb(icons.find(s => s.id === img.dataset.thumb)) })
      root.querySelectorAll('[data-icon]').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.icon
        const on = !model.enabled[id]
        if (!on && Object.values(model.enabled).filter(Boolean).length === 1) return   // keep at least one
        model.enabled[id] = on
        btn.classList.toggle('on', on)
        update()
      }))
      root.querySelector('[data-role="shuffle"]').addEventListener('click', () => { model.seed += 1; update() })

      const chip = (label, action, on = false) => {
        const b = document.createElement('button')
        b.className = 'chip' + (on ? ' on' : '')
        b.textContent = label
        b.addEventListener('click', () => action(b))
        refs.bar3d.appendChild(b)
      }
      chip('Luz', b => { model.glow = !model.glow; b.classList.toggle('on', model.glow); if (viewer) viewer.setGlow(model.glow) }, true)
      let spinning = false
      chip('Girar', b => { spinning = !spinning; b.classList.toggle('on', spinning); if (viewer) viewer.setAutoRotate(spinning) })
      chip('Frente', () => viewer && viewer.setView('front'))
      chip('Perspectiva', () => viewer && viewer.setView('perspective'))
      chip('PNG', () => {
        if (!viewer) return
        const a = document.createElement('a')
        a.download = `farol_${holiday}.png`
        a.href = viewer.snapshot()
        a.click()
      })

      bindControls(refs.controls, sections, model, () => { clearTimeout(timer); timer = setTimeout(update, 250) })
      refs.download('svg').addEventListener('click', () => downloadSvgs(exportSvgs, `farol_${holiday}`))
      attachDxf(refs.download('svg'), () => exportSvgs, `farol_${holiday}`, text => refs.setWarn(text))
      loadViewer()
      update()
    },
  }
}
