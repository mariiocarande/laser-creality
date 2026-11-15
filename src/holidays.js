// Holiday catalogue and a library of silhouettes for tags, ornaments and
// lantern cut-outs. Every shape is drawn in its own base units (bw × bh) on a
// canvas (solid = what gets cut out of the board) and may add engraved
// details as SVG in the same units. Tools scale both to millimetres.

export const HOLIDAYS = [
  { id: 'navidad', icon: '🎄', label: 'Navidad', blurb: 'Esferas, árboles con nombres, faroles y adornos para colgar.' },
  { id: 'pascua', icon: '🐣', label: 'Pascua', blurb: 'Huevos, conejos y pollitos con nombre para las canastas.' },
  { id: 'halloween', icon: '🎃', label: 'Halloween', blurb: 'Calabazas, fantasmas, murciélagos y faroles calados.' },
  { id: 'sanvalentin', icon: '💝', label: 'San Valentín', blurb: 'Corazones con nombres, marcos y detalles para regalar.' },
  { id: 'madrepadre', icon: '💐', label: 'Día de la Madre y del Padre', blurb: 'Flores, tazas, camisas, marcos y crucigramas familiares.' },
  { id: 'cumple', icon: '🎂', label: 'Cumpleaños y fiestas', blurb: 'Globos, tortas, marcadores de copa y souvenirs.' },
]

const f = n => Number(n.toFixed(2)).toString()

// ── canvas helpers (base units) ─────────────────────────────────
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill() }
function poly(ctx, pts, round = 0) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  if (round) { ctx.lineJoin = 'round'; ctx.lineWidth = round; ctx.stroke() }
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill() }
function starPts(cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n
    const rr = i % 2 ? r : R
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  })
}
function heartPath(ctx, x, y, w, h) {
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + h * 0.98)
  ctx.bezierCurveTo(x + w * 0.1, y + h * 0.66, x - w * 0.04, y + h * 0.3, x + w * 0.22, y + h * 0.08)
  ctx.bezierCurveTo(x + w * 0.36, y - h * 0.02, x + w / 2, y + h * 0.1, x + w / 2, y + h * 0.26)
  ctx.bezierCurveTo(x + w / 2, y + h * 0.1, x + w * 0.64, y - h * 0.02, x + w * 0.78, y + h * 0.08)
  ctx.bezierCurveTo(x + w * 1.04, y + h * 0.3, x + w * 0.9, y + h * 0.66, x + w / 2, y + h * 0.98)
  ctx.closePath()
  ctx.fill()
}
function heartD(x, y, w, h) {
  return `M${f(x + w / 2)} ${f(y + h * 0.98)}C${f(x + w * 0.1)} ${f(y + h * 0.66)} ${f(x - w * 0.04)} ${f(y + h * 0.3)} ${f(x + w * 0.22)} ${f(y + h * 0.08)}` +
    `C${f(x + w * 0.36)} ${f(y - h * 0.02)} ${f(x + w / 2)} ${f(y + h * 0.1)} ${f(x + w / 2)} ${f(y + h * 0.26)}` +
    `C${f(x + w / 2)} ${f(y + h * 0.1)} ${f(x + w * 0.64)} ${f(y - h * 0.02)} ${f(x + w * 0.78)} ${f(y + h * 0.08)}` +
    `C${f(x + w * 1.04)} ${f(y + h * 0.3)} ${f(x + w * 0.9)} ${f(y + h * 0.66)} ${f(x + w / 2)} ${f(y + h * 0.98)}Z`
}

