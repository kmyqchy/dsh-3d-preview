/**
 * The `.stl` / `.3mf` file viewer body.
 *
 * Rendering is delegated to `@chestnutlabs/gcode-model-renderer`, which owns
 * the WebGL stage, the lighting rig, the framing pose and the parse of both
 * formats (including the 3MF Production Extension and Bambu `paint_color`).
 * This component owns everything the host does not give us:
 *
 * - **bytes** — fetched from better-sidebar's `/sidebar/file` media route via
 *   the `mediaUrl` prop (no host half, no extra route);
 * - **the id-join fix** for slicer per-object filament colours
 *   (see `bambu-colors.ts`) — 3MF only, applied between parse and render;
 * - **chrome** — progress, error/retry, plate selector, stats, fit / snapshot
 *   / fullscreen / download.
 *
 * @module dsh-3d-preview/client/viewer
 */

import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_LIMITS,
  createModelViewer,
  parse3mf,
  parseStl,
  type ModelReadyInfo,
  type ModelScene,
  type ModelViewer,
} from '@chestnutlabs/gcode-model-renderer'
import type { FileViewerProps } from 'dsh-better-sidebar'
import { applyBambuExtruderColors } from './bambu-colors.ts'
import { IconFitOutline16, IconSnapshotOutline16 } from './icons.tsx'
import { t } from './locales.ts'
import { ensureStyles } from './styles.ts'
import { baseNameOf, downloadUrlOf, extOf, mediaUrlOf, type SessionScope } from './urls.ts'

/**
 * Structural mirror of the renderer's `LoadProgress`. Declared locally because
 * the type is not re-exported from the package root.
 */
interface ProgressEvent {
  stage?: string
  done?: number
  total?: number
  unit?: string
  indeterminate?: boolean
}

/** What the loading overlay is currently showing. */
interface ProgressView {
  label: string
  /** `undefined` = indeterminate (a spinner-ish bar), otherwise a 0..1 ratio. */
  ratio?: number
}

/** Scene-derived numbers shown in the footer. */
interface SceneStats {
  /** Unique triangles across master geometries (instances reuse them). */
  triangles: number
  /** Objects whose colour came from the slicer filament palette. */
  coloredByFilament: number
  /** Palette size when colours were resolved. */
  paletteSize: number
}

/** Background of the 3D viewport — a neutral mid-dark that reads in both themes. */
const VIEWPORT_BACKGROUND = '#22252b'

/**
 * Sum the unique triangles of a parsed scene.
 *
 * Instances are deliberately **not** multiplied in: the footer already shows
 * the placement count, and the renderer draws one geometry upload per master.
 *
 * @param scene - A parsed scene.
 * @returns Triangle count.
 */
function countTriangles(scene: ModelScene): number {
  let triangles = 0
  for (const object of scene.objects) {
    const geometry = object.geometry
    triangles += geometry.indices !== undefined
      ? geometry.indices.length / 3
      : geometry.positions.length / 9
  }
  return Math.round(triangles)
}

/** `1234567` → `1,234,567`. */
function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

/** Axis-aligned size in model units (mm for both STL exports and 3MF). */
function formatSize(info: ModelReadyInfo): string | undefined {
  const { min, max } = info.bounds
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  if (!size.every((value) => Number.isFinite(value))) return undefined
  return size.map((value) => value.toFixed(1)).join(' × ')
}

/** Human label for one load stage. */
function stageLabel(stage: string | undefined): string {
  switch (stage) {
    case 'parsing':
      return t('parsing3mf')
    case 'building-geometry':
      return t('buildingGeometry')
    default:
      return t('preparing')
  }
}

/** Material confidence label. */
function materialLabel(materials: ModelReadyInfo['materials']): string {
  switch (materials) {
    case 'known':
      return t('materialsKnown')
    case 'approximated':
    case 'inferred':
      return t('materialsApproximated')
    default:
      return t('materialsUnavailable')
  }
}

/**
 * Render one 3D model file inside better-sidebar's editor host.
 *
 * @param props - The host's viewer props (`mediaUrl` is the byte source).
 */
