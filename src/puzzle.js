// Jigsaw puzzle cut lines. Pure functions, no DOM. Units are millimetres.
//
// Each interior edge between two pieces gets one knob that points into a
// random neighbour. Every grid line is emitted as a single continuous path
// so the laser cuts it in one go.

const fmt = n => Number(n.toFixed(3)).toString()

// Knob outline along an edge of length 1, height 1 (scaled later).
// Narrow neck, wider head: the head is what locks the pieces together.
const KNOB = [
  [[0.34, 0], [0.40, 0], [0.38, 0.28]],
  [[0.36, 0.52], [0.28, 0.75], [0.50, 1]],
  [[0.72, 0.75], [0.64, 0.52], [0.62, 0.28]],
  [[0.60, 0], [0.66, 0], [1, 0]],
]

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cubicLength(p0, c1, c2, p3) {
  let length = 0, prev = p0
  for (let i = 1; i <= 10; i++) {
    const t = i / 10, u = 1 - t
    const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0]
    const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
    length += Math.hypot(x - prev[0], y - prev[1])
    prev = [x, y]
  }
  return length
}

// options: { width, height, cols, rows, tab (0..0.35 of the smaller cell side), jitter (0..0.1), seed, radius }
export function puzzlePaths(options) {
  const { width: W, height: H, cols, rows, radius } = options
  const cw = W / cols, ch = H / rows
  const random = mulberry32(options.seed)
  const knobHeight = options.tab * Math.min(cw, ch)
  const jitter = options.jitter

  const paths = []
  let cutLength = 0

  // Builds one grid line. `toXY(along, across)` maps edge coords to the sheet.
  const line = (count, cellLength, toXY) => {
    let point = toXY(0, 0)
    let d = `M${fmt(point[0])} ${fmt(point[1])}`
    for (let k = 0; k < count; k++) {
      const start = k * cellLength
      const flip = random() < 0.5 ? -1 : 1
      const shift = (random() * 2 - 1) * jitter
      const grow = 1 + (random() * 2 - 1) * jitter * 2
      const map = ([u, v]) => {
        const along = u > 0.05 && u < 0.95 ? u + shift : u
        return toXY(start + along * cellLength, flip * v * knobHeight * grow)
      }
      KNOB.forEach(([c1, c2, end]) => {
        const p = [map(c1), map(c2), map(end)]
        cutLength += cubicLength(point, ...p)
        d += `C${p.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' ')}`
        point = p[2]
      })
    }
    paths.push(d)
  }

  for (let r = 1; r < rows; r++) line(cols, cw, (along, across) => [along, r * ch + across])
  for (let c = 1; c < cols; c++) line(rows, ch, (along, across) => [c * cw + across, along])

  const rx = Math.min(radius, cw / 2, ch / 2)
  cutLength += 2 * (W + H) - 8 * rx + 2 * Math.PI * rx

  return {
    lines: paths,
    border: `<rect x="0" y="0" width="${fmt(W)}" height="${fmt(H)}" rx="${fmt(rx)}" ry="${fmt(rx)}"/>`,
    cutLength,
    pieceSize: { w: cw, h: ch },
  }
}
