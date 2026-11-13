// Halftone patterns as real vector shapes. Pure functions, no DOM.
// All units are millimetres; `sample(x, y)` returns darkness 0..1.

const fmt = n => Number(n.toFixed(2)).toString()

export const MAX_HALFTONE_CELLS = 150000

// Tone curve applied to a 0..1 luminance before it becomes darkness.
export function toneToDarkness(lum, { brightness, contrast, gamma, invert }) {
  let v = (lum - 0.5) * (1 + contrast) + 0.5 + brightness
  v = Math.min(1, Math.max(0, v))
  v = Math.pow(v, gamma)
  return invert ? v : 1 - v
}

// Bilinear sampler over a gray buffer mapped onto a width × height mm area.
export function makeSampler(gray, w, h, widthMm, heightMm, tone) {
  return (x, y) => {
    const u = Math.min(w - 1, Math.max(0, (x / widthMm) * w - 0.5))
    const v = Math.min(h - 1, Math.max(0, (y / heightMm) * h - 0.5))
    const x0 = Math.floor(u), y0 = Math.floor(v)
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
    const fx = u - x0, fy = v - y0
    const top = gray[y0 * w + x0] * (1 - fx) + gray[y0 * w + x1] * fx
    const bottom = gray[y1 * w + x0] * (1 - fx) + gray[y1 * w + x1] * fx
    return toneToDarkness(top * (1 - fy) + bottom * fy, tone)
  }
}

export function estimateCells(widthMm, heightMm, cell) {
  return Math.ceil((widthMm * heightMm) / (cell * cell))
}

// options: { width, height, cell, angle (deg), pattern: 'dots'|'squares'|'lines', scale, minSize }
// Returns { d (path data), count }.
export function halftonePath(sample, options) {
  const { width: W, height: H, cell: s, pattern, scale, minSize } = options
  const a = (options.angle * Math.PI) / 180
  const e1 = [Math.cos(a), Math.sin(a)]
  const e2 = [-Math.sin(a), Math.cos(a)]
  const cx = W / 2, cy = H / 2
  const n = Math.ceil(Math.hypot(W, H) / 2 / s) + 1
  const inside = (x, y) => x >= 0 && y >= 0 && x <= W && y <= H
  const parts = []

  if (pattern === 'lines') {
    const step = s / 2
    const m = Math.ceil(Math.hypot(W, H) / 2 / step) + 1
    for (let j = -n; j <= n; j++) {
      let run = []
      const flush = () => {
        if (run.length === 1) {
          const [x, y, t] = run[0]
          run = [[x - e1[0] * step / 2, y - e1[1] * step / 2, t], [x + e1[0] * step / 2, y + e1[1] * step / 2, t]]
        }
        if (run.length >= 2) {
          const up = run.map(([x, y, t]) => [x + e2[0] * t / 2, y + e2[1] * t / 2])
          const down = run.map(([x, y, t]) => [x - e2[0] * t / 2, y - e2[1] * t / 2]).reverse()
          parts.push('M' + [...up, ...down].map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + 'Z')
        }
        run = []
      }
      for (let i = -m; i <= m; i++) {
        const x = cx + e1[0] * i * step + e2[0] * j * s
        const y = cy + e1[1] * i * step + e2[1] * j * s
        if (!inside(x, y)) { flush(); continue }
        const t = Math.min(s, s * sample(x, y) * scale)
        if (t < minSize) { flush(); continue }
        run.push([x, y, t])
      }
      flush()
    }
    return { d: parts.join(''), count: parts.length }
  }

  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const x = cx + (e1[0] * i + e2[0] * j) * s
      const y = cy + (e1[1] * i + e2[1] * j) * s
      if (!inside(x, y)) continue
      const size = s * Math.sqrt(sample(x, y)) * scale   // area follows darkness
      if (size < minSize) continue

      if (pattern === 'squares') {
        const h1 = [e1[0] * size / 2, e1[1] * size / 2]
        const h2 = [e2[0] * size / 2, e2[1] * size / 2]
        const corners = [
          [x - h1[0] - h2[0], y - h1[1] - h2[1]],
          [x + h1[0] - h2[0], y + h1[1] - h2[1]],
          [x + h1[0] + h2[0], y + h1[1] + h2[1]],
          [x - h1[0] + h2[0], y - h1[1] + h2[1]],
        ]
        parts.push('M' + corners.map(([px, py]) => `${fmt(px)} ${fmt(py)}`).join('L') + 'Z')
      } else {
        const r = size / 2
        // A circle as two arcs keeps everything inside a single <path>.
        parts.push(`M${fmt(x - r)} ${fmt(y)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`)
      }
    }
  }
  return { d: parts.join(''), count: parts.length }
}
