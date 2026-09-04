import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import type { ShapeDefinition } from './types'

type LBracketParams = {
  independentArms: number
  horizontalLength: number
  verticalLength: number
  thickness: number
  width: number
  angle: number
  innerRadius: number
  horizontalHoles: number
  verticalHoles: number
  horizontalHoleSize: number
  horizontalHoleQuantity: number
  horizontalHoleRows: number
  verticalHoleSize: number
  verticalHoleQuantity: number
  verticalHoleRows: number
}

function resolveArmLengths(params: Record<string, number>): {
  lenH: number
  lenV: number
} {
  if (params.independentArms >= 1) {
    return {
      lenH: params.horizontalLength,
      lenV: params.verticalLength,
    }
  }
  // Linked mode — both arms share one length
  const shared = params.horizontalLength
  return { lenH: shared, lenV: shared }
}

function applyLBracketParamChange(
  params: Record<string, number>,
  key: string,
  value: number,
): Record<string, number> {
  const next = { ...params, [key]: value }

  const linked =
    key === 'independentArms' ? value < 1 : next.independentArms < 1

  if (linked) {
    if (key === 'horizontalLength' || key === 'verticalLength') {
      next.horizontalLength = value
      next.verticalLength = value
    } else if (key === 'independentArms') {
      // Turning linked mode on: match both to horizontal
      next.verticalLength = next.horizontalLength
    }
  }

  return next
}

/**
 * Corner where lines offset by R along inward normals n1/n2 meet.
 * u1 = (1,0), n1 = (0,1), u2 = (cos,sin), n2 = (sin,-cos).
 */
function offsetCorner(
  R: number,
  cosA: number,
  sinA: number,
): { x: number; y: number } {
  const r = (R * (1 + cosA)) / sinA
  return {
    x: R * sinA + r * cosA,
    y: R,
  }
}

function angleAt(
  px: number,
  py: number,
  cx: number,
  cy: number,
): number {
  return Math.atan2(py - cy, px - cx)
}

function maxHorizontalHoleSize(params: Record<string, number>): number {
  const { lenH } = resolveArmLengths(params)
  return Math.max(1, Math.min(lenH, params.width) - 1)
}

function maxVerticalHoleSize(params: Record<string, number>): number {
  const { lenV } = resolveArmLengths(params)
  return Math.max(1, Math.min(lenV, params.width) - 1)
}

function maxQuantityForArm(
  armLength: number,
  diameter: number,
  thickness: number,
): number {
  const d = Math.max(1, diameter)
  // Free segment past the joint; need room for equal edge + inter-hole gaps
  const freeLength = Math.max(0, armLength - thickness)
  if (freeLength <= d) return 1
  // spacing = freeLength / (n + 1) should stay at least ~diameter
  return Math.max(1, Math.min(4, Math.floor(freeLength / d) - 1))
}

function maxRowsAcrossWidth(width: number, diameter: number): number {
  const d = Math.max(1, diameter)
  if (width <= d) return 1
  return Math.max(1, Math.min(4, Math.floor(width / d) - 1))
}

function maxHorizontalHoleQuantity(params: Record<string, number>): number {
  const { lenH } = resolveArmLengths(params)
  return maxQuantityForArm(
    lenH,
    params.horizontalHoleSize ?? 4,
    params.thickness,
  )
}

function maxVerticalHoleQuantity(params: Record<string, number>): number {
  const { lenV } = resolveArmLengths(params)
  return maxQuantityForArm(
    lenV,
    params.verticalHoleSize ?? 4,
    params.thickness,
  )
}

function maxHorizontalHoleRows(params: Record<string, number>): number {
  return maxRowsAcrossWidth(params.width, params.horizontalHoleSize ?? 4)
}

function maxVerticalHoleRows(params: Record<string, number>): number {
  return maxRowsAcrossWidth(params.width, params.verticalHoleSize ?? 4)
}

/**
 * n centers on [origin, origin + span] with equal edge and inter gaps:
 * spacing = span / (n + 1).
 */
function equalSpacedCenters(
  span: number,
  count: number,
  origin = 0,
): number[] {
  const n = Math.max(1, Math.floor(count))
  if (span <= 0) {
    return [origin]
  }
  const spacing = span / (n + 1)
  return Array.from({ length: n }, (_, i) => origin + spacing * (i + 1))
}

/** Along-arm stations on [jointInset, length] (free length = length − thickness). */
function holeStationsAlongArm(
  length: number,
  count: number,
  jointInset: number,
): number[] {
  return equalSpacedCenters(length - jointInset, count, jointInset)
}

/** Across-width stations on [0, width]. */
function holeStationsAcrossWidth(width: number, rows: number): number[] {
  return equalSpacedCenters(width, rows, 0)
}

