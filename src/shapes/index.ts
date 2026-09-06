import { boxShape } from './box'
import { hookShape } from './hook'
import { lBracketShape } from './l-bracket'
import { pipeShape } from './pipe'
import { uBracketShape } from './u-bracket'
import type { ShapeDefinition } from './types'

/** Register new objects here — order = tab order in the top nav. */
export const shapes: ShapeDefinition[] = [
  lBracketShape,
  uBracketShape,
  hookShape,
  boxShape,
  pipeShape,
]

export function getShape(id: string): ShapeDefinition {
  const shape = shapes.find((s) => s.id === id)
  if (!shape) {
    throw new Error(`Unknown shape: ${id}`)
  }
  return shape
}

export type {
  ShapeDefinition,
  ParamField,
  RangeParamField,
  ToggleParamField,
} from './types'
export { pipeShape } from './pipe'
export { lBracketShape } from './l-bracket'
export { uBracketShape } from './u-bracket'
export { hookShape } from './hook'
export { boxShape } from './box'
