import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ShapeDefinition } from './types'

type BoxParams = {
  sizeX: number
  sizeY: number
  sizeZ: number
  /** 1 = keep X/Y/Z equal */
  equalSizes: number
  thickness: number
  wallBottom: number
  wallLeft: number
  wallRight: number
  wallFront: number
  wallBack: number
}

function applyBoxParamChange(
  params: Record<string, number>,
  key: string,
  value: number,
): Record<string, number> {
  const next = { ...params, [key]: value }

  const equal =
    key === 'equalSizes' ? value >= 1 : next.equalSizes >= 1

  if (equal) {
    if (key === 'sizeX' || key === 'sizeY' || key === 'sizeZ') {
      next.sizeX = value
      next.sizeY = value
      next.sizeZ = value
    } else if (key === 'equalSizes') {
      next.sizeY = next.sizeX
      next.sizeZ = next.sizeX
    }
  }

  return next
}

function normalizeBoxParams(
  params: Record<string, number>,
): Record<string, number> {
  const equalSizes = params.equalSizes >= 1 ? 1 : 0
  let sizeX = Math.max(10, params.sizeX)
  let sizeY = Math.max(10, params.sizeY)
  let sizeZ = Math.max(10, params.sizeZ)

  if (equalSizes) {
    sizeY = sizeX
    sizeZ = sizeX
  }

  const maxThickness = Math.max(
    1,
    Math.floor(Math.min(sizeX, sizeY, sizeZ) / 2) - 1,
  )
  const thickness = Math.min(Math.max(1, params.thickness ?? 3), maxThickness)

  return {
    ...params,
    equalSizes,
    sizeX,
    sizeY,
    sizeZ,
    thickness,
    wallBottom: params.wallBottom >= 1 ? 1 : 0,
    wallLeft: params.wallLeft >= 1 ? 1 : 0,
    wallRight: params.wallRight >= 1 ? 1 : 0,
    wallFront: params.wallFront >= 1 ? 1 : 0,
    wallBack: params.wallBack >= 1 ? 1 : 0,
  }
}

function maxThickness(params: Record<string, number>): number {
  return Math.max(
    1,
    Math.floor(Math.min(params.sizeX, params.sizeY, params.sizeZ) / 2) - 1,
  )
}

function createBoxGeometry(params: BoxParams): THREE.BufferGeometry {
  const {
    sizeX: x,
    sizeY: y,
    sizeZ: z,
    thickness: t,
    wallBottom,
    wallLeft,
    wallRight,
    wallFront,
    wallBack,
  } = params

  const hasBottom = wallBottom >= 1
  const hasLeft = wallLeft >= 1
  const hasRight = wallRight >= 1
  const hasFront = wallFront >= 1
  const hasBack = wallBack >= 1

  const leftT = hasLeft ? t : 0
  const rightT = hasRight ? t : 0
  const y0 = hasBottom ? t : 0
  const wallH = Math.max(1, y - y0)

  const parts: THREE.BufferGeometry[] = []

  // Open top by construction — bottom + side panels only.
  if (hasBottom) {
    const bottom = new THREE.BoxGeometry(x, t, z)
    bottom.translate(x / 2, t / 2, z / 2)
    parts.push(bottom)
  }

  if (hasLeft) {
    const left = new THREE.BoxGeometry(t, wallH, z)
    left.translate(t / 2, y0 + wallH / 2, z / 2)
    parts.push(left)
  }

  if (hasRight) {
    const right = new THREE.BoxGeometry(t, wallH, z)
    right.translate(x - t / 2, y0 + wallH / 2, z / 2)
    parts.push(right)
  }

  const spanX = Math.max(1, x - leftT - rightT)
  if (hasFront) {
    const front = new THREE.BoxGeometry(spanX, wallH, t)
    front.translate(leftT + spanX / 2, y0 + wallH / 2, t / 2)
    parts.push(front)
  }

  if (hasBack) {
    const back = new THREE.BoxGeometry(spanX, wallH, t)
    back.translate(leftT + spanX / 2, y0 + wallH / 2, z - t / 2)
    parts.push(back)
  }

  if (parts.length === 0) {
    const stub = new THREE.BoxGeometry(1, 1, 1)
    stub.translate(0, 0.5, 0)
    parts.push(stub)
  }

  const merged =
    parts.length === 1 ? parts[0] : mergeGeometries(parts, false)

  if (parts.length > 1) {
    for (const part of parts) {
      part.dispose()
    }
  }

  if (!merged) {
    throw new Error('Failed to build box geometry')
  }

  merged.computeBoundingBox()
  const box = merged.boundingBox
  if (box) {
    const centerX = (box.min.x + box.max.x) / 2
    const centerZ = (box.min.z + box.max.z) / 2
    merged.translate(-centerX, -box.min.y, -centerZ)
  }

  merged.computeVertexNormals()
  return merged
}

function asBox(params: Record<string, number>): BoxParams {
  const normalized = normalizeBoxParams(params)
  return {
    sizeX: normalized.sizeX,
    sizeY: normalized.sizeY,
    sizeZ: normalized.sizeZ,
    equalSizes: normalized.equalSizes,
    thickness: normalized.thickness,
    wallBottom: normalized.wallBottom,
    wallLeft: normalized.wallLeft,
    wallRight: normalized.wallRight,
    wallFront: normalized.wallFront,
    wallBack: normalized.wallBack,
  }
}

export const boxShape: ShapeDefinition = {
  id: 'box',
  label: 'Box',
  defaults: {
    sizeX: 50,
    sizeY: 50,
    sizeZ: 50,
    equalSizes: 1,
    thickness: 3,
    wallBottom: 1,
    wallLeft: 1,
    wallRight: 1,
    wallFront: 1,
    wallBack: 1,
  },
  params: [
    {
      type: 'toggle',
      key: 'equalSizes',
      label: 'Equal sizes',
    },
    {
      key: 'sizeX',
      label: 'Width X',
      min: 10,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'sizeY',
      label: 'Height Y',
      min: 10,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'sizeZ',
      label: 'Depth Z',
      min: 10,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'thickness',
      label: 'Wall thickness',
      min: 1,
      max: 100,
      step: 1,
      unit: 'mm',
      dynamicMax: maxThickness,
    },
    {
      type: 'toggle',
      key: 'wallBottom',
      label: 'Bottom',
    },
    {
      type: 'toggle',
      key: 'wallLeft',
      label: 'Left wall',
    },
    {
      type: 'toggle',
      key: 'wallRight',
      label: 'Right wall',
    },
    {
      type: 'toggle',
      key: 'wallFront',
      label: 'Front wall',
    },
    {
      type: 'toggle',
      key: 'wallBack',
      label: 'Back wall',
    },
  ],
  applyParamChange: applyBoxParamChange,
  normalizeParams: normalizeBoxParams,
  createGeometry: (params) => createBoxGeometry(asBox(params)),
  orientMesh(mesh) {
    mesh.rotation.set(0, 0, 0)
  },
  groundOffset() {
    return -2
  },
  fileName(params) {
    const p = asBox(params)
    return `box-${p.sizeX}x${p.sizeY}x${p.sizeZ}x${p.thickness}mm.stl`
  },
}
