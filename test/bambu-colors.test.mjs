/**
 * Regression tests for the slicer-colour id-join fix.
 *
 * The bug this guards against is subtle and was found on a real Bambu project:
 * the extruder table is keyed by the **core** 3MF object id (`2`, `4`, …) while
 * the scene object id carries the **external part** id (`…#1`, `…#3`, …). The
 * two spaces are disjoint, so a naive join colours nothing. These tests build a
 * minimal Production-Extension project in memory and assert the join lands.
 *
 *   node --test test/
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { parse3mf } from '@chestnutlabs/gcode-model-renderer'
import {
  applyBambuExtruderColors,
  normalisePartPath,
  parseObjectExtruders,
  srgbHexToLinear,
} from '../src/client/bambu-colors.ts'

/**
 * One triangular external part file, addressed by `p:path`. `objectId` must
 * match the referencing `<component objectid="...">` (that is how slicers emit
 * it, and how the parser keys the part).
 */
function partModel(objectId, vertexOffset) {
  const o = vertexOffset
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
 <resources>
  <object id="${objectId}" type="model">
   <mesh>
    <vertices>
     <vertex x="${o}" y="0" z="0"/>
     <vertex x="${o + 10}" y="0" z="0"/>
     <vertex x="${o}" y="10" z="0"/>
    </vertices>
    <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
   </mesh>
  </object>
 </resources>
 <build/>
</model>`
}

/** The main part: two wrapper objects, each pointing at an external part. */
const MAIN_MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
 <resources>
  <object id="2" p:UUID="00000001-0000-0000-0000-000000000000" type="model">
   <components><component p:path="/3D/Objects/part_a.model" objectid="1" p:UUID="0000000a-0000-0000-0000-000000000000"/></components>
  </object>
  <object id="4" p:UUID="00000002-0000-0000-0000-000000000000" type="model">
   <components><component p:path="/3D/Objects/part_b.model" objectid="7" p:UUID="0000000b-0000-0000-0000-000000000000"/></components>
  </object>
 </resources>
 <build>
  <item objectid="2" p:UUID="0000000c-0000-0000-0000-000000000000" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
  <item objectid="4" p:UUID="0000000d-0000-0000-0000-000000000000" transform="1 0 0 0 1 0 0 0 1 20 0 0"/>
 </build>
</model>`

/** Extruder assignments keyed by CORE object id — the whole point of the fix. */
const MODEL_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">
    <metadata key="name" value="part_a"/>
    <metadata key="extruder" value="2"/>
  </object>
  <object id="4">
    <metadata key="name" value="part_b"/>
    <metadata key="extruder" value="1"/>
  </object>
</config>`

/** The slicer filament palette. */
const PROJECT_SETTINGS = JSON.stringify({ filament_colour: ['#FF0000', '#00FF00'] })

/** Build the in-memory project 3MF. */
function buildProject() {
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    '3D/3dmodel.model': strToU8(MAIN_MODEL),
    '3D/Objects/part_a.model': strToU8(partModel(1, 0)),
    '3D/Objects/part_b.model': strToU8(partModel(7, 100)),
    '3D/_rels/3dmodel.model.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Target="/3D/Objects/part_a.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
      + '<Relationship Target="/3D/Objects/part_b.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
      + '</Relationships>',
    ),
    'Metadata/model_settings.config': strToU8(MODEL_SETTINGS),
    'Metadata/project_settings.config': strToU8(PROJECT_SETTINGS),
  })
}

test('srgbHexToLinear matches three working colour space', () => {
  const white = srgbHexToLinear('#FFFFFF')
  assert.ok(white)
  assert.deepEqual([...white].map((c) => Number(c.toFixed(4))), [1, 1, 1])

  const black = srgbHexToLinear('#000000')
  assert.deepEqual(black, [0, 0, 0])

  // #808080 sRGB → ~0.2159 linear.
  const grey = srgbHexToLinear('808080')
  assert.ok(grey)
  assert.equal(Number(grey[0].toFixed(4)), 0.2159)
  assert.equal(srgbHexToLinear('#GGGGGG'), null)
  assert.equal(srgbHexToLinear('#FFF'), null)
})

test('parseObjectExtruders keys the map by core object id', () => {
  const map = parseObjectExtruders(MODEL_SETTINGS)
  assert.equal(map.get('2'), 2)
  assert.equal(map.get('4'), 1)
  assert.equal(map.size, 2)
})

test('normalisePartPath folds case and separators', () => {
  assert.equal(normalisePartPath('/3D/Objects/part_a.model'), '3d/objects/part_a.model')
  assert.equal(normalisePartPath('3d\\objects\\part_a.model'), '3d/objects/part_a.model')
})

test('production-extension extruder colours reach the right objects', async () => {
  const bytes = buildProject()
  const scene = await parse3mf(bytes)
  assert.equal(scene.objects.length, 2, 'both external parts parsed')

  // Sanity: the renderer itself cannot resolve these (no basematerials, and it
  // looks the extruder up by external part id).
  assert.equal(scene.capabilities.materials, 'unavailable')

  const result = applyBambuExtruderColors(scene, bytes)
  assert.equal(result.colored, 2)
  assert.equal(result.paletteSize, 2)
  assert.equal(scene.capabilities.materials, 'known')

  // core 2 → extruder 2 → palette[1] = #00FF00 (green, linear [0,1,0]).
  // core 4 → extruder 1 → palette[0] = #FF0000 (red,   linear [1,0,0]).
  const byPath = new Map(scene.objects.map((object) => [object.id, object.material?.color]))
  const keys = [...byPath.keys()].sort()
  assert.deepEqual(keys, ['3d/objects/part_a.model#1', '3d/objects/part_b.model#7'])

  const green = byPath.get('3d/objects/part_a.model#1')
  const red = byPath.get('3d/objects/part_b.model#7')
  assert.deepEqual([...green].map((c) => Number(c.toFixed(4))), [0, 1, 0])
  assert.deepEqual([...red].map((c) => Number(c.toFixed(4))), [1, 0, 0])
})

test('an explicit palette override wins over the file palette', async () => {
  const bytes = buildProject()
  const scene = await parse3mf(bytes)
  const result = applyBambuExtruderColors(scene, bytes, { filamentPalette: ['#0000FF', '#FFFF00'] })
  assert.equal(result.colored, 2)
  const byPath = new Map(scene.objects.map((object) => [object.id, object.material?.color]))
  assert.deepEqual([...byPath.get('3d/objects/part_a.model#1')].map((c) => Number(c.toFixed(4))), [1, 1, 0])
})

test('objects the renderer already coloured are left alone', async () => {
  const bytes = buildProject()
  const scene = await parse3mf(bytes)
  const preset = [0.5, 0.5, 0.5]
  scene.objects[0].material = { color: preset }
  const result = applyBambuExtruderColors(scene, bytes)
  assert.equal(result.colored, 1)
  assert.equal(result.skipped, 1)
  assert.deepEqual(scene.objects[0].material.color, preset)
})

test('a non-zip payload degrades to no colours instead of throwing', async () => {
  const bytes = buildProject()
  const scene = await parse3mf(bytes)
  const result = applyBambuExtruderColors(scene, strToU8('not a zip at all'))
  assert.deepEqual(result, { colored: 0, skipped: scene.objects.length, paletteSize: 0 })
})

test('a file without slicer metadata colours nothing', async () => {
  const bytes = buildProject()
  const scene = await parse3mf(bytes)
  const noSettings = zipSync({
    '3D/3dmodel.model': strToU8(MAIN_MODEL),
    '3D/Objects/part_a.model': strToU8(partModel(1, 0)),
    '3D/Objects/part_b.model': strToU8(partModel(7, 100)),
  })
  const result = applyBambuExtruderColors(scene, noSettings)
  assert.equal(result.colored, 0)
  assert.equal(scene.capabilities.materials, 'unavailable')
})
