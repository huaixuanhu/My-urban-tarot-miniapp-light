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
- `python3 -m venv .venv` once; then `pnpm check:all` runs governance structure, TypeScript, compiled access/records/AI/random runtimes,15 authorization tests,132 application/motion tests,44 record tests,58 AI tests,59 randomness tests and the production build. Motion tests remain under prototypes/shuffle-study as development-only fixtures and import the canonical client modules.

Local Vite/Express/Electron execution does not run the Vercel-specific identity gate. Do not use these local servers as a protected public host. Electron still points to `dist/public/index.html`; packaged desktop execution has not been qualified by this web replacement.

## Source ownership

`reading-state.mjs` owns stable card identities, order, placement and reveal state. `reading-content.mjs` uses `client/src/data/tarotData.json`; `reading-art.mjs` bundles the unchanged78 images in `client/public/images/cards/`. Images and text remain original Urban Tarot content. Meanings appear on demand; source data has no separate reversed interpretations.

`reading-reset.mjs`, `reset-motion.mjs`, `motion.mjs`, `flex.mjs` and `card-geometry.mjs` preserve the accepted airborne gather and bent interleaving. `reading-reveal.mjs` owns left/right turns without changing orientation. `reading-fan.mjs`, `reading-picking.mjs`, `reading-view.mjs` and `reading-projection.mjs` own choosing, dragging and camera behavior.

`reading-glass.mjs`, `reading-screen-glass.mjs`, `reading-back.mjs` and `reading-scene-style.mjs` own glass, controls, backs and lighting. `reading-room.mjs` loads static day/night cottage assets from `client/src/assets/`; room-only blur and furniture cutaway remain separate from sharp cards. Model provenance and reproduction are retained under docs/design/stage2.4.12. The original cottage is a separate, unchanged application.

`reading-appearance.mjs` remembers light/dark/system preference. Stage2.5.1 adds glass sheets and explicit shared-record saving: question, original card facts/meanings, placement, personal interpretation and reflection. The active table and unsaved writing remain in memory; opening a historical record does not replace them. Refresh starts a new table. The optional AI interface is deployed,but its paid provider remains inactive.

## Shared records

`reading-disclosures.mjs` owns More/list/records/AI sheet motion and focus. `reading-records.mjs` renders the form and history; `reading-record-data.mjs` freezes save attempts so retries keep the same identifier and content. Save requires at least one card and every drawn card revealed. Existing records are immutable snapshots; no edit/delete or cloud draft autosave is implemented.

`api/records.ts` serves private GET/POST requests on Vercel. Every request verifies the existing signed Cloudflare identity before storage, and writes require the same origin. Both authorized users read the same collection; the author identifier is attribution only. The server reads `AUGURWELL_RECORDS_DATABASE_URL`; it is never bundled into client code. Apply `server/records/001-create-records.sql` explicitly only to the dedicated Augurwell database. Startup never runs schema changes.

Vite development/preview intentionally returns a clear unconfigured response at `/api/records`; it does not bypass hosted identity or pretend browser storage is cloud storage. The records feature was published on2026-10-28. An authenticated formal-page save, direct database comparison and page-refresh history/detail readback passed with disposable synthetic content. Mimi's separate real login remains untested. Live resource and release status are owned solely by STATE.md stage2.5.1/stage2.5.3; bounded evidence is in [the release receipt](docs/design/stage2.5.3/README.md).

`pnpm test:records` runs the synthetic contract/client checks. The optional real-database harness is `pnpm exec tsx scripts/check-records-neon.mjs --confirm-dedicated-validation-database`, with server-only `AUGURWELL_RECORDS_TEST_DATABASE_URL` and exact `AUGURWELL_RECORDS_TEST_EXPECTED_HOST`. It requires an existing empty dedicated table, uses synthetic identities/data, cleans only its exact fixtures and verifies the empty baseline. It is deliberately excluded from `check:all`.

## Development tools

Optional AI: More → AI解读 shares the record draft's user-written question and optional position labels. Choose GPT-6.1 Terra/Sol, low/medium/high effort and a preset/custom generation cap (up to12,000 tokens). Only explicit submission generates; broad cost hints are guidance, not quotes. Questions and canonical revealed-card metadata go to OpenAI, without card images or human reflection notes. Original data has no authored reversed meanings; AI reversal extensions are labelled separately. Results are bound to the submitted snapshot and may be explicitly included in shared records, separately from human notes.

