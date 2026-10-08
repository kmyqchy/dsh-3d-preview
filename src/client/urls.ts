/**
 * URL vocabulary of better-sidebar's `/sidebar/file` media route.
 *
 * The host already hands a `mediaUrl` to every `fetchStrategy: 'mediaUrl'`
 * viewer, so reading bytes needs no builder here — but the "download the
 * original" affordance does, and it must mirror the route's contract exactly
 * (session scope + absolute path + `download=1` for the attachment
 * disposition). Kept dependency-free so it stays trivially testable.
 *
 * @module dsh-3d-preview/client/urls
 */

/** One session's routing scope (mirror of better-sidebar's `SessionScope`). */
export interface SessionScope {
  sessionId: string
  /** The session's working directory, when the client knows it. */
  cwd?: string
}

/** Absolute URL of the `/sidebar/file` route for one path. */
function fileUrl(scope: SessionScope, path: string, download: boolean): string {
  const params = new URLSearchParams({ sessionId: scope.sessionId, path })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  if (download) params.set('download', '1')
  return `/sidebar/file?${params.toString()}`
}

/** Raw-bytes URL (what `mediaUrl` props already carry, rebuilt for completeness). */
export function mediaUrlOf(scope: SessionScope, path: string): string {
  return fileUrl(scope, path, false)
}

/** Download URL (`Content-Disposition: attachment`) for the "download original" link. */
export function downloadUrlOf(scope: SessionScope, path: string): string {
  return fileUrl(scope, path, true)
}

/** Lower-cased extension of a path, including the leading dot (`'.3mf'`). */
export function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

/** Base name of a path. */
export function baseNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
