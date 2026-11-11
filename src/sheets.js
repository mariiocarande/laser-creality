// Sheet layout, SVG building and download helpers shared by the generators.
// Units are millimetres; sheets match the selected machine's work area.

export const SHEET_MARGIN = 5
export const PART_GAP = 3

const CUT_COLOR = '#ff0000'
const EXPORT_STROKE = 0.1
const PREVIEW_STROKE = 0.6

const fmt = n => Number(n.toFixed(3)).toString()

export function pointsToPath(points) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`).join(' ') + ' Z'
}

export function rotatePoints(points, h) {
  return points.map(([x, y]) => [h - y, x])
}

export function rotateHoles(holes, h) {
  return holes.map(({ cx, cy, r }) => ({ cx: h - cy, cy: cx, r }))
}

export function holesToMarkup(holes) {
  return holes.map(h => `<circle cx="${fmt(h.cx)}" cy="${fmt(h.cy)}" r="${fmt(h.r)}"/>`).join('')
}

// Shelf packing. items: [{ w, h, ... }]
// Returns { sheets: [[{ item, x, y, rotated }]], oversize: [item] }
export function packSheets(items, sheetW, sheetH, { allowRotate = true } = {}) {
  const usableW = sheetW - 2 * SHEET_MARGIN
  const usableH = sheetH - 2 * SHEET_MARGIN
  const oversize = []

  const oriented = []
  items.forEach(item => {
    const fits      = item.w <= usableW && item.h <= usableH
    const fitsTurned = allowRotate && item.h <= usableW && item.w <= usableH
    if (!fits && !fitsTurned) { oversize.push(item); return }
    // Prefer the landscape orientation so shelves stay short.
    const rotated = fitsTurned && (!fits || item.h > item.w)
    oriented.push({ item, rotated, w: rotated ? item.h : item.w, h: rotated ? item.w : item.h })
  })

  oriented.sort((a, b) => b.h - a.h)

  const sheets = []
  let sheet = null
  let x = 0, y = 0, shelfH = 0

  const newSheet = () => { sheet = []; sheets.push(sheet); x = 0; y = 0; shelfH = 0 }

  oriented.forEach(o => {
    if (!sheet) newSheet()
    if (x > 0 && x + o.w > usableW) { x = 0; y += shelfH + PART_GAP; shelfH = 0 }
    if (y + o.h > usableH) newSheet()
    sheet.push({ item: o.item, rotated: o.rotated, w: o.w, h: o.h, x: x + SHEET_MARGIN, y: y + SHEET_MARGIN })
    x += o.w + PART_GAP
    shelfH = Math.max(shelfH, o.h)
  })

  return { sheets, oversize }
}

const escapeXml = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

// placements: [{ x, y, w, h, cut, engrave, label }]
//   cut     → SVG markup drawn with the cut stroke (red hairline)
//   engrave → SVG markup that carries its own fill
export function buildSheetSvg(placements, sheetW, sheetH, { preview = false, previewStroke = PREVIEW_STROKE } = {}) {
  const stroke = preview ? previewStroke : EXPORT_STROKE

  const body = placements.map(p => {
    const label = preview && p.label
      ? `<text x="${fmt(p.w / 2)}" y="${fmt(p.h / 2)}" font-family="sans-serif" font-size="${fmt(Math.min(9, p.w / 8, p.h * 0.7))}" fill="#7a5a30" text-anchor="middle" dominant-baseline="middle">${escapeXml(p.label)}</text>`
      : ''
    return [
      `  <g transform="translate(${fmt(p.x)},${fmt(p.y)})">`,
      p.engrave ? `    <g>${p.engrave}</g>` : '',
      p.cut ? `    <g fill="none" stroke="${CUT_COLOR}" stroke-width="${stroke}" stroke-linejoin="round">${p.cut}</g>` : '',
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

let previewUrls = new WeakMap()

// Renders each sheet as an <img> so uploaded SVG content can never run scripts.
export function renderSheetPreviews(container, sheetSvgs) {
  ;(previewUrls.get(container) || []).forEach(url => URL.revokeObjectURL(url))
  container.innerHTML = ''

  const urls = sheetSvgs.map((svg, i) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const figure = document.createElement('figure')
    figure.className = 'sheet'
    const img = document.createElement('img')
    img.src = url
    img.alt = `Plancha ${i + 1}`
    figure.appendChild(img)
    if (sheetSvgs.length > 1) {
      const caption = document.createElement('figcaption')
      caption.textContent = `Plancha ${i + 1} de ${sheetSvgs.length}`
      figure.appendChild(caption)
    }
    container.appendChild(figure)
    return url
  })
  previewUrls.set(container, urls)
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
