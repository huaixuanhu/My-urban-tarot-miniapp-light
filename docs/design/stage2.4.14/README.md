# stage2.4.14 — Local trial 12 repair evidence

Derived from [governance/STATE.md](../../../governance/STATE.md) stage2.4.14 after checkpoint 8 (`81fcc1a0`, product baseline `eadc2961`). Scope: duplicate floor decor, the pictured camera obstruction, stronger room defocus and glass contrast. This is supporting evidence, not a parallel plan or acceptance owner. Design owner: DESIGN.md revision 19.

## Findings and implemented choices

The large circular object in the user's low-angle screenshot is the original shower head. The pinned source `Furniture.tsx` places its disc at cottage (.3, 1.72, 2.06), radius .13 m. At a 1792 × 1388 viewport, yaw −23°, elevation 22°, the reading camera is about .358 m from it. Its large projection is valid perspective; the usability/depth error comes from allowing it into the foreground while the separate room texture is always drawn behind the interactive table. Checking only outer walls did not catch that internal fixture. The same failure was reproduced with native browser dragging before the repair.

The repair keeps the camera unchanged. `reading-room-visibility.mjs` uses actual mesh triangles along fifteen camera-to-table rays and a small near-camera clearance region. Only coherent furniture component groups intersecting that corridor are temporarily hidden. A slightly wider restoration corridor reduces boundary flicker. Floor, rugs and architecture do not enter these cohorts. Hidden groups remain queryable and return when clear; the fixed original geometry, materials and transforms are retained. This is an explicit table-focused cutaway. It does not merge the room and foreground depth buffers or claim physical occlusion for every possible sightline. It can visibly remove a furniture group in obstructed sectors, a tradeoff that preserves the existing 360° orbit and 12–90° elevation without snapping the camera upward.

The four dark decorative floor cards are excluded separately. `reading-room-content.mjs` requires a unique matching source anchor and four two-mesh groups. Both themes retain 645 imported meshes but render 637 before any temporary cutaway. The hidden meshes remain owned by the original root for cleanup. The actual 78-card Urban Tarot deck is untouched. Both binary assets and the source cottage project remain unchanged.

The independently committed optical batch (`6649fce9`) uses a dense 12 CSS pixel room-only Gaussian and smaller blur targets, leaving card art and controls sharp. Day glass has a cooler clear surface, stronger dark lower edge and reflective bevel; night retains a clear center and brighter boundary. The existing key reflection uses a feathered rectangular window field. No new room capture or Blender export is required. See [optical research](optical-research.md) for primary documentation, alternatives and source-level cost estimates. This is deliberately uniform background defocus, not a physical depth-of-field simulation.

## Verification

- **130 study tests passed**, including tests that read the actual day/night GLB hierarchy and triangle buffers. The exact shower-head case is hidden/restored correctly, and 80 representative views across 760 × 900 and 1792 × 1388 retain architecture/floor and source resources. This is bounded sampling, not proof for all continuous views.
- Room visibility is cached at a stationary camera. Tests cover unchanged geometry/material identity, coherent pipe/head hiding, restoration, malformed-source rejection and keeping excluded floor cards hidden. A direct regression confirms that a cutaway revision invalidates the cached room once even with unchanged camera matrices.
- **Eight actual browser GPU cases passed** across light/dark, DPR 1/2 and two viewport sizes. Artwork probes, white patch and pixels outside the control capture remain exact RGBA matches. See [room-gpu.json](room-gpu.json).
- Both local prototype entries built. `pnpm check:all` passed, including governance structure, TypeScript, compiled access runtime, 15 access tests and the existing production build. Existing unset-analytics and large shared-renderer bundle warnings remain.
- Native browser at 1280 × 720: drag three cards into chosen positions, double-click side reveal, inspect original meanings and reverse-content notice, change light/dark with three revealed cards and selected Ace of Wands reversed retained, orbit to side/rear low angles, exact overhead, wheel zoom, home and full reset to 0/0. Visible home reached its disabled default-view state. Narrow 1024 × 768 rendering and persistent controls were also inspected.
- At 1792 × 1388, the same native drag reproduced the large shower disc before the cutaway and removed it afterward with unchanged table framing. The before image already contains the stronger optical batch, isolating the obstruction comparison. The random deck fan is newly prepared after reload, so this is not a pixel-identical gameplay-state comparison.
- Final preview warning/error log was empty. The cottage working tree is clean at `e71fe3fa`; all 65 inherited dirty generated files match entry hashes and stay outside commits. No access protection changes, push or deployment.

## Rendered evidence

All images below are actual local browser screenshots, not generated concept art.

- [Obstruction before](obstruction-before.png) / [same-angle repair](obstruction-after.png): 1792 × 1388, approximately yaw −23° and elevation 22°.
- [Day, three revealed cards](day-three.png) / [night, same reading](night-three.png).
- [Night side view](night-side.png), [reverse low view](night-reverse.png), [exact overhead](night-overhead.png).
- [1024 × 768 desktop](day-1024.png).

Visual acceptance remains with the user. Static source fidelity is preserved except the explicit local visibility adaptations; renderer/lighting parity with the original cottage and physical lens optics are not claimed. GPU frame rate, memory and physical-phone comfort remain unqualified. Question records, persistence, AI and cross-device flow remain deferred.
