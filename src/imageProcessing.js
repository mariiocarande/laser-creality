function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export function toGray(data, contrast, brightness, invert) {
  for (let i = 0; i < data.length; i += 4) {
    let g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    g = clamp((g - 128) * contrast + 128 + brightness)
    if (invert) g = 255 - g
    data[i] = data[i + 1] = data[i + 2] = g
  }
}

export function floydSteinberg(data, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i   = (y * w + x) * 4
      const old = data[i]
      const nw  = old < 128 ? 0 : 255
      data[i] = data[i + 1] = data[i + 2] = nw
      const err = old - nw

      if (x + 1 < w) {
        const j = (y * w + (x + 1)) * 4
        data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 7 / 16)
      }
      if (y + 1 < h) {
        if (x - 1 >= 0) {
          const j = ((y + 1) * w + (x - 1)) * 4
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 3 / 16)
        }
        {
          const j = ((y + 1) * w + x) * 4
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 5 / 16)
        }
        if (x + 1 < w) {
          const j = ((y + 1) * w + (x + 1)) * 4
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 1 / 16)
        }
      }
    }
  }
}

export function applyThreshold(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] < threshold ? 0 : 255
    data[i] = data[i + 1] = data[i + 2] = v
  }
}

export function sobelEdges(data, w, h, thresholdPct) {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = data[i * 4]

  const mag = new Float32Array(w * h)
  let maxMag = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y-1)*w+(x-1)] + gray[(y-1)*w+(x+1)] +
        -2*gray[y*w+(x-1)]   + 2*gray[y*w+(x+1)] +
        -gray[(y+1)*w+(x-1)] + gray[(y+1)*w+(x+1)]
      const gy =
        -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)] +
         gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)]
      mag[y*w+x] = Math.sqrt(gx*gx + gy*gy)
      if (mag[y*w+x] > maxMag) maxMag = mag[y*w+x]
    }
  }

  const cutoff = (thresholdPct / 100) * maxMag
  const edges = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) edges[i] = mag[i] >= cutoff ? 1 : 0
  return edges
}

export function traceContours(edges, w, h) {
  const visited = new Uint8Array(w * h)
  const contours = []
  const dx8 = [-1, 0, 1, 1, 1, 0, -1, -1]
  const dy8 = [-1, -1, -1, 0, 1, 1, 1, 0]

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      if (!edges[sy*w+sx] || visited[sy*w+sx]) continue
      const path = [[sx, sy]]
      visited[sy*w+sx] = 1
      let cx = sx, cy = sy, lastDir = 0
      while (true) {
        let found = false
        for (let di = 0; di < 8; di++) {
          const dir = (lastDir + di) % 8
          const nx = cx + dx8[dir], ny = cy + dy8[dir]
          if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
              edges[ny*w+nx] && !visited[ny*w+nx]) {
            visited[ny*w+nx] = 1
            path.push([nx, ny])
            lastDir = dir
            cx = nx; cy = ny
            found = true
            break
          }
        }
        if (!found) break
      }
      if (path.length >= 4) contours.push(path)
    }
  }
  return contours
}

function ptLineDist(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1]
  if (dx === 0 && dy === 0)
    return Math.sqrt((p[0]-a[0])**2 + (p[1]-a[1])**2)
  const t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx + dy*dy)
  return Math.sqrt((p[0]-(a[0]+t*dx))**2 + (p[1]-(a[1]+t*dy))**2)
}

export function rdpSimplify(pts, eps) {
  if (pts.length <= 2) return pts
  let maxD = 0, maxI = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length-1])
    if (d > maxD) { maxD = d; maxI = i }
  }
  if (maxD > eps) {
    const l = rdpSimplify(pts.slice(0, maxI+1), eps)
    const r = rdpSimplify(pts.slice(maxI), eps)
    return [...l.slice(0,-1), ...r]
  }
  return [pts[0], pts[pts.length-1]]
}

export function edgesToSVG(contours, w, h) {
  const paths = contours.map(pts => {
    const s = rdpSimplify(pts, 1.0)
    if (s.length < 2) return ''
    const d = s.map((p, i) =>
      `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
    ).join('')
    return `  <path d="${d}"/>`
  }).filter(Boolean).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    '  <g fill="none" stroke="#000000" stroke-width="0.1" stroke-linecap="round" stroke-linejoin="round">',
    paths,
    '  </g>',
    '</svg>',
  ].join('\n')
}

// Estimate engraving time in minutes given canvas dimensions (px) and laser settings
export function estimateTime(widthPx, heightPx, dpi, speed, passes) {
  const widthMm  = (widthPx  / dpi) * 25.4
  const heightMm = (heightPx / dpi) * 25.4
  // Number of lines at given interval (0.1 mm default)
  const lines = Math.ceil(heightMm / 0.1)
  const travelPerLine = widthMm * 2  // go + return (conservative)
  const totalMm = lines * travelPerLine * passes
  return totalMm / speed  // minutes
}
