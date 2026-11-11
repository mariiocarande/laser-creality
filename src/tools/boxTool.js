import { DB } from '../db.js'
import { state, onMachineChange } from '../state.js'
import { MACHINES, applyMachine } from '../machines.js'
import { buildBox } from '../boxGeometry.js'
import {
  packSheets, pointsToPath, rotatePoints,
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
  lid: 'open',        // 'open' | 'closed' | 'lift'
  innerDims: false,
  material: 'plywood',
  tone: 'light',
}

let exportSvgs = []

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
    return { x: p.x, y: p.y, w: p.w, h: p.h, label: p.item.name, cut: `<path d="${pointsToPath(points)}"/>` }
  }))

  exportSvgs = sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h))
  renderSheetPreviews(
    preview,
    sheetPlacements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h, { preview: true })),
  )

  const cutLength = result.panels.reduce((sum, p) => sum + p.cutLength, 0)
  const { outer, inner } = result
  const size = d => `${d.width.toFixed(1)} × ${d.depth.toFixed(1)} × ${d.height.toFixed(1)} mm`
  let html =
    `Exterior <strong>${size(outer)}</strong> &nbsp;·&nbsp; Interior <strong>${size(inner)}</strong><br>` +
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

function onInput() {
  box.width       = readNumber('box-width', box.width)
  box.depth       = readNumber('box-depth', box.depth)
  box.height      = readNumber('box-height', box.height)
  box.thickness   = readNumber('box-thickness', box.thickness)
  box.fingerWidth = Math.max(2, readNumber('box-finger', box.fingerWidth))
  box.kerf        = Math.min(1, readNumber('box-kerf', box.kerf))
  update()
}

export function initBoxTool() {
  buildMaterialOptions()
  buildToneOptions()

  ;['box-width', 'box-depth', 'box-height', 'box-thickness', 'box-finger', 'box-kerf']
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

  onMachineChange(update)
  update()
}
