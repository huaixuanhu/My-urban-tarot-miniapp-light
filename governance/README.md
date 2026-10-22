# Governance maintenance

This package governs the whole repository, including the web demo, desktop wrapper, and project-scoped external access configuration. contract.json maps every role to one owner.

Start with AGENTS.md, this entry, the contract, and STATE.md. README.md owns architecture and local commands; DESIGN.md owns design revision and acceptance. DECISIONS.md records consequential choices; AI_AGENT_LOG.md records work and its evidence limits; CHANGELOG.md records meaningful changes. Do not duplicate the current plan in another file.

After a meaningful change, update affected owners once and run pnpm check:all. The bundled governance_package_check.py checks structure, not historical acceptance, runtime security, or visual quality. Review those claims against actual evidence. Keep private service evidence out of tracked files.

No legacy governance package was found during the 2026-10-22 move. This package is a new local adoption of human-ai-governance v0.8.4, with design recovery informed by design-authorship v0.3.1; it does not establish past acceptance or cross-host loading.
