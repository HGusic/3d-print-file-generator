# 3D Print File Generator

Browser app that builds parametric STL models for 3D printing. Adjust dimensions in millimeters, preview the part live, and download an STL — no CAD required.

## Features

- Live Three.js preview with orbit controls
- Parametric shapes (mm units), each with its own controls
- Download binary STL
- Client-only (no backend or accounts)

### Objects

| Object | Notes |
|--------|--------|
| **L Bracket** | Arm lengths, thickness, width, angle, inner radius, mounting holes |
| **U Bracket** | Single size control, open-top U |
| **Hook** | Sized J-hook profile |
| **Box** | Open-top box with X/Y/Z, equal-size lock, wall thickness, per-wall toggles |
| **Pipe** | Hollow tube with optional end caps |

Print bed preview is **800×800 mm**.

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Three.js](https://threejs.org/) + OrbitControls + STLExporter
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) (boolean cuts, e.g. L-bracket holes)

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build → dist/
npm run preview  # serve the build locally
```

## Usage

1. Pick an object from the top tabs
2. Drag sliders or type values in the left panel
3. Orbit the preview to inspect the part
4. **Download STL** when ready
5. **Reset** restores defaults for the active object

## Project layout

```
src/
  main.ts          App entry, STL download
  preview.ts       Three.js scene and live mesh updates
  ui.ts            Shape tabs and parameter controls
  shapes/          One module per object + shared registry
```

New objects: implement a `ShapeDefinition` and register it in `src/shapes/index.ts`.
