# stage2.4.2–stage2.4.4 — local trial 06 evidence

Derived from **governance/STATE.md stage2.4**. Scope: implementation evidence and review limits for the local day/night glass UI; this is not a second plan. DESIGN.md owns the versioned design contract; revision 13 below is the historical trial 06, superseded in layout by revision 14.

Date: 2026-10-25. Base: local functional checkpoint `31160c9f`. The user subsequently authorized batched local UI commits. Trial 06 evidence is retained as a comparison before the requested floating-layer/perspective revision; it has not been pushed or deployed, and it is not the accepted final UI.

## Implemented scope

- Shared light/day and dark/night composition, with system-following or manual preference. Only `augurwell.appearance` is stored; reading state remains transient.
- Original 78 source illustrations/data unchanged. Unlit face textures keep source color independent from the lighting mode.
- Entire cloth surface replaced with a rounded physical glass volume, transmission/IOR/clearcoat and a generated softbox reflection environment. No visible foliage, shadows of plants, room props or new external assets. Existing vegetation within source artwork remains unmodified.
- Same 14.8 × 11.2 footprint and placement limits. A 4% overview margin exposes the full glass edge, blending out to the original shuffle framing. Accepted motion/state/fan/picking/camera modules remain unchanged.
- Compact glass dock, optional native tool disclosures, selected name/theme in an unboxed rail; duplicate image moves inside optional meanings. Keyboard Reveal continues at the Meaning summary when focus has not moved elsewhere.

## Observed browser evidence

The local in-app browser exercised real UI, including three cards dragged from the fan to distinct places, double-click reveals, original images/meanings and missing-reversed-meaning notices, blank-surface orbit, wheel zoom, Restore View, normal reset, Skip and Reduced Motion. Appearance was changed during revealing and resetting; completion remained correct. Revealed identity/orientation labels remained stable across day/night switches. Manual appearance persisted across page reload while the reading restarted as documented.

Keyboard placement and Enter on Reveal were exercised. Focus arrived at the Meaning summary after the reveal completed; Enter then opened the details. Expanding tools did not change scene size. At 1440 × 1000 the reader occupied a separate right column. At 1024 × 820 it moved below controls; expanded meanings produced no horizontal page overflow and did not overlay the scene. Pointer dragging was verified at the native browser size; viewport overrides were used for layout inspection and semantic control actions. A failed native drag under an override was not counted as gameplay evidence.

Actual browser screenshots of the same three-card state at 1440 × 1000, 100% view:

- [Day / light](runtime-light.jpg)
- [Night / dark](runtime-dark.jpg)

These are runtime captures, not generated concepts. The selected card is Three of Disks, reversed, with the original theme. The quiet center and edge contrast deliberately differ from the more photographic generated styleframes.

## Checks and limits

89 study tests passed, including five appearance-preference cases and glass geometry/clearance against the retained footprint. Both local entrypoints built successfully; Vite reports a large shared Three.js chunk. The aggregate project gate passed, including the compiled access entry and 15 access tests; STATE.md records the outcome. Independent agents reviewed the integration and shell read-only; no blocking source findings remained. The keyboard-focus observation was repaired and then exercised in-browser.

No sustained frame-rate measurement, real-phone usability acceptance, forced GPU-context-loss test or formal accessibility conformance claim. Original artwork loading/retry tests remain in the suite; new failure-path browser fault injection was not performed. Local verification does not qualify production, alter access configuration or authorize publication. Next user review concerns the material strength, legibility and feel of the runnable local trial; broader question/record work stays deferred.

## Trial 07 — floating functional layer, first local batch

Source: the user's subsequent request that all text/buttons float over the whole table, referencing Apple Liquid Glass, followed by permission for batched local commits. This first batch contains the day/night foundation and the full-viewport floating shell. It intentionally precedes the separately scoped perspective correction. Trial 06 was not an accepted final composition.

The permanent Reset/Tools/Drawn dock keeps stable hit targets while Reveal/Return form an adjacent contextual capsule. Empty reader duplication is removed; selected original name/theme float over the scene and optional dense meanings open on a readable glass ground. Disclosures are mutually exclusive, close with Esc and preserve the camera/card layout. The current full-screen shell retains the old camera until the next batch. Verification for the final perspective refinement will be recorded below.

First-batch browser checks: native drag and double-click reveal worked through the full-viewport overlay, Tools/Drawn/Meaning disclosures were exclusive, Esc closed the open disclosure, dense meanings scrolled independently, and the canvas remained exactly viewport-sized. The permanent three-control rectangles were byte-for-byte equal before/during/after contextual reveal removal; a rapid click during reveal reached Tools correctly after the fix. Aggregate project checks and the retained 89 tests passed; local two-entry build refreshed after the final CSS adjustment.

## Trial 07 — perspective and anchored controls, second local batch

Derived from the same STATE.md stage2.4 scope and the user's low-angle perspective correction request. First local batch: `97d40218`; the second receipt is the Git commit carrying this evidence entry. Both are local only.

Reading now uses native perspective with a 42° vertical field of view. Overview fits the combined glass/card envelope with room for the overlays; zoom remains 75–180%. The old orthographic endpoint is retained exactly for the accepted shuffle, approached using a native perspective dolly/long-lens transition. The comparison test bounds residual endpoint movement below one CSS pixel at 1440 × 1000 specifically. Existing physical positions, fan, original face data, reversal and shuffle/reveal choreography remain unchanged. The dock anchors near the projected front rim with clearance from the full original fan, so drawing a card does not change its anchor. It freezes during lens transitions and open utility popovers.

Browser evidence after integration: three native drags to separate positions and three double-click reveals; original content and reversal retained across light/dark; lowest-angle orbit visibly narrows the far edge; native wheel reached 180% and Home recovered the overview. Keyboard Reveal returned focus to Meaning. Full normal reset finished with zero drawn cards; Skip and reduced-motion reveal/reset also completed. Reset closes disclosures. At 1024 × 768, measured canvas/page dimensions were 1024 × 768, the tool popup stayed inside the viewport, and the reader stayed bounded with its own scroll. Earlier first-batch meaning scrolling measured reader scrollTop 352 without resizing the canvas. Final console warn/error query returned none. Temporary viewport overrides were reset.

Final checks: **98/98 study tests**, both entrypoint builds and **pnpm check:all** passed, including **15 access tests**. Nine new tests cover perspective near/far scale, view bounds, ray unprojection, zoom, exact shuffle endpoint, transition finiteness, malformed inputs and dock/fan clearance. Independent read-only projection review found no blocker; GPU appearance and core gestures were then checked in the actual browser. Existing analytics configuration and shared-renderer chunk-size advisories remain. No real-phone, formal accessibility, sustained frame-rate or subjective comfort qualification is claimed.

Actual runtime captures at the restored native 1125 × 954 viewport:

- [Trial 07 day](runtime07-light.jpg) and [night](runtime07-dark.jpg): same three revealed physical cards, The Star selected/reversed; current full-scene floating UI.
- [Low-angle night](runtime07-low-angle.jpg): earlier three-card state with Prince of Cups selected/reversed, showing the corrected near/far relationship.

These captures replace trial 06 as the current review evidence. Full question/reflection/history work remains deferred.
