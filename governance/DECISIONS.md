# Decisions

## 2026-10-26 — preserve scene colors while adding clear controls

The fixed control lens renders after the existing scene and samples its already-rendered pixels, rather than rendering every object into a new globally tone-mapped pipeline. This preserves the distinction between original unlit card faces and lit surroundings. The physical control mesh is no longer rendered; its framing extent stays unchanged to avoid a camera change. The lower-center position was explicitly confirmed by the user.


## 2026-10-26 — retain trial 08, replace its button treatment

The user accepts the surrounding scene/camera/backs and requests a checkpoint, then asks to return controls to a fixed screen position with clear concept-led glass optics. The asynchronous answer confirms lower-center placement. This supersedes only the table-mounted control contract; it does not reopen the accepted cards, camera or motion.


## 2026-10-26 — one camera and physical glass controls

Source: the user’s four requested refinements after checkpoint 4. The prior lens transition is superseded: reading and reset retain one perspective and the chosen elevation/yaw, with optional zoom normalization only. Exact vertical viewing uses stable camera axes. Native controls share the physical glass top plane; expanded reading/utilities stay screen-aligned for legibility. Original Urban Tarot faces, identity/reversal and shuffle/reveal choreography remain authoritative. The supplied back and glass-block references guide materials; the implementation remains a candidate for local user review.


## 2026-10-25 — trial 07 checkpoint and next local refinement

The user accepts the current trial as a checkpoint, while explicitly requesting further changes to elevation/reset projection, card backs and a table-mounted glass control block. Preserve 55fbfc91 as the product baseline. Acceptance does not freeze its camera transition or materials against the specifically requested changes. Local batch commits remain permitted; no push/deployment.


## 2026-10-25 — real reading depth with retained shuffle framing

Source: explicit low-angle perspective feedback. The old orthographic camera gave equal-size objects no distance scaling; there was no source evidence of an inverse projection. Add native perspective for reading, and approach the original orthographic shuffle camera with a continuous dolly/long-lens transition so glass view vectors stay coherent. Reuse physical bounds, identity, reversal, motion and zoom/orbit limits. Anchor the dock to the projected near edge, clearing all original fan slots so card selection/removal cannot move the permanent targets. First local UI batch is 97d40218; this second batch remains local-only.


## 2026-10-25 — full-scene overlays and separate local batches

Source: explicit user feedback requesting floating text/buttons over the entire table with Apple Liquid Glass as a reference, followed by batch-commit permission. Adopt a distinct functional layer above the scene, keeping physical table/card geometry and transient reading state. Split the runnable glass/floating UI from the perspective correction; no push or deployment is authorized. The existing camera is orthographic, so source does not show literal inverse perspective; correct the missing depth scaling rather than invert another axis.


## 2026-10-25 — local day/night glass UI trial

Source: the user selected both light/day and dark/night, retained the third/fourth generated concepts without leaves, then explicitly requested rigorous local trial implementation. During implementation the user additionally requested replacing the cloth itself with fluid-glass material. Proceed locally within STATE.md stage2.4: one shared table/state, retained original Urban Tarot art and accepted motion, paired material values, native appearance selector and only appearance preference storage. Original cloth footprint remains; no source-card recoloring, foliage, question/history flow, commit, push or deployment. This supersedes the earlier planning-only boundary for this bounded local UI slice.

## 2026-10-25 — checkpoint 3 before UI redesign

Source: the user accepted current functionality, explicitly requested a local checkpoint before UI redesign, supplied three generated material/mood references and deferred complete-flow refinement and question records until afterward. Commit trial 05 and its records only. Next work is UI planning/design: compare light and dark with the existing Urban Tarot artwork; do not treat the pasted assistant recommendation or reference layouts as acceptance. STATE.md stages 2.4–2.6 record the revised sequence. No push, deployment or UI implementation is inferred.

## 2026-10-25 — restore the original deck, discuss the wider flow

