import '../style.css'
import { state, setMachine, onMachineChange } from './state.js'
import { buildMachineSelector, updateMachineInfo } from './ui.js'
import { initImagePrep } from './tools/imagePrep.js'
import { initBoxTool } from './tools/boxTool.js'
import { initCustomTool } from './tools/customTool.js'

function setView(view) {
  state.view = view
  document.querySelectorAll('.tool-tab').forEach(tab => {
    const isActive = tab.dataset.view === view
    tab.classList.toggle('on', isActive)
    tab.setAttribute('aria-selected', String(isActive))
  })
  document.querySelectorAll('.view').forEach(section => {
    section.hidden = section.dataset.view !== view
  })
}

function init() {
  buildMachineSelector(setMachine)
  onMachineChange(updateMachineInfo)

  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.view))
  })

  initImagePrep()
  initBoxTool()
  initCustomTool()
  setView(state.view)
}

init()
