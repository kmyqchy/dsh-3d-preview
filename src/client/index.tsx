/**
 * Client half of dsh-3d-preview: registers the `.stl` / `.3mf` file previewers
 * through better-sidebar's `ctx.betterSidebar.registerFileViewer`.
 *
 * Both formats share a single viewer id (`dsh-3d-preview:model3d`) and a single
 * render path; the component dispatches on the extension. Bytes come from
 * better-sidebar's `/sidebar/file` media route (`fetchStrategy: 'mediaUrl'`), so
 * this plugin contributes **no host route of its own** — the models it targets
 * (STL parts, slicer project 3MFs) sit well under the default 20 MB
 * `mediaLimit`, and nothing here needs HTTP Range.
 *
 * @module dsh-3d-preview/client
 */

import { createElement } from 'react'
import type { FileViewerDescriptor } from 'dsh-better-sidebar'
import { IconCubeOutline16 } from './icons.tsx'
import { t } from './locales.ts'
import { Model3DView } from './viewer.tsx'

/**
 * The cordis services this plugin needs. `betterSidebar` is provided by the
 * client half of dsh-better-sidebar; absent it, `apply` is skipped (with this
 * declaration the loader handles that, and the runtime guard inside `apply`
 * covers activation-order races).
 */
export const inject = ['betterSidebar']

/** Extensions claimed by the viewer, without the leading dot. */
export const MODEL_EXTENSIONS = ['stl', '3mf'] as const

/** Minimal structural face of the client context — avoids importing the runtime package for types. */
interface ClientContextLike {
  effect(callback: () => void | (() => void), label?: string): unknown
  betterSidebar?: { registerFileViewer(descriptor: FileViewerDescriptor): () => void }
}

/** The viewer descriptor registered on activation. */
export function modelViewer(): FileViewerDescriptor {
  return {
    id: 'dsh-3d-preview:model3d',
    title: () => t('viewerTitle'),
    icon: (size: number) => IconCubeOutline16(size),
    exts: [...MODEL_EXTENSIONS],
    // Hand the component a URL and let it stream the bytes itself: the fetch
    // is abortable on unmount and the same URL doubles as the download link.
    fetchStrategy: 'mediaUrl',
    component: Model3DView,
  }
}

/**
 * Client plugin body.
 *
 * @param ctx - the client context (needs `betterSidebar` + `effect`).
 */
export function apply(ctx: ClientContextLike): void {
  const betterSidebar = ctx.betterSidebar
  if (betterSidebar === undefined) return
  // The disposer unregisters on fiber disposal, so re-activation (HMR) is clean.
  ctx.effect(() => betterSidebar.registerFileViewer(modelViewer()), 'dsh-3d-preview: model viewer')
}
