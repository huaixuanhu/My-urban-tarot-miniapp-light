# Decisions

## 2026-10-22 — publish the migration and access slice

Source: the user explicitly requested committing and pushing these changes to GitHub after the migration/access handoff, while deferring full reconstruction. This grants the publication authority that was absent from the original migration slice. Publish the reviewed source, dependency declarations/lockfile, tests, ignore rules, and project records on the existing main branch. Retain .DS_Store and generated node_modules changes locally; do not combine dependency-history cleanup or product changes with this publication. The external two-email Access policy stays unchanged.

## 2026-10-22 — canonical entry and origin identity verification

The user selected augurwell under the existing anoriaquant.dev domain and explicitly requested the Vercel setup guide. Keep the existing Vercel host and use Cloudflare for DNS/proxy/Access. Use an independent two-email policy; do not change other apps. A hostname/header-presence check alone cannot validate identity, so add a small signature-validating server entrypoint and a project-scoped hostname firewall. This is access setup; the original gameplay and design stay at the observed revision. Keep the certificate exception scoped to its reserved path. No Git publication is inferred from the live access request.

## 2026-10-22 — move and prepare for continued work

Source: explicit user request and supplied standing project rules. Move the directory itself, retain its name and Git history, and keep no duplicate in Downloads. Add private entry for the two existing Cloudflare users. Defer full product reconstruction to a later agreed project chat.

Use one local governance package because the user intends continued development. Recover the current interface as observed revision 1; do not infer approval of an early demo. Keep original personal changes, avoid embedding private email addresses or secrets in tracked documents, and separate local adoption from commit/push/deployment.

The original and destination are on the same filesystem; a directory rename preserves identity and avoids copy/delete risks. A before/after manifest verified the migration. The current GitHub account path resolves to the same imported main commit.