Source: after accepting the shuffle/reveal work, the user requested installing the original card content and starting overall interaction design. The subsequent answers choose image/theme first, detailed meanings on demand, and explicitly limit this iteration to card faces/meanings with discussion of the larger flow. Reuse existing data/art locally, retain accepted motion and fixed identities/orientations, and keep the new reading surface peripheral to the table. Report the absence of authored reversed meanings instead of generating replacement interpretations. No question/notes/history implementation, new commit, push, deployment or access change. STATE.md stage2.3 is the only current plan owner; DESIGN.md revision 12 owns the bounded candidate contract.

## 2026-10-25 — accepted cloth and side reveal as checkpoint 2

Source: the user explicitly accepted the new reveal effect and requested one commit combining the cloth enlargement with random left/right reveal as the second checkpoint. Commit the bounded stage2.2.2/2.2.3 implementation, tests and governance/design records after checkpoint 919e66dc. This supersedes the temporary uncommitted boundary for those two slices only. Preserve original .DS_Store and tracked node_modules changes; do not push, deploy or start another product stage. STATE.md stage2.2.4 owns the receipt and continuation.

## 2026-10-25 — commit checkpoint 1 before enlarging the table

Source: the user accepted the existing version as the first checkpoint, requested committing it first, then enlarging the cloth for more placement space. Commit only the current prototype source/dependency lock/test/docs slice. Preserve .DS_Store and tracked node_modules changes outside the commit. Stage2.2.2 enlargement begins after the checkpoint and stays uncommitted for local review. No push, deployment or access change is authorized.

## 2026-10-24 — reference-led loose fan and plain cloth

Source: the user supplied an image of a naturally staggered arced card fan, requested imitating its spreading arrangement, and asked for a plain cloth to help with 3D orientation without designing the cloth yet. Apply this only to local stage2.2 trial 04. Preserve the current hover lift, card identities, draw/reveal, bounded view/zoom and accepted shuffle; vary spacing/depth/yaw once per prepared order. A static finite textile with modest edge folds provides the requested visual anchor. No symbols, new deck art, physics engine or claim of proven motion-sickness relief. No publication/access authority is added.

## 2026-10-24 — wheel zoom and corrected vertical orbit

Source: the user requested bounded wheel zoom to inspect cards or see the whole table, and reported the y–z rotation direction reversed. Add 75–180% centered optical zoom to local trial 04, preserve horizontal orbit direction and reverse vertical pointer movement. Keep keyboard Up semantically raising the view. Home/reset restore both angle and scale before the unchanged shuffle; camera actions never change card identities. No publication or access authority is added.

## 2026-10-24 — bounded reading-table view

Source: the user accepted the slight picking lift, requested wider side separation and blank-table dragging to adjust height/direction like the cottage. Extend only local stage2.2 trial 04. Keep card drag/reveal priority, bound the view above the table and provide a home-view control plus keyboard alternative. Camera movement does not mutate reading state or shuffle identity. Reset returns to its original camera before starting the accepted choreography because its hidden handoff was verified in that framing. No production or publication authority is added.

## 2026-10-24 — authorize the local reading loop

Source: the user approved the next local prototype with free placement and dragging, and then answered the pending question with double-click reveal. The later answer overrides the earlier selected-card-button primary gesture; retain a visible button only as an alternative. Build and verify drawing three cards, arranging them freely, individually revealing them and resetting, while preserving the accepted shuffle as its own page and unchanged modules. Numbered original sample faces are sufficient for this interaction trial; meanings, saving, production integration and publication remain outside the scope. STATE.md remains the current owner; no separate child plan.

## 2026-10-24 — accept and retain trial 03 shuffle

Source: the user explicitly accepted the current shuffle effect, asked to retain it, and requested alignment on drawing, placement and reveal interactions while continuing with local prototypes. Preserve design revision 5’s airborne/accelerating shuffle as the accepted motion baseline. Open stage2.2 for discussion only; do not infer acceptance of a draw gesture, placement model, reveal trigger, full visual identity, card art, production integration or publication. Current proposal and pending choices remain solely in STATE.md.

