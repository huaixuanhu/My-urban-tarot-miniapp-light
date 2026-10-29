import * as THREE from 'three';
import { CARD_COUNT } from './motion.mjs';
import { createReadingReset, sampleReadingResetPose, READING_RESET_DURATION_MS as RESET_DURATION_MS, readingShuffleProgressAt as shuffleProgressAt } from './reading-reset.mjs';
import { createCardGeometry, applyCardFlex } from './card-geometry.mjs';
import { sampleFlex } from './flex.mjs';
import { createReadingSceneStyle } from './reading-scene-style.mjs';
import { createAppearancePreference } from './reading-appearance.mjs';
import { createReading, reduceReading, canUndo } from './reading-state.mjs';
import { createReadingCardFace } from './reading-art.mjs';
import { readingCardLabel, createCardLoader, mayFinishReveal } from './reading-content.mjs';
import { createReadingReader } from './reading-reader.mjs';
import { createReadingDisclosures } from './reading-disclosures.mjs';
import { createReadingRecords } from './reading-records.mjs';
import { createReadingAI } from './reading-ai.mjs';
import { createReadingRandom } from './reading-random.mjs';
import { initializeInlineHelp, disposeHelpTips } from './reading-help.mjs';
import { DEFAULT_VIEW, dragView, isDefaultView, clampView, wheelZoom, ZOOM_LIMITS } from './reading-view.mjs';
import { createReadingProjection } from './reading-projection.mjs';
import { createScreenGlass } from './reading-screen-glass.mjs';
import { createReadingRoom } from './reading-room.mjs';
import { createReadingRoomPass } from './reading-room-pass.mjs';
import { canPlaceAt, clampPlacement } from './reading-layout.mjs';
import { pickFan } from './reading-picking.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { readingTablePose, sampleSideRevealPose, REVEAL_DURATION_MS } from './reading-reveal.mjs';

