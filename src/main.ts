import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { ModelPreview } from './preview'
import { getShape, shapes } from './shapes'
import { renderParamControls, renderShapeNav } from './ui'
import './style.css'

const shapeNav = document.querySelector<HTMLElement>('#shape-nav')
const paramControls = document.querySelector<HTMLElement>('#param-controls')
const viewport = document.querySelector<HTMLElement>('#viewport')
const downloadBtn = document.querySelector<HTMLButtonElement>('#download')
const resetBtn = document.querySelector<HTMLButtonElement>('#reset')

if (!shapeNav || !paramControls || !viewport || !downloadBtn || !resetBtn) {
  throw new Error('Missing required DOM elements')
}

const initialShape = shapes[0]
const preview = new ModelPreview(viewport, initialShape)

function syncUi(): void {
  const shape = preview.getShape()
  renderShapeNav(shapeNav!, shapes, shape.id, (id) => {
    preview.setShape(getShape(id))
    syncUi()
  })
  renderParamControls(paramControls!, shape, preview.getParams(), (key, value) => {
    preview.setParam(key, value)
    return preview.getParams()
  })
}

syncUi()

resetBtn.addEventListener('click', () => {
  preview.resetParams()
  syncUi()
})

downloadBtn.addEventListener('click', () => {
  const exporter = new STLExporter()
  const mesh = preview.getMesh()
  mesh.updateMatrixWorld(true)
  const stl = exporter.parse(mesh, { binary: true })
  const blob = new Blob([stl], { type: 'application/octet-stream' })
  const shape = preview.getShape()
  const fileName = shape.fileName(preview.getParams())
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
})