## 2026-10-24 — continuous airborne assembly and pace

Source: after removing the scattered hold, the user requested eliminating the table landing entirely, flying in more slowly, accelerating during cuboid assembly and reaching normal speed at interleaving. Keep trial 03 local. Replace the prefix with continuous airborne paths and deterministic pacing. Join the original motion at its lifted-stack state, skipping the now-redundant initial stationary/table-lift section; use the same offset for poses, flex and audio. Preserve the accepted splitting and bent interleaving modules and rate. The three-card fixture, stable identities, playback controls and publication boundaries remain.

## 2026-10-24 — trial 03 global-reset prelude

Source: the user said the existing shuffle motion was good, proposed rotating cards arriving from all directions, scattering, then gathering into a rectangular stack before the current shuffle, and explicitly approved implementing that proposal as local trial 03. Preserve the accepted motion/flex/geometry modules; prepend a bounded 2.8-second wrapper to the original three-second sequence. Use a three-card illustrative spread to demonstrate return from known positions because the actual reading board is not integrated in stage2.1. Keep IDs fixed and randomize a run once; explicit replay starts the fixture again, while pause/seek/skip retain the same run. No production app, data persistence, cleanup, publication or access change is authorized.

## 2026-10-24 — refine stage2.1 with paper bending and springback

Source: the user explicitly requested bending and rebound, especially where the two packets interleave, and permitted Blender if needed. Extend the same local study without beginning stage2.2. Apply deterministic deformation to a subdivided solid so faces, edges, normals and shadows follow the same curve and time seeking remains exact. Browser geometry supports this bounded change without a Blender export pipeline or new dependency. Keep the selected materials, stable viewpoints, roughly three-second duration and reduced-motion behavior. This is an authored physical-looking animation, not a claim of measured paper dynamics. Commit, push, deployment and integration remain outside this refinement.

## 2026-10-24 — begin a bounded physical-shuffle trial

Source: the user's direction answers, explicit deferral of AI/cross-device saving, acceptance of a roughly three-second trial, preference to try a real deck moved by invisible hands, and instruction to start. Implement stage2.1 locally, preserving the protected hosted app and existing dirty files. Desktop personal reflection is the agreed product direction; a full replacement's gesture/content contract is still to be worked out. Keep the current plan solely in STATE.md and the versioned design contract in DESIGN.md.

Use an isolated browser 3D scene to make the motion directly playable. The user permitted Blender if needed and pointed to 萱敏小屋. That project's retained model README documents direct background Blender scripts without a separate MCP service; its local Blender executable remains available. This trial does not require importing or modifying those assets. Original procedural art avoids making an unverified reuse decision about the old card illustrations. This local authorization grants no new commit, push, deployment, paid service or access-policy change.

## 2026-10-22 — publish the migration and access slice

Source: the user explicitly requested committing and pushing these changes to GitHub after the migration/access handoff, while deferring full reconstruction. This grants the publication authority that was absent from the original migration slice. Publish the reviewed source, dependency declarations/lockfile, tests, ignore rules, and project records on the existing main branch. Retain .DS_Store and generated node_modules changes locally; do not combine dependency-history cleanup or product changes with this publication. The external two-email Access policy stays unchanged.

## 2026-10-22 — canonical entry and origin identity verification

The user selected augurwell under the existing anoriaquant.dev domain and explicitly requested the Vercel setup guide. Keep the existing Vercel host and use Cloudflare for DNS/proxy/Access. Use an independent two-email policy; do not change other apps. A hostname/header-presence check alone cannot validate identity, so add a small signature-validating server entrypoint and a project-scoped hostname firewall. This is access setup; the original gameplay and design stay at the observed revision. Keep the certificate exception scoped to its reserved path. No Git publication is inferred from the live access request.

## 2026-10-22 — move and prepare for continued work

Source: explicit user request and supplied standing project rules. Move the directory itself, retain its name and Git history, and keep no duplicate in Downloads. Add private entry for the two existing Cloudflare users. Defer full product reconstruction to a later agreed project chat.

