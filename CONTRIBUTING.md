# Contributing

Thanks for looking. This is a small plugin; the fastest useful contributions are bug
reports with a file that reproduces the problem.

## Reporting a problem

Please include:

- the model file's **format and producer** (e.g. "3MF exported by OrcaSlicer 2.2"), and
  its size — a shareable sample is even better, since STL/3MF parsing is the part that
  breaks;
- whether it also fails in another viewer (if you have one) — that separates a parse
  bug from a rendering-environment bug;
- the footer line (`Triangles / Objects / Instances / Size / Materials`) if the model
  does load, and the text of the error overlay if it does not;
- your `dsh-better-sidebar` version and browser.

## Development

```bash
npm install --ignore-scripts
npm run build
npm run typecheck
npm test
```

`--ignore-scripts` is needed because `dsh-better-sidebar` (a devDependency used only for
its type declarations) pulls `node-pty`, whose native build fails in many container
images. Nothing in this plugin needs install scripts.

The test suite needs **Node 22.6+**: it imports the TypeScript sources directly and relies
on Node's type stripping. The published artifact does not — it is plain ES2020 ESM and
runs on Node 20+.

Guidelines:

- Keep the client bundle self-contained. Only `react` and `react/jsx-runtime` may stay
  external; everything else is inlined by `scripts/build.mjs`. `lib/` is committed, so
  run `npm run build` before opening a pull request that touches `src/`.
- Add a regression test for parser/colour changes — `test/bambu-colors.test.mjs` shows
  how to synthesise a minimal 3MF in memory, with no browser and no fixture downloads.
- Keep user-visible strings in `src/client/locales.ts` (both `zh` and `en`).
- Do not claim capabilities the underlying renderer does not expose; the README's
  "Limits and out of scope" section is part of the contract.

## License

By contributing you agree that your work is released under the MIT license in
[LICENSE](LICENSE).
