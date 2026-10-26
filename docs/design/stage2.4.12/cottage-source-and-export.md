# stage2.4.12 — Faithful static cottage source and export

Derived from `governance/STATE.md` stage2.4.12, within the local trial refinement authorized after checkpoint 7. This is bounded implementation evidence, not another current-state plan. Source authority for the cottage is its `plan_docs/PLAN.md` and `DESIGN.md`; their product and navigation behavior are outside this import.

## Source and fidelity boundary

The source cottage checkout was read-only and clean at `e71fe3fafe7aa4ab4074a6e32669e3b76779101a`. Its room is authored in Three.js/React components; no existing static full-room GLB or Blender room export was found. The previous tarot background's manual room approximation does not preserve all of this modeling.

The new build-only exporter mounts unchanged snapshots of the original `Architecture`, `Furniture`, and `ActivityChairs` components. Each source byte sequence is recorded in `prototypes/shuffle-study/cottage-export/source-manifest.json` and verified at server startup. The source project is not modified. The generated asset retains original geometry, placement, materials, and embedded procedural textures. This is exact static-model reuse; rendering parity still depends on lighting, camera, tone mapping, shadows, and how the room is composed behind the tarot table.

Included:

- Architecture: floor slab, wood planks, entry/bathroom tile, original cutaway walls and interior partitions, window glass and framing, roller blinds, curtains, and day/night city texture planes.
- Furniture: both work positions with curved monitors, keyboards and desk accessories; task and mathematical boards with wheels; sofa, cushions, draped throw and tablet; rug with fringe, coffee table, mugs, books, vase, plants; lucky-cat side table; original decorative tarot cards; bedroom furniture and textiles; bathroom fixtures; entry and shelves.
- Two desk chairs at the original unoccupied positions. `characters` is explicitly empty; no animated state is imported.
- Original procedural screen/wood/fabric/rug/board/city textures. No external image lookup is needed.

Excluded: avatars, walking cats, movement/navigation, destination rings, clickable app gates, private URL configuration, photo/avatar reference files, application state, and the original camera controller. GLB contains static scene data and no callbacks. No dependency installation, source-repo write, cloud deployment, or push is involved.

## Reproduce locally

From the tarot repository root:

```sh
node prototypes/shuffle-study/cottage-export/serve.mjs
```

It uses the sibling cottage's already-installed build dependencies. A different read-only installation can be specified with `COTTAGE_WEB_ROOT=/absolute/path/to/cottage/web`. It binds only `127.0.0.1:5175`; production code never imports this tool or its React/Fiber/Drei dependencies. Source snapshots make geometry independent of future cottage edits, while the tool currently expects the verified original dependency versions: Three.js `0.186.1`, React `19.3.0`, React Three Fiber `9.8.1`, Drei `10.7.9`.

Open `http://127.0.0.1:5175/`, inspect the original room, click **Export day GLB**, click **Switch to night**, then **Export night GLB**. Each palette waits eight rendered frames with reduced motion before export. The exporter embeds textures, reloads its generated GLB, and checks mesh count, vertex count, triangle count and world bounds. It writes only:

- `prototypes/shuffle-study/assets/cottage-day.glb`
- `prototypes/shuffle-study/assets/cottage-night.glb`
- `docs/design/stage2.4.12/cottage-day-export.json`
- `docs/design/stage2.4.12/cottage-night-export.json`

Each evidence JSON records the file SHA-256, byte size, original/reloaded scene inventory, bounds tolerance, source commit and lighting palette. The local save endpoint accepts only the matching local origin, validates the GLB envelope, and uses fixed output paths. Day/night assets contain the same modeling, with original window/city palette changes baked into their materials. Both preserve the city night layer, including day opacity zero.

## Integration contract

Use `GLTFLoader` from the existing Three.js dependency. Original coordinates remain metres: room x roughly `[-5, 5]`, z `[-4.6, 5]`, wood surface y `.002`. Retain one uniform room transform; do not reposition or individually rescale furniture to resemble the scene.

