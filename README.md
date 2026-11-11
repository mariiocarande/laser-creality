# Laser Prep Studio

Herramientas web para grabadoras láser de diodo: preparar imágenes, generar cajas con encastre y personalizar diseños. Soporta múltiples marcas y modelos con escalado automático de parámetros. El equipo por defecto es la **Creality Falcon 5W**.

## Herramientas

La app se organiza en pestañas. El selector de **equipo láser** es global: al cambiarlo se recalculan los parámetros y el área de trabajo en todas.

### 🖼 Preparar imagen
- **7 materiales** con 3 tonos cada uno y **parámetros recomendados** (velocidad, potencia, pasadas, DPI, intervalo, aire asistido)
- **Grabar** con dithering Floyd-Steinberg, **Cortar** con umbral para siluetas B/N y **Bordes SVG** con detección de contornos
- Vista previa original vs. procesada y descarga en PNG o SVG

### 📦 Cajas
- Caja rectangular con **finger joints** (dientes), medidas exteriores o interiores
- Grosor de material, ancho de diente y **compensación de kerf** configurables
- **Presets**: 12 cajas listas (mazo de cartas, joyero, caja de té, organizador, regalo, etc.) que cargan medidas, tapa y divisores de una; además podés **guardar tus propias configuraciones** en el navegador
- **Divisores internos**: columnas y filas (hasta 8 × 8) que se encastran en cruz y quedan sueltos dentro de la caja
- Cinco tapas: **abierta**, **encastrada** (caja cerrada), **suelta** (tapa lisa con tope interior), **corrediza** (corre entre guías pegadas a los laterales) y **con bisagra** (orejas de la tapa que giran en agujeros de los laterales)
- **Vista 3D interactiva** (three.js) de la caja armada: girar, zoom y mover; vistas de perspectiva, frente, planta y lateral; separar las piezas, abrir la tapa con animación, giro automático, cotas, grilla, ocultar piezas con un click y exportar la vista a PNG. El material elegido cambia el aspecto (veta de madera, acrílico translúcido)
- Las piezas se acomodan solas en el área de la máquina; si no entran en una plancha se reparten en varias
- Parámetros de corte según material y equipo, largo de corte y tiempo estimado
- Exporta **SVG en milímetros reales** (trazo rojo = corte)

### 〰 Vectorizar
- Convierte un logo, silueta o dibujo (PNG, JPG, WEBP, SVG; también pegando con Ctrl+V) en **trazos cerrados reales**, con huecos incluidos
- Umbral, invertir, suavizado de bordes, filtro de manchas, precisión del trazo, **curvas Bézier** y opción de solo silueta exterior
- Salida como **corte** (contorno rojo), **grabado** (relleno negro) o ambas capas
- **Contorno de corte alrededor** (recto, redondeado o círculo) con margen y agujero para colgar
- Ancho final en mm y exportación SVG a tamaño real; todo se procesa en el navegador

### ✨ Personalizar
- Cargá un diseño base (**SVG**, PNG o JPG) y definí su ancho final en mm — o trabajá solo con texto
- Lista de **nombres, uno por línea**: se genera una pieza por nombre, todas en la misma plancha
- 3 tipografías; el texto se exporta **convertido a trazos**
- **Contorno de corte** recto, redondeado o circular, con margen y **agujero para colgar**
- Exporta SVG en mm: rojo = corte, negro = grabado

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

## Equipos soportados

| Marca      | Modelo          | Potencia | Área de trabajo   |
|------------|-----------------|----------|-------------------|
| Creality   | Falcon 5W       | 5 W      | 400 × 415 mm      |
| Creality   | Falcon2 22W     | 22 W     | 400 × 415 mm      |
| Sculpfun   | S9              | 5.5 W    | 410 × 420 mm      |
| Sculpfun   | S10             | 10 W     | 410 × 420 mm      |
| Sculpfun   | S30 Pro Max     | 20 W     | 600 × 600 mm      |
| xTool      | D1 Pro 20W      | 20 W     | 430 × 390 mm      |
| xTool      | S1 40W          | 40 W     | 498 × 319 mm      |
| Atomstack  | A20 Pro         | 20 W     | 400 × 400 mm      |
| Atomstack  | X20 Pro         | 20 W     | 800 × 800 mm      |
| Ortur      | LM3             | 10 W     | 400 × 400 mm      |

## Uso (Preparar imagen)

