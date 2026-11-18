# Local interaction refinement

Derived from governance/STATE.md stage2.5.16 and accepted DESIGN.md revision35. This child owns diagnosis/rendered verification evidence for shuffle feedback, camera/card drag continuity and current-record prefill/success clarity. STATE.md owns scope/authority; DESIGN.md remains the sole design owner. The user requests local preview before acceptance; no commit, push, deployment, real provider call or hosted-data mutation.

The owner accepted the locally verified revision36 interactions on 2026-11-19 as part of revision40. Local diagnosis and browser evidence follow. Production verification belongs to docs/release/stage2.5.17/README.md.

## Findings and changes

1. Shuffle preparation already had a status-line message, but the main button kept its idle label and disabled opacity. It now keeps stable icon/text nodes, shows a14px spinner and正在洗牌 immediately through network preparation and animation, and uses a legible busy state. Reduced motion retains a static indicator. Prior notices cannot obscure the busy status. Duplicate protection, prepared-deck recovery and random requests are unchanged.
2. The old cancelDrag restored a camera gesture's startView and discarded card previews on pointercancel, lostpointercapture, ResizeObserver and visibility interruption. Source execution reproduced camera yaw/elevation reverting from0.7/1.1 to0/0.74. An unbounded preview could also reachx6.75 before release clamped tox6.6. The new small gesture helper retains current camera position, settles interrupted existing cards at the last valid preview, skips unchanged resize notifications and applies the release bounds to previews. Grab offsets, card identity/reversal, reveal and undo are preserved. Escape still cancels deliberately; invalid releases still reject; interrupted deck previews never draw a card.
3. The AI and record question/position fields already shared one draft; source inspection did not establish lost field synchronization. The presentation obscured included content, and successful saves left the editor open. The revised draft visibly includes a compact original-card spread and selected matching AI content before human notes. Success renders the returned canonical record, with已保存,返回记录 and补充记录. Reopening an unchanged round returns that receipt. Supplementing creates a new record; originals remain unchanged. History retains time/title rows. AI signature matching and uncertain same-ID retry snapshots are unchanged.

Independent review reproduced two new edge cases before correction: an interrupted full history refresh could reuse abandoned loading content, and receipt-only routing removed access to personal-note editing. Both now have failing-before/passing-after behavioral regressions. Full refresh clears history readiness; the current receipt provides补充记录. Historical details remain read-only.

## Verification

- Final393-test aggregate, TypeScript, compiled API/access entrypoints, production build and governance structure pass via pnpm check:all. The existing large-bundle warning remains. No dependency changes were needed.
- Eight gesture regressions cover camera interruption/Escape, existing-card continuity/undo, deck cancellation, pointer identity, below-threshold movement, invalid release, matching bounded preview/release and resize handling. Seven new record regressions cover visible prefill, canonical receipt/no extra detail read, unchanged reopen/supplement, navigation races, uncertain save and late AI result handling. Records plus AI UI subset:33 passes.
- Browser used credential-free loopback fixtures only. Main5174: one synthetic collection, one delayed quantum draw, one-card drag/reveal/move, camera drag plus viewport resizing, then a system-random three-card draw/reveal. Two simulated AI completions and three synthetic saves exercised attached content, canonical success, supplement-as-new, history and current-receipt reopen. Readback verifies two distinct three-card records, equal card/AI content and unchanged original empty reflection; the supplement retains its new reflection. Three seeded plus three new records remain in memory for preview.
- A12second synthetic draw delay visibly showed disabled正在洗牌, aria-busy=true, opacity1 and the spinning animation. Isolated empty-pool5175 repeated the wait at390px with reduced motion, animation=none, then showed the existing inventory error and restored enabled开始/aria-busy=false. Each fixture observed exactly one draw request; externalCalls=0. The isolated server was stopped;5174 remains available with1.5second simulated draw latency for inspection.
- Desktop and390×844 day/night form/receipt displays pass. Mobile page/form/detail scroll widths equal their available widths. Current question, three labels and one selected AI attachment are visible in DOM readback. Main page error log is empty. The final visible page is the saved three-card receipt; return to the table with the close action. Browser viewport override was cleared.
- All115 inherited/frozen hashes match the current-turn baseline. Preserve the65 inherited generated changes. No real provider/cloud access, app-data write, commit, push or deployment occurred.

## Rendered evidence

| State | Capture |
| --- | --- |
| Slow shuffle, desktop | [shuffle-pending-desktop.jpg](shuffle-pending-desktop.jpg) |
| Reduced-motion wait,390px | [shuffle-pending-mobile.jpg](shuffle-pending-mobile.jpg) |
| Failed draw restored,390px | [shuffle-failure-mobile.jpg](shuffle-failure-mobile.jpg) |
| Camera after drag | [camera-drag-desktop.jpg](camera-drag-desktop.jpg) |
| Current content prefilled | [record-prefill-desktop.jpg](record-prefill-desktop.jpg) |
| Selected AI content expanded | [record-attached-ai.jpg](record-attached-ai.jpg) |
| Saved receipt and supplement | [record-saved-desktop.jpg](record-saved-desktop.jpg) |
| Time/title history | [record-history-desktop.jpg](record-history-desktop.jpg) |
|390px day/night receipt | [day](record-saved-mobile-day.jpg), [night](record-saved-mobile-night.jpg) |
|390px night draft | [record-prefill-mobile-night.jpg](record-prefill-mobile-night.jpg) |
| Desktop night receipt | [record-saved-desktop-night.jpg](record-saved-desktop-night.jpg) |

## Limits and continuation

The historical browser/device event that caused the user's intermittent rebound was not captured. Native browser checks cover normal drag/release and resizing after release; forced capture-loss/visibility interruptions during a held drag are qualified by regression tests and source inspection. Physical touch-device and production-network behavior remain unobserved. The existing invalid-drop rule still returns a card to its prior committed position. Drafts remain page-session data; saved records are durable through the real service, while this preview's records are intentionally in-memory. This is local verification, not new hosted qualification or user visual acceptance.

Open http://127.0.0.1:5174/ while the fixture is running. Restart with `pnpm exec tsx scripts/preview-ai.mjs 5174 --records-demo`; restarting clears synthetic saves. No real secrets/providers are required. Future release requires the user's next explicit direction.
