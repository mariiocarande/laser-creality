// Tiny declarative form helper for the generators: describe the controls
// once, get markup plus two-way binding to a plain state object.

const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

function fieldHtml(f) {
  switch (f.type) {
    case 'range':
      return `
        <div class="sl-group" data-field="${f.key}">
          <div class="sl-top">
            <span class="sl-nm">${esc(f.label)}</span>
            <span class="sl-val" data-label-for="${f.key}"></span>
          </div>
          <input type="range" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${esc(f.label)}">
        </div>`
    case 'number':
      return `
        <label class="field" data-field="${f.key}"><span class="field-lbl">${esc(f.label)}</span>
          <input class="num-input" type="number" inputmode="decimal" data-key="${f.key}" min="${f.min ?? 0}" step="${f.step ?? 1}"></label>`
    case 'choice':
      return `
        ${f.label ? `<div class="field-lbl" data-field="${f.key}">${esc(f.label)}</div>` : ''}
        <div class="choice-row ${['', '', 'two', 'three', 'four'][f.options.length] || 'three'}" data-field="${f.key}">
          ${f.options.map(([value, label]) =>
            `<button class="choice-btn" data-key="${f.key}" data-value="${value}">${esc(label)}</button>`).join('')}
        </div>`
    case 'select':
      return `
        <label class="field" data-field="${f.key}"><span class="field-lbl">${esc(f.label)}</span>
          <select class="machine-select" data-key="${f.key}">
            ${f.options.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}
          </select></label>`
    case 'textarea':
      return `
        <label class="field" data-field="${f.key}"><span class="field-lbl">${esc(f.label)}</span>
          <textarea class="text-input" data-key="${f.key}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}"></textarea></label>`
    case 'text':
      return `
        <label class="field" data-field="${f.key}"><span class="field-lbl">${esc(f.label)}</span>
          <input class="text-input" type="text" data-key="${f.key}" maxlength="${f.maxLength || 40}" placeholder="${esc(f.placeholder || '')}"></label>`
    case 'toggle':
      return `
        <div class="tog-row" data-field="${f.key}">
          <span class="tog-lbl">${esc(f.label)}</span>
          <button class="tog" data-key="${f.key}" aria-label="${esc(f.label)}"></button>
        </div>`
    case 'row':
      return `<div class="field-grid ${f.fields.length === 3 ? 'three' : 'two'}">${f.fields.map(fieldHtml).join('')}</div>`
    case 'hint':
      return `<p class="hint">${esc(f.text)}</p>`
    case 'html':
      return f.html
    default:
      return ''
  }
}

export function controlsHtml(sections) {
  return sections.map(s => `
    ${s.title ? `<div class="sec-lbl">${esc(s.title)}</div>` : ''}
    ${s.fields.map(fieldHtml).join('')}`).join('')
}

function flatten(sections) {
  const out = []
  const walk = f => (f.type === 'row' ? f.fields.forEach(walk) : out.push(f))
  sections.forEach(s => s.fields.forEach(walk))
  return out
}

// Binds the controls inside `root` to `model`. Returns `sync()` to push
// model values back into the controls (e.g. after code changes the model).
export function bindControls(root, sections, model, onChange) {
  const fields = flatten(sections).filter(f => f.key)
  const byKey = Object.fromEntries(fields.map(f => [f.key, f]))

  const refreshVisibility = () => {
    fields.forEach(f => {
      if (!f.showIf) return
      const visible = f.showIf(model)
      root.querySelectorAll(`[data-field="${f.key}"]`).forEach(node => { node.style.display = visible ? '' : 'none' })
    })
  }

  const sync = () => {
    fields.forEach(f => {
      const value = model[f.key]
      if (f.type === 'select' || f.type === 'textarea' || f.type === 'text') {
        const input = root.querySelector(`[data-key="${f.key}"]`)
        if (input && document.activeElement !== input) input.value = value
      } else if (f.type === 'range' || f.type === 'number') {
        const input = root.querySelector(`input[data-key="${f.key}"]`)
        if (input && document.activeElement !== input) input.value = value
        const label = root.querySelector(`[data-label-for="${f.key}"]`)
        if (label) label.textContent = f.format ? f.format(value) : value
      } else if (f.type === 'choice') {
        root.querySelectorAll(`[data-key="${f.key}"]`).forEach(b => b.classList.toggle('on', b.dataset.value === String(value)))
      } else if (f.type === 'toggle') {
        const button = root.querySelector(`[data-key="${f.key}"]`)
        button.classList.toggle('on', Boolean(value))
        button.setAttribute('aria-pressed', String(Boolean(value)))
      }
    })
    refreshVisibility()
  }

  const onTextInput = e => {
    const f = byKey[e.target.dataset.key]
    if (!f || !['select', 'textarea', 'text'].includes(f.type)) return
    model[f.key] = e.target.value
    refreshVisibility()
    onChange(f.key)
  }
  root.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onTextInput(e) })

  root.addEventListener('input', e => {
    if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text')) {
      onTextInput(e)
      return
    }
    const f = byKey[e.target.dataset.key]
    if (!f || (f.type !== 'range' && f.type !== 'number')) return
    const value = parseFloat(String(e.target.value).replace(',', '.'))
    if (!Number.isFinite(value)) return
    const min = f.min ?? -Infinity
    const max = f.type === 'number' && f.max !== undefined ? f.max : Infinity
    if (value < min || value > max) return
    model[f.key] = value
    sync()
    onChange(f.key)
  })

  root.addEventListener('click', e => {
    const target = e.target.closest('[data-key]')
    if (!target || !root.contains(target)) return
    const f = byKey[target.dataset.key]
    if (!f) return
    if (f.type === 'choice') model[f.key] = isNaN(Number(target.dataset.value)) ? target.dataset.value : Number(target.dataset.value)
    else if (f.type === 'toggle') model[f.key] = !model[f.key]
    else return
    sync()
    onChange(f.key)
  })

  sync()
  return sync
}
