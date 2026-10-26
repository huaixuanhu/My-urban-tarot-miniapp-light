# stage2.4.14.2 — Room defocus research and implementation

Derived from the current authority in [governance/STATE.md](../../../governance/STATE.md), under stage2.4.14. Scope: the room-only rendering pass and its optical verification. This is supporting evidence, not a separate current-state or product plan. Source cottage content, camera correction, glass materials and user acceptance belong to the parent stage.

## Desired result and bounded choice

The user wants the room substantially softer, while the glass table, Urban Tarot faces and controls stay readable. Their phrase “高景深的模糊程度” describes the visual effect of shallow depth of field: the subject stays sharp while the room recedes. This slice uses a deliberately uniform room defocus. It does not claim to simulate a physical lens or true depth of field.

The selected local implementation uses a 12 CSS pixel Gaussian standard deviation on the room texture. Source room rendering stays bounded at 960 × 1200 pixels. The two blur targets follow half the CSS viewport resolution, capped at 480 × 600. A normalized, dense 37-tap kernel is applied horizontally and vertically. Its maximum standard deviation is six blur texels, giving at least three standard deviations of support on each side.

The previous pass used nine samples per axis with a nominal 1.25 CSS pixel setting. Enlarging only those offsets to obtain the requested stronger blur would leave gaps between samples and could show repeated copies of window frames and other sharp edges. The new pass samples adjacent blur texels with positive weights, producing one smooth response. The target dimensions and weights derive from CSS size, so a DPR change does not double or halve the apparent defocus.

## Alternatives checked

The installed Three.js dependency is 0.186.1. Its `BokehPass` renders an extra depth target, then uses the depth-dependent `BokehShader`. The shader makes the blur depend on the difference between view-space depth and the selected focus distance, capped by `maxblur`; it averages 41 offset samples. The [official BokehPass documentation](https://threejs.org/docs/pages/BokehPass.html) describes the focus distance in world units along the camera's viewing direction.

That is appropriate when distance to a chosen focal plane should determine sharpness. Here the intended split is semantic: keep every card readable and soften the room even when some furniture lies at a similar camera depth. A single physical focus plane would not guarantee that split, and applying it to the entire scene could soften cards at oblique camera angles. A separate room depth pass is possible later, but is not necessary to meet this bounded request.

Three's installed `DepthLimitedBlurShader` stops a Gaussian kernel at depth discontinuities, which serves edge-preserving effects such as ambient occlusion. Keeping furniture and window boundaries sharp would work against the requested strong room softness. It was inspected but not adopted.

The [official MeshPhysicalMaterial documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) distinguishes optical transmission from ordinary opacity and recommends environment lighting for physically based materials. Its installed transmission shader samples the already rendered scene. This supports retaining a sharp glass layer over the defocused room, but a larger blur alone cannot supply stronger glass reflections or a clearer rim. Glass contrast is a separate parent-stage change.

## Pipeline contract

1. Only the supplied room group enters the source render target. Cards, the glass table and screen controls remain outside this pass.
2. Source and blur targets retain linear-sRGB half-float color, linear sampling and no mipmaps. The blur shader performs no tone mapping or output color transfer. The main scene remains responsible for the existing final conversion.
3. The source render target keeps its depth buffer. The two blur targets have no depth buffer. Their smaller resolution affects only the deliberately defocused room.
4. Output is cached until camera pose, projection, drawing-buffer size, CSS size or appearance changes. Kernel arrays are recalculated only when their CSS sizing inputs change.
5. Render target, cube face, mip level, clear color/alpha, viewport, scissor and automatic clearing are restored even if any of the three render calls fails. Externally supplied room assets remain externally owned.
6. The existing pass API remains unchanged: `render`, `texture`, `applyAppearance`, `dispose`.

## Depth and camera limitation

The room is ultimately assigned as a flat background texture in the main scene. Its depth buffer is not merged with the table/card depth buffer. Accordingly, increasing this blur does not correct room geometry that intersects the camera or establish depth occlusion between room furniture and the foreground table. The parent investigation identified a close showerhead at the problematic low camera view. That needs a scene/camera correction; this pass must not hide the underlying problem by reporting it as fixed.

## Cost and evidence limits

The implementation still runs one room render and two fullscreen blur passes when invalidated. At a 1440 × 1000 CSS viewport with a source target of 960 × 667, the old two 9-tap passes imply 11,525,760 texture samples; the new two 37-tap passes at 480 × 333 imply 11,828,160. These are source-level sample counts, not measured GPU timings. Compiler behavior, filtering, hardware and room rendering cost can change actual performance. The two blur color targets are approximately one quarter their previous area in this example. Static-camera frames continue to reuse the cached result.

Focused Node verification: **8 tests passed**. New checks cover normalized light-preserving weights, positive monotonic kernel lobes, variance within 3% of the requested spread, a monotonic edge response without overshoot, identical kernels across DPR 1 and 2, and effective 11.8–12 CSS pixel spread across four representative viewport sizes. Existing render isolation, caching and disposal checks remain; failure recovery now covers all three render stages.

Those numerical checks verify the selected kernel and rendering contract, not the user's aesthetic acceptance. The parent stage must run the existing real-GPU eight-case room/glass fixture and inspect day/night, low-angle and overhead views. That fixture separately checks exact foreground artwork/white-patch preservation, screen-glass capture boundaries and render-state restoration. No measured frame-rate or true photographic bokeh claim is made here.
