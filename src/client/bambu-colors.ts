/**
 * Bambu Studio / OrcaSlicer per-object filament colours for 3MF.
 *
 * ## Why this module exists
 *
 * A slicer project 3MF declares its colours in three places, none of which is
 * the standard 3MF `<basematerials>` element:
 *
 * ```text
 * Metadata/project_settings.config   {"filament_colour": ["#FF99CC", ...]}
 * Metadata/model_settings.config     <object id="44"><metadata key="extruder" value="2"/>...
 * 3D/3dmodel.model                   <object id="44"><component p:path="/3D/Objects/object_57.model" objectid="42"/>
 * 3D/Objects/object_57.model         the actual mesh
 * ```
 *
 * i.e. colour = `filament_colour[ extruder - 1 ]`, and the extruder is keyed by
 * the **core 3MF object id** from `3dmodel.model` (`44`), while the mesh itself
 * lives in an external part under the 3MF Production Extension, addressed by a
 * *different* id (`objectid="42"`).
 *
 * The renderer we build on joins those two id spaces wrongly: it takes the
 * scene object id (`3d/objects/object_57.model#42`, where `#42` is the
 * external part id) and looks `42` up in the extruder table — which is keyed
 * `44`. The two spaces are disjoint, so every object misses and a multi-colour
 * Bambu project renders neutral grey with `capabilities.materials:
 * 'unavailable'`, even though the file declares four filaments and 37 extruder
 * assignments. Measured on a real 4-plate Bambu project: 0/37 hits.
 *
 * This module re-does the join correctly, from the zip itself, and writes the
 * result onto the already-parsed {@link ModelScene} — no fork, no patched
 * dependency.
 *
 * ## Honesty rules
 *
 * - Colours are only applied when the source **declares** both the extruder
 *   assignment and a palette slot that resolves. Nothing is invented: a file
 *   with no `project_settings.config`, no `filament_colour`, or an extruder
 *   index outside the palette keeps the renderer's neutral default.
 * - Objects the renderer already coloured (standard `basematerials`, or the
 *   `paint_color` facet-paint path) are left untouched.
 * - Files without the Production Extension (a single-part 3MF) are unaffected:
 *   their part paths have no `p:path` entry, so the map simply misses.
 *
 * @module dsh-3d-preview/client/bambu-colors
 */

import { unzipSync } from 'fflate'
import type { ModelScene, RGB } from '@chestnutlabs/gcode-model-renderer'

/** Zip entry names we read. Compared case-insensitively (slicers vary). */
const ENTRY_MODEL_PART = '3d/3dmodel.model'
const ENTRY_MODEL_SETTINGS = 'metadata/model_settings.config'
const ENTRY_PROJECT_SETTINGS = 'metadata/project_settings.config'

/** The renderer's own neutral surface colour, used when a palette slot is blank. */
const NEUTRAL_LINEAR: RGB = [0.8, 0.8, 0.82]

/** Options for {@link applyBambuExtruderColors}. */
export interface BambuColorOptions {
  /**
   * Palette override (hex `#RRGGBB` per 0-based filament slot), winning over
   * `filament_colour` read from the file. Same semantics as the renderer's own
   * `filamentPalette` option.
   */
  filamentPalette?: readonly (string | undefined)[]
}

/** Outcome of {@link applyBambuExtruderColors}. */
export interface BambuColorResult {
  /** Objects that received a colour from this pass. */
  colored: number
  /** Objects left as the renderer had them (already coloured, or unresolvable). */
  skipped: number
  /** Resolved palette length (0 = the source declared no usable palette). */
  paletteSize: number
}

/**
 * sRGB `#RRGGBB` → linear RGB, matching three's working colour space. Ported
 * from the renderer's private helper so our colours land identically.
 *
 * @param hex - `#RRGGBB` or `RRGGBB`.
 * @returns Linear RGB, or `null` when the string is not a 6-digit hex colour.
 */