const $ = id => document.getElementById(id);
const ids = Array.from({ length: CARD_COUNT }, (_, id) => id);
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
$('reduce').checked = reducedPreference.matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = t => { const u = clamp(t, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const mixPose = (a, b, t) => Object.fromEntries(['x', 'y', 'z', 'rx', 'ry', 'rz'].map(key => [key, a[key] + (b[key] - a[key]) * t]));
// The original shuffle interleaves its two halves before opening the fan.
const interleaved = order => Array.from({ length: CARD_COUNT }, (_, i) => order[i % 2 === 0 ? i / 2 : 39 + (i - 1) / 2]);
function freshReading(deck) {
  return { ...createReading({ order: interleaved(deck.order), reversed: deck.reversed }), randomness: structuredClone(deck.randomness) };
}
// An unprepared table is visual staging only; it cannot supply drawable cards.
let reading = createReading(), readingReady = false, preparingReset = false;
let readingFan = createReadingFan(reading.order);
let scene, camera, projection, renderer, meshes, outline, resizeObserver, sceneStyle, screenGlass, room, roomPass;
let appearanceController, disclosures, recordsController, aiController, randomController;
let scheduled = 0, failed = false, disposed = false, reset = null, drag = null, hoverId = null, deckFocusId = reading.order[0], lastTap = null;
let noticeText = '', noticeUntil = 0, noticeTimer = null;
const flips = new Map(), currentPoses = new Map(), pendingReveals = new Map();
let round = 0, readerFocusRequest = null;
const updateReader = createReadingReader($('reader'));
const loadFace = createCardLoader(async id => {
  const canvas = await createReadingCardFace(id);
  // Keep the original illustration color independent of day/night scene lighting.
  const material = new THREE.MeshBasicMaterial({ map: texture(canvas), toneMapped: false });
  meshes[id].material[1] = material;
  return material;
});
const hoverOffsets = ids.map(() => ({ x: 0, y: 0 }));
let previousFrameTime = 0, view = { ...DEFAULT_VIEW }, viewDrag = null, viewTransition = null, zoomTarget = 1;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
const SETTLE_MS = 520;

function fanPose(ordinal, fan = readingFan) { return { ...fan[ordinal] }; }
function placedInOrder() { return Object.values(reading.placed).sort((a, b) => a.drawOrder - b.drawOrder); }
function tablePose(card) {
  const layers = Object.values(reading.placed).sort((a, b) => a.zIndex - b.zIndex);
  return readingTablePose(card, reading.reversed[card.id], layers.findIndex(item => item.id === card.id));
}
function texture(canvas) {
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return result;
}
const tableBusy = () => !!reset || preparingReset || failed;
const isOpened = card => !!card?.faceUp && !flips.has(card.id);
function invalidate() { if (!scheduled && !failed && !document.hidden) scheduled = requestAnimationFrame(frame); }
function dispatch(action) {
  if (tableBusy() || !readingReady) return false;
  const before = reading;
  reading = reduceReading(reading, action);
  if (reading === before) return false;
  // Prepare only drawn cards; loading never changes identity or reveals a face.
  if (action.type === 'draw') loadFace(action.id).catch(() => {});
  noticeText = '';
  if (deckFocusId === null || reading.placed[deckFocusId]) deckFocusId = reading.order.find(id => !reading.placed[id]) ?? null;
  updateUI(); invalidate(); return true;
}
function announce(text) {
  noticeText = text; noticeUntil = performance.now() + 2500;
  $('progress').textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { noticeText = ''; updateUI(); }, 2500);
}
function updateUI() {
  recordsController?.update();
  randomController?.update();
  $('records-body').inert = preparingReset || !!reset;
  $('ai-body').inert = preparingReset || !!reset;
  const placed = placedInOrder(), opened = placed.filter(isOpened).length;
  const selected = reading.placed[reading.selectedId];
  const busy = tableBusy();
  $('table').classList.toggle('is-resetting', !!reset);
  $('table').classList.toggle('has-cards', placed.length > 0);
  $('table').dataset.readingState = failed ? 'error' : reset ? 'resetting' : isOpened(selected) ? 'revealed' : placed.length ? 'hidden' : 'empty';
  $('reset-message').hidden = !reset;
  $('counts').textContent = `已抽 ${placed.length} · 已揭示 ${opened}`;
  $('dock-count').textContent = `已揭示 ${opened} 张`;
  $('instruction').textContent = !readingReady ? '点击「开始」准备这一轮牌。' : placed.length ? '自由摆放 · 双击翻开' : '从牌带拖出一张，放在你想放的位置。';
  $('selected-label').textContent = selected ? (isOpened(selected) ? `${readingCardLabel(selected.id)} · ${reading.reversed[selected.id] ? '逆位' : '正位'}` : `已选第 ${placed.indexOf(selected) + 1} 张 · ${flips.has(selected.id) ? '正在翻开' : '未翻开'}`) : '选中一张桌上的牌';
  $('reveal').hidden = isOpened(selected);
  $('meaning').hidden = !isOpened(selected);
  $('meaning').disabled = busy;
  $('return').hidden = !selected || selected.faceUp;
  $('reveal').textContent = pendingReveals.has(selected?.id) ? '准备牌面…' : flips.has(selected?.id) ? '正在翻开' : '翻开';
  $('reveal').disabled = busy || !selected || selected.faceUp || pendingReveals.has(selected?.id);
  $('return').disabled = busy || !selected || selected.faceUp || pendingReveals.has(selected?.id);
  $('undo').disabled = busy || !canUndo(reading);
  $('arrange').disabled = busy || placed.length < 3 || flips.size > 0;
  $('reset').disabled = busy;
  $('reset').innerHTML = readingReady ? '<span aria-hidden="true">↻</span> 重洗' : '<span aria-hidden="true">↻</span> 开始';
  $('view-home').disabled = busy || (isDefaultView(view) && zoomTarget === 1 && !viewTransition);
  $('zoom-in').disabled = busy || zoomTarget >= ZOOM_LIMITS.max;
  $('zoom-out').disabled = busy || zoomTarget <= ZOOM_LIMITS.min;
  $('zoom-level').textContent = `${Math.round(view.zoom * 100)}%`;
  $('reduce').disabled = failed;
  for (const id of ['previous', 'next', 'place']) $(id).disabled = busy || !readingReady || deckFocusId === null;
  $('deck-position').textContent = deckFocusId === null ? '牌带已空' : `第 ${reading.order.indexOf(deckFocusId) + 1} / 78 张`;
  $('deck-hint').textContent = !readingReady ? '先开始洗牌，再沿牌带挑选' : hoverId !== null && !reading.placed[hoverId] ? `第 ${reading.order.indexOf(hoverId) + 1} 张 · 按住拖到桌面` : '沿牌带挑选 · 按住拖出';
  $('progress').textContent = preparingReset ? '正在准备本轮随机牌序…' : reset ? '正在洗牌…' : !readingReady ? '随机来源可在「更多」中选择' : placed.length === 0 ? '拖出抽牌 · 双击翻开' : opened === placed.length ? '点选一张，看看它带来的线索。' : `已揭示 ${opened} / ${placed.length} 张`;
  if (!reset && noticeText && performance.now() < noticeUntil) $('progress').textContent = noticeText;
  const list = $('placed-list');
  const signature = placed.map(card => `${card.id}:${isOpened(card)}:${card.id === reading.selectedId}`).join('|');
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    const existing = new Map([...list.querySelectorAll('button')].map(button => [Number(button.dataset.cardId), button]));
    for (const [id, button] of existing) if (!reading.placed[id]) button.parentElement.remove();
    for (const [index, card] of placed.entries()) {
      let button = existing.get(card.id);
      if (!button) {
        const item = document.createElement('li'); button = document.createElement('button');
        button.dataset.cardId = String(card.id);
        button.addEventListener('click', () => { if (!reset) dispatch({ type: 'select', id: card.id }); });
        button.addEventListener('dblclick', () => reveal(card.id));
        item.append(button); list.insertBefore(item, list.children[index] || null);
      }
      button.textContent = isOpened(card) ? `${readingCardLabel(card.id)} · ${reading.reversed[card.id] ? '逆位' : '正位'}` : `第 ${index + 1} 张 · 未翻开`;
      button.setAttribute('aria-pressed', String(card.id === reading.selectedId));
    }
  }
  list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  updateReader(reading, { resetting: !!reset, revealing: flips.has(selected?.id), loading: pendingReveals.has(selected?.id), failed });
  if (readerFocusRequest) {
    if (busy || selected?.id !== readerFocusRequest.id || round !== readerFocusRequest.round) readerFocusRequest = null;
    else if (isOpened(selected)) {
      // A keyboard-activated reveal leaves a disappearing control. Continue at
      // its result only if the user has not moved focus to another control.
      if (document.activeElement === document.body || document.activeElement === $('reveal')) $('meaning').focus({ preventScroll: true });
      readerFocusRequest = null;
    }
  }
}

