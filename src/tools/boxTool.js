import { DB } from '../db.js'
import { state, onMachineChange } from '../state.js'
import { MACHINES, applyMachine } from '../machines.js'
import { buildBox } from '../boxGeometry.js'
import {
  packSheets, pointsToPath, rotatePoints, rotateHoles, holesToMarkup,
  buildSheetSvg, renderSheetPreviews, downloadSvgs,
} from '../sheets.js'

const THIN_STOCK_MAX = 4.5

const box = {
  width: 100,
  depth: 80,
  height: 60,
  thickness: 3,
  fingerWidth: 10,
  kerf: 0.15,
  lid: 'open',        // one of LID_TYPES in boxGeometry.js
  cols: 1,
  rows: 1,
  innerDims: false,
  material: 'plywood',
  tone: 'light',
}

let exportSvgs = []
let viewer = null       // 3D viewer, loaded lazily so three.js stays out of the main bundle
let lastResult = null
let lidOpen = false

const LID_HINTS = {
  open:   'Sin tapa.',
  closed: 'Caja cerrada: la tapa lleva dientes y se pega con el resto.',
  lift:   'Tapa lisa que se apoya arriba, con un tope que se pega por debajo para que no se corra.',
  slide:  'La tapa entra por el frente y corre entre dos guías que se pegan a cada lateral. El frente queda más bajo.',
  hinge:  'La tapa tiene dos orejas que giran dentro de un agujero en cada lateral: hay que colocarla mientras armás la caja. Se apoya en dos listones pegados.',
}

// How each material is drawn in the 3D preview.
const MATERIAL_LOOK = { wood: 'wood', plywood: 'wood', acrylic: 'acrylic', leather: 'matte', cardboard: 'matte' }

const el = id => document.getElementById(id)

