import * as THREE from 'three';

const MAX_WIDTH = 960;
const MAX_HEIGHT = 1200;
const BLUR_SIGMA_CSS = 1.25;

/** Keep aspect ratio while bounding the room-only offscreen cost. */
export function roomTargetSize(width, height) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const vertexShader = /* glsl */`
  precision highp float;
  in vec3 position;
  out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position, 1.0); }
`;
const fragmentShader = /* glsl */`
  precision highp float;
  uniform sampler2D uSource;
  uniform vec2 uStep;
  in vec2 vUv;
  out vec4 fragColor;
  void main() {
    vec4 color = texture(uSource, vUv) * 0.2270270270;
    color += (texture(uSource, vUv + uStep) + texture(uSource, vUv - uStep)) * 0.1945945946;
    color += (texture(uSource, vUv + uStep * 2.0) + texture(uSource, vUv - uStep * 2.0)) * 0.1216216216;
    color += (texture(uSource, vUv + uStep * 3.0) + texture(uSource, vUv - uStep * 3.0)) * 0.0540540541;
    color += (texture(uSource, vUv + uStep * 4.0) + texture(uSource, vUv - uStep * 4.0)) * 0.0162162162;
    fragColor = color;
  }
`;

/**
 * The room alone renders into linear half-float targets, then blurs in linear
 * space. Three renders ordinary targets without output transfer/tone mapping;
 * assigning this LinearSRGB texture as the main scene's background performs
 * those conversions once at the main framebuffer. Cards never enter this pass.
 * The supplied group owns its geometry, textures, materials and lights.
 */
export function createReadingRoomPass(renderer, roomGroup) {
  const scene = new THREE.Scene();
  scene.name = 'reading-room-only';
  scene.background = roomGroup.userData.backgroundColor || new THREE.Color(0xd8d2c6);
  scene.environment = roomGroup.userData.environmentTexture || null;
  scene.environmentIntensity = roomGroup.userData.environmentIntensity ?? 1;
  scene.add(roomGroup);
  const targetOptions = {
    type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    generateMipmaps: false, depthBuffer: true, stencilBuffer: false,
  };
  const roomTarget = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  const horizontalTarget = new THREE.WebGLRenderTarget(1, 1, { ...targetOptions, depthBuffer: false });
  const outputTarget = new THREE.WebGLRenderTarget(1, 1, { ...targetOptions, depthBuffer: false });
  roomTarget.texture.name = 'room-linear-source';
  horizontalTarget.texture.name = 'room-linear-horizontal';
  outputTarget.texture.name = 'room-linear-blurred';
  const uniforms = { uSource: { value: roomTarget.texture }, uStep: { value: new THREE.Vector2() } };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms,
    toneMapped: false, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false;
  const blurScene = new THREE.Scene(); blurScene.name = 'reading-room-blur'; blurScene.add(quad);
  const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const buffer = new THREE.Vector2(), cssSize = new THREE.Vector2();
  let lastKey = null, theme = 'light', disposed = false;

  function applyAppearance(next) {
    const resolved = next === 'dark' ? 'dark' : 'light';
    if (resolved === theme) return;
    theme = resolved;
    if (!roomGroup.userData.backgroundColor) scene.background.setHex(theme === 'dark' ? 0x131b24 : 0xd8d2c6);
    lastKey = null;
  }

  function render(camera) {
    if (disposed) return false;
    renderer.getDrawingBufferSize(buffer);
    renderer.getSize(cssSize);
    const size = roomTargetSize(buffer.x, buffer.y);
    if (!size || cssSize.x <= 0 || cssSize.y <= 0) return false;
    camera.updateMatrixWorld();
    const key = [buffer.x, buffer.y, cssSize.x, cssSize.y, theme,
      ...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].join(',');
    if (key === lastKey) return false;
    if (roomTarget.width !== size.width || roomTarget.height !== size.height) {
      for (const target of [roomTarget, horizontalTarget, outputTarget]) target.setSize(size.width, size.height);
    }
    const previous = {
      target: renderer.getRenderTarget(), cubeFace: renderer.getActiveCubeFace(), mipLevel: renderer.getActiveMipmapLevel(),
      autoClear: renderer.autoClear, clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
      viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest(),
    };
    try {
      renderer.autoClear = true;
      renderer.setScissorTest(false);
      renderer.setRenderTarget(roomTarget);
      renderer.render(scene, camera);
      uniforms.uSource.value = roomTarget.texture;
      uniforms.uStep.value.set(BLUR_SIGMA_CSS / (2 * cssSize.x), 0);
      renderer.setRenderTarget(horizontalTarget);
      renderer.render(blurScene, blurCamera);
      uniforms.uSource.value = horizontalTarget.texture;
      uniforms.uStep.value.set(0, BLUR_SIGMA_CSS / (2 * cssSize.y));
      renderer.setRenderTarget(outputTarget);
      renderer.render(blurScene, blurCamera);
      lastKey = key;
      return true;
    } finally {
      renderer.autoClear = previous.autoClear;
      renderer.setRenderTarget(previous.target, previous.cubeFace, previous.mipLevel);
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.setViewport(previous.viewport);
      renderer.setScissor(previous.scissor);
      renderer.setScissorTest(previous.scissorTest);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(roomGroup);
    for (const target of [roomTarget, horizontalTarget, outputTarget]) target.dispose();
    geometry.dispose(); material.dispose();
  }
  return { render, get texture() { return outputTarget.texture; }, applyAppearance, dispose };
}
