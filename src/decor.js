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

const fillEO = d => `<path fill="#000000" fill-rule="evenodd" d="${d}"/>`

// Leaf with a central vein left unengraved (even-odd fill).
function veinedLeaf(x, y, angle, len, width = 0.4) {
  const c = Math.cos(angle), s = Math.sin(angle)
  const v = len * 0.035
  const nx = -s * v, ny = c * v
  const a = [x + c * len * 0.12, y + s * len * 0.12]
  const b = [x + c * len * 0.82, y + s * len * 0.82]
  const vein = `M${f(a[0] + nx)} ${f(a[1] + ny)}L${f(b[0])} ${f(b[1])}L${f(a[0] - nx)} ${f(a[1] - ny)}Z`
  // Own element: overlapping leaves must not cancel each other out.
  return fillEO(leaf(x, y, angle, len, width) + vein)
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
  let berries = ''
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1)
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrl[0] + t * t * end[0]
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * ctrl[1] + t * t * end[1]
    // Leaves in pairs, slightly offset, smaller toward the tip.
    const size = len * (0.26 - 0.12 * t)
    leaves += veinedLeaf(px, py, angle + 0.9, size) + veinedLeaf(px, py, angle - 0.9, size * 0.92)
    if (i % 2 === 0) berries += circle(px + Math.cos(angle + 0.4) * size * 0.35, py + Math.sin(angle + 0.4) * size * 0.35, len * 0.018)
  }
  leaves += veinedLeaf(end[0], end[1], angle, len * 0.22)
  return out + leaves + (berries ? fill(berries) : '')
}

// Small spiral curl, used for corner flourishes.
function curl(x, y, r, dir) {
  return `M${f(x)} ${f(y)}C${f(x + dir * r * 1.6)} ${f(y)} ${f(x + dir * r * 1.6)} ${f(y + r * 1.4)} ${f(x + dir * r * 0.8)} ${f(y + r * 1.4)}` +
    `C${f(x + dir * r * 0.2)} ${f(y + r * 1.4)} ${f(x + dir * r * 0.2)} ${f(y + r * 0.7)} ${f(x + dir * r * 0.7)} ${f(y + r * 0.75)}`
}

function cornerFlourishes(x, y, w, h, r) {
  let d = ''
  ;[[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    d += `M${f(cx + sx * r * 0.3)} ${f(cy + sy * r * 2.6)}Q${f(cx + sx * r * 0.3)} ${f(cy + sy * r * 0.3)} ${f(cx + sx * r * 2.6)} ${f(cy + sy * r * 0.3)}`
    const ex = cx + sx * r * 0.9, ey = cy + sy * r * 0.9
    d += `M${f(ex)} ${f(ey)}L${f(ex + sx * r * 0.9)} ${f(ey + sy * r * 0.9)}`
  })
  return d
}