function frame(now) {
  scheduled = 0;
  if (failed || !meshes) return;
  let animating = false;
  const elapsedFrame = Math.min(40, previousFrameTime ? now - previousFrameTime : 16);
  const hoverBlend = 1 - Math.exp(-elapsedFrame / 60);
  previousFrameTime = now;
  if (viewTransition) {
    const u = clamp((now - viewTransition.started) / 320, 0, 1), t = smooth(u);
    const { from, to } = viewTransition;
    applyView(Object.fromEntries(['zoom', 'yaw', 'elevation'].map(key => [key, from[key] + (to[key] - from[key]) * t])));
    if (u === 1) { viewTransition = null; applyView(to); if (reset) reset.lastTime = now; updateUI(); }
    else animating = true;
  }
  if (!viewTransition && !reset && Math.abs(view.zoom - zoomTarget) > 0) {
    const next = Math.abs(view.zoom - zoomTarget) < 0.0005 ? zoomTarget : view.zoom + (zoomTarget - view.zoom) * (1 - Math.exp(-elapsedFrame / 85));
    applyView({ ...view, zoom: next }); updateUI();
    if (next !== zoomTarget) animating = true;
  }
  if (reset) {
    // Zoom out enough for the shuffle while retaining the chosen viewing direction.
    if (viewTransition) reset.lastTime = now;
    reset.elapsed += Math.max(0, now - reset.lastTime); reset.lastTime = now;
    if (reset.elapsed >= RESET_DURATION_MS + SETTLE_MS) finishReset();
    else {
      animating = true;
    }
  }
  for (const id of ids) {
    let pose, flex = sampleFlex(0, 0);
    if (reset) {
      const elapsed = Math.min(reset.elapsed, RESET_DURATION_MS);
      pose = sampleReadingResetPose(id, elapsed, reset.run);
      flex = sampleFlex(reset.run.motion.slotById[id], shuffleProgressAt(elapsed));
      if (reset.elapsed > RESET_DURATION_MS) pose = mixPose(pose, fanPose(reset.next.order.indexOf(id), reset.nextFan), smooth((reset.elapsed - RESET_DURATION_MS) / SETTLE_MS));
    } else {
      const card = reading.placed[id];
      pose = card ? tablePose(card) : fanPose(reading.order.indexOf(id));
      const hover = !card && !drag && !viewDrag && hoverId !== null && !reading.placed[hoverId];
      const delta = hover ? reading.order.indexOf(id) - reading.order.indexOf(hoverId) : 0;
      const offset = hoverOffsets[id];
      const targetX = hover ? Math.sign(delta) * 0.32 * Math.exp(-Math.abs(delta) / 7) : 0;
      const targetY = hover && id === hoverId ? 0.085 : 0;
      const blend = $('reduce').checked ? 1 : hoverBlend;
      offset.x += (targetX - offset.x) * blend; offset.y += (targetY - offset.y) * blend;
      if (Math.abs(targetX - offset.x) + Math.abs(targetY - offset.y) > 0.0005) animating = true;
      else { offset.x = targetX; offset.y = targetY; }
      // Lift only a little, keeping the original fan angle and depth. Nearby
      // cards ease apart; the selected card never swings out as a whole panel.
      if (!card) { pose.x += offset.x; pose.y += offset.y; }
      if (drag?.started && drag.id === id) pose = { ...pose, x: drag.point.x, z: drag.point.z, y: Math.max(0.35, pose.y + 0.20), rz: card ? pose.rz : 0 };
      if (flips.has(id)) {
        const flip = flips.get(id), u = clamp((now - flip.started) / REVEAL_DURATION_MS, 0, 1);
        pose = sampleSideRevealPose(pose, u, flip.direction);
        if (u < 1) animating = true;
        else { flips.delete(id); updateUI(); }
      }
    }
    const mesh = meshes[id];
    if (mesh.userData.angle !== flex.angle || mesh.userData.layer !== flex.layerOffset || mesh.userData.side !== flex.side) {
      applyCardFlex(mesh.geometry, flex);
      Object.assign(mesh.userData, { angle: flex.angle, layer: flex.layerOffset, side: flex.side });
    }
    mesh.position.set(pose.x, pose.y, pose.z); mesh.rotation.set(pose.rx, pose.ry, pose.rz, 'XYZ');
    currentPoses.set(id, pose);
  }
  const selected = reading.placed[reading.selectedId];
  outline.visible = !!selected && !reset && !drag?.started && !flips.has(selected.id);
  if (outline.visible) {
    const pose = currentPoses.get(selected.id);
    outline.position.set(pose.x, pose.y + 0.024, pose.z);
  }
  if (roomPass) {
    room.update(camera);
    roomPass.render(camera); scene.background = roomPass.texture;
    // Day retains the cottage's .95 exposure. Night lowers only the room's
    // exposure for quiet contrast behind the light controls and original art.
    // Background intensity precedes the single ACES pass.
    scene.backgroundIntensity = (room.group.userData.appearance === 'dark' ? .24 : .95) / renderer.toneMappingExposure;
  }
  if (screenGlass) screenGlass.render(scene, camera);
  else renderer.render(scene, camera);
  if (animating) invalidate();
}

