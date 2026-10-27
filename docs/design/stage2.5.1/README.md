# stage2.5.1 — shared-record interface candidate

Parent: [governance/STATE.md](../../../governance/STATE.md), stage2.5.1. Scope: the More glass sheets, structured reading capture and shared-record client interface. This is a bounded design/evidence record, not a second current plan. API/storage implementation and activation authority remain owned by STATE.md. Design owner: [DESIGN.md](../../../DESIGN.md), candidate revision21 over accepted revision20.

## Request and preserved baseline

On2026-10-28 the user requested a unified glass-card treatment for More with an extraction motion, plus “占卜记录” for structured spreads and interpretations. The user explicitly selected cloud records shared by the owner and Mimi. This document records initial local implementation and review evidence; the subsequent authorized publication is recorded separately in [stage2.5.3](../stage2.5.3/README.md).

The accepted original Urban Tarot faces, free placement, reversible hidden-card operations, sideways reveal, shuffle, room/glass treatment, camera and screen-fixed optical dock remain. History browsing does not replace the live spread. The separate AI model assessment does not imply that AI-generated interpretations exist in the application.

## Implemented candidate

The More trigger opens one glass sheet above the dock. “桌上的牌” and “占卜记录” use the same sheet material, header, close/back conventions and scrolling interior. Opening rises22CSS pixels over260ms; closing returns over210ms. In-app or OS reduced motion takes the immediate path. A sheet becomes inert while closing; explicit close/Escape returns to More. Outside pointer dismissal and nonmodal table access remain available. The CSS surface has readable day/night backing and bounded narrow-window sizing; it does not replicate the dock's WebGL lens.

Records contain three related views:

- “这次占卜”: optional question, card-position meaning, personal interpretation and a note for later. Saving requires a nonempty fully revealed spread. The captured payload contains identities, draw/stack order, x/z positions and orientation. Source meanings are server-owned snapshots separate from those fields.
- “共享记录”: date, question and card summaries with incremental loading. Both authorized people see one shared collection.
- Saved detail: relative spread arrangement, ordered original card explanations, saved personal text and JSON export. This is a read-only record; it does not reset or resume the live table.

Saving has explicit loading, success, rejection and uncertain-result states. A confirmed snapshot is immutable; changed content uses a new record. Uncertain retries reuse the same ID and frozen content, including when another card is drawn on the live table. The interface distinguishes unavailable storage from a saved result. Draft fields and uncertain attempts currently remain only in page memory, with an unload warning and reset guard. No automatic local persistence or verified cloud recovery is claimed.

## Source ownership

| Responsibility | Source |
| --- | --- |
| Entry, native sheet structure and triggers | [client/index.html](../../../client/index.html) |
| Shared glass-sheet and record presentation | [client/src/reading.css](../../../client/src/reading.css) |
| Open/close motion, focus, outside dismissal and reduced motion | [reading-disclosures.mjs](../../../client/src/reading-disclosures.mjs) |
| Current record, shared list, detail and failure presentation | [reading-records.mjs](../../../client/src/reading-records.mjs) |
| Capture, frozen save attempts and request client | [reading-record-data.mjs](../../../client/src/reading-record-data.mjs) |
| Canonical input/source snapshot structure | [shared/record-schema.mjs](../../../shared/record-schema.mjs) |
| Focused pure-client regression checks | [tests/records-client.test.mjs](../../../tests/records-client.test.mjs) |

## Observed evidence

Nine focused client tests passed with `node --test tests/records-client.test.mjs`:

- Capture preserves source identities, original draw order, orientation, positions, labels and human text independently from later live edits.
- Empty/partly hidden spreads reject before a record is prepared.
- An uncertain save can retry its frozen snapshot after the live table gains a new hidden card.
- Requests use the same-origin JSON endpoint without caching; opaque pagination cursors are encoded.
- A definite unconfigured response differs from an uncertain storage failure. Network loss and an HTML login/SPA response preserve the pending payload and never become success.

The root agent exercised the actual local interface in a native browser: More, three-card drawing/revealing, the record form and an unconfigured503 response that retained entered text. The shared-list/detail and narrow-width exercises used an isolated synthetic fixture. They are client rendering/interaction evidence only, not proof of a database write or two-user synchronization. Day/night More screenshots are retained as more-day.png and more-night.png. Escape restored focus to More; reduced-motion reset completed. A final browser check found stale old-card input rows after reset; invalidating the card-list cache repaired it. The synthetic controller fixture reproduced three rows before reset and verified zero rows plus disabled save afterwards. Browser error/warning capture was empty for the observed main-page flow.

## Remaining evidence limits

Dedicated cloud provisioning and Production-only server binding subsequently completed under explicit user approvals. The schema migration and real-Neon service harness passed: create/readback, second synthetic identity visibility, retries/conflict, concurrent deduplication, pagination and a fresh database connection. Exact fixtures were cleaned and the zero-row baseline verified. The later stage2.5.3 release additionally verified the owner's existing hosted login, one synthetic save and full-page-refresh readback. Mimi's own login, pending-request recovery across page closure, user visual acceptance and full phone/performance qualification remain unverified. Fixture records are not the user's real history. Continue only from the current authority and next action recorded in STATE.md.
