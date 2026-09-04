import * as THREE from 'three'
import type { ShapeDefinition } from './types'

const WALL = 4

type HookParams = {
  /** Overall height; opening and depth scale with it */
  size: number
}

function createHookGeometry(params: HookParams): THREE.ExtrudeGeometry {
  const { size } = params
  if (size <= WALL * 3) {
    throw new Error('size must be large enough for a hook')
  }

  const h = size
  const t = WALL
  const depth = Math.max(16, Math.round(size * 0.35))
  const hookWidth = Math.max(t * 3, Math.round(size * 0.45))
  const opening = Math.max(t * 2, Math.round(size * 0.3))

  // Squared J-hook profile (side view)
  const shape = new THREE.Shape()
  shape.moveTo(0, h)
  shape.lineTo(0, 0)
  shape.lineTo(hookWidth, 0)
  shape.lineTo(hookWidth, opening)
  shape.lineTo(hookWidth - t, opening)
  shape.lineTo(hookWidth - t, t)
  shape.lineTo(t, t)
  shape.lineTo(t, h)
  shape.lineTo(0, h)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  })

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (box) {
    const centerX = (box.min.x + box.max.x) / 2
    const centerZ = (box.min.z + box.max.z) / 2
    geometry.translate(-centerX, -box.min.y, -centerZ)
  }

  geometry.computeVertexNormals()
  return geometry
}

function asHook(params: Record<string, number>): HookParams {
  return { size: params.size }
}

export const hookShape: ShapeDefinition = {
  id: 'hook',
  label: 'Hook',
  defaults: {
    size: 50,
  },
  params: [
    {
      key: 'size',
      label: 'Size',
      min: 20,
      max: 800,
      step: 1,
      unit: 'mm',
    },
  ],
  createGeometry: (params) => createHookGeometry(asHook(params)),
  orientMesh(mesh) {
    mesh.rotation.set(0, 0, 0)
  },
  groundOffset() {
    return -2
  },
  fileName(params) {
    return `hook-${asHook(params).size}mm.stl`
  },
}
