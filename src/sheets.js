import { renderSheetViewer } from './sheetViewer.js'

// Sheet layout, SVG building and download helpers shared by the generators.
// Units are millimetres; sheets match the selected machine's work area.

export const SHEET_MARGIN = 5
export const PART_GAP = 3

const CUT_COLOR = '#ff0000'
const EXPORT_STROKE = 0.1
const PREVIEW_STROKE_PX = 1.4

const fmt = n => Number(n.toFixed(3)).toString()

export function pointsToPath(points) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`).join(' ') + ' Z'
}

export function rotatePoints(points, h) {
  return points.map(([x, y]) => [h - y, x])
}

export function rotateHoles(holes, h) {
  return holes.map(hole => {
    if (hole.poly) return { poly: hole.poly.map(([x, y]) => [h - y, x]) }
    return hole.rect
      ? { rect: true, x: h - hole.y - hole.h, y: hole.x, w: hole.h, h: hole.w }
      : { cx: h - hole.cy, cy: hole.cx, r: hole.r }
  })
}

export function holesToMarkup(holes) {
  return holes.map(h => {
    if (h.poly) return `<path d="${pointsToPath(h.poly)}"/>`
    return h.rect
      ? `<rect x="${fmt(h.x)}" y="${fmt(h.y)}" width="${fmt(h.w)}" height="${fmt(h.h)}"/>`
      : `<circle cx="${fmt(h.cx)}" cy="${fmt(h.cy)}" r="${fmt(h.r)}"/>`
  }).join('')
}

// Shelf packing with first fit across every open shelf and sheet.
// items: [{ w, h, ... }]
// Returns { sheets: [[{ item, x, y, w, h, rotated }]], oversize: [item] }
export function packSheets(items, sheetW, sheetH, { allowRotate = true } = {}) {
  const usableW = sheetW - 2 * SHEET_MARGIN
  const usableH = sheetH - 2 * SHEET_MARGIN
  const oversize = []
  const sheets = []   // { shelves: [{ y, h, x }], used: number, placed: [] }

  const orientations = item => {
    const list = [{ w: item.w, h: item.h, rotated: false }]
    if (allowRotate && Math.abs(item.w - item.h) > 1e-6) list.push({ w: item.h, h: item.w, rotated: true })
    return list.filter(o => o.w <= usableW && o.h <= usableH)
  }

  const order = items.slice().sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h)

  order.forEach(item => {
    const options = orientations(item)
    if (!options.length) { oversize.push(item); return }

    // 1. An existing shelf with room, least wasted height first.
    let best = null
    sheets.forEach((sheet, si) => sheet.shelves.forEach(shelf => options.forEach(o => {
      if (shelf.x + o.w > usableW || o.h > shelf.h) return
      const waste = shelf.h - o.h
      if (!best || waste < best.waste - 1e-6 || (Math.abs(waste - best.waste) < 1e-6 && si < best.si)) {
        best = { sheet, shelf, o, waste, si }
      }
    })))
    if (best) {
      place(best.sheet, best.shelf, best.o, item)
      return
    }

    // 2. A new shelf on an existing sheet: the flattest orientation that fits.
    const flat = options.slice().sort((a, b) => a.h - b.h)
    for (const sheet of sheets) {
      const y = sheet.used ? sheet.used + PART_GAP : 0
      const o = flat.find(c => y + c.h <= usableH)
      if (o) {
        const shelf = { y, h: o.h, x: 0 }
        sheet.shelves.push(shelf)
        sheet.used = y + o.h
        place(sheet, shelf, o, item)
        return
      }
    }

    // 3. A new sheet.
    const sheet = { shelves: [], used: 0, placed: [] }
    sheets.push(sheet)
    const o = flat[0]
    const shelf = { y: 0, h: o.h, x: 0 }
    sheet.shelves.push(shelf)
    sheet.used = o.h
    place(sheet, shelf, o, item)
  })

  function place(sheet, shelf, o, item) {
    sheet.placed.push({ item, rotated: o.rotated, w: o.w, h: o.h, x: shelf.x + SHEET_MARGIN, y: shelf.y + SHEET_MARGIN })
    shelf.x += o.w + PART_GAP
  }

  return { sheets: sheets.map(s => s.placed), oversize }
}

const escapeXml = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

// placements: [{ x, y, w, h, cut, engrave, label }]
//   cut     → SVG markup drawn with the cut stroke (red hairline)
//   engrave → SVG markup that carries its own fill
export function buildSheetSvg(placements, sheetW, sheetH, { preview = false } = {}) {
  // Preview strokes stay a constant width on screen at any zoom (see sheetViewer).
  const stroke = preview ? PREVIEW_STROKE_PX : EXPORT_STROKE

  const body = placements.map(p => {
    const label = preview && p.label
      ? `<text class="layer-label" x="${fmt(p.w / 2)}" y="${fmt(p.h / 2)}" font-family="sans-serif" font-size="${fmt(Math.min(9, p.w / 8, p.h * 0.7))}" fill="#7a5a30" fill-opacity="0.85" text-anchor="middle" dominant-baseline="middle">${escapeXml(p.label)}</text>`
      : ''
    return [
      `  <g transform="translate(${fmt(p.x)},${fmt(p.y)})">`,
      p.engrave ? `    <g class="layer-engrave">${p.engrave}</g>` : '',
      p.cut ? `    <g class="layer-cut" fill="none" stroke="${CUT_COLOR}" stroke-width="${stroke}" stroke-linejoin="round">${p.cut}</g>` : '',
      label,
      '  </g>',
    ].filter(Boolean).join('\n')
  }).join('\n')

  const background = preview
    ? `  <rect width="${sheetW}" height="${sheetH}" fill="#e8d0a0"/>\n`
    : ''

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">`,
    background + body,
    '</svg>',
  ].join('\n')
}

// Renders the sheets in the interactive viewer (zoom, rulers, layers).
// options.pieces: per sheet, [{ x, y, w, h, label }] for names on hover.
export function renderSheetPreviews(container, sheetSvgs, options) {
  renderSheetViewer(container, sheetSvgs, options)
}

export function downloadSvgs(sheetSvgs, baseName) {
  sheetSvgs.forEach((svg, i) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.download = sheetSvgs.length > 1 ? `${baseName}_plancha${i + 1}.svg` : `${baseName}.svg`
    a.href = url
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
