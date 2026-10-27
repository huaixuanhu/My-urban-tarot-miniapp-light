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
- `python3 -m venv .venv` once; then `pnpm check:all` runs governance structure, TypeScript, compiled access/records runtimes,15 authorization tests,129 application/motion tests,40 record tests and the production build. Motion tests remain under prototypes/shuffle-study as development-only fixtures and import the canonical client modules.

Local Vite/Express/Electron execution does not run the Vercel-specific identity gate. Do not use these local servers as a protected public host. Electron still points to `dist/public/index.html`; packaged desktop execution has not been qualified by this web replacement.

## Source ownership

`reading-state.mjs` owns stable card identities, order, placement and reveal state. `reading-content.mjs` uses `client/src/data/tarotData.json`; `reading-art.mjs` bundles the unchanged78 images in `client/public/images/cards/`. Images and text remain original Urban Tarot content. Meanings appear on demand; source data has no separate reversed interpretations.

`reading-reset.mjs`, `reset-motion.mjs`, `motion.mjs`, `flex.mjs` and `card-geometry.mjs` preserve the accepted airborne gather and bent interleaving. `reading-reveal.mjs` owns left/right turns without changing orientation. `reading-fan.mjs`, `reading-picking.mjs`, `reading-view.mjs` and `reading-projection.mjs` own choosing, dragging and camera behavior.

`reading-glass.mjs`, `reading-screen-glass.mjs`, `reading-back.mjs` and `reading-scene-style.mjs` own glass, controls, backs and lighting. `reading-room.mjs` loads static day/night cottage assets from `client/src/assets/`; room-only blur and furniture cutaway remain separate from sharp cards. Model provenance and reproduction are retained under docs/design/stage2.4.12. The original cottage is a separate, unchanged application.

`reading-appearance.mjs` remembers light/dark/system preference. Stage2.5.1 adds candidate glass sheets and explicit shared-record saving: question, original card facts/meanings, placement, personal interpretation and reflection. The active table and unsaved writing remain in memory; opening a historical record does not replace them. Refresh starts a new table. AI remains a separately evaluated future feature.

## Shared records (local candidate)

`reading-disclosures.mjs` owns More/list/records sheet motion and focus. `reading-records.mjs` renders the form and history; `reading-record-data.mjs` freezes save attempts so retries keep the same identifier and content. Save requires at least one card and every drawn card revealed. Existing records are immutable snapshots; no edit/delete or cloud draft autosave is implemented.

`api/records.ts` serves private GET/POST requests on Vercel. Every request verifies the existing signed Cloudflare identity before storage, and writes require the same origin. Both authorized users read the same collection; the author identifier is attribution only. The server reads `AUGURWELL_RECORDS_DATABASE_URL`; it is never bundled into client code. Apply `server/records/001-create-records.sql` explicitly only to the dedicated Augurwell database. Startup never runs schema changes.

Vite development/preview intentionally returns a clear unconfigured response at `/api/records`; it does not bypass hosted identity or pretend browser storage is cloud storage. The current production deployment has not received this candidate code. Live database setup and binding status are owned solely by STATE.md stage2.5.1.

`pnpm test:records` runs the synthetic contract/client checks. The optional real-database harness is `pnpm exec tsx scripts/check-records-neon.mjs --confirm-dedicated-validation-database`, with server-only `AUGURWELL_RECORDS_TEST_DATABASE_URL` and exact `AUGURWELL_RECORDS_TEST_EXPECTED_HOST`. It requires an existing empty dedicated table, uses synthetic identities/data, cleans only its exact fixtures and verifies the empty baseline. It is deliberately excluded from `check:all`.

## Development tools

`pnpm dev:motion` opens the isolated choreography tool at port5174 using the same client motion modules. It is not built or linked into the production app. GPU verification fixtures and the bounded cottage exporter remain under `prototypes/shuffle-study/`; they do not create another product implementation. See that directory's README for their scope.

## Hosting and protection

`vite.config.ts` builds client/ to dist/public with relative asset paths. `vercel.json` explicitly selects `pnpm build` and `dist/public`, retaining the existing `proxy.ts` entry. The project remains my-urban-tarot-miniapp-light in anorias-projects. The latest primary-entry replacement is owned by STATE.md stage2.4.18; source publication, Vercel status and observed hosted runtime are recorded separately.

Cloudflare owns the existing allowlist. The application also validates signed Cloudflare credentials through access/guard.ts and confines access to the canonical hostname. Preserve those checks for pages, images and GLBs. A link from the cottage collection does not replace the destination application's gate. Never put personal addresses, credentials or private configuration exports into tracked files; local evidence belongs under ignored .local/.

For future integration, use the canonical HTTPS URL. The previous stage2.4.17 independent-build handoff is superseded by [stage2.4.18](docs/design/stage2.4.18/README.md). No change to the sibling cottage is made here.
