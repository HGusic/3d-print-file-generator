import * as THREE from 'three'
import type { ShapeDefinition } from './types'

const WALL = 4

type UBracketParams = {
  /** Overall outer width and arm height */
  size: number
}

function createUBracketGeometry(params: UBracketParams): THREE.ExtrudeGeometry {
  const { size } = params
  if (size <= WALL * 2) {
    throw new Error('size must be greater than wall thickness')
  }

  const w = size
  const h = size
  const t = WALL
  // Extrusion depth scales lightly with size so one slider still feels useful
  const depth = Math.max(20, Math.round(size * 0.5))

  // U channel: open at the top
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(w, 0)
  shape.lineTo(w, h)
  shape.lineTo(w - t, h)
  shape.lineTo(w - t, t)
  shape.lineTo(t, t)
  shape.lineTo(t, h)
  shape.lineTo(0, h)
  shape.lineTo(0, 0)

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

function asUBracket(params: Record<string, number>): UBracketParams {
  return { size: params.size }
}

export const uBracketShape: ShapeDefinition = {
  id: 'u-bracket',
  label: 'U Bracket',
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
  createGeometry: (params) => createUBracketGeometry(asUBracket(params)),
  orientMesh(mesh) {
    mesh.rotation.set(0, 0, 0)
  },
  groundOffset() {
    return -2
  },
  fileName(params) {
    return `u-bracket-${asUBracket(params).size}mm.stl`
  },
}
