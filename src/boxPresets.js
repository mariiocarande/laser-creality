// Ready-made box configurations. Sizes are interior millimetres, chosen for
// 3 mm stock so every panel fits a 400 × 400 mm diode-laser work area.

export const BOX_PRESETS = [
  { id: 'cards',     icon: '🃏', name: 'Mazo de cartas',     width: 68,  depth: 94,  height: 22,  lid: 'slide' },
  { id: 'sd',        icon: '💾', name: 'Pendrives y SD',     width: 120, depth: 70,  height: 22,  lid: 'slide', cols: 3 },
  { id: 'domino',    icon: '🁫', name: 'Dominó',             width: 200, depth: 60,  height: 32,  lid: 'slide' },
  { id: 'jewelry',   icon: '💍', name: 'Joyero',             width: 180, depth: 120, height: 45,  lid: 'hinge', cols: 3, rows: 2 },
  { id: 'tea',       icon: '🍵', name: 'Caja de té',         width: 230, depth: 150, height: 70,  lid: 'hinge', cols: 3, rows: 2 },
  { id: 'keepsake',  icon: '📸', name: 'Caja de recuerdos',  width: 250, depth: 180, height: 90,  lid: 'hinge' },
  { id: 'gift-s',    icon: '🎁', name: 'Regalo chico',       width: 100, depth: 100, height: 60,  lid: 'lift' },
  { id: 'gift-m',    icon: '🎁', name: 'Regalo mediano',     width: 180, depth: 130, height: 80,  lid: 'lift' },
  { id: 'coasters',  icon: '🍺', name: 'Posavasos',          width: 104, depth: 104, height: 35,  lid: 'open' },
  { id: 'pens',      icon: '✏️', name: 'Lapicero',           width: 80,  depth: 80,  height: 100, lid: 'open' },
  { id: 'desk',      icon: '🗂', name: 'Organizador',        width: 240, depth: 160, height: 55,  lid: 'open', cols: 3, rows: 2 },
  { id: 'screws',    icon: '🔩', name: 'Tornillos y piezas', width: 220, depth: 150, height: 40,  lid: 'open', cols: 4, rows: 3 },
].map(preset => ({ thickness: 3, fingerWidth: 10, cols: 1, rows: 1, innerDims: true, ...preset }))

export const LID_LABELS = {
  open: 'Abierta',
  closed: 'Encastrada',
  lift: 'Suelta',
  slide: 'Corrediza',
  hinge: 'Bisagra',
}

// Fields of the box state that a preset (built-in or saved) carries.
export const PRESET_FIELDS = [
  'width', 'depth', 'height', 'innerDims', 'thickness', 'fingerWidth', 'lid', 'cols', 'rows',
]

const STORAGE_KEY = 'laser-studio:box-presets'
const MAX_SAVED = 12

export function loadSavedPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter(p => p && typeof p.name === 'string') : []
  } catch {
    return []
  }
}

// Returns false when the browser refuses to store (private mode, quota).
export function storeSavedPresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_SAVED)))
    return true
  } catch {
    return false
  }
}

export function describePreset(p) {
  // Kept compact on purpose: it has to fit a narrow preset button.
  const size = `${p.width}×${p.depth}×${p.height}`
  const cells = p.cols * p.rows > 1 ? ` · ${p.cols}×${p.rows}` : ''
  return `${size} · ${LID_LABELS[p.lid]}${cells}`
}
