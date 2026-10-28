# stage2.5.4 — optional AI interpretation, local verification

Parent and current-state authority: `governance/STATE.md`, stage2.5.4. Bounded scope: user-invoked interpretation with user-written questions, two models, reasoning/token choices, separate AI results and optional shared-record attachment. This evidence document does not create another current plan. Date:2026-10-29.

## Implemented contract

- More → AI解读 reuses the current glass sheets. Questions and optional position labels share the record draft. Source art, room, camera, shuffle, reveal and access membership are unchanged.
- Only explicit Generate makes a paid request. Models are exactly `gpt-6.1-terra` / `gpt-6.1-sol`; strengths low/medium/high; output presets3,000/6,000/12,000 and custom integer cap. Strength minima are1,000/3,000/6,000; maximum12,000. Canonical input is counted first and capped at10,000. Output allowance includes reasoning and visible answer; input is separate. Broad USD hints are advisory and do not promise a particular charge or quality level.
- User writes the question. Server instructions provide a source-grounded analysis framework, without manufacturing a question, forcing a conclusion or prescribing a fixed-duration action plan. Free placement has no invented past/present/future semantics. Original card data has no separate reversed meanings; reversal interpretation is visibly labelled as an extension.
- The server verifies the existing Cloudflare signature/claims and same-origin JSON writes, rebuilds original facts and validates the response against the exact submitted cards/orientation/labels. API keys and database credentials remain server-only. Direct official Responses API, `store:false`, no tools, redirects, model fallback or automatic retries.
- A durable UUID claim precedes provider work. A unique database key handles concurrent attempts; a payload hash rejects reuse with changed content. Replays and GETs never generate. Terminal writes require pending status and matching hash. Count timeout25s plus generation115s leave headroom within the180s server duration.
- Completed/incomplete/failed/unknown are distinct. Uncertain outcomes retain the original request ID for read-only lookup. Even GET404 stays unknown because a slow original POST might not have claimed its ID yet. Opening/closing, editing, polling state and appearance changes never generate. There is no automatic polling loop.
- The UI locks submissions/recovery while in flight. Repeated generation requires a fee confirmation, including an extra uncertainty warning if an earlier result is unknown. Unknown requests may be explicitly retained while continuing; their lookup survives table reset within the page. Closing/reloading loses this unsaved lookup handle, with a leave warning. Cross-refresh draft/attempt recovery is not implemented.
- AI results remain separate from human notes. Semantic edits mark old answers stale; camera and selection-only stacking do not. Saving sends only selected result IDs, and the server accepts only matching completed canonical results. Old records remain compatible. A new result arriving during record saving remains unsaved rather than being silently cleared.

## Offline and local evidence

`pnpm check:all` passed: governance structure, TypeScript, compiled access/records/AI runtime probes,15 access +129 motion/application +40 records +49 AI tests =233 automated tests, and production build. The inherited large-JavaScript-chunk warning remains; no new dependency or package installation was needed. Governance structure is not user acceptance.

Specific regressions cover auth/origin/body limits, hidden or forged cards, settings bounds, concurrency/replay, changed-payload conflicts, truncation/refusal/invalid output, unknown provider outcomes, failed result persistence, canonical record association, safe text rendering, late callbacks, staleness, and saving while AI completes. Independent review caught and repaired GET404 recovery, camelCase usage display, and the save-completion race. Subsequent review found no further blocking issue.

The user's rapid-click concern is explicitly exercised:20 immediate submits produce one POST;20 recovery clicks produce one GET and no new POST. Pending requests reject further submits. Server concurrency and later replay tests generate once. A fast completed answer followed by another click prompts before any new paid attempt.

Both migrations were applied only to a new isolated temporary local PostgreSQL cluster. The probe verified DDL, one-row duplicate claim behavior, rejection of missing/null identity fields, successful pending→completed write and rejection of terminal overwrite. The cluster was stopped afterward. This validates local PostgreSQL behavior, not a live Neon adapter connection or production migration. Existing production data was never read or changed for this feature.

The loopback-only `pnpm dev:ai-preview` uses synthetic signing keys, in-memory records and a mock provider, and shows a visible no-charge/no-cloud banner. Actual browser checks at1440×1000 and390×844 exercised empty/readiness state, shared question/labels, three-card draw/reveal, model/strength/custom cap, invalid-budget disabled state, in-flight locks, completed result, separate personal-note/AI save, refresh/history/detail, JSON export, stale-question warning, Escape focus restoration and reduced motion. Simulated unknown response disabled new generation; querying and attempting reset kept the original request and did not increase the provider counter. Explicit continuation retained the old lookup. Day/night layouts were inspected; rendered design still awaits user acceptance, and these checks do not establish real-phone gameplay or formal accessibility conformance. Browser screenshot text was visibly soft in later captures; DOM/style checks found no content blur filter, so screenshots alone do not establish final text raster quality.

The browser fixture produced no real AI charges and wrote no cloud data. Its exported synthetic record contains separate personal interpretation and one AI result. Files under `screenshots/` show the labelled fixture, not production or real AI output.

## Real model validation

