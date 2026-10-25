# Local trial 08 evidence

Derived from `governance/STATE.md` stage2.4.6. Scope: implementation and verification evidence for the requested overhead camera, coherent reset, paired card backs and table-mounted glass controls. This is not another plan or design owner; `DESIGN.md` revision 15 owns the candidate design. Date: 2026-10-26, Australia/Melbourne.

## Authority and receipts

The user accepted trial 07 before requesting four refinements. Checkpoint 4 is `0bdb04f7` (acceptance record; product baseline `55fbfc91`). The camera/controller correction was separately committed as `a555a294`. The final material/control/framing implementation is the local commit carrying this evidence. Local batch authority does not authorize push or deployment. Trial 08 is ready for user review; it is not a newly accepted checkpoint.

## Implementation

- Stable elevation from 34 degrees through exactly 90 degrees; horizontal orbit and zoom retain their existing limits. Analytic camera axes prevent a pole flip.
- Reading and reset use one perspective camera. The chosen direction stays fixed; only zoom may return to 100% before reset. Physical shuffle paths and card flex remain unchanged. Bent/tilted cards naturally foreshorten; a flat card under the overhead camera has a rectangular outline and correct aspect.
- Overview fitting uses actual glass/card/control volumes, without a content-dependent camera change. At 1280 × 720 the overhead table spans about 701 × 530 pixels. A screen-aligned recovery action appears when close zoom crops the physical control plane.
- Paired 1024 × 1688 procedural backs use the supplied star, rings, crescents, dot axis and fine border motif. Day ink is thicker/darker for small rendered cards. The original Urban Tarot faces and meaning data are unchanged.
- A separate 7.4 × 1 glass capsule sits on the table. Native controls map to its real upper surface using the same camera. Static warm/cool reflections and contact shadows add depth. The table and control block share one reflection environment. Expanded meanings/tools remain screen-aligned for reading.
- List buttons retain their DOM identity through selection; opening a list transfers focus inside, and Escape restores an available trigger. New files introduce no dependencies. Blender was not required.

## Automated evidence

- `node --test prototypes/shuffle-study/*.test.mjs`: **106 passed, 0 failed**.
- `pnpm exec vite build --config prototypes/shuffle-study/reading.vite.config.mjs`: both local entries built.
- `pnpm check:all`: governance structure, TypeScript, compiled Node entrypoint, **15 access regressions**, legacy build all passed.
- Relevant geometry checks cover exact-pole continuity, rectangular card projection, camera invariance through reset progress, projected control-plane corners and interior points across view/zoom bounds, overview visibility, fan picking and 128 randomized complete-fan clearances around the glass capsule.
- Shared reflection-texture ownership/disposal is checked. Prototype build retains its existing renderer chunk warning; the legacy build retains unset analytics-placeholder advisories.

## Actual browser evidence

The local in-app browser exercised the following, using native gestures and native controls:

- Three independent fan drags to chosen positions, individual double-click reveals, selected image/name/theme and optional detailed meaning.
- Light/dark switching while retaining the same three cards, revealed count, selected card and its orientation.
- Blank-table drag to the exact overhead view, overhead card picking/placement and normal reset. The control-plane matrix was identical before and after that reset; a flat placed card had the expected rectangular shape.
- Lower-angle horizontal orbit with aligned control labels and a successful Meaning click on the inclined glass block.
- Wheel close-up, overhead close-up with the recovery action, and successful return to the full table.
- Keyboard list selection retaining focus, Escape returning to Tools, and keyboard Reveal transferring focus to Meaning. Reduced-motion reset and direct Skip both completed to an empty reading/new fan.
- Normal 1280 × 720 preview and a 1024 × 768 desktop-window check. Temporary viewport overrides were reset.
- Final source reload and subsequent gestures produced **no new browser warnings/errors**. One earlier syntax error was captured during an intermediate file write; it was corrected before final source reload and is not present in the final module/build.

Screenshots show the same final reading, with two cards revealed and one hidden:

- [Night runtime](dark-runtime.png)
- [Day runtime](light-runtime.png)

These are actual browser captures, not generated design renders. Brightness, tactile feel and overall visual acceptance remain for the user to assess. No measured frame-rate/GPU matrix, physical-phone gameplay, continuous collision proof or production qualification is claimed.

## Preservation

SHA-256 comparison against the entry snapshot found all **65 pre-existing dirty/generated files unchanged**, including `.DS_Store` and tracked `node_modules` changes. They remain outside the new commits. The original client/access code, root dependency manifests, accepted motion/flex/reset adapters, reading state and sideways reveal have no diff against checkpoint 4. No push, deployment or access-policy change occurred. Current-state continuation remains in `governance/STATE.md`.
