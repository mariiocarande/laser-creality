import { DB } from './db.js'
import { state } from './state.js'
import { estimateTime } from './imageProcessing.js'

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
  const mat = DB[state.material]
  const col = mat.colors[state.color]

  let s
  if (state.mode === 'engrave') {
    s = col.engrave
  } else {
    s = col[state.thickness === '3mm' ? 'cut3mm' : 'cut6mm']
  }

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
