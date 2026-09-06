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

```
src/
  main.ts           Wire-up: nav, preview, download, reset
  preview.ts        Three.js scene, orbit controls, live mesh rebuild
  ui.ts             Shape tabs + param panel (range / toggle)
  style.css         UI layout and theme
  shapes/
    types.ts        ShapeDefinition and ParamField contracts
    index.ts        Registry (tab order = array order)
    l-bracket.ts
    u-bracket.ts
    hook.ts
    box.ts
    pipe.ts
```

### Shape registry

Each printable object is a `ShapeDefinition`:

- `defaults` / `params` — UI controls (range or toggle)
- `createGeometry(params)` — returns a `THREE.BufferGeometry` in mm
- `normalizeParams` — clamp interdependent values after edits
- `applyParamChange` — optional linked updates (e.g. equal sizes)
- `orientMesh` / `groundOffset` — how the mesh sits on the grid
- `fileName(params)` — STL download name

Register new shapes in `src/shapes/index.ts`. The UI, preview, and export pick them up automatically.

### Controls

- **Range**: slider + editable number; optional `dynamicMax`, `visibleWhen`, `disabledWhen`
- **Toggle**: stored as `0` | `1` in the param map

## Stack

- [Vite](https://vitejs.dev/) 5 + TypeScript
- [Three.js](https://threejs.org/) (WebGL preview, OrbitControls, STLExporter)
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) for boolean operations (e.g. L-bracket holes)

## License

Private project (`package.json`). Adjust as needed if you publish it.
