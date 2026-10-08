/**
 * One injected `<style>` tag for the whole plugin.
 *
 * A viewer plugin has no CSS pipeline of its own (the client bundle is a plain
 * CJS closure), so the handful of rules that inline styles cannot express —
 * hover/active states, the scrollable chip row, the fullscreen canvas — live
 * here. Colours come from the host's `--dsw-alias-*` tokens with neutral
 * fallbacks, so the viewer follows the active theme and skin.
 *
 * @module dsh-3d-preview/client/styles
 */

const STYLE_TAG_ID = 'dsh-3d-preview/plugin.css'

const CSS = `
.dsh3d-root {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base, #16181d);
  color: var(--dsw-alias-label-primary, #e6e8ee);
}
.dsh3d-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128, 136, 160, 0.18));
  font-size: 12px;
  min-width: 0;
}
.dsh3d-spacer { flex: 1 1 auto; min-width: 0; }
.dsh3d-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 136, 160, 0.24));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}
.dsh3d-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 136, 160, 0.14)); }
.dsh3d-btn:active { background: var(--dsw-alias-interactive-bg-pressed, rgba(128, 136, 160, 0.22)); }
.dsh3d-btn[disabled] { opacity: 0.45; cursor: default; }
.dsh3d-btn.is-on {
  background: var(--dsw-alias-interactive-bg-selected, rgba(76, 141, 255, 0.18));
  border-color: var(--dsw-alias-link-normal, #4c8dff);
  color: var(--dsw-alias-link-normal, #4c8dff);
}
.dsh3d-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.dsh3d-canvas { display: block; width: 100%; height: 100%; outline: none; }
.dsh3d-stage:fullscreen { background: var(--dsw-alias-bg-base, #16181d); }
.dsh3d-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
  background: var(--dsw-alias-bg-base, #16181d);
  color: var(--dsw-alias-label-secondary, #8b90a0);
  font-size: 12px;
}
.dsh3d-overlay strong { color: var(--dsw-alias-label-primary, #e6e8ee); font-weight: 600; }
.dsh3d-track {
  width: min(240px, 70%);
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l2, rgba(128, 136, 160, 0.24));
  overflow: hidden;
}
.dsh3d-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--dsw-alias-link-normal, #4c8dff);
  transition: width 120ms linear;
}
.dsh3d-link { color: var(--dsw-alias-link-normal, #4c8dff); text-decoration: none; }
.dsh3d-link:hover { text-decoration: underline; }
.dsh3d-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 8px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(128, 136, 160, 0.18));
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #8b90a0);
  min-width: 0;
}
.dsh3d-stat { white-space: nowrap; }
.dsh3d-stat b { color: var(--dsw-alias-label-primary, #e6e8ee); font-weight: 600; }
.dsh3d-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 1px;
  scrollbar-width: thin;
}
.dsh3d-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
`

/** Inject the stylesheet once per document. */
export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}
