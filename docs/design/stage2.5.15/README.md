# Continuous UI corners

Derived from governance/STATE.md stage2.5.15, following accepted DESIGN.md revision33. Scope: the user's2026-11-11 request for updated corners and an assessment of quartic Bézier versus superellipse. This child owns comparison/verification evidence; STATE.md owns authority and DESIGN.md revision34 owns the local design decision. This initial slice was local; the later explicitK1.5 acceptance and joint release are owned by STATE.md stage2.5.15.2 and ../../release/stage2.5.15/README.md.

Follow-up: the user subsequently extended this slice to the physical glass slab. See [stage2.5.15.1](glass-table.md) and DESIGN.md revision35; the original CSS comparison below remains retained evidence.

## Choice and comparison

Selected under delegated assessment: native superellipse(1.5) on glass sheets/help and functional controls. The shared material remains a live-scene glass surface. The native curve provides a restrained soft shoulder and retains ordinary border/shadow/focus rendering. Quartic gives a subtly different shoulder at the same apparent rounding; the comparison did not establish a sufficient visual benefit here to add a second layered clipping system. This is a design judgment, not a user study or a statement that one curve is universally superior.

[Comparison page](comparison.html) and [render](screenshots/comparison.png) keep480×584px panels, content, typography, fill/stroke and shadow equal. After the original22px control, the candidates match45° cut-in: ordinary26.1207px; quartic30.6023px; superellipse K1.5/35.2px; K1.8/42.39px. The page uses a common static sampled-outline/glass approximation; it is not proof of each candidate's live refraction. Actual implementation renders below verify that separately. Quartic points and1.171573 extent factor come from the user's local my-skills-collection/evaluations/design-authorship/corner-curve-samples-2026-11-09/bezier.html (the previously viewed experimental curve); source stays unchanged. comparison-metrics.json records exact values. No generated image substitutes for rendered evidence.

Preference consulted: /Users/anoria/.claude/design-preferences.md (2026-11-09), with installed design-authorship0.4.2. Shapes are role-based: surface35.2, compact27.2, control16px, with original22/17/10px fallback. Saved-spread frame radius follows outer radius minus actual padding, including the700px breakpoint. K1.5 is consistent across nested surfaces; circles/pills, art and world geometry retain their prior contours.

## Implementation and checks

- reading-sheets.css contains the feature-detected roles and shape inheritance for all optical layers/pseudo-elements. Unsupported platforms keep their original radii.
- vendor/fluid-glass/corner-geometry.mjs reads uniform computed CSS shapes, preserves the original circular branch and uses exponent2^K for the new contour/normal. Interior bevel depth is a first-order approximation. Sampled K1.5/R35.2/bevel20 error is at most0.451px versus a dense Euclidean oracle; this is a sampled bound, not exact physical optics.
- material.mjs includes shape and fractional radius in selector-safe cache keys. No new dependency, parent clip or shadow wrapper is added.
- Six focused geometry checks are included in test:reading and the existing aggregate. pnpm check:all passes376 tests, governance, TypeScript, runtime guards and build; the existing large-bundle advisory remains.
- A read-only subagent found a narrow-layout radius mismatch; it was corrected to use the20px inset below700px. Independent source/math review otherwise found no blocking issue.

## Rendered verification

Actual local fixture uses `pnpm exec tsx scripts/preview-ai.mjs 5174 --records-demo`. It reads no external credentials and contacts no ANU/OpenAI/Neon. Saved readings are synthetic and memory-only. Screenshots retain the visible fixture banner.

- [More/day/1440×1000](screenshots/more-day-desktop.png): native glass contour, border, shadow and controls.
- [AI/day/1440×1000](screenshots/ai-day-desktop.png): input/select radii, disabled primary pill, native keyboard focus/help.
- [Records/day/1440×1000](screenshots/records-day-desktop.png), [390×844](screenshots/records-day-mobile.png): date/title rows remain open and square; shell stays inside viewport.
- [Saved detail/night/390×844](screenshots/detail-night-mobile.png) and [scrolled](screenshots/detail-night-mobile-scrolled.png): original art, nested frame and long text remain readable/scrollable.
- [More/night/2×](screenshots/more-night-desktop-2x.png) and [help/2×](screenshots/help-night-desktop-2x.png): contours and glass layers align at higher pixel density.
- [Forced ordinary fallback/night/390×844](screenshots/fallback-night-mobile.png): guarded enhancement removed at runtime; shell is22px and optical key returns K1. This simulates the unsupported branch in Chrome, not native Safari/Firefox qualification.

Observed computed styles: shell superellipse(1.5)/35.2px and matching optical child shapes/key; control16px; help27.2px. No document horizontal overflow in asserted desktop/narrow states. Keyboard Tab retained visible focus. Seven state receipts, no page exceptions and no external HTTP requests were saved in ignored .local/stage2.5.15/browser-verification.json. The headless Chrome verification completed these state assertions/screenshots, then its optional post-test reload/restore timed out; its cause is unestablished. The final in-app browser independently loaded the unchanged implementation, showed K1.5/35.2px, reloaded successfully and reopened More at1280×720. This closes ordinary refresh/display verification without claiming the headless automation issue was diagnosed. Native Safari/Firefox, real touch devices and a measured performance budget remain unverified.

All115 inherited/frozen file hashes remain protected. No production settings, application data, provider calls, prompt/content rules or source artwork were changed. The user subsequently accepted this implementation with revision35 and authorized joint publication; docs/release/stage2.5.15/README.md owns the release receipt. The preceding released source was029ca14b.

## Primary technical references

- [CSSWG corner geometry](https://drafts.csswg.org/css-borders/#corner-shaping): exponent2^K and native corner semantics.
- [Chrome native implementation](https://developer.chrome.com/blog/implementing-corner-shape): rendered curve approximation; mathematical names do not establish pixel-exact equivalence.
- [Filter Effects2 Backdrop Root draft](https://drafts.csswg.org/filter-effects-2/#BackdropRoot): a parent clip/filter can change descendant backdrop sampling. This architectural interaction is why the comparison's static quartic silhouette cannot be applied naïvely to the live layered lens.

Feature detection is authoritative for runtime fallback; no blanket browser-version support guarantee is made. Rollback: revert this slice's CSS/optical helper/aggregate registration together to revision33; retain all application state and protected files.
