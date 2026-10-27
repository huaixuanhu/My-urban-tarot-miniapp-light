# stage2.4.18 — primary application replacement evidence

Derived from governance/STATE.md stage2.4.18. Scope: promote accepted revision20 into the sole root application and existing protected hosted entry. This evidence does not authorize changes to the sibling cottage or reopen deferred features.

## Local replacement

- Recovery point:4af6f9bb, the last accepted source publication before primary-entry replacement.
- Canonical entry:client/index.html; runtime/styles/models:client/src/. Root Vite output:dist/public/index.html.
-26 runtime modules, stylesheet and2GLBs moved.27 of29 moved files are byte-identical; only art/data imports changed in2modules.
-78 retired React UI/shared/scaffold files removed. Prototype reading.html and unused reading-cloth.mjs removed. The motion/GPU tools now import the canonical runtime. Their source is excluded from the public build.
-79 original art/data files unchanged.65 inherited generated-file changes excluded and hash-checked.

## Verification

`pnpm check:all` passes: governance structure, TypeScript, compiled access entrypoint,15 authorization tests,129 retained reading/motion/optical-source tests and production build. The historical cloth-only test was removed with its unused renderer. Optical shader code and gameplay state logic are byte-identical, so prior GPU/stable-orientation evidence remains applicable.

A temporary clean dependency installation used `pnpm install --frozen-lockfile --ignore-scripts`, without copying inherited node_modules, then `pnpm build`. It succeeded; generated index.html matches the working build. Both builds contain78 hashed WebP images and2GLBs. Production output contains the new reading entry, with no local-trial navigation or old React entry. The installed package graph still contains historical dependencies; none of the removed React UI is in the active source or emitted user interface.

Native browser verification used http://127.0.0.1:4174/ (built output),1829×954 desktop viewport. Observed: original illustrations load after drag-three; all3cards reveal sideways and counts reach3/3; detailed original meaning opens; day/night switch preserves state; blank-area orbit and 回正 work; full reset finishes at0/0. Final browser warning/error log is empty. Screenshots:day.png,night.png.

This does not qualify Electron packaging, physical-phone performance, future persistence or cloud continuity. Appearance is the only saved preference. The static day/night cottage assets retain their existing34.31MiB combined size.

## Publication boundary

Existing Vercel project:my-urban-tarot-miniapp-light, team anorias-projects; canonical URL:https://augurwell.anoriaquant.dev. vercel.json explicitly selects pnpm build and dist/public, keeps proxy.ts and redirects hosted /reading.html to /. Existing Cloudflare and server-side signature/hostname protections remain unchanged. File-based build/output configuration follows https://vercel.com/docs/project-configuration.

At release preparation, local checks are complete; GitHub/Vercel and hosted outcomes are recorded separately after publication. The Vercel connector cannot currently read this team's project (403); GitHub deployment status and ordinary browser/HTTP observations are the available verification routes. No private credentials are copied or exposed.

## Future work

Work directly in client/ using pnpm dev. Cottage integration should link the canonical protected HTTPS entry. The previous stage2.4.17 independent prototype build instructions are superseded. Full-flow/records remain owned by deferred STATE.md stage2.5.

## Local cache preservation

The first default dev-server startup regenerated inherited tracked Vite cache files. The server was stopped;48previously clean cache files were restored from HEAD and the dirty metadata index was recovered from Git blob8a396d92681f726af1552626677b7b63ed42f74d, with exact SHA-256 match against the preflight snapshot. All65 inherited dirty-file hashes match again. Root cacheDir now points to ignored .local/vite; a subsequent dev start uses that isolated cache and serves the new UI at port3000. These cache files are excluded from the application commit.
