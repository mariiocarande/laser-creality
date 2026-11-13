// Shared image upload helpers: drop zone markup, binding and decoding.

const MAX_FILE_BYTES = 25 * 1024 * 1024

export function dropZoneHtml(title = 'Arrastrá, pegá (Ctrl+V) o hacé click', sub = 'JPG, PNG o WEBP — máx. 25 MB') {
  return `
    <div class="drop-zone" data-drop>
      <input type="file" accept="image/*" aria-label="Elegir imagen">
      <span class="up-ico">⬆</span>
      <div class="up-title">${title}</div>
      <div class="up-sub">${sub}</div>
    </div>
    <div class="file-row" data-file-row style="display:none">
      <b data-file-name></b>
      <button class="mini-btn danger" data-file-remove>Quitar</button>
    </div>
    <div class="note-box warn-box" data-file-error style="display:none"></div>`
}

// Decodes an image file into a canvas no larger than maxPx on its long side.
export function readImageFile(file, maxPx) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Formato no soportado. Usá JPG, PNG o WEBP.'))
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error('El archivo supera los 25 MB.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const naturalW = img.naturalWidth || 600
      const naturalH = img.naturalHeight || 600
      const ratio = Math.min(1, maxPx / Math.max(naturalW, naturalH))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(naturalW * ratio))
      canvas.height = Math.max(1, Math.round(naturalH * ratio))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.fillStyle = '#ffffff'   // transparent areas count as white
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ canvas, url, name: file.name || 'imagen pegada', w: canvas.width, h: canvas.height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')) }
    img.src = url
  })
}

// Luminance 0..1 per pixel.
export function canvasToGray(canvas) {
  const { width: w, height: h } = canvas
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }
  return gray
}

// Wires a drop zone rendered with dropZoneHtml(). `isActive` gates clipboard paste.
export function bindDropZone(root, { maxPx, onLoad, onClear, isActive }) {
  const zone = root.querySelector('[data-drop]')
  const input = zone.querySelector('input')
  const row = root.querySelector('[data-file-row]')
  const error = root.querySelector('[data-file-error]')
  let current = null

  const showError = text => {
    error.textContent = text
    error.style.display = text ? 'block' : 'none'
  }

  const sync = () => {
    zone.style.display = current ? 'none' : ''
    row.style.display = current ? 'flex' : 'none'
    root.querySelector('[data-file-name]').textContent = current ? current.name : ''
  }

  const load = async file => {
    if (!file) return
    try {
      const image = await readImageFile(file, maxPx)
      if (current) URL.revokeObjectURL(current.url)
      current = image
      showError('')
      sync()
      onLoad(image)
    } catch (err) {
      showError(err.message)
    }
  }

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag') })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('drag')
    load(e.dataTransfer.files[0])
  })
  input.addEventListener('change', e => load(e.target.files[0]))
  root.querySelector('[data-file-remove]').addEventListener('click', () => {
    if (current) URL.revokeObjectURL(current.url)
    current = null
    input.value = ''
    showError('')
    sync()
    onClear()
  })
  document.addEventListener('paste', e => {
    if (!isActive()) return
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); load(item.getAsFile()) }
  })
  sync()
}
