/* ============================================================
   Laser Prep Studio — Creality Falcon 5W
   main.js
   ============================================================ */

// ──────────────────────────────────────────────────────────────
//  DATABASE — Parámetros para Creality Falcon 5W (diodo 5W)
//  Estructura: material → color (light/medium/dark) → modo
//  Unidades: speed = mm/min | power = % | interval = mm
// ──────────────────────────────────────────────────────────────
const DB = {
  wood: {
    name: 'Madera sólida',
    icon: '🪵',
    note: 'Usar protección ocular. Ventilar bien el área. Limpiar hollín con paño seco.',
    colors: {
      light: {
        label: 'Clara (Arce, Tilo, Pino)',
        sw: '#f0d9a0',
        engrave: { speed: 3000, power: 65,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 300,  power: 95,  passes: 2, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  { speed: 160,  power: 100, passes: 4, interval: 0.1, dpi: 254, air: true  },
      },
      medium: {
        label: 'Media (Cerezo, Olmo, Roble)',
        sw: '#c8913a',
        engrave: { speed: 2500, power: 75,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 250,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  { speed: 130,  power: 100, passes: 5, interval: 0.1, dpi: 254, air: true  },
      },
      dark: {
        label: 'Oscura (Nogal, Ébano)',
        sw: '#5c3616',
        engrave: { speed: 2000, power: 85,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 200,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  { speed: 100,  power: 100, passes: 6, interval: 0.1, dpi: 254, air: true  },
      },
    },
  },

  plywood: {
    name: 'Triplay / MDF',
    icon: '📋',
    note: 'El MDF puede generar humo denso. Ventilar obligatorio. No usar en espacios cerrados.',
    colors: {
      light: {
        label: 'Claro — Triplay 3mm',
        sw: '#e8d0a0',
        engrave: { speed: 2500, power: 70,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 200,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  { speed: 100,  power: 100, passes: 5, interval: 0.1, dpi: 254, air: true  },
      },
      medium: {
        label: 'Medio — MDF estándar 3mm',
        sw: '#c0a060',
        engrave: { speed: 2000, power: 80,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 180,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  { speed: 90,   power: 100, passes: 6, interval: 0.1, dpi: 254, air: true  },
      },
      dark: {
        label: 'Oscuro — MDF pintado / teñido',
        sw: '#604020',
        engrave: { speed: 1800, power: 85,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 150,  power: 100, passes: 4, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  null, // No recomendado con 5W
      },
    },
  },

  acrylic: {
    name: 'Acrílico',
    icon: '💎',
    note: 'Nunca grabar acrílico transparente sin capa de pintura/papel. Para corte, retirar film protector.',
    colors: {
      light: {
        label: 'Transparente / Blanco',
        sw: '#e8f0f8',
        engrave: { speed: 2000, power: 80,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 150,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  null,
      },
      medium: {
        label: 'Colores (rojo, azul, verde…)',
        sw: '#5588cc',
        engrave: { speed: 1500, power: 85,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 120,  power: 100, passes: 3, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  null,
      },
      dark: {
        label: 'Negro / Oscuro',
        sw: '#222830',
        engrave: { speed: 1200, power: 80,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 100,  power: 100, passes: 4, interval: 0.1, dpi: 254, air: true  },
        cut6mm:  null,
      },
    },
  },

  leather: {
    name: 'Cuero',
    icon: '🟫',
    note: 'Usar solo cuero vegetal o artificial. El cuero cromado emite vapores tóxicos al quemarse.',
    colors: {
      light: {
        label: 'Natural / Crudo',
        sw: '#d4b896',
        engrave: { speed: 3500, power: 55, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 400,  power: 90, passes: 2, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
      medium: {
        label: 'Marrón medio',
        sw: '#8b5e3c',
        engrave: { speed: 3000, power: 65, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 350,  power: 95, passes: 2, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
      dark: {
        label: 'Negro / Oscuro',
        sw: '#2a2220',
        engrave: { speed: 2500, power: 70,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 300,  power: 100, passes: 2, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
    },
  },

  cardboard: {
    name: 'Cartón / Papel',
    icon: '📦',
    note: 'Riesgo de incendio. Nunca dejar sin supervisión. Usar pasadas lentas en papel delgado.',
    colors: {
      light: {
        label: 'Papel blanco / Bond',
        sw: '#f5f5f0',
        engrave: { speed: 4000, power: 40, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 600,  power: 75, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
      medium: {
        label: 'Cartón estándar 2–3mm',
        sw: '#d4b878',
        engrave: { speed: 3500, power: 55, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 500,  power: 85, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
      dark: {
        label: 'Kraft / Cartón oscuro',
        sw: '#7a5c30',
        engrave: { speed: 3000, power: 65, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm:  { speed: 400,  power: 90, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut6mm:  null,
      },
    },
  },

  slate: {
    name: 'Pizarra / Cerámica',
    icon: '🪨',
    note: 'No se puede cortar con 5W. Solo grabado superficial. Humedecer levemente mejora el resultado.',
    noCut: true,
    colors: {
      light: {
        label: 'Gris claro',
        sw: '#b0b8c0',
        engrave: { speed: 2500, power: 85, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
      medium: {
        label: 'Gris medio',
        sw: '#6a7880',
        engrave: { speed: 2000, power: 90, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
      dark: {
        label: 'Negro / Pizarra oscura',
        sw: '#282e34',
        engrave: { speed: 1800, power: 95, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
    },
  },

  aluminum: {
    name: 'Aluminio anodizado',
    icon: '🔩',
    note: 'Solo aluminio anodizado o con recubrimiento especial. El aluminio puro NO se puede grabar con diodo 5W.',
    noCut: true,
    colors: {
      light: {
        label: 'Plateado / Dorado claro',
        sw: '#d0d8e0',
        engrave: { speed: 2000, power: 90,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
      medium: {
        label: 'Rojo / Azul / Verde',
        sw: '#4466aa',
        engrave: { speed: 1800, power: 95,  passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
      dark: {
        label: 'Negro anodizado',
        sw: '#1e2428',
        engrave: { speed: 1500, power: 100, passes: 1, interval: 0.1, dpi: 254, air: false },
        cut3mm: null, cut6mm: null,
      },
    },
  },
};

// ──────────────────────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────────────────────
const state = {
  material:     'wood',
  color:        'medium',
  mode:         'engrave',   // 'engrave' | 'cut'
  thickness:    '3mm',       // '3mm' | '6mm'
  contrast:     1.2,
  brightness:   0,
  threshold:    128,
  dither:       true,
  invert:       false,
  originalSrc:  null,
  processedSrc: null,
  activeTab:    'original',
};

// ──────────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────────
function init() {
  buildMaterialGrid();
  buildColorOpts();
  updateSettingsDisplay();
}

// ──────────────────────────────────────────────────────────────
//  BUILD UI
// ──────────────────────────────────────────────────────────────
function buildMaterialGrid() {
  const g = document.getElementById('mat-grid');
  g.innerHTML = '';
  Object.entries(DB).forEach(([key, mat]) => {
    const d = document.createElement('div');
    d.className = 'mat-btn' + (key === state.material ? ' on' : '');
    d.dataset.mat = key;
    d.innerHTML = `<span class="mat-ico">${mat.icon}</span><span class="mat-nm">${mat.name}</span>`;
    d.onclick = () => setMaterial(key);
    g.appendChild(d);
  });
}

function buildColorOpts() {
  const mat = DB[state.material];
  const c = document.getElementById('col-opts');
  c.innerHTML = '';
  Object.entries(mat.colors).forEach(([key, col]) => {
    const d = document.createElement('div');
    d.className = 'col-opt' + (key === state.color ? ' on' : '');
    d.dataset.col = key;
    d.innerHTML = `
      <span class="swatch" style="background:${col.sw}"></span>
      <span class="col-lbl">${col.label}</span>
      <span class="col-chk">✓</span>`;
    d.onclick = () => setColor(key);
    c.appendChild(d);
  });

  // Material safety note
  const nb = document.getElementById('mat-note');
  if (mat.note) {
    nb.textContent = '⚠ ' + mat.note;
    nb.style.display = 'block';
  } else {
    nb.style.display = 'none';
  }
}

// ──────────────────────────────────────────────────────────────
//  STATE SETTERS
// ──────────────────────────────────────────────────────────────
function setMaterial(key) {
  state.material = key;
  state.color = 'medium';
  document.querySelectorAll('.mat-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.mat === key)
  );
  buildColorOpts();
  // If material can't be cut and mode is cut → fallback to engrave
  if (DB[key].noCut && state.mode === 'cut') setMode('engrave');
  updateSettingsDisplay();
}

function setColor(key) {
  state.color = key;
  document.querySelectorAll('.col-opt').forEach(b =>
    b.classList.toggle('on', b.dataset.col === key)
  );
  updateSettingsDisplay();
}

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === m)
  );
  const thickRow   = document.getElementById('thick-row');
  const threshGrp  = document.getElementById('thresh-group');
  const ditherRow  = document.getElementById('dither-row');

  if (m === 'cut') {
    thickRow.style.display  = 'grid';
    threshGrp.style.display = 'block';
    ditherRow.style.display = 'none';
  } else {
    thickRow.style.display  = 'none';
    threshGrp.style.display = 'none';
    ditherRow.style.display = 'flex';
  }
  updateSettingsDisplay();
}

function setThick(t) {
  state.thickness = t;
  document.querySelectorAll('.thick-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.t === t)
  );
  updateSettingsDisplay();
}

function toggleDither() {
  state.dither = !state.dither;
  document.getElementById('tog-dither').classList.toggle('on', state.dither);
}

function toggleInvert() {
  state.invert = !state.invert;
  document.getElementById('tog-invert').classList.toggle('on', state.invert);
}

function onSlider() {
  state.contrast   = parseFloat(document.getElementById('sl-contrast').value);
  state.brightness = parseFloat(document.getElementById('sl-bright').value);
  state.threshold  = parseInt(document.getElementById('sl-thresh').value);
  document.getElementById('lbl-contrast').textContent = state.contrast.toFixed(2);
  document.getElementById('lbl-bright').textContent   = state.brightness;
  document.getElementById('lbl-thresh').textContent   = state.threshold;
}

// ──────────────────────────────────────────────────────────────
//  SETTINGS DISPLAY
// ──────────────────────────────────────────────────────────────
function updateSettingsDisplay() {
  const mat = DB[state.material];
  const col = mat.colors[state.color];

  let s;
  if (state.mode === 'engrave') {
    s = col.engrave;
  } else {
    s = col[state.thickness === '3mm' ? 'cut3mm' : 'cut6mm'];
  }

  const warn = document.getElementById('no-cut-warn');

  if (!s) {
    warn.style.display = 'block';
    ['val-speed','val-power','val-passes','val-interval','val-dpi','val-air']
      .forEach(id => document.getElementById(id).textContent = '—');
  } else {
    warn.style.display = 'none';
    document.getElementById('val-speed').textContent    = s.speed;
    document.getElementById('val-power').textContent    = s.power;
    document.getElementById('val-passes').textContent   = s.passes;
    document.getElementById('val-interval').textContent = s.interval;
    document.getElementById('val-dpi').textContent      = s.dpi;
    document.getElementById('val-air').textContent      = s.air ? '✓ Sí' : '✕ No';
  }

  document.getElementById('note-text').textContent =
    mat.note || 'Verificá siempre en un trozo de prueba antes de grabar la pieza final.';
}

// ──────────────────────────────────────────────────────────────
//  IMAGE UPLOAD
// ──────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

document.getElementById('change-btn').addEventListener('click', () => fileInput.click());

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = ev => {
    state.originalSrc  = ev.target.result;
    state.processedSrc = null;

    // Show thumbnail
    document.getElementById('drop-zone').style.display = 'none';
    const thumbRow = document.getElementById('thumb-row');
    thumbRow.style.display = 'flex';
    document.getElementById('thumb-img').src         = ev.target.result;
    document.getElementById('thumb-name').textContent = file.name;
    document.getElementById('thumb-size').textContent = (file.size / 1024).toFixed(0) + ' KB';

    // Show original preview
    showOriginal();
    document.getElementById('proc-btn').disabled = false;
  };
  reader.readAsDataURL(file);
}

function showOriginal() {
  const img   = document.getElementById('prev-img');
  const empty = document.getElementById('prev-empty');
  empty.style.display = 'none';
  img.src             = state.originalSrc;
  img.style.display   = 'block';
  state.activeTab     = 'original';
  document.querySelectorAll('.prev-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === 'original')
  );
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.prev-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === tab)
  );

  const img   = document.getElementById('prev-img');
  const empty = document.getElementById('prev-empty');

  if (tab === 'original') {
    if (state.originalSrc) {
      img.src = state.originalSrc;
      img.style.display   = 'block';
      empty.style.display = 'none';
    } else {
      img.style.display   = 'none';
      empty.style.display = 'block';
    }
  } else {
    if (state.processedSrc) {
      img.src = state.processedSrc;
      img.style.display   = 'block';
      empty.style.display = 'none';
    } else {
      img.style.display   = 'none';
      empty.style.display = 'block';
      empty.querySelector('.prev-empty-txt').textContent =
        'Presioná "Procesar imagen" primero';
    }
  }
}

// ──────────────────────────────────────────────────────────────
//  IMAGE PROCESSING — Canvas API
// ──────────────────────────────────────────────────────────────

/**
 * Clamp a value between 0 and 255.
 */
function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Convert RGBA pixel data to grayscale in-place.
 * Applies contrast, brightness and optional inversion.
 */
function toGray(data, contrast, brightness, invert) {
  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula (BT.601)
    let g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g = clamp((g - 128) * contrast + 128 + brightness);
    if (invert) g = 255 - g;
    data[i] = data[i + 1] = data[i + 2] = g;
    // Alpha (data[i+3]) stays untouched
  }
}

/**
 * Floyd-Steinberg dithering — ideal for laser engraving.
 * Converts grayscale to pure B/W distributing quantization error
 * to neighboring pixels.
 */
function floydSteinberg(data, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i   = (y * w + x) * 4;
      const old = data[i];
      const nw  = old < 128 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = nw;
      const err = old - nw;

      if (x + 1 < w) {
        const j = (y * w + (x + 1)) * 4;
        data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 7 / 16);
      }
      if (y + 1 < h) {
        if (x - 1 >= 0) {
          const j = ((y + 1) * w + (x - 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 3 / 16);
        }
        {
          const j = ((y + 1) * w + x) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 5 / 16);
        }
        if (x + 1 < w) {
          const j = ((y + 1) * w + (x + 1)) * 4;
          data[j] = data[j + 1] = data[j + 2] = clamp(data[j] + err * 1 / 16);
        }
      }
    }
  }
}

/**
 * Apply a hard threshold — used for cut mode (pure B/W silhouette).
 */
function applyThreshold(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Main processing pipeline. Runs asynchronously to avoid blocking the UI.
 */
function processImage() {
  if (!state.originalSrc) return;

  const overlay = document.getElementById('processing-overlay');
  overlay.classList.add('show');

  // Defer to next tick so the overlay renders before heavy computation
  setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      const cv  = document.getElementById('cv');
      const MAX = 1200; // Max dimension to avoid memory issues
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      cv.width  = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const id = ctx.getImageData(0, 0, w, h);
      const d  = id.data;

      // Step 1: Grayscale + contrast/brightness/invert
      toGray(d, state.contrast, state.brightness, state.invert);

      // Step 2: Mode-specific processing
      if (state.mode === 'cut') {
        applyThreshold(d, state.threshold);
      } else if (state.dither) {
        floydSteinberg(d, w, h);
      }

      ctx.putImageData(id, 0, 0);
      state.processedSrc = cv.toDataURL('image/png');

      overlay.classList.remove('show');
      switchTab('processed');
      document.getElementById('dl-btn').disabled = false;
    };
    img.src = state.originalSrc;
  }, 50);
}

/**
 * Trigger download of the processed image.
 */
function downloadProcessed() {
  if (!state.processedSrc) return;
  const a = document.createElement('a');
  a.download = `laser_${state.material}_${state.color}_${state.mode}.png`;
  a.href     = state.processedSrc;
  a.click();
}

// ──────────────────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────────────────
init();
