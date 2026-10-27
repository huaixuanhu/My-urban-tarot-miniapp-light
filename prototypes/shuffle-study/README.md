# Reading application development tools

Derived from governance/STATE.md stage2.4.18. Scope: motion review, regression/GPU fixtures and static cottage export. The sole product implementation lives in ../../client/; this directory is excluded from the production build.

Install dependencies at the repository root. `pnpm dev:motion` opens the choreography review at http://127.0.0.1:5174/. `main.mjs` imports the same canonical client motion/flex/geometry modules as the reading app. `pnpm test:reading` runs the129 retained application/motion tests against those client modules. The obsolete cloth-only test was removed with the unused historical cloth renderer.

`reading.vite.config.mjs` is only a compatibility startup command for old local bookmarks: it serves the canonical client at port5174. For normal work use root `pnpm dev` and `/`.

The local motion server also hosts `reading-room-pass.verify.html` and `reading-screen-glass.verify.html` GPU fixtures, each importing the canonical runtime. They are development evidence tools, not public product routes. `cottage-export/serve.mjs` writes reproducible static GLBs to client/src/assets using the preserved source snapshot; it still needs the original cottage's development toolchain, as documented in docs/design/stage2.4.12/cottage-source-and-export.md. Do not modify the original cottage while reproducing these exports.

Earlier prototypes, including the removed reading.html and prior cloth treatment, remain in Git history. Current accepted design and continuation belong only to DESIGN.md and governance/STATE.md.
