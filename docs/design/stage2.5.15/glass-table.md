# Physical glass corner follow-up

Derived from governance/STATE.md stage2.5.15.1, extending stage2.5.15 and DESIGN.md revision34. The user's follow-up authorizes applying superellipse to the physical glass slab and comparingK1.5/K1.8 locally. Current authority: STATE.md; design selection: DESIGN.md revision35. The initial comparison was local. Subsequent explicitK1.5 acceptance and joint publication are owned by STATE.md stage2.5.15.2 and ../../release/stage2.5.15/README.md; real provider calls remain outside scope.

## Selection and contour

SelectK1.5 under delegated assessment. At matched corner cut-in, its transition looks softer and agrees with the local UI. K1.8 is slightly squarer; it remains available in the local comparison fixture. The choice is visual judgment, not measured user preference. Four straight sides remain; the complete rectangle is not replaced by an oval.

The old0.36-radius corners were quadratic Bézier curves. The new K1.5 nominal radius is0.576 (×1.6). The K1.8 comparison radius is0.6803303735, using B+(Rreference−B)×dreference/dK with B=.065 and dK=1−2^(−1/2^K). This matches the extrusion core before applying a common bevel. Raycast45° cut-in at retained rimheight−.023 is0.1406601124 forK1.5 and0.1406584929 forK1.8: residual difference1.62e−6 from sampling/miter construction. The fixed referenceK is kept separate from the chosen default.

Both cases keep15.54×11.76 dimensions, centerZ−.6, top−.008, bottom−.168, body depth.08 and bevel width/thickness.065/.04. Each corner uses48 segments; exact endpoint coordinates prevent duplicate near-zero closing edges. The16,452 vertices and original cap/wall material groups are static. Upper rim points are intersected/interpolated from actual bevel rings at−.023, with lower rim at−.153. Materials, environment, lighting and original engraving are unchanged; no layout/camera/input/provider behavior changes.

## Verification

- pnpm check:all:378 tests, governance, TypeScript, runtime guards and build pass; existing bundle advisory retained. Only the geometric tests grew by two; all earlier UI/optical tests remain included.
- Final targeted geometry check also passes after adding actual downward-ray support assertions for complete card corners at allowed placement limits plus drop margin. Tests cover symmetry, straight sides, duplicate edges, nondegenerate triangles, finite unit normals, dimensions/thickness and rim-to-bevel raycasts for bothK values.
- Independent read-only review checked every196 upper and196 lower rim point for each candidate:784 rays, zero misses, maximum surface discrepancy≈5.56e−9. No blocking finding remained. This is numerical verification, not a rendered performance measurement.
- Actual in-app browser at1280×720: fresh app reload, local system shuffle, explicit single-card placement and reveal; counter reached1/1 and original The Empress artwork/name appeared. Day/night retain card orientation.390×844 night preview has no horizontal overflow; original viewport was restored. Application and comparison page error logs are empty. The preview is synthetic and made no real ANU/OpenAI/Neon calls.
- All115 inherited/frozen hashes match. Original reading-layout.mjs, reading-ritual.mjs, reading-room.mjs and appearance/card sources remain unchanged.

## Renders and reproduction

Run `pnpm exec tsx scripts/preview-ai.mjs 5174 --records-demo`. The application is http://127.0.0.1:5174/. The separate local comparison is `/@fs/<absolute project path>/prototypes/shuffle-study/glass-corners.verify.html`; it reuses the actual glass/engraving factory with identical neutral lights, ground and camera for both candidates. It has no API calls and is excluded from the application bundle.

- [Normal day comparison](table-screenshots/comparison-day.jpg).
- [Near corner/day](table-screenshots/comparison-corner-day.jpg), [night](table-screenshots/comparison-corner-night.jpg).
- [Top/day](table-screenshots/comparison-top-day.jpg), [night](table-screenshots/comparison-top-night.jpg).
- [Actual application/day](table-screenshots/application-day-final.jpg), [night](table-screenshots/application-card-night.jpg), [390px night](table-screenshots/application-card-night-mobile.jpg).

The fixture isolates physical contours using a neutral grid backdrop; it is not a reproduction of the cottage scene. The actual app renders verify integration separately. The outline is sampled, the bevel is a parallel offset and materials remain authored approximations. Native Safari/Firefox, real touch-device performance and a measured frame-rate budget remain unverified. Private aggregate/browser/preservation receipts are under .local/stage2.5.15/table/. Both corner slices were subsequently accepted asK1.5 for joint publication; docs/release/stage2.5.15/README.md owns that release. The preceding released baseline was029ca14b.
