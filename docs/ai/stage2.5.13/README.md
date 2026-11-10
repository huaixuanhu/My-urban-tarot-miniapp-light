# Local interpretation and history refinement

Derived from governance/STATE.md stage2.5.13 (2026-11-09). This child owns implementation evidence and interface contracts for the accepted local three-part refinement; STATE.md remains the scope/status authority. It does not authorize deployment, actual paid calls, accounts or cloud-data changes.

## Accepted behavior

- Direct prose states observations, conditions and useful questions without inventing counterarguments. Negative findings and factual uncertainty remain expressible. User-supplied private reading text is not copied into tracked fixtures.
- A per-generation live-check checkbox defaults off. When on, one Responses request includes live web search with required tool use and a bounded tool-call allowance. Only provider tool output establishes search execution; the text alone cannot do so. Factual findings have linked sources and distinguish supported, disputed and uncertain. Failure is visible and causes no paid automatic retry.
- Current time and a validated time zone contextualize relative dates. Search queries should use only necessary public terms; page contents are untrusted evidence, not instructions. Original Urban Tarot supplied meanings remain authoritative.
- Records open on saved-time/short-title rows, latest first. Titles derive deterministically from the original question for old-record compatibility; full question remains in detail. Saving the current reading has an explicit separate entry. Detail preserves spatial arrangement, human notes, all AI results and export; original source detail is secondary.
- Existing authorized accounts continue sharing records. Future account/guest presentation can supply a different access context, but server authorization owns actual list/detail/AI/save/export permissions. No browser filter is claimed as isolation. Guest integration offers a truthful not-yet-connected login entry; persistent guest history is undecided.

## Design and verification contract

Extend accepted revision32 in DESIGN.md with the same glass shell/material, native controls and readable continuous content. Desktop pointer/keyboard and existing390px narrow layout are supported. Verify selected/focus/disabled, empty/loading/error/success, long titles, returning to list and pending-draft continuity. No scene or card-art change. Cross-project design preferences were read; the accepted project material/corners remain controlling and no corner redesign is needed.

Nonessential interface explanations use the existing contextual question-mark help: per-card basis, actual usage, quantum receipt details and guest-session rules. Factual findings, uncertainty labels, linked sources, costs and actionable errors stay visible. The local banner is reduced to “本地预览 · 模拟数据”.

## Official sources inspected 2026-11-09

- https://developers.openai.com/api/docs/guides/tools-web-search — web_search, live access, required tool choice, provider output and visible source citations.
- https://developers.openai.com/api/docs/models/gpt-6.1-sol — web-search/structured-output capability.
- https://developers.openai.com/api/docs/models/gpt-6.1-terra — web-search/structured-output capability.
- https://developers.openai.com/api/docs/pricing — search US$10/1,000 calls, plus search-content tokens at model rates. Application estimates are not invoices; one generation may include multiple searches.

## Evidence

Local implementation complete; user visual acceptance pending. `pnpm check:all` passes370 tests (access15, reading132, records55, AI98, randomness70), governance, TypeScript, compiled runtime guards and build after the final status-copy and scoped help-disposal refinements. The existing large-bundle build warning remains. A direct `node --test` invocation of the server test lacked the project's TypeScript resolver; the supported `pnpm test:ai` command passed. `git diff --check` is clean. All80 protected hashes (65 inherited generated changes plus15 frozen evidence files) are unchanged.

Observed in the actual local browser at769×966 and390×844:

- Records open as dated title rows, including long and absent questions. Full original question, spread, human notes and both AI versions survive detail navigation; returning restores focus to the originating row.
- Day/night lists and source details fit390px without horizontal overflow. Source links receive keyboard focus. The existing question-mark surface displays source basis/usage explanations; Escape closes it and restores focus. Live-check help fits the narrow viewport.
- A slow mock Sol generation with the checkbox on froze submitted settings. Double click dispatched exactly one generation and one mock search. The answer and human note were saved, then recovered through history after a full page refresh.
- A complete seeded two-version record exported through the browser equals the server document, including settings and live-source metadata. The export is ignored local evidence.
- A separate mock with no completed search ended incomplete and showed no answer; metrics remained one generation, zero search dispatches and zero external calls. The visible message was subsequently shortened to “联网核查未完成。再次解读将重新计费。” and the final aggregate including that message passed.
- Guest history exposes the reserved login/record entry with truthful not-connected feedback. Browser use produced no generation, search, randomness operation, attempt or saved record. Unit checks establish zero record list/get/save dispatch for the guest context; this presentation seam adds no server authorization.

Synthetic provider tests also cover failed/empty search, unsafe or unmatched links, source evidence matching, time-zone validation, retrieved-input usage, old offline-request recovery and no automatic retry. Separate read-only reviews found a list pagination race and dynamic help entries retained after answer/detail replacement. Both were fixed with regression checks. Scoped help cleanup now releases active/pending tips before replacing content while preserving other help controls. Browser version-switch and return-to-list checks also pass after the fix. The reviewed final integrated source has no remaining reported blocking finding.

Local commands:

```sh
pnpm exec tsx scripts/preview-ai.mjs 5174 --records-demo
pnpm exec tsx scripts/preview-ai.mjs 5176 --visitor
```

