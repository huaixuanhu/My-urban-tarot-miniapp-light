# Glass model and effort control

Derived from governance/STATE.md stage2.5.17 and DESIGN.md accepted revision35 plus local revision36. This child owns the supplied-reference comparison and local interaction/render evidence; STATE.md owns scope and DESIGN.md remains the design owner.

The owner accepted revision40 and the retained stage2.5.16 interactions on 2026-11-19. The sections below record the local iterations and their verification. Production verification belongs to docs/release/stage2.5.17/README.md.

## stage2.5.17.3 — opening motion and dragging

Derived from STATE.md stage2.5.17.3 and DESIGN.md revision40. [Recorded model control opening](model-control-opening.gif) and [moved AI sheet](moved-ai-sheet.jpg) were captured in the local browser. The animation is cropped around the control, with pauses on the first and last frames for viewing.

In the synthetic local app a drag of 99px right and 50px down moved the AI sheet by exactly those amounts. A mouse drag selected eight characters in the question, and a range drag selected 深入 with the sheet still at the same offset. Reopening reset its position. Narrowing the viewport to 390px kept the 366px sheet visible. The browser showed the sheet opening from the entry, reversing on Escape and opening immediately with 减少动态 enabled. The small overlay retained its position relative to the moved row and the live-check row stayed at the same height throughout opening. The native closing animation was tested in the local Chromium-based browser. Other engines use their supported CSS features, with an opening-only fallback where the native closing transition is unavailable.

All 401 tests and the production build passed. The two new regressions cover drag identity, bounds, text and native input exclusions. Independent review identified the interrupted entrance issue, which was corrected by reversing the in-flight animation. Browser error log was empty and all fixture request counters were zero. The earlier protected file digests match. Local user review is pending.

## stage2.5.17.2 — small floating panel

Derived from STATE.md stage2.5.17.2. User feedback rejects the large inline expansion and requests a smaller overlay above the row. Revision39 replaces that geometry with an anchored280×160.6px panel,8px above the summary. It chooses below when needed and caps its height to the visible scroll area, with internal scrolling. The panel reuses the contextual-help glass haze and direct backdrop blur to suppress underlying text while retaining FluidGlass edge layers and compactK1.5. Native model/range, current-value summary, help, budget and request locks stay unchanged.

Local verification:399 aggregate tests/types/runtime/build pass, including21 controller UI tests and added above/below/short-space regression coverage; only the existing large-bundle warning remains. Independent review found no blocker after checking scroll clipping, post-placement material refresh and focus return. At1280×900, form height531.883px, live-row top437.406px, content scroll height564px and scroll offset0 remain identical before/after open. At390×844, live-row top424.789px, scroll height560px and offset0 remain identical; page width/scroll width both390px. Native pointer opening near the top edge at390×480 selects below, stays within the sheet and retains scroll offset222px; native Tab navigation reaches the range and ArrowRight changes the strength while the overlay stays open. The preceding locator automation had centered the trigger; it is excluded from the native edge-placement result. An80px capped overlay was also observed; full touch-device qualification remains outside evidence.

Scroll/resize dismiss the overlay, Escape restores summary focus, reopening retains Sol/medium/6000, and optical readback reports one lens andK1.5. Final page error log is empty. All115 inherited/frozen and8 prior-slice source hashes match. Fixture counters remain the previous1 simulated AI call,3 seeded records,0 searches/random calls/draws/external calls; no new generation or save. The local tab remains visible with default-collapsed settings after restoring its normal viewport. No commit, push or deployment.

| Floating state | Capture |
| --- | --- |
| Desktop day/night | [day](floating-desktop-day.jpg), [night](floating-desktop-night.jpg) |
|390px day/night | [day](floating-mobile-day.jpg), [night](floating-mobile-night.jpg) |
| Short viewport, below placement and keyboard focus | [390×480](floating-short-viewport.jpg) |

Raw receipts and supplied screenshot: ignored `.local/stage2.5.17/floating/`. The following inline layouts are retained as superseded comparison evidence.

## stage2.5.17.1 — compact entry refinement

Derived from STATE.md stage2.5.17.1, continuing the same bounded local slice. The user's second reference requests a small current-model/current-effort row at rest. Revision38 replaces the always-visible shell with a native collapsed disclosure; activating the summary reveals the same glass control inline, within the sheet scroll area. Choosing settings updates the summary and closing retains those choices. Outside click or leaving the AI sheet collapses it; Escape closes contextual help first, then the control, then the sheet. A native toggle hook refreshes the nested glass only after its bounds become measurable. The summary remains available while request-locked controls can be inspected. No new explanatory text, provider operation or settings contract is introduced.

Verification:398 aggregate tests (20 focused AI UI tests), types/runtime checks and build pass; only the inherited bundle-size warning remains. Native click/Enter/Space open the control; model/effort changes synchronize the row and retained budget; Esc closes help, then control, then sheet and restores appropriate focus. Desktop1280×900 and390×844 day/night renders pass; narrow page/content widths match their scroll widths. Nested glass has a measurable optical map, one backdrop lens andK1.5 after reopening. No console errors observed.

Independent review identified a potential layout shift from dismissing on pointerdown/focusin. The reviewed final controller dismisses on click; Tab leaves the native disclosure open. Final loaded-document check confirms Tab focuses live-check with the layout retained, then one click toggles that checkbox and closes the control. Live-check is restored off. Two controller regressions cover summary/retention/no requests and close/focus/listener behavior, including the pre-click stability guard. Existing request-lock/mapping tests remain green. The browser's old tab retained state on two reload attempts; final click behavior was verified in a fresh same-browser local tab, which remains the deliverable. No data or application workaround was used.

