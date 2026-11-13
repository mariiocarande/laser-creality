// Writes the physical resolution (pHYs chunk) into a PNG so laser software
// imports it at the right size instead of assuming 72/96 DPI.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const IHDR_END = 8 + 25   // signature + IHDR chunk (length, type, 13 data bytes, crc)

export async function withDpi(pngBlob, dpi) {
  const src = new Uint8Array(await pngBlob.arrayBuffer())
  const pixelsPerMetre = Math.round(dpi / 0.0254)

  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4)   // "pHYs"
  view.setUint32(8, pixelsPerMetre)
  view.setUint32(12, pixelsPerMetre)
  chunk[16] = 1                             // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)))

  const out = new Uint8Array(src.length + chunk.length)
  out.set(src.subarray(0, IHDR_END), 0)
  out.set(chunk, IHDR_END)
  out.set(src.subarray(IHDR_END), IHDR_END + chunk.length)
  return new Blob([out], { type: 'image/png' })
}