The review preview is at http://127.0.0.1:5174/. It is synthetic, loopback-only and credential-free. Three seeded records are supplied; new local records survive refresh only while this process runs. Restart resets this fixture store. No OpenAI/ANU/Neon call, cloud write, commit, push or deployment occurred. Actual model writing quality, actual exact-model web-search compatibility, external fact accuracy and billed charges remain unverified; any actual-model test requires a separately accepted bounded sample and budget. No test is queued. Frozen stage2.5.11 examples remain unchanged.

Evidence files: `.local/stage2.5.13/` contains the complete aggregate/focused logs, metrics, export and preservation receipts. Screenshots below contain synthetic examples only:

- [Desktop record list](screenshots/records-day-desktop.jpg), [full-question detail](screenshots/detail-day-desktop.jpg), [linked sources](screenshots/sources-day-desktop.jpg).
- [Mobile day list](screenshots/records-day-mobile.jpg), [mobile night list](screenshots/records-night-mobile.jpg), [mobile source result](screenshots/sources-night-mobile.jpg).
- [Live option](screenshots/ai-option-day-desktop.jpg), [mobile live help](screenshots/ai-help-day-mobile.jpg), [card-source help](screenshots/source-help-day-desktop.jpg), [guest entry](screenshots/guest-records-desktop.jpg).

## Authorized actual Sol follow-up — stage2.5.13.5

Derived from STATE.md stage2.5.13.5; this extends the preceding synthetic-only snapshot under the user's later explicit one-call instruction. One real gpt-6.1-sol request used the supplied private question and four-card reading, standard/general/low with6000 output allowance, live search on and Australia/Melbourne time. Coordinates are schematic left/right and ordering follows the supplied presentation; original coordinates/cap were unavailable. User text and all request/response/answer evidence remain ignored under `.local/stage2.5.13-sol-live-20261109/`. No private question or result is copied into tracked examples.

Completed in49.2seconds. Exactly1 input count and1 generation;1 completed search with3 queries, then1 completed page open. Strict output/source checks passed;5 fact checks and4 cards preserved. GET/replay dispatched no additional call. Input23937/output2330 tokens, including6945 cache-write and187 reasoning tokens; estimatedUSD0.08–0.10 including search/open fee uncertainty, not billed reconciliation. Official Standard Sol rates inspected2026-11-09: inputUSD2/cache read0.10/cache write2.50/output10 per million tokens; webUSD0.01 per call plus retrieved input. Full-text delivery and source/preserved-file hashes pass.

Observed quality is mixed. Target negative contrast phrases have disappeared; repetitive inability statements remain in the summary, one card and supplemental limitations. The model adds an unasked factual premise and embeds Markdown citations inside plain-text finding fields, which would show literal syntax and duplicate the dedicated source links. Independent read-only review confirms these observations. Broader source accuracy and tone acceptance remain separate from tool execution; the user will inspect the complete unedited text before further prompt work. This trial does not change application source, release, cloud records or inventories. No further real call is scheduled.

## Prompt-v2 follow-up — stage2.5.13.6

Derived from STATE.md stage2.5.13.6 and frozen stage2.5.13.5 evidence. The user requests a local correction and exactly one new Sol live run with the same question. Prompt-only v2 replaces standalone inability disclaimers with specific conditions, quotes complete original premises without strengthening their degree/negation/time, and confines added background to findings. Relevant uncertainty and unfavorable evidence remain explicit. Existing schema and provider behavior remain unchanged; no destructive output rewriting or automatic regeneration is introduced. All370 aggregate tests, runtime/build/governance checks pass. Independent pre-dispatch review reports no blocking conflict.

The private runner compares the complete provider payload with the frozen first run: only instructions and actual currentTime may differ. Model, settings, schema/tools, question, four cards, canonical meanings and schematic placement match before dispatch. Preserve the complete prior evidence; new private artifacts live at `.local/stage2.5.13-sol-live-v2-20261109/` (prepared November9, executed after local midnight November10). This time change affects relative dates and new search evidence; it is recorded separately from the prompt comparison.

Completed2026-11-10 at00:01 Australia/Melbourne in47.2seconds. Exactly1 count and1 actual gpt-6.1-sol generation,1 completed search containing3 queries and1 completed page open. All3 fact checks and4 cards retained; recovery dispatched zero calls. Input24439/output2132 tokens, including7406 cache-write and208 reasoning tokens. Token estimateUSD0.073901; including one or two web-tool feesUSD0.083901–0.093901, not an invoice reconciliation. Complete raw/provider/validated output and unchanged reader-facing text remain private. All16 frozen previous-evaluation files,6 evaluated source files and80 inherited/frozen files match their hashes.

Quality review is mixed and explicit: inability wording falls from5 occurrences to0; all3 claim titles quote original spans, and the invented standalone premise is removed. The summary and one finding still introduce a stronger degree criterion than the original premise. One composite claim is marked supported despite correcting its date qualifier. All3 findings retain inline Markdown citations against the prompt's plain-text rule; some practical conditions repeat. Independent read-only review confirms these observations. Official source documents and indexed/attributed reporting support the reviewed event and historical-price details; that does not establish complete factual accuracy. This single sample supports a tone improvement while leaving premise fidelity, status granularity and citation formatting open for user review. No output rewriting, extra generation or deployment followed.

## Acceptance and release handoff — 2026-11-10

The user accepted the current v2 result and requested full release/closeout. Current release authority and status are STATE.md stage2.5.13.7; receipts are in docs/release/stage2.5.13/README.md. This supersedes the earlier local-only/acceptance-pending snapshot for publication, while retaining all historical evidence and acknowledged quality limits. No additional prompt change or real model test is scheduled.
