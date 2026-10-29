# ANU production release receipt

Derived from governance/STATE.md stage2.5.5.4. This document records the bounded release of the reviewed shared quantum pool and accumulated application source to the existing private Augurwell site. STATE.md owns current authority and continuation; LIVE.md retains the distinct local one-call evidence.

## Release boundary

- Reviewed product candidate:677585614fd0a1cfcc7254a930d8d5c00426458d.
- Previous remote main:7e06f02fb7f855f904e29a38b1a149849798030b; its Vercel Git status is successful.
- Existing Vercel project:my-urban-tarot-miniapp-light,prj_zxLDHbvstH5rB2g1u5Gl6DAqwkdE; team:anorias-projects.
- Canonical entry:https://augurwell.anoriaquant.dev. No audience, firewall or origin-identity changes.
- Dedicated Neon project:augurwell-records,late-smoke-78462892; branch:br-rough-cloud-a77fqo3o; database:neondb. Database credentials remain in their existing private locations.
- Main also contains the accepted local AI implementation. Add its empty table for clean unavailable behavior, but do not configure an OpenAI key or call paid generation in this release.
- Cloud quantum inventory starts empty. Do not copy the locally consumed batch or reset its one-request marker. The owner can explicitly acquire through the hosted UI after release.

## Preparation evidence

Read-only database check at2026-10-29T06:48:39.611Z matched the existing dedicated host configuration and confirmed public/neondb,read committed isolation,zero records and absent002/003 tables. The private receipt is.local/anu-production-preflight.json. Both migrations are additive explicit transactions and must be applied only when the complete corresponding schema is absent; partial/unexpected state stops release.

Claude Code (Opus5.5) completed the exact-commit review in the existing tarot conversation: no blocking findings. It independently passed314 aggregate tests,15 local PostgreSQL checks and9 synthetic offline-import/recovery scenarios with zero network attempts. It confirmed unchanged access/proxy/Vercel configuration across the five accumulated commits. The private report.local/anu-release-claude-review.md has SHA-256`06caf63ab70edfa0c6f56c363e68298b29d7d54eaeb0152f776523e030fd2388`. Review did not independently read raw quantum data or exercise hosted login/provider behavior.

At2026-10-29T07:05:50.687Z,002 and003 were committed together in one explicit PostgreSQL transaction after a fresh all-absent check. All three new tables exist; the singleton pool is version0,cursor0,total0,no batch; AI and random operation counts are0. Existing record count remained0; isolation remains read committed. Private migration receipt:.local/anu-production-migration.json. This runtime default is a verified release dependency, not hard-coded in the production adapter.

The authenticated Vercel console confirms `ANU_API_KEY` as a Production-only Secret and the existing Production Neon connection. The all-environments variable listing contains no `OPENAI_API_KEY`. Environment editing used the console because the connector can inspect projects/deployments but denies environment-variable access. No access policy was weakened. Secret values remain outside Git and release evidence.

The reviewed product tree remains unchanged. Release-preparation commit`de7917a1abc8faf02de73f158d1a3e472860400b` adds only authority, architecture and evidence documentation and was pushed successfully; remote main matched it. The final closeout commit carries the hosted evidence below and also changes only documentation/screenshots.

## Publication and hosted verification

Vercel Git deployment`dpl_CnmtCxKcHy7MQfWvrP8AsCXyaCin` is READY,Production,source git,for`de7917a1abc8faf02de73f158d1a3e472860400b`. The canonical domain is attached; unique deployment host is`my-urban-tarot-miniapp-light-rn1nh36vu-anorias-projects.vercel.app`. Rollback candidate before release:`dpl_5Q2B9Mshe1hifPk5danHrDQEVkXW` at`7e06f02fb7f855f904e29a38b1a149849798030b`.

Actual authenticated browser verification at the canonical site:

1. The random-source panel reads shared0/1024 and no acquisition timestamp from the hosted API/database.
2. Disable quantum mode, complete the ordinary shuffle, draw/reveal three cards. Re-enable quantum mode and request another shuffle: the server returns shortage and the same three cards remain, with current source still ordinary.
3. Save a uniquely labelled synthetic record. SQL and hosted page agree on three cards and source`local`. Refresh the browser, open the shared list and detail, and verify Seven of Disks/The Chariot/Ace of Swords,all reversed,positions and source. Evidence:production-record.png.
4. An explicit test of the inactive AI endpoint returns “AI 解读尚未接通，这次没有调用。”;the AI table still has0 rows. No OpenAI request is dispatched.
5. Delete only synthetic record`cd1b9999-7812-4b9a-a6b5-a5b702dcf219`,matching its saved request hash and complete document. At2026-10-29T07:17:42.656Z,record count is restored to0,AI rows0,collection operations0,and pool version0/cursor0/total0/no batch. Retain the failed shortage operation as a normal audit receipt. Private cleanup receipt:.local/anu-release-cleanup.json.

Anonymous checks:canonical page/API302 to the existing Cloudflare Access host;direct primary Vercel page/API403;unique deployment redirects302 to Vercel login. Authenticated app behavior was observed under the owner's real Cloudflare session;Mimi's separate login and another physical device were not exercised. Browser logs contain no new application warning/error;old Cloudflare login-page messages predate this deployment. No Vercel→ANU call was made. The next owner acquisition is the remaining provider-connectivity observation,not an automatically scheduled task.

Final local aggregate remains314/314 with build/runtime/governance checks passing;.local/anu-release-check-all.log. All65 inherited generated-file fingerprints remain unchanged. The local retained869-value pool and one-call marker remain separate from cloud state. Production-pool screenshot records the shortage-preserves-table behavior;the final displayed empty pool is ready for the owner's first manual acquisition.

## Non-blocking retained observations

Claude noted the ordinary loopback development server still has selective private-path exclusions; other files in.local should receive a separate broad exclusion/cache relocation repair. The one-shot live harness already denies the whole private directory, and production deploy uploads exclude it. No running ordinary development server is needed for this release. The abandoned empty task socket directory was removed; the retained live database and exhausted request marker stay intact. Broader device/Mimi acceptance remains open.

## Recovery and limits

Restore the preceding verified application deployment if release fails. Retain additive tables and existing records; do not run destructive schema rollback. Environment changes affect subsequent deployments only. The known local314-test and15-PostgreSQL evidence does not prove hosted authentication, ANU connectivity from Vercel or Mimi's separate login. Hosted verification must distinguish those claims explicitly.