The separately disclosed ceiling was six synthetic generations and USD1. The exact product handler/prompt/provider was exercised using local identity signing and memory storage, with only the original synthetic question and canonical card metadata sent to OpenAI. No user saved readings, private questions, images or database rows were sent. A setup-only authentication probe was rejected before any provider call; after correcting the synthetic identity, all six planned calls completed without retry.

| Model | Strength | Cap | Returned input/output | Full elapsed seconds |
|---|---|---:|---:|---:|
| 6.1 Terra | low | 3,000 | 1,026 /705 |12.1|
| 6.1 Terra | medium |6,000 |1,026 /616 |8.8|
| 6.1 Terra | high |12,000 |1,026 /762 |10.5|
| 6.1 Sol |low |3,000 |1,026 /929 |21.8|
| 6.1 Sol |medium |6,000 |1,026 /970 |17.8|
| 6.1 Sol |high |12,000 |1,026 /1,157 |29.0|

Each passed complete structured-answer validation, exact card order/orientation/labels and reversal-extension attribution. Querying and replaying each original request did not increase generation count. All six used less than their cap; this small synthetic test is not a quality ranking or latency benchmark. Estimated total at the published standard token rates:USD0.050209, not a reconciled billing charge. Conservative reservations totaledUSD0.63; unknown calls would retain their reservation. Sanitized usage is in `live-validation.json`; raw synthetic outputs and ledger remain ignored in `.local/ai-opt-in-live-2026-10-29-validated/`. The previous comparison scripts, prompts and reports were not changed.

Official API references checked: [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [token counting](https://developers.openai.com/api/docs/guides/token-counting), [reasoning budgets](https://developers.openai.com/api/docs/guides/reasoning). Reasoning is included in generated output usage; a cap can stop an answer before completion. The UI uses broad ranges as requested, rather than this report's test-specific estimate.

## Release boundary and continuation

Local implementation only. No commit, push, production secret setup, production migration or deployment was performed. `server/ai/002-create-interpretations.sql` must be applied to the dedicated Augurwell database in an authorized release; configure the official API key only on the server, then deploy and verify authenticated browser→API→Neon save/readback with synthetic data and access-denial probes. Never claim the local mock is a live cloud reading.

All65 inherited `.DS_Store`/generated dependency changes and all10 frozen comparison files were rehashed unchanged. The original credential remains in its ignored owner-only file and was loaded in memory without printing or copying it. No access policy or sibling project changed. Current acceptance/authority remains in `governance/STATE.md`.


## stage2.5.4.4 — quieter sheets and contextual help

Derived from governance/STATE.md stage2.5.4.4 and DESIGN.md revision23. The user's2026-10-29 screenshots request less explanatory copy, with useful guidance behind delayed question marks. More entry subtitles and permanent gesture instructions are removed. AI introduction, repetitive readiness/budget/disclosure paragraphs are replaced by title/setting help; the concise cost interval remains visible. Record introduction is likewise moved to title help. No request/storage/security logic was changed.

Verification: seven focused help tests cover500ms dwell versus a brief pass, safe text, pointer transfer, keyboard/Escape, click/touch fallback, one popup/viewport clamping, pending timer cancellation and disposal. Existing AI burst/dedup/unknown/fee-confirmation tests remain included. Final aggregate:15access +129application +40records +56AI =240tests, plus governance, TypeScript, compiled runtime probes and build. The pre-existing bundle warning remains. Independent review caught a pagehide cleanup binding outside its scope; root removed the local binding and uses document-wide disposal. Final review found no further actionable issue.

Actual local browser: More → AI, draw/reveal, editable question, optional labels and shared record draft work after reduction. Help click/keyboard opening and first-Escape-only dismissal were observed. Default1280×720 daytime shows the full one-card primary action after tightening spacing; night More and390×844 help were visually inspected. Narrow popup bounds were x12–300/y540–629 within390×844; no horizontal page overflow. Browser warning/error log was empty. Pure pointer dwell timing and pointer transfer were exercised by deterministic tests, not measured with a physical mouse. Native mobile hardware and screen-reader output were not tested.

Screenshots: [day AI](quiet-ai-day.jpg), [day help](quiet-help-day.jpg), [night More](quiet-more-night.jpg), [narrow help](quiet-ai-narrow.jpg). The visible yellow banner identifies the isolated mock preview. The old tab retained stale content despite reload attempts, so validation used a fresh background local tab; that latest preview was kept for the user. Original tab was not closed.

No paid calls: preview counters remained3calls/3attempts/1record; no Generate or Save was pressed this slice. All65 inherited generated files and10 frozen comparison artifacts retain their hashes. No commit, push, deployment, credential or database change.

Interaction reference: [WAI-ARIA APG tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) for focus retention, Escape and hoverable help; the page labels its pattern work in progress. This is design guidance, not a claim of formal accessibility conformance.


## stage2.5.4.5 — local checkpoint acceptance

The user accepted the current local framework/UI and requested a local commit on2026-10-29, then continuation in the next conversation. The commit carrying this note records the checkpoint; earlier no-commit statements above describe the verification slices before this request. No publication or production activation is included. Current continuation and next authority remain exclusively in governance/STATE.md.
