// QR code → vector path. Dark modules become filled squares; each row's
// consecutive dark modules merge into one rectangle to keep files small.

import qrcode from 'qrcode-generator'

// The library encodes text as Latin-1 by default; use UTF-8 so accents and
// emoji in links or messages survive.
qrcode.stringToBytes = text => Array.from(new TextEncoder().encode(text))

export function qrMatrix(text, level = 'M') {
  const qr = qrcode(0, level)
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  const dark = []
  for (let r = 0; r < size; r++) {
    const row = []
    for (let c = 0; c < size; c++) row.push(qr.isDark(r, c))
    dark.push(row)
  }
  return { size, dark }
}

const fmt = n => Number(n.toFixed(3)).toString()

// Modules of size `cell` mm with the top-left corner at (x, y).
// `skip(r, c)` leaves modules empty (e.g. under a centre label).
export function qrPath({ size, dark }, x, y, cell, skip = () => false) {
  let d = ''
  for (let r = 0; r < size; r++) {
    let c = 0
    while (c < size) {
      if (!dark[r][c] || skip(r, c)) { c++; continue }
      let end = c
      while (end + 1 < size && dark[r][end + 1] && !skip(r, end + 1)) end++
      d += `M${fmt(x + c * cell)} ${fmt(y + r * cell)}h${fmt((end - c + 1) * cell)}v${fmt(cell)}h${fmt(-(end - c + 1) * cell)}Z`
      c = end + 1
    }
  }
  return d
}
