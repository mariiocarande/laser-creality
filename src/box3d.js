// Interactive 3D preview of the assembled box (three.js).
// Box space: X = width, Y = height (up), Z = depth; the front faces +Z.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const BURNT_EDGE_COLOR = 0x3a2413
const OUTLINE_COLOR = 0x1c1209
const ACCENT_COLOR = 0xff6b1a
const EXPLODE_DISTANCE = 0.6      // fraction of the largest box dimension
const LID_OPEN_ANGLE = 1.85       // radians
const TWEEN_MS = 450
const CLICK_TOLERANCE_PX = 5
const GRAIN_TILE_MM = 140

const VIEW_DIRECTIONS = {
  perspective: new THREE.Vector3(0.9, 0.75, 1.3).normalize(),
  front: new THREE.Vector3(0, 0, 1),
  top:   new THREE.Vector3(0, 1, 0.0001).normalize(),
  side:  new THREE.Vector3(1, 0, 0),
}

const LAY_FLAT = new THREE.Euler(-Math.PI / 2, 0, 0)
const STAND_SIDEWAYS = new THREE.Euler(0, -Math.PI / 2, 0)
const UPRIGHT = new THREE.Euler(0, 0, 0)

// Where each panel sits once assembled, and which way it moves when exploded.
// `hinged` panels swing open around the top-back edge of the box.
function placementFor(id, { W, D, H, t, clearance }) {
  switch (id) {
    case 'bottom':  return { rotation: LAY_FLAT,       position: [0, 0, D],     normal: [0, -1, 0] }
    case 'top':     return { rotation: LAY_FLAT,       position: [0, H - t, D], normal: [0, 1, 0], hinged: true }
    case 'front':   return { rotation: UPRIGHT,        position: [0, 0, D - t], normal: [0, 0, 1] }
    case 'back':    return { rotation: UPRIGHT,        position: [0, 0, 0],     normal: [0, 0, -1] }
    case 'left':    return { rotation: STAND_SIDEWAYS, position: [t, 0, 0],     normal: [-1, 0, 0] }
    case 'right':   return { rotation: STAND_SIDEWAYS, position: [W, 0, 0],     normal: [1, 0, 0] }
    case 'lid':     return { rotation: LAY_FLAT,       position: [0, H, D],     normal: [0, 1, 0], hinged: true }
    case 'lid-lip': return {
      rotation: LAY_FLAT,
      position: [t + clearance / 2, H - t, D - t - clearance / 2],
      normal: [0, 1, 0],
      hinged: true,
    }
    default: return null
  }
}

function createGrainTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // Deterministic pseudo-random so the grain does not change between renders.
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

  for (let i = 0; i < 260; i++) {
    const y = random() * size
    const wobble = 2 + random() * 6
    ctx.strokeStyle = `rgba(${90 + random() * 40}, ${55 + random() * 30}, 20, ${0.04 + random() * 0.1})`
    ctx.lineWidth = 0.5 + random() * 2.2
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 + i) * wobble)
    }
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / GRAIN_TILE_MM, 1 / GRAIN_TILE_MM)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4652, 1.4))
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.9)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  scene.add(keyLight, keyLight.target)

  const grain = createGrainTexture()
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d0a0, roughness: 0.85, map: grain })
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: BURNT_EDGE_COLOR, roughness: 0.95 })
  const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR })
  const dimensionMaterial = new THREE.LineBasicMaterial({ color: ACCENT_COLOR, depthTest: false })

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
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
  let onHiddenChange = () => {}

  // Animated values: `current` eases toward `target` inside the render loop.
  const anim = { explode: { current: 0, target: 0 }, lid: { current: 0, target: 0 } }
  let rafId = 0
  let lastTime = 0

  function render() {
    keyLight.position.set(maxDim * 0.9, maxDim * 2.4, maxDim * 1.3)
    renderer.render(scene, camera)
  }

  function isAnimating() {
    return controls.autoRotate ||
      Object.values(anim).some(a => Math.abs(a.target - a.current) > 0.001)
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
    parts.forEach(({ object, base, normal, hinged, lidOffset }) => {
      // Hinged groups sit on the top-back edge, so rotating them opens the lid.
      const lift = hinged ? lidOffset * distance : distance
      object.position.set(
        base[0] + normal[0] * lift,
        base[1] + normal[1] * lift,
        base[2] + normal[2] * lift,
      )
      if (hinged) object.rotation.x = -anim.lid.current * LID_OPEN_ANGLE
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

  function frame(direction = VIEW_DIRECTIONS.perspective) {
    const radius = (maxDim * Math.sqrt(3)) / 2
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const fitHeight = radius / Math.sin(fov / 2)
    const fitWidth = fitHeight / Math.min(1, camera.aspect || 1)
    const distance = Math.max(fitHeight, fitWidth) * 1.15
    controls.target.set(0, 0, 0)
    camera.position.copy(direction).multiplyScalar(distance)
    controls.minDistance = radius * 0.6
    controls.maxDistance = radius * 14
    controls.update()
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
    parts.forEach(({ object }) => { disposeObject(object); boxGroup.remove(object) })
    parts = []
  }

  // result: output of buildBox()
  function setBox(result) {
    const hiddenIds = new Set(parts.filter(p => !p.object.visible).map(p => p.id))
    clear()

    const { width: W, depth: D, height: H } = result.outer
    dims = { W, D, H, t: result.thickness, clearance: result.lidClearance }
    maxDim = Math.max(W, D, H)
    boxGroup.position.set(-W / 2, -H / 2, -D / 2)
    const hinge = [0, H, 0]

    result.panels.forEach(panel => {
      const placement = placementFor(panel.id, dims)
      if (!placement) return

      const shape = new THREE.Shape(panel.shape.map(([x, y]) => new THREE.Vector2(x, y)))
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: dims.t, bevelEnabled: false })
      const mesh = new THREE.Mesh(geometry, [faceMaterial, edgeMaterial])
      mesh.castShadow = true
      mesh.receiveShadow = true

      const body = new THREE.Group()
      body.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), outlineMaterial))
      body.rotation.copy(placement.rotation)

      // Hinged panels live inside a pivot group placed on the hinge line.
      const object = new THREE.Group()
      const base = placement.hinged ? hinge : placement.position
      if (placement.hinged) {
        body.position.set(
          placement.position[0] - hinge[0],
          placement.position[1] - hinge[1],
          placement.position[2] - hinge[2],
        )
      }
      object.add(body)
      object.visible = !hiddenIds.has(panel.id)
      mesh.userData.partId = panel.id

      boxGroup.add(object)
      parts.push({
        id: panel.id,
        name: panel.name,
        object,
        mesh,
        base,
        normal: placement.normal,
        hinged: Boolean(placement.hinged),
        lidOffset: panel.id === 'lid' ? 1.6 : panel.id === 'lid-lip' ? 1.25 : 1,
      })
    })

    if (!parts.some(p => p.hinged)) anim.lid.current = anim.lid.target = 0

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
    faceMaterial.color.set(hex)
    faceMaterial.map = kind === 'wood' ? grain : null
    faceMaterial.roughness = isAcrylic ? 0.12 : 0.85
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

  function notifyHidden() {
    onHiddenChange(parts.filter(p => !p.object.visible).map(p => p.name))
  }

  // Click (without dragging) on a panel hides it so you can look inside.
  const raycaster = new THREE.Raycaster()
  let pointerDown = null

  renderer.domElement.addEventListener('pointerdown', e => {
    pointerDown = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  })
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerDown) return
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y)
    pointerDown = null
    if (moved > CLICK_TOLERANCE_PX) return

    const rect = renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const visibleMeshes = parts.filter(p => p.object.visible).map(p => p.mesh)
    const hit = raycaster.intersectObjects(visibleMeshes, false)[0]
    if (!hit) return

    const part = parts.find(p => p.id === hit.object.userData.partId)
    part.object.visible = false
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
    setLidOpen(open) { anim.lid.target = open ? 1 : 0; startLoop() },
    hasLid: () => parts.some(p => p.hinged),
    setAutoRotate(on) { controls.autoRotate = on; if (on) startLoop() },
    setDimensionsVisible(on) { dimensionGroup.visible = on; render() },
    setGridVisible(on) { gridVisible = on; if (grid) grid.visible = on; render() },
    setView(name) { frame(VIEW_DIRECTIONS[name]); render() },
    showAll() { parts.forEach(p => { p.object.visible = true }); notifyHidden(); render() },
    onHiddenChange(listener) { onHiddenChange = listener },
    snapshot() { render(); return renderer.domElement.toDataURL('image/png') },
  }
}
