/**
 * Build for dsh-3d-preview: the host stub (`lib/index.js`, ESM node) plus one
 * browser client bundle (`lib/client.js`, CJS closure factory).
 *
 * The client bundle follows the official DSH client-bundle preset: `react` and
 * `react/jsx-runtime` resolve through the shell's frozen module table at
 * runtime, and **everything else inlines** — `three`, the model renderer and
 * its transitive packages, `fflate`, our own sources. The wrapper is the
 * lazy-CJS shape the module loader expects:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ...; return module.exports } })
 *
 * Code splitting is off: the factory's `require` only reaches module-table
 * entries, so a relative chunk URL could never be fetched.
 *
 *   node scripts/build.mjs [--watch]
 */

import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build, context } from 'esbuild'

const ROOT = dirname(fileURLToPath(new URL('.', import.meta.url)))
const OUT = join(ROOT, 'lib')

/** Bundle id (= package name; the client-modules compose keys on it). */
const CLIENT_ID = 'dsh-3d-preview'

/** Module specifiers the web shell shares into its frozen module table. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']

const shared = {
  bundle: true,
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
  target: ['es2020'],
}

/** Host half: an inert ESM module the bundle's `main` resolves to. */
const hostConfig = {
  ...shared,
  entryPoints: [join(ROOT, 'src/index.ts')],
  outfile: join(OUT, 'index.js'),
  format: 'esm',
  platform: 'node',
  target: ['node20'],
}

/** Browser half: one CJS closure registered on `window.__ModuleLoader__`. */
const clientConfig = {
  ...shared,
  entryPoints: [join(ROOT, 'src/client/index.tsx')],
  outfile: join(OUT, 'client.js'),
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  external: CLIENT_EXTERNALS,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {`,
      'var module = { exports: {} }; var exports = module.exports;',
    ].join('\n'),
  },
  footer: { js: 'return module.exports; } });' },
}

/** Report the artifact sizes so a ballooning dependency is visible in CI logs. */
async function report() {
  const { stat } = await import('node:fs/promises')
  const { gzipSync } = await import('node:zlib')
  const { readFile } = await import('node:fs/promises')
  for (const name of ['index.js', 'client.js']) {
    const file = join(OUT, name)
    try {
      const bytes = await readFile(file)
      const gzipped = gzipSync(bytes).length
      const kb = (value) => `${(value / 1024).toFixed(0)} KB`
      process.stdout.write(`  lib/${name}  ${kb(bytes.length)}  (gzip ${kb(gzipped)})\n`)
      void stat
    } catch {
      // Not built (watch mode before the first emission).
    }
  }
}

await rm(OUT, { recursive: true, force: true })

if (process.argv.includes('--watch')) {
  const host = await context(hostConfig)
  const client = await context(clientConfig)
  await host.watch()
  await client.watch()
  process.stdout.write('dsh-3d-preview: watching for changes (Ctrl-C to stop)\n')
} else {
  await build(hostConfig)
  await build(clientConfig)
  process.stdout.write('dsh-3d-preview: build complete\n')
  await report()
}
