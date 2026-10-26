# stage2.4.16 — Glass-only enlargement

Derived from governance/STATE.md stage2.4.16 after checkpoint9 (73b2fa4d). Supporting evidence only; DESIGN.md revision20 owns the candidate design.

The user accepted trial12 at75d45f19 and requested a slightly larger glass slab with everything else retained. GLASS_WIDTH/GLASS_LENGTH enlarge the body and rim by5% in each horizontal dimension, from14.8×11.2 to15.54×11.76 (10.25% more area). Only its floor-shadow footprint follows this enlargement. Camera fit and all playing dimensions remain unchanged, so the cards are not made smaller by an automatic zoom-out. Materials, thickness, height, center, lights, room/cutaway/blur, controls and motion source are unchanged.

Native browser day/night review at1280×720 retains the complete rounded outline and the existing card scale. before.png and after.png show the same default camera; reloading prepares a fresh random fan, so card identities/fan jitter are not pixel-identical. The existing geometry/projection checks passed before the full project checks. No new low-impact mirror tests were added; the existing glass-extent expectation follows the new physical dimensions.

The user subsequently accepted this size and authorized commit/push under STATE.md stage2.4.17. This evidence remains for the unchanged implementation. Production entry integration and source-cottage edits are outside this publication slice.

Final verification:130 study tests, both prototype builds and pnpm check:all passed (including15 access tests). Native drag/reveal completed and day/night review retained the full outline at1280×720. Browser warning/error log empty;65 inherited dirty files unchanged. No shader, color pipeline or optics parameters changed, so the previous8-case GPU color evidence remains applicable; it was not redundantly rerun.