Use one local governance package because the user intends continued development. Recover the current interface as observed revision 1; do not infer approval of an early demo. Keep original personal changes, avoid embedding private email addresses or secrets in tracked documents, and separate local adoption from commit/push/deployment.

The original and destination are on the same filesystem; a directory rename preserves identity and avoids copy/delete risks. A before/after manifest verified the migration. The current GitHub account path resolves to the same imported main commit.

## 2026-10-26 — checkpoint 6 and room refinement authority

Checkpoint 6 records the user’s acceptance of trial 09 at d3aaa4a8. The new room/environment request reopens the prior no-foliage constraint and authorizes bounded source reuse from 萱敏小屋, with local batch commits only. Current scope is STATE.md stage2.4.10.

## 2026-10-26 — clear-lens local batch

Refine reference optics with an untinted center, a thinner refractive rim and softer displaced shadow; retain the screen-fixed lower-center controls. Room composition will be verified separately in stage2.4.10.2, using the same lens over the real background.

## 2026-10-26 — cottage environment local batch

For stage2.4.10.2, adapt only cottage architecture/vegetation in plain Three.js. Keep room blur separate from original card rendering and cache the static room to avoid re-rendering it throughout every shuffle frame. Remove the opaque glass backing and keep a low stone dish on the floor after rendered review rejected the conspicuous stand. Room shadow/caustic accents are bounded approximations. Local candidate only; no push/deployment.

## 2026-10-26 — checkpoint 7

Record checkpoint 7 at unchanged trial10 product076d1d12. The user identifies insufficient dayglassvisibility and roomfidelity; those remain open. Next work must inspect and reuse actual cottage modeling, with freer camera and visible recovery under STATE.md stage2.4.12.

## 2026-10-26 — stage2.4.12 source-faithful local room

Authority: the user requested clearer daytime glass, substantially more faithful cottage modeling, freer view with one-action recovery, and a checkpoint before changes. Checkpoint7 is1dc33e53. Reuse unchanged static source components fromcottagee71fe3fa via a reproducible local GLB export; keep the cottage read-only and avoid its app/navigation/private configuration. Preserve original model proportions with one uniform transform; final table anchor(1.1,.9,0) and.14metres per gameplay unit keep sampled desktop cameras inside original boundaries. Retain static floor decor. Adapt room-only exposure/blur/shadows for the reading page and record the34.31MiB asset cost. Preserve Urban Tarot faces and accepted motion. Visual acceptance remains pending; no publication authority is implied.

## 2026-10-26 — checkpoint 8 and scene repair authority

Save existingeadc2961 before the bounded local correction. The latest request explicitly permits removal of original floor-card decor only in the imported Tarot scene, stronger room defocus, actual view/occlusion diagnosis and clearer glass. Source cottage remains read-only; no publication authority.


## 2026-10-26 — focused room optics

Use uniform room-only defocus to retain every interactive card sharply at freely selected viewing angles. Do not apply a physical camera depth-of-field pass to the entire card scene. A dense Gaussian at reduced resolution avoids spaced copies of sharp room edges; retain linear color and cached room rendering. Original-room reflection capture would add twelve scene captures for two themes and still lack correct near-object parallax; use a bounded existing window-shaped reflection field for the glass instead. See stage2.4.14 optical research for primary references and limits.


## 2026-10-26 — table-focused source-room cutaway

The original bathroom showerhead can lie only.358m from the freely orbiting camera and fill the viewport. The separate room background then falsely puts the table above it. Retain camera freedom and hide coherent foreground furniture groups only while they obstruct the table corridor or approach the camera. Do not merely increase blur, globally remove room furniture, or silently constrain elevation. Preserve floor/rugs/architecture and restore source visibility when clear. The four decorative floor cards are independently excluded under the user's explicit request. This is a bounded cutaway approximation, not a shared-depth renderer or all-sightline guarantee.