function normalizeLBracketParams(
  params: Record<string, number>,
): Record<string, number> {
  const independentArms = params.independentArms >= 1 ? 1 : 0
  const horizontalHoles = params.horizontalHoles >= 1 ? 1 : 0
  const verticalHoles = params.verticalHoles >= 1 ? 1 : 0
  const thickness = params.thickness

  let horizontalLength = params.horizontalLength
  let verticalLength = params.verticalLength

  if (!independentArms) {
    const shared = horizontalLength
    horizontalLength = shared
    verticalLength = shared
  }

  const minArm = Math.max(thickness + 1, 20)
  horizontalLength = Math.max(horizontalLength, minArm)
  verticalLength = Math.max(verticalLength, minArm)

  if (!independentArms) {
    verticalLength = horizontalLength
  }

  const draft: Record<string, number> = {
    ...params,
    independentArms,
    horizontalHoles,
    verticalHoles,
    horizontalLength,
    verticalLength,
  }

  const innerRadius = Math.min(5, Math.max(0, params.innerRadius ?? 0))
  draft.innerRadius = innerRadius

  const horizontalHoleSize = Math.min(
    Math.max(1, params.horizontalHoleSize ?? 4),
    maxHorizontalHoleSize(draft),
  )
  const verticalHoleSize = Math.min(
    Math.max(1, params.verticalHoleSize ?? 4),
    maxVerticalHoleSize(draft),
  )
  draft.horizontalHoleSize = horizontalHoleSize
  draft.verticalHoleSize = verticalHoleSize

  const horizontalHoleQuantity = Math.min(
    Math.max(1, Math.round(params.horizontalHoleQuantity ?? 2)),
    maxHorizontalHoleQuantity(draft),
  )
  const verticalHoleQuantity = Math.min(
    Math.max(1, Math.round(params.verticalHoleQuantity ?? 2)),
    maxVerticalHoleQuantity(draft),
  )
  const horizontalHoleRows = Math.min(
    Math.max(1, Math.round(params.horizontalHoleRows ?? 1)),
    maxHorizontalHoleRows(draft),
  )
  const verticalHoleRows = Math.min(
    Math.max(1, Math.round(params.verticalHoleRows ?? 1)),
    maxVerticalHoleRows(draft),
  )

  return {
    ...draft,
    innerRadius,
    horizontalHoleSize,
    horizontalHoleQuantity,
    horizontalHoleRows,
    verticalHoleSize,
    verticalHoleQuantity,
    verticalHoleRows,
  }
}

function createProfileGeometry(params: LBracketParams): THREE.ExtrudeGeometry {
  const {
    independentArms,
    horizontalLength,
    verticalLength,
    thickness,
    width,
    angle,
    innerRadius,
  } = params

  const lenH = horizontalLength
  const lenV = independentArms >= 1 ? verticalLength : horizontalLength

  if (lenH <= thickness || lenV <= thickness) {
    throw new Error('arm lengths must be greater than thickness')
  }
  if (thickness <= 0 || width <= 0) {
    throw new Error('thickness and width must be positive')
  }
  if (angle <= 0 || angle >= 180) {
    throw new Error('angle must be between 0 and 180 exclusive')
  }

  const alpha = THREE.MathUtils.degToRad(angle)
  const cosA = Math.cos(alpha)
  const sinA = Math.sin(alpha)

  const n1x = 0
  const n1y = 1
  const n2x = sinA
  const n2y = -cosA

  const sharpInner = offsetCorner(thickness, cosA, sinA)

  const arm1EndX = lenH
  const arm1EndY = 0
  const arm1InnerX = lenH + thickness * n1x
  const arm1InnerY = thickness * n1y

  const arm2EndX = lenV * cosA
  const arm2EndY = lenV * sinA
  const arm2InnerX = arm2EndX + thickness * n2x
  const arm2InnerY = arm2EndY + thickness * n2y

  const useInner = innerRadius > 0

  const innerC = useInner
    ? offsetCorner(thickness + innerRadius, cosA, sinA)
    : null
  const innerT1 = innerC
    ? {
        x: innerC.x - innerRadius * n1x,
        y: innerC.y - innerRadius * n1y,
      }
    : sharpInner
  const innerT2 = innerC
    ? {
        x: innerC.x - innerRadius * n2x,
        y: innerC.y - innerRadius * n2y,
      }
    : sharpInner

  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(arm1EndX, arm1EndY)
  shape.lineTo(arm1InnerX, arm1InnerY)

  if (useInner && innerC) {
    shape.lineTo(innerT1.x, innerT1.y)
    shape.absarc(
      innerC.x,
      innerC.y,
      innerRadius,
      angleAt(innerT1.x, innerT1.y, innerC.x, innerC.y),
      angleAt(innerT2.x, innerT2.y, innerC.x, innerC.y),
      true,
    )
  } else {
    shape.lineTo(sharpInner.x, sharpInner.y)
  }

  shape.lineTo(arm2InnerX, arm2InnerY)
  shape.lineTo(arm2EndX, arm2EndY)
  shape.lineTo(0, 0)

  return new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    curveSegments: 24,
  })
}

