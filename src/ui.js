import { DB } from './db.js'
import { state } from './state.js'
import { MACHINES, applyMachine } from './machines.js'
import { estimateTime } from './imageProcessing.js'

export function buildMachineSelector(onChange) {
  const sel = document.getElementById('machine-select')
  sel.innerHTML = ''

  const brands = {}
  Object.entries(MACHINES).forEach(([key, m]) => {
    if (!brands[m.brand]) brands[m.brand] = []
    brands[m.brand].push({ key, ...m })
  })

  Object.entries(brands).forEach(([brand, machines]) => {
    const grp = document.createElement('optgroup')
    grp.label = brand
    machines.forEach(m => {
      const opt = document.createElement('option')
      opt.value = m.key
      opt.textContent = `${m.name} — ${m.power}W`
      if (m.key === state.machine) opt.selected = true
      grp.appendChild(opt)
    })
    sel.appendChild(grp)
  })

  sel.addEventListener('change', () => onChange(sel.value))
  updateMachineInfo()
}

export function updateMachineInfo() {
  const m = MACHINES[state.machine]
  if (!m) return

  const specs = document.getElementById('machine-specs')
  if (specs) {
    specs.innerHTML =
      `<span class="machine-badge power">${m.power}W</span>` +
      `<span class="machine-badge area">${m.area.w} × ${m.area.h} mm</span>` +
      `<span class="machine-badge area">máx ${Math.round(m.maxSpeed / 1000)}k mm/min</span>`
  }

  const headerMachine = document.getElementById('header-machine')
  if (headerMachine) headerMachine.textContent = `${m.brand} ${m.name}`

  const panelTitle = document.getElementById('results-panel-hd-txt')
  if (panelTitle) panelTitle.textContent = `Parámetros — ${m.brand} ${m.name}`
}

export function buildMaterialGrid(onSelect) {
  const g = document.getElementById('mat-grid')
  g.innerHTML = ''
  Object.entries(DB).forEach(([key, mat]) => {
    const d = document.createElement('div')
    d.className = 'mat-btn' + (key === state.material ? ' on' : '')
    d.dataset.mat = key
    d.innerHTML = `<span class="mat-ico">${mat.icon}</span><span class="mat-nm">${mat.name}</span>`
    d.addEventListener('click', () => onSelect(key))
    g.appendChild(d)
  })
}

export function buildColorOpts(onSelect) {
  const mat = DB[state.material]
  const c = document.getElementById('col-opts')
  c.innerHTML = ''
  Object.entries(mat.colors).forEach(([key, col]) => {
    const d = document.createElement('div')
    d.className = 'col-opt' + (key === state.color ? ' on' : '')
    d.dataset.col = key
    d.innerHTML = `
      <span class="swatch" style="background:${col.sw}"></span>
      <span class="col-lbl">${col.label}</span>
      <span class="col-chk">✓</span>`
    d.addEventListener('click', () => onSelect(key))
    c.appendChild(d)
  })

  const nb = document.getElementById('mat-note')
  if (mat.note) {
    nb.textContent = '⚠ ' + mat.note
    nb.style.display = 'block'
  } else {
    nb.style.display = 'none'
  }
}

export function updateSettingsDisplay() {
  updateMachineInfo()

  const mat = DB[state.material]
  const col = mat.colors[state.color]

  let baseParams
  if (state.mode === 'engrave') {
    baseParams = col.engrave
  } else {
    baseParams = col[state.thickness === '3mm' ? 'cut3mm' : 'cut6mm']
  }

  const s = applyMachine(baseParams, state.machine, state.mode)

  const warn = document.getElementById('no-cut-warn')

  if (!s) {
    warn.style.display = 'block'
    ;['val-speed','val-power','val-passes','val-interval','val-dpi','val-air']
      .forEach(id => { document.getElementById(id).textContent = '—' })
  } else {
    warn.style.display = 'none'
    document.getElementById('val-speed').textContent    = s.speed
    document.getElementById('val-power').textContent    = s.power
    document.getElementById('val-passes').textContent   = s.passes
    document.getElementById('val-interval').textContent = s.interval
    document.getElementById('val-dpi').textContent      = s.dpi
    document.getElementById('val-air').textContent      = s.air ? '✓ Sí' : '✕ No'
  }

  document.getElementById('note-text').textContent =
    mat.note || 'Verificá siempre en un trozo de prueba antes de grabar la pieza final.'

  updateOutputInfo(s)
}

function updateOutputInfo(settings) {
  const infoEl = document.getElementById('output-info')
  if (!infoEl || !state.outputWidth) {
    if (infoEl) infoEl.style.display = 'none'
    return
  }

  const dpi = settings ? settings.dpi : 254
  const wMm = ((state.outputWidth  / dpi) * 25.4).toFixed(1)
  const hMm = ((state.outputHeight / dpi) * 25.4).toFixed(1)

  let html = `${state.outputWidth} × ${state.outputHeight} px &nbsp;·&nbsp; ${wMm} × ${hMm} mm`

  if (state.mode === 'vector' && state.pathCount > 0) {
    html += ` &nbsp;·&nbsp; <strong>${state.pathCount}</strong> vectores`
  }

  if (settings && state.mode === 'engrave') {
    const mins    = estimateTime(state.outputWidth, state.outputHeight, dpi, settings.speed, settings.passes)
    const timeStr = mins < 1
      ? `~${Math.ceil(mins * 60)} seg`
      : `~${mins.toFixed(0)} min`
    html += ` &nbsp;·&nbsp; ${timeStr}`
  }

  infoEl.innerHTML = html
  infoEl.style.display = 'block'
}
