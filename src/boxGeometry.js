// Finger-joint box geometry. All units are millimetres.
//
// Every panel is a rectangle whose four edges carry a joint profile:
//   'M' (male)   → fingers stick out on even segments
//   'F' (female) → the complement of a male edge
//   'P' (plain)  → straight edge
// The t×t corner squares are owned by exactly one panel per box vertex
// (front/back), so mating panels never overlap.

const EPS = 1e-6

export function fingerCount(span, fingerWidth) {
  if (span < fingerWidth * 1.5) return 1
  let n = Math.round(span / fingerWidth)
  if (n % 2 === 0) n += span / fingerWidth > n ? 1 : -1
  return Math.max(3, n)
}

function edgeProfile(length, t, type, cornerStart, cornerEnd, fingerWidth) {
  const intervals = []
  if (cornerStart) intervals.push([0, t, 0])

  const span = length - 2 * t
  if (type === 'P') {
    intervals.push([t, length - t, 0])
  } else {
    const n = fingerCount(span, fingerWidth)
    const seg = span / n
    for (let i = 0; i < n; i++) {
      const isOut = (i % 2 === 0) === (type === 'M')
      intervals.push([t + i * seg, t + (i + 1) * seg, isOut ? 0 : t])
    }
  }

  if (cornerEnd) intervals.push([length - t, length, 0])
  return intervals
}

function cleanPolygon(points) {
  let pts = points.filter((p, i) => {
    const q = points[(i + 1) % points.length]
    return Math.abs(p[0] - q[0]) > EPS || Math.abs(p[1] - q[1]) > EPS
  })

  let changed = true
  while (changed) {
    changed = false
    const next = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]
      const b = pts[i]
      const c = pts[(i + 1) % pts.length]
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      if (Math.abs(cross) > EPS) next.push(b)
      else changed = true
    }
    pts = next
  }
  return pts
}

// edges:   [bottom, right, top, left]
// corners: [(0,0), (w,0), (w,h), (0,h)] → true when this panel owns the corner
export function panelOutline(w, h, t, edges, corners, fingerWidth) {
  const toPoint = [
    (a, inset) => [a, inset],
    (a, inset) => [w - inset, a],
    (a, inset) => [w - a, h - inset],
    (a, inset) => [inset, h - a],
  ]
  const lengths = [w, h, w, h]
  const missingCorner = [[t, t], [w - t, t], [w - t, h - t], [t, h - t]]

  const points = []
  for (let e = 0; e < 4; e++) {
    const startCorner = e
    const endCorner = (e + 1) % 4
    if (!corners[startCorner]) points.push(missingCorner[startCorner])

    const profile = edgeProfile(
      lengths[e], t, edges[e], corners[startCorner], corners[endCorner], fingerWidth,
    )
    profile.forEach(([a0, a1, inset]) => {
      points.push(toPoint[e](a0, inset), toPoint[e](a1, inset))
    })
  }
  return cleanPolygon(points)
}

export function polygonArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    area += x0 * y1 - x1 * y0
  }
  return area / 2
}

export function polygonPerimeter(points) {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    total += Math.hypot(x1 - x0, y1 - y0)
  }
  return total
}

// Grows an axis-aligned polygon outward by `distance` (kerf compensation).
export function offsetRectilinear(points, distance) {
  if (!distance) return points
  const sign = polygonArea(points) > 0 ? 1 : -1
  const n = points.length

  const normalOf = i => {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % n]
    const len = Math.hypot(x1 - x0, y1 - y0)
    return [(sign * (y1 - y0)) / len, (-sign * (x1 - x0)) / len]
  }

  return points.map((p, i) => {
    const prev = normalOf((i - 1 + n) % n)
    const next = normalOf(i)
    return [p[0] + distance * (prev[0] + next[0]), p[1] + distance * (prev[1] + next[1])]
  })
}

function rectangle(w, h) {
  return [[0, 0], [w, 0], [w, h], [0, h]]
}

const LID_CLEARANCE = 0.4

// params: { width, depth, height, thickness, fingerWidth, kerf, lid, innerDims }
// lid: 'open' | 'closed' | 'lift'
export function buildBox(params) {
  const { thickness: t, fingerWidth, kerf, lid, innerDims } = params

  const hasJointedTop = lid === 'closed'
  const W = params.width  + (innerDims ? 2 * t : 0)
  const D = params.depth  + (innerDims ? 2 * t : 0)
  const H = params.height + (innerDims ? t + (hasJointedTop ? t : 0) : 0)

  const minSide = 3 * t + 6
  if (t <= 0 || Math.min(W, D, H) < minSide) {
    return { error: `Cada lado tiene que medir al menos ${minSide.toFixed(0)} mm con ese grosor.` }
  }

  const top = hasJointedTop ? 'M' : 'P'
  const all = [true, true, true, true]
  const none = [false, false, false, false]

  const specs = [
    { id: 'bottom', name: 'Fondo',     w: W, h: D, edges: ['F', 'F', 'F', 'F'], corners: none },
    { id: 'front',  name: 'Frente',    w: W, h: H, edges: ['M', 'M', top, 'M'], corners: all  },
    { id: 'back',   name: 'Atrás',     w: W, h: H, edges: ['M', 'M', top, 'M'], corners: all  },
    { id: 'left',   name: 'Lateral 1', w: D, h: H, edges: ['M', 'F', top, 'F'], corners: none },
    { id: 'right',  name: 'Lateral 2', w: D, h: H, edges: ['M', 'F', top, 'F'], corners: none },
  ]
  if (hasJointedTop) {
    specs.push({ id: 'top', name: 'Tapa', w: W, h: D, edges: ['F', 'F', 'F', 'F'], corners: none })
  }

  const panels = specs.map(s => ({
    id: s.id,
    name: s.name,
    points: panelOutline(s.w, s.h, t, s.edges, s.corners, fingerWidth),
  }))

  if (lid === 'lift') {
    panels.push({ id: 'lid', name: 'Tapa', points: rectangle(W, D) })
    panels.push({
      id: 'lid-lip',
      name: 'Tope de tapa',
      points: rectangle(W - 2 * t - LID_CLEARANCE, D - 2 * t - LID_CLEARANCE),
    })
  }

  const half = kerf / 2
  const finished = panels.map(p => {
    const grown = offsetRectilinear(p.points, half)
    const minX = Math.min(...grown.map(q => q[0]))
    const minY = Math.min(...grown.map(q => q[1]))
    const points = grown.map(([x, y]) => [x - minX, y - minY])
    return {
      id: p.id,
      name: p.name,
      points,
      w: Math.max(...points.map(q => q[0])),
      h: Math.max(...points.map(q => q[1])),
      cutLength: polygonPerimeter(points),
    }
  })

  return {
    panels: finished,
    outer: { width: W, depth: D, height: H },
    inner: { width: W - 2 * t, depth: D - 2 * t, height: H - t - (hasJointedTop ? t : 0) },
  }
}
