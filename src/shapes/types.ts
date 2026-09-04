import type * as THREE from 'three'

/** Numeric slider control. */
export type RangeParamField = {
  type?: 'range'
  key: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
  /** Caps this slider's max from other live param values. */
  dynamicMax?: (params: Record<string, number>) => number
  /** Hide this control unless the predicate passes. */
  visibleWhen?: (params: Record<string, number>) => boolean
  /** Grey out / disable this control when the predicate passes. */
  disabledWhen?: (params: Record<string, number>) => boolean
}

/** On/off control stored as 0 | 1 in params. */
export type ToggleParamField = {
  type: 'toggle'
  key: string
  label: string
  visibleWhen?: (params: Record<string, number>) => boolean
  disabledWhen?: (params: Record<string, number>) => boolean
}

export type ParamField = RangeParamField | ToggleParamField

/**
 * A printable object type. Add a new file under `shapes/`, then register it
 * in `registry` (`shapes/index.ts`) — UI, preview, and STL naming all come from this.
 *
 * `params` keys should match entries in `defaults`. Each shape can declare
 * any mix of unique controls.
 */
export type ShapeDefinition = {
  id: string
  label: string
  defaults: Record<string, number>
  params: ParamField[]
  createGeometry: (params: Record<string, number>) => THREE.BufferGeometry
  /**
   * Clamp / fix interdependent params after a change
   * (e.g. keep inner radius below outer).
   */
  normalizeParams?: (
    params: Record<string, number>,
  ) => Record<string, number>
  /**
   * Apply a single control change. Use when changing one key should also
   * update others (e.g. linked arm lengths).
   */
  applyParamChange?: (
    params: Record<string, number>,
    key: string,
    value: number,
  ) => Record<string, number>
  /** Mesh orientation after geometry is applied (e.g. lay pipe on its side). */
  orientMesh?: (mesh: THREE.Mesh) => void
  /** Y position for the ground grid under the object. */
  groundOffset?: (params: Record<string, number>) => number
  fileName: (params: Record<string, number>) => string
}
