# Local trial 09 — fixed clear-glass controls

Derived from `governance/STATE.md` stage2.4.8. Scope: implementation and verification evidence for the replacement button treatment only. This is not another plan or design owner; `DESIGN.md` revision 16 owns the candidate. Date: 2026-10-26, Australia/Melbourne.

## Authority and implementation

The user accepted trial 08 except its moving button block, requested a checkpoint and delegated a fixed glass treatment. The position was explicitly confirmed as horizontal center in the lower-middle viewport, close to the concept. Checkpoint 5 is `d496918b`, product baseline `c9e3ff1c`. The new implementation remains a local candidate; its commit is the commit carrying this evidence.

The native 500 × 64 CSS-pixel desktop strip stays upright and fixed through orbit, zoom and reset; narrower windows retain bounded dimensions. Flip/Meaning, Reset, count and Tools occupy stable slots. The old physical mesh is no longer instantiated. Its conservative framing extent remains so the camera does not change in this button-only revision. Camera/view, card-back, scene-style, table-glass, original face/state and motion modules remain unchanged.

`reading-screen-glass.mjs` first renders the accepted scene exactly as before, then copies only the controls’ rectangle plus 24 CSS pixels. A raw screen-space lens samples those already-rendered pixels, with clear central transmission, curved-edge refraction, localized warm/cool reflections and a short shadow. It does not add a whole-scene tone conversion or another full scene render. Native controls above it remain accessible independently of decorative optics. The material is an authored approximation for local review, not a claim of exact concept-image or Apple-renderer reproduction.

## Automated and actual GPU evidence

- `node --test prototypes/shuffle-study/*.test.mjs`: **112 passed, 0 failed**. Six new tests cover CSS-to-framebuffer mapping, DPR/resize, capture bounds, render order, scene-only fallback and disposal/settings preservation.
- Both prototype entries build with `pnpm exec vite build --config prototypes/shuffle-study/reading.vite.config.mjs`.
- `pnpm check:all`: governance, TypeScript, compiled access entrypoint, **15 access regressions**, legacy build passed.
- Real GPU verification via the isolated `reading-screen-glass.verify.html` fixture: **8/8 passed**, across both appearances, DPR 1/2 and two framebuffer sizes. Outside the bounded capture region plus one-pixel margin, all RGBA bytes were identical before/after. Inside the capsule, pixels changed as expected; white unlit reference art and renderer settings were preserved. Exact results: [gpu-verification.json](gpu-verification.json).

The GPU fixture does not load or alter gameplay. These results cover this browser/GPU, not all devices. Existing renderer chunk-size and unset legacy analytics build advisories remain.

## Live application checks

Native browser review exercised three fan drags to chosen positions, button-triggered sideways reveal, optional meaning expansion/collapse and theme switching with the same selected card/orientation/count. Fixed-control bounds remained exactly `{x:390, y:569.609375, width:500, height:64}` at the 1280 × 720 viewport before and after substantial orbit and wheel zoom. Tools and Restore View stayed available. Reset and Skip returned to a fresh fan; the normal full reset also completed.

Actual screenshots were reviewed at 1280 × 720, 1440 × 1000 and 1024 × 768 desktop sizes. Utility popovers remained screen-aligned and usable. Temporary viewport overrides were reset. Browser warning/error log was empty after checks.

- [Day runtime](light-runtime.png)
- [Night runtime](dark-runtime.png)

Screenshots are actual app captures at 1440 × 1000 with the same reading state. The clear lens intentionally lets underlying table/card content remain visible; close-up objects may pass behind the fixed controls. No phone gameplay, measured frame rate, cross-browser optics or final visual acceptance is claimed.

## Preservation

The 65 pre-existing generated/local changes remain byte-identical to the entry snapshot and outside this commit. No original card assets/data, access protection, accepted camera/table/material/motion code, root dependency declarations or deployment configuration changed. No dependencies, paid service or Blender asset were added. No push or deployment occurred. Continue through `governance/STATE.md`.