The original decorative tarot corner remains at `(1.6, .055, .48)`. The final floating-glass center is anchored at cottage `(1.1, .9, 0)`, with `.14` cottage metres per gameplay unit. The unchanged14.8-unit width is2.072 metres; the entire room uses one inverse uniform scale, with no individual furniture rescaling. This leaves the original sofa, rug, coffee table and floor cards in place. An initial `(1.6,.9,-.2)` / `.16` mapping was rejected because the camera could cross the back/side boundary at760×900. The final mapping passes1,440 sampled camera positions across four desktop sizes,72 yaw angles and five elevations. Phone portrait ratios are not qualified by this check.

An added soft floor-shadow plane represents the new floating glass over the original rug; it is not part of the exported source model. The room blur is reduced to1.25CSS pixels to retain recognizable furniture. Day retains the original.95 exposure; night uses.24 room exposure for foreground text contrast. A small edge-free light field supports floating reader text over plants and furniture. Original Urban Tarot face colors remain outside all room transforms/blur.

GLB does not preserve every Three.js runtime flag. The exporter embeds `userData.cottageRuntime` on meshes (`castShadow`, `receiveShadow`, `renderOrder`) and materials (`toneMapped`, `depthWrite`, `polygonOffset`, `polygonOffsetFactor`, `polygonOffsetUnits`). Restore these named properties explicitly after loading. In particular, original monitors/city use `toneMapped=false`, and curtains/city overlays use `depthWrite=false`. Do not apply these flags globally to Urban Tarot faces.

Original `RoomLighting.tsx` is included for preview/reference, outside the exported group. Reproduce its directional/hemisphere/ambient positions and palette values when integrating. The warm environment map and soft/contact shadows require explicit runtime setup; they are not included as GLB lighting. Preview uses a perspective camera for inspection, whereas the cottage's accepted default full-room view is orthographic. A matching model is not a claim that all render effects are bit-identical.

No simplified low-detail replacement is silently produced on load failure. Preserve the normal page shell and report/fallback deliberately if the local asset is unavailable.

## Observed exports and local cost

Both browser exports completed and reloaded successfully. Each has **645 meshes, 383,435 vertices, 158,560 triangles, 101 materials and 13 embedded textures**. Export/reload bounds were identical (maximum difference zero). The original bounds in metres are min `[-5.16964511239419, -.39000500440597535, -5.047640391245203]`, max `[5.140005111694336, 3.1449999976158143, 5.140000057220459]`.

| Theme | Bytes | SHA-256 |
| --- | ---: | --- |
| Day | 17,989,420 | `aa1f37fdebd630168bd2028d0826c409230d025e2e103bc59a97d338d4d9b9c8` |
| Night | 17,989,524 | `6208e7070eb7d4399de8ae637ab42bc54847bc4e4bb803e04c171fe0a52d6ff4` |

The two local files total **35,978,944 bytes (34.31 MiB)**. This is an intentional fidelity-first local prototype cost. Both are loaded once in parallel; switching appearance changes the visible root without another request. Only the visible theme renders, and the existing room background pass caches stable views. Decoded textures and two loaded scene graphs cost more memory than the compressed file bytes; no exact GPU memory or device-performance claim is made without measurement. Asset deduplication/compression can follow visual acceptance. No production publication is authorized by this local import.

`reading-room-assets.test.mjs` verifies recorded file hashes, embedded-only buffers/images, lack of animation/skin imports, all runtime extras, geometry and scene transforms identical between themes, and the uniform glass anchor. All three focused checks passed. Runtime creation rejects a missing or unexpected model instead of retaining the previous manual approximation.

`createReadingRoom(renderer)` is now asynchronous. It returns `group`, an intentionally empty `foreground`, `applyAppearance`, and `dispose`. The room pass should use `group.userData.environmentTexture` and `backgroundColor`; the latter is a stable Color object updated when appearance changes. Original ambient, hemisphere and directional lighting is owned by the room group. The warm two-plane environment is captured once at 128 pixels using the original Lightformer positions, rotations, scales, colors and intensities. Three's shadow flags are restored and the directional shadow frustum is scaled with the room. The original React soft-shadow shader patch and baked contact-shadow layer are not imported.