1. Abrí la app en el navegador (`npm run dev` o `dist/index.html`)
2. Seleccioná tu **equipo láser** en el selector de arriba (por defecto, Falcon 5W)
3. Arrastrá o seleccioná una imagen
4. Elegí el material, el tono y el modo de operación
5. Ajustá los parámetros según el modo:
   - **Grabar** — contraste, brillo, dithering
   - **Cortar** — contraste, brillo, umbral (threshold), grosor
   - **Bordes SVG** — contraste, brillo, sensibilidad de bordes
6. Presioná **⚡ Procesar imagen**
7. Copiá los parámetros mostrados a tu software de grabado
8. Descargá el resultado:
   - Modos Grabar / Cortar → **⬇ Descargar imagen procesada** (PNG)
   - Modo Bordes SVG → **⬇ Descargar SVG para láser** (SVG vectorial)

## Estructura del proyecto

```
laser-prep-falcon5w/
├── index.html         # Estructura HTML (una <section class="view"> por pestaña)
├── style.css          # Estilos (tema industrial dark, fuentes Orbitron + JetBrains Mono)
├── vite.config.js     # Configuración de Vite
├── package.json
├── src/
│   ├── main.js             # Entry point — pestañas y selector de equipo
│   ├── state.js            # Estado global + suscripción a cambios de equipo
│   ├── machines.js         # Registro de equipos láser y escalado de parámetros
│   ├── db.js               # Base de datos de materiales y parámetros base
│   ├── ui.js               # Grillas y display de parámetros (Preparar imagen)
│   ├── imageProcessing.js  # Floyd-Steinberg, Sobel, trazado de contornos, RDP
│   ├── vectorize.js        # Imagen → contornos cerrados (trazado, simplificación, Bézier)
│   ├── pieceOutline.js     # Contorno de corte y agujero, compartido por Vectorizar y Personalizar
│   ├── boxGeometry.js      # Geometría de cajas: dientes, esquinas y kerf
│   ├── boxPresets.js       # Presets de cajas y guardado en localStorage
│   ├── box3d.js            # Vista 3D de la caja (three.js, se carga bajo demanda)
│   ├── sheets.js           # Acomodo en planchas, armado y descarga de SVG
│   └── tools/
│       ├── imagePrep.js    # Pestaña Preparar imagen
│       ├── boxTool.js      # Pestaña Cajas
│       ├── vectorTool.js   # Pestaña Vectorizar
│       └── customTool.js   # Pestaña Personalizar
└── README.md
```

## Cómo funciona el vectorizador

1. Escala de grises (lo transparente cuenta como blanco), suavizado opcional y **umbral** a una máscara blanco/negro
2. **Trazado de bordes** siguiendo las aristas de los píxeles: cada frontera sale como un lazo cerrado, con sentido distinto para contornos y huecos
3. Los vértices pasan al punto medio de cada arista, para que el escalonado de los píxeles no llegue al resultado
4. **Simplificación Ramer-Douglas-Peucker** según la precisión elegida
5. **Curvas Bézier** que pasan por los puntos, manteniendo las esquinas marcadas como esquinas

## Cómo se arma una caja

Cada panel es un rectángulo cuyos cuatro bordes llevan un perfil macho, hembra o liso. Los dientes se reparten en una cantidad impar sobre el largo del borde menos las dos esquinas; cada esquina (un cuadrado del grosor del material) pertenece a un solo panel (frente/atrás), así las piezas nunca se pisan. El **kerf** se compensa agrandando cada contorno medio kerf hacia afuera, de modo que el encastre quede firme.

Las tapas corrediza y con bisagra llevan piezas que se pegan (guías o apoyos) y, en la de bisagra, la tapa se coloca mientras se arma la caja. Son diseños nuevos: conviene probarlos primero en chico.

Para medir tu kerf: cortá un cuadrado de 100 mm, medilo con calibre y calculá `(100 − medida) ÷ 2`.

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

## Parámetros — referencia rápida (Creality Falcon 5W)

> Valores de referencia para el Falcon 5W. Para otros equipos, la app escala automáticamente los parámetros. **Siempre hacer una prueba en un trozo del mismo material antes de grabar la pieza final.** Los valores pueden variar según el modelo exacto del material, el enfoque del láser y las condiciones ambientales.

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
- [three.js](https://threejs.org/) para la vista 3D de las cajas
- [opentype.js](https://opentype.js.org/) para convertir texto a trazos
- Tipografías vía [Fontsource](https://fontsource.org/): Pacifico, Bebas Neue, DM Sans
- Google Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), [DM Sans](https://fonts.google.com/specimen/DM+Sans)

## Licencia

MIT — libre para uso personal y comercial.
