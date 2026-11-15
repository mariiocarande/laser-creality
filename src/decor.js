// Engraved decorations for box lids and fronts. Pure functions that return
// SVG markup in "outside view" coordinates: x to the right, y down, as the
// face is seen from outside the assembled box. boxTool turns them for the
// laser bed and the 3D view.
//
// Fills (#000) engrave as areas; thin strokes engrave as single lines.

import { textBlock, textMarkup } from './textPaths.js'

const LINE = 0.35   // mm, single-pass line width
const f = n => Number(n.toFixed(2)).toString()

export const DESIGNS = [
  { id: 'none', label: 'Sin diseño' },
  { id: 'title', label: 'Título' },
  { id: 'leaves', label: 'Botánico' },
  { id: 'mandala', label: 'Mandala' },
  { id: 'deco', label: 'Art déco' },
  { id: 'labels', label: 'Etiquetas' },
  { id: 'window', label: 'Ventana' },
]

const line = d => `<path fill="none" stroke="#000000" stroke-width="${LINE}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`
const fill = d => `<path fill="#000000" d="${d}"/>`

function roundRect(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  return `M${f(x + rr)} ${f(y)}H${f(x + w - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}V${f(y + h - rr)}` +
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}H${f(x + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}` +
    `V${f(y + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}Z`
}

function circle(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
}

// Almond leaf from (x, y) pointing at `angle`, length `len`.
function leaf(x, y, angle, len, width = 0.38) {
  const c = Math.cos(angle), s = Math.sin(angle)
  const tip = [x + c * len, y + s * len]
  const half = len * width / 2
  const nx = -s * half, ny = c * half
  const m = [x + c * len * 0.5, y + s * len * 0.5]
  return `M${f(x)} ${f(y)}Q${f(m[0] + nx * 1.9)} ${f(m[1] + ny * 1.9)} ${f(tip[0])} ${f(tip[1])}` +
    `Q${f(m[0] - nx * 1.9)} ${f(m[1] - ny * 1.9)} ${f(x)} ${f(y)}Z`
}

// A curved sprig with alternating leaves.
function sprig(x, y, len, angle, bend, count) {
  const c = Math.cos(angle), s = Math.sin(angle)
  const end = [x + c * len, y + s * len]
  const ctrl = [x + c * len * 0.5 - s * bend, y + s * len * 0.5 + c * bend]
  let out = line(`M${f(x)} ${f(y)}Q${f(ctrl[0])} ${f(ctrl[1])} ${f(end[0])} ${f(end[1])}`)
  let leaves = ''
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1)
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrl[0] + t * t * end[0]
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * ctrl[1] + t * t * end[1]
    const side = i % 2 ? 1 : -1
    const size = len * (0.24 - 0.1 * t)
    leaves += leaf(px, py, angle + side * 0.85, size)
  }
  leaves += leaf(end[0], end[1], angle, len * 0.2)
  return out + fill(leaves)
}

function mandala(cx, cy, R) {
  let fills = '', lines = ''
  fills += circle(cx, cy, R * 0.07)
  lines += circle(cx, cy, R * 0.14)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    fills += leaf(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16, a, R * 0.3, 0.55)
  }
  lines += circle(cx, cy, R * 0.52)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16
    const x = cx + Math.cos(a) * R * 0.53, y = cy + Math.sin(a) * R * 0.53
    lines += leaf(x, y, a, R * 0.3, 0.6)
    fills += circle(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66, R * 0.025)
  }
  lines += circle(cx, cy, R * 0.86)
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    fills += circle(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93, R * 0.03)
  }
  return fill(fills) + line(lines)
}

function decoBand(x, y, w, h, band) {
  let lines = roundRect(x, y, w, h, 1.5) + roundRect(x + band, y + band, w - 2 * band, h - 2 * band, 1)
  let fills = ''
  const zig = (ax, ay, bx, by, nx, ny) => {
    const length = Math.hypot(bx - ax, by - ay)
    const n = Math.max(2, Math.round(length / (band * 1.4)))
    let d = `M${f(ax + nx * band * 0.25)} ${f(ay + ny * band * 0.25)}`
    for (let i = 1; i <= n; i++) {
      const t = i / n, k = i % 2 ? 0.75 : 0.25
      d += `L${f(ax + (bx - ax) * t + nx * band * k)} ${f(ay + (by - ay) * t + ny * band * k)}`
    }
    return d
  }
  lines += zig(x + band, y, x + w - band, y, 0, 1) + zig(x + band, y + h - band, x + w - band, y + h - band, 0, 1)
  lines += zig(x, y + band, x, y + h - band, 1, 0) + zig(x + w - band, y + band, x + w - band, y + h - band, 1, 0)
  ;[[x, y], [x + w - band, y], [x, y + h - band], [x + w - band, y + h - band]].forEach(([cx, cy]) => {
    const m = band / 2
    fills += `M${f(cx + m)} ${f(cy + m * 0.2)}L${f(cx + band - m * 0.2)} ${f(cy + m)}L${f(cx + m)} ${f(cy + band - m * 0.2)}L${f(cx + m * 0.2)} ${f(cy + m)}Z`
  })
  return line(lines) + fill(fills)
}

function centeredText(font, text, cx, cy, maxW, maxH) {
  if (!font || !text) return { markup: '', h: 0 }
  // Lay out large, then shrink to the box: textBlock only ever scales down.
  const t = textBlock(font, text, 200, maxW, maxH)
  if (!t) return { markup: '', h: 0 }
  return { markup: textMarkup(t, cx - t.w / 2, cy - t.h / 2), h: t.h, w: t.w }
}

// area: { x, y, w, h } free area in outside coords (mm)
// opts: { design, title, subtitle, labels: string[], cols, rows, font, subFont, window }
export function lidDecoration(area, opts) {
  const { x, y, w, h } = area
  const cx = x + w / 2, cy = y + h / 2
  const m = Math.min(w, h)
  const title = (opts.title || '').trim()
  const sub = (opts.subtitle || '').trim()
  let out = ''

  // Title and subtitle stacked and centred as one block inside (tw × th).
  const titleBlock = (tcx, tcy, tw, th) => {
    const mainBox = textBlock(opts.font, title || ' ', 200, tw, th * (sub ? 0.62 : 0.85))
    const subBox = sub ? textBlock(opts.subFont, sub, 200, tw * 0.85, th * 0.17) : null
    const mainH = title && mainBox ? mainBox.h : 0
    const gap = mainH && subBox ? th * 0.08 : 0
    let yy = tcy - (mainH + gap + (subBox ? subBox.h : 0)) / 2
    let out = ''
    if (title && mainBox) { out += textMarkup(mainBox, tcx - mainBox.w / 2, yy); yy += mainH + gap }
    if (subBox) out += textMarkup(subBox, tcx - subBox.w / 2, yy)
    return out
  }

  switch (opts.design) {
    case 'title': {
      out += line(roundRect(x, y, w, h, m * 0.06) + roundRect(x + m * 0.035, y + m * 0.035, w - m * 0.07, h - m * 0.07, m * 0.045))
      out += sprig(cx - w * 0.12, y + h * 0.2, w * 0.24, 0, -m * 0.03, 4)
      out += titleBlock(cx, cy + h * 0.06, w * 0.78, h * 0.5)
      break
    }
    case 'leaves': {
      out += sprig(x + w * 0.04, y + h * 0.96, m * 0.62, -Math.PI / 3.2, m * 0.08, 7)
      out += sprig(x + w * 0.96, y + h * 0.04, m * 0.5, Math.PI - Math.PI / 3.6, m * 0.06, 5)
      out += sprig(x + w * 0.1, y + h * 0.06, m * 0.32, Math.PI / 5, -m * 0.04, 3)
      out += titleBlock(cx, cy, w * 0.62, h * 0.46)
      break
    }
    case 'mandala': {
      const R = m * (title ? 0.36 : 0.46)
      const my = title ? y + h * 0.42 : cy
      out += mandala(cx, my, R)
      if (title) out += centeredText(opts.font, title, cx, Math.min(y + h - m * 0.08, my + R + (h - (my + R - y)) / 2), w * 0.7, Math.min(m * 0.14, h - (my + R - y) - 2)).markup
      break
    }
    case 'deco': {
      const band = Math.max(5, m * 0.09)
      out += decoBand(x, y, w, h, band)
      const inner = { w: w - 2 * band - m * 0.1, h: h - 2 * band - m * 0.1 }
      out += line(roundRect(cx - inner.w * 0.4, cy - inner.h * 0.32, inner.w * 0.8, inner.h * 0.64, 2))
      out += titleBlock(cx, cy, inner.w * 0.72, inner.h * 0.58)
      break
    }
    case 'labels': {
      const cols = Math.max(1, opts.cols || 1), rows = Math.max(1, opts.rows || 1)
      out += line(roundRect(x, y, w, h, 2))
      let grid = ''
      for (let i = 1; i < cols; i++) grid += `M${f(x + (w * i) / cols)} ${f(y + 2)}V${f(y + h - 2)}`
      for (let j = 1; j < rows; j++) grid += `M${f(x + 2)} ${f(y + (h * j) / rows)}H${f(x + w - 2)}`
      out += line(grid)
      // One size for every label so the grid reads evenly.
      const names = (opts.labels || []).slice(0, cols * rows)
      const labelFont = opts.subFont || opts.font
      const cw = w / cols, ch = h / rows
      const fits = names.map(name => textBlock(labelFont, name, 200, cw * 0.8, Math.min(ch * 0.32, 9))).filter(Boolean)
      const size = fits.length ? 200 * Math.min(...fits.map(b => b.scale)) : 0
      names.forEach((name, k) => {
        const block = size && textBlock(labelFont, name, size)
        if (!block) return
        const i = k % cols, j = Math.floor(k / cols)
        out += textMarkup(block, x + cw * (i + 0.5) - block.w / 2, y + ch * (j + 0.5) - block.h / 2)
      })
      break
    }
    case 'window': {
      if (opts.window) {
        const wr = opts.window
        out += line(roundRect(wr.x - 3, wr.y - 3, wr.w + 6, wr.h + 6, 2))
        const below = y + h - (wr.y + wr.h + 3)
        if (title && below > 8) out += centeredText(opts.font, title, cx, wr.y + wr.h + 3 + below / 2, w * 0.7, Math.min(below * 0.6, m * 0.14)).markup
      }
      break
    }
    default:
      break
  }
  return out
}

// Short text across the front, flanked by two small sprigs.
export function frontDecoration(area, text, font) {
  const t = (text || '').trim()
  if (!t || !font) return ''
  const { x, y, w, h } = area
  const block = textBlock(font, t, 200, w * 0.55, Math.min(h * 0.42, 22))
  if (!block) return ''
  const cx = x + w / 2, cy = y + h / 2
  let out = textMarkup(block, cx - block.w / 2, cy - block.h / 2)
  const gap = 4, len = Math.min(w * 0.18, (w - block.w) / 2 - gap - 2)
  if (len > 6) {
    out += sprig(cx - block.w / 2 - gap, cy, len, Math.PI, 0, 2)
    out += sprig(cx + block.w / 2 + gap, cy, len, 0, 0, 2)
  }
  return out
}
