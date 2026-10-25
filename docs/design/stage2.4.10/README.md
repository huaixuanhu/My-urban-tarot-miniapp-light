# Local trial 10 evidence

Derived from governance/STATE.md stage2.4.10; bounded rendering/verification evidence, not a parallel plan.

## stage2.4.10.1 — lens batch

Checkpoint 6: 47b67ea4, preserving accepted trial 09 at d3aaa4a8.

The capsule retains an untinted sampled center, with a thinner bevel, softer down/right shadow, warm lower catch and restrained violet perimeter. Native primary-action emphasis uses a localized ivory insert. Actions, position and camera are unchanged.

Six optical-region/resource tests passed. Eight real GPU cases pass in lens-gpu.json: light/dark × two pixel ratios × two sizes; outside-region bytes and unlit white artwork are unchanged. Browser checked empty and hidden-selected states at 1440×1000; lens-before-room.png captures the intermediate state. The prototype two-entry build and pnpm check:all passed. The aggregate includes 15 access tests; warnings about existing analytics placeholders and the shared-renderer bundle remain.

The concept is the visual target, not a claim of identical physical optics. The environment batch will assess the lens over the detailed room rather than a uniform background.

## stage2.4.10.2 — room/environment batch

The lens batch is committed as `5db4c7bd`. This second batch ports a bounded subset of the actual cottage geometry/material approach; see [source provenance](cottage-source.md). It adds oak floor, windows, curtains and an off-table sofa, plus a newly authored low stone dish/pebbles and a cottage-derived sprig. The cottage checkout remained clean at e71fe3fa. No models/photos/credentials/runtime links were imported.

The glass footprint, camera limits and original card geometry/state/motion remain unchanged. Its opaque backing is removed. Room floor is y=-2.8; a soft shifted floor shadow and restrained static caustic accents suggest the raised glass. Card-contact shadows remain bounded to the top plane. The room-only pass uses three bounded linear half-float targets with separable blur, cached until camera/size/theme changes. Card faces render directly, outside that pass. The fixed control lens samples the final background, preserving actual texture/refraction beneath it.

Rendered review changed the first candidate: removed a conspicuous tall dish pedestal, cooled the overly beige floor, softened window contrast, made leaf faces rounder/more visible and reduced broad reflection on the dark glass. The final material remains a local candidate for user review.

### Verification

- All 117 study tests passed, including 5 new room-pass cache/state/resource tests and 6 retained control-lens tests.
- Eight actual GPU room cases passed in [room-gpu.json](room-gpu.json): light/dark × two pixel ratios × two sizes. Each compared 400 opaque artwork probe pixels plus a white patch before/after room blur and final control lens. Art samples remained exact RGBA matches, background changed, cache invalidation worked and renderer state restored. The separate eight lens cases also passed.
- Native browser dragging drew three cards to independently chosen positions; double-click/sidebar action revealed the original art and optional original meaning. Appearance changes retained selected identity/orientation and 3-drawn/1-revealed counts. The final paired images show Queen of Swords upright in the same layout.
- Blank drag reached low angle and exact overhead, with stable card geometry and background perspective. Full reset completed at overhead with fresh fan/count0; one automation wait deadline expired during the animation, then a subsequent state read confirmed normal completion and an empty console error log. Reduced-motion reset also completed immediately. Wheel zoom reached180%; Tools/Restore View returned to overview.
- Reviewed1440×1000 and1024×768, including a long reading panel and fixed accessible controls. No new browser warnings/errors in final observed run. No measured frame-rate claim or physical-phone qualification.
- Both prototype entries build. `pnpm check:all` passes: governance structure, TypeScript, compiled access entry, all15 access tests and original app build. Existing analytics placeholder/shared-renderer size advisories remain.
- All65 original .DS_Store/tracked node_modules dirty files are byte-identical to the turn-entry snapshot and excluded from commits. Gameplay/source-art/access files outside the named visual integration are unchanged. No push/deployment.

### Actual captures and limits

- [Day](light-runtime.png), [night](dark-runtime.png): final paired default-view state, same Queen of Swords reading.
- [Low angle](low-angle.png), [overhead](overhead.png): native view changes with Four of Wands, before reset.
- [Narrow reading](narrow-reading.png):1024×768 optional reader. The panel has its own scroll area.

Background blur and lens optics are real-time approximations. Static floor light/shadow textures are authored; they do not establish ray-traced room lighting or exact reference-image identity. The environment is a curated source adaptation, not the full cottage application or an identical room export. No Blender step was needed for this bounded geometry/material version.
