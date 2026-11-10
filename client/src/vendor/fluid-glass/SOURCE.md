# Fluid glass material adapter

Source: https://github.com/huaixuanhu/My-design-system-collection/tree/adc4f29fc8c471de49bfc7c08ccda8fe7a698868/systems/fluid-glass/project
Inspected upstream main: adc4f29fc8c471de49bfc7c08ccda8fe7a698868 (2026-10-29).
Upstream material files: components/bundle.css (Git blob a14654143c277936cc1e02f984a537d3ed998e86), components/fluid-glass.js (ad30efe7d216cc12bdb698e350635e306e7320cf).

The user explicitly requested this collection's material for Augurwell's sheets. This is a locally adapted snapshot, not a runtime CDN dependency. Upstream remains read-only.

Adaptations:
- CSS retains upstream tokens, fog calculations, glass/pearl materials and accessibility fallbacks, omitting global body/button resets and unrelated demo, layout and scene components.
- External token names are prefixed `--fgs-` to avoid changing the table/dock's existing tokens. Upstream sun/night map to the existing light/dark appearance choices. Internal `--fg-*` material variables retain their names.
- The material engine is an ES module; the optional second WebGL scene/hero lens is omitted. No environmental duplicate or extra scene renderer is created.
- Optical map dimensions use untransformed layout dimensions so the sheet's opening scale cannot distort the final edge.
- Reflection/highlight maps are clipped to the bevel band. On the much larger live-scene panel, upstream's flat-center 4% reflection exposed a diagonal normal-field seam; the face now stays unpainted as required by the upstream material contract. Interior pixels also skip the unnecessary optical calculation.
- The application retains its own disclosure navigation, focus, asynchronous request state and reduced-motion control. Sheets disable whole-surface press expansion; inner native controls provide their own response.
- Chromium can use the upstream live backdrop displacement. Other engines use the upstream CSS blur/highlight fallback because this app's background is a live WebGL canvas, not a static image.

Original material adoption: governance/STATE.md stage2.5.6 and DESIGN.md revision27. Revision27 adapts reading haze at the whole-shell level and adds a glass appearance radio group; the vendor engine remains unchanged. The application-level transparency control uses this snapshot's existing setFog API without changing the vendor engine. This snapshot does not assert native Apple optical fidelity or independent cross-browser performance qualification.


Stage2.5.15 / design revision34 (2026-11-11): the local adapter now reads supported uniform computed corner shapes. New corner-geometry.mjs retains the exact original circular branch and extends the contour/normal to CSS superellipse exponent2^K. Optical map cache keys include shape and fractional radius. Bevel depth uses a first-order distance approximation; at the adopted K1.5/radius35.2/bevel20, dense sampled checks differ from Euclidean distance by at most0.451px (not a global bound). CSS optical layers inherit the parent contour in reading-sheets.css. No upstream files or runtime dependencies change. Current verification and fallback limits: docs/design/stage2.5.15/README.md.
