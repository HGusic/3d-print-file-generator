import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ShapeDefinition } from './shapes'

export class ModelPreview {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private mesh: THREE.Mesh
  private material: THREE.MeshStandardMaterial
  private grid: THREE.GridHelper
  private shape: ShapeDefinition
  private params: Record<string, number>
  private animationId = 0
  private resizeObserver: ResizeObserver

  constructor(
    private container: HTMLElement,
    initialShape: ShapeDefinition,
  ) {
    this.shape = initialShape
    this.params = initialShape.normalizeParams
      ? initialShape.normalizeParams({ ...initialShape.defaults })
      : { ...initialShape.defaults }

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)

    const width = container.clientWidth || 640
    const height = container.clientHeight || 400

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000)
    this.camera.position.set(350, 280, 420)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height)
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0, 0)

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(80, 120, 60)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-60, 40, -80)
    this.scene.add(fill)

    this.grid = new THREE.GridHelper(800, 40, 0x555555, 0x2a2a2a)
    this.scene.add(this.grid)

    this.material = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      metalness: 0.2,
      roughness: 0.45,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh()
    this.mesh.material = this.material
    this.scene.add(this.mesh)
    this.rebuildMesh()

    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(container)

    this.animate()
  }

  getShape(): ShapeDefinition {
    return this.shape
  }

  getParams(): Record<string, number> {
    return { ...this.params }
  }

  getMesh(): THREE.Mesh {
    return this.mesh
  }

  setShape(shape: ShapeDefinition): void {
    this.shape = shape
    this.params = shape.normalizeParams
      ? shape.normalizeParams({ ...shape.defaults })
      : { ...shape.defaults }
    this.rebuildMesh()
  }

  setParam(key: string, value: number): void {
    const next = this.shape.applyParamChange
      ? this.shape.applyParamChange(this.params, key, value)
      : { ...this.params, [key]: value }
    this.params = this.shape.normalizeParams
      ? this.shape.normalizeParams(next)
      : next
    this.rebuildMesh()
  }

  /** Restore the active object's default parameters. */
  resetParams(): void {
    this.params = this.shape.normalizeParams
      ? this.shape.normalizeParams({ ...this.shape.defaults })
      : { ...this.shape.defaults }
    this.rebuildMesh()
  }

  private rebuildMesh(): void {
    this.mesh.geometry.dispose()
    this.mesh.geometry = this.shape.createGeometry(this.params)
    this.mesh.rotation.set(0, 0, 0)
    this.shape.orientMesh?.(this.mesh)
    const offset = this.shape.groundOffset?.(this.params) ?? -2
    this.grid.position.y = offset
  }

  private onResize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