async function reveal(id) {
  if (failed || reset || preparingReset || !readingReady || drag?.started || pendingReveals.has(id) || !reading.placed[id] || reading.placed[id].faceUp) return;
  const request = { id, round, drawOrder: reading.placed[id].drawOrder };
  pendingReveals.set(id, request); updateUI();
  try {
    await loadFace(id);
    if (failed || reset || preparingReset || !readingReady || drag?.started || !mayFinishReveal(reading, request, round)) return;
    if (!$('reduce').checked) flips.set(id, { started: performance.now(), direction: crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? -1 : 1 });
    dispatch({ type: 'reveal', id });
  } catch {
    if (mayFinishReveal(reading, request, round) && !reset) announce('牌图暂时没有载入。再点「翻开」可重试，仍是这张牌。');
  } finally {
    if (pendingReveals.get(id) === request) pendingReveals.delete(id);
    updateUI();
  }
}
async function beginReset() {
  if (tableBusy() || disposed || !randomController || currentPoses.size !== CARD_COUNT) return;
  if (!aiController?.mayReset() || !recordsController?.mayReset()) return;
  preparingReset = true; cancelDrag(); lastTap = null; hoverId = null;
  disclosures.closeAll({ motion: false });
  updateUI();
  try {
    const deck = await randomController.prepareDeck();
    if (disposed || failed || !deck) return;
    // Construct and validate everything before touching the existing reading.
    const next = freshReading(deck), order = deck.order;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]; // Motion only.
    const snapshot = ids.map(id => ({ id, ...currentPoses.get(id) }));
    const run = createReadingReset({ seed, order, snapshot, deckIds: reading.order.filter(id => !reading.placed[id]) });
    const nextFan = createReadingFan(next.order, seed);
    $('reader-details').open = false;
    round += 1; pendingReveals.clear(); noticeText = '';
    hoverOffsets.forEach(offset => { offset.x = 0; offset.y = 0; });
    reset = { elapsed: 0, lastTime: performance.now(), run, next, nextFan };
    flips.clear();
    transitionView({ ...view, zoom: 1 });
    if ($('reduce').checked) finishReset();
  } catch (error) {
    if (!disposed) { announce(error.message || '随机牌序暂时无法准备，当前牌桌已保留。'); disclosures.open('reading-random'); }
  } finally {
    preparingReset = false;
    if (!disposed) { updateUI(); invalidate(); }
  }
}
function finishReset() {
  if (!reset) return;
  viewTransition = null; zoomTarget = 1; applyView({ ...view, zoom: 1 });
  reading = reset.next; readingReady = true; readingFan = reset.nextFan; reset = null; hoverId = null; lastTap = null;
  aiController?.reset();
  recordsController?.reset();
  updateControlBounds();
  hoverOffsets.forEach(offset => { offset.x = 0; offset.y = 0; });
  deckFocusId = reading.order[0]; flips.clear(); updateUI(); invalidate();
}
function ray(event) {
  const box = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function planePoint(event) {
  ray(event); const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(tablePlane, point) ? point : null;
}
function deckAt(event) {
  ray(event);
  return pickFan(raycaster.ray, reading.order.map((id, index) => ({ id, pose: fanPose(index) })).filter(item => !reading.placed[item.id]));
}
function pick(event) {
  ray(event);
  const placed = Object.values(reading.placed).map(card => meshes[card.id]);
  const hit = raycaster.intersectObjects(placed, false)[0];
  return hit ? hit.object.userData.id : deckAt(event);
}
function validDrop(event, point) {
  const box = renderer.domElement.getBoundingClientRect();
  return canPlaceAt(point) && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top + 82 && event.clientY <= box.bottom;
}
function cancelDrag() {
  if (viewDrag) {
    const action = viewDrag; viewDrag = null; applyView(action.startView);
    if (renderer.domElement.hasPointerCapture(action.pointerId)) renderer.domElement.releasePointerCapture(action.pointerId);
    renderer.domElement.style.cursor = 'grab'; lastTap = null; updateUI(); invalidate();
  }
  if (!drag) return;
  const capture = drag.pointerId; drag = null; lastTap = null;
  if (renderer.domElement.hasPointerCapture(capture)) renderer.domElement.releasePointerCapture(capture);
  renderer.domElement.style.cursor = 'grab'; updateUI(); invalidate();
}
function onPointerDown(event) {
  if (tableBusy() || event.button !== 0 || drag || viewDrag) return;
  viewTransition = null; zoomTarget = view.zoom;
  const id = readingReady ? pick(event) : null;
  if (id === null) {
    lastTap = null; hoverId = null;
    viewDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startView: { ...view }, started: false };
    renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.focus({ preventScroll: true });
    renderer.domElement.style.cursor = 'grabbing'; event.preventDefault(); updateUI(); invalidate(); return;
  }
  if (flips.has(id) || pendingReveals.has(id)) return;
  const point = planePoint(event), origin = reading.placed[id];
  if (!point) return;
  if (origin) dispatch({ type: 'select', id });
  else { deckFocusId = id; dispatch({ type: 'select', id: null }); }
  drag = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false, fromDeck: !origin, point,
    offsetX: origin ? origin.x - point.x : 0, offsetZ: origin ? origin.z - point.z : 0 };
  renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.focus({ preventScroll: true });
  event.preventDefault(); updateUI();
}
function onPointerMove(event) {
  if (tableBusy()) return;
  if (viewDrag) {
    if (event.pointerId !== viewDrag.pointerId) return;
    updateViewDrag(event); return;
  }
  if (drag) {
    if (event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) { drag.started = true; lastTap = null; }
    const point = planePoint(event);
    if (point) drag.point = { x: point.x + drag.offsetX, z: point.z + drag.offsetZ };
    if (drag.started) renderer.domElement.style.cursor = 'grabbing';
    invalidate(); return;
  }
  const id = readingReady ? pick(event) : null;
  if (id !== hoverId) { hoverId = id; renderer.domElement.style.cursor = 'grab'; updateUI(); invalidate(); }
}
function onPointerUp(event) {
  if (viewDrag?.pointerId === event.pointerId) {
    updateViewDrag(event); const action = viewDrag; viewDrag = null;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'grab';
    if (!action.started) dispatch({ type: 'select', id: null });
    updateUI(); invalidate(); return;
  }
  if (!drag || event.pointerId !== drag.pointerId) return;
  const action = drag; drag = null;
  action.started ||= Math.hypot(event.clientX - action.startX, event.clientY - action.startY) > 7;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  renderer.domElement.style.cursor = 'grab';
  let notice = '';
  if (action.started) {
    lastTap = null;
    const point = planePoint(event);
    const target = point && { x: point.x + action.offsetX, z: point.z + action.offsetZ };
    if (validDrop(event, target)) {
      dispatch({ type: action.fromDeck ? 'draw' : 'move', id: action.id, ...clampPlacement(target) });
      hoverId = null;
    } else notice = '未放到桌面，已回到原位。';
  } else if (!action.fromDeck) {
    const now = performance.now();
    if (lastTap?.id === action.id && now - lastTap.at < 360) { reveal(action.id); lastTap = null; }
    else lastTap = { id: action.id, at: now };
  } else { deckFocusId = action.id; lastTap = null; }
  updateUI(); if (notice) announce(notice); invalidate();
}
function stepDeck(direction) {
  if (tableBusy() || !readingReady) return;
  const available = reading.order.filter(id => !reading.placed[id]);
  if (!available.length) return;
  const index = available.indexOf(deckFocusId);
  deckFocusId = available[(index + direction + available.length) % available.length];
  hoverId = deckFocusId; dispatch({ type: 'select', id: null }); updateUI(); invalidate();
}
function placeFocused() {
  if (tableBusy() || !readingReady || deckFocusId === null) return;
  const index = Object.keys(reading.placed).length;
  dispatch({ type: 'draw', id: deckFocusId, x: [-2, 0, 2][index % 3], z: -0.7 + Math.floor(index / 3) % 8 * 0.16 });
  hoverId = null;
}
function updateProjection() {
  const box = $('scene').getBoundingClientRect();
  camera = projection.update(view, { width: box.width, height: box.height });
  updateControlBounds();
}
function updateControlBounds() {
  const box = $('scene').getBoundingClientRect();
  const dock = document.querySelector('.main-controls').getBoundingClientRect();
  // This is a screen-space control surface; orbit, shuffle and zoom never move it.
  screenGlass?.setBounds({ left: dock.left - box.left, top: dock.top - box.top,
    width: dock.width, height: dock.height, viewportWidth: box.width, viewportHeight: box.height });
  const style = document.documentElement.style;
  const center = dock.left + dock.width / 2;
  style.setProperty('--dock-center-x', `${center}px`);
  style.setProperty('--dock-hint-top', `${Math.max(130, dock.top - 29)}px`);
  style.setProperty('--dock-caption-top', `${Math.min(box.height - 27, dock.bottom + 13)}px`);
  style.setProperty('--popover-left', `${clamp(center, Math.min(282, box.width / 2), Math.max(box.width - 282, box.width / 2))}px`);
  style.setProperty('--popover-bottom', `${clamp(box.height - dock.top + 18, 95, box.height - 180)}px`);
}
function applyView(next) {
  view = clampView(next);
  updateProjection(); invalidate();
}
function transitionView(target) {
  const to = clampView(target);
  zoomTarget = to.zoom;
  if ($('reduce').checked || ['zoom', 'yaw', 'elevation'].every(key => Math.abs(view[key] - to[key]) < 0.00001)) {
    viewTransition = null; applyView(to);
  } else viewTransition = { from: { ...view }, to, started: performance.now() };
  updateUI(); invalidate();
}
function homeView() {
  cancelDrag(); hoverId = null; lastTap = null;
  transitionView(DEFAULT_VIEW);
}
function updateViewDrag(event) {
  const dx = event.clientX - viewDrag.startX, dy = event.clientY - viewDrag.startY;
  viewDrag.started ||= Math.hypot(dx, dy) > 5;
  if (viewDrag.started) { applyView(dragView(viewDrag.startView, dx, dy)); updateUI(); }
}
function changeZoom(deltaY, deltaMode = 0) {
  if (tableBusy() || drag || viewDrag) return;
  if (viewTransition) zoomTarget = view.zoom;
  viewTransition = null; hoverId = null; lastTap = null;
  zoomTarget = wheelZoom(zoomTarget, deltaY, deltaMode, renderer.domElement.getBoundingClientRect().height);
  if ($('reduce').checked) applyView({ ...view, zoom: zoomTarget });
  updateUI(); invalidate();
}
function onWheel(event) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  changeZoom(event.deltaY, event.deltaMode);
}
function fit() {
  if (!renderer || failed) return;
  cancelDrag(); if (!viewTransition) zoomTarget = view.zoom;
  const box = $('scene').getBoundingClientRect();
  updateProjection(); updateControlBounds(); renderer.setSize(box.width, box.height); invalidate();
}
function fail(error) {
  if (disposed) return;
  failed = true; cancelAnimationFrame(scheduled); scheduled = 0;
  $('loading').hidden = true; $('failure').hidden = false; updateUI();
  console.error('Augurwell local reading study:', error);
}

