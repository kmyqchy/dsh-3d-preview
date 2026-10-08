/**
 * dsh-3d-preview, node half.
 *
 * A stub. Everything this plugin provides — the `.stl` / `.3mf` file
 * previewers — lives in the browser half, because it renders inside
 * dsh-better-sidebar's editor host through `ctx.betterSidebar.registerFileViewer`
 * (a client-only service) and reads file bytes through better-sidebar's own
 * `/sidebar/file` media route. Nothing needs a privileged host route: the
 * models this plugin targets (STL parts and slicer project 3MFs) sit well
 * under the default 20 MB `mediaLimit`, so no Range-streaming route is needed.
 *
 * The node half exists so the bundle's `main` resolves cleanly and so a future
 * version that needs host-side work (e.g. a pre-parse cache for very large
 * files) has somewhere to land; for now, applying it does nothing.
 *
 * @module dsh-3d-preview
 */

/** Plugin configuration; intentionally empty — every knob lives client-side. */
export interface Config {}

/** No host services are required. */
export const inject: readonly string[] = []

/**
 * Apply the (empty) node half.
 * @param _ctx - host context, unused.
 * @param _config - see {@link Config}.
 */
export function apply(_ctx: unknown, _config: Config = {}): void {
  // Intentionally empty. See module doc.
}
