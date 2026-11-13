import { dropZoneHtml, bindDropZone, canvasToGray } from '../../imageInput.js'
import { withDpi } from '../../pngDpi.js'
import { state } from '../../state.js'
import { MACHINES } from '../../machines.js'
import { controlsHtml, bindControls } from './form.js'
import { toolLayout, layoutRefs, downloadBlob } from './layout.js'

const SOURCE_PX = 2400
const MAX_OUTPUT_PX = 3000

const model = {
  width: 100,
  dpi: 254,
  blur: 1,
  detail: 0.6,
  brightness: 0,
  contrast: 0.1,
  gamma: 1,
  levels: 0,
  invert: false,
}

const sections = [
  { title: 'Tamaño', fields: [
    { type: 'row', fields: [
      { type: 'number', key: 'width', label: 'Ancho final (mm)', min: 5, step: 1 },
      { type: 'number', key: 'dpi', label: 'Resolución (DPI)', min: 50, max: 1000, step: 1 },
    ] },
    { type: 'hint', text: '254 DPI = 0,1 mm por línea, lo habitual en un láser de diodo.' },
  ] },
  { title: 'Profundidad', fields: [
    { type: 'range', key: 'blur', label: 'Suavizado', min: 0, max: 6, step: 1, format: v => v },
    { type: 'range', key: 'detail', label: 'Realce de detalle', min: 0, max: 2, step: 0.05, format: v => v.toFixed(2) },
    { type: 'range', key: 'brightness', label: 'Brillo', min: -0.5, max: 0.5, step: 0.01, format: v => v.toFixed(2) },
    { type: 'range', key: 'contrast', label: 'Contraste', min: -0.5, max: 1.5, step: 0.05, format: v => v.toFixed(2) },
    { type: 'range', key: 'gamma', label: 'Gamma', min: 0.4, max: 2.5, step: 0.05, format: v => v.toFixed(2) },
    { type: 'range', key: 'levels', label: 'Niveles de profundidad', min: 0, max: 32, step: 1, format: v => (v < 2 ? 'continuo' : v) },
    { type: 'toggle', key: 'invert', label: 'Invertir (claro = más profundo)' },
    { type: 'hint', text: 'Negro = más potencia = más profundo. Los niveles escalonan la profundidad en capas, útil para relieves tipo mapa topográfico.' },
  ] },
]

let source = null
let output = null   // { canvas, w, h }
let refs = null
let timer = 0

export const depthMapTool = {
  id: 'depth',
  icon: '⛰',
  title: 'Mapa de profundidad',
  description: 'Foto → escala de grises lista para grabado 3D por potencia, con suavizado y niveles.',

  mount(root, { onBack }) {
    root.innerHTML = toolLayout({
      icon: this.icon,
      title: this.title,
      intro: 'Prepara una imagen en escala de grises donde el tono controla cuánto se quema: oscuro = más profundo.',
      sourceHtml: dropZoneHtml(),
      controls: controlsHtml(sections),
      note: 'El PNG sale con su resolución guardada, así LightBurn lo importa al tamaño correcto. Grabalo en modo Grayscale (o "3D Slice" si tu versión lo tiene) y hacé una prueba chica: la profundidad real depende del material. Se basa en el brillo de la foto, no en IA: funciona mejor con relieves, monedas, tallas y fotos con luz lateral.',
      downloads: [{ id: 'png', label: '⬇ Descargar PNG' }],
    })
    refs = layoutRefs(root)
    refs.back.addEventListener('click', onBack)
    bindControls(refs.controls, sections, model, schedule)
    bindDropZone(root, {
      maxPx: SOURCE_PX,
      isActive: () => state.view === 'generators' && root.isConnected && !root.hidden,
      onLoad: image => { source = image; update() },
      onClear: () => { source = null; update() },
    })
    refs.download('png').addEventListener('click', download)
    update()
  },
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(update, 120)
}

function boxBlur(src, w, h, radius) {
  if (radius < 1) return src
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const span = 2 * radius + 1
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / span
      sum += src[y * w + Math.min(w - 1, x + radius + 1)] - src[y * w + Math.max(0, x - radius)]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x]
    }
  }
  return out
}

function update() {
  output = null
  refs.download('png').disabled = true
  refs.preview.innerHTML = ''
  if (!source) {
    refs.setEmpty('Subí una foto para empezar')
    refs.setInfo('')
    refs.setWarn('')
    return
  }

  let w = Math.round((model.width / 25.4) * model.dpi)
  const capped = w > MAX_OUTPUT_PX
  w = Math.min(MAX_OUTPUT_PX, Math.max(8, w))
  const h = Math.max(1, Math.round((w * source.h) / source.w))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source.canvas, 0, 0, w, h)

  // Scale blur and detail radius with resolution so the look stays the same.
  const unit = Math.max(1, Math.round(w / 500))
  let gray = boxBlur(canvasToGray(canvas), w, h, model.blur * unit)
  if (model.detail > 0) {
    const soft = boxBlur(gray, w, h, 4 * unit)
    for (let i = 0; i < gray.length; i++) gray[i] += model.detail * (gray[i] - soft[i])
  }

  const image = ctx.createImageData(w, h)
  for (let i = 0; i < gray.length; i++) {
    let v = (gray[i] - 0.5) * (1 + model.contrast) + 0.5 + model.brightness
    v = Math.pow(Math.min(1, Math.max(0, v)), model.gamma)
    if (model.levels >= 2) v = Math.round(v * (model.levels - 1)) / (model.levels - 1)
    if (model.invert) v = 1 - v
    const byte = Math.round(v * 255)
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = byte
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  output = { canvas, w, h }

  const figure = document.createElement('figure')
  figure.className = 'sheet'
  const img = document.createElement('img')
  img.src = canvas.toDataURL('image/png')
  img.alt = 'Mapa de profundidad'
  figure.appendChild(img)
  refs.preview.appendChild(figure)
  refs.setEmpty('')

  const dpi = (w / model.width) * 25.4
  const widthMm = model.width
  const heightMm = (h / w) * widthMm
  refs.setInfo(`<strong>${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm</strong> &nbsp;·&nbsp; ${w} × ${h} px &nbsp;·&nbsp; ${Math.round(dpi)} DPI`)

  const machine = MACHINES[state.machine]
  const warnings = []
  if (capped) warnings.push(`⚠ Limitado a ${MAX_OUTPUT_PX} px de ancho: la resolución efectiva es ${Math.round(dpi)} DPI.`)
  if (widthMm > machine.area.w || heightMm > machine.area.h) warnings.push(`⚠ No entra en el área de la máquina (${machine.area.w} × ${machine.area.h} mm).`)
  refs.setWarn(warnings.join(' '))
  refs.download('png').disabled = false
}

function download() {
  if (!output) return
  const dpi = (output.w / model.width) * 25.4
  output.canvas.toBlob(async blob => {
    if (!blob) return
    downloadBlob(await withDpi(blob, dpi), `profundidad_${Math.round(model.width)}mm.png`)
  }, 'image/png')
}