export function srgbHexToLinear(hex: string): RGB | null {
  const h = hex.trim().replace(/^#/, '')
  if (h.length < 6) return null
  const to = (o: number): number => {
    const c = parseInt(h.slice(o, o + 2), 16) / 255
    if (Number.isNaN(c)) return Number.NaN
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = to(0)
  const g = to(2)
  const b = to(4)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return [r, g, b]
}

/**
 * Parse the per-object / per-part extruder assignments out of a Bambu/Orca
 * `Metadata/model_settings.config`.
 *
 * A `key="extruder"` binds to the nearest preceding `<object>`/`<part>` header
 * (so a part's own extruder overrides its parent object's default). This mirrors
 * the renderer's scanner exactly — that scanner is correct, it is only the
 * *lookup key* downstream that is wrong.
 *
 * @param xml - The decoded `model_settings.config` text.
 * @returns 1-based extruder index keyed by 3MF core object/part id.
 */
export function parseObjectExtruders(xml: string): Map<string, number> {
  const map = new Map<string, number>()
  const headerRe = /<(?:object|part)\s+id="(\d+)"[^>]*>([\s\S]*?)(?=<(?:object|part)\s+id="|<\/config>|$)/g
  let match: RegExpExecArray | null
  while ((match = headerRe.exec(xml)) !== null) {
    const found = /key="extruder"\s+value="(\d+)"/i.exec(match[2] ?? '')
    if (found === null) continue
    const index = Number.parseInt(found[1] ?? '', 10)
    if (Number.isFinite(index) && index >= 1) map.set(match[1] ?? '', index)
  }
  return map
}

/**
 * Map every external 3MF part path back to the core object id that references
 * it, reading the `<component p:path="...">` links of `3D/3dmodel.model`.
 *
 * @param xml - The decoded `3dmodel.model` text.
 * @returns Lower-cased, slash-normalised part path → core object id.
 */
export function parsePartPaths(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  const objectRe = /<object\s+id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g
  let object: RegExpExecArray | null
  while ((object = objectRe.exec(xml)) !== null) {
    const coreId = object[1] ?? ''
    const body = object[2] ?? ''
    const componentRe = /<component\s[^>]*p:path="([^"]+)"/g
    let component: RegExpExecArray | null
    while ((component = componentRe.exec(body)) !== null) {
      map.set(normalisePartPath(component[1] ?? ''), coreId)
    }
  }
  return map
}

/**
 * Normalise a 3MF part path / scene object id into a lookup key: strip a
 * leading slash, lowercase, collapse separators.
 *
 * @param path - `/3D/Objects/object_57.model` or `3d/objects/object_57.model`.
 * @returns The comparison key.
 */
export function normalisePartPath(path: string): string {
  return path.replace(/^[\\/]+/, '').replace(/\\/g, '/').toLowerCase()
}

/**
 * Read `filament_colour` out of a parsed `project_settings.config`.
 *
 * @param settings - The parsed JSON.
 * @returns Hex strings per filament slot (blank slots kept as `undefined`).
 */
export function filamentColoursFromSettings(settings: unknown): (string | undefined)[] {
  if (settings === null || typeof settings !== 'object') return []
  const raw = (settings as Record<string, unknown>)['filament_colour']
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => (typeof entry === 'string' && entry.trim() !== '' ? entry.trim() : undefined))
}

/** Decoded text of the first zip entry matching `name` (case-insensitive). */
function readEntry(files: Record<string, Uint8Array>, name: string): string | undefined {
  for (const [entryName, bytes] of Object.entries(files)) {
    if (entryName.replace(/\\/g, '/').toLowerCase() === name) return new TextDecoder().decode(bytes)
  }
  return undefined
}

/**
 * Apply Bambu/Orca per-object filament colours to an already-parsed scene.
 *
 * Mutates `scene.objects[].material` in place and flips
 * `scene.capabilities.materials` to `'known'` when at least one object was
 * coloured by this pass (the source did declare the mapping — the renderer just
 * failed to join it).
 *
 * Never throws: a malformed or non-zip payload simply colours nothing, which
 * leaves the caller with the renderer's own behaviour.
 *
 * @param scene - Scene produced by the renderer's `parse3mf`.
 * @param zipBytes - The original 3MF bytes (the scene no longer carries them).
 * @param options - See {@link BambuColorOptions}.
 * @returns See {@link BambuColorResult}.
 */
export function applyBambuExtruderColors(
  scene: ModelScene,
  zipBytes: Uint8Array,
  options: BambuColorOptions = {},
): BambuColorResult {
  let files: Record<string, Uint8Array>
  try {
    // Filtered inflate: the geometry parts are ~28 MB uncompressed and are not
    // needed here, so only the three small metadata entries are extracted.
    files = unzipSync(zipBytes, {
      filter: (file) => {
        const name = file.name.replace(/\\/g, '/').toLowerCase()
        return name === ENTRY_MODEL_PART || name === ENTRY_MODEL_SETTINGS || name === ENTRY_PROJECT_SETTINGS
      },
    }) as Record<string, Uint8Array>
  } catch {
    return { colored: 0, skipped: scene.objects.length, paletteSize: 0 }
  }

  const modelXml = readEntry(files, ENTRY_MODEL_PART)
  const settingsXml = readEntry(files, ENTRY_MODEL_SETTINGS)
  if (modelXml === undefined || settingsXml === undefined) {
    return { colored: 0, skipped: scene.objects.length, paletteSize: 0 }
  }

  // Palette: explicit override wins, else `filament_colour` from the file.
  let paletteHex: (string | undefined)[] = options.filamentPalette !== undefined && options.filamentPalette.length > 0
    ? [...options.filamentPalette]
    : []
  if (paletteHex.length === 0) {
    const settingsJson = readEntry(files, ENTRY_PROJECT_SETTINGS)
    if (settingsJson !== undefined) {
      try {
        paletteHex = filamentColoursFromSettings(JSON.parse(settingsJson))
      } catch {
        paletteHex = []
      }
    }
  }
  const palette: RGB[] = paletteHex.map((hex) => (hex !== undefined ? srgbHexToLinear(hex) ?? NEUTRAL_LINEAR : NEUTRAL_LINEAR))

  const extruders = parseObjectExtruders(settingsXml)
  const partPaths = parsePartPaths(modelXml)

  let colored = 0
  let skipped = 0
  for (const object of scene.objects) {
    if (object.material?.color !== undefined) {
      skipped += 1
      continue
    }
    // Scene ids are `<lower-cased part path>#<external part id>`; the extruder
    // table is keyed by the core object id, so the join goes through the path.
    const hash = object.id.lastIndexOf('#')
    const partPath = normalisePartPath(hash > 0 ? object.id.slice(0, hash) : object.id)
    const coreId = partPaths.get(partPath)
    const extruder = coreId !== undefined ? extruders.get(coreId) : undefined
    const color = extruder !== undefined ? palette[extruder - 1] : undefined
    if (color === undefined) {
      skipped += 1
      continue
    }
    object.material = { color }
    colored += 1
  }

  if (colored > 0) scene.capabilities.materials = 'known'
  return { colored, skipped, paletteSize: palette.length }
}
