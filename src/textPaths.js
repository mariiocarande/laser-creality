// Fonts and text → outline paths, shared by every tool that writes text.

import { parse as parseFont } from 'opentype.js'
import pacificoUrl from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url'
import bebasUrl from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?url'
import dmSansUrl from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff?url'

export const FONTS = {
  pacifico: { label: 'Pacifico (cursiva)', url: pacificoUrl },
  bebas:    { label: 'Bebas Neue (mayúsculas)', url: bebasUrl },
  dmsans:   { label: 'DM Sans Bold (recta)', url: dmSansUrl },
}

const cache = {}

export function loadFont(key) {
  if (!cache[key]) {
    cache[key] = fetch(FONTS[key].url)
      .then(res => res.arrayBuffer())
      .then(buffer => parseFont(buffer))
      .catch(err => {
        delete cache[key]
        throw err
      })
  }
  return cache[key]
}

export function loadAllFonts() {
  return Promise.all(Object.keys(FONTS).map(key =>
    loadFont(key).then(font => [key, font]).catch(err => {
      console.error(`Font "${key}" failed to load`, err)
      return [key, null]
    }),
  )).then(entries => Object.fromEntries(entries.filter(([, font]) => font)))
}

const fmt = n => Number(n.toFixed(3)).toString()

// Text is laid out glyph by glyph on purpose: opentype.js' own
// getPath()/toPathData() throw on some GSUB tables and can emit NaN.
export function layoutText(font, text, size) {
  const scale = size / font.unitsPerEm
  const commands = []
  const b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  let x = 0
  let previous = null

  for (const char of text) {
    const glyph = font.charToGlyph(char)
    if (previous) x += font.getKerningValue(previous, glyph) * scale
    const glyphPath = glyph.getPath(x, 0, size)
    if (glyphPath.commands.length) {
      const g = glyphPath.getBoundingBox()
      b.x1 = Math.min(b.x1, g.x1); b.y1 = Math.min(b.y1, g.y1)
      b.x2 = Math.max(b.x2, g.x2); b.y2 = Math.max(b.y2, g.y2)
      commands.push(...glyphPath.commands)
    }
    x += (glyph.advanceWidth || 0) * scale
    previous = glyph
  }
  return { commands, b }
}

export function commandsToPathData(commands) {
  return commands.map(c => {
    switch (c.type) {
      case 'M': return `M${fmt(c.x)} ${fmt(c.y)}`
      case 'L': return `L${fmt(c.x)} ${fmt(c.y)}`
      case 'Q': return `Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`
      case 'C': return `C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`
      default:  return 'Z'
    }
  }).join('')
}

// Text measured at `size`, optionally shrunk to fit a box.
// Returns { d, b, scale, w, h } or null when the text has no ink.
export function textBlock(font, text, size, maxWidth = 0, maxHeight = 0) {
  const { commands, b } = layoutText(font, text, size)
  if (!commands.length) return null
  const width = b.x2 - b.x1
  const height = b.y2 - b.y1
  let scale = 1
  if (maxWidth && width * scale > maxWidth) scale = maxWidth / width
  if (maxHeight && height * scale > maxHeight) scale = maxHeight / height
  return { d: commandsToPathData(commands), b, scale, w: width * scale, h: height * scale }
}

// Transform that puts the block's top-left ink corner at (x, y).
export function blockTransform(t, x, y) {
  return `translate(${fmt(x - t.b.x1 * t.scale)},${fmt(y - t.b.y1 * t.scale)}) scale(${t.scale.toFixed(6)})`
}

// Same placement for canvas drawing (units: whatever the context uses).
export function blockMatrix(t, x, y) {
  return new DOMMatrix([t.scale, 0, 0, t.scale, x - t.b.x1 * t.scale, y - t.b.y1 * t.scale])
}

export function textMarkup(t, x, y) {
  return `<path fill="#000000" transform="${blockTransform(t, x, y)}" d="${t.d}"/>`
}
