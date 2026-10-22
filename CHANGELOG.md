# Change history

## 2026-10-22

- Moved the existing directory to small_project without a copy; the migration manifest verified all original regular files and entries before follow-up changes.
- Established the project governance package and observed design revision 1 for continued development.
- Connected augurwell.anoriaquant.dev to the existing Vercel app behind the two-user Cloudflare Access policy; added origin token verification, a canonical-host firewall, and a certificate-only exception.
- Added 15 access regressions and a compiled Node entrypoint smoke check; verified actual login and bounded anonymous/direct-origin rejection.
- Completed Vercel CLI installation/login and managed MCP login; current chat connector team-read limits remain explicit in governance/STATE.md.
- Added the user's subsequent authorization to commit/push the bounded migration/access change set; full gameplay reconstruction remains deferred to the new project chat.