async function startReading() {
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  $('scene').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('Graphics context lost')); });
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '牌桌：拖出抽牌，拖动摆放，双击翻开；拖动空白处调整视角，滚轮拉近拉远，Shift 加方向键调视角，加减键缩放。也可打开牌桌工具逐张挑牌。');
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x111815); scene.fog = new THREE.FogExp2(0x111815, 0.035);
  projection = createReadingProjection();
  applyView(DEFAULT_VIEW);
  sceneStyle = createReadingSceneStyle(scene, renderer, texture);
  room = await createReadingRoom(renderer);
  if (disposed || failed) { room.dispose(); return; }
  scene.add(room.foreground);
  roomPass = createReadingRoomPass(renderer, room.group);
  screenGlass = createScreenGlass(renderer);
  meshes = ids.map(id => { const mesh = new THREE.Mesh(createCardGeometry(), [...sceneStyle.materials]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.id = id; scene.add(mesh); return mesh; });
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.69, 0, -1.09), new THREE.Vector3(0.69, 0, -1.09), new THREE.Vector3(0.69, 0, 1.09), new THREE.Vector3(-0.69, 0, 1.09)]);
  outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({ color: 0xd2b882, transparent: true, opacity: 0.8 })); scene.add(outline);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', cancelDrag);
  renderer.domElement.addEventListener('lostpointercapture', event => {
    if ((drag?.pointerId === event.pointerId || viewDrag?.pointerId === event.pointerId) && !renderer.domElement.hasPointerCapture(event.pointerId)) cancelDrag();
  });
  renderer.domElement.addEventListener('pointerleave', () => { if (!drag && !viewDrag) { hoverId = null; updateUI(); invalidate(); } });
  renderer.domElement.addEventListener('keydown', event => {
    if (!event.ctrlKey && !event.metaKey && ['+', '=', '-'].includes(event.key)) { event.preventDefault(); changeZoom(event.key === '-' ? 120 : -120); return; }
    if (event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); if (tableBusy()) return;
      cancelDrag(); viewTransition = null; zoomTarget = view.zoom; hoverId = null; lastTap = null;
      applyView(dragView(view, event.key === 'ArrowLeft' ? -28 : event.key === 'ArrowRight' ? 28 : 0, event.key === 'ArrowUp' ? 28 : event.key === 'ArrowDown' ? -28 : 0));
      updateUI(); return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepDeck(event.key === 'ArrowLeft' ? -1 : 1); }
    if (event.key === 'Enter') { event.preventDefault(); reading.selectedId !== null ? reveal(reading.selectedId) : placeFocused(); }
  });
  resizeObserver = new ResizeObserver(fit); resizeObserver.observe($('scene')); fit(); updateUI(); $('loading').hidden = true;
} catch (error) { fail(error); }

