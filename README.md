# Augurwell · Urban Tarot

The accepted glass-table reading experience is the sole application. Its current scope and continuation are owned by [governance/STATE.md](governance/STATE.md); [DESIGN.md](DESIGN.md) owns the accepted visual/interaction baseline. The retired React demo is recoverable from Git history and is no longer an active source or user entry.

## Application and local work

- Primary source: `client/index.html`, `client/src/reading.mjs`, and `client/src/reading.css`.
- Formal entry: https://augurwell.anoriaquant.dev. Repository: https://github.com/huaixuanhu/My-urban-tarot-miniapp-light.
- Install root dependencies with `pnpm install --frozen-lockfile`. Three.js is pinned to0.186.1 in the root manifest/lockfile; no separate study install is required.
- `pnpm dev`: the application at http://127.0.0.1:3000/.
- `pnpm build`: application output in `dist/public`, plus the existing Express fallback in `dist/index.js`.
- `pnpm preview`: preview that built application locally. `pnpm start` runs the Express fallback.
- For previous local bookmarks, `pnpm exec vite --config prototypes/shuffle-study/reading.vite.config.mjs` serves the same client at port5174. Hosted `/reading.html` redirects to `/`.
- `python3 -m venv .venv` once; then `pnpm check:all` runs governance structure, TypeScript, access runtime,15 authorization tests,129 application/motion tests and the production build. Tests remain under prototypes/shuffle-study as development-only fixtures and import the canonical client modules.

Local Vite/Express/Electron execution does not run the Vercel-specific identity gate. Do not use these local servers as a protected public host. Electron still points to `dist/public/index.html`; packaged desktop execution has not been qualified by this web replacement.

## Source ownership

`reading-state.mjs` owns stable card identities, order, placement and reveal state. `reading-content.mjs` uses `client/src/data/tarotData.json`; `reading-art.mjs` bundles the unchanged78 images in `client/public/images/cards/`. Images and text remain original Urban Tarot content. Meanings appear on demand; source data has no separate reversed interpretations.

`reading-reset.mjs`, `reset-motion.mjs`, `motion.mjs`, `flex.mjs` and `card-geometry.mjs` preserve the accepted airborne gather and bent interleaving. `reading-reveal.mjs` owns left/right turns without changing orientation. `reading-fan.mjs`, `reading-picking.mjs`, `reading-view.mjs` and `reading-projection.mjs` own choosing, dragging and camera behavior.

`reading-glass.mjs`, `reading-screen-glass.mjs`, `reading-back.mjs` and `reading-scene-style.mjs` own glass, controls, backs and lighting. `reading-room.mjs` loads static day/night cottage assets from `client/src/assets/`; room-only blur and furniture cutaway remain separate from sharp cards. Model provenance and reproduction are retained under docs/design/stage2.4.12. The original cottage is a separate, unchanged application.

`reading-appearance.mjs` remembers only light/dark/system preference. Readings, questions and reflections are not persisted; refresh starts a new reading. Full-flow/record work remains deferred in STATE.md stage2.5. AI and cross-device sync remain deferred.

## Development tools

`pnpm dev:motion` opens the isolated choreography tool at port5174 using the same client motion modules. It is not built or linked into the production app. GPU verification fixtures and the bounded cottage exporter remain under `prototypes/shuffle-study/`; they do not create another product implementation. See that directory's README for their scope.

## Hosting and protection

`vite.config.ts` builds client/ to dist/public with relative asset paths. `vercel.json` explicitly selects `pnpm build` and `dist/public`, retaining the existing `proxy.ts` entry. The project remains my-urban-tarot-miniapp-light in anorias-projects. The latest primary-entry replacement is owned by STATE.md stage2.4.18; source publication, Vercel status and observed hosted runtime are recorded separately.

Cloudflare owns the existing allowlist. The application also validates signed Cloudflare credentials through access/guard.ts and confines access to the canonical hostname. Preserve those checks for pages, images and GLBs. A link from the cottage collection does not replace the destination application's gate. Never put personal addresses, credentials or private configuration exports into tracked files; local evidence belongs under ignored .local/.

For future integration, use the canonical HTTPS URL. The previous stage2.4.17 independent-build handoff is superseded by [stage2.4.18](docs/design/stage2.4.18/README.md). No change to the sibling cottage is made here.
