# stage2.5.3 — shared-record release receipt

Parent and authority: [governance/STATE.md](../../../governance/STATE.md), stage2.5.3. Scope: the2026-10-28 user-authorized records checkpoint, connection verification, push and hosted verification. This is bounded release evidence, not a parallel plan or expanded design acceptance. Initial interface evidence is in [stage2.5.1](../stage2.5.1/README.md).

## Source and deployment

- Product commit: `06a47e887aada9e375d9aa3e3c840959d5d7c91e`, pushed to existing origin/main after checks.
- Existing Vercel Production integration: `dpl_QSoW7p1DuhXaXoHdyATYozKzT2e3`; GitHub Vercel status reported success.
- Deployment: `https://my-urban-tarot-miniapp-light-q9uu80dk7-anorias-projects.vercel.app`.
- Formal entry used for authenticated verification: `https://augurwell.anoriaquant.dev/`.
- Rollback source: `1e0fa4a637ae020af153f26fa8be433b779b3449`. Retain the additive records table and saved data during any source rollback.
- The subsequent documentation-only commit records this observation without changing application code.

## Observed verification

Independent source review found no release blocker. `pnpm check:all` passed governance, TypeScript, compiled access/records checks,15 access tests,129 reading tests,40 record tests and the production build. The real-Neon harness subsequently passed seven cases with exact cleanup: create/source snapshot, second synthetic identity visibility, retry/conflict, concurrent deduplication, pagination, a new database connection and rejection before storage.

A fresh browser tab using the owner's existing Cloudflare session saved a synthetic three-card reading through the formal app. Direct database comparison confirmed exactly one row and matching card IDs (`cups-09`, `swords-05`, `major-12`), orientations (upright/upright/reversed), a position label and the synthetic question/interpretation. Hosted identity attribution was present; no identity value is retained here.

After reloading the entire page, the shared list and detail showed the saved content. The live table stayed empty when history was opened. The [readback screenshot](hosted-record-readback.png) contains only synthetic test content. Browser warning/error capture was empty. Cleanup matched the exact ID, content hash and synthetic question; a subsequent ID/question query returned zero rows.

| Anonymous request | Observed result |
| --- | --- |
| Canonical `/api/records` |302 to existing Cloudflare login |
| Direct Vercel alias `/api/records` |403 |
| Canonical hostname routed directly to Vercel origin |403 |

Existing access configuration, accepted gameplay/art/room and the sibling application were unchanged. All65 inherited generated files were hash-checked against the entry snapshot and preserved.

## Evidence limits and next step

Mimi's real login was not exercised; shared visibility between two identities was verified with synthetic signed service requests against the real dedicated database. This is not formal phone/performance qualification or comprehensive visual acceptance. Saved records persist; unsaved active tables and writing still reset on refresh. AI is not connected and no paid model call was made. Current continuation and the proposed Terra test remain owned by STATE.md.