let appearanceStorage;
try { appearanceStorage = window.localStorage; } catch { /* Appearance stays usable without storage. */ }
appearanceController = createAppearancePreference({
  storage: appearanceStorage, mediaQuery: matchMedia('(prefers-color-scheme: dark)'),
  onChange({ preference, theme }) {
    document.documentElement.dataset.theme = theme;
    $('appearance').value = preference;
    sceneStyle?.apply(theme, outline);
    screenGlass?.applyAppearance(theme);
    room?.applyAppearance(theme); roomPass?.applyAppearance(theme);
    invalidate();
  },
});
$('appearance').addEventListener('change', event => appearanceController.set(event.target.value));

$('reveal').addEventListener('click', event => {
  if (event.detail === 0 && !$('reveal').disabled) readerFocusRequest = { id: reading.selectedId, round };
  reveal(reading.selectedId);
});
$('meaning').addEventListener('click', () => { $('reader-details').open = !$('reader-details').open; });
initializeInlineHelp(document);
disclosures = createReadingDisclosures({ document, reducedMotion: () => $('reduce').checked || reducedPreference.matches });
recordsController = createReadingRecords({ root: $('records-body'), getReading: () => reading, getBusy: () => tableBusy() || !readingReady || flips.size > 0 || pendingReveals.size > 0, disclosures });
aiController = createReadingAI({ root: $('ai-body'), getReading: () => reading, getBusy: () => tableBusy() || !readingReady || flips.size > 0 || pendingReveals.size > 0, records: recordsController, disclosures });
let operationStorage;
try { operationStorage = window.sessionStorage; } catch { /* In-page operation recovery remains available. */ }
randomController = createReadingRandom({ document, storage: appearanceStorage, operationStorage, getReading: () => reading, disclosures, onChange: () => { if (!disposed) updateUI(); } });
updateUI();
$('return').addEventListener('click', () => { if (!tableBusy()) { lastTap = null; dispatch({ type: 'return', id: reading.selectedId }); } });
$('undo').addEventListener('click', () => { if (!tableBusy()) { cancelDrag(); lastTap = null; dispatch({ type: 'undo' }); } });
$('arrange').addEventListener('click', () => { if (!tableBusy()) { cancelDrag(); dispatch({ type: 'arrange3', positions: [{ x: -2, z: -0.7 }, { x: 0, z: -0.7 }, { x: 2, z: -0.7 }] }); } });
$('reset').addEventListener('click', beginReset);
$('zoom-in').addEventListener('click', () => changeZoom(-120));
$('zoom-out').addEventListener('click', () => changeZoom(120));
$('view-home').addEventListener('click', () => { if (!tableBusy()) homeView(); });
$('skip').addEventListener('click', finishReset);
$('previous').addEventListener('click', () => stepDeck(-1));
$('next').addEventListener('click', () => stepDeck(1));
$('place').addEventListener('click', placeFocused);
$('reduce').addEventListener('change', () => { if ($('reduce').checked) { if (viewTransition) { const target = viewTransition.to; viewTransition = null; zoomTarget = target.zoom; applyView(target); } else applyView({ ...view, zoom: zoomTarget }); flips.clear(); if (reset) finishReset(); updateUI(); invalidate(); } });
$('retry').addEventListener('click', () => location.reload());
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if ($('reader-details').open) {
    $('reader-details').open = false; $('meaning').focus({ preventScroll: true });
  } else { cancelDrag(); dispatch({ type: 'select', id: null }); }
});
document.addEventListener('visibilitychange', () => {
  cancelDrag(); if (!viewTransition) zoomTarget = view.zoom;
  if (document.hidden) { cancelAnimationFrame(scheduled); scheduled = 0; }
  else { if (reset) reset.lastTime = performance.now(); invalidate(); }
});
}
addEventListener('pagehide', event => { cancelAnimationFrame(scheduled); scheduled = 0; if (!event.persisted) { disposed = true; appearanceController?.dispose(); disposeHelpTips(document); disclosures?.dispose(); randomController?.dispose(); aiController?.dispose(); recordsController?.dispose(); screenGlass?.dispose(); roomPass?.dispose(); room?.dispose(); sceneStyle?.dispose(); resizeObserver?.disconnect(); renderer?.dispose(); } });
startReading().catch(fail);
addEventListener('pageshow', () => { if (reset) reset.lastTime = performance.now(); invalidate(); });
