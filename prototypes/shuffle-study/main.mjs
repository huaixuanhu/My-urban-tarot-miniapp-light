import * as THREE from 'three';
import { CARD_COUNT, DURATION_MS as SHUFFLE_DURATION_MS, shuffleDeck } from '../../client/src/motion.mjs';
import { RESET_DURATION_MS as DURATION_MS, RESET_PREFIX_MS, RESET_SHUFFLE_START_MS, createResetRun, sampleResetPose, resetPhaseAt, shuffleProgressAt } from '../../client/src/reset-motion.mjs';
import { createCardBack, createCardFace, createTableTexture } from './textures.mjs';
import { sampleFlex } from '../../client/src/flex.mjs';
import { createCardGeometry, applyCardFlex } from '../../client/src/card-geometry.mjs';

const $ = id => document.getElementById(id);
const controls = { play: $('play'), pause: $('pause'), finish: $('finish'), timeline: $('timeline'), slow: $('slow'), reduce: $('reduce'), sound: $('sound') };
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
controls.reduce.checked = reducedPreference.matches;
const phaseText = {
  fly: ['归来', '缓缓飞入，沿各自轨迹汇向牌组'],
  collect: ['汇聚', '悬空旋正，逐渐加速合为一叠'],
  gather: ['收拢', '让每一张牌回到同一副牌中'],
  lift: ['抬起', '纸张离开桌面，阴影缓缓散开'],
  split: ['分叠', '两叠牌相向而立，内侧微微蓄力'],
  riffle: ['交错', '纸牌弯起、释放，轻轻回弹'],
  settle: ['归拢', '合为一叠，轻轻落下'],
  spread: ['展开', '让选择回到你的手中'],
  ready: ['待你挑选', '洗牌完成 · 此试样暂不提供抽牌'],
};
const CARD_IDS = Array.from({ length: CARD_COUNT }, (_, id) => id);
// A motion-review fixture, not a saved reading or real card-selection feature.
const DEMO_PLACED = [
  { id: 0, x: -1.9, y: 0.045, z: 0.10, rx: Math.PI, ry: -0.10, rz: 0 },
  { id: 1, x: 0, y: 0.045, z: -0.12, rx: Math.PI, ry: 0.02, rz: 0 },
  { id: 2, x: 1.9, y: 0.045, z: 0.10, rx: Math.PI, ry: 0.12, rz: 0 },
];
const state = { progress: 0, playing: false, prepared: false, failed: false, previousFrame: 0, request: 0, phase: '', sound: false, run: createResetRun({ seed: 0x41554755, order: CARD_IDS, placed: DEMO_PLACED }), audioContext: null, scheduledAudio: [] };
let scene, camera, renderer, cards, resizeObserver;

function updateUI() {
  const elapsedMs = state.progress * DURATION_MS;
  document.querySelector('.intro').classList.toggle('is-quiet', elapsedMs > 0 && elapsedMs < RESET_PREFIX_MS);
  const phase = state.progress === 0 ? 'idle' : resetPhaseAt(elapsedMs);
  controls.timeline.value = String(Math.round(state.progress * DURATION_MS));
  const name = phase === 'idle' ? '一次占卜之后' : phaseText[phase][0];
  controls.timeline.setAttribute('aria-valuetext', `${(elapsedMs / 1000).toFixed(2)} 秒，${name}`);
  $('time').innerHTML = `${(elapsedMs / 1000).toFixed(2)} <span>/ ${(DURATION_MS / 1000).toFixed(2)} s</span>`;
  if (phase !== state.phase) {
    state.phase = phase;
    $('phase-name').textContent = name;
    $('phase-description').textContent = phase === 'idle' ? '三张示例牌阵 · 点击全局重置，重新开始' : phaseText[phase][1];
  }
  $('play-label').textContent = state.playing ? '重置中' : state.progress >= 1 ? '从牌阵再演示' : state.progress > 0 ? '继续播放' : '全局重置洗牌';
  controls.play.disabled = state.playing;
  controls.pause.disabled = !state.playing;
  controls.finish.disabled = state.progress >= 1;
}

function drawFrame() {
  if (state.failed) return;
  for (let index = 0; index < CARD_COUNT; index++) {
    const elapsedMs = state.progress * DURATION_MS;
    const pose = sampleResetPose(index, elapsedMs, state.run);
    const card = cards[index];
    card.position.set(pose.x, pose.y, pose.z);
    card.rotation.set(pose.rx, pose.ry, pose.rz, 'XYZ');
    const shuffleProgress = shuffleProgressAt(elapsedMs);
    const flex = sampleFlex(state.run.slotById[index], shuffleProgress);
    // A new run may give this physical card a different side/layer in the deck.
    if (flex.angle !== card.userData.lastFlexAngle || (flex.active && (flex.layerOffset !== card.userData.lastLayerOffset || flex.side !== card.userData.lastFlexSide))) {
      applyCardFlex(card.children[0].geometry, flex);
      card.userData.lastFlexAngle = flex.angle;
      card.userData.lastLayerOffset = flex.layerOffset;
      card.userData.lastFlexSide = flex.side;
    }
  }
  renderer.render(scene, camera);
  updateUI();
}

