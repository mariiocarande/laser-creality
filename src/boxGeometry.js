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

// `jointEnd` < length means the mating panel is shorter than this edge: the
// joint covers [0, jointEnd] and the rest of the edge runs straight to the end.
function edgeProfile(length, t, type, cornerStart, cornerEnd, fingerWidth, jointEnd = length) {
  const isPartial = jointEnd < length
  const intervals = []
  if (cornerStart) intervals.push([0, t, 0])

  const span = jointEnd - 2 * t
  if (type === 'P') {
    intervals.push([t, jointEnd - t, 0])
  } else {
    const n = fingerCount(span, fingerWidth)
    const seg = span / n
    for (let i = 0; i < n; i++) {
      const isOut = (i % 2 === 0) === (type === 'M')
      intervals.push([t + i * seg, t + (i + 1) * seg, isOut ? 0 : t])
    }
  }

  if (isPartial) {
    intervals.push([jointEnd - t, jointEnd, t], [jointEnd, length, 0])
  } else if (cornerEnd) {
    intervals.push([length - t, length, 0])
  }
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
// jointEnds: optional per-edge length covered by the mating panel
export function panelOutline(w, h, t, edges, corners, fingerWidth, jointEnds = []) {
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
      jointEnds[e] ?? lengths[e],
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

// Strip with half-depth notches so crossing dividers interlock (egg-crate).
function notchedStrip(length, h, centers, t, fromTop) {
  const depth = h / 2 + NOTCH_SLACK
  const sorted = [...centers].sort((a, b) => a - b)
  const points = [[0, 0]]
  if (!fromTop) {
    sorted.forEach(c => points.push([c - t / 2, 0], [c - t / 2, depth], [c + t / 2, depth], [c + t / 2, 0]))
  }
  points.push([length, 0], [length, h])
  if (fromTop) {
    sorted.reverse().forEach(c =>
      points.push([c + t / 2, h], [c + t / 2, h - depth], [c - t / 2, h - depth], [c - t / 2, h]))
  }
  points.push([0, h])
  return points
}

const LID_CLEARANCE = 0.4     // loose-fit gap for lids and their stops
const FIT_CLEARANCE = 0.4     // total gap for dividers and rails along their length
const NOTCH_SLACK = 0.25
const DIVIDER_HEADROOM = 0.5
const FINGER_HOLE_RADIUS = 7
const FINGER_HOLE_INSET = 14
const HINGE_GAP_FACTOR = 0.25 // lid is shortened by this × thickness so it can swing
const HINGE_HOLE_SLACK = 0.25
const HINGE_HOLE_MARGIN = 1.5  // solid wall kept between the pivot hole and the joint
const HINGE_LID_DROP = 2.5     // lid top sits this × thickness below the rim
const MAX_DIVISIONS = 8
const MIN_CELL = 5

export const LID_TYPES = ['open', 'closed', 'lift', 'slide', 'hinge']

const UP = [0, 1, 0]

// Panels are placed in box space (X = width, Y = up, Z = depth, front at +Z):
//   'flat'     → u along +X, v along −Z, thickness along +Y
//   'upright'  → u along +X, v along +Y, thickness along +Z
//   'sideways' → u along +Z, v along +Y, thickness along −X
// `motion` marks the parts that move when the lid opens.

// params: { width, depth, height, thickness, fingerWidth, kerf, lid, innerDims, cols, rows }
export function buildBox(params) {
  const { thickness: t, fingerWidth, kerf, lid, innerDims } = params
  const cols = Math.min(MAX_DIVISIONS, Math.max(1, Math.round(params.cols || 1)))
  const rows = Math.min(MAX_DIVISIONS, Math.max(1, Math.round(params.rows || 1)))

  if (!(t > 0)) return { error: 'El grosor tiene que ser mayor a 0.' }

  const railWidth = Math.max(5, 1.5 * t)
  // Height the lid mechanism takes inside the box, below the top of the walls.
  const lidAllowance = {
    open: 0,
    closed: t,
    lift: t,
    slide: 2 * railWidth + LID_CLEARANCE + t,
    hinge: HINGE_LID_DROP * t + railWidth,
  }[lid]

  const W = params.width  + (innerDims ? 2 * t : 0)
  const D = params.depth  + (innerDims ? 2 * t : 0)
  const H = params.height + (innerDims ? t + lidAllowance : 0)
  const innerW = W - 2 * t
  const innerD = D - 2 * t

  const minSide = 3 * t + 6
  if (Math.min(W, D) < minSide || H < minSide + lidAllowance) {
    return { error: `La caja es demasiado chica para ese grosor: cada lado necesita al menos ${Math.ceil(minSide + lidAllowance)} mm.` }
  }

  const panels = []
  const add = (id, name, points, place, extra = {}) => panels.push({ id, name, points, place, ...extra })
  const jointed = (w, h, edges, corners, jointEnds) => panelOutline(w, h, t, edges, corners, fingerWidth, jointEnds)

  const all = [true, true, true, true]
  const none = [false, false, false, false]
  const top = lid === 'closed' ? 'M' : 'P'

  // ── Shell ──
  const slideLidBottom = H - railWidth - LID_CLEARANCE - t
  const frontH = lid === 'slide' ? slideLidBottom : H
  // Hinge: the lid sits below the rim so the pivot hole keeps solid wall around it.
  const hingeHoleR = Math.SQRT1_2 * t + HINGE_HOLE_SLACK
  const hingeZ = t + Math.max(HINGE_GAP_FACTOR * t + 0.1 + t / 2, hingeHoleR + HINGE_HOLE_MARGIN)
  const hingeGap = hingeZ - t / 2 - t
  const hingeLidY = H - HINGE_LID_DROP * t
  const hingeY = hingeLidY + t / 2

  add('bottom', 'Fondo', jointed(W, D, ['F', 'F', 'F', 'F'], none),
    { orient: 'flat', position: [0, 0, D], normal: [0, -1, 0] })
  add('front', 'Frente', jointed(W, frontH, ['M', 'M', lid === 'slide' ? 'P' : top, 'M'], all),
    { orient: 'upright', position: [0, 0, D - t], normal: [0, 0, 1] })
  add('back', 'Atrás', jointed(W, H, ['M', 'M', top, 'M'], all),
    { orient: 'upright', position: [0, 0, 0], normal: [0, 0, -1] })

  // With a sliding lid the front wall is lower, so the sides own the corner above it.
  const sideCorners = lid === 'slide' ? [false, false, true, false] : none
  const sideJointEnds = lid === 'slide' ? [D, frontH, D, H] : []
  const sideHoles = lid === 'hinge'
    ? [{ cx: hingeZ, cy: hingeY, r: hingeHoleR }]
    : []
  const sidePoints = () => jointed(D, H, ['M', 'F', top, 'F'], sideCorners, sideJointEnds)
  add('left', 'Lateral 1', sidePoints(),
    { orient: 'sideways', position: [t, 0, 0], normal: [-1, 0, 0] }, { holes: sideHoles })
  add('right', 'Lateral 2', sidePoints(),
    { orient: 'sideways', position: [W, 0, 0], normal: [1, 0, 0] }, { holes: sideHoles })

  // ── Lid ──
  let clearTop = H            // lowest point the lid mechanism reaches inside the box
  let lidMotion = null
  const fingerHole = (w, len) => ({
    cx: w / 2,
    cy: Math.min(FINGER_HOLE_INSET, len / 3),
    r: Math.min(FINGER_HOLE_RADIUS, w / 6, len / 6),
  })
  const rail = (id, name, length, y, z, isLeft) => add(id, name, rectangle(length, railWidth), {
    orient: 'sideways',
    position: [isLeft ? 2 * t : W - t, y, z],
    normal: [isLeft ? -1 : 1, 0, 0],
    explode: 0.55,
  })

  if (lid === 'closed') {
    clearTop = H - t
    lidMotion = { type: 'hinge', pivot: [H, 0] }
    add('top', 'Tapa', jointed(W, D, ['F', 'F', 'F', 'F'], none),
      { orient: 'flat', position: [0, H - t, D], normal: UP, motion: true })
  }

  if (lid === 'lift') {
    clearTop = H - t
    lidMotion = { type: 'hinge', pivot: [H, 0] }
    add('lid', 'Tapa', rectangle(W, D),
      { orient: 'flat', position: [0, H, D], normal: UP, explode: 1.6, motion: true })
    add('lid-lip', 'Tope de tapa', rectangle(innerW - LID_CLEARANCE, innerD - LID_CLEARANCE), {
      orient: 'flat',
      position: [t + LID_CLEARANCE / 2, H - t, D - t - LID_CLEARANCE / 2],
      normal: UP,
      explode: 1.25,
      motion: true,
    })
  }

  if (lid === 'slide') {
    const lidW = innerW - LID_CLEARANCE
    const lidLen = D - t
    const railLen = innerD - FIT_CLEARANCE
    const railZ = t + FIT_CLEARANCE / 2
    clearTop = slideLidBottom - railWidth
    lidMotion = { type: 'slide', distance: D * 0.75 }
    add('lid', 'Tapa corrediza', rectangle(lidW, lidLen),
      { orient: 'flat', position: [t + LID_CLEARANCE / 2, slideLidBottom, D], normal: UP, explode: 1.3, motion: true },
      { holes: [fingerHole(lidW, lidLen)] })
    rail('rail-top-l', 'Guía superior 1', railLen, H - railWidth, railZ, true)
    rail('rail-top-r', 'Guía superior 2', railLen, H - railWidth, railZ, false)
    rail('rail-low-l', 'Guía inferior 1', railLen, clearTop, railZ, true)
    rail('rail-low-r', 'Guía inferior 2', railLen, clearTop, railZ, false)
  }

  if (lid === 'hinge') {
    // Square ears on the lid turn inside round holes in the side walls.
    const ear = t + LID_CLEARANCE / 2
    const bodyW = innerW - LID_CLEARANCE
    const lidLen = innerD - hingeGap - LID_CLEARANCE / 2
    const lidY = hingeLidY
    const points = [
      [ear, 0], [ear + bodyW, 0], [ear + bodyW, lidLen - t], [2 * ear + bodyW, lidLen - t],
      [2 * ear + bodyW, lidLen], [0, lidLen], [0, lidLen - t], [ear, lidLen - t],
    ]
    const hole = fingerHole(bodyW, lidLen)
    clearTop = lidY - railWidth
    lidMotion = { type: 'hinge', pivot: [hingeY, hingeZ] }
    add('lid', 'Tapa con bisagra', points,
      { orient: 'flat', position: [0, lidY, t + hingeGap + lidLen], normal: UP, explode: 1.3, motion: true },
      { holes: [{ ...hole, cx: hole.cx + ear }] })

    const ledgeZ = t + hingeGap + 2 * t
    const ledgeLen = D - t - FIT_CLEARANCE / 2 - ledgeZ
    rail('ledge-l', 'Apoyo de tapa 1', ledgeLen, clearTop, ledgeZ, true)
    rail('ledge-r', 'Apoyo de tapa 2', ledgeLen, clearTop, ledgeZ, false)
  }

  // ── Dividers ──
  if (cols > 1 || rows > 1) {
    const dividerH = clearTop - t - (lid === 'open' ? 0 : DIVIDER_HEADROOM)
    const cellW = (innerW - (cols - 1) * t) / cols
    const cellD = (innerD - (rows - 1) * t) / rows
    if (cellW < MIN_CELL || cellD < MIN_CELL) {
      return { error: 'Hay demasiados divisores para ese tamaño de caja.' }
    }
    if (dividerH < 2 * t + 4) {
      return { error: 'No queda altura para los divisores con esa tapa. Hacé la caja más alta.' }
    }

    const xCenters = Array.from({ length: cols - 1 }, (_, i) => (i + 1) * (cellW + t) - t / 2)
    const zCenters = Array.from({ length: rows - 1 }, (_, i) => (i + 1) * (cellD + t) - t / 2)
    const slack = FIT_CLEARANCE / 2
    const place = extra => ({ normal: UP, explode: 0.5, ...extra })

    xCenters.forEach((x, i) => add(
      `divider-x${i}`, `Divisor largo ${i + 1}`,
      notchedStrip(innerD - FIT_CLEARANCE, dividerH, zCenters.map(z => z - slack), t, true),
      place({ orient: 'sideways', position: [t + x + t / 2, t, t + slack] }),
    ))
    zCenters.forEach((z, i) => add(
      `divider-z${i}`, `Divisor ancho ${i + 1}`,
      notchedStrip(innerW - FIT_CLEARANCE, dividerH, xCenters.map(x => x - slack), t, false),
      place({ orient: 'upright', position: [t + slack, t, t + z - t / 2] }),
    ))
  }

  // ── Kerf compensation ──
  const half = kerf / 2
  const finished = panels.map(p => {
    const grown = offsetRectilinear(p.points, half)
    const minX = Math.min(...grown.map(q => q[0]))
    const minY = Math.min(...grown.map(q => q[1]))
    const points = grown.map(([x, y]) => [x - minX, y - minY])
    const shapeHoles = p.holes || []
    // Holes are cut from the inside, so they shrink to keep their nominal size.
    const holes = shapeHoles.map(h => ({ cx: h.cx - minX, cy: h.cy - minY, r: Math.max(0.1, h.r - half) }))
    return {
      id: p.id,
      name: p.name,
      shape: p.points,          // nominal outline (no kerf), used by the 3D preview
      shapeHoles,
      place: p.place,
      points,
      holes,
      w: Math.max(...points.map(q => q[0])),
      h: Math.max(...points.map(q => q[1])),
      cutLength: polygonPerimeter(points) + holes.reduce((sum, h) => sum + 2 * Math.PI * h.r, 0),
    }
  })

  return {
    panels: finished,
    thickness: t,
    lidMotion,
    cells: { cols, rows },
    outer: { width: W, depth: D, height: H },
    inner: { width: innerW, depth: innerD, height: clearTop - t },
  }
}
