# stage2.5.12 — private release and closeout

Derived from governance/STATE.md stage2.5.12. This is release evidence and a bounded handoff, not another current-state owner.

## Authorized scope

The user accepted current promptv3 and requested full push/launch, then final verification by Claude Code Opus5.5 Max in the existing tarot conversation. An additional explicit response authorizes official Vercel CLI login and Production-only configuration of the existing OpenAI key. The existing private audience remains. Visitor accounts and broader security engineering are deferred.

Candidate baseline:5dc36324. Previous remote main:b2f7a5f9c3abae515d5eae0d7d84662e7e612f71. Previous READY Production and rollback candidate:dpl_5b4YNZr1a8fz3VzovYL6QUzmJjrZ. Target:my-urban-tarot-miniapp-light, projectprj_zxLDHbvstH5rB2g1u5Gl6DAqwkdE in team_aZlkgVfGEa9rGrdjpshW2KN5; canonicalhttps://augurwell.anoriaquant.dev.

## Preparation

Fresh pnpm check:all passes338 tests plus governance,TypeScript,compiled runtime probes and build. Existing bundle-size advisory remains. Remote main verified with git ls-remote; source audit found no access/proxy/Vercel/provider/Neon-adapter/migration changes in the12 accumulated commits. Existing local generated files are excluded from the release.

Read-only dedicated Neon preflight at2026-11-03T13:08:13.776Z confirms all4 tables, AI primary-key/document constraints,0records,0AIrows,3random operations, poolversion2/cursor155/total1024/remaining869. Private receipt:.local/release-2026-11-04-preflight.json. No migration is necessary. Do not replay002/003.

The Vercel connector can inspect deployments but denied environment-list access. Official CLI fallback initially had no login; user approved the device authorization and Production key setup. After approved email reauthentication, the first CLI attempt could not save its login file inside the sandbox. A scoped elevated retry completed the same official login. At2026-11-03T13:18:25.981360Z the existing OpenAI key was transferred in process memory to Production-only Secret OPENAI_API_KEY; no copied key or secret output was written. The all-environments metadata listing verifies this scope and the existing Neon/ANU entries. Private configuration receipt:.local/release-2026-11-04-env.json. Activation still awaits the next deployment. Claude Code's existing chat is10-29先项目概览, inMy-urban-tarot-miniapp-light, and its selector visibly showsOpus5.5最高. No new review has yet been dispatched.

## Bounded hosted verification

At most2 genuine generations, one exactgpt-6.1-terra and one exactgpt-6.1-sol, low effort,3000 output cap,10000 input cap, Standard service. Use an explicitly synthetic creative question and revealed original card metadata. No raw personal records sent. ExpectedUSD0.01–0.05 total; reserveUSD0.10, batch ceilingUSD0.20, no retry/fallback. Per1M Standard input/output/30m cache-write rates:Terra1/5/1.25,Sol2/10/2.50, verified2026-11-04 at https://developers.openai.com/api/docs/pricing. Usage estimates are separate from invoices.

Verify draw/reveal, selected detail/focus, in-flight lock, real response, one attached shared record, refresh/history readback and unchanged quantum inventory. Retain AI attempt receipts for deduplication; delete only the exact disposable synthetic reading after matching its complete saved content. Existing user records must not be touched. Inspect unknown results without repeating the generation. Check anonymous canonical and direct-origin denial. No ANU acquisition or quantum draw is required.

## Release and review receipts

Pending. Record commit/deployment/configuration identities, observed hosted results, reviewer scope/model, findings and any remaining evidence limits here. Codex is the sole tracked-source writer; Claude Code reviews read-only and may write only an ignored review report.

## Next conversation boundary

Keep current private access until the separate security/visitor plan is agreed. That work must distinguish system-random visitor play from authenticated quantum/AI/shared-record privileges. Existing per-request bounds and UUID deduplication do not implement monthly spend limits, cross-ID throttling or visitor account isolation. Existing refresh loses unsaved AI lookup handles; current source-fidelity/model-quality limits remain in stage2.5.11 evidence. This release does not certify a public deployment or a separate Mimi/physical-device session.
