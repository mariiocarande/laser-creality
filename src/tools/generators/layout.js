// Shared two-column layout for a generator: controls on the left,
// preview and export on the right. Element ids are scoped with `data-role`.

export function toolLayout({ icon, title, intro, sourceHtml = '', controls, note, downloads }) {
  return `
    <div class="gen-head">
      <button class="mini-btn gen-back" data-role="back">← Generadores</button>
      <div>
        <div class="gen-title">${icon} ${title}</div>
        <div class="gen-intro">${intro}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        ${sourceHtml ? `
        <div class="panel" style="margin-bottom:16px">
          <div class="panel-hd"><span class="panel-hd-ico">📁</span><span class="panel-hd-txt">Imagen</span></div>
          <div class="panel-body">${sourceHtml}</div>
        </div>` : ''}
        <div class="panel">
          <div class="panel-hd"><span class="panel-hd-ico">⚙️</span><span class="panel-hd-txt">Ajustes</span></div>
          <div class="panel-body" data-role="controls">${controls}</div>
        </div>
      </div>
      <div class="right-col">
        <div class="panel">
          <div class="panel-hd"><span class="panel-hd-ico">👁</span><span class="panel-hd-txt">Vista previa</span></div>
          <div class="sheet-area">
            <div class="prev-empty" data-role="empty">
              <span class="prev-empty-ico">${icon}</span>
              <div class="prev-empty-txt" data-role="empty-txt"></div>
            </div>
            <div class="sheet-list" data-role="preview"></div>
          </div>
          <div class="output-info" data-role="info" style="display:none"></div>
        </div>
        <div class="panel">
          <div class="panel-hd"><span class="panel-hd-ico">⬇</span><span class="panel-hd-txt">Exportar</span></div>
          <div class="panel-body">
            <div class="note-box warn-box" data-role="warn" style="display:none"></div>
            <div class="note-box"><strong>📝 Nota: </strong>${note}</div>
            ${downloads.map(d => `<button class="dl-btn" data-download="${d.id}" disabled>${d.label}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`
}

export function layoutRefs(root) {
  const q = role => root.querySelector(`[data-role="${role}"]`)
  return {
    back: q('back'),
    controls: q('controls'),
    empty: q('empty'),
    emptyText: q('empty-txt'),
    preview: q('preview'),
    info: q('info'),
    warn: q('warn'),
    download: id => root.querySelector(`[data-download="${id}"]`),
    setInfo(html) { this.info.innerHTML = html; this.info.style.display = html ? 'block' : 'none' },
    setWarn(text) { this.warn.textContent = text; this.warn.style.display = text ? 'block' : 'none' },
    setEmpty(text) {
      this.emptyText.textContent = text || ''
      this.empty.style.display = text ? 'block' : 'none'
    },
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = filename
  a.href = url
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
