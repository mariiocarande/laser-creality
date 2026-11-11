// Cut outline around a piece of content (design, text or traced shape),
// with an optional hanging hole. Shared by the personalizer and the vectorizer.
// All units are millimetres.

const HOLE_EDGE_GAP = 2.5

const fmt = n => Number(n.toFixed(3)).toString()

// content: { w, h } of what goes inside
// options: { outline: 'none' | 'rect' | 'round' | 'circle', margin, radius, hole, holeDiameter }
// Returns the piece size, where the content's top-left corner goes, and the cut markup.
export function layoutPiece(content, options) {
  const { w: cw, h: ch } = content
  const hasOutline = options.outline !== 'none'
  const hasHole = hasOutline && options.hole
  const holeSpace = hasHole ? options.holeDiameter + HOLE_EDGE_GAP : 0
  const margin = hasOutline ? options.margin : 0

  let w, h, x, y, cut = '', cutLength = 0

  if (options.outline === 'circle') {
    const r = Math.max(Math.hypot(cw, ch) / 2 + margin, ch / 2 + holeSpace + 1)
    w = h = 2 * r
    x = r - cw / 2
    y = r - ch / 2
    cut = `<circle cx="${fmt(r)}" cy="${fmt(r)}" r="${fmt(r)}"/>`
    cutLength = 2 * Math.PI * r
  } else {
    w = cw + 2 * margin
    h = ch + 2 * margin + holeSpace
    x = margin
    y = margin + holeSpace
    if (hasOutline) {
      const r = options.outline === 'round' ? Math.min(options.radius, w / 2, h / 2) : 0
      cut = `<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ry="${fmt(r)}"/>`
      cutLength = 2 * (w + h) - 8 * r + 2 * Math.PI * r
    }
  }

  if (hasHole) {
    const hr = options.holeDiameter / 2
    cut += `<circle cx="${fmt(w / 2)}" cy="${fmt(HOLE_EDGE_GAP + hr)}" r="${fmt(hr)}"/>`
    cutLength += 2 * Math.PI * hr
  }

  return { w, h, x, y, cut, cutLength }
}