`api/interpretations.ts` uses the existing identity guard, server-only `OPENAI_API_KEY` and `AUGURWELL_RECORDS_DATABASE_URL`. The additive `server/ai/002-create-interpretations.sql` was applied to the dedicated Augurwell database during stage2.5.5.4 release preparation. Production and Preview have no `OPENAI_API_KEY`; AI generation remains inactive and requests return a definite unavailable result. Durable request claims prevent duplicate same-ID generation, including concurrent requests, lost responses and repeated reads. No automatic retry or fallback model exists. Unknown outcomes retain their ID for GET-only lookup; a fresh paid attempt requires explicit confirmation. The query handle currently lives in the page, with a leave warning; closing/reloading loses the unsaved handle, though server rows remain. This is not cross-refresh draft recovery.

`pnpm dev:ai-preview` starts a **synthetic**, loopback-only preview at http://127.0.0.1:5174/ with a visible banner, synthetic random data, mock AI and in-memory records. It reads no external credentials, calls neither ANU, OpenAI nor Neon, and loses fixtures when stopped. Ordinary Vite returns a clear unconfigured response for the AI endpoint. `pnpm test:ai` and `pnpm check:ai-runtime` are offline checks. `pnpm exec tsx scripts/ai/verify-opt-in.mjs` prints an offline six-call plan; `--run <fresh .local directory>` is a separately budgeted manual live test requiring a key passed in process memory. Never run it automatically or include credentials in command arguments. [Local implementation evidence](docs/ai/stage2.5.4/README.md) distinguishes UI fixtures, real model calls and pending production work.

The isolated AI evaluation lives under `scripts/ai/`. `.venv/bin/python -B scripts/ai/terra-pilot.py` is offline by default; paid `--run` requires an authorized budget, an explicit local key file and a fresh output directory. It sends only the six synthetic questions and selected original card metadata to OpenAI, never saved readings. First results and exact reproduction limits: [Terra pilot](docs/ai/stage2.5.2.1/README.md). The subsequent [three-model comparison](docs/ai/stage2.5.2.2/README.md) preserves those inputs and adds GPT-6 Sol/GPT-6.1 Sol once per case; [all18 answers](docs/ai/stage2.5.2.2/ANSWERS.md) are readable side by side. Its offline check is `.venv/bin/python -B scripts/ai/compare-sol.py --baseline .local/terra-pilot-2026-10-28` and requires the original ignored baseline artifacts. A fresh generation is a new paid run, not an offline reproduction. Neither runner is imported by the application or included in its deployed API.

`pnpm dev:motion` opens the isolated choreography tool at port5174 using the same client motion modules. It is not built or linked into the production app. GPU verification fixtures and the bounded cottage exporter remain under `prototypes/shuffle-study/`; they do not create another product implementation. See that directory's README for their scope.

## Hosting and protection

`vite.config.ts` builds client/ to dist/public with relative asset paths. `vercel.json` explicitly selects `pnpm build` and `dist/public`, retaining the existing `proxy.ts` entry. The project remains my-urban-tarot-miniapp-light in anorias-projects. The latest primary-entry replacement is owned by STATE.md stage2.4.18; source publication, Vercel status and observed hosted runtime are recorded separately.

Cloudflare owns the existing allowlist. The application also validates signed Cloudflare credentials through access/guard.ts and confines access to the canonical hostname. Preserve those checks for pages, images and GLBs. A link from the cottage collection does not replace the destination application's gate. Never put personal addresses, credentials or private configuration exports into tracked files; local evidence belongs under ignored .local/.

For future integration, use the canonical HTTPS URL. The previous stage2.4.17 independent-build handoff is superseded by [stage2.4.18](docs/design/stage2.4.18/README.md). No change to the sibling cottage is made here.


## Shared quantum pool — local candidate

