# stage2.5.9 — soft lamplight and side random choice

Parent and sole current owner: [governance/STATE.md](../../../governance/STATE.md) stage2.5.9, derived from stage2 reconstruction. Scope: the user's accepted revision28 checkpoint and bounded local refinements with split commits. Design owner: [DESIGN.md](../../../DESIGN.md) revisions29–30. The user explicitly assigns future visitor gate/account design to another conversation; this slice leaves only a local foundation.

## stage2.5.9.1 — lighting and engraving

Accepted revision28 was saved as9dae1d1f. The lighting/engraving batch is6cd0c201. Night glass roughness and clearcoat response broaden the existing two bright reflections, while existing light objects become warmer/dimmer with softer falloff. Day settings restore explicitly and the polished edge remains. No additional lights, animation loop, assets or room-model changes.

The existing single static texture adds faint outer arcs, paired crescent marks, side orbits and sparse corner constellations. The central field stays clear and no drawn-card relationships or spread positions are imposed. The owner remains reading-ritual.mjs; resource disposal remains under the glass owner.

Actual Chromium default/high-angle views show larger warm halos and delicate markings. A finite-operation canvas construction check and repeat-safe disposal of texture/material/geometry passed. These are local visual checks, not user acceptance or device-wide performance qualification.

## stage2.5.9.2 — choices and source truth

The small side group uses the existing glass/pearl native-radio language, with icons and 系统/量子 labels. “下次洗牌” is explicitly separate from current-round provenance. Member defaults/persistence remain unchanged; mode changes never collect, draw or relabel an existing round. The UI group appears only once its controller is ready. At390px it becomes vertical and leaves a measured12.7px gap before the card-reading column; page width/scroll width are both390.

Source help is one sentence: system randomness uses the device's secure random source; ANU randomness comes from quantum-vacuum measurements. Local evidence: `shared/randomness.mjs` uses `crypto.getRandomValues`, with the existing bounded unbiased deck conversion. External basis: [ANU Quantum random number generation](https://physics.anu.edu.au/research/qst/qoptics/random_numbers.php), checked2026-10-30. This does not imply stronger tarot predictions, and an interface receipt timestamp is not a laboratory measurement time.

The acquisition/shared-stock explanation moved to the question mark at 共享剩余. The headline is “抽取 感受 感知”. Existing500ms hover delay, focus/click and Escape help behavior is reused. In the narrow source panel, width366 starts at x12 and content width/scroll width both355.

## Local visitor foundation and future handoff

`createRandomSession({quantumAccess:false})` starts with transient system randomness, ignores member preference/recovery stores, and denies quantum collect/draw/recovery/metadata paths. Side quantum selection remains visible with a lock and email requirement; clicking it keeps system selected and opens a truthful not-yet-connected verification explanation. No email is collected and no fake verification success is offered.

Run `pnpm exec tsx scripts/preview-ai.mjs 5176 --visitor` for this local rehearsal. The loopback-only fixture injects `data-visitor-preview=true` and denies GET/POST random, records and interpretation APIs before synthesizing identity. The marker is a presentation/capability restriction, never an authentication mechanism. The normal protected app still uses its existing member path. `proxy.ts`, `access/*` and production APIs are unchanged; no visitor can currently bypass the private hosted gate.

Follow-up in the separate account/gate conversation must decide actual public audience, server-issued capability/verified identity, quantum eligibility, shared stock ownership and private record/AI boundaries. Do not infer that a verified visitor should receive shared records or AI access. Any deployment and changes to Cloudflare/origin protection need their own scope and verification. No such work is implemented here.

## Verification and evidence limits

`pnpm check:all` passes319 tests:15 access,132 gameplay/motion,44 records,58 AI and70 randomness; governance, TypeScript, runtime builds and production build pass. The inherited client chunk-size advisory remains. Four new tests cover visitor storage/dispatch isolation, local deck availability, disposal and UI/polling behavior. Independent read-only review found no request/state blocker; the accessible description is now attached only for visitors.

Actual browser checks: day/night, default/high-angle camera, side pointer and arrow-key selection, separate source/inventory help, simulated quantum shuffle with preserved current-source badge after selecting next system mode, system shuffle, and visitor three-card drag/reveal. The narrow horizontal control initially overlapped the reader; the final vertical layout fixes that overlap. The final lock uses an HTML visibility wrapper, so it appears for visitors and hides for members.

Only credential-free fixtures were used. Main fixture acquisition count was3 before this turn and remained3, AI calls0/records0; an existing synthetic pool supplied one draw. Visitor fixture calls/acquisitions/attempts/records all0. No new real ANU/OpenAI/Neon requests.65 inherited generated-file hashes match the existing snapshot. Local batch commits only; no push or deployment. AI preset implementation remains pending.

Images are actual integrated local UI screenshots, including the explicit fixture banner. Browser warnings/errors were empty in both member and visitor previews; temporary viewport overrides were reset:

- [Inventory help](inventory-help.png)
- [Visitor requirement](visitor-day.png)
- [Visitor three-card flow](visitor-three-cards.png)
- [Narrow layout](visitor-narrow.png)

- [Night soft light at a high angle](night-soft-light.png)
- [Day table and side choice](table-day.png)
