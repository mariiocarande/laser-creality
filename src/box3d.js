// Interactive 3D preview of the assembled box (three.js).
// Box space: X = width, Y = height (up), Z = depth; the front faces +Z.
// Panel placement comes from buildBox(), so the model always matches the cut file.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const BURNT_EDGE_COLOR = 0x3a2413
const OUTLINE_COLOR = 0x1c1209
const ACCENT_COLOR = 0xff6b1a
const EXPLODE_DISTANCE = 0.6      // fraction of the largest box dimension
const LID_OPEN_ANGLE = 1.85       // radians
const TWEEN_MS = 450
const CLICK_TOLERANCE_PX = 5
const GRAIN_TILE_MM = 140
const GRAIN_PX = 1024
const CAMERA_TWEEN_MS = 520
const ENGRAVE_PX_PER_MM = 6
const ENGRAVE_MAX_PX = 2048
const HIGHLIGHT_COLOR = 0xffb020

const VIEW_DIRECTIONS = {
  perspective: new THREE.Vector3(0.9, 0.75, 1.3).normalize(),
  front: new THREE.Vector3(0, 0, 1),
  top:   new THREE.Vector3(0, 1, 0.0001).normalize(),
  side:  new THREE.Vector3(1, 0, 0),
}

const ORIENTATIONS = {
  flat:     new THREE.Euler(-Math.PI / 2, 0, 0),
  upright:  new THREE.Euler(0, 0, 0),
  sideways: new THREE.Euler(0, -Math.PI / 2, 0),
}

// Procedural wood: soft growth bands, fine fibres and a few darker streaks.
// Deterministic so the grain does not change between renders.
function createGrainCanvas() {
  const size = GRAIN_PX
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // Broad growth bands (tileable: whole number of waves across the tile).
  for (let i = 0; i < 26; i++) {
    const y = random() * size
    const h = 8 + random() * 40
    const g = ctx.createLinearGradient(0, y - h, 0, y + h)
    const a = 0.03 + random() * 0.06
    g.addColorStop(0, 'rgba(120, 72, 30, 0)')
    g.addColorStop(0.5, `rgba(120, 72, 30, ${a})`)
    g.addColorStop(1, 'rgba(120, 72, 30, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * (1 + (i % 3)) + i) * (3 + random() * 2)
      x === 0 ? ctx.moveTo(x, yy - h) : ctx.lineTo(x, yy - h)
    }
    for (let x = size; x >= 0; x -= 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * (1 + (i % 3)) + i) * 4
      ctx.lineTo(x, yy + h)
    }
    ctx.fill()
  }

  // Fine fibres.
  for (let i = 0; i < 520; i++) {
    const y = random() * size
    const wobble = 1 + random() * 5
    const waves = 1 + Math.floor(random() * 3)
    ctx.strokeStyle = `rgba(${80 + random() * 50}, ${48 + random() * 30}, 18, ${0.025 + random() * 0.08})`
    ctx.lineWidth = 0.4 + random() * 1.6
    ctx.beginPath()
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * waves + i) * wobble
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }

  // A few darker streaks.
  for (let i = 0; i < 12; i++) {
    const y = random() * size
    ctx.strokeStyle = `rgba(70, 38, 12, ${0.08 + random() * 0.08})`
    ctx.lineWidth = 1.5 + random() * 2.5
    ctx.beginPath()
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 + i * 1.7) * 6
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  return canvas
}

function createGrainTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / GRAIN_TILE_MM, 1 / GRAIN_TILE_MM)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function svgImage(markup, w, h) {
  return new Promise((resolve, reject) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${markup}</svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('engraving image failed')) }
    img.src = url
  })
}

function createLabelSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(6, 10, 13, 0.85)'
  ctx.beginPath()
  ctx.roundRect(4, 8, 248, 64, 14)
  ctx.fill()
  ctx.fillStyle = '#ffb020'
  ctx.font = '600 34px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 42)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
  sprite.renderOrder = 10
  return sprite
}

function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose()
    if (child.isSprite) { child.material.map.dispose(); child.material.dispose() }
  })
}