function subtractHoles(
  solid: THREE.BufferGeometry,
  params: LBracketParams,
): THREE.BufferGeometry {
  const {
    independentArms,
    horizontalLength,
    verticalLength,
    thickness,
    width,
    angle,
    horizontalHoles,
    verticalHoles,
    horizontalHoleSize,
    horizontalHoleQuantity,
    horizontalHoleRows,
    verticalHoleSize,
    verticalHoleQuantity,
    verticalHoleRows,
  } = params

  if (horizontalHoles < 1 && verticalHoles < 1) {
    return solid
  }

  const lenH = horizontalLength
  const lenV = independentArms >= 1 ? verticalLength : horizontalLength
  const alpha = THREE.MathUtils.degToRad(angle)
  const cosA = Math.cos(alpha)
  const sinA = Math.sin(alpha)
  const u2 = new THREE.Vector3(cosA, sinA, 0)
  const n1 = new THREE.Vector3(0, 1, 0)
  const n2 = new THREE.Vector3(sinA, -cosA, 0)
  const yAxis = new THREE.Vector3(0, 1, 0)
  const cutDepth = Math.max(thickness, width) + 4

  const evaluator = new Evaluator()
  let result = new Brush(solid)
  result.updateMatrixWorld(true)

  const cutAlongArm = (
    length: number,
    along: THREE.Vector3,
    through: THREE.Vector3,
    originOnOuter: THREE.Vector3,
    diameter: number,
    quantity: number,
    rows: number,
  ): void => {
    if (quantity < 1 || rows < 1 || diameter < 1) return
    const radius = diameter / 2
    const alongStations = holeStationsAlongArm(length, quantity, thickness)
    const acrossStations = holeStationsAcrossWidth(width, rows)

    for (const s of alongStations) {
      for (const z of acrossStations) {
        const position = originOnOuter
          .clone()
          .addScaledVector(along, s)
          .addScaledVector(through, thickness / 2)
        position.z = z

        const cyl = new THREE.CylinderGeometry(radius, radius, cutDepth, 24)
        const brush = new Brush(cyl)
        brush.position.copy(position)
        brush.quaternion.setFromUnitVectors(yAxis, through.clone().normalize())
        brush.updateMatrixWorld(true)

        const next = evaluator.evaluate(result, brush, SUBTRACTION)
        if (result.geometry !== solid) {
          result.geometry.dispose()
        }
        cyl.dispose()
        result = next
      }
    }
  }

  if (horizontalHoles >= 1) {
    cutAlongArm(
      lenH,
      new THREE.Vector3(1, 0, 0),
      n1,
      new THREE.Vector3(0, 0, 0),
      horizontalHoleSize,
      horizontalHoleQuantity,
      horizontalHoleRows,
    )
  }

  if (verticalHoles >= 1) {
    cutAlongArm(
      lenV,
      u2,
      n2,
      new THREE.Vector3(0, 0, 0),
      verticalHoleSize,
      verticalHoleQuantity,
      verticalHoleRows,
    )
  }

  const geometry = result.geometry
  result.geometry = new THREE.BufferGeometry()
  return geometry
}

function createLBracketGeometry(
  params: LBracketParams,
): THREE.BufferGeometry {
  const profile = createProfileGeometry(params)
  const withHoles = subtractHoles(profile, params)
  if (withHoles !== profile) {
    profile.dispose()
  }

  withHoles.computeBoundingBox()
  const box = withHoles.boundingBox
  if (box) {
    const centerX = (box.min.x + box.max.x) / 2
    const centerZ = (box.min.z + box.max.z) / 2
    withHoles.translate(-centerX, -box.min.y, -centerZ)
  }

  withHoles.computeVertexNormals()
  return withHoles
}

function asLBracket(params: Record<string, number>): LBracketParams {
  const normalized = normalizeLBracketParams(params)
  return {
    independentArms: normalized.independentArms,
    horizontalLength: normalized.horizontalLength,
    verticalLength: normalized.verticalLength,
    thickness: normalized.thickness,
    width: normalized.width,
    angle: normalized.angle,
    innerRadius: normalized.innerRadius,
    horizontalHoles: normalized.horizontalHoles,
    verticalHoles: normalized.verticalHoles,
    horizontalHoleSize: normalized.horizontalHoleSize,
    horizontalHoleQuantity: normalized.horizontalHoleQuantity,
    horizontalHoleRows: normalized.horizontalHoleRows,
    verticalHoleSize: normalized.verticalHoleSize,
    verticalHoleQuantity: normalized.verticalHoleQuantity,
    verticalHoleRows: normalized.verticalHoleRows,
  }
}

