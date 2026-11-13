// Places a list of words on a grid so they cross at shared letters.
// Pure functions, no DOM.

import { mulberry32 } from './puzzle.js'

// Letters compare without accents, except Ñ which is its own letter.
export function normalizeWord(word) {
  return word
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '')
}

const key = (x, y) => `${x},${y}`

function canPlace(grid, word, x, y, dir) {
  const [dx, dy] = dir === 'h' ? [1, 0] : [0, 1]
  const [px, py] = [dy, dx]   // perpendicular
  if (grid.has(key(x - dx, y - dy)) || grid.has(key(x + dx * word.length, y + dy * word.length))) return -1

  let crossings = 0
  for (let k = 0; k < word.length; k++) {
    const cx = x + dx * k, cy = y + dy * k
    const cell = grid.get(key(cx, cy))
    if (cell) {
      if (cell.letter !== word[k] || cell.dirs.includes(dir)) return -1
      crossings++
    } else if (grid.has(key(cx + px, cy + py)) || grid.has(key(cx - px, cy - py))) {
      return -1
    }
  }
  return crossings
}

function place(grid, word, x, y, dir, index) {
  const [dx, dy] = dir === 'h' ? [1, 0] : [0, 1]
  for (let k = 0; k < word.length; k++) {
    const id = key(x + dx * k, y + dy * k)
    const cell = grid.get(id)
    if (cell) cell.dirs.push(dir)
    else grid.set(id, { letter: word[k], dirs: [dir], word: index })
  }
}

function bounds(grid) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const id of grid.keys()) {
    const [x, y] = id.split(',').map(Number)
    x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y)
  }
  return { x1, y1, x2, y2, w: x2 - x1 + 1, h: y2 - y1 + 1 }
}

function attempt(words, order) {
  const grid = new Map()
  const placed = []
  const skipped = []
  order.forEach((index, n) => {
    const word = words[index]
    if (n === 0) {
      place(grid, word, 0, 0, 'h', index)
      placed.push({ index, x: 0, y: 0, dir: 'h' })
      return
    }
    let best = null
    for (const [id, cell] of grid) {
      const [gx, gy] = id.split(',').map(Number)
      const dir = cell.dirs.includes('h') ? 'v' : 'h'
      for (let k = 0; k < word.length; k++) {
        if (word[k] !== cell.letter) continue
        const x = dir === 'h' ? gx - k : gx
        const y = dir === 'v' ? gy - k : gy
        const crossings = canPlace(grid, word, x, y, dir)
        if (crossings < 1) continue
        const b = bounds(grid)
        const nx1 = Math.min(b.x1, x), ny1 = Math.min(b.y1, y)
        const nx2 = Math.max(b.x2, dir === 'h' ? x + word.length - 1 : x)
        const ny2 = Math.max(b.y2, dir === 'v' ? y + word.length - 1 : y)
        const w = nx2 - nx1 + 1, h = ny2 - ny1 + 1
        const score = crossings * 40 - w * h - Math.abs(w - h) * 2
        if (!best || score > best.score) best = { x, y, dir, score }
      }
    }
    if (best) {
      place(grid, word, best.x, best.y, best.dir, index)
      placed.push({ index, x: best.x, y: best.y, dir: best.dir })
    } else {
      skipped.push(index)
    }
  })
  return { grid, placed, skipped }
}

// Tries several word orders and keeps the layout that places the most
// words in the most compact, squarest box.
export function buildCrossword(rawWords, { attempts = 60, seed = 1 } = {}) {
  const words = rawWords.map(normalizeWord).filter(w => w.length >= 2)
  if (words.length === 0) return null

  const random = mulberry32(seed)
  const base = words.map((_, i) => i).sort((a, b) => words[b].length - words[a].length)
  let best = null

  for (let t = 0; t < attempts; t++) {
    let order = base
    if (t > 0) {
      const rest = base.slice(1).sort(() => random() - 0.5)
      order = [base[t % base.length], ...rest.filter(i => i !== base[t % base.length])]
      if (order.length < base.length) order = [...order, base[0]]
    }
    const result = attempt(words, order)
    const b = bounds(result.grid)
    const score = result.placed.length * 1000 - b.w * b.h - Math.abs(b.w - b.h) * 3
    if (!best || score > best.score) best = { ...result, bounds: b, score }
  }

  const cells = [...best.grid].map(([id, cell]) => {
    const [x, y] = id.split(',').map(Number)
    return { x: x - best.bounds.x1, y: y - best.bounds.y1, letter: cell.letter }
  })
  return {
    words,
    cells,
    cols: best.bounds.w,
    rows: best.bounds.h,
    placed: best.placed.map(p => words[p.index]),
    skipped: best.skipped.map(i => words[i]),
  }
}

// Letter values from the Spanish word game, for the small corner numbers.
export const LETTER_POINTS = {
  A: 1, E: 1, O: 1, I: 1, S: 1, N: 1, L: 1, R: 1, U: 1, T: 1,
  D: 2, G: 2, C: 3, B: 3, M: 3, P: 3, H: 4, F: 4, V: 4, Y: 4,
  Q: 5, J: 8, Ñ: 8, X: 8, Z: 10, K: 10, W: 10,
}