function mandala(cx, cy, R) {
  let fills = '', eo = '', lines = ''
  const polar = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  // Centre: dot, ring of tiny dots, 8 veined petals.
  fills += circle(cx, cy, R * 0.06)
  for (let i = 0; i < 12; i++) { const [x, y] = polar((i / 12) * Math.PI * 2, R * 0.1); fills += circle(x, y, R * 0.012) }
  lines += circle(cx, cy, R * 0.135)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const [x, y] = polar(a, R * 0.14)
    eo += veinedLeaf(x, y, a, R * 0.27, 0.55)
  }
  // Ring 2: 16 outlined petals, each with a dot, alternating small teardrops.
  lines += circle(cx, cy, R * 0.44)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16
    const [x, y] = polar(a, R * 0.45)
    lines += leaf(x, y, a, R * 0.26, 0.62)
    const [dx, dy] = polar(a, R * 0.58)
    fills += circle(dx, dy, R * 0.016)
    const b = (i / 16) * Math.PI * 2
    const [tx, ty] = polar(b, R * 0.45)
    fills += leaf(tx, ty, b, R * 0.11, 0.6)
  }
  // Ring 3: scalloped band with dots in each scallop.
  lines += circle(cx, cy, R * 0.74)
  let scallop = ''
  const n = 24
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2
    const [x0, y0] = polar(a0, R * 0.74), [x1, y1] = polar(a1, R * 0.74), [xm, ym] = polar(am, R * 0.9)
    scallop += `${i ? 'Q' : `M${f(x0)} ${f(y0)}Q`}${f(xm)} ${f(ym)} ${f(x1)} ${f(y1)}`
    const [dx, dy] = polar(am, R * 0.8)
    fills += circle(dx, dy, R * 0.02)
  }
  lines += scallop
  // Outer dotted ring.
  for (let i = 0; i < 48; i++) { const [x, y] = polar((i / 48) * Math.PI * 2, R * 0.96); fills += circle(x, y, R * (i % 2 ? 0.012 : 0.02)) }
  return fill(fills) + eo + line(lines)
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
      out += line(cornerFlourishes(x + m * 0.06, y + m * 0.06, w - m * 0.12, h - m * 0.12, m * 0.05))
      out += sprig(cx - w * 0.14, y + h * 0.2, w * 0.28, 0, -m * 0.03, 4)
      out += titleBlock(cx, cy + h * 0.04, w * 0.74, h * 0.46)
      out += line(`M${f(cx - w * 0.22)} ${f(y + h * 0.8)}Q${f(cx)} ${f(y + h * 0.86)} ${f(cx + w * 0.22)} ${f(y + h * 0.8)}`) +
        fill(circle(cx, y + h * 0.83, m * 0.012) + circle(cx - w * 0.22, y + h * 0.8, m * 0.01) + circle(cx + w * 0.22, y + h * 0.8, m * 0.01))
      break
    }
    case 'leaves': {
      out += sprig(x + w * 0.04, y + h * 0.96, m * 0.62, -Math.PI / 3.2, m * 0.08, 7)
      out += sprig(x + w * 0.96, y + h * 0.04, m * 0.5, Math.PI - Math.PI / 3.6, m * 0.06, 5)
      out += sprig(x + w * 0.1, y + h * 0.06, m * 0.32, Math.PI / 5, -m * 0.04, 3)
      out += sprig(x + w * 0.9, y + h * 0.94, m * 0.3, -Math.PI + Math.PI / 5, -m * 0.04, 3)
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
      // Sunburst fans in the four inner corners.
      let rays = ''
      const fanR = Math.min(inner.w, inner.h) * 0.26
      ;[[x + band, y + band, 0], [x + w - band, y + band, Math.PI / 2], [x + w - band, y + h - band, Math.PI], [x + band, y + h - band, Math.PI * 1.5]].forEach(([fx, fy, a0]) => {
        for (let i = 0; i <= 6; i++) {
          const a = a0 + (i / 6) * (Math.PI / 2)
          rays += `M${f(fx + Math.cos(a) * fanR * 0.25)} ${f(fy + Math.sin(a) * fanR * 0.25)}L${f(fx + Math.cos(a) * fanR)} ${f(fy + Math.sin(a) * fanR)}`
        }
        rays += `M${f(fx + Math.cos(a0) * fanR)} ${f(fy + Math.sin(a0) * fanR)}A${f(fanR)} ${f(fanR)} 0 0 1 ${f(fx + Math.cos(a0 + Math.PI / 2) * fanR)} ${f(fy + Math.sin(a0 + Math.PI / 2) * fanR)}`
      })
      out += line(rays)
      // Plaque with stepped corners, doubled.
      const pw = inner.w * 0.62, ph = inner.h * 0.6, st = Math.min(pw, ph) * 0.08
      const stepped = (px, py, qw, qh, k) => `M${f(px + k)} ${f(py)}H${f(px + qw - k)}V${f(py + k)}H${f(px + qw)}V${f(py + qh - k)}H${f(px + qw - k)}V${f(py + qh)}H${f(px + k)}V${f(py + qh - k)}H${f(px)}V${f(py + k)}H${f(px + k)}Z`
      out += line(stepped(cx - pw / 2, cy - ph / 2, pw, ph, st) + stepped(cx - pw / 2 + 2, cy - ph / 2 + 2, pw - 4, ph - 4, st))
      out += titleBlock(cx, cy, pw * 0.82, ph * 0.72)
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
