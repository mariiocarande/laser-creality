# Laser Prep Studio — Creality Falcon 5W

Herramienta web para preparar imágenes y obtener parámetros de grabado/corte optimizados para la grabadora láser **Creality Falcon 5W** (diodo 5W).

## Características

- **7 materiales** soportados con 3 tonos cada uno
- **Parámetros recomendados** (velocidad, potencia, pasadas, DPI, intervalo, aire asistido)
- **Procesamiento de imagen** con algoritmo Floyd-Steinberg para grabado
- **Modo corte** con umbral configurable para siluetas B/N
- **Modo bordes SVG** — detección de contornos y exportación vectorial lista para grabar/cortar
- **Vista previa** original vs. procesada en tiempo real
- **Descarga** de imagen procesada (PNG) o vectores de borde (SVG) para LightBurn, LaserGRBL o Creality Laser

## Materiales soportados

| Material             | Grabado | Corte 3mm | Corte 6mm |
|----------------------|---------|-----------|-----------|
| Madera sólida        | ✅      | ✅        | ✅        |
| Triplay / MDF        | ✅      | ✅        | ✅ (claro)|
| Acrílico             | ✅      | ✅        | ❌        |
| Cuero                | ✅      | ✅        | ❌        |
| Cartón / Papel       | ✅      | ✅        | ❌        |
| Pizarra / Cerámica   | ✅      | ❌        | ❌        |
| Aluminio anodizado   | ✅      | ❌        | ❌        |

## Desarrollo

```bash
npm install
npm run dev      # servidor local en http://localhost:5173
npm run build    # compila a dist/
```

## Uso

1. Abrí la app en el navegador (`npm run dev` o `dist/index.html`)
2. Arrastrá o seleccioná una imagen
3. Elegí el material, el tono y el modo de operación
4. Ajustá los parámetros según el modo:
   - **Grabar** — contraste, brillo, dithering
   - **Cortar** — contraste, brillo, umbral (threshold), grosor
   - **Bordes SVG** — contraste, brillo, sensibilidad de bordes
5. Presioná **⚡ Procesar imagen**
6. Copiá los parámetros mostrados a tu software de grabado
7. Descargá el resultado:
   - Modos Grabar / Cortar → **⬇ Descargar imagen procesada** (PNG)
   - Modo Bordes SVG → **⬇ Descargar SVG para láser** (SVG vectorial)

## Estructura del proyecto

```
laser-prep-falcon5w/
├── index.html         # Estructura HTML
├── style.css          # Estilos (tema industrial dark, fuentes Orbitron + JetBrains Mono)
├── vite.config.js     # Configuración de Vite
├── package.json
├── src/
│   ├── main.js        # Entry point — event wiring y orquestación
│   ├── db.js          # Base de datos de materiales y parámetros
│   ├── state.js       # Estado global de la app
│   ├── imageProcessing.js  # Floyd-Steinberg, Sobel, trazado de contornos, RDP
│   └── ui.js          # Construcción dinámica de grillas y display de parámetros
└── README.md
```

## Procesamiento de imagen

### Modo Grabar
1. Conversión a escala de grises (fórmula de luminancia BT.601)
2. Ajuste de contraste y brillo
3. Inversión opcional
4. **Dithering Floyd-Steinberg** — distribuye el error de cuantización a píxeles vecinos, generando patrones que simulan tonos grises con una impresora de 1 bit

### Modo Cortar
1. Conversión a escala de grises
2. Ajuste de contraste y brillo
3. **Umbral (threshold)** — convierte cada píxel a negro puro o blanco puro para generar una silueta limpia

### Modo Bordes SVG
1. Conversión a escala de grises + ajuste de contraste y brillo
2. **Detección Sobel** — calcula el gradiente de intensidad en X e Y y umbraliza por porcentaje del gradiente máximo (slider "Sensibilidad de bordes")
3. **Trazado de contornos** — recorre los píxeles de borde en 8-conectividad generando polilíneas continuas
4. **Simplificación Ramer-Douglas-Peucker** (ε = 1 px) — reduce puntos redundantes sin perder forma
5. **Exportación SVG** con `stroke="#000000" fill="none" stroke-width="0.1"` — trazo fino (hairline) compatible con LightBurn y LaserGRBL como capa de trazo vectorial

## Parámetros — referencia rápida (Falcon 5W)

> Valores de referencia. **Siempre hacer una prueba en un trozo del mismo material antes de grabar la pieza final.** Los valores pueden variar según el modelo exacto del material, el enfoque del láser y las condiciones ambientales.

| Material           | Tono   | Modo    | Velocidad | Potencia |
|--------------------|--------|---------|-----------|----------|
| Madera sólida      | Clara  | Grabar  | 3000      | 65%      |
| Madera sólida      | Media  | Grabar  | 2500      | 75%      |
| Madera sólida      | Oscura | Grabar  | 2000      | 85%      |
| Madera sólida      | Clara  | Corte 3mm | 300    | 95%      |
| Triplay / MDF      | Medio  | Grabar  | 2000      | 80%      |
| Triplay / MDF      | Medio  | Corte 3mm | 180    | 100%     |
| Acrílico           | Color  | Grabar  | 1500      | 85%      |
| Acrílico           | Color  | Corte 3mm | 120    | 100%     |
| Cuero              | Natural| Grabar  | 3500      | 55%      |
| Aluminio anodizado | Negro  | Grabar  | 1500      | 100%     |

## Seguridad

- Siempre usar **protección ocular** certificada para el rango UV/visible del láser
- **Ventilar** el área de trabajo — muchos materiales generan gases tóxicos
- **Nunca** grabar PVC, cuero cromado ni materiales que liberen cloro al quemarse
- Mantener un **extintor** cerca y nunca dejar el equipo sin supervisión

## Tecnologías

- HTML5 + CSS3 + JavaScript (ES modules)
- [Vite](https://vitejs.dev/) como build tool
- Canvas API para procesamiento de imagen
- Google Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), [DM Sans](https://fonts.google.com/specimen/DM+Sans)

## Licencia

MIT — libre para uso personal y comercial.