function stopAudio() {
  for (const source of state.scheduledAudio) { try { source.stop(); } catch { /* Already ended. */ } }
  state.scheduledAudio = [];
}
function paperSound() {
  if (!state.sound) return;
  const audio = state.audioContext;
  if (!audio) return;
  const speed = controls.slow.checked ? 0.35 : 1;
  const start = audio.currentTime;
  // Short filtered noise pulses evoke paper friction. No external audio file.
  const cues = [
    ...[700, 1150, 1650, 2050, RESET_PREFIX_MS - 150].map(ms => ({ ms, gain: 0.009 })),
    ...[{ t: 0.19, gain: 0.012 }, ...Array.from({ length: 17 }, (_, i) => ({ t: 0.37 + i * 0.020, gain: 0.010 + (i % 3) * 0.003 })), { t: 0.80, gain: 0.027 }]
      .map(cue => ({ ms: RESET_PREFIX_MS + cue.t * SHUFFLE_DURATION_MS - RESET_SHUFFLE_START_MS, gain: cue.gain })),
  ];
  for (const cue of cues) {
    if (cue.ms < state.progress * DURATION_MS) continue;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.09), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.16));
    const source = audio.createBufferSource(); source.buffer = buffer;
    const filter = audio.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = cue.ms >= RESET_PREFIX_MS + 0.75 * SHUFFLE_DURATION_MS - RESET_SHUFFLE_START_MS ? 320 : 2100; filter.Q.value = 0.7;
    const gain = audio.createGain(); gain.gain.value = cue.gain;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(start + (cue.ms - state.progress * DURATION_MS) / 1000 / speed);
    state.scheduledAudio.push(source);
  }
}
function animate(now) {
  if (!state.playing) return;
  const delta = now - state.previousFrame;
  state.previousFrame = now;
  state.progress = Math.min(1, state.progress + delta / DURATION_MS * (controls.slow.checked ? 0.35 : 1));
  drawFrame();
  if (state.progress >= 1) {
    state.playing = false;
    stopAudio();
    updateUI();
  } else state.request = requestAnimationFrame(animate);
}
function pause() {
  state.playing = false;
  cancelAnimationFrame(state.request);
  stopAudio();
  updateUI();
}
function prepareRun() {
  if (!state.prepared) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    state.run = createResetRun({ seed, order: shuffleDeck(CARD_IDS), placed: DEMO_PLACED });
    // Card IDs never change. The run maps their existing identities to new slots.
    state.prepared = true;
  }
}
function play() {
  if (state.playing || !renderer || state.failed) return;
  if (state.progress >= 1) { state.progress = 0; state.prepared = false; }
  prepareRun();
  if (controls.reduce.checked) { state.progress = 1; drawFrame(); return; }
  state.playing = true;
  state.previousFrame = performance.now();
  updateUI();
  paperSound();
  state.request = requestAnimationFrame(animate);
}
function seek(progress) {
  if (!renderer || state.failed) return;
  pause();
  prepareRun();
  state.progress = Math.max(0, Math.min(1, progress));
  drawFrame();
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
function setupCards() {
  const backMap = canvasTexture(createCardBack());
  const frontMap = canvasTexture(createCardFace());
  const backMaterial = new THREE.MeshStandardMaterial({ map: backMap, color: 0xffffff, roughness: 0.63, metalness: 0.12 });
  const frontMaterial = new THREE.MeshStandardMaterial({ map: frontMap, roughness: 0.9 });
  const edges = [0xc7bca2, 0xada48e].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0.02 }));
  return Array.from({ length: CARD_COUNT }, (_, i) => {
    const group = new THREE.Group(); group.userData.cardId = i; group.userData.lastFlexAngle = 0; group.userData.lastLayerOffset = 0;
    const body = new THREE.Mesh(createCardGeometry(), [backMaterial, frontMaterial, edges[i % edges.length]]);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body); scene.add(group);
    return group;
  });
}
function setupTable() {
  const texture = canvasTexture(createTableTexture());
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: texture, color: 0xb9c5b3, roughness: 1, metalness: 0 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.025; table.receiveShadow = true; scene.add(table);
  // Fine engraved circles anchor the physical deck without filling the screen.
  const brass = new THREE.MeshStandardMaterial({ color: 0x796447, roughness: 0.8, metalness: 0.3, transparent: true, opacity: 0.25 });
  for (const radius of [3.3, 3.34]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.003, 4, 180), brass);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, -0.018, 0.03); scene.add(ring);
  }
  const ticks = new THREE.Group();
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(i % 4 === 0 ? 0.006 : 0.003, 0.001, i % 4 === 0 ? 0.09 : 0.035), brass);
    tick.position.set(Math.sin(angle) * 3.39, -0.015, Math.cos(angle) * 3.39 + 0.03); tick.rotation.y = angle; ticks.add(tick);
  }
  scene.add(ticks);
}
function fit() {
  if (!renderer) return;
  const { width, height } = $('scene').getBoundingClientRect();
  const aspect = width / height;
  const halfHeight = Math.max(2.25, 5.85 / aspect);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  drawFrame();
}
function setView(side) {
  if (!renderer) return;
  camera.position.set(side ? 5.5 : 0.8, side ? 4.9 : 8.8, side ? 9.7 : 10.2);
  camera.lookAt(0, 0.3, 0.1);
  for (const [id, active] of [['view-front', !side], ['view-side', side]]) {
    $(id).classList.toggle('is-active', active); $(id).setAttribute('aria-pressed', String(active));
  }
  drawFrame();
}
function fail(error) {
  state.failed = true;
  state.playing = false; cancelAnimationFrame(state.request); stopAudio();
  $('load-message').hidden = true; $('scene-error').hidden = false;
  $('error-detail').textContent = '浏览器未能建立或保持三维画面。请启用图形加速后重试；已有应用与记录未受影响。';
  for (const control of Object.values(controls)) control.disabled = true;
  document.querySelectorAll('.chapters button,.view-button').forEach(button => { button.disabled = true; });
  console.error('Augurwell shuffle study:', error);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('scene').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '78 张立体卡牌，使用下方按钮播放或定位动作');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('Graphics context lost')); });
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111815);
  scene.fog = new THREE.FogExp2(0x111815, 0.035);
  camera = new THREE.OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
  const ambient = new THREE.HemisphereLight(0xc5d9cf, 0x253226, 2.15); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffe1aa, 3.2); key.position.set(-3.5, 8, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 25;
  key.shadow.bias = 0.0002; key.shadow.normalBias = 0.012;
  key.shadow.intensity = 0.82;
  key.shadow.radius = 3.5; scene.add(key);
  const rim = new THREE.DirectionalLight(0x92b8b1, 1.7); rim.position.set(4, 5, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xffc67d, 18, 16, 2); warm.position.set(-3, 3, 1); scene.add(warm);
  setupTable();
  cards = setupCards();
  setView(false);
  resizeObserver = new ResizeObserver(fit); resizeObserver.observe($('scene'));
  fit();
  controls.play.disabled = false; controls.timeline.disabled = false; controls.finish.disabled = false;
  $('load-message').hidden = true;
} catch (error) { fail(error); }

