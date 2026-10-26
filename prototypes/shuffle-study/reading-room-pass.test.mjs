import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReadingRoomPass, roomTargetSize, roomBlurTargetSize, roomBlurWeights, ROOM_BLUR_SIGMA_CSS } from './reading-room-pass.mjs';

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
      calls.push({ kind: 'render', scene, camera, target: this.target, source: uniforms?.uSource.value,
        step: uniforms?.uStep.value.clone(), weights: uniforms?.uWeights.value.slice() });
      if (this.throwRender || calls.filter(call => call.kind === 'render').length === this.throwRenderAt) throw new Error('room render failed');
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

test('blur targets stay at half CSS resolution or less, independently of framebuffer DPR', () => {
  assert.deepEqual(roomBlurTargetSize(1440, 1000), { width: 480, height: 333 });
  assert.deepEqual(roomBlurTargetSize(600, 2400), { width: 150, height: 600 });
  assert.deepEqual(roomBlurTargetSize(600, 400), { width: 300, height: 200 });
  assert.deepEqual(roomBlurTargetSize(1, 1), { width: 1, height: 1 });
  for (const size of [[0, 1], [1, NaN], [Infinity, 1], [-1, 1]]) assert.equal(roomBlurTargetSize(...size), null);
});

function kernelMass(weights) { return weights[0] + 2 * weights.slice(1).reduce((sum, value) => sum + value, 0); }
function kernelVariance(weights) { return 2 * weights.reduce((sum, value, index) => sum + index ** 2 * value, 0); }

test('dense Gaussian conserves constant light, has no negative lobes and retains the requested spread', () => {
  for (const sigma of [3, 4, 5, 6]) {
    const weights = roomBlurWeights(sigma);
    assert.equal(weights.length, 19);
    assert.ok(Math.abs(kernelMass(weights) - 1) < 1e-7);
    assert.ok(weights.every((value, index) => value >= 0 && (index === 0 || value <= weights[index - 1])));
    // Radius covers at least 3 sigma. Truncation loses less than 3% variance.
    const spread = kernelVariance(weights) / sigma ** 2;
    assert.ok(spread > 0.97 && spread <= 1.000001, `sigma ${sigma}: ${spread}`);
    // An impulse forms one centered peak; an edge response increases smoothly
    // without ringing or bright/dark overshoot beyond its input range.
    const impulse = [...weights.slice(1)].reverse().concat([...weights]);
    let edge = 0;
    for (const weight of impulse) { const previous = edge; edge += weight; assert.ok(edge >= previous && edge <= 1.0000001); }
  }
  for (const sigma of [0, -1, NaN, Infinity, 6.01]) assert.throws(() => roomBlurWeights(sigma), RangeError);
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
    assert.equal(target.texture.generateMipmaps, false);
  }
  assert.deepEqual([renders[0].target.width, renders[0].target.height], [960, 667]);
  for (const { target } of renders.slice(1)) assert.deepEqual([target.width, target.height], [480, 333]);
  assert.deepEqual(renders[1].step.toArray(), [1 / 480, 0]);
  assert.deepEqual(renders[2].step.toArray(), [0, 1 / 333]);
  assert.deepEqual(renders[1].weights, roomBlurWeights(ROOM_BLUR_SIGMA_CSS * 480 / 1440));
  assert.deepEqual(renders[2].weights, roomBlurWeights(ROOM_BLUR_SIGMA_CSS * 333 / 1000));
  assert.deepEqual(snapshot(renderer), before);
  assert.equal(renders[1].scene.children[0].material.toneMapped, false);
  pass.dispose();
});

test('12 CSS pixel room defocus stays stable across DPR and viewport sizes', () => {
  for (const [width, height] of [[420, 280], [620, 390], [1440, 1000], [1792, 1388]]) {
    let first;
    for (const dpr of [1, 2]) {
      const { renderer, calls } = fakeRenderer();
      Object.assign(renderer, { width: width * dpr, height: height * dpr, cssWidth: width, cssHeight: height });
      const pass = createReadingRoomPass(renderer, new THREE.Group());
      assert.equal(pass.render(new THREE.PerspectiveCamera()), true);
      const blur = calls.filter(call => call.kind === 'render').slice(1);
      const scales = [width / blur[0].target.width, height / blur[1].target.height];
      for (let axis = 0; axis < 2; axis++) {
        const sigmaCSS = Math.sqrt(kernelVariance(blur[axis].weights)) * scales[axis];
        assert.ok(sigmaCSS > 11.8 && sigmaCSS <= 12.001, `${width}x${height} DPR ${dpr}: ${sigmaCSS}`);
      }
      const result = blur.map(call => ({ step: call.step.toArray(), weights: [...call.weights] }));
      if (first) assert.deepEqual(result, first); else first = result;
      pass.dispose();
    }
  }
});

test('static camera caches room output; pose, projection, appearance, cutaway and resize invalidate it', () => {
  const { renderer, calls } = fakeRenderer();
  const room = new THREE.Group();
  const pass = createReadingRoomPass(renderer, room), camera = new THREE.PerspectiveCamera();
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
  const countBeforeCutaway = calls.filter(call => call.kind === 'render').length;
  room.userData.cutaway = { revision: 1 };
  assert.equal(pass.render(camera), true);
  assert.equal(calls.filter(call => call.kind === 'render').length, countBeforeCutaway + 3);
  assert.equal(pass.render(camera), false);
  assert.equal(calls.filter(call => call.kind === 'render').length, countBeforeCutaway + 3);
  pass.dispose();
});

test('failure at any render stage restores state and does not cache incomplete output', () => {
  for (const failureAt of [1, 2, 3]) {
    const { renderer, calls } = fakeRenderer(), before = snapshot(renderer);
    const pass = createReadingRoomPass(renderer, new THREE.Group()), camera = new THREE.PerspectiveCamera();
    renderer.throwRenderAt = failureAt;
    assert.throws(() => pass.render(camera), /room render failed/); assert.deepEqual(snapshot(renderer), before);
    renderer.throwRenderAt = null;
    assert.equal(pass.render(camera), true);
    assert.equal(calls.filter(call => call.kind === 'render').length, failureAt + 3);
    pass.dispose();
  }
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