export const lBracketShape: ShapeDefinition = {
  id: 'l-bracket',
  label: 'L Bracket',
  defaults: {
    independentArms: 0,
    horizontalLength: 50,
    verticalLength: 50,
    thickness: 8,
    width: 30,
    angle: 90,
    innerRadius: 2,
    horizontalHoles: 1,
    verticalHoles: 1,
    horizontalHoleSize: 10,
    horizontalHoleQuantity: 1,
    horizontalHoleRows: 1,
    verticalHoleSize: 10,
    verticalHoleQuantity: 1,
    verticalHoleRows: 1,
  },
  params: [
    {
      type: 'toggle',
      key: 'independentArms',
      label: 'Independent arms',
    },
    {
      key: 'horizontalLength',
      label: 'Horizontal length',
      min: 20,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'verticalLength',
      label: 'Vertical length',
      min: 20,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'thickness',
      label: 'Thickness',
      min: 2,
      max: 100,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'width',
      label: 'Width',
      min: 10,
      max: 800,
      step: 1,
      unit: 'mm',
    },
    {
      key: 'angle',
      label: 'Angle',
      min: 30,
      max: 150,
      step: 1,
      unit: '°',
    },
    {
      key: 'innerRadius',
      label: 'Inner radius',
      min: 0,
      max: 5,
      step: 1,
      unit: 'mm',
    },
    {
      type: 'toggle',
      key: 'horizontalHoles',
      label: 'Horizontal holes',
    },
    {
      key: 'horizontalHoleSize',
      label: 'H hole size',
      min: 1,
      max: 799,
      step: 1,
      unit: 'mm',
      dynamicMax: maxHorizontalHoleSize,
      disabledWhen: (params) => params.horizontalHoles < 1,
    },
    {
      key: 'horizontalHoleQuantity',
      label: 'H holes along',
      min: 1,
      max: 4,
      step: 1,
      dynamicMax: maxHorizontalHoleQuantity,
      disabledWhen: (params) => params.horizontalHoles < 1,
    },
    {
      key: 'horizontalHoleRows',
      label: 'H hole rows',
      min: 1,
      max: 4,
      step: 1,
      dynamicMax: maxHorizontalHoleRows,
      disabledWhen: (params) => params.horizontalHoles < 1,
    },
    {
      type: 'toggle',
      key: 'verticalHoles',
      label: 'Vertical holes',
    },
    {
      key: 'verticalHoleSize',
      label: 'V hole size',
      min: 1,
      max: 799,
      step: 1,
      unit: 'mm',
      dynamicMax: maxVerticalHoleSize,
      disabledWhen: (params) => params.verticalHoles < 1,
    },
    {
      key: 'verticalHoleQuantity',
      label: 'V holes along',
      min: 1,
      max: 4,
      step: 1,
      dynamicMax: maxVerticalHoleQuantity,
      disabledWhen: (params) => params.verticalHoles < 1,
    },
    {
      key: 'verticalHoleRows',
      label: 'V hole rows',
      min: 1,
      max: 4,
      step: 1,
      dynamicMax: maxVerticalHoleRows,
      disabledWhen: (params) => params.verticalHoles < 1,
    },
  ],
  applyParamChange: applyLBracketParamChange,
  normalizeParams: normalizeLBracketParams,
  createGeometry: (params) => createLBracketGeometry(asLBracket(params)),
  orientMesh(mesh) {
    mesh.rotation.set(0, 0, 0)
  },
  groundOffset() {
    return -2
  },
  fileName(params) {
    const p = asLBracket(params)
    const hHoles =
      p.horizontalHoles >= 1
        ? `-Hh${p.horizontalHoleRows}x${p.horizontalHoleQuantity}x${p.horizontalHoleSize}`
        : ''
    const vHoles =
      p.verticalHoles >= 1
        ? `-Vh${p.verticalHoleRows}x${p.verticalHoleQuantity}x${p.verticalHoleSize}`
        : ''
    if (p.independentArms >= 1) {
      return `l-bracket-H${p.horizontalLength}-V${p.verticalLength}x${p.width}x${p.thickness}-${p.angle}deg${hHoles}${vHoles}.stl`
    }
    return `l-bracket-${p.horizontalLength}x${p.width}x${p.thickness}-${p.angle}deg${hHoles}${vHoles}.stl`
  },
}
