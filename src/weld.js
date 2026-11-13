// Turns a canvas drawing into clean cut outlines. Shapes drawn in black are
// merged ("welded") into one piece; cut-outs drawn afterwards are erased
// and become holes. Optional bridges keep floating islands (the inside of an
// O, A, B… when letters are cut out) attached to the main piece.

import { traceLoops, signedArea, chamferLoop, simplifyLoop, loopToPath } from './vectorize.js'

const MAX_CANVAS_PX = 4096
const SIMPLIFY_PX = 0.6

// Labels 4-connected ink components. Returns { labels, sizes }.
function labelComponents(mask, w, h) {
  const labels = new Int32Array(w * h).fill(-1)
  const sizes = []
  const stack = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue
    const id = sizes.length
    let size = 0
    labels[start] = id
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()
      size++
      const x = i % w
      const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
      for (const n of neighbours) {
        if (n < 0 || n >= mask.length || !mask[n] || labels[n] !== -1) continue
        labels[n] = id
        stack.push(n)
      }
    }
    sizes.push(size)
  }
  return { labels, sizes }
}

// Joins every island to whatever solid lies straight above and below it.
function addBridges(mask, w, h, bridgePx) {
  const { labels, sizes } = labelComponents(mask, w, h)
  if (sizes.length < 2) return 0
  const main = sizes.indexOf(Math.max(...sizes))
  const half = Math.max(1, Math.round(bridgePx / 2))

  const boxes = sizes.map(() => ({ x1: w, x2: -1 }))
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]
    if (id < 0) continue
    const x = i % w
    if (x < boxes[id].x1) boxes[id].x1 = x
    if (x > boxes[id].x2) boxes[id].x2 = x
  }

  let added = 0
  sizes.forEach((_, id) => {
    if (id === main) return
    const cx = Math.round((boxes[id].x1 + boxes[id].x2) / 2)
    let top = -1, bottom = -1
    for (let y = 0; y < h; y++) {
      if (labels[y * w + cx] !== id) continue
      if (top < 0) top = y
      bottom = y
    }
    if (top < 0) return

    const bridge = (from, step) => {
      let y = from
      while (y >= 0 && y < h && !(mask[y * w + cx] && labels[y * w + cx] !== id)) y += step
      if (y < 0 || y >= h) return   // nothing solid that way: do not bridge into the void
      for (let yy = from; yy !== y; yy += step) {
        for (let x = Math.max(0, cx - half); x <= Math.min(w - 1, cx + half); x++) mask[yy * w + x] = 1
      }
      added++
    }
    // Small counters (o, e, a…) hang fine from one bridge; tall ones get two.
    const before = added
    bridge(top - 1, -1)
    if (bottom - top > 5 * bridgePx || added === before) bridge(bottom + 1, 1)
  })
  return added
}

function traceMask(mask, w, h, ppm, minArea, smooth) {
  const loops = traceLoops(mask, w, h)
    .filter(points => Math.abs(signedArea(points)) >= minArea)
    .map(points => simplifyLoop(chamferLoop(points), SIMPLIFY_PX))
    .filter(points => points.length >= 3)
    .map(points => points.map(([x, y]) => [x / ppm, y / ppm]))
  return { d: loops.map(points => loopToPath(points, smooth)).join(''), count: loops.length }
}

// options: {
//   width, height (mm), pxPerMm,
//   draw(ctx)         solid shapes, in mm
//   drawCutouts(ctx)  optional, erased from the solid (letters, holes); called with
//                     'destination-out' already set
//   bridge            mm, 0 = no bridges
//   outline           true → also trace the solid's own outline
// }
// Returns { d, outline, cutouts, bridges }: `cutouts` are the boundaries of what
// was erased (minus bridges), `outline` the boundary of the solid, `d` both.
export function traceDrawing(options) {
  const { width, height, draw } = options
  const ppm = Math.min(options.pxPerMm || 16, MAX_CANVAS_PX / Math.max(width, height))
  const w = Math.max(1, Math.ceil(width * ppm))
  const h = Math.max(1, Math.ceil(height * ppm))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.scale(ppm, ppm)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  draw(ctx)

  const readMask = () => {
    const pixels = ctx.getImageData(0, 0, w, h).data
    const mask = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) mask[i] = pixels[i * 4 + 3] > 127 ? 1 : 0
    return mask
  }
  const solid = readMask()
  let mask = solid
  if (options.drawCutouts) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    options.drawCutouts(ctx)
    ctx.restore()
    mask = readMask()
  }

  const bridges = options.bridge > 0 ? addBridges(mask, w, h, options.bridge * ppm) : 0
  const minArea = (options.minAreaMm2 ?? 0.05) * ppm * ppm
  const smooth = options.smooth !== false

  let cutouts = { d: '', count: 0 }
  if (options.drawCutouts) {
    const removed = new Uint8Array(w * h)
    for (let i = 0; i < removed.length; i++) removed[i] = solid[i] && !mask[i] ? 1 : 0
    cutouts = traceMask(removed, w, h, ppm, minArea, smooth)
  }
  const outline = options.outline === false ? { d: '', count: 0 } : traceMask(solid, w, h, ppm, minArea, smooth)

  return {
    d: outline.d + cutouts.d,
    outline: outline.d,
    cutouts: cutouts.d,
    loops: outline.count + cutouts.count,
    bridges,
    pxPerMm: ppm,
  }
}

