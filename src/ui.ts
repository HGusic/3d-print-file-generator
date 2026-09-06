import type {
  ParamField,
  RangeParamField,
  ShapeDefinition,
  ToggleParamField,
} from './shapes'

function isRangeField(field: ParamField): field is RangeParamField {
  return field.type !== 'toggle'
}

function effectiveMax(
  field: RangeParamField,
  values: Record<string, number>,
): number {
  if (!field.dynamicMax) return field.max
  return Math.min(field.max, field.dynamicMax(values))
}

function isVisible(
  field: ParamField,
  values: Record<string, number>,
): boolean {
  return field.visibleWhen ? field.visibleWhen(values) : true
}

function isDisabled(
  field: ParamField,
  values: Record<string, number>,
): boolean {
  return field.disabledWhen ? field.disabledWhen(values) : false
}

/** Build the top object switcher from the shape registry. */
export function renderShapeNav(
  container: HTMLElement,
  shapes: ShapeDefinition[],
  activeId: string,
  onSelect: (id: string) => void,
): void {
  container.replaceChildren()

  for (const shape of shapes) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'shape-tab'
    button.textContent = shape.label
    button.dataset.shapeId = shape.id
    button.setAttribute('aria-pressed', String(shape.id === activeId))
    if (shape.id === activeId) {
      button.classList.add('is-active')
    }
    button.addEventListener('click', () => onSelect(shape.id))
    container.appendChild(button)
  }
}

function applyDisabledState(group: HTMLElement, disabled: boolean): void {
  group.classList.toggle('is-disabled', disabled)
  for (const el of group.querySelectorAll('input')) {
    ;(el as HTMLInputElement).disabled = disabled
  }
}

function syncControlValues(
  shape: ShapeDefinition,
  values: Record<string, number>,
): void {
  for (const field of shape.params) {
    if (!isVisible(field, values)) continue

    const input = document.querySelector<HTMLInputElement>(
      `#param-${shape.id}-${field.key}`,
    )
    if (!input) continue

    const group = input.closest<HTMLElement>('.slider-group, .toggle-group')
    const value = values[field.key] ?? shape.defaults[field.key] ?? 0
    const disabled = isDisabled(field, values)

    if (group) {
      applyDisabledState(group, disabled)
    } else {
      input.disabled = disabled
    }

    if (isRangeField(field)) {
      const numberInput = document.querySelector<HTMLInputElement>(
        `#param-value-${shape.id}-${field.key}`,
      )
      const max = effectiveMax(field, values)
      input.max = String(max)
      const clamped = Math.min(Math.max(value, field.min), max)
      input.value = String(clamped)
      if (numberInput) {
        numberInput.max = String(max)
        numberInput.value = String(clamped)
      }
    } else {
      input.checked = value >= 1
    }
  }
}

function visibleSignature(
  shape: ShapeDefinition,
  values: Record<string, number>,
): string {
  return shape.params
    .map((field) => (isVisible(field, values) ? '1' : '0'))
    .join('')
}

function renderRangeControl(
  shapeId: string,
  field: RangeParamField,
  values: Record<string, number>,
  onInput: (key: string, value: number) => void,
  getValues: () => Record<string, number>,
): HTMLElement {
  const value = values[field.key] ?? 0
  const max = effectiveMax(field, values)
  const disabled = isDisabled(field, values)

  const group = document.createElement('div')
  group.className = 'slider-group'

  const header = document.createElement('div')
  header.className = 'slider-label'

  const name = document.createElement('label')
  name.textContent = field.label
  name.htmlFor = `param-${shapeId}-${field.key}`

  const valueEdit = document.createElement('div')
  valueEdit.className = 'value-edit'

  const numberInput = document.createElement('input')
  numberInput.type = 'number'
  numberInput.className = 'value-input'
  numberInput.id = `param-value-${shapeId}-${field.key}`
  numberInput.min = String(field.min)
  numberInput.max = String(max)
  numberInput.step = String(field.step)
  numberInput.value = String(Math.min(value, max))
  numberInput.setAttribute('aria-label', `${field.label} value`)

  if (field.unit) {
    const unit = document.createElement('span')
    unit.className = 'value-unit'
    unit.textContent = field.unit
    valueEdit.append(numberInput, unit)
  } else {
    valueEdit.append(numberInput)
  }

  header.append(name, valueEdit)

  const rangeInput = document.createElement('input')
  rangeInput.type = 'range'
  rangeInput.id = `param-${shapeId}-${field.key}`
  rangeInput.min = String(field.min)
  rangeInput.max = String(max)
  rangeInput.step = String(field.step)
  rangeInput.value = String(Math.min(value, max))

  rangeInput.addEventListener('input', () => {
    onInput(field.key, Number(rangeInput.value))
  })

  const commitTypedValue = (): void => {
    const current = getValues()
    const allowedMax = effectiveMax(field, current)
    const currentValue = current[field.key] ?? field.min
    const parsed = Number(numberInput.value)

    if (
      numberInput.value.trim() === '' ||
      !Number.isFinite(parsed) ||
      parsed < field.min ||
      parsed > allowedMax
    ) {
      // Invalid — leave model/slider unchanged, restore the field
      numberInput.value = String(currentValue)
      return
    }

    onInput(field.key, parsed)
  }

  numberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      numberInput.blur()
    }
  })

  numberInput.addEventListener('blur', commitTypedValue)

  applyDisabledState(group, disabled)
  group.append(header, rangeInput)
  return group
}

function renderToggleControl(
  shapeId: string,
  field: ToggleParamField,
  values: Record<string, number>,
  onInput: (key: string, value: number) => void,
): HTMLElement {
  const value = values[field.key] ?? 0
  const disabled = isDisabled(field, values)

  const label = document.createElement('label')
  label.className = 'toggle-group'
  label.htmlFor = `param-${shapeId}-${field.key}`

  const name = document.createElement('span')
  name.className = 'toggle-label'
  name.textContent = field.label

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.id = `param-${shapeId}-${field.key}`
  input.className = 'toggle-input'
  input.checked = value >= 1

  input.addEventListener('change', () => {
    onInput(field.key, input.checked ? 1 : 0)
  })

  applyDisabledState(label, disabled)
  label.append(name, input)
  return label
}

/**
 * Render each shape's unique controls into the side panel.
 * Call again whenever the active shape changes.
 *
 * `onChange` should apply the value (and any normalization) and return the
 * resulting param map so dependent controls can stay in sync.
 */
export function renderParamControls(
  container: HTMLElement,
  shape: ShapeDefinition,
  values: Record<string, number>,
  onChange: (key: string, value: number) => Record<string, number>,
): void {
  container.replaceChildren()

  let currentValues = values

  const handleChange = (key: string, value: number): void => {
    const before = visibleSignature(shape, currentValues)
    const updated = onChange(key, value)
    currentValues = updated
    const after = visibleSignature(shape, updated)

    if (before !== after) {
      renderParamControls(container, shape, updated, onChange)
      return
    }

    syncControlValues(shape, updated)
  }

  for (const field of shape.params) {
    if (!isVisible(field, values)) continue

    if (isRangeField(field)) {
      container.appendChild(
        renderRangeControl(
          shape.id,
          field,
          values,
          handleChange,
          () => currentValues,
        ),
      )
    } else {
      container.appendChild(
        renderToggleControl(shape.id, field, values, handleChange),
      )
    }
  }
}
