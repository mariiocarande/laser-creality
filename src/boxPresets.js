// Ready-made box configurations. Sizes are interior millimetres, chosen for
// 3 mm stock so every panel fits a 400 × 400 mm diode-laser work area.

const TEA_NAMES = 'Verde\nNegro\nRojo\nManzanilla\nMenta\nFrutal\nBoldo\nTilo\nJengibre'

export const PRESET_GROUPS = ['Cajas de té', 'Regalos', 'Organización', 'Cajones y macetas']

export const BOX_PRESETS = [
  // ── Cajas de té ──
  { id: 'tea-window', group: 'Cajas de té', icon: '🪟', name: 'Té con ventana', width: 210, depth: 140, height: 70, lid: 'lift', cols: 3, rows: 2,
    decor: { design: 'window', title: 'Té', font: 'pacifico', front: 'Tea Time' } },
  { id: 'tea', group: 'Cajas de té', icon: '🍃', name: 'Té botánico', width: 230, depth: 150, height: 70, lid: 'hinge', cols: 3, rows: 2,
    decor: { design: 'leaves', title: 'Té', subtitle: 'Hebras seleccionadas', font: 'pacifico' } },
  { id: 'tea-mandala', group: 'Cajas de té', icon: '🌸', name: 'Té mandala', width: 160, depth: 160, height: 65, lid: 'lift', cols: 2, rows: 2,
    decor: { design: 'mandala', title: 'Infusiones', font: 'pacifico' } },
  { id: 'tea-labels', group: 'Cajas de té', icon: '🏷', name: 'Té con etiquetas', width: 240, depth: 160, height: 70, lid: 'hinge', cols: 3, rows: 3,
    decor: { design: 'labels', labels: TEA_NAMES, font: 'dmsans' } },
  { id: 'tea-deco', group: 'Cajas de té', icon: '◆', name: 'Té art déco', width: 220, depth: 110, height: 60, lid: 'slide', cols: 4,
    decor: { design: 'deco', title: 'TEA', subtitle: 'TIME', font: 'bebas' } },
  { id: 'tea-dispenser', group: 'Cajas de té', icon: '▯', name: 'Dispensador de pared', width: 230, depth: 80, height: 260, lid: 'lift', cols: 4,
    orientation: 'vertical', wallMount: true, decor: { design: 'title', title: 'Té', font: 'pacifico', front: 'Tea Time' } },
  { id: 'tea-dispenser-s', group: 'Cajas de té', icon: '▯', name: 'Dispensador chico', width: 120, depth: 75, height: 200, lid: 'lift', cols: 2,
    orientation: 'vertical', decor: { design: 'leaves', title: 'Té', font: 'pacifico' } },
  { id: 'tea-wall', group: 'Cajas de té', icon: '🧱', name: 'Té horizontal de pared', width: 240, depth: 90, height: 120, lid: 'hinge', cols: 4, rows: 1,
    wallMount: true, decor: { design: 'labels', labels: 'Verde\nNegro\nFrutal\nHierbas', font: 'dmsans', front: 'Té' } },

  // ── Regalos ──
  { id: 'jewelry',   group: 'Regalos', icon: '💍', name: 'Joyero',            width: 180, depth: 120, height: 45, lid: 'hinge', cols: 3, rows: 2,
    decor: { design: 'title', title: 'Joyas', font: 'pacifico' } },
  { id: 'keepsake',  group: 'Regalos', icon: '📸', name: 'Caja de recuerdos', width: 250, depth: 180, height: 90, lid: 'hinge',
    decor: { design: 'leaves', title: 'Recuerdos', subtitle: '2026', font: 'pacifico' } },
  { id: 'gift-s',    group: 'Regalos', icon: '🎁', name: 'Regalo chico',      width: 100, depth: 100, height: 60, lid: 'lift' },
  { id: 'gift-m',    group: 'Regalos', icon: '🎁', name: 'Regalo mediano',    width: 180, depth: 130, height: 80, lid: 'lift',
    decor: { design: 'mandala' } },
  { id: 'cards',     group: 'Regalos', icon: '🃏', name: 'Mazo de cartas',    width: 68,  depth: 94,  height: 22, lid: 'slide' },
  { id: 'domino',    group: 'Regalos', icon: '🁫', name: 'Dominó',            width: 200, depth: 60,  height: 32, lid: 'slide',
    decor: { design: 'deco', title: 'DOMINÓ', font: 'bebas' } },

  // ── Organización ──
  { id: 'desk',      group: 'Organización', icon: '🗂', name: 'Organizador',        width: 240, depth: 160, height: 55, lid: 'open', cols: 3, rows: 2 },
  { id: 'screws',    group: 'Organización', icon: '🔩', name: 'Tornillos y piezas', width: 220, depth: 150, height: 40, lid: 'open', cols: 4, rows: 3 },
  { id: 'sd',        group: 'Organización', icon: '💾', name: 'Pendrives y SD',     width: 120, depth: 70,  height: 22, lid: 'slide', cols: 3 },
  { id: 'pens',      group: 'Organización', icon: '✏️', name: 'Lapicero',           width: 80,  depth: 80,  height: 100, lid: 'open' },
  { id: 'coasters',  group: 'Organización', icon: '🍺', name: 'Posavasos',          width: 104, depth: 104, height: 35, lid: 'open' },
  { id: 'keys-wall', group: 'Organización', icon: '🔑', name: 'Llavero de pared',   width: 200, depth: 50, height: 70, lid: 'open', cols: 3, wallMount: true,
    decor: { front: 'Llaves' } },

  // ── Cajones y macetas ──
  { id: 'drawer-desk',  group: 'Cajones y macetas', icon: '🗄', name: 'Cajonera de escritorio', kind: 'drawer', width: 160, depth: 180, height: 70, lid: 'open', innerDims: false, cols: 2 },
  { id: 'drawer-cards', group: 'Cajones y macetas', icon: '📇', name: 'Cajón para tarjetas', kind: 'drawer', width: 110, depth: 150, height: 55, lid: 'open', innerDims: false },
  { id: 'planter-s',    group: 'Cajones y macetas', icon: '🪴', name: 'Maceta suculentas', kind: 'planter', width: 110, depth: 110, height: 90, lid: 'open', footHeight: 12 },
  { id: 'planter-herbs', group: 'Cajones y macetas', icon: '🌿', name: 'Jardinera de hierbas', kind: 'planter', width: 300, depth: 120, height: 110, lid: 'open', footHeight: 18 },
  { id: 'planter-wall', group: 'Cajones y macetas', icon: '🌱', name: 'Maceta de pared', kind: 'planter', width: 160, depth: 90, height: 100, lid: 'open', footHeight: 0, wallMount: true },
].map(preset => ({
  kind: 'box', thickness: 3, fingerWidth: 10, cols: 1, rows: 1, innerDims: true, clearance: 1, footHeight: 15,
  drainage: true, orientation: 'horizontal', wallMount: false, ...preset,
}))

