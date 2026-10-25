# Urban Tarot

An existing React/Vite tarot-board demo with an isolated local reconstruction study. The current scope and next entry are in [governance/STATE.md](governance/STATE.md).

## Location and source

The working directory is /Users/anoria/Documents/python_coding/small_project/urban-tarot-light. It was moved from /Users/anoria/Downloads/urban-tarot-light on 2026-10-22 without a second checkout or retained source directory. The repository is https://github.com/huaixuanhu/My-urban-tarot-miniapp-light. The imported source identity is a190b14359172a0209feb17a7df26f117cb78ccd.

## Architecture

- client/src/App.tsx establishes React, theme, notifications, and hash-based routing.
- client/src/pages/Home.tsx composes the reading board, spread deck, help, shuffle, and clear controls. components/ supplies cards, the detail modal, and reusable UI.
- client/src/contexts/TarotContext.tsx owns in-memory deck and placed-card state. Tarot data comes from client/src/data/tarotData.json. Refresh persistence of readings is not implemented in this inspected context; ThemeContext uses localStorage for the theme.
- client/public/ contains card illustrations and sounds. client/src/index.css owns the existing visual tokens. DESIGN.md records their observed status.
- vite.config.ts builds client/ to dist/public using relative output asset paths. server/index.ts is an Express static-file fallback server; electron/main.cjs loads the bundled files for the desktop wrapper.
- The current web host is Vercel project my-urban-tarot-miniapp-light. Access/DNS configuration is external to Git. Current verification and limitations belong to governance/STATE.md. The imported source had no identity validation; the access-only patch now uses proxy.ts and access/guard.ts to verify Cloudflare-signed application tokens before pages and assets. access/config.ts contains public application identifiers, not secrets. The formal entry is https://augurwell.anoriaquant.dev. Local Vite/Express/Electron execution does not run this Vercel-specific gate and must not be presented as a protected public host.

## Local work

Use the package manager recorded in package.json. Existing dependencies moved with the directory. Commands: pnpm dev, pnpm check, pnpm build, pnpm preview. pnpm test:access tests signed-token authorization, and pnpm check:access-runtime compiles and loads the production entrypoint using Node ESM rules. For a full local gate: python3 -m venv .venv once, then pnpm check:all. Electron packaging is a separate surface and has not been revalidated by the move.

Do not assume a successful local build is a deployment or product acceptance. Avoid putting personal addresses, tokens, or private account exports into this repository. Local private service evidence belongs under ignored .local/ if needed.

## Local motion study

The locally reviewed stage2.1 study lives in [prototypes/shuffle-study/](prototypes/shuffle-study/README.md). It has its own Three.js manifest/lockfile; it is outside the production client build. From the repository root, install its pinned dependency with `npm ci --prefix prototypes/shuffle-study --ignore-scripts`, then run `pnpm exec vite --config prototypes/shuffle-study/vite.config.mjs`. Open http://127.0.0.1:5174/ on this computer. This loopback-only motion review does not draw cards, collect questions, save readings, or replace the protected hosted app.

Study checks are separate from the existing aggregate: `node --test prototypes/shuffle-study/*.test.mjs` and `pnpm exec vite build --config prototypes/shuffle-study/vite.config.mjs`. The study reuses the repository's Vite toolchain; its build output stays inside `prototypes/shuffle-study/dist/`. Trial 03's `reset-motion.mjs` supplies a 2.6-second seeded airborne return/convergence with a slow-to-fast pace, then joins the preserved motion/flex modules at their already-lifted stack. Its shared shuffle-time helper keeps poses, bending and audio aligned while the remaining 2.46 seconds run at normal speed. A three-card illustrative spread demonstrates returning from existing positions; physical IDs remain fixed while a run maps them to shuffled slots. Face, edge and shadow deformation stays in `flex.mjs` and `card-geometry.mjs`; the full scene remains pausable and scrub-able.

The next local interaction trial is [reading.html](prototypes/shuffle-study/reading.html), served at http://127.0.0.1:5174/reading.html. It adds the agreed drag/free-placement/double-click-reveal/reset loop and bounded blank-table view dragging and 75–180% wheel zoom without editing the accepted shuffle page. `reading-state.mjs` owns identity-preserving transitions, `reading-art.mjs` supplies original numbered sample faces, `reading-reveal.mjs` supplies the sideways reveal with fixed orientation, and `reading-reset.mjs` adapts current poses before delegating to the accepted choreography. `reading-fan.mjs` prepares a stable loose arc per order, `reading-cloth.mjs` supplies a plain static cloth, and `reading-view.mjs` owns bounded camera movement/framing and `reading-picking.mjs` selects stable card planes from the current angle. It has no persistence or real tarot interpretation. Build both local entries with `pnpm exec vite build --config prototypes/shuffle-study/reading.vite.config.mjs`; test the study with `node --test prototypes/shuffle-study/*.test.mjs`.

## Hosted access maintenance

The email allowlist is owned by Cloudflare. The app audience and issuer must match access/config.ts when replacing the Access application. Keep the project firewall's canonical-host restriction so historical deployments cannot become a second public entry. Certificate validation bypass is confined to the reserved ACME path; unknown challenges never serve the application.

The supported Vercel configuration uses proxy.entrypoint in vercel.json. See [Vercel routing middleware](https://vercel.com/docs/routing-middleware) and [Cloudflare token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/). After future changes, validate both a real allowed login and anonymous/direct-origin rejection. Avoid downloading production environment variables merely to run a local build; source-only tests and remote builds were used here.