export function Model3DView(props: FileViewerProps): ReactNode {
  const { path, scope } = props
  // The host supplies `mediaUrl` for `fetchStrategy: 'mediaUrl'`; rebuilding it
  // is a cheap fallback that keeps the viewer working if a host ever omits it.
  const src = props.mediaUrl ?? mediaUrlOf(scope as SessionScope, path)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<ModelViewer | null>(null)

  const [progress, setProgress] = useState<ProgressView | null>({ label: t('loadingFile') })
  const [info, setInfo] = useState<ModelReadyInfo | null>(null)
  const [stats, setStats] = useState<SceneStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [plateId, setPlateId] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  /** Bumped by the retry button to re-run the load effect. */
  const [attempt, setAttempt] = useState(0)

  ensureStyles()

  // ── Viewer lifecycle + load ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (canvas === null || stage === null) return

    let disposed = false
    const controller = new AbortController()
    setProgress({ label: t('loadingFile') })
    setInfo(null)
    setStats(null)
    setError(null)
    setNote(null)
    setPlateId(null)

    let viewer: ModelViewer
    try {
      viewer = createModelViewer(canvas, {
        background: VIEWPORT_BACKGROUND,
        onProgress: (event: ProgressEvent) => {
          if (disposed) return
          const ratio = event.total !== undefined && event.total > 0 && event.done !== undefined
            ? event.done / event.total
            : undefined
          const suffix = ratio !== undefined && event.total !== undefined
            ? ` ${String(event.done ?? 0)}/${String(event.total)}`
            : ''
          setProgress({ label: stageLabel(event.stage) + suffix, ratio })
        },
      })
    } catch (cause) {
      setProgress(null)
      setError(cause instanceof Error ? cause.message : t('webglUnavailable'))
      return
    }
    viewerRef.current = viewer

    const offEvent = viewer.onEvent((event) => {
      if (disposed) return
      if (event.type === 'renderer-unsupported' || event.type === 'error') {
        setProgress(null)
        setError('message' in event && typeof event.message === 'string' ? event.message : t('webglUnavailable'))
      }
    })

    const applySize = (): void => {
      const rect = stage.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) viewer.resize(Math.round(rect.width), Math.round(rect.height))
    }
    applySize()
    const observer = new ResizeObserver(applySize)
    observer.observe(stage)

    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${String(response.status)} — ${t('tooLarge')}`)
        const buffer = await response.arrayBuffer()
        if (disposed) return
        const bytes = new Uint8Array(buffer)

        let scene: ModelScene
        let nextStats: SceneStats
        if (extOf(path) === '.3mf') {
          setProgress({ label: t('parsing3mf') })
          scene = await parse3mf(bytes, DEFAULT_LIMITS)
          if (disposed) return
          // Slicer per-object filament colours (see bambu-colors.ts).
          const colored = applyBambuExtruderColors(scene, bytes)
          nextStats = { triangles: countTriangles(scene), coloredByFilament: colored.colored, paletteSize: colored.paletteSize }
        } else {
          // Parse STL here rather than handing the viewer raw bytes: the scene is
          // what carries the triangle count shown in the footer.
          scene = parseStl(bytes, DEFAULT_LIMITS)
          nextStats = { triangles: countTriangles(scene), coloredByFilament: 0, paletteSize: 0 }
        }

        if (disposed) return
        const ready = await viewer.setSource(scene)
        if (disposed) return

        // The first frame may have been laid out before the stage had a size.
        applySize()
        viewer.frame()
        setStats(nextStats)
        setInfo(ready)
        setProgress(null)
      } catch (cause) {
        if (disposed || controller.signal.aborted) return
        setProgress(null)
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    })()

    return () => {
      disposed = true
      controller.abort()
      observer.disconnect()
      offEvent()
      viewer.dispose()
      if (viewerRef.current === viewer) viewerRef.current = null
    }
  }, [src, path, attempt])

  // ── Fullscreen tracking ────────────────────────────────────────────────
  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback((): void => {
    const stage = stageRef.current
    if (stage === null) return
    if (document.fullscreenElement === stage) void document.exitFullscreen()
    else void stage.requestFullscreen?.().catch(() => undefined)
  }, [])

  const snapshot = useCallback((): void => {
    const viewer = viewerRef.current
    if (viewer === null) return
    void viewer.capture({ format: 'image/png' }).then(
      (blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${baseNameOf(path)}.png`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      },
      () => setNote(t('snapshotFailed')),
    )
  }, [path])

  const selectPlate = useCallback((next: number | null): void => {
    setPlateId(next)
    viewerRef.current?.setRenderScope(next === null ? null : { plateId: next })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────
  const ready = error === null && progress === null
  const plates = info?.plates?.list ?? []
  const downloadHref = downloadUrlOf(scope as SessionScope, path)

  return createElement(
    'div',
    { className: 'dsh3d-root' },
    createElement(
      'div',
      { className: 'dsh3d-bar' },
      button({ label: t('fit'), disabled: !ready, onClick: () => viewerRef.current?.frame() }, IconFitOutline16(14)),
      button({ label: t('snapshot'), disabled: !ready, onClick: snapshot }, IconSnapshotOutline16(14)),
      button({ label: fullscreen ? t('exitFullscreen') : t('fullscreen'), disabled: !ready, onClick: toggleFullscreen }),
      createElement(
        'a',
        { className: 'dsh3d-btn', href: downloadHref, download: baseNameOf(path) },
        t('download'),
      ),
      createElement('div', { className: 'dsh3d-spacer' }),
      info !== null ? createElement('span', { className: 'dsh3d-stat' }, `${t('materials')} ${materialLabel(info.materials)}`) : null,
    ),
    createElement(
      'div',
      { className: 'dsh3d-stage', ref: stageRef, title: t('rotateHint') },
      // `key={attempt}` gives every retry a brand-new canvas element: a disposed
      // WebGLRenderer leaves its context on the old canvas, so reusing the node
      // would hand the next viewer a context it did not create.
      createElement('canvas', { key: attempt, className: 'dsh3d-canvas', ref: canvasRef }),
      progress !== null && error === null ? overlayProgress(progress) : null,
      error !== null ? overlayError(error, downloadHref, path, () => setAttempt((value) => value + 1)) : null,
    ),
    createElement(
      'div',
      { className: 'dsh3d-foot' },
      stats !== null
        ? createElement('span', { className: 'dsh3d-stat' }, `${t('triangles')} `, createElement('b', null, formatCount(stats.triangles)))
        : null,
      info !== null
        ? createElement('span', { className: 'dsh3d-stat' }, `${t('objects')} `, createElement('b', null, formatCount(info.objectCount)))
        : null,
      info !== null && info.instancedCount > info.objectCount
        ? createElement('span', { className: 'dsh3d-stat' }, `${t('instances')} `, createElement('b', null, formatCount(info.instancedCount)))
        : null,
      info !== null && formatSize(info) !== undefined
        ? createElement('span', { className: 'dsh3d-stat' }, `${t('size')} `, createElement('b', null, `${formatSize(info) ?? ''} mm`))
        : null,
      stats !== null && stats.coloredByFilament > 0
        ? createElement('span', { className: 'dsh3d-stat' }, `🎨 ${t('coloredByFilament')}`)
        : null,
      note !== null ? createElement('span', { className: 'dsh3d-stat' }, note) : null,
      plates.length > 1
        ? createElement(
            'div',
            { className: 'dsh3d-chips' },
            chip(t('allPlates'), plateId === null, () => selectPlate(null)),
            ...plates.map((plate) =>
              chip(
                `${plate.name !== undefined && plate.name !== '' ? plate.name : `${t('plate')} ${String(plate.id)}`} · ${String(plate.instanceCount)}`,
                plateId === plate.id,
                () => selectPlate(plate.id),
              ),
            ),
          )
        : null,
    ),
  )
}

/** One toolbar button. */
function button(
  options: { label: string; disabled?: boolean; onClick: () => void },
  icon?: ReactNode,
): ReactNode {
  return createElement(
    'button',
    {
      type: 'button',
      className: 'dsh3d-btn',
      disabled: options.disabled === true,
      title: options.label,
      onClick: options.onClick,
    },
    icon ?? null,
    icon !== undefined ? createElement('span', null, options.label) : options.label,
  )
}

/** One plate chip. */
function chip(label: string, active: boolean, onClick: () => void): ReactNode {
  return createElement(
    'button',
    {
      key: label,
      type: 'button',
      className: active ? 'dsh3d-btn is-on' : 'dsh3d-btn',
      onClick,
    },
    label,
  )
}

/** The loading overlay, with a determinate bar when the stage reports a total. */
function overlayProgress(view: ProgressView): ReactNode {
  return createElement(
    'div',
    { className: 'dsh3d-overlay' },
    createElement('strong', null, view.label),
    createElement(
      'div',
      { className: 'dsh3d-track' },
      createElement('div', {
        className: 'dsh3d-fill',
        style: { width: view.ratio === undefined ? '35%' : `${String(Math.round(view.ratio * 100))}%` },
      }),
    ),
  )
}

/** The error overlay: message, retry, and a way to still get the bytes. */
function overlayError(message: string, downloadHref: string, path: string, retry: () => void): ReactNode {
  return createElement(
    'div',
    { className: 'dsh3d-overlay' },
    createElement('strong', null, t('errorTitle')),
    createElement('div', null, message),
    createElement(
      'div',
      { style: { display: 'flex', gap: '8px' } },
      createElement('button', { type: 'button', className: 'dsh3d-btn', onClick: retry }, t('retry')),
      createElement('a', { className: 'dsh3d-btn', href: downloadHref, download: baseNameOf(path) }, t('download')),
    ),
  )
}
