# Claude models for private Production readings

Derived from governance/STATE.md stage2.5.19.1. On 2026-11-25 the owner approved commit, push and Production activation of the Sonnet 5.5 and Opus 5.5 reading options on the existing low, medium and high effort slider.

The linked Vercel project confirmed `ANTHROPIC_API_KEY` as a Production-only Secret before publication. Main application commit `1a93cfc1a65bc1830c0f1c61360eb7416cc7fcfe` reached READY as deployment `dpl_8EysLMei5sB3xxTUaDHebxUhB8tf`. The canonical domain `augurwell.anoriaquant.dev` pointed to this deployment. The production build reported `index-BGsKZ1Py.js` and `index-CRoHcDXp.css`, matching the tested local build. The previous verified version is `0a562c0d`.

The six anonymous checks covered the homepage, three API routes, the default origin and the deployment-specific hostname. The four canonical endpoints redirected to Cloudflare Access, the default origin returned 403 and the unique deployment redirected to Vercel sign-in.

An authenticated Chrome session opened More → AI解读 on the canonical site and loaded the matching JavaScript and CSS. The picker displayed both GPT models, Sonnet 5.5 and Opus 5.5. The slider offered 轻量, 标准 and 深入. Selecting 标准 on Sonnet, switching to Opus, and then moving the slider to 深入 confirmed that changing models preserves the current effort.

All 421 local tests passed. Local Chromium covered model selection, saving and record readback using synthetic answers. Before deployment, both model lookups and all six model/effort combinations passed against Anthropic's free token-counting endpoint with the owner's key. This release verification generated zero paid readings, ran zero provider searches and wrote no shared records.
