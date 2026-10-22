# Urban Tarot project entry

Generated/adapted from human-ai-governance v0.8.4

## Collaboration

- Verify local facts from source, tool results, and checks; verify external or changing facts online. Never invent acceptance or history.
- Establish human agreement before material work. The 2026-10-22 requests authorize moving the existing directory without a copy, restricting the existing web app to the two existing Cloudflare users, and committing/pushing those related changes. Full product reconstruction awaits a new agreed scope.
- Explain computer concepts simply in Chinese. Keep necessary specialist terms in English with a Chinese explanation. Use numeric stage identifiers such as stage1.2; letters only denote special additions.
- Preserve existing user changes. Commit, push, publication, paid subscriptions, and product redesign remain separate permissions.
- Use project-local dependencies and .venv for Python. Do not expose authentication secrets or put personal email addresses in tracked documentation.
- Child plans must explicitly name their parent and bounded scope at the top. Current-state authority belongs to governance/STATE.md.
- Before durable work, read the installed human-ai-governance skill; for UI work also read design-authorship. Report missing skill files. Reuse this package without automatic global-version migration.
- Use independent judgment grounded in actual code and accepted plans. Do not infer historical design approval from current implementation.

## Entry and checks

1. Read governance/README.md, governance/contract.json, and governance/STATE.md.
2. Read README.md for architecture and operations; read DESIGN.md for interface work. Load decisions and history only as relevant.
3. Run pnpm check:all for the combined governance, TypeScript, and build checks. Create .venv with python3 -m venv .venv if absent; its checker uses only the standard library.

Governance root: this repository. Coverage: all project files. Working tier: Tier 3 for the private hosted app and its access configuration; no financial or external-account execution authority. Browser gameplay has no verified cloud persistence. Protect production access independently of local gameplay.
