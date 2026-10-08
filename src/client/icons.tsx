/**
 * Outline icons in the host's app style (16 px grid, 1.5 px stroke,
 * `currentColor`) — used for the Side card settings inventory row and the
 * viewer toolbar. Inlined rather than imported from
 * `@deepseek-ai/dsh-client-ui-primitives` so the bundle depends on nothing but
 * `react`.
 *
 * @module dsh-3d-preview/client/icons
 */

import { createElement, type ReactNode } from 'react'

/** A wireframe cube on the 16 px outline grid. */
export function IconCubeOutline16(size: number): ReactNode {
  return createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': true,
    },
    [
      createElement('path', {
        key: 'box',
        d: 'M8 1.75 14 5v6l-6 3.25L2 11V5l6-3.25Z',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinejoin: 'round',
      }),
      createElement('path', { key: 'top', d: 'M2.25 5.1 8 8.4l5.75-3.3', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
      createElement('path', { key: 'edge', d: 'M8 8.4v5.85', stroke: 'currentColor', strokeWidth: 1.5 }),
    ],
  )
}

/** A frameless "fit to view" glyph for the toolbar. */
export function IconFitOutline16(size: number): ReactNode {
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
    [
      createElement('path', {
        key: 'c',
        d: 'M6 1.75H1.75V6M10 1.75h4.25V6M10 14.25h4.25V10M6 14.25H1.75V10',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    ],
  )
}

/** A camera glyph for the snapshot button. */
export function IconSnapshotOutline16(size: number): ReactNode {
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
    [
      createElement('rect', {
        key: 'b',
        x: 1.75,
        y: 4,
        width: 12.5,
        height: 9.5,
        rx: 2,
        stroke: 'currentColor',
        strokeWidth: 1.5,
      }),
      createElement('circle', { key: 'l', cx: 8, cy: 8.75, r: 2.6, stroke: 'currentColor', strokeWidth: 1.5 }),
      createElement('path', { key: 't', d: 'M5.75 4V2.9h4.5V4', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
    ],
  )
}
