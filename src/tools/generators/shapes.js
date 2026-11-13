// Exact SVG outlines for the simple shapes the generators cut.

const f = n => Number(n.toFixed(3)).toString()

export function roundedRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (!rr) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`
  return `M${f(x + rr)} ${f(y)}H${f(x + w - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}` +
    `V${f(y + h - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}` +
    `H${f(x + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}` +
    `V${f(y + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}Z`
}

export function circlePath(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`
}

export function cut(d) {
  return `<path d="${d}"/>`
}

export function scoreLine(d, width) {
  return `<path fill="none" stroke="#000000" stroke-width="${width}" stroke-linecap="round" d="${d}"/>`
}

export function names(text, max = 60) {
  return text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, max)
}
