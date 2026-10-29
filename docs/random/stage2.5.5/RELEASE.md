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

The reviewed product tree remains unchanged. The release-preparation commit adds only authority, architecture and evidence documentation. Push and deployed revision receipts are recorded separately below when observed.

## Non-blocking retained observations

Claude noted the ordinary loopback development server still has selective private-path exclusions; other files in.local should receive a separate broad exclusion/cache relocation repair. The one-shot live harness already denies the whole private directory, and production deploy uploads exclude it. No running ordinary development server is needed for this release. The abandoned empty task socket directory was removed; the retained live database and exhausted request marker stay intact. Broader device/Mimi acceptance remains open.

## Recovery and limits

Restore the preceding verified application deployment if release fails. Retain additive tables and existing records; do not run destructive schema rollback. Environment changes affect subsequent deployments only. The known local314-test and15-PostgreSQL evidence does not prove hosted authentication, ANU connectivity from Vercel or Mimi's separate login. Hosted verification must distinguish those claims explicitly.
