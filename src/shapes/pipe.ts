import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ShapeDefinition } from './types'

type PipeParams = {
  outerRadius: number
  innerRadius: number
  length: number
  closeLeftEnd: number
  closeRightEnd: number
  leftCapThickness: number
  rightCapThickness: number
}

/** Keep radii valid and cap thicknesses within the hollow length. */
function normalizePipeParams(
  params: Record<string, number>,
): Record<string, number> {
  const outerRadius = params.outerRadius
  const maxInner = Math.max(1, outerRadius - 1)
  const length = params.length
  const maxCap = Math.max(1, length - 1)
  const closeLeftEnd = params.closeLeftEnd >= 1 ? 1 : 0
  const closeRightEnd = params.closeRightEnd >= 1 ? 1 : 0

  let leftCapThickness = Math.min(
    Math.max(1, params.leftCapThickness ?? 3),
    maxCap,
  )
  let rightCapThickness = Math.min(
    Math.max(1, params.rightCapThickness ?? 3),
    maxCap,
  )

  // Both caps fill inward; their thicknesses must sum to less than length.
  if (closeLeftEnd && closeRightEnd) {
    const maxSum = length - 1
    if (leftCapThickness + rightCapThickness > maxSum) {
      leftCapThickness = Math.min(leftCapThickness, maxSum - 1)
      rightCapThickness = Math.min(rightCapThickness, maxSum - leftCapThickness)
      leftCapThickness = Math.min(leftCapThickness, maxSum - rightCapThickness)
    }
  }

  return {
    ...params,
    innerRadius: Math.min(params.innerRadius, maxInner),
    closeLeftEnd,
    closeRightEnd,
    leftCapThickness,
    rightCapThickness,
  }
}

function maxLeftCapThickness(params: Record<string, number>): number {
  const maxAlone = Math.max(1, params.length - 1)
  if (params.closeLeftEnd >= 1 && params.closeRightEnd >= 1) {
    return Math.max(1, params.length - 1 - params.rightCapThickness)
  }
  return maxAlone
}

function maxRightCapThickness(params: Record<string, number>): number {
  const maxAlone = Math.max(1, params.length - 1)
  if (params.closeLeftEnd >= 1 && params.closeRightEnd >= 1) {
    return Math.max(1, params.length - 1 - params.leftCapThickness)
  }
  return maxAlone
}

function createTubeGeometry(
  outerRadius: number,
  innerRadius: number,
  length: number,
  radialSegments: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(outerRadius, 0)
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)

  const hole = new THREE.Path()
  hole.moveTo(innerRadius, 0)
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
  shape.holes.push(hole)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: radialSegments,
  })

  geometry.translate(0, 0, -length / 2)
  return geometry
}

function createCapGeometry(
  outerRadius: number,
  thickness: number,
  length: number,
  side: 'left' | 'right',
  radialSegments: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(outerRadius, 0)
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: radialSegments,
  })

  // Cap fills inward from the end so overall pipe length stays the same.
  // After Y-rotation in the preview, -Z is left and +Z is right.
  if (side === 'left') {
    geometry.translate(0, 0, -length / 2)
  } else {
    geometry.translate(0, 0, length / 2 - thickness)
  }

  return geometry
}

function createPipeGeometry(params: PipeParams): THREE.BufferGeometry {
  const {
    outerRadius,
    innerRadius,
    length,
    closeLeftEnd,
    closeRightEnd,
    leftCapThickness,
    rightCapThickness,
  } = params
  const radialSegments = 64

  if (innerRadius >= outerRadius) {
    throw new Error('innerRadius must be less than outerRadius')
  }
  if (length <= 0) {
    throw new Error('length must be positive')
  }

  const parts: THREE.BufferGeometry[] = [
    createTubeGeometry(outerRadius, innerRadius, length, radialSegments),
  ]

  if (closeLeftEnd >= 1) {
    parts.push(
      createCapGeometry(
        outerRadius,
        leftCapThickness,
        length,
        'left',
        radialSegments,
      ),
    )
  }

  if (closeRightEnd >= 1) {
    parts.push(
      createCapGeometry(
        outerRadius,
        rightCapThickness,
        length,
        'right',
        radialSegments,
      ),
    )
  }

  if (parts.length === 1) {
    parts[0].computeVertexNormals()
    return parts[0]
  }

  const merged = mergeGeometries(parts, false)
  for (const part of parts) {
    part.dispose()
  }

  if (!merged) {
    throw new Error('Failed to merge pipe geometry')
  }

  merged.computeVertexNormals()
  return merged
}

function asPipe(params: Record<string, number>): PipeParams {
  const normalized = normalizePipeParams(params)
  return {
    outerRadius: normalized.outerRadius,
    innerRadius: normalized.innerRadius,
    length: normalized.length,
    closeLeftEnd: normalized.closeLeftEnd,
    closeRightEnd: normalized.closeRightEnd,
    leftCapThickness: normalized.leftCapThickness,
    rightCapThickness: normalized.rightCapThickness,
  }
}

export const pipeShape: ShapeDefinition = {
  id: 'pipe',
  label: 'Pipe',
  defaults: {
    outerRadius: 20,
    innerRadius: 15,
    length: 50,
    closeLeftEnd: 0,
    closeRightEnd: 0,
    leftCapThickness: 3,
    rightCapThickness: 3,
  },
  params: [
    {
      key: 'outerRadius',
      label: 'Outer radius',
      min: 5,
      max: 400,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'innerRadius',
      label: 'Inner radius',
      min: 1,
      max: 399,
      step: 1,
      unit: 'mm',
      dynamicMax: (params) => Math.max(1, params.outerRadius - 1),
    },
    {
      key: 'length',
      label: 'Length',
      min: 10,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      type: 'toggle',
      key: 'closeLeftEnd',
      label: 'Close left end',
    },
    {
      key: 'leftCapThickness',
      label: 'Left cap thickness',
      min: 1,
      max: 799,
      step: 1,
      unit: 'mm',
      dynamicMax: maxLeftCapThickness,
      disabledWhen: (params) => params.closeLeftEnd < 1,
    },
    {
      type: 'toggle',
      key: 'closeRightEnd',
      label: 'Close right end',
    },
    {
      key: 'rightCapThickness',
      label: 'Right cap thickness',
      min: 1,
      max: 799,
      step: 1,
      unit: 'mm',
      dynamicMax: maxRightCapThickness,
      disabledWhen: (params) => params.closeRightEnd < 1,
    },
  ],
  normalizeParams: normalizePipeParams,
  createGeometry: (params) => createPipeGeometry(asPipe(params)),
  orientMesh(mesh) {
    mesh.rotation.set(0, Math.PI / 2, 0)
  },
  groundOffset(params) {
    return -asPipe(params).outerRadius - 2
  },
  fileName(params) {
    const p = asPipe(params)
    const left = p.closeLeftEnd >= 1 ? `-Lcap${p.leftCapThickness}` : ''
    const right = p.closeRightEnd >= 1 ? `-Rcap${p.rightCapThickness}` : ''
    return `pipe-${p.length}mm-od${p.outerRadius}-id${p.innerRadius}${left}${right}.stl`
  },
}
