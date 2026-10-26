# stage2.4.12 — local trial 11 evidence

Derived from `governance/STATE.md` stage2.4.12. Scope: daylight glass clarity, original static cottage reuse and freer recoverable view. This evidence document is not a current-state plan.

## Delivered candidate

- Checkpoint7: `1dc33e53`, preserving trial10 product baseline076d1d12.
- Camera batch: `dca471d0` — full horizontal orbit,12–90° elevation,65–220% optical zoom, visible 回正. Home preserves card identity/orientation and placement.
- Glass edge batch: `52c0b63c` — stronger day edge/reflection, thicker downward bevel, lower boundary and matching shadow/projection extents, unchanged14.8×11.2 play area.
- Room batch is the commit containing this evidence: original cottage static geometry/textures frome71fe3fa, independent GLB assets, source-matched placement and no imported app behavior. Final transform and measured asset costs are in `cottage-source-and-export.md`.

## Verification

122 study tests passed, including original artwork mappings, shuffled identity/orientation, card picking at expanded angles, source-asset geometry/hash checks, and1,440 sampled desktop room-camera positions. The actual browser room GPU fixture passed8/8 cases, preserving source-art probe bytes and pixels outside the control capture region; see `room-gpu-verification.json`. This validates the rendering pipeline, not photographic accuracy.

Observed native browser flow at1280×720: drag three cards to freely chosen positions; double-click all three to side-reveal; show original meaning and reverse-content notice; change light/dark without changing selected card or revealed count; low/side/exact-overhead camera views; wheel zoom; one-action home preserving Prince of Swords upright and3/3 revealed; full reset from three cards to0/0; second reset at exact overhead remains overhead and completes. Final clean-session console errors are recorded separately. Both prototype build entries and the project aggregate gate are checked before this batch is committed.

Images: `cottage-source-day.png` and `cottage-source-night.png` show the original component export preview; `day-three-cards.png`, `night-three-cards.png`, `day-low-angle.png`, `night-low-angle.png`, `day-side-view.png`, `day-overhead.png` show the actual integrated local page. These are browser screenshots, not generated concept art.

## Boundaries

The full static source export contains645 meshes and13 embedded textures per theme. Characters, walking cats, app navigation and private configuration are excluded. Original decorative floor cards remain visible as room decor. Geometry/texture reuse is verified; lighting, shadows, blur, exposure and the inserted glass are adapted for this page, so this is not a pixel-identical copy of the cottage renderer.

Both GLBs total34.31MiB. Desktop manual use was observed; GPU memory, broad performance and phone interaction have not been measured or qualified. The source cottage remains clean ate71fe3fa. All65 inherited dirty generated files remain byte-identical to entry. No production access change, push or deployment. User visual acceptance remains pending.
