import { downloadDxfs } from './dxf.js'

// Adds a "DXF" button right after an SVG download button. It follows the
// SVG button's enabled state, so each tool keeps a single source of truth.
export function attachDxf(svgButton, getSvgs, baseName, onNote) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dl-btn dl-secondary'
  button.textContent = '⬇ Descargar DXF'
  button.disabled = svgButton.disabled
  svgButton.insertAdjacentElement('afterend', button)

  new MutationObserver(() => {
    button.disabled = svgButton.disabled
    button.hidden = svgButton.hidden || svgButton.style.display === 'none'
  }).observe(svgButton, { attributes: true, attributeFilter: ['disabled', 'hidden', 'style'] })

  button.addEventListener('click', () => {
    const svgs = getSvgs().filter(Boolean)
    if (!svgs.length) return
    const name = typeof baseName === 'function' ? baseName() : baseName
    const { skippedImages } = downloadDxfs(svgs, name)
    if (skippedImages && onNote) {
      onNote('El DXF no lleva las fotos ni imágenes (solo trazos). Para grabar la imagen usá el SVG.')
    }
  })
  return button
}
