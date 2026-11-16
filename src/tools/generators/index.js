import { halftoneTool } from './halftoneTool.js'
import { depthMapTool } from './depthMapTool.js'
import { puzzleTool } from './puzzleTool.js'
import { ornamentTool } from './ornamentTool.js'
import { treeTool } from './treeTool.js'
import { crosswordTool } from './crosswordTool.js'
import { qrTagTool } from './qrTagTool.js'
import { keychainTool } from './keychainTool.js'
import { drinkMarkerTool } from './drinkMarkerTool.js'
import { frameTool } from './frameTool.js'
import { kerfTool } from './kerfTool.js'
import { themedTagTool } from './themedTagTool.js'
import { lanternTool } from './lanternTool.js'
import { HOLIDAYS } from '../../holidays.js'

// Every generator: { id, icon, title, description, categories, thumb?, mount(root, { onBack }) }.
const GENERATORS = [
  ornamentTool, treeTool, lanternTool('navidad'), themedTagTool('navidad'),
  themedTagTool('pascua'), lanternTool('pascua'),
  lanternTool('halloween'), themedTagTool('halloween'),
  themedTagTool('sanvalentin'), lanternTool('sanvalentin'),
  themedTagTool('madrepadre'), crosswordTool, frameTool, keychainTool,
  themedTagTool('cumple'), drinkMarkerTool,
  qrTagTool, halftoneTool, depthMapTool, puzzleTool, kerfTool,
]

const SECTIONS = [
  ...HOLIDAYS,
  { id: 'regalos', icon: '🎁', label: 'Regalos todo el año', blurb: 'Llaveros, etiquetas con QR, marcos y crucigramas.' },
  { id: 'imagen', icon: '🖼', label: 'Herramientas de imagen', blurb: 'Halftone, mapas de profundidad y rompecabezas con tu foto.' },
  { id: 'herramientas', icon: '🛠', label: 'Calibración', blurb: 'Pruebas para ajustar tu láser.' },
]

// Days until the next occurrence of each dated holiday.
function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nextHoliday(today = new Date()) {
  const y = today.getFullYear()
  const dates = {
    navidad: y => new Date(y, 11, 25),
    halloween: y => new Date(y, 9, 31),
    sanvalentin: y => new Date(y, 1, 14),
    pascua: y => easter(y),
  }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let best = null
  Object.entries(dates).forEach(([id, at]) => {
    let d = at(y)
    if (d < start) d = at(y + 1)
    const days = Math.round((d - start) / 86400000)
    if (!best || days < best.days) best = { id, days }
  })
  return best
}

export function initGenerators() {
  const gallery = document.getElementById('gen-gallery')
  const host = document.getElementById('gen-host')
  const mounted = new Map()

  const showGallery = () => {
    gallery.hidden = false
    mounted.forEach(node => { node.hidden = true })
  }

  const open = tool => {
    if (!mounted.has(tool.id)) {
      const node = document.createElement('div')
      node.className = 'gen-tool'
      host.appendChild(node)
      tool.mount(node, { onBack: showGallery })
      mounted.set(tool.id, node)
    }
    gallery.hidden = true
    mounted.forEach((node, id) => { node.hidden = id !== tool.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const card = tool => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'gen-card'
    const art = document.createElement('span')
    art.className = 'gen-card-art'
    if (tool.thumb) {
      const img = document.createElement('img')
      img.alt = ''
      img.src = tool.thumb()
      art.appendChild(img)
    } else {
      art.textContent = tool.icon
    }
    const title = document.createElement('span')
    title.className = 'gen-card-title'
    title.textContent = tool.title
    const desc = document.createElement('span')
    desc.className = 'gen-card-desc'
    desc.textContent = tool.description
    const cta = document.createElement('span')
    cta.className = 'gen-card-cta'
    cta.textContent = 'Abrir →'
    el.append(art, title, desc, cta)
    el.addEventListener('click', () => open(tool))
    return el
  }

  // Upcoming holiday goes first and gets a badge.
  const upcoming = nextHoliday()
  const order = SECTIONS.slice().sort((a, b) => (b.id === upcoming?.id) - (a.id === upcoming?.id))

  const filters = gallery.querySelector('.gen-filters')
  const sectionsHost = gallery.querySelector('.gen-sections')
  const sectionNodes = new Map()

  order.forEach(section => {
    const tools = GENERATORS.filter(t => (t.categories || []).includes(section.id))
    if (!tools.length) return
    const node = document.createElement('section')
    node.className = 'gen-section'
    node.dataset.section = section.id
    const head = document.createElement('div')
    head.className = 'gen-section-head'
    const h = document.createElement('h3')
    h.textContent = `${section.icon} ${section.label}`
    if (upcoming && section.id === upcoming.id) {
      const badge = document.createElement('span')
      badge.className = 'gen-badge'
      badge.textContent = upcoming.days === 0 ? '¡Es hoy!' : `Faltan ${upcoming.days} días`
      h.appendChild(badge)
    }
    const p = document.createElement('p')
    p.textContent = section.blurb
    head.append(h, p)
    const grid = document.createElement('div')
    grid.className = 'gen-grid'
    tools.forEach(tool => grid.appendChild(card(tool)))
    node.append(head, grid)
    sectionsHost.appendChild(node)
    sectionNodes.set(section.id, node)
  })

  const chip = (id, label) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sv-chip' + (id === 'all' ? ' on' : '')
    b.textContent = label
    b.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b))
      sectionNodes.forEach((node, key) => { node.hidden = id !== 'all' && key !== id })
    })
    filters.appendChild(b)
  }
  chip('all', 'Todo')
  order.forEach(section => { if (sectionNodes.has(section.id)) chip(section.id, `${section.icon} ${section.label}`) })
}
