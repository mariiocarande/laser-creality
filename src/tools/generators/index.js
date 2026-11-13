import { halftoneTool } from './halftoneTool.js'
import { depthMapTool } from './depthMapTool.js'
import { puzzleTool } from './puzzleTool.js'
import { ornamentTool } from './ornamentTool.js'
import { treeTool } from './treeTool.js'
import { crosswordTool } from './crosswordTool.js'

// Add new generators here: each one needs { id, icon, title, description, mount(root, { onBack }) }.
const GENERATORS = [ornamentTool, treeTool, crosswordTool, halftoneTool, depthMapTool, puzzleTool]

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

  const grid = gallery.querySelector('.gen-grid')
  GENERATORS.forEach(tool => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'gen-card'
    card.innerHTML = `
      <span class="gen-card-ico">${tool.icon}</span>
      <span class="gen-card-title"></span>
      <span class="gen-card-desc"></span>
      <span class="gen-card-cta">Abrir →</span>`
    card.querySelector('.gen-card-title').textContent = tool.title
    card.querySelector('.gen-card-desc').textContent = tool.description
    card.addEventListener('click', () => open(tool))
    grid.appendChild(card)
  })
}