More → 随机来源 controls the **next** shuffle. Quantum mode is the default; ordinary mode uses browser Web Crypto and never consumes shared inventory. A new page waits for explicit 开始. Both authorised users share a durable1024-word uint16 pool, while mode preference stays in each device's browser. Collect replaces unused old values only after a valid new batch is committed. A failed acquisition or insufficient inventory preserves the current table. The displayed time is the API receipt time, not laboratory measurement time.

`api/random.ts` applies the same signed identity and same-origin write protections. `ANU_API_KEY` is configured as a Vercel Production-only Secret; never use a `VITE_` prefix, browser storage or tracked source. The database connection reuses server-only `AUGURWELL_RECORDS_DATABASE_URL`. The explicit `server/random/003-create-random-pool.sql` was applied to the dedicated database during stage2.5.5.4. No startup migration or silent local substitute exists. The key was tested once locally under stage2.5.5.3; Vercel-to-ANU acquisition remains unexercised until an owner explicitly collects in the hosted UI.

`shared/randomness.mjs` uses Fisher–Yates with rejection sampling and78 separate orientation values. Minimum consumption is155 words; rejected words also count. The server commits the completed deck and pool cursor together. Repeated operation IDs do not collect or deduct again. Network uncertainty keeps a per-tab query handle; explicit queries reconcile expired pending operations without contacting ANU. Only a confirmed missing-ID lookup enables explicit same-ID continuation. A recovered deck waits for the next explicit quantum shuffle. The active table and a successfully recovered, not-yet-used deck are still memory-only; this feature does not add full reading recovery.

Saved records retain the selected source. Quantum metadata must match a completed server allocation, including each saved card's orientation; legacy records remain source-unknown. This proves association with an allocation, not the user's picking gestures or immunity to deliberately choosing a known card.

`pnpm test:random` and `pnpm check:random-runtime` are in the aggregate gate. `pnpm check:random-postgres` separately starts a disposable local PostgreSQL cluster over a private Unix socket, executes the real migration/adapter SQL, and cleans it up. It requires `initdb`, `pg_ctl` and `psql`; it never reads app credentials or contacts cloud services. `pnpm dev:random-preview 5175` runs the banner-labelled synthetic preview on an optional local port; all ANU claims there are fixture data, not real acquisitions. Evidence and review handoff: [stage2.5.5](docs/random/stage2.5.5/README.md).


Review refinements: fan geometry now uses the existing independent motion seed, so relabeling card identities leaves a fixed-seed layout/pick ordinal unchanged. Metadata polling lasts at most two minutes per visible panel visit (15-second interval); reopening or returning visibility resumes it. AI snapshots deliberately omit random-source claims; the separately saved main record remains the verified allocation owner. Duplicated tabs may inherit the same recovery ID and recover the same deck; this is not a new independent draw.

Release order is explicit: verify the dedicated database target and schema,configure server-only keys,then deploy and verify protected hosted behavior. Stage2.5.5.4 is published at https://augurwell.anoriaquant.dev after a clear Claude review,002/003 setup and Production ANU configuration. Hosted pool/status,ordinary save/refresh and shortage-preserves-table checks pass. Cloud inventory starts empty;the owner must manually collect before a quantum shuffle. This release made no new ANU request. The included AI interface is deployed while its paid provider remains inactive. Exact receipts:[release evidence](docs/random/stage2.5.5/RELEASE.md).


### One real ANU batch locally

Put the key only in ignored `.local/anu-live.env` as `ANU_API_KEY=...` (file permissions0600). Run `pnpm dev:anu-live` for the loopback-only page at `http://127.0.0.1:5176`. This separate harness uses the real provider/handlers and the production SQL against retained local PostgreSQL. AI remains unavailable; neither records nor migrations go to cloud. The process needs local PostgreSQL tools and shared-memory permission.

This validation has already consumed its one permitted network call. The retained pool has869 unused values after one155-word shuffle; further shuffles can use that pool, but new acquisition is blocked across restarts. Do not delete/reset `.local/anu-live/attempt.json` to retry. The observed ANU response uses string`"1024"` for length; numeric1024 remains supported. The original response was revalidated/imported offline after this compatibility fix, without another external request. Raw response, key, database and private recovery receipts remain untracked. See [live validation evidence](docs/random/stage2.5.5/LIVE.md) for exact limits and recovery history.
