// Bitmap → closed vector outlines. Pure functions, no DOM.
//
// Pipeline: grayscale → optional blur → threshold mask → boundary tracing
// along pixel edges → half-pixel chamfer → Ramer-Douglas-Peucker
// simplification → optional smoothing into cubic Béziers.

// data: RGBA Uint8ClampedArray. Returns Uint8Array mask (1 = ink).
export function buildMask(data, w, h, { threshold, invert, blur }) {
  let gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    gray[i] = lum * a + 255 * (1 - a)   // transparent pixels count as white
  }
  for (let pass = 0; pass < blur; pass++) gray = boxBlur(gray, w, h)

  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = (gray[i] < threshold) !== invert ? 1 : 0
  return mask
}

function boxBlur(src, w, h) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = src[y * w + Math.max(0, x - 1)]
      const r = src[y * w + Math.min(w - 1, x + 1)]
      tmp[y * w + x] = (l + src[y * w + x] + r) / 3
    }
  }
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w
    const down = Math.min(h - 1, y + 1) * w
    for (let x = 0; x < w; x++) out[y * w + x] = (tmp[up + x] + tmp[y * w + x] + tmp[down + x]) / 3
  }
  return out
}

const STEP_X = [1, 0, -1, 0]
const STEP_Y = [0, 1, 0, -1]

// Traces every boundary of the mask as a closed loop of grid vertices.
// Ink is kept on the right-hand side, so (with y pointing down) outer
// boundaries have positive signed area and holes negative.
// The summed signed area always equals the number of ink pixels.
export function traceLoops(mask, w, h) {
  const vw = w + 1
  const edges = new Uint8Array(vw * (h + 1))   // bit d set → edge leaving in direction d
  const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (!ink(x, y - 1)) edges[y * vw + x] |= 1              // top edge, heading right
      if (!ink(x + 1, y)) edges[y * vw + x + 1] |= 2          // right edge, heading down
      if (!ink(x, y + 1)) edges[(y + 1) * vw + x + 1] |= 4    // bottom edge, heading left
      if (!ink(x - 1, y)) edges[(y + 1) * vw + x] |= 8        // left edge, heading up
    }
  }

  const pending = edges.slice()
  const loops = []

  for (let start = 0; start < pending.length; start++) {
    while (pending[start]) {
      let dir = 0
      while (!(pending[start] & (1 << dir))) dir++

      const points = []
      let cur = start
      let lastDir = -1
      for (;;) {
        pending[cur] &= ~(1 << dir)
        if (dir !== lastDir) points.push([cur % vw, (cur / vw) | 0])
        lastDir = dir
        cur += STEP_X[dir] + STEP_Y[dir] * vw

        // Prefer the right turn so diagonal pixels stay separate shapes.
        const options = edges[cur]
        const right = (dir + 1) & 3
        const left = (dir + 3) & 3
        dir = options & (1 << right) ? right : options & (1 << dir) ? dir : left
        if (!(pending[cur] & (1 << dir))) break   // back at the starting edge
      }
      // Drop the first point when the loop closes in a straight line through it.
      if (points.length > 2 && dir === lastDir) points.shift()
      loops.push(points)
    }
  }
  return loops
}

// Moves the outline from pixel corners to pixel-edge midpoints. A staircase
// then wobbles by about a third of a pixel instead of a whole one, so the
// simplification step can flatten diagonals and curves cleanly.
export function chamferLoop(points) {
  const out = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const length = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
    const dx = Math.sign(b[0] - a[0]) / 2
    const dy = Math.sign(b[1] - a[1]) / 2
    out.push([a[0] + dx, a[1] + dy])
    if (length > 1) out.push([b[0] - dx, b[1] - dy])
  }
  return out
}

export function signedArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    area += x0 * y1 - x1 * y0
  }
  return area / 2
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

// Iterative RDP on an open chain; keeps both end points.
function simplifyChain(points, epsilon) {
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop()
    let maxDist = 0, index = -1
    for (let i = from + 1; i < to; i++) {
      const d = distanceToSegment(points[i], points[from], points[to])
      if (d > maxDist) { maxDist = d; index = i }
    }
    if (maxDist > epsilon) { keep[index] = 1; stack.push([from, index], [index, to]) }
  }
  return points.filter((_, i) => keep[i])
}

// RDP for a closed loop: split at the point farthest from the first one.
export function simplifyLoop(points, epsilon) {
  if (points.length < 4) return points
  let far = 0, farDist = -1
  points.forEach((p, i) => {
    const d = Math.hypot(p[0] - points[0][0], p[1] - points[0][1])
    if (d > farDist) { farDist = d; far = i }
  })
  const first = simplifyChain(points.slice(0, far + 1), epsilon)
  const second = simplifyChain([...points.slice(far), points[0]], epsilon)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

const CORNER_COS = Math.cos((55 * Math.PI) / 180)   // turns sharper than this stay corners

const num = n => Number(n.toFixed(3)).toString()

// points: closed loop already in output units. Returns an SVG subpath.
export function loopToPath(points, smooth) {
  const n = points.length
  const at = i => points[((i % n) + n) % n]
  if (!smooth || n < 4) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${num(p[0])} ${num(p[1])}`).join('') + 'Z'
  }

  // Unit tangent at each point, or null where the outline turns sharply.
  const tangents = points.map((p, i) => {
    const a = at(i - 1), b = at(i + 1)
    const inX = p[0] - a[0], inY = p[1] - a[1]
    const outX = b[0] - p[0], outY = b[1] - p[1]
    const inLen = Math.hypot(inX, inY), outLen = Math.hypot(outX, outY)
    if (!inLen || !outLen) return null
    if ((inX * outX + inY * outY) / (inLen * outLen) < CORNER_COS) return null
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const len = Math.hypot(tx, ty)
    return len ? [tx / len, ty / len] : null
  })

  let d = `M${num(points[0][0])} ${num(points[0][1])}`
  for (let i = 0; i < n; i++) {
    const p = at(i), q = at(i + 1)
    const reach = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3
    const t0 = tangents[i], t1 = tangents[(i + 1) % n]
    if (!t0 && !t1) { d += `L${num(q[0])} ${num(q[1])}`; continue }
    const c1 = t0 ? [p[0] + t0[0] * reach, p[1] + t0[1] * reach] : p
    const c2 = t1 ? [q[0] - t1[0] * reach, q[1] - t1[1] * reach] : q
    d += `C${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(q[0])} ${num(q[1])}`
  }
  return d + 'Z'
}

// Full pipeline. Returns loops in pixel units plus their bounding box.
// options: { threshold, invert, blur, minArea, precision, outerOnly }
export function vectorize(data, w, h, options) {
  const mask = buildMask(data, w, h, options)
  const loops = traceLoops(mask, w, h)
    .map(points => ({ points, area: signedArea(points) }))
    .filter(loop => Math.abs(loop.area) >= options.minArea)
    .filter(loop => !options.outerOnly || loop.area > 0)
    .map(loop => ({ ...loop, points: simplifyLoop(chamferLoop(loop.points), options.precision) }))
    .filter(loop => loop.points.length >= 3)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  loops.forEach(loop => loop.points.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }))

  return {
    loops,
    bounds: loops.length ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null,
    nodeCount: loops.reduce((sum, loop) => sum + loop.points.length, 0),
  }
}
