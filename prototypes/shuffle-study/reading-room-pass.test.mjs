import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReadingRoomPass, roomTargetSize } from './reading-room-pass.mjs';

function fakeRenderer() {
  const calls = [];
  const renderer = {
    width: 2520, height: 1750, cssWidth: 1440, cssHeight: 1000, autoClear: false,
    target: { name: 'prior' }, cubeFace: 2, mip: 3, color: new THREE.Color(0x123456), alpha: 0.4,
    viewport: new THREE.Vector4(2, 3, 600, 500), scissor: new THREE.Vector4(4, 5, 300, 200), scissorTest: true,
    getDrawingBufferSize(out) { return out.set(this.width, this.height); },
    getSize(out) { return out.set(this.cssWidth, this.cssHeight); },
    getRenderTarget() { return this.target; }, getActiveCubeFace() { return this.cubeFace; }, getActiveMipmapLevel() { return this.mip; },
    getClearColor(out) { return out.copy(this.color); }, getClearAlpha() { return this.alpha; },
    getViewport(out) { return out.copy(this.viewport); }, getScissor(out) { return out.copy(this.scissor); }, getScissorTest() { return this.scissorTest; },
    setRenderTarget(target, cube = 0, mip = 0) { this.target = target; this.cubeFace = cube; this.mip = mip; calls.push({ kind: 'target', target }); },
    setClearColor(color, alpha) { this.color.copy(color); this.alpha = alpha; },
    setViewport(value) { this.viewport.copy(value); }, setScissor(value) { this.scissor.copy(value); }, setScissorTest(value) { this.scissorTest = value; },
    render(scene, camera) {
      const uniforms = scene.children[0]?.material?.uniforms;
      calls.push({ kind: 'render', scene, camera, target: this.target, source: uniforms?.uSource.value, step: uniforms?.uStep.value.clone() });
      if (this.throwRender) throw new Error('room render failed');
      // Background rendering may update clear state internally; the pass must restore it.
      this.color.setHex(0xffffff); this.alpha = 1;
    },
  };
  Object.defineProperties(renderer, {
    toneMapping: { value: THREE.ACESFilmicToneMapping }, outputColorSpace: { value: THREE.SRGBColorSpace }, toneMappingExposure: { value: 1.18 },
  });
  return { renderer, calls };
}

function snapshot(renderer) {
  return { target: renderer.target, cubeFace: renderer.cubeFace, mip: renderer.mip, autoClear: renderer.autoClear,
    color: renderer.color.clone(), alpha: renderer.alpha, viewport: renderer.viewport.clone(), scissor: renderer.scissor.clone(), scissorTest: renderer.scissorTest };
}

test('room target keeps aspect within bounded dimensions and rejects invalid sizes', () => {
  assert.deepEqual(roomTargetSize(2520, 1750), { width: 960, height: 667 });
  assert.deepEqual(roomTargetSize(600, 2400), { width: 300, height: 1200 });
  assert.deepEqual(roomTargetSize(600, 400), { width: 600, height: 400 });
  for (const size of [[0, 1], [1, NaN], [Infinity, 1], [-1, 1]]) assert.equal(roomTargetSize(...size), null);
});

test('room renders separately then two linear blur passes and restores all renderer state', () => {
  const { renderer, calls } = fakeRenderer(), before = snapshot(renderer);
  const room = new THREE.Group(), camera = new THREE.PerspectiveCamera(40, 1.44, 0.1, 100);
  const pass = createReadingRoomPass(renderer, room);
  assert.equal(pass.render(camera), true);
  const renders = calls.filter(call => call.kind === 'render');
  assert.equal(renders.length, 3); assert.equal(renders[0].scene.children[0], room); assert.equal(renders[0].camera, camera);
  assert.equal(renders[1].source, renders[0].target.texture); assert.equal(renders[2].source, renders[1].target.texture);
  assert.equal(pass.texture, renders[2].target.texture);
  for (const { target } of renders) {
    assert.equal(target.texture.type, THREE.HalfFloatType); assert.equal(target.texture.colorSpace, THREE.LinearSRGBColorSpace);
    assert.equal(target.width, 960); assert.equal(target.height, 667); assert.equal(target.texture.generateMipmaps, false);
  }
  assert.deepEqual(renders[1].step.toArray(), [3.4 / (2 * 1440), 0]);
  assert.deepEqual(renders[2].step.toArray(), [0, 3.4 / (2 * 1000)]);
  assert.deepEqual(snapshot(renderer), before);
  assert.equal(renders[1].scene.children[0].material.toneMapped, false);
  pass.dispose();
});

test('static camera caches room output; pose, projection, appearance and resize invalidate it', () => {
  const { renderer, calls } = fakeRenderer();
  const pass = createReadingRoomPass(renderer, new THREE.Group()), camera = new THREE.PerspectiveCamera();
  assert.equal(pass.render(camera), true);
  const target = pass.texture;
  assert.equal(pass.render(camera), false); assert.equal(calls.filter(call => call.kind === 'render').length, 3);
  pass.applyAppearance('light'); assert.equal(pass.render(camera), false);
  camera.position.x += 0.1; assert.equal(pass.render(camera), true);
  camera.fov += 1; camera.updateProjectionMatrix(); assert.equal(pass.render(camera), true);
  pass.applyAppearance('dark'); assert.equal(pass.render(camera), true);
  assert.equal(calls.filter(call => call.kind === 'render').at(-3).scene.background.getHex(), 0x131b24);
  renderer.width = 1280; renderer.height = 720; renderer.cssWidth = 1280; renderer.cssHeight = 720;
  assert.equal(pass.render(camera), true); assert.equal(pass.texture, target);
  assert.equal(pass.render(camera), false);
  pass.dispose();
});

test('render failure restores state and does not mark incomplete output cached', () => {
  const { renderer, calls } = fakeRenderer(), before = snapshot(renderer);
  const pass = createReadingRoomPass(renderer, new THREE.Group()), camera = new THREE.PerspectiveCamera();
  renderer.throwRender = true;
  assert.throws(() => pass.render(camera), /room render failed/); assert.deepEqual(snapshot(renderer), before);
  renderer.throwRender = false;
  assert.equal(pass.render(camera), true);
  assert.equal(calls.filter(call => call.kind === 'render').length, 4);
  pass.dispose();
});

test('disposal releases owned targets and blur resources once while leaving room assets owned externally', () => {
  const { renderer, calls } = fakeRenderer();
  const room = new THREE.Group(); const ownGeometry = new THREE.BoxGeometry(), ownMaterial = new THREE.MeshBasicMaterial();
  room.add(new THREE.Mesh(ownGeometry, ownMaterial));
  const pass = createReadingRoomPass(renderer, room), camera = new THREE.PerspectiveCamera(); pass.render(camera);
  const renders = calls.filter(call => call.kind === 'render');
  let targetDisposals = 0, blurDisposals = 0, roomDisposals = 0;
  for (const { target } of renders) target.addEventListener('dispose', () => targetDisposals++);
  const blur = renders[1].scene.children[0];
  blur.geometry.addEventListener('dispose', () => blurDisposals++); blur.material.addEventListener('dispose', () => blurDisposals++);
  ownGeometry.addEventListener('dispose', () => roomDisposals++); ownMaterial.addEventListener('dispose', () => roomDisposals++);
  pass.dispose(); pass.dispose();
  assert.equal(targetDisposals, 3); assert.equal(blurDisposals, 2); assert.equal(roomDisposals, 0);
  assert.equal(room.parent, null); assert.equal(pass.render(camera), false);
  ownGeometry.dispose(); ownMaterial.dispose();
});