All115 protected and8 previous-slice source hashes match. Fixture counts remain1 prior simulated AI call,0 searches,0 random calls/draws,3 seed records and0 external calls; this refinement made no new generation/save. Physical touch and unsupported browsers remain outside evidence. Prior rendered evidence below describes the initial expanded implementation and remains historical.

| Refined state | Capture |
| --- | --- |
| Default compact desktop | [day](collapsed-desktop-day.jpg) |
| Expanded desktop glass | [day](expanded-desktop-day.jpg), [night](expanded-desktop-night.jpg) |
|390px compact | [day](collapsed-mobile-day.jpg), [night](collapsed-mobile-night.jpg) |
|390px expanded | [day](expanded-mobile-day.jpg), [night](expanded-mobile-night.jpg) |

Source/view hierarchy stays identical across the final click-dismissal correction; final desktop compact/night and click/Tab checks use the fresh document. The earlier refined screenshots retain an illustrative local question; no AI response was requested. Raw current-refinement receipts are in ignored `.local/stage2.5.17/collapsed/`.

## Reference and design decision

The supplied Codex image groups a prominent current effort, clickable model row and wide slider. Adopt that relationship within the AI form, with the actual Terra/Sol and轻量/标准/深入 options. Keep native model selection and range semantics. The app's warm/dark glass tokens, mid-tier refraction and pearl thumb replace the screenshot's purple decoration. A compact reset restores low/3000 while retaining the selected model. Budget stays in高级; explanations stay in help.

The new shell uses the existing FluidGlass engine, not a separate optical implementation. The sheet's existing prepare hook now scans nested glass before updating the parent; repeated reopening retains one lens layer. Its computed K1.5/27.2px shape follows the accepted compact role, with17px ordinary fallback; native slider track/handle are pill/circle geometry. No vendor source, dependency, backend contract or model inventory changed.

Before/after at1280×900: the old form separated model selection from effort under高级; the revised form exposes their relationship in one control. The old screenshot retains the earlier three-card synthetic spread while the new final screenshot has one card, so this is a control/hierarchy comparison, not a pixel-aligned spread comparison. Reviewer judgment: current effort and model read together, and neutral haze/pearl styling stays consistent with the surrounding sheet.390px screenshots retain the two detail/focus fields and the same control hierarchy without horizontal overflow.

## Behavior and verification

- `pnpm check:all`:396 tests pass, TypeScript and compiled API/access checks pass, build succeeds with the existing large-bundle warning. Three new controller regressions cover all effort mappings, default reset/model retention, and unresolved/save locks. Focused AI UI suite:18 passes. Independent read-only review found no blocker.
- Native keyboard Home/End/ArrowRight/ArrowLeft and pointer drag select all three positions. Readback confirms0/1/2 map tolow/medium/high and3000/6000/12000; visible Chinese output and aria-valuetext agree. Model changes preserve effort/budget. Reset returns low/3000 and keeps Sol. Settings interactions produced zero fixture calls.
- One explicit slow synthetic response verifies the actual form payload and locked model/range/reset state during generation. After completion all controls unlock; returned metadata shows6.1 Sol / 计算·标准 /6000budget in the frozen request. Later slider changes preserve the original result metadata. This is a mock response, not an actual model evaluation.
- Browser checks at1280×900 and390×844 cover day/night, selected/focused/default/reset/disabled/completed states and contextual placement. The mobile page width and scroll width are both390; the AI content width/scroll width are both366. Actual nested material reportsbackdrop, one lens andsuperellipse(1.5). Main page error log is empty. A temporary browser approval-check timeout recovered on its permitted retry; it did not require a workaround.
- All115 inherited/frozen hashes and8 stage2.5.16 implementation/test/fixture hashes match the fresh task baseline. Existing local fixes and their evidence remain intact. The preview fixture reports1 simulated AI call,0 searches,0 random calls/draws,3 seeded records and0 external calls; no new record was saved.

## Rendered evidence

| State | Capture |
| --- | --- |
| Earlier model/Advanced layout | [before-desktop.jpg](before-desktop.jpg) |
| Initial inline daytime control | [desktop-day.jpg](desktop-day.jpg) |
| Sol/high and keyboard focus | [desktop-sol-high.jpg](desktop-sol-high.jpg) |
| Pending request | [pending-desktop.jpg](pending-desktop.jpg) |
|390px keyboard focus | [mobile-keyboard-focus.jpg](mobile-keyboard-focus.jpg) |
|390px day/night | [day](mobile-day.jpg), [night](mobile-night.jpg) |
| Desktop night | [desktop-night.jpg](desktop-night.jpg) |

The supplied reference and machine receipts remain under ignored `.local/stage2.5.17/`. Physical touch hardware, unsupported-browser fallback rendering and real provider behavior were not newly exercised. Existing native fallback CSS and backend validation remain in place. No optical fidelity beyond the observed local browser is claimed.

## Local continuation

The visible preview remains at http://127.0.0.1:5174/ with the AI sheet open. It uses `pnpm exec tsx scripts/preview-ai.mjs 5174 --records-demo`, in-memory data and no external credentials. The earlier preview process had stopped; it was restarted for this slice, so old synthetic records cleared as designed. Final simulated response mode is restored to normal after the slow-response check. Temporary viewport override is cleared. User review and any commit/release remain separate.
