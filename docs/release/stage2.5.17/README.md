# Interaction release

Derived from governance/STATE.md stage2.5.17.4. This record covers the joint publication of stages 2.5.16 through 2.5.17.3 on the existing private site.

The owner accepted design revision40 on 2026-11-19. The release includes shuffle feedback, continuity while dragging the table and cards, carried-over question and save confirmation, a compact floating model/effort control, and the movable AI sheet. Local browser evidence is in [the table and record tests](../../design/stage2.5.16/README.md) and [the AI panel tests](../../design/stage2.5.17/README.md).

Preflight passed 401 tests, governance, types and the production build. Independent scope review confirmed the simulated network delay is confined to the loopback preview. All 115 protected file hashes and the eight stage2.5.16 source hashes matched. Before publication, the canonical domain resolved to READY deployment dpl_AMGz3zFkQrrCNVNYn5sC5Jbrteey at Git revision 0d953fe5. All six anonymous access checks passed.

## Production verification

GitHub main received application commit d13e0f477c2c2fd832facb74066257c7d0e4f1fa. Vercel returned READY for the Production deployment dpl_A6jDvB2uC5FvxF3WbnjN5BVxohAv, with the matching Git SHA and canonical augurwell.anoriaquant.dev alias.

The canonical homepage and three API entry points sent unsigned visitors to Cloudflare Access. The default origin returned 403 and the unique deployment redirected to Vercel authentication. The browser reached the Urban Tarot Cloudflare sign-in page. The release browser had no active site session. The post-login interaction evidence is from the local production-style fixture. Release checks issued no generation, shuffle or record-save request.

The final documentation-only synchronization is checked against remote main and the production alias. Its deployment receipt is kept under the ignored .local/release-stage2.5.17/ directory. The previous known-good production source is 0d953fe5.
