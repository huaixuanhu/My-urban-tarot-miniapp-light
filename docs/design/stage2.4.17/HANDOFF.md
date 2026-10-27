# stage2.4.17 — Accepted Augurwell source handoff

Derived from governance/STATE.md stage2.4.17. Scope: the user-authorized GitHub publication of accepted revision20 and pointers for a later user-led infra/cottage integration. This is supporting handoff evidence, not another current-state owner or authorization to modify the sibling project.

> Superseded for integration by STATE.md stage2.4.18: the accepted UI is now promoted to client/ and the root build. See ../stage2.4.18/README.md. The remainder records the historical source-only publication.

## Source and accepted baseline

Repository: https://github.com/huaixuanhu/My-urban-tarot-miniapp-light, branch main. The publication commit is the commit introducing this handoff; verify remote main before integration. Governance entry: AGENTS.md -> governance/README.md + contract.json + STATE.md; design owner: DESIGN.md revision20. The latest user authorizes this push even though earlier entry/history paragraphs record the previous no-push boundary.

Accepted application entry: prototypes/shuffle-study/reading.html. It retains original78-card Urban Tarot art/data, free drag-to-place, double-click sideways reveal, meanings on demand, accepted airborne/bent shuffle, full horizontal orbit,12–90° elevation, bounded zoom and visible home. Day/night glass and room defocus/cutaway are accepted. The final slab is15.54×11.76 gameplay units; all other accepted behavior is preserved. Only appearance is persisted. Reading/question history, AI and cross-device continuity remain deferred.

## Run and build the accepted reading UI

From repository root, use the pinned installed dependencies. A fresh checkout also needs the isolated study dependency via `npm ci --prefix prototypes/shuffle-study --ignore-scripts` (the repository README owns setup).

```sh
pnpm exec vite --config prototypes/shuffle-study/reading.vite.config.mjs
# http://127.0.0.1:5174/reading.html
pnpm exec vite build --config prototypes/shuffle-study/reading.vite.config.mjs
# output: prototypes/shuffle-study/dist/reading.html and its bundled assets
node --test prototypes/shuffle-study/*.test.mjs
pnpm check:all
```

Source dependencies include `client/src/data/tarotData.json` and `client/public/images/cards/*.webp`; retain them when integrating the source. Copying `reading.html` alone is insufficient. A built handoff must include its bundled assets.

`prototypes/shuffle-study/dist/index.html` is the separate motion study, not the accepted reading application. The build has relative asset paths. Do not link to the source .mjs path as if it were deployed output, or copy a development localhost URL into the hosted cottage.

## Production and access boundary

The current root `pnpm build` / default vite.config.ts still builds client/ into dist/public. vercel.json only retains the server-side proxy entry; this task does not switch production to the prototype build. Pushing repository source and receiving a successful root build do not establish that the new reading UI is live on augurwell.anoriaquant.dev. Decide and validate the new hosted entry/build in its own authorized integration slice before changing the cottage link.

The private Tarot application retains its own Cloudflare Access gate and server-side signed-credential verification, plus the existing hostname restrictions. A cottage collection link is not an access boundary; preserve the destination application's protection. This push does not change access/config.ts, access/guard.ts, proxy.ts or vercel.json.

The original cottage remains a separate application. Tarot's two local static GLBs derive from cottagee71fe3fa; they do not embed its navigation, private configuration or runtime state. Model provenance: docs/design/stage2.4.12/cottage-source-and-export.md. Both assets total34.31MiB; performance and physical-phone qualification are not established. The four original floor cards are excluded in the Tarot adaptation, and near-camera furniture uses a documented table-focused cutaway.

## Evidence and continuation

130 study tests,8 unchanged-optics GPU cases, original access15-test gate, two prototype entries and observed desktop reading flow are recorded under docs/design/stage2.4.14 and stage2.4.16. Checkpoint9 is73b2fa4d, preserving the accepted pre-enlargement baseline. Existing65 generated-file changes remain outside the commit. Current scope/status continues only through governance/STATE.md.