function readNumber(id, fallback) {
  const value = parseFloat(el(id).value.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function cutParams() {
  const tone = DB[box.material].colors[box.tone]
  const base = tone[box.thickness <= THIN_STOCK_MAX ? 'cut3mm' : 'cut6mm']
  return applyMachine(base, state.machine, 'cut')
}

function buildMaterialOptions() {
  const select = el('box-material')
  select.innerHTML = ''
  Object.entries(DB).filter(([, mat]) => !mat.noCut).forEach(([key, mat]) => {
    const opt = document.createElement('option')
    opt.value = key
    opt.textContent = `${mat.icon} ${mat.name}`
    opt.selected = key === box.material
    select.appendChild(opt)
  })
}

function buildToneOptions() {
  const select = el('box-tone')
  const tones = DB[box.material].colors
  if (!tones[box.tone]) box.tone = Object.keys(tones)[0]
  select.innerHTML = ''
  Object.entries(tones).forEach(([key, tone]) => {
    const opt = document.createElement('option')
    opt.value = key
    opt.textContent = tone.label
    opt.selected = key === box.tone
    select.appendChild(opt)
  })
}

function showParams(params) {
  el('box-val-speed').textContent  = params ? params.speed : '—'
  el('box-val-power').textContent  = params ? params.power : '—'
  el('box-val-passes').textContent = params ? params.passes : '—'
  el('box-val-air').textContent    = params ? (params.air ? '✓ Sí' : '✕ No') : '—'
}

function showMessage(text) {
  const warn = el('box-warn')
  warn.textContent = text || ''
  warn.style.display = text ? 'block' : 'none'
}

function formatMinutes(mins) {
  return mins < 1 ? `~${Math.ceil(mins * 60)} seg` : `~${Math.ceil(mins)} min`
}

function update() {
  const machine = MACHINES[state.machine]
  const params = cutParams()
  showParams(params)
  el('box-params-title').textContent = `Corte — ${machine.brand} ${machine.name}`

  const result = buildBox(box)
  lastResult = result.error ? null : result
  syncViewer()
  const preview = el('box-preview')
  const info = el('box-info')
  exportSvgs = []

  if (result.error) {
    preview.innerHTML = ''
    info.style.display = 'none'
    showMessage(result.error)
    el('box-dl-btn').disabled = true
    return
  }

  const { sheets, oversize } = packSheets(result.panels, machine.area.w, machine.area.h)

  const sheetPlacements = sheets.map(sheet => sheet.map(p => {
    const points = p.rotated ? rotatePoints(p.item.points, p.item.h) : p.item.points
    const holes = p.rotated ? rotateHoles(p.item.holes, p.item.h) : p.item.holes
    const cut = `<path d="${pointsToPath(points)}"/>${holesToMarkup(holes)}`
    return { x: p.x, y: p.y, w: p.w, h: p.h, label: p.item.name, cut }
  }))

  exportSvgs = sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h))
  renderSheetPreviews(
    preview,
    sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h, { preview: true })),
  )

  const cutLength = result.panels.reduce((sum, p) => sum + p.cutLength, 0)
  const { outer, inner, cells } = result
  const cellCount = cells.cols * cells.rows
  const size = d => `${d.width.toFixed(1)} × ${d.depth.toFixed(1)} × ${d.height.toFixed(1)} mm`
  let html =
    `Exterior <strong>${size(outer)}</strong> &nbsp;·&nbsp; Interior <strong>${size(inner)}</strong><br>` +
    (cellCount > 1 ? `${cellCount} compartimentos (${cells.cols} × ${cells.rows}) &nbsp;·&nbsp; ` : '') +
    `${result.panels.length} piezas &nbsp;·&nbsp; ${sheets.length} plancha${sheets.length === 1 ? '' : 's'} de ` +
    `${machine.area.w} × ${machine.area.h} mm &nbsp;·&nbsp; ${(cutLength / 1000).toFixed(2)} m de corte`
  if (params) html += ` &nbsp;·&nbsp; ${formatMinutes((cutLength / params.speed) * params.passes)}`
  info.innerHTML = html
  info.style.display = 'block'

  const messages = []
  if (oversize.length) {
    messages.push(`⚠ No entran en el área de la máquina: ${oversize.map(p => p.name).join(', ')}.`)
  }
  if (!params) {
    messages.push('⚠ Este material no se puede cortar en ese grosor con esta base de parámetros. Probá con uno más fino.')
  }
  if (box.kerf >= box.fingerWidth / 2) {
    messages.push('⚠ El kerf es demasiado grande para ese ancho de diente.')
  }
  showMessage(messages.join(' '))

  el('box-dl-btn').disabled = exportSvgs.length === 0 || oversize.length > 0
}

function syncViewer() {
  if (!viewer) return
  if (!lastResult) { viewer.clear(); return }
  viewer.setMaterial(DB[box.material].colors[box.tone].sw, MATERIAL_LOOK[box.material] || 'matte')
  viewer.setBox(lastResult)
  syncLidButton()
}

function setPressed(id, on) {
  el(id).classList.toggle('on', on)
  el(id).setAttribute('aria-pressed', String(on))
}

function syncLidButton() {
  const hasLid = Boolean(viewer && viewer.hasLid())
  el('box-3d-lid').disabled = !hasLid
  if (!hasLid) {
    lidOpen = false
    setPressed('box-3d-lid', false)
    el('box-3d-lid').textContent = 'Abrir tapa'
  }
}

