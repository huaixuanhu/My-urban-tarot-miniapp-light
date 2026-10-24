import * as THREE from 'three';
import { CARD_COUNT, CARD_THICKNESS, shuffleDeck } from './motion.mjs';
import { createReadingReset, sampleReadingResetPose, READING_RESET_DURATION_MS as RESET_DURATION_MS, readingShuffleProgressAt as shuffleProgressAt } from './reading-reset.mjs';
import { createCardGeometry, applyCardFlex } from './card-geometry.mjs';
import { sampleFlex } from './flex.mjs';
import { createCardBack } from './textures.mjs';
import { createReading, reduceReading, canUndo } from './reading-state.mjs';
import { createReadingCardFace, readingCardLabel } from './reading-art.mjs';
import { DEFAULT_VIEW, VIEW_TARGET, dragView, getViewPosition, isDefaultView, clampView, getViewSize, wheelZoom, ZOOM_LIMITS } from './reading-view.mjs';
import { pickFan } from './reading-picking.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { createReadingCloth } from './reading-cloth.mjs';

const $ = id => document.getElementById(id);
const ids = Array.from({ length: CARD_COUNT }, (_, id) => id);
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
$('reduce').checked = reducedPreference.matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = t => { const u = clamp(t, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const mixPose = (a, b, t) => Object.fromEntries(['x', 'y', 'z', 'rx', 'ry', 'rz'].map(key => [key, a[key] + (b[key] - a[key]) * t]));
// The original shuffle interleaves its two halves before opening the fan.
const interleaved = order => Array.from({ length: CARD_COUNT }, (_, i) => order[i % 2 === 0 ? i / 2 : 39 + (i - 1) / 2]);
function freshReading(order = shuffleDeck(ids)) {
  const bytes = crypto.getRandomValues(new Uint8Array(CARD_COUNT));
  return createReading({ order: interleaved(order), reversed: [...bytes].map(byte => byte < 128) });
}
let reading = freshReading();
let readingFan = createReadingFan(reading.order);
let scene, camera, renderer, meshes, outline, resizeObserver;
let scheduled = 0, failed = false, reset = null, drag = null, hoverId = null, deckFocusId = reading.order[0], lastTap = null;
let noticeText = '', noticeUntil = 0, noticeTimer = null;
const flips = new Map(), faceMaterials = new Map(), currentPoses = new Map();
const hoverOffsets = ids.map(() => ({ x: 0, y: 0 }));
let previousFrameTime = 0, view = { ...DEFAULT_VIEW }, viewDrag = null, viewTransition = null, zoomTarget = 1;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
const SETTLE_MS = 520;

function fanPose(ordinal, fan = readingFan) { return { ...fan[ordinal] }; }
function placedInOrder() { return Object.values(reading.placed).sort((a, b) => a.drawOrder - b.drawOrder); }
function tablePose(card) {
  const layers = Object.values(reading.placed).sort((a, b) => a.zIndex - b.zIndex);
  // The underside UVs turn end-for-end under Rx(PI); add Ry(PI) for upright
  // printing. The rotationally symmetric back does not disclose orientation.
  return { x: card.x, y: 0.05 + layers.findIndex(item => item.id === card.id) * 0.012 + (card.faceUp ? CARD_THICKNESS : 0), z: card.z, rx: card.faceUp ? Math.PI : 0, ry: reading.reversed[card.id] ? 0 : Math.PI, rz: 0 };
}
function texture(canvas) {
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return result;
}
function ensureFace(id) {
  if (!faceMaterials.has(id)) faceMaterials.set(id, new THREE.MeshStandardMaterial({ map: texture(createReadingCardFace(id)), roughness: 0.9 }));
  meshes[id].material[1] = faceMaterials.get(id);
}
function invalidate() { if (!scheduled && !failed && !document.hidden) scheduled = requestAnimationFrame(frame); }
function dispatch(action) {
  const before = reading;
  reading = reduceReading(reading, action);
  if (reading === before) return false;
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
  const placed = placedInOrder(), opened = placed.filter(card => card.faceUp).length;
  const selected = reading.placed[reading.selectedId];
  const busy = !!reset || failed;
  $('table').classList.toggle('is-resetting', !!reset);
  $('reset-message').hidden = !reset;
  $('counts').textContent = `剩余 ${CARD_COUNT - placed.length} 张 · 已抽 ${placed.length} 张`;
  $('instruction').textContent = placed.length < 3 ? `从下方拖出${3 - placed.length === 3 ? '三' : 3 - placed.length}张牌，放到你想放的位置。` : '自由移动，双击一张牌，按自己的顺序揭晓。';
  $('selected-label').textContent = selected ? (selected.faceUp ? `${readingCardLabel(selected.id)} · ${reading.reversed[selected.id] ? '逆位' : '正位'}` : `已选第 ${placed.indexOf(selected) + 1} 张 · 未翻开`) : '选中一张桌上的牌';
  $('reveal').disabled = busy || !selected || selected.faceUp || flips.has(selected?.id);
  $('return').disabled = busy || !selected || selected.faceUp || flips.has(selected?.id);
  $('undo').disabled = busy || !canUndo(reading);
  $('arrange').disabled = busy || placed.length < 3 || flips.size > 0;
  $('reset').disabled = busy;
  $('view-home').disabled = busy || (isDefaultView(view) && zoomTarget === 1 && !viewTransition);
  $('zoom-in').disabled = busy || zoomTarget >= ZOOM_LIMITS.max;
  $('zoom-out').disabled = busy || zoomTarget <= ZOOM_LIMITS.min;
  $('zoom-level').textContent = `${Math.round(view.zoom * 100)}%`;
  $('reduce').disabled = failed;
  for (const id of ['previous', 'next', 'place']) $(id).disabled = busy || deckFocusId === null;
  $('deck-position').textContent = deckFocusId === null ? '牌带已空' : `第 ${reading.order.indexOf(deckFocusId) + 1} / 78 张`;
  $('deck-hint').textContent = hoverId !== null && !reading.placed[hoverId] ? `第 ${reading.order.indexOf(hoverId) + 1} 张 · 按住拖到桌面` : '沿牌带挑选 · 按住拖出';
  $('progress').textContent = reset ? '正在收牌与洗牌…' : opened >= 3 ? '三张牌已揭晓。可以继续摆放，或重新洗牌。' : placed.length >= 3 ? `已摆好 ${placed.length} 张 · 已翻开 ${opened} 张，双击继续揭晓。` : `已抽 ${placed.length} 张 · 先为自己留下三张牌。`;
  if (!reset && noticeText && performance.now() < noticeUntil) $('progress').textContent = noticeText;
  const list = $('placed-list');
  const signature = placed.map(card => `${card.id}:${card.faceUp}:${card.id === reading.selectedId}`).join('|');
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature; list.replaceChildren();
    for (const [index, card] of placed.entries()) {
      const item = document.createElement('li'), button = document.createElement('button');
      button.textContent = card.faceUp ? `${readingCardLabel(card.id)} · ${reading.reversed[card.id] ? '逆位' : '正位'}` : `第 ${index + 1} 张 · 未翻开`;
      button.setAttribute('aria-pressed', String(card.id === reading.selectedId));
      button.dataset.cardId = String(card.id);
      button.addEventListener('click', () => { if (!reset) dispatch({ type: 'select', id: card.id }); });
      button.addEventListener('dblclick', () => reveal(card.id));
      item.append(button); list.append(item);
    }
  }
  list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
}

function frame(now) {
  scheduled = 0;
  if (failed) return;
  let animating = false;
  const elapsedFrame = Math.min(40, previousFrameTime ? now - previousFrameTime : 16);
  const hoverBlend = 1 - Math.exp(-elapsedFrame / 60);
  previousFrameTime = now;
  if (viewTransition) {
    const u = clamp((now - viewTransition.started) / 320, 0, 1), t = smooth(u);
    applyView({ zoom: viewTransition.from.zoom + (1 - viewTransition.from.zoom) * t, yaw: viewTransition.from.yaw * (1 - t), elevation: viewTransition.from.elevation + (DEFAULT_VIEW.elevation - viewTransition.from.elevation) * t });
    if (u === 1) { viewTransition = null; applyView(DEFAULT_VIEW); if (reset) reset.lastTime = now; updateUI(); }
    else animating = true;
  }
  if (!viewTransition && !reset && Math.abs(view.zoom - zoomTarget) > 0) {
    const next = Math.abs(view.zoom - zoomTarget) < 0.0005 ? zoomTarget : view.zoom + (zoomTarget - view.zoom) * (1 - Math.exp(-elapsedFrame / 85));
    applyView({ ...view, zoom: next }); updateUI();
    if (next !== zoomTarget) animating = true;
  }
  if (reset) {
    // The accepted shuffle starts only after its original framing is restored.
    if (viewTransition) reset.lastTime = now;
    reset.elapsed += Math.max(0, now - reset.lastTime); reset.lastTime = now;
    if (reset.elapsed >= RESET_DURATION_MS + SETTLE_MS) finishReset();
    else animating = true;
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
      if (drag?.started && drag.id === id) pose = { ...pose, x: drag.point.x, z: drag.point.z, y: Math.max(0.35, pose.y + 0.20), rz: 0 };
      if (flips.has(id)) {
        const flip = flips.get(id), u = clamp((now - flip.started) / 620, 0, 1);
        pose.rx = Math.PI * smooth(u); pose.y += 1.08 * Math.sin(Math.PI * smooth(u)) - CARD_THICKNESS * (1 - smooth(u));
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
  renderer.render(scene, camera);
  if (animating) invalidate();
}

function reveal(id) {
  if (reset || drag?.started || !reading.placed[id] || reading.placed[id].faceUp) return;
  ensureFace(id);
  if (!$('reduce').checked) flips.set(id, { started: performance.now() });
  dispatch({ type: 'reveal', id });
  announce(`${readingCardLabel(id)} · ${reading.reversed[id] ? '逆位' : '正位'} · 示例牌面`);
}
function beginReset() {
  if (reset || failed) return;
  cancelDrag(); lastTap = null; hoverId = null;
  noticeText = '';
  const order = shuffleDeck(ids), seed = crypto.getRandomValues(new Uint32Array(1))[0];
  // Preserve the remaining fan as a rigid packet while it leaves the table;
  // reorder its layers offscreen before the unchanged accepted choreography.
  const snapshot = ids.map(id => ({ id, ...currentPoses.get(id) }));
  hoverOffsets.forEach(offset => { offset.x = 0; offset.y = 0; });
  reset = { elapsed: 0, lastTime: performance.now(), run: createReadingReset({ seed, order, snapshot, deckIds: reading.order.filter(id => !reading.placed[id]) }), next: freshReading(order) };
  reset.nextFan = createReadingFan(reset.next.order);
  flips.clear();
  homeView();
  if ($('reduce').checked) finishReset();
  updateUI(); invalidate();
}
function finishReset() {
  if (!reset) return;
  viewTransition = null; zoomTarget = 1; applyView(DEFAULT_VIEW);
  reading = reset.next; readingFan = reset.nextFan; reset = null; hoverId = null; lastTap = null;
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
  return point && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top + 82 && event.clientY <= box.bottom && Math.abs(point.x) <= 5.6 && point.z >= -2.8 && point.z <= 0.85;
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
  if (reset || failed || event.button !== 0 || drag || viewDrag) return;
  viewTransition = null; zoomTarget = view.zoom;
  const id = pick(event);
  if (id === null) {
    lastTap = null; hoverId = null;
    viewDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startView: { ...view }, started: false };
    renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.focus({ preventScroll: true });
    renderer.domElement.style.cursor = 'grabbing'; event.preventDefault(); updateUI(); invalidate(); return;
  }
  if (flips.has(id)) return;
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
  if (reset || failed) return;
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
  const id = pick(event);
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
    if (validDrop(event, point)) {
      dispatch({ type: action.fromDeck ? 'draw' : 'move', id: action.id, x: clamp(point.x + action.offsetX, -5.4, 5.4), z: clamp(point.z + action.offsetZ, -2.65, 0.75) });
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
  if (reset) return;
  const available = reading.order.filter(id => !reading.placed[id]);
  if (!available.length) return;
  const index = available.indexOf(deckFocusId);
  deckFocusId = available[(index + direction + available.length) % available.length];
  hoverId = deckFocusId; dispatch({ type: 'select', id: null }); updateUI(); invalidate();
}
function placeFocused() {
  if (reset || deckFocusId === null) return;
  const index = Object.keys(reading.placed).length;
  dispatch({ type: 'draw', id: deckFocusId, x: [-2, 0, 2][index % 3], z: -0.7 + Math.floor(index / 3) % 8 * 0.16 });
  hoverId = null;
}
function updateProjection() {
  const box = $('scene').getBoundingClientRect(), aspect = box.width / box.height;
  const { width, height } = getViewSize(view, aspect);
  camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
  camera.zoom = view.zoom;
  camera.updateProjectionMatrix();
}
function applyView(next) {
  view = clampView(next);
  const point = getViewPosition(view);
  camera.position.set(point.x, point.y, point.z); camera.lookAt(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z); camera.updateMatrixWorld();
  updateProjection(); invalidate();
}
function homeView() {
  cancelDrag(); hoverId = null; lastTap = null; zoomTarget = 1;
  if ($('reduce').checked || isDefaultView(view)) { viewTransition = null; applyView(DEFAULT_VIEW); }
  else viewTransition = { from: { ...view }, started: performance.now() };
  updateUI(); invalidate();
}
function updateViewDrag(event) {
  const dx = event.clientX - viewDrag.startX, dy = event.clientY - viewDrag.startY;
  viewDrag.started ||= Math.hypot(dx, dy) > 5;
  if (viewDrag.started) { applyView(dragView(viewDrag.startView, dx, dy)); updateUI(); }
}
function changeZoom(deltaY, deltaMode = 0) {
  if (reset || failed || drag || viewDrag) return;
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
  updateProjection(); renderer.setSize(box.width, box.height); invalidate();
}
function fail(error) {
  failed = true; cancelAnimationFrame(scheduled); scheduled = 0;
  $('loading').hidden = true; $('failure').hidden = false; updateUI();
  console.error('Augurwell local reading study:', error);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  $('scene').append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '牌桌：拖出抽牌，拖动摆放，双击翻开；拖动空白处调整视角，滚轮拉近拉远，Shift 加方向键调视角，加减键缩放。也可使用下方逐张挑牌按钮。');
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x111815); scene.fog = new THREE.FogExp2(0x111815, 0.035);
  camera = new THREE.OrthographicCamera(-6.4, 6.4, 3.8, -3.8, 0.1, 100);
  applyView(DEFAULT_VIEW);
  scene.add(new THREE.HemisphereLight(0xc5d9cf, 0x253226, 2.15));
  const key = new THREE.DirectionalLight(0xffe1aa, 3.2); key.position.set(-3.5, 8, 5.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 25 });
  key.shadow.bias = 0.0002; key.shadow.normalBias = 0.012; key.shadow.intensity = 0.82; scene.add(key);
  const rim = new THREE.DirectionalLight(0x92b8b1, 1.7); rim.position.set(4, 5, -4); scene.add(rim);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x1b211d, roughness: 1 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.08; table.receiveShadow = true; scene.add(table);
  scene.add(createReadingCloth(renderer));
  const back = new THREE.MeshStandardMaterial({ map: texture(createCardBack()), roughness: 0.63, metalness: 0.12 });
  const blank = new THREE.MeshStandardMaterial({ color: 0xe8dfc9, roughness: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xc7bca2, roughness: 0.84, metalness: 0.02 });
  meshes = ids.map(id => { const mesh = new THREE.Mesh(createCardGeometry(), [back, blank, edge]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.id = id; scene.add(mesh); return mesh; });
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
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('Graphics context lost')); });
  renderer.domElement.addEventListener('keydown', event => {
    if (!event.ctrlKey && !event.metaKey && ['+', '=', '-'].includes(event.key)) { event.preventDefault(); changeZoom(event.key === '-' ? 120 : -120); return; }
    if (event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); if (reset || failed) return;
      cancelDrag(); viewTransition = null; zoomTarget = view.zoom; hoverId = null; lastTap = null;
      applyView(dragView(view, event.key === 'ArrowLeft' ? -28 : event.key === 'ArrowRight' ? 28 : 0, event.key === 'ArrowUp' ? 28 : event.key === 'ArrowDown' ? -28 : 0));
      updateUI(); return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepDeck(event.key === 'ArrowLeft' ? -1 : 1); }
    if (event.key === 'Enter') { event.preventDefault(); reading.selectedId !== null ? reveal(reading.selectedId) : placeFocused(); }
  });
  resizeObserver = new ResizeObserver(fit); resizeObserver.observe($('scene')); fit(); updateUI(); $('loading').hidden = true;
} catch (error) { fail(error); }