// ── svg helpers (base units; lw = line width in base units) ─────
const line = (d, lw) => `<path fill="none" stroke="#000000" stroke-width="${f(lw)}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`
const fill = d => `<path fill="#000000" d="${d}"/>`
const dot = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
const oval = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`
function zigzag(x1, x2, y, amp, step) {
  let d = `M${f(x1)} ${f(y)}`
  let up = true
  for (let x = x1 + step; x <= x2 + 1e-6; x += step) { d += `L${f(x)} ${f(y + (up ? -amp : amp))}`; up = !up }
  return d
}
function snowflake(x, y, s) {
  let d = ''
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    d += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * s)} ${f(y + Math.sin(a) * s)}`
    const bx = x + Math.cos(a) * s * 0.55, by = y + Math.sin(a) * s * 0.55
    for (const side of [-1, 1]) {
      const b = a + side * 0.7
      d += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(b) * s * 0.35)} ${f(by + Math.sin(b) * s * 0.35)}`
    }
  }
  return d
}

// ── shapes ──────────────────────────────────────────────────────
// text: [x, y, w, h] box for the name; sub: optional box for a second line;
// hole: [x, y] centre of the hanging hole (null = the shape has its own).
export const SHAPES = {
  bauble: {
    label: 'Esfera', holidays: ['navidad'], size: [100, 112],
    draw(ctx) { circle(ctx, 50, 62, 50); rrect(ctx, 36, 0, 28, 20, 4) },
    hole: [50, 9], text: [12, 46, 76, 26], sub: [24, 76, 52, 9],
    details: lw => line('M6 40Q50 50 94 40M6 92Q50 102 94 92', lw) + line(snowflake(50, 28, 7), lw),
  },
  star: {
    label: 'Estrella', holidays: ['navidad', 'cumple'], size: [100, 96],
    draw(ctx) { poly(ctx, starPts(50, 52, 49, 23), 6) },
    hole: [50, 20], text: [20, 44, 60, 16], sub: [33, 61, 34, 6],
    details: lw => line('M' + starPts(50, 52, 40, 19).map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z', lw),
  },
  tree: {
    label: 'Arbolito', holidays: ['navidad'], size: [90, 112],
    draw(ctx) {
      poly(ctx, [[45, 2], [70, 34], [60, 34], [80, 62], [68, 62], [88, 92], [2, 92], [22, 62], [10, 62], [30, 34], [20, 34]], 3)
      rrect(ctx, 36, 88, 18, 22, 2)
    },
    hole: [45, 16], text: [16, 60, 58, 17], sub: [24, 80, 42, 7],
    details: lw => fill(dot(38, 44, 2.2) + dot(55, 52, 2.2) + dot(30, 58, 2) + dot(62, 38, 1.8)) + line('M28 36Q45 44 62 36', lw),
  },
  stocking: {
    label: 'Bota', holidays: ['navidad'], size: [82, 112],
    draw(ctx) {
      rrect(ctx, 8, 0, 56, 22, 4)
      ctx.beginPath()
      ctx.moveTo(14, 20); ctx.lineTo(58, 20); ctx.lineTo(58, 66)
      ctx.bezierCurveTo(58, 74, 66, 76, 72, 80)
      ctx.bezierCurveTo(84, 88, 80, 110, 62, 110)
      ctx.lineTo(30, 110)
      ctx.bezierCurveTo(8, 110, 10, 86, 14, 72)
      ctx.closePath(); ctx.fill()
    },
    hole: [18, 10], text: [16, 30, 40, 30], sub: [26, 84, 34, 8],
    details: lw => line('M8 22H64', lw) + line('M18 98Q30 92 44 100', lw),
  },
  bell: {
    label: 'Campana', holidays: ['navidad'], size: [100, 106],
    draw(ctx) {
      circle(ctx, 50, 10, 10)
      ctx.beginPath()
      ctx.moveTo(50, 14)
      ctx.bezierCurveTo(22, 14, 22, 44, 20, 60)
      ctx.bezierCurveTo(18, 74, 6, 80, 4, 88)
      ctx.lineTo(96, 88)
      ctx.bezierCurveTo(94, 80, 82, 74, 80, 60)
      ctx.bezierCurveTo(78, 44, 78, 14, 50, 14)
      ctx.closePath(); ctx.fill()
      circle(ctx, 50, 94, 10)
    },
    hole: [50, 10], text: [24, 42, 52, 22], sub: [30, 70, 40, 7],
    details: lw => line('M10 80Q50 86 90 80', lw),
  },
  gingerbread: {
    label: 'Galletita', holidays: ['navidad'], size: [92, 112],
    draw(ctx) {
      circle(ctx, 46, 22, 20)
      rrect(ctx, 26, 36, 40, 50, 14)
      ellipse(ctx, 18, 50, 18, 9, -0.35); ellipse(ctx, 74, 50, 18, 9, 0.35)
      ellipse(ctx, 34, 92, 11, 19, 0.25); ellipse(ctx, 58, 92, 11, 19, -0.25)
    },
    hole: [46, 9], text: [22, 56, 48, 16], sub: null,
    details: lw => fill(dot(39, 20, 2.2) + dot(53, 20, 2.2) + dot(46, 46, 1.8)) + line('M38 28Q46 34 54 28', lw) +
      line(zigzag(4, 14, 50, 2.5, 2.5) + zigzag(78, 88, 50, 2.5, 2.5), lw),
  },
  egg: {
    label: 'Huevo', holidays: ['pascua'], size: [80, 104],
    draw(ctx) {
      ctx.beginPath()
      ctx.moveTo(40, 2)
      ctx.bezierCurveTo(66, 2, 80, 48, 78, 66)
      ctx.bezierCurveTo(76, 92, 60, 102, 40, 102)
      ctx.bezierCurveTo(20, 102, 4, 92, 2, 66)
      ctx.bezierCurveTo(0, 48, 14, 2, 40, 2)
      ctx.closePath(); ctx.fill()
    },
    hole: [40, 14], text: [12, 48, 56, 18], sub: [22, 70, 36, 7],
    details: lw => line(zigzag(9, 71, 34, 3.5, 5) + zigzag(6, 74, 84, 3.5, 5), lw) + fill(dot(22, 26, 1.8) + dot(40, 24, 1.8) + dot(58, 26, 1.8)),
  },
  bunny: {
    label: 'Conejo', holidays: ['pascua'], size: [90, 122],
    draw(ctx) {
      ellipse(ctx, 30, 32, 11, 32, -0.12); ellipse(ctx, 60, 32, 11, 32, 0.12)
      circle(ctx, 45, 84, 37)
    },
    hole: [45, 56], text: [16, 86, 58, 16], sub: [28, 104, 34, 6],
    details: lw => line(oval(30, 32, 5, 22) + oval(60, 32, 5, 22), lw) + fill(dot(33, 72, 2.6) + dot(57, 72, 2.6)) +
      fill('M41 78L49 78L45 82Z') + line('M45 82Q41 86 37 84M45 82Q49 86 53 84', lw),
  },
  chick: {
    label: 'Pollito', holidays: ['pascua'], size: [92, 98],
    draw(ctx) {
      circle(ctx, 46, 56, 41)
      ellipse(ctx, 40, 12, 5, 9, -0.4); ellipse(ctx, 48, 10, 5, 10, 0); ellipse(ctx, 56, 12, 5, 9, 0.4)
    },
    hole: [46, 26], text: [16, 52, 60, 16], sub: [28, 72, 36, 7],
    details: lw => fill(dot(34, 40, 2.6) + dot(58, 40, 2.6) + 'M42 44L50 44L46 50Z') + line('M8 70Q18 84 30 78', lw),
  },
  pumpkin: {
    label: 'Calabaza', holidays: ['halloween'], size: [112, 100],
    draw(ctx) {
      ellipse(ctx, 22, 60, 21, 33); ellipse(ctx, 90, 60, 21, 33)
      ellipse(ctx, 38, 58, 26, 37); ellipse(ctx, 74, 58, 26, 37); ellipse(ctx, 56, 58, 24, 38)
      ctx.beginPath(); ctx.moveTo(50, 22); ctx.quadraticCurveTo(48, 6, 60, 2); ctx.lineTo(64, 6); ctx.quadraticCurveTo(58, 10, 60, 22); ctx.closePath(); ctx.fill()
    },
    hole: [56, 30], text: [16, 50, 80, 20], sub: [36, 74, 40, 7],
    details: lw => line('M38 24Q30 58 38 92M74 24Q82 58 74 92M22 30Q14 60 22 90M90 30Q98 60 90 90', lw),
  },
  ghost: {
    label: 'Fantasma', holidays: ['halloween'], size: [90, 110],
    draw(ctx) {
      ctx.beginPath()
      ctx.moveTo(4, 46)
      ctx.arc(45, 46, 41, Math.PI, 0)
      ctx.lineTo(86, 98)
      ctx.quadraticCurveTo(79, 110, 72, 98)
      ctx.quadraticCurveTo(65, 86, 58, 98)
      ctx.quadraticCurveTo(51, 110, 45, 98)
      ctx.quadraticCurveTo(38, 86, 31, 98)
      ctx.quadraticCurveTo(24, 110, 17, 98)
      ctx.quadraticCurveTo(10, 86, 4, 98)
      ctx.closePath(); ctx.fill()
    },
    hole: [45, 13], text: [14, 54, 62, 18], sub: [26, 76, 38, 7],
    details: () => fill(oval(33, 36, 5, 7) + oval(57, 36, 5, 7) + oval(45, 46, 4, 3)),
  },
  bat: {
    label: 'Murciélago', holidays: ['halloween'], size: [140, 72],
    draw(ctx) {
      ellipse(ctx, 70, 40, 15, 22)
      circle(ctx, 70, 20, 11)
      poly(ctx, [[61, 16], [62, 2], [68, 11]]); poly(ctx, [[79, 16], [78, 2], [72, 11]])
      ctx.beginPath()
      ctx.moveTo(62, 30)
      ctx.bezierCurveTo(40, 8, 14, 10, 2, 24)
      ctx.quadraticCurveTo(14, 30, 12, 46)
      ctx.quadraticCurveTo(22, 40, 30, 52)
      ctx.quadraticCurveTo(40, 44, 48, 58)
      ctx.quadraticCurveTo(54, 50, 64, 54)
      ctx.closePath(); ctx.fill()
      ctx.save(); ctx.translate(140, 0); ctx.scale(-1, 1)
      ctx.beginPath()
      ctx.moveTo(62, 30)
      ctx.bezierCurveTo(40, 8, 14, 10, 2, 24)
      ctx.quadraticCurveTo(14, 30, 12, 46)
      ctx.quadraticCurveTo(22, 40, 30, 52)
      ctx.quadraticCurveTo(40, 44, 48, 58)
      ctx.quadraticCurveTo(54, 50, 64, 54)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    },
    hole: [70, 22], text: [24, 30, 92, 14], sub: null,
    details: () => '',
  },
  cat: {
    label: 'Gato', holidays: ['halloween'], size: [96, 112],
    draw(ctx) {
      ellipse(ctx, 44, 80, 34, 30)
      circle(ctx, 44, 38, 24)
      poly(ctx, [[24, 28], [22, 4], [38, 18]]); poly(ctx, [[64, 28], [66, 4], [50, 18]])
      ctx.lineCap = 'round'; ctx.lineWidth = 9
      ctx.beginPath(); ctx.moveTo(74, 98); ctx.quadraticCurveTo(98, 96, 90, 70); ctx.stroke()
    },
    hole: [44, 22], text: [16, 70, 56, 16], sub: [24, 90, 40, 6],
    details: lw => fill('M33 36Q36 32 39 36Q36 40 33 36Z' + 'M49 36Q52 32 55 36Q52 40 49 36Z' + 'M41 44L47 44L44 47Z') +
      line('M30 46L18 44M30 49L18 51M58 46L70 44M58 49L70 51', lw),
  },
  moon: {
    label: 'Luna', holidays: ['halloween'], size: [90, 100], lanternOnly: true,
    // Clip + even-odd keeps this a pure fill, so it also works when drawn as a cut-out.
    draw(ctx) {
      ctx.save()
      ctx.beginPath(); ctx.arc(50, 50, 46, 0, Math.PI * 2); ctx.clip()
      ctx.beginPath(); ctx.rect(0, 0, 100, 100); ctx.arc(70, 40, 40, 0, Math.PI * 2); ctx.fill('evenodd')
      ctx.restore()
    },
    hole: null, text: [0, 0, 0, 0], sub: null, details: () => '',
  },
  heart: {
    label: 'Corazón', holidays: ['sanvalentin', 'madrepadre'], size: [100, 92],
    draw(ctx) { heartPath(ctx, 0, 2, 100, 90) },
    hole: [26, 18], text: [18, 34, 64, 20], sub: [30, 58, 40, 7],
    details: lw => line(heartD(8, 9, 84, 76), lw),
  },
  hearts: {
    label: 'Dos corazones', holidays: ['sanvalentin'], size: [136, 96],
    draw(ctx) {
      ctx.save(); ctx.translate(40, 48); ctx.rotate(-0.22); heartPath(ctx, -40, -44, 80, 76); ctx.restore()
      ctx.save(); ctx.translate(96, 48); ctx.rotate(0.22); heartPath(ctx, -40, -44, 80, 76); ctx.restore()
    },
    hole: [68, 12], text: [24, 28, 88, 17], sub: [46, 48, 44, 6],
    details: () => '',
  },
  flower: {
    label: 'Flor', holidays: ['madrepadre', 'pascua'], size: [100, 100],
    draw(ctx) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        circle(ctx, 50 + Math.cos(a) * 28, 50 + Math.sin(a) * 28, 22)
      }
      circle(ctx, 50, 50, 26)
    },
    hole: [50, 14], text: [18, 42, 64, 16], sub: [30, 60, 40, 6],
    details: lw => line(dot(50, 50, 24), lw) + line(Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6
      return `M${f(50 + Math.cos(a) * 30)} ${f(50 + Math.sin(a) * 30)}L${f(50 + Math.cos(a) * 40)} ${f(50 + Math.sin(a) * 40)}`
    }).join(''), lw),
  },
  shirt: {
    label: 'Camisa', holidays: ['madrepadre'], size: [112, 100],
    draw(ctx) {
      poly(ctx, [[34, 4], [44, 2], [56, 12], [68, 2], [78, 4], [110, 22], [98, 44], [86, 38], [86, 98], [26, 98], [26, 38], [14, 44], [2, 22]], 4)
    },
    hole: [56, 22], text: [30, 56, 52, 16], sub: [36, 76, 40, 6],
    details: lw => fill('M52 14L60 14L58 20L62 44L56 50L50 44L54 20Z') + line('M44 2L52 14M68 2L60 14', lw),
  },
  mug: {
    label: 'Taza', holidays: ['madrepadre'], size: [112, 92],
    draw(ctx) {
      rrect(ctx, 4, 6, 76, 84, 10)
      ctx.lineWidth = 11
      ctx.beginPath(); ctx.ellipse(82, 46, 18, 22, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke()
    },
    hole: null, text: [12, 36, 60, 20], sub: [18, 62, 48, 7],
    details: lw => line('M10 16H74', lw),
  },
  balloon: {
    label: 'Globo', holidays: ['cumple'], size: [80, 112],
    draw(ctx) {
      ctx.beginPath()
      ctx.moveTo(40, 2)
      ctx.bezierCurveTo(68, 2, 80, 26, 78, 46)
      ctx.bezierCurveTo(76, 72, 54, 88, 40, 90)
      ctx.bezierCurveTo(26, 88, 4, 72, 2, 46)
      ctx.bezierCurveTo(0, 26, 12, 2, 40, 2)
      ctx.closePath(); ctx.fill()
      poly(ctx, [[34, 98], [46, 98], [40, 88]])
      rrect(ctx, 30, 96, 20, 14, 4)
    },
    hole: [40, 103], text: [10, 36, 60, 18], sub: [20, 58, 40, 7],
    details: lw => line('M20 26Q24 14 34 10', lw * 1.6),
  },
  cake: {
    label: 'Torta', holidays: ['cumple'], size: [112, 104],
    draw(ctx) {
      rrect(ctx, 4, 58, 104, 44, 6)
      rrect(ctx, 18, 30, 76, 32, 6)
      ;[34, 56, 78].forEach(x => {
        rrect(ctx, x - 3.5, 12, 7, 20, 2)
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 6, 8, x, 12); ctx.quadraticCurveTo(x - 6, 8, x, 0); ctx.fill()
      })
    },
    hole: [56, 44], text: [14, 66, 84, 20], sub: [28, 89, 56, 7],
    details: lw => line('M4 66Q14 74 24 66Q34 74 44 66Q54 74 64 66Q74 74 84 66Q94 74 108 66', lw) +
      line('M18 38Q28 44 38 38Q48 44 58 38Q68 44 78 38Q88 44 94 38', lw),
  },
}

export function shapesFor(holiday, { lantern = false } = {}) {
  return Object.entries(SHAPES)
    .filter(([, s]) => s.holidays.includes(holiday) && (lantern || !s.lanternOnly))
    .map(([id, s]) => ({ id, ...s }))
}

// Small preview image of a shape (data URL) for gallery cards and pickers.
export function shapeThumb(shape, px = 96, color = '#e8d0a0') {
  const [bw, bh] = shape.size
  const s = (px * 0.82) / Math.max(bw, bh)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')
  ctx.translate((px - bw * s) / 2, (px - bh * s) / 2)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  shape.draw(ctx)
  if (shape.hole) {
    ctx.globalCompositeOperation = 'destination-out'
    circle(ctx, shape.hole[0], shape.hole[1], Math.max(bw, bh) * 0.035)
  }
  return canvas.toDataURL('image/png')
}

// Lantern card art: a lit panel with the shape cut out of it.
export function lanternThumb(shape, px = 96) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')
  const glow = ctx.createRadialGradient(px / 2, px / 2, 4, px / 2, px / 2, px * 0.55)
  glow.addColorStop(0, '#ffd08a')
  glow.addColorStop(1, '#e07a2a')
  ctx.fillStyle = glow
  ctx.fillRect(px * 0.16, px * 0.1, px * 0.68, px * 0.8)
  ctx.fillStyle = '#e8d0a0'
  ctx.fillRect(px * 0.16, px * 0.1, px * 0.68, px * 0.8)
  const [bw, bh] = shape.size
  const s = (px * 0.48) / Math.max(bw, bh)
  ctx.save()
  ctx.translate(px / 2 - (bw * s) / 2, px / 2 - (bh * s) / 2)
  ctx.scale(s, s)
  ctx.globalCompositeOperation = 'destination-out'
  shape.draw(ctx)
  ctx.restore()
  // Light shows through the cut-out.
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = glow
  ctx.fillRect(px * 0.16, px * 0.1, px * 0.68, px * 0.8)
  return canvas.toDataURL('image/png')
}