function bindViewerControls() {
  viewer.onHiddenChange(names => { el('box-3d-showall').hidden = names.length === 0 })
  el('box-3d-showall').addEventListener('click', () => viewer.showAll())

  document.querySelectorAll('.box-cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.box-cam-btn').forEach(b => b.classList.toggle('on', b === btn))
      viewer.setView(btn.dataset.cam)
    })
  })

  el('box-3d-lid').addEventListener('click', () => {
    lidOpen = !lidOpen
    setPressed('box-3d-lid', lidOpen)
    el('box-3d-lid').textContent = lidOpen ? 'Cerrar tapa' : 'Abrir tapa'
    viewer.setLidOpen(lidOpen)
  })

  const toggles = {
    'box-3d-rotate': on => viewer.setAutoRotate(on),
    'box-3d-dims':   on => viewer.setDimensionsVisible(on),
    'box-3d-grid':   on => viewer.setGridVisible(on),
  }
  Object.entries(toggles).forEach(([id, apply]) => {
    el(id).addEventListener('click', () => {
      const on = !el(id).classList.contains('on')
      setPressed(id, on)
      apply(on)
    })
  })

  el('box-3d-png').addEventListener('click', () => {
    const a = document.createElement('a')
    a.download = 'caja_3d.png'
    a.href = viewer.snapshot()
    a.click()
  })
}

async function loadViewer() {
  const message = el('box-3d-msg')
  try {
    const { createBoxViewer } = await import('../box3d.js')
    viewer = createBoxViewer(el('box-3d'))
    message.style.display = 'none'
    bindViewerControls()
    syncViewer()
  } catch (err) {
    console.warn('3D preview unavailable', err)
    message.querySelector('.prev-empty-txt').textContent =
      'Tu navegador no pudo iniciar la vista 3D. Usá el plano de corte.'
    document.querySelectorAll('#box-3d .chip').forEach(chip => { chip.disabled = true })
  }
}

function setBoxView(view) {
  document.querySelectorAll('.box-view-tab').forEach(tab =>
    tab.classList.toggle('on', tab.dataset.boxview === view)
  )
  el('box-3d-wrap').hidden = view !== '3d'
  el('box-preview').hidden = view !== 'sheet'
}

function onInput() {
  box.width       = readNumber('box-width', box.width)
  box.depth       = readNumber('box-depth', box.depth)
  box.height      = readNumber('box-height', box.height)
  box.thickness   = readNumber('box-thickness', box.thickness)
  box.fingerWidth = Math.max(2, readNumber('box-finger', box.fingerWidth))
  box.kerf        = Math.min(1, readNumber('box-kerf', box.kerf))
  box.cols        = readNumber('box-cols', box.cols)
  box.rows        = readNumber('box-rows', box.rows)
  update()
}

export function initBoxTool() {
  buildMaterialOptions()
  buildToneOptions()

  ;['box-width', 'box-depth', 'box-height', 'box-thickness', 'box-finger', 'box-kerf', 'box-cols', 'box-rows']
    .forEach(id => el(id).addEventListener('input', onInput))

  el('box-inner').addEventListener('click', () => {
    box.innerDims = !box.innerDims
    el('box-inner').classList.toggle('on', box.innerDims)
    update()
  })

  document.querySelectorAll('.lid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      box.lid = btn.dataset.lid
      document.querySelectorAll('.lid-btn').forEach(b => b.classList.toggle('on', b === btn))
      el('box-lid-hint').textContent = LID_HINTS[box.lid]
      update()
    })
  })

  el('box-material').addEventListener('change', e => {
    box.material = e.target.value
    buildToneOptions()
    update()
  })
  el('box-tone').addEventListener('change', e => {
    box.tone = e.target.value
    update()
  })

  el('box-dl-btn').addEventListener('click', () => {
    const name = `caja_${Math.round(box.width)}x${Math.round(box.depth)}x${Math.round(box.height)}_${box.thickness}mm`
    downloadSvgs(exportSvgs, name)
  })

  document.querySelectorAll('.box-view-tab').forEach(tab => {
    tab.addEventListener('click', () => setBoxView(tab.dataset.boxview))
  })
  el('sl-box-explode').addEventListener('input', e => {
    const percent = parseInt(e.target.value, 10)
    el('lbl-box-explode').textContent = `${percent}%`
    if (viewer) viewer.setExplode(percent / 100)
  })

  onMachineChange(update)
  update()
  loadViewer()
}
