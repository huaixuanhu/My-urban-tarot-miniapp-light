# stage2.4.1 — light/dark concept evidence

Derived from **governance/STATE.md stage2.4.1**. Scope: concept-comparison evidence and prompt records only. This is not a second plan or an implemented design. STATE.md owns current sequence and authority; DESIGN.md owns the candidate visual rules.

Date: 2026-10-25. Status: two concepts produced; the user selected coexisting day/light and night/dark modes after viewing them. Functional checkpoint 3 is local commit `31160c9f`; these concepts and subsequent planning are outside that commit. The runnable prototype remains unchanged.

## Source and method

The user's three supplied images contribute fluid-glass/ethereal material, minimal text and an open continuous space. Their layouts and replacement card art are not specifications. The user explicitly chose to compare light and dark directions and retain the existing Urban Tarot card images.

Built-in imagegen used the repository's `client/public/images/cards/The_Star.webp` and `The_Sun.webp` as reference images. Two independent first drafts were followed by one edit each to remove plants, candles and other extraneous props and attempt to contain the source fan. Original deck assets are unmodified. Full initial and refinement prompts are in [prompts.json](prompts.json).

Final local evidence:

- [Moon-white concept](light-concept.png): generated source `exec-81e07c38-9513-4db6-b15f-2e0baa169202.png`.
- [Smoke-black concept](dark-concept.png): generated source `exec-69703c29-1547-4c57-b847-698544f7e5e8.png`.

The user subsequently requested retaining the feeling of the third/fourth generated images, understood as this later refined pair, with no leaves. This accepts the broad material/lighting direction, not the generated layout or card artwork. Decorative foliage and plant shadows are excluded from the surrounding interface; existing source card art remains unchanged.

Original generated files remain in `/Users/anoria/.codex/generated_images/01a16807-c7ca-7d32-acb4-419e05685784/`. These two files are project-owned copies. Rejected first drafts are not project deliverables.

## Comparison and critique

| Direction | Useful qualities | What still needs refinement |
| --- | --- | --- |
| Moon-white | Quiet pale ground, readable dark labels, softly colored glass edge, closest to the requested lightness | Source fan still clipped despite the refinement instruction; outer glass arc is prominent; selected-card glow is too continuous; card-back linework is busy |
| Smoke-black | Clear separation from colorful faces, compact controls, stronger localized ritual lighting; source fan is contained | Warm light and large rim can become heavy or luxurious; pale backs dominate the lower region; surface texture is more photographic than necessary |

Proposed starting recommendation: moon-white for the requested ethereal lightness, with a quieter edge, restrained contact shadows and a compact control dock. This was an agent recommendation before the user selected both modes. The accepted broad direction is now one shared interface with day/light and night/dark appearance; neither generated layout is an implementation template.

Both concepts duplicate the Meaning action between the dock and margin. Actual UI should give it one clear primary location. Settings icons are illustrative; retained view, undo and keyboard utilities need a discoverable implementation. The comparison shows the same semantic state, but generated camera angle, card size and spacing differ, so this is not a controlled layout comparison. No placement, card-back motif, caption, typography or exact spacing is approved by these images.

## Evidence limits

These are generated styleframes, not browser screenshots. Referenced card artwork has been re-rendered by the image model and is not pixel-identical to the source. Implementation must continue loading the original 78 files directly. No generated card image replaces a source asset.

Card counts, orientations, labels, picking targets and arrangement are illustrative. Images cannot establish motion quality, real-time optical effects, performance, readability during camera movement, keyboard access or reduced discomfort. No contrast conformance is claimed from this image review. UI work must preserve the accepted finite placement area, physical card motions, known identity/orientation and recoverable camera behavior.

Future implementation and review sequencing remains solely in STATE.md stage2.4.2–stage2.4.4. Question recording and overall-flow work remain later in stage2.5.
