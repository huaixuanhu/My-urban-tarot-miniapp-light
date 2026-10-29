# stage2.5.10 — glass help and source explanation

Parent and sole current owner: [governance/STATE.md](../../../governance/STATE.md) stage2.5.10, derived from stage2 product reconstruction and continuing stage2.5.9. Scope: the user's2026-10-30 local refinements to 回正, question tips, adjacent randomness explanation and the marked middle engraving band. Design owner: [DESIGN.md](../../../DESIGN.md) revision31. This document records implementation/evidence, not a parallel plan.

## Material and interaction

Reuse the pinned fluid-glass renderer for 回正 and the one shared help surface. Short tips use a medium optical edge with denser reading haze; long explanations use the same thick lens as sheets. Night haze is warm gray; day haze is softly tinted. Both retain a minimum haze at maximum user transparency. Disabled home text fades without flattening the lens or changing camera behavior.

Both source tips add “更多 ↗” after the definition ending in 测量. The adjacent card has static prose, a close button and two official reference links. Desktop placement chooses right then left; narrow layouts place the summary above a scrollable detail. Whole-card pull-out motion uses translation only, with reduced-motion support and a final optical-coordinate refresh. Text remains plain DOM text, including dynamic help strings; no HTML content parsing.

Preserve500ms dwell, pointer gap crossing and click/focus access. Tab enters More from its originating question; Shift+Tab returns. Escape closes detail, summary, then the source sheet. Outside pointer/focus, document scroll, disclosure change and page hiding dismiss; reading/scrolling inside the detail keeps it open. One tip and one detail shell are reused with existing optical layers intact, and pagehide clears listeners/timers. Opening help never acquires/generates/saves or changes a round.

The marked middle band receives a faint broken orbit, two small stars, points and ticks. It remains still, below cards, and uses the same single procedural texture; no asset, picking, camera or gameplay change.

## Source basis

Reviewed2026-10-30:

- [W3C Web Crypto, getRandomValues](https://www.w3.org/TR/webcrypto/#Crypto-method-getRandomValues): cryptographically strong values, typically a cryptographic PRNG initialized from system entropy; browser/OS implementation varies.
- [ANU Quantum Numbers FAQ](https://quantumnumbers.anu.edu.au/faq) and [ANU quantum random number generation research](https://physics.anu.edu.au/research/qst/qoptics/random_numbers.php): optical vacuum-fluctuation measurements converted to numbers and made available through servers/API.
- Local `shared/randomness.mjs`, server inventory/provider path: system mode uses `crypto.getRandomValues`; quantum mode consumes previously collected shared batches. Both use the same rejection-sampled shuffle/order/orientation mapping. Receipt time records application acquisition, not a claim of live laboratory measurement during each shuffle.

Product copy uses natural explanation of those mechanisms; quantum provenance does not imply greater tarot accuracy. Visiting references is an explicit link action. No source fetch is performed when the explanation opens.

## Verification

`pnpm check:all` passed326 tests:15 access,132 gameplay/motion,44 records,65 AI/help and70 random-source tests, plus governance, TypeScript, compiled entrypoints and build. The final source-link semantic-tag repair also passed14 focused help tests and the production build. The inherited chunk-size advisory remains.

Credential-free browser verification covered day/night, default/high-angle engraving, enabled/disabled 回正 and actual return, both source entrances, ordinary inventory help, text clicks, Tab/Shift+Tab, three-layer Escape and internal scrolling. At390×844 the page has no horizontal overflow; at390×600 the summary fits x12/y12/288×100 and the detail fits x12/y124/360×464, with585px scroll content. Internal scrolling reaches121px without closing; reopening resets to0. Both reference links remain displayed. At100%/0% transparency, the day tip's measured haze remains.56/.96; reset returns the default. Final in-app browser warnings/errors are empty.

Chrome's automation transport stopped responding during the last responsive pass. The temporary Chrome test tab was closed; final short-screen/link/scroll checks were completed in the in-app browser, whose viewport override was reset. This is browser verification, not physical-phone, performance or screen-reader qualification. OS reduced-motion styling is present but was not exercised through an OS-setting change. Focused help tests reproduce and guard the discovered prose-click blur bug: clicking nonfocusable text must not close the card, while outside focus still dismisses. Desktop visual review also caught and repaired global footer-style inheritance in the reference links and accidental optical-child styling in 回正.

Current boundaries: no real ANU/OpenAI/Neon request, gate/account/email implementation, push or deployment. Existing65 generated-file hashes are preserved. Local batch commits are authorized; user visual acceptance is pending.

Actual rendered evidence (synthetic banner retained):

- [Middle engraving and home control](night-engraving.png)
- [Final night explanation](night-detail.png)
- [Day source-panel explanation](day-panel-detail.png)
- [Short-screen internal reading](narrow-detail.png)

Fixture counters at closeout: calls0,randomCalls0,attempts0,records0. No test generation/acquisition was dispatched, including synthetic acquisition. The carrying local Git commit is this slice's receipt; no release.