controls.play.addEventListener('click', play);
controls.pause.addEventListener('click', pause);
controls.finish.addEventListener('click', () => seek(1));
controls.timeline.addEventListener('input', event => seek(Number(event.target.value) / DURATION_MS));
controls.slow.addEventListener('change', () => { stopAudio(); if (state.playing) paperSound(); });
controls.reduce.addEventListener('change', () => { if (controls.reduce.checked && state.playing) seek(1); });
reducedPreference.addEventListener('change', event => { controls.reduce.checked = event.matches; if (event.matches && state.playing) seek(1); });
controls.sound.addEventListener('click', async () => {
  try {
    state.sound = !state.sound;
    if (state.sound) {
      state.audioContext ??= new AudioContext(); await state.audioContext.resume();
    }
    controls.sound.textContent = state.sound ? '音效开' : '音效关';
    controls.sound.setAttribute('aria-label', state.sound ? '关闭洗牌音效' : '开启洗牌音效');
    controls.sound.setAttribute('aria-pressed', String(state.sound));
    stopAudio(); if (state.playing) paperSound();
  } catch { state.sound = false; controls.sound.textContent = '音效不可用'; controls.sound.setAttribute('aria-pressed', 'false'); }
});
document.querySelectorAll('[data-ms]').forEach(button => button.addEventListener('click', () => seek(Number(button.dataset.ms) / DURATION_MS)));
$('view-front').addEventListener('click', () => setView(false));
$('view-side').addEventListener('click', () => setView(true));
$('retry').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) pause(); });
addEventListener('pagehide', event => {
  pause();
  // A page preserved by browser history will resume its existing scene.
  if (event.persisted) return;
  resizeObserver?.disconnect(); renderer?.dispose(); state.audioContext?.close();
});
