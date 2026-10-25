# Augurwell shuffle study

Derived from: [governance/STATE.md, stage2.1](../../governance/STATE.md#stage21--local-motion-and-table-study). Bounded scope: a locally playable 5.06-second reset study, preserving the accepted split/bend/interleave motion at normal speed after an airborne convergence. This is implementation documentation, not another plan or acceptance owner. Design direction belongs to [DESIGN.md](../../DESIGN.md).

## Run locally

Use the existing root dependencies and run from the repository root:

```sh
npm ci --prefix prototypes/shuffle-study --ignore-scripts
pnpm exec vite --config prototypes/shuffle-study/vite.config.mjs
```

Open http://127.0.0.1:5174/ on this computer. The server binds only to loopback. No production deployment, account, or Cloudflare change is needed. The study's separate `package-lock.json` pins Three.js 0.186.1; Vite is reused from the root toolchain. Nested dependencies and build outputs are ignored.

Click **全局重置洗牌** for the 5.06-second sequence. Trial 03 starts with three illustrative face-up cards. These return from their positions; other cards rotate in slowly from four edges and continuously converge in the air, accelerating into a stack before the retained bent shuffle begins. There is no table landing or stationary scattered waypoint. **从牌阵再演示** intentionally restarts this fixture with fresh paths/order. **慢放** runs at 0.35 speed; **侧看弯曲**, **暂停**, the timeline and labelled keyframe buttons allow inspection in both directions. **直接展牌** and **减少动态** show the final flat arrangement immediately. System reduced-motion preference is honored. Both view buttons select stable viewpoints. Audio is optional and off initially; short paper-like sounds are generated locally.

Timing: 0–2.60s airborne return and accelerating convergence; 2.60–5.06s original shuffle from its already-lifted stack onward. The old first 0.54 seconds of stationary gathering/table lift are omitted. Pose, bend and sound all use the same offset into that sequence. Each new run prepares its random path descriptors once. Pause, rewind, skip and slow playback retain that run. The three-card fixture does not read or erase any saved reading.

## Boundaries and ownership

- `motion.mjs`: pure pose sampling and independent Fisher–Yates deck permutation. Animation progress never drives randomization; seeking keeps the same run's identities.
- `reset-motion.mjs`: immutable seeded airborne paths and variable pacing, fixed physical card IDs, identity-to-slot mapping and exact delegation into the original shuffle from progress 0.18 after 2.6 seconds.
- `flex.mjs`: deterministic per-card bend and damped release, sharing the motion timeline. Circular-layer deformation preserves thickness; no elapsed-frame spring state accumulates while scrubbing.
- `card-geometry.mjs`: a subdivided rounded solid with printed top/bottom and paper edges. Deformation updates the actual geometry and lighting normals, so visible surfaces and cast shadows agree. Unchanged bend angles reuse the current vertices.
- `main.mjs`: Three.js scene, mesh integration, lighting, playback, controls and error handling.
- `textures.mjs`: original procedural canvas art for card backs, a placeholder face and woven cloth. No old card illustrations, external images, fonts or sound downloads.
- `index.html`, `style.css`: desktop-first review interface; narrow windows retain controls.

This study has no question entry, card picking, reveal, card meanings, history, AI or synchronization. It does not load or alter the legacy React app. Bending and rebound follow authored curves; this is not a measured paper-material or physics simulation. Larger rebound was reduced after sampled intersections between successive cards. Physical plausibility and atmosphere remain subject to user review. WebGL2 is required; failure has a readable retry state. No live missing-GPU/context-loss test or physical-phone acceptance is claimed.


## Local reading trial 05 (extending trial 04)

Derived scope: governance/STATE.md stage2.3.1, extending [stage2.2](../../governance/STATE.md#stage22--reliable-reading-table); implementation notes only, not a second plan. The original trial 03 page and motion files remain intact. Open http://127.0.0.1:5174/reading.html for the complete local drawing loop. Use `pnpm exec vite --config prototypes/shuffle-study/reading.vite.config.mjs` for both entries; this reading configuration polls for file edits to avoid stale transforms on the local host. Build both pages with `pnpm exec vite build --config prototypes/shuffle-study/reading.vite.config.mjs`.

Drag any card from the stable lower fan onto the table, move freely, and double-click a placed card to reveal. Single-click selects; the nearby Reveal button and previous/next/place controls provide keyboard alternatives. Hidden cards can return to their original slot. Undo preserves known identities; arrange-three positions the first three drawn cards without limiting the deck. Escape cancels dragging. Hover gently lifts one card while neighboring cards ease apart. Trial 05 reuses the original 78 deck illustrations and English data. The selected image, name and theme appear only after reveal; an optional reading section expands the original interpretation and imagery. Missing reversed meanings are labelled. No question, notes or saving feature is implemented.

`reading-state.mjs` owns pure identity/orientation/placement transitions; `reading-content.mjs` maps stable physical IDs to the existing JSON, `reading-art.mjs` decodes and fits source images without cropping, `reading-reader.mjs` owns the optional reading panel; `reading.mjs` owns pointer input, the scene and reveal timing. `reading-reset.mjs` preserves the current fan during a 450ms exit, then delegates to the unchanged accepted choreography with actual table-card poses. The remaining cards are reordered offscreen, and the completed fan moves into the selection strip over 520ms. Normal reset lasts 6.03s, preceded by a 0.32s return to the original shuffle framing; the last 520ms also restores the enlarged reading frame. Skip/reduced motion finishes the same prepared round immediately in the enlarged reading view. This hidden handoff is checked for desktop framing; arbitrary overlapping-layout collision guarantees are outside the trial's evidence.

## Verification

```sh
node --test prototypes/shuffle-study/*.test.mjs
pnpm exec vite build --config prototypes/shuffle-study/vite.config.mjs
pnpm check:all
```

Keep current results and evidence ceilings in the canonical state owner. A successful local test/build or screenshot does not imply design acceptance, integration, commit, push or deployment.

Blank-table dragging changes the viewing height and horizontal direction within bounds. Shift + arrow keys is the keyboard alternative; Restore View returns home. Card input takes priority over view dragging. Camera-aware stable card-plane picking keeps the fan reachable at the allowed angles. Neighbor spacing is wider while the accepted slight lift is unchanged. These are trial 04 refinements under the same stage2.2 scope.

Wheel-up zooms toward the table center and wheel-down pulls back (75–180%); minus/plus buttons and keys are equivalent. Restore View returns angles and scale to the original view. Downward pointer dragging raises the view after the owner-requested direction correction; keyboard Up still raises it. Zoom is held fixed during card/view dragging and shuffle. Close zoom intentionally crops outer regions; overview remains recoverable.

The reference-led fan refinement uses `reading-fan.mjs`: one deterministic loose arc per prepared order, with uneven spacing/depth/yaw and solid card clearance. Draw/return/hover do not reroll the arrangement. `reading-cloth.mjs` provides a finite plain textile with stationary edge folds/hem as a spatial reference; it adds no motif or dynamic cloth simulation. The accepted shuffle remains unchanged and blends into the newly prepared fan at the final settling step.

After local checkpoint `919e66dc`, stage2.2.2 expands the cloth to 14.8 × 11.2, centered at z = −0.6. `reading-layout.mjs` owns the shared dimensions and card-center bounds (x ±6.6, z −4.6 to 0.75). The front edge and card scale are retained; added room is at the sides and back. Drops, movement and camera fitting use the enlarged area. The owner accepted this size and the sideways reveal below, and requested packaging both as local checkpoint 2. Current evidence and the checkpoint scope are in `governance/STATE.md`.

`reading-reveal.mjs` owns the side-turn pose: one random left/right choice per reveal, independent of the round’s fixed upright/reversed array. The long-axis turn keeps printed head/foot direction, uses short-edge lift clearance and finishes in 620ms. Reduced motion uses the same final pose immediately; face-up dragging and an interrupted reset preserve the visible orientation. The former end-over-end reveal is superseded.

## Local day/night trial 06

Derived from governance/STATE.md stage2.4.2–stage2.4.4; implementation/evidence notes only, not a separate plan. User authorized the local trial after selecting the later light/dark concepts, retained Urban Tarot artwork and no foliage, then explicitly requested replacing cloth with a fluid-glass surface. Open the same reading.html URL.

The appearance selector follows the system or manually selects day/night; only that preference is stored as `augurwell.appearance`. One scene and reading state serve both modes. `reading-glass.mjs` builds a rounded solid glass volume with transmission, IOR, clearcoat and a generated neutral reflection environment; no visible props. It retains the 14.8 × 11.2 footprint, with its top below the card layer. `reading-scene-style.mjs` owns material/light changes and the original geometric back; `reading-cloth.mjs` remains a retained legacy utility, unused by trial 06. Card face files/data and accepted motion/state/camera modules are unchanged. Reading framing has a 4% overview margin to show the surface edge, blended out for the accepted shuffle.

The glass action dock, original-card meanings and keyboard/view utilities share a single responsive layout. Detailed art/meaning remains optional; the selected name/theme stays visible separately. Keyboard-triggered Reveal continues at the meaning summary if focus has not moved elsewhere. No question, history, AI, cloud synchronization or publication. Evidence: [local review](../../docs/design/stage2.4.2/README.md).

## Local trial 07 — floating interface

Derived from governance/STATE.md stage2.4, scope: the local UI refinement only. Full-viewport rendering replaces the prior split reader layout. Stable permanent controls and contextual card actions float over the table; native disclosures are mutually exclusive and close with Esc. The first local commit (97d40218) contains the glass/floating UI; the second adds reading-projection.mjs and its tests. Reading uses true perspective; reset retains its exact original orthographic frame via a native perspective lens transition. A projected-edge anchor keeps the stable dock close to the surface and clear of the overview fan. Original images/data and gameplay remain unchanged.

## Local trial 08 — overhead view and physical glass controls

Derived from governance/STATE.md stage2.4.6; scope: implementation/evidence notes only, not a separate plan. DESIGN.md revision 15 owns the current candidate contract; the preceding trial sections describe their historical implementations.

The view reaches exactly 90 degrees without a pole flip. Reading and reset share one native perspective camera and retain chosen angles; zoom alone may return to 100% for reset. Physical table/card/dock volumes drive overview fitting. `reading-back.mjs` creates paired 1024 × 1688 prints, leaving original face images unchanged. `reading-dock.mjs` supplies a separate low glass capsule and tested four-corner mapping of native controls to its actual top plane. Long meanings and utilities stay screen-aligned. Close inspection keeps a screen-level Home recovery action if the physical dock leaves view. List buttons retain identity/focus through selection, and Escape returns to an available control.

Materials add static asymmetrical warm/cool light, soft reflections and contact shadows. No continuous lighting loop, new dependencies or Blender asset is required. Only appearance preference is stored; question/history work remains deferred. Evidence: [local trial 08 review](../../docs/design/stage2.4.6/README.md).

## Local trial 09 — fixed clear-glass controls

Derived from governance/STATE.md stage2.4.8; scope: implementation/evidence notes only, not a separate plan. DESIGN.md revision 16 owns the current candidate. Checkpoint 5 (`d496918b`, product `c9e3ff1c`) accepts the preceding non-button treatment.

`reading-screen-glass.mjs` keeps the original scene render, copies only the native dock rectangle plus 24 CSS pixels of padding, and draws a raw screen-space glass lens over that region. The control strip stays fixed at lower center, with a clear center, edge refraction and localized light/shadow. Original tone/color settings are untouched; outside pixels must remain identical. Native buttons retain full input/focus behavior. No world-space glass button mesh or projected CSS label plane is rendered in trial 09. The old projection extent stays fixed for camera continuity.

The separate `reading-screen-glass.verify.html` page exercises the real GPU before/after pixels at multiple appearances and pixel ratios; it is a local diagnostic, not a product route or build entry. Evidence: [trial 09 review](../../docs/design/stage2.4.8/README.md).
