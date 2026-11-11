export const state = {
  view:          'image',     // 'image' | 'box' | 'vector' | 'custom'
  machine:       'creality-falcon5w',
  material:      'wood',
  color:         'medium',
  mode:          'engrave',   // 'engrave' | 'cut' | 'vector'
  thickness:     '3mm',       // '3mm' | '6mm'
  contrast:      1.2,
  brightness:    0,
  threshold:     128,
  edgeThreshold: 20,
  dither:        true,
  invert:        false,
  originalSrc:   null,
  processedSrc:  null,
  svgSrc:        null,
  activeTab:     'original',
  outputWidth:   0,
  outputHeight:  0,
  pathCount:     0,
}

const machineListeners = []

export function onMachineChange(listener) {
  machineListeners.push(listener)
}

export function setMachine(key) {
  state.machine = key
  machineListeners.forEach(listener => listener(key))
}
