# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims at
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-08

First public release.

### Added

- `registerFileViewer` descriptor claiming `.stl` and `.3mf` in dsh-better-sidebar,
  registered through the `betterSidebar` service and disposed with the plugin fiber.
- 3D stage: orbit / zoom / pan, fit view, PNG snapshot, fullscreen, download of the
  original file.
- Slicer plate selector (`setRenderScope({ plateId })`, "All plates" chip), rendered
  only for files that actually declare more than one plate.
- Footer statistics: triangle count, object count, instance count, bounding-box size
  in mm, material confidence, and the count of filament-coloured objects.
- Real load progress from the renderer's typed stage events, with a determinate bar
  when a stage reports a total.
- Retry and download overlays for parse failures, over-limit files and missing WebGL;
  every retry gets a fresh canvas so a disposed WebGL context cannot leak into it.
- `src/client/bambu-colors.ts`: the slicer colour id-join. Bambu/Orca 3MF projects key
  their extruder table by the **core** object id while the mesh lives in an external
  part addressed by a different id, so the upstream lookup misses every object and a
  multi-filament project renders grey. The join is redone from the zip itself — no
  fork, no patched dependency. On the reference project this takes colouring from
  0/37 placements to 30/30 objects.
- Regression suite (`npm test`) that synthesises a Production-Extension project in
  memory and pins the id-join, plus unit coverage for the sRGB→linear conversion and
  the part-path normaliser.
- Bilingual UI (zh / en) resolved from `navigator.language`, kept inside the bundle so
  the viewer does not depend on another plugin's locale service.
- Build pipeline (`scripts/build.mjs`): esbuild host stub plus a single lazy-CJS
  client closure for `window.__ModuleLoader__`, with `three`, the model renderer and
  `fflate` inlined, and no runtime dependencies in the published package.

[Unreleased]: https://github.com/kmyqchy/dsh-3d-preview/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kmyqchy/dsh-3d-preview/releases/tag/v0.1.0
