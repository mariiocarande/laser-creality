import { packSheets, buildSheetSvg, renderSheetPreviews } from '../../sheets.js'
import { MACHINES } from '../../machines.js'
import { state } from '../../state.js'

// Lays pieces out on sheets the size of the selected machine and renders
// the previews. pieces: [{ w, h, cut, engrave, label? }]
export function showPieces(refs, pieces, { allowRotate = false } = {}) {
  const machine = MACHINES[state.machine]
  const { sheets, oversize } = packSheets(pieces, machine.area.w, machine.area.h, { allowRotate })
  const placements = sheets.map(sheet => sheet.map(p => ({
    x: p.x, y: p.y, w: p.w, h: p.h, cut: p.item.cut, engrave: p.item.engrave,
  })))
  const svgs = placements.map(pl => buildSheetSvg(pl, machine.area.w, machine.area.h))
  renderSheetPreviews(refs.preview, placements.map(pl =>
    buildSheetSvg(pl, machine.area.w, machine.area.h, { preview: true, previewStroke: 0.6 })))
  return { svgs, sheets, oversize, machine }
}

export const SCORE_STROKE = 0.25   // mm, black lines the laser engraves as a single pass

export function fontFieldOptions(fonts) {
  return Object.entries(fonts).map(([key, f]) => [key, f.label])
}
