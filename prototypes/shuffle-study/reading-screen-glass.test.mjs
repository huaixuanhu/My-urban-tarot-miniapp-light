import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createScreenGlass, screenGlassCapture } from './reading-screen-glass.mjs';

const bounds = Object.freeze({ left: 400, top: 720, width: 520, height: 80, viewportWidth: 1440, viewportHeight: 900 });

test('capture includes optical padding and converts CSS top-left into integer framebuffer bottom-left', () => {
  const capture = screenGlassCapture(bounds, 2520, 1575);
  assert.deepEqual(capture, { x: 658, y: 133, width: 994, height: 224, scaleX: 1.75, scaleY: 1.75,
    bufferWidth: 2520, bufferHeight: 1575 });
  assert.equal(capture.x / capture.scaleX, bounds.left - 24);
  assert.equal(capture.y / capture.scaleY, bounds.viewportHeight - bounds.top - bounds.height - 24);
});

test('capture clamps partial offscreen bounds and rejects invalid or entirely offscreen controls', () => {
  const clipped = screenGlassCapture({ ...bounds, left: -12, top: 850 }, 1440, 900);
  assert.deepEqual(clipped, { x: 0, y: 0, width: 532, height: 74, scaleX: 1, scaleY: 1, bufferWidth: 1440, bufferHeight: 900 });
  for (const invalid of [null, {}, { ...bounds, left: NaN }, { ...bounds, width: 0 },
    { ...bounds, viewportHeight: 0 }, { ...bounds, left: 1440 }, { ...bounds, top: -80 },
    { ...bounds, width: Infinity }, { ...bounds, top: 900 }]) {
    assert.equal(screenGlassCapture(invalid, 1440, 900), null);
  }
  assert.equal(screenGlassCapture(bounds, 0, 900), null);
  assert.equal(screenGlassCapture(bounds, 1440.5, 900), null);
});

function fakeRenderer() {
  const calls = [], scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const renderer = {
    autoClear: true, width: 2520, height: 1575, renderTarget: null,
    getRenderTarget() { return this.renderTarget; },
    getDrawingBufferSize(out) { return out.set(this.width, this.height); },
    render(nextScene, nextCamera) {
      calls.push({ kind: nextScene === scene ? 'scene' : 'overlay', scene: nextScene, camera: nextCamera, autoClear: this.autoClear });
    },
    copyFramebufferToTexture(texture, origin) { calls.push({ kind: 'copy', texture, origin: origin.clone() }); },
  };
  // These existing output settings are an invariant, never compositor toggles.
  Object.defineProperties(renderer, {
    toneMapping: { value: THREE.ACESFilmicToneMapping }, toneMappingExposure: { value: 1.18 },
    outputColorSpace: { value: THREE.SRGBColorSpace },
  });
  return { renderer, calls, scene, camera };
}

test('one original scene render precedes the raw display copy and bounded overlay without output-setting changes', () => {
  const { renderer, calls, scene, camera } = fakeRenderer();
  const glass = createScreenGlass(renderer);
  glass.setBounds(bounds);
  glass.render(scene, camera);
  assert.deepEqual(calls.map(call => call.kind), ['scene', 'copy', 'overlay']);
  assert.equal(calls[0].scene, scene); assert.equal(calls[0].camera, camera); assert.equal(calls[0].autoClear, true);
  assert.equal(calls[2].autoClear, false); assert.equal(renderer.autoClear, true);
  assert.equal(calls[1].texture.colorSpace, THREE.NoColorSpace);
  assert.equal(calls[1].texture.generateMipmaps, false);
  const mesh = calls[2].scene.getObjectByName('screen-glass-controls');
  assert.equal(mesh.material.isRawShaderMaterial, true);
  assert.equal(mesh.material.toneMapped, false);
  assert.equal(mesh.material.blending, THREE.NoBlending);
  assert.equal(mesh.material.depthTest, false); assert.equal(mesh.material.depthWrite, false);
  // The rasterized quad itself stays inside the captured screen region.
  const vertices = mesh.geometry.attributes.position.array;
  const capture = screenGlassCapture(bounds, renderer.width, renderer.height);
  assert.ok(Math.abs((vertices[0] + 1) * renderer.width / 2 - capture.x) < 0.0001);
  assert.ok(Math.abs((vertices[1] + 1) * renderer.height / 2 - capture.y) < 0.0001);
  assert.ok(Math.abs((vertices[6] + 1) * renderer.width / 2 - capture.x - capture.width) < 0.0001);
  assert.ok(Math.abs((vertices[7] + 1) * renderer.height / 2 - capture.y - capture.height) < 0.0001);
  glass.dispose();
});

test('missing/offscreen bounds and a non-canvas target preserve the ordinary scene-only path', () => {
  const { renderer, calls, scene, camera } = fakeRenderer();
  const glass = createScreenGlass(renderer);
  glass.render(scene, camera);
  glass.setBounds({ ...bounds, top: 901 }); glass.render(scene, camera);
  glass.setBounds(bounds); renderer.renderTarget = {}; glass.render(scene, camera);
  assert.deepEqual(calls.map(call => call.kind), ['scene', 'scene', 'scene']);
  glass.dispose();
});

test('capture texture is reused then released on resize, and disposal is idempotent', () => {
  const { renderer, calls, scene, camera } = fakeRenderer();
  const glass = createScreenGlass(renderer);
  glass.setBounds(bounds); glass.render(scene, camera);
  const first = calls.find(call => call.kind === 'copy').texture;
  let firstDisposed = 0, lastDisposed = 0;
  first.addEventListener('dispose', () => firstDisposed++);
  glass.render(scene, camera);
  assert.equal(calls.filter(call => call.kind === 'copy').at(-1).texture, first);
  renderer.width = 1440; renderer.height = 900;
  glass.render(scene, camera);
  const last = calls.filter(call => call.kind === 'copy').at(-1).texture;
  assert.notEqual(last, first); assert.equal(firstDisposed, 1);
  last.addEventListener('dispose', () => lastDisposed++);
  glass.dispose(); glass.dispose();
  assert.equal(firstDisposed, 1); assert.equal(lastDisposed, 1);
  calls.length = 0; glass.render(scene, camera);
  assert.deepEqual(calls.map(call => call.kind), ['scene']);
});

test('appearance supplies exact CSS-encoded background bytes and overlay failure restores autoClear', () => {
  const { renderer, calls, scene, camera } = fakeRenderer();
  const glass = createScreenGlass(renderer);
  glass.setBounds(bounds); glass.applyAppearance('dark'); glass.render(scene, camera);
  const uniforms = calls.at(-1).scene.getObjectByName('screen-glass-controls').material.uniforms;
  assert.deepEqual(uniforms.uPage.value.toArray(), [24 / 255, 26 / 255, 34 / 255]);
  glass.applyAppearance('light');
  assert.deepEqual(uniforms.uPage.value.toArray(), [238 / 255, 237 / 255, 240 / 255]);
  renderer.render = nextScene => { if (nextScene !== scene) throw new Error('test overlay failure'); };
  assert.throws(() => glass.render(scene, camera), /test overlay failure/);
  assert.equal(renderer.autoClear, true);
  glass.dispose();
});