$('reveal').addEventListener('click', () => reveal(reading.selectedId));
$('return').addEventListener('click', () => { if (!reset) { lastTap = null; dispatch({ type: 'return', id: reading.selectedId }); } });
$('undo').addEventListener('click', () => { if (!reset) { cancelDrag(); lastTap = null; dispatch({ type: 'undo' }); } });
$('arrange').addEventListener('click', () => { if (!reset) { cancelDrag(); dispatch({ type: 'arrange3', positions: [{ x: -2, z: -0.7 }, { x: 0, z: -0.7 }, { x: 2, z: -0.7 }] }); } });
$('reset').addEventListener('click', beginReset);
$('zoom-in').addEventListener('click', () => changeZoom(-120));
$('zoom-out').addEventListener('click', () => changeZoom(120));
$('view-home').addEventListener('click', () => { if (!reset && !failed) homeView(); });
$('skip').addEventListener('click', finishReset);
$('previous').addEventListener('click', () => stepDeck(-1));
$('next').addEventListener('click', () => stepDeck(1));
$('place').addEventListener('click', placeFocused);
$('reduce').addEventListener('change', () => { if ($('reduce').checked) { if (viewTransition) { viewTransition = null; zoomTarget = 1; applyView(DEFAULT_VIEW); } else applyView({ ...view, zoom: zoomTarget }); flips.clear(); if (reset) finishReset(); updateUI(); invalidate(); } });
$('retry').addEventListener('click', () => location.reload());
document.addEventListener('keydown', event => { if (event.key === 'Escape') { cancelDrag(); dispatch({ type: 'select', id: null }); } });
document.addEventListener('visibilitychange', () => {
  cancelDrag(); if (!viewTransition) zoomTarget = view.zoom;
  if (document.hidden) { cancelAnimationFrame(scheduled); scheduled = 0; }
  else { if (reset) reset.lastTime = performance.now(); invalidate(); }
});
addEventListener('pagehide', event => { cancelAnimationFrame(scheduled); scheduled = 0; if (!event.persisted) { resizeObserver?.disconnect(); renderer?.dispose(); } });
addEventListener('pageshow', () => { if (reset) reset.lastTime = performance.now(); invalidate(); });
