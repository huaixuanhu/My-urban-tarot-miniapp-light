# Accepted continuous-corner release

Derived from governance/STATE.md stage2.5.15.2, publishing stage2.5.15 and stage2.5.15.1. This child owns release evidence; STATE.md owns current authority and DESIGN.md revision35 owns the accepted design. Source: the user explicitly choseK1.5 for both interface and physical slab on2026-11-11 and requested full publication/closeout.

## Scope and preparation

Publish the feature-detected UI corner roles and matching live optical maps, physical glass contour/rims, focused geometry tests, local comparison fixtures/evidence and affected governance. Keep unsupported CSS fallback, circles/pills, original art/engraving, layout, request/data behavior, shared access and Cloudflare72hour configuration. Preserve115 inherited/frozen hashes, including65 dirty generated files; these are excluded from the commit. No real AI/ANU request, schema change or data write.

Independent read-only release review found no blocking source defect. Normal production imports contain the new corner helper; comparison fixtures remain outside the application build. Existing local rendered evidence remains in [UI comparison](../../design/stage2.5.15/README.md) and [physical slab comparison](../../design/stage2.5.15/glass-table.md). Fresh pnpm check:all passes378 tests (15 access,140 reading,55 records,98 AI,70 random), governance, TypeScript, compiled-runtime guards and build. The existing large-bundle advisory remains. Before-release cloud snapshot:1 record,3 AI audit rows,4 random operations and714 values remaining; all six access probes pass. Local/remote main match029ca14b before release.

Release target: existing Vercel project prj_zxLDHbvstH5rB2g1u5Gl6DAqwkdE, team team_aZlkgVfGEa9rGrdjpshW2KN5, Production, canonical https://augurwell.anoriaquant.dev. Publish via Git-linked main so inherited dirty files stay local. Prior source029ca14b2c504c29327b03db98cb2f1300d97eb5, prior READY deploymentdpl_kJDGgu4UkiZxEJqZw4JFPrhUP1QC. Confirm exact commit/alias, access gates, read-only before/after row digests and bounded visual display. Private receipts: .local/release-stage2.5.15-20261111/.

## Status and recovery

Release preparation is in progress; published identifiers and observed checks will be recorded after completion. The local assertions establish rendered Chromium behavior and sampled geometry, with native Safari/Firefox, real touch-device performance and frame-rate qualification outside the current evidence.

Rollback: revert only this joint source slice through Git (or restore the prior READY deployment if urgently needed), then verify the canonical alias and existing access gates. Keep all data and Cloudflare settings. No rollback was required at preparation.
