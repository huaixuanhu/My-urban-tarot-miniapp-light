# Urban Tarot design owner

Design revision: 1. Status: observed legacy implementation; future replacement direction unresolved. Source: commit a190b14359172a0209feb17a7df26f117cb78ccd and source inspection on 2026-10-22. Replaces: no recovered prior design-owner revision. Verification: source inspection and a desktop browser rendering through the protected production entry on 2026-10-22; no historical user acceptance or mobile usability acceptance is asserted.

The user describes the app as an early demo and wants a later comprehensive reconstruction to make it playable. This is the confirmed product intent; the present migration does not choose the replacement design.

Observed composition: full-height dark violet reading board, lower spread deck, gold title and controls, card art and sound effects. Home.tsx prioritizes the reading area above the deck; index.css declares Cormorant Garamond, Source Sans 3, and Cinzel font roles. These are observed implementation choices, not newly approved reusable rules.

Observed interaction: draw and move cards, reveal cards, view details, random upright/reversed orientation, shuffle/reset, clear board, and help. The source describes drag and triple-click behavior; phone, keyboard, focus, empty, error, reduced-motion, and accessibility quality remain to be evaluated in the reconstruction scope.

Owners: client/src/pages/Home.tsx, client/src/components/SpreadDeck.tsx, TarotCard.tsx, CardDetailModal.tsx, client/src/index.css, and client/src/contexts/TarotContext.tsx. ideas.md is retained historical material, without inferred approval.

For the next design phase, agree on the main play loop, intended users, desktop/phone inputs, session persistence, and interaction states before implementing a replacement. Advance this revision only when the design contract itself changes; record acceptance and verification separately.