export const LID_LABELS = {
  open: 'Abierta',
  closed: 'Encastrada',
  lift: 'Suelta',
  slide: 'Corrediza',
  hinge: 'Bisagra',
}

// Fields of the box state that a preset (built-in or saved) carries.
export const PRESET_FIELDS = [
  'kind', 'width', 'depth', 'height', 'innerDims', 'thickness', 'fingerWidth', 'lid', 'cols', 'rows',
  'clearance', 'footHeight', 'drainage', 'orientation', 'wallMount', 'decor',
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

const KIND_LABELS = { drawer: 'Cajón', planter: 'Maceta' }
const DESIGN_LABELS = { window: 'Ventana', leaves: 'Botánico', mandala: 'Mandala', labels: 'Etiquetas', deco: 'Déco', title: 'Título' }

export function describePreset(p) {
  // Kept compact on purpose: it has to fit a narrow preset button.
  const size = `${p.width}×${p.depth}×${p.height}`
  const cells = p.cols * p.rows > 1 ? ` · ${p.cols}×${p.rows}` : ''
  const kind = p.orientation === 'vertical' ? 'Vertical' : KIND_LABELS[p.kind] || LID_LABELS[p.lid]
  const design = p.decor && DESIGN_LABELS[p.decor.design] ? ` · ${DESIGN_LABELS[p.decor.design]}` : ''
  return `${size} · ${kind}${design}${cells}`
}
