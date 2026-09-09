# 3D Print File Generator

Browser app that builds parametric STL models for 3D printing. Adjust dimensions in millimeters, preview the part live, and download an STL — no CAD software required.

Everything runs in the browser. There is no backend, login, or saved library; each session is local to your machine.

## Features

- Live 3D preview (orbit, zoom, pan) on an **800×800 mm** print-bed grid
- Parametric objects with per-shape controls (sliders + typed number fields + toggles)
- Linked parameters where it helps (e.g. equal box sides, linked L-bracket arms)
- Dynamic limits so invalid geometry is clamped (e.g. hole size vs arm length)
- Binary STL download with a descriptive filename from the current params
- Reset restores defaults for the active object

## Objects

### L Bracket

Angled L profile with optional mounting holes on each arm.

| Control | Range / notes |
|---------|----------------|
| Independent arms | Off = both arms share one length; on = edit separately |
| Horizontal / vertical length | 20–800 mm |
| Thickness | 2–100 mm |
| Width | 10–800 mm (extrusion depth) |
| Angle | 30–150° (interior angle between arms) |
| Inner radius | 0–5 mm (concave round at the inner corner) |
| Horizontal / vertical holes | Toggle per arm |
| Hole size, along, rows | Per arm; up to 4×4; size capped by arm geometry |

Defaults include holes on both arms (1×1, 10 mm).

### U Bracket

Open-top U channel. One **Size** slider (20–800 mm) scales outer width and height; wall thickness is fixed at 4 mm; extrusion depth scales with size.

### Hook

Squared J-hook profile. One **Size** slider (20–800 mm); wall thickness fixed at 4 mm; opening and depth scale with size.

### Box

Open-top box (no lid). Built from a bottom panel plus side walls so individual faces can be removed.

| Control | Range / notes |
|---------|----------------|
| Equal sizes | On = Width / Height / Depth stay linked |
| Width X, Height Y, Depth Z | 10–800 mm |
| Wall thickness | 1–100 mm (capped by shortest side) |
| Bottom / Left / Right / Front / Back | Toggle each panel |

### Pipe

Hollow cylinder along its length.

| Control | Range / notes |
|---------|----------------|
| Outer radius | 5–400 mm |
| Inner radius | 1–399 mm (kept below outer) |
| Length | 10–800 mm |
| Close left / right end | Optional inward caps |
| Cap thickness | Enabled when that end is closed; caps cannot consume the full length |

## Units and printing

- All dimensions are **millimeters**.
- Exported files are **binary STL**, suitable for most slicers (Cura, PrusaSlicer, Bambu Studio, etc.).
- The on-screen grid is an 800×800 mm plate for scale reference only — it is not written into the STL.
- Always check orientation, wall thickness, and overhangs in your slicer before printing.

## Setup

Requires Node.js 18+ (or a current LTS).

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve the production build locally |

## Usage

1. Choose an object from the top tabs.
2. Edit parameters in the left panel (drag a slider or type a number and press Enter / blur).
3. Orbit the preview to inspect the model.
4. Click **Download STL** for a file named from the current dimensions.
5. Click **Reset** to restore that object’s defaults.

Invalid typed values are rejected and the field reverts to the last valid number. Some controls grey out when a parent toggle is off (e.g. hole size when holes are disabled).

## Architecture

The app is a static Vite page with no server. `index.html` mounts four DOM slots (`#shape-nav`, `#param-controls`, `#viewport`, `#download` / `#reset`). `src/main.ts` is the only place that wires those slots to the rest of the code.

```
index.html
    └── src/main.ts          session glue (nav, params, reset, STL download)
            ├── ui.ts        builds tabs and the param form from a ShapeDefinition
            ├── preview.ts   owns the Three.js scene and the live mesh
            └── shapes/      registry + one file per printable object
```

### Layers

| Layer | File | Responsibility |
|-------|------|----------------|
| Shell | `index.html`, `style.css` | Layout: top tabs, left controls, viewport, download button |
| Session | `main.ts` | Holds the preview instance; re-renders UI after shape/param/reset; exports binary STL from the current mesh |
| View | `ui.ts` | Pure DOM: shape tabs and range/toggle controls. Does not keep param state |
| Scene | `preview.ts` | Camera, lights, 800 mm grid, orbit controls. **Source of truth** for the active shape and param map |
| Catalog | `shapes/*` | Geometry and control metadata. Preview and UI never hard-code object types |

Param values live only in `ModelPreview`. The UI reads them to paint controls and writes them back through `preview.setParam`. Switching tabs calls `preview.setShape`, which loads that shape’s defaults (then `normalizeParams` if present).

### Edit → mesh → STL

1. User changes a control → `ui.ts` calls `preview.setParam(key, value)`.
2. `setParam` optionally runs `applyParamChange` (linked fields, e.g. equal box sides), then `normalizeParams` (clamps, e.g. inner radius &lt; outer).
3. `rebuildMesh` disposes the old geometry, calls `shape.createGeometry(params)`, then `orientMesh` / `groundOffset` so the part sits on the grid.
4. **Download STL** uses Three.js `STLExporter` on that mesh (world matrix applied). Filename comes from `shape.fileName(params)`. The grid is never exported.

### Shape registry

Each object is a `ShapeDefinition` (`src/shapes/types.ts`):

| Field | Role |
|-------|------|
| `id` / `label` | Tab identity and display name |
| `defaults` | Starting param map (all numbers; toggles are `0` or `1`) |
| `params` | Control list the UI renders |
| `createGeometry` | Build `THREE.BufferGeometry` in millimeters |
| `normalizeParams` | Clamp interdependent values after any edit |
| `applyParamChange` | Optional: one key change updates other keys |
| `orientMesh` / `groundOffset` | How the mesh sits on the print-bed grid |
| `fileName` | STL download name |

Register new objects in `src/shapes/index.ts` (`shapes` array order = tab order). Add a file under `shapes/`, export a `ShapeDefinition`, and append it to that array. Nav, sliders, preview, and export pick it up with no changes to `main.ts`.

### Controls

- **Range**: slider + typed number; optional `dynamicMax`, `visibleWhen`, `disabledWhen`
- **Toggle**: stored as `0` | `1` in the same param map as ranges

Invalid typed numbers are rejected in the UI and the field reverts. Disabled/hidden controls stay in the param map; they just are not editable.

## Stack

- [Vite](https://vitejs.dev/) 5 + TypeScript
- [Three.js](https://threejs.org/) (WebGL preview, OrbitControls, STLExporter)
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) for boolean operations (e.g. L-bracket holes)

## License

Private project (`package.json`). Adjust as needed if you publish it.
