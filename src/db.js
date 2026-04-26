export const DB = {
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
        cut6mm:  null,
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
    note: 'No se puede cortar con láser diodo. Solo grabado superficial. Humedecer levemente mejora el resultado.',
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
    note: 'Solo aluminio anodizado o con recubrimiento especial. El aluminio puro NO se puede grabar con láser diodo.',
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
}