export function createBoxViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // Soft studio reflections so faces read as material, not flat colour.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.4
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000)

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x2a3540, 0.9))
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.4)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  keyLight.shadow.bias = -0.0004
  keyLight.shadow.normalBias = 0.6
  const rimLight = new THREE.DirectionalLight(0x9fc4ff, 0.6)
  scene.add(keyLight, keyLight.target, rimLight)

  const grainCanvas = createGrainCanvas()
  const grain = createGrainTexture(grainCanvas)
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d0a0, roughness: 0.78, metalness: 0, map: grain })
  const acrylicMaterial = new THREE.MeshStandardMaterial({
    color: 0xdff1ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false,
  })
  const highlightMaterial = new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR })
  let materialKind = 'wood'
  const engraveCache = new Map()
  const raycaster = new THREE.Raycaster()
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: BURNT_EDGE_COLOR, roughness: 0.95 })
  const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR })
  const dimensionMaterial = new THREE.LineBasicMaterial({ color: ACCENT_COLOR, depthTest: false })

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.5 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  let grid = null
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.autoRotateSpeed = 1.6

  const boxGroup = new THREE.Group()
  const dimensionGroup = new THREE.Group()
  dimensionGroup.visible = false
  scene.add(boxGroup, dimensionGroup)

  let parts = []
  let dims = null
  let maxDim = 100
  let frameKey = ''
  let hasSize = false
  let gridVisible = true
  let slideDistance = 0
  let onHiddenChange = () => {}

  // Animated values: `current` eases toward `target` inside the render loop.
  const anim = { explode: { current: 0, target: 0 }, lid: { current: 0, target: 0 } }
  let rafId = 0
  let lastTime = 0

  function render() {
    keyLight.position.set(maxDim * 0.9, maxDim * 2.4, maxDim * 1.3)
    rimLight.position.set(-maxDim * 1.6, maxDim * 0.8, -maxDim * 1.4)
    renderer.render(scene, camera)
  }

  let cameraTween = null   // { from, to, start }

  function isAnimating() {
    return controls.autoRotate || Boolean(cameraTween) ||
      Object.values(anim).some(a => Math.abs(a.target - a.current) > 0.001)
  }

  function stepCamera(time) {
    if (!cameraTween) return
    const t = Math.min(1, (time - cameraTween.start) / CAMERA_TWEEN_MS)
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    camera.position.lerpVectors(cameraTween.from, cameraTween.to, ease)
    // Keep the distance from the target steady while the direction swings.
    const distance = THREE.MathUtils.lerp(cameraTween.from.length(), cameraTween.to.length(), ease)
    camera.position.setLength(distance)
    controls.update()
    if (t >= 1) cameraTween = null
  }

  function tick(time) {
    const dt = Math.min(64, time - lastTime)
    lastTime = time
    const step = dt / TWEEN_MS
    Object.values(anim).forEach(a => {
      const diff = a.target - a.current
      a.current = Math.abs(diff) <= step ? a.target : a.current + Math.sign(diff) * step
    })
    applyPose()
    stepCamera(time)
    if (controls.autoRotate) controls.update(dt / 1000)
    render()
    rafId = isAnimating() ? requestAnimationFrame(tick) : 0
  }

  function startLoop() {
    if (rafId) return
    lastTime = performance.now()
    rafId = requestAnimationFrame(tick)
  }

  function applyPose() {
    if (!dims) return
    const distance = anim.explode.current * maxDim * EXPLODE_DISTANCE
    parts.forEach(({ object, base, normal, factor, motion }) => {
      const lift = distance * factor
      object.position.set(
        base[0] + normal[0] * lift,
        base[1] + normal[1] * lift,
        base[2] + normal[2] * lift,
      )
      // Hinged groups sit on the hinge line, so rotating them opens the lid.
      if (motion === 'hinge') object.rotation.x = -anim.lid.current * LID_OPEN_ANGLE
      if (motion === 'slide') object.position.z += anim.lid.current * slideDistance
    })

    const floorY = -dims.H / 2 - distance - 0.3
    ground.position.y = floorY
    if (grid) grid.position.y = floorY
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = container
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // The viewer is created while its tab is hidden; frame once it has a real size.
    if (!hasSize) { hasSize = true; frame() }
    render()
  }

  function framing(direction) {
    const radius = (maxDim * Math.sqrt(3)) / 2
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const fitHeight = radius / Math.sin(fov / 2)
    const fitWidth = fitHeight / Math.min(1, camera.aspect || 1)
    return { radius, position: direction.clone().multiplyScalar(Math.max(fitHeight, fitWidth) * 1.15) }
  }

  function frame(direction = VIEW_DIRECTIONS.perspective) {
    const { radius, position } = framing(direction)
    controls.target.set(0, 0, 0)
    camera.position.copy(position)
    controls.minDistance = radius * 0.6
    controls.maxDistance = radius * 14
    controls.update()
  }

  function flyTo(direction) {
    const { position } = framing(direction)
    controls.target.set(0, 0, 0)
    cameraTween = { from: camera.position.clone(), to: position, start: performance.now() }
    startLoop()
  }

  function rebuildStage() {
    const span = maxDim * 6
    ground.scale.set(span, span, 1)

    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose() }
    const cell = maxDim > 400 ? 50 : 10
    const cells = Math.ceil((maxDim * 3) / cell)
    grid = new THREE.GridHelper(cells * cell, cells, 0x2f4558, 0x1a2a38)
    grid.visible = gridVisible
    scene.add(grid)

    const shadowSpan = maxDim * 1.8
    Object.assign(keyLight.shadow.camera, {
      left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan,
      near: 1, far: maxDim * 8,
    })
    keyLight.shadow.camera.updateProjectionMatrix()
  }

  function rebuildDimensions() {
    dimensionGroup.children.slice().forEach(child => { disposeObject(child); dimensionGroup.remove(child) })
    const { W, D, H } = dims
    const gap = maxDim * 0.09
    const tick = maxDim * 0.025
    const x = W / 2, y = H / 2, z = D / 2

    const add = (from, to, tickAxis, value) => {
      const a = new THREE.Vector3(...from)
      const b = new THREE.Vector3(...to)
      const t = new THREE.Vector3(...tickAxis).multiplyScalar(tick)
      const points = [a, b, a.clone().sub(t), a.clone().add(t), b.clone().sub(t), b.clone().add(t)]
      dimensionGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), dimensionMaterial))

      const label = createLabelSprite(`${Number(value.toFixed(1))} mm`)
      label.position.copy(a).add(b).multiplyScalar(0.5)
      label.scale.set(maxDim * 0.3, maxDim * 0.094, 1)
      dimensionGroup.add(label)
    }

    add([-x, -y, z + gap], [x, -y, z + gap], [0, 0, 1], W)
    add([x + gap, -y, -z], [x + gap, -y, z], [1, 0, 0], D)
    add([x + gap, -y, z + gap * 0.4], [x + gap, y, z + gap * 0.4], [1, 0, 0], H)
  }

  function clear() {
    parts.forEach(({ object, mesh, baseMaterial }) => {
      const face = (baseMaterial || mesh.material)[0]
      if (face !== faceMaterial && face !== acrylicMaterial) face.dispose()
      disposeObject(object)
      boxGroup.remove(object)
    })
    parts = []
    hovered = null
  }

  // result: output of buildBox()
  function setBox(result) {
    const hiddenIds = new Set(parts.filter(p => !p.object.visible).map(p => p.id))
    clear()

    const { width: W, depth: D, height: H } = result.outer
    dims = { W, D, H, t: result.thickness }
    maxDim = Math.max(W, D, H)
    boxGroup.position.set(-W / 2, -H / 2, -D / 2)

    const lidMotion = result.lidMotion
    const hinge = lidMotion && lidMotion.type === 'hinge' ? [0, lidMotion.pivot[0], lidMotion.pivot[1]] : null
    slideDistance = lidMotion && lidMotion.type === 'slide' ? lidMotion.distance : 0

    result.panels.forEach(panel => {
      const { place } = panel
      const shape = new THREE.Shape(panel.shape.map(([x, y]) => new THREE.Vector2(x, y)))
      panel.shapeHoles.forEach(h => {
        if (h.rect) {
          shape.holes.push(new THREE.Path([
            new THREE.Vector2(h.x, h.y), new THREE.Vector2(h.x, h.y + h.h),
            new THREE.Vector2(h.x + h.w, h.y + h.h), new THREE.Vector2(h.x + h.w, h.y),
          ]))
        } else {
          shape.holes.push(new THREE.Path().absarc(h.cx, h.cy, h.r, 0, Math.PI * 2, true))
        }
      })
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: dims.t, bevelEnabled: false, curveSegments: 24 })
      const isAcrylic = panel.material === 'acrylic'
      const mesh = new THREE.Mesh(geometry, isAcrylic ? [acrylicMaterial, acrylicMaterial] : [faceMaterial, edgeMaterial])
      mesh.castShadow = !isAcrylic
      mesh.receiveShadow = true
      mesh.userData.partId = panel.id

      const body = new THREE.Group()
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), outlineMaterial)
      body.add(mesh, edges)
      if (panel.engrave3d && !isAcrylic) applyEngraving(mesh, panel)
      body.rotation.copy(ORIENTATIONS[place.orient])

      // Hinged panels live inside a pivot group placed on the hinge line.
      const motion = place.motion && lidMotion ? lidMotion.type : null
      const isHinged = motion === 'hinge'
      const object = new THREE.Group()
      if (isHinged) body.position.set(...place.position.map((v, i) => v - hinge[i]))
      object.add(body)
      object.visible = !hiddenIds.has(panel.id)

      boxGroup.add(object)
      const xs = panel.shape.map(q => q[0]), ys = panel.shape.map(q => q[1])
      parts.push({
        id: panel.id,
        name: panel.name,
        size: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)],
        object,
        mesh,
        edges,
        base: isHinged ? hinge : place.position,
        normal: place.normal,
        factor: place.explode || 1,
        motion,
      })
    })

    if (!parts.some(p => p.motion)) anim.lid.current = anim.lid.target = 0

    rebuildStage()
    rebuildDimensions()
    applyPose()

    const key = [W, D, H].join('x')
    if (key !== frameKey) {
      const direction = frameKey
        ? camera.position.clone().sub(controls.target).normalize()
        : VIEW_DIRECTIONS.perspective
      frameKey = key
      frame(direction)
    }
    notifyHidden()
    render()
  }

  // kind: 'wood' | 'acrylic' | 'matte'
  function setMaterial(hex, kind) {
    const isAcrylic = kind === 'acrylic'
    materialKind = kind
    faceMaterial.color.set(hex)
    faceMaterial.map = kind === 'wood' ? grain : null
    faceMaterial.roughness = isAcrylic ? 0.08 : 0.78
    faceMaterial.transparent = isAcrylic
    faceMaterial.opacity = isAcrylic ? 0.72 : 1
    faceMaterial.needsUpdate = true

    if (isAcrylic) edgeMaterial.color.set(hex).multiplyScalar(0.75)
    else edgeMaterial.color.set(BURNT_EDGE_COLOR)
    edgeMaterial.transparent = isAcrylic
    edgeMaterial.opacity = isAcrylic ? 0.85 : 1
    edgeMaterial.needsUpdate = true
    render()
  }

  // Engraving shown on the panel faces: grain and engraving baked into one
  // texture spanning the panel's bounding box (UVs of extruded caps are mm).
  async function applyEngraving(mesh, panel) {
    const xs = panel.shape.map(q => q[0]), ys = panel.shape.map(q => q[1])
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0
    const key = `${materialKind}|${w}|${h}|${panel.engrave3d}`
    let texture = engraveCache.get(key)
    if (!texture) {
      const ppm = Math.min(ENGRAVE_PX_PER_MM, ENGRAVE_MAX_PX / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(w * ppm)
      canvas.height = Math.ceil(h * ppm)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (materialKind === 'wood') {
        const pattern = ctx.createPattern(grainCanvas, 'repeat')
        const k = (GRAIN_TILE_MM * ppm) / GRAIN_PX
        pattern.setTransform(new DOMMatrix([k, 0, 0, k, -x0 * ppm, -y0 * ppm]))
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      try {
        const img = await svgImage(panel.engrave3d, w, h)
        ctx.globalAlpha = 0.82
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } catch {
        return
      }
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      texture.repeat.set(1 / w, 1 / h)
      texture.offset.set(-x0 / w, -y0 / h)
      engraveCache.set(key, texture)
    }
    if (!mesh.parent) return
    const material = faceMaterial.clone()
    material.map = texture
    const part = parts.find(p => p.mesh === mesh)
    if (part && part.baseMaterial) {
      part.baseMaterial = [material, part.baseMaterial[1]]
      mesh.material = [tintOf(material), mesh.material[1]]
    } else {
      mesh.material = [material, mesh.material[1]]
    }
    render()
  }

  // Hover: outline the panel under the pointer and show its name and size.
  const tooltip = document.createElement('div')
  tooltip.className = 'viewer-tip'
  container.appendChild(tooltip)
  let hovered = null
  let hoverFrame = 0

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(parts.filter(p => p.object.visible).map(p => p.mesh), false)[0]
    return hit ? parts.find(p => p.id === hit.object.userData.partId) : null
  }

  // Hover tint: a warm emissive copy of the panel's face material.
  const tinted = new WeakMap()
  function tintOf(material) {
    if (!tinted.has(material)) {
      const copy = material.clone()
      copy.emissive = new THREE.Color(0xff8a2a)
      copy.emissiveIntensity = 0.16
      tinted.set(material, copy)
    }
    return tinted.get(material)
  }

  function setHovered(part, clientX, clientY) {
    if (hovered && hovered !== part) {
      hovered.edges.material = outlineMaterial
      if (hovered.baseMaterial) hovered.mesh.material = hovered.baseMaterial
      hovered.baseMaterial = null
    }
    if (part && hovered !== part && !part.baseMaterial) {
      part.baseMaterial = part.mesh.material
      part.mesh.material = [tintOf(part.mesh.material[0]), part.mesh.material[1]]
    }
    hovered = part
    if (part) {
      part.edges.material = highlightMaterial
      const rect = container.getBoundingClientRect()
      tooltip.textContent = `${part.name} · ${part.size[0].toFixed(0)} × ${part.size[1].toFixed(0)} mm`
      tooltip.style.left = `${clientX - rect.left + 14}px`
      tooltip.style.top = `${clientY - rect.top + 14}px`
      tooltip.style.display = 'block'
    } else {
      tooltip.style.display = 'none'
    }
    if (!rafId) render()
  }

  renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) { setHovered(null); return }
    cancelAnimationFrame(hoverFrame)
    hoverFrame = requestAnimationFrame(() => setHovered(pick(e.clientX, e.clientY), e.clientX, e.clientY))
  })
  renderer.domElement.addEventListener('pointerleave', () => setHovered(null))

  function notifyHidden() {
    onHiddenChange(parts.filter(p => !p.object.visible).map(p => p.name))
  }

  // Click (without dragging) on a panel hides it so you can look inside.
  let pointerDown = null

  renderer.domElement.addEventListener('pointerdown', e => {
    pointerDown = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  })
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerDown) return
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y)
    pointerDown = null
    if (moved > CLICK_TOLERANCE_PX) return

    const part = pick(e.clientX, e.clientY)
    if (!part) return
    part.object.visible = false
    setHovered(null)
    notifyHidden()
    render()
  })

  controls.addEventListener('change', () => { if (!rafId) render() })
  new ResizeObserver(resize).observe(container)
  resize()
  frame()

  return {
    setBox,
    setMaterial,
    clear() { clear(); dims = null; render() },
    setExplode(value) { anim.explode.target = anim.explode.current = value; applyPose(); render() },
    // Starts fully separated and eases back to the current explode value.
    playAssembly() { anim.explode.current = 1; applyPose(); startLoop() },
    setExplodeAnimated(value) { anim.explode.target = value; startLoop() },
    setLidOpen(open) { anim.lid.target = open ? 1 : 0; startLoop() },
    hasLid: () => parts.some(p => p.motion),
    setAutoRotate(on) { controls.autoRotate = on; if (on) startLoop() },
    setDimensionsVisible(on) { dimensionGroup.visible = on; render() },
    setGridVisible(on) { gridVisible = on; if (grid) grid.visible = on; render() },
    setView(name) { flyTo(VIEW_DIRECTIONS[name]) },
    resetView() { flyTo(VIEW_DIRECTIONS.perspective) },
    showAll() { parts.forEach(p => { p.object.visible = true }); notifyHidden(); render() },
    onHiddenChange(listener) { onHiddenChange = listener },
    snapshot() { render(); return renderer.domElement.toDataURL('image/png') },
  }
}
