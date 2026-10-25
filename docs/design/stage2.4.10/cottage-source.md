# Cottage environment source and adaptation

Derived from `governance/STATE.md` stage2.4.10. This file records only the source and adaptation boundary for `prototypes/shuffle-study/reading-room.mjs`; it is not a parallel plan or acceptance record.

The user explicitly asked to inspect and reuse elements from 萱敏小屋 in the local Tarot prototype. Source checkout: `/Users/anoria/Documents/python_coding/small_project/萱敏小屋`. Inspected source revision: `e71fe3fafe7aa4ab4074a6e32669e3b76779101a`, clean at inspection on 2026-10-26. The source project was read only. No source assets, credentials, photographs, application addresses, characters, external-access configuration, or personal content were copied.

## Actual source and bounded reuse

| Source | Reused and adapted |
| --- | --- |
| `web/src/scene/Architecture.tsx` | Deterministic staggered oak algorithm (seed1605), generated distant skyline motif (seed4507), folded-curtain geometry, cream room structure, charcoal full-height window/mullion arrangement. Textures are locally generated and skyline is deliberately softened. |
| `web/src/scene/Furniture.tsx` | `Plant` curved-leaf profile (lines187–210), refined with a rounder outline and softer twist, rod branching, subdued green/sage/rose material roles; right-side sofa arrangement and proportions (lines299–317). Plain Three.js primitives replace its React components. |
| `web/src/scene/RoomLighting.tsx` and `web/src/core/daylight.ts` | Warm day/cool night environment relationship informed the adaptation. Their clock, runtime, lights, and application state are not imported. Tarot continues to own its foreground light/camera and appearance preference; the isolated background group includes its own bounded static day/night illumination. |

The original room is code-generated geometry, not a room `.blend`/`.glb` export. It uses y-up, a10×9.6 floor, backwindowz=-4.59 and rightsofax4.1. This adapted room has a34×37 oak region at y=-2.8 beneath the unchanged Tarot table, a softly painted window view at z=-15.1, room-boundary geometry and an off-table sofa. It is a recognizable curated environment, not a claim of byte-identical cottage runtime or identical physical proportions. The original role-based room navigation, people, cats and UI are omitted.

The restrained low stone dish and three pebbles are newly authored geometry based on the user's supplied concept. No existing stone-dish model was found in the inspected cottage scene. An initial high stand was removed after rendered review; the dish rests on the room floor. The small leaf sprig adapts cottage leaves and stays outside the table footprint. Window/leaf light texture is a static illustrative lighting layer, not ray-traced foliage caustics. No decorative object receives an interaction handler.

## Source fingerprints

SHA-256 at inspection:

- Architecture.tsx: `99ef11f16c66ccca13eb4d38f9b2482fe269abc4597328ed387f9bc97ae32c61`
- Furniture.tsx: `c3e86a2cff3430d6326509b427695b71b1ab80e31d9fe8faf16fb3f57df4013a`
- RoomLighting.tsx: `1cb056a362407fb0bf905218aa910f85ee62360603d29633a629d518481e8657`
- core/daylight.ts: `f892efbc354f490311f053faa08a57a83ebf646e355085c80987d1636ca5ca1b`

## Tool and evidence limits

Cottage's documented Blender work refined avatar assets using a local background CLI. Its `design/models/mimi-blender/README.md` explicitly records no separate MCP service. This environment adaptation does not run Blender, import its avatar models, or modify the source project. It introduces no runtime package dependency. The final day room uses cooler oak and softer window contrast; the night room uses lower environmental illumination. Static floor-shadow and broken caustic textures approximate the raised table's light relationship; they are not ray-traced optical evidence. The module returns separate background `group` and sharp-prop `foreground` groups with one resource owner, allowing room-only blur without changing original card rendering. Rendering is a local candidate; actual composition, materials and gameplay are verified in the parent stage evidence rather than inferred from source reuse.
