import * as THREE from 'three';

const CAPTURE_PADDING = 24;

/** CSS bounds -> an integer, lower-left-origin framebuffer copy rectangle. */
export function screenGlassCapture(bounds, bufferWidth, bufferHeight) {
  if (!bounds || ![bufferWidth, bufferHeight].every(value => Number.isInteger(value) && value > 0)) return null;
  const { left, top, width, height, viewportWidth, viewportHeight } = bounds;
  if (![left, top, width, height, viewportWidth, viewportHeight].every(Number.isFinite)
    || width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const right = left + width, bottom = top + height;
  if (!Number.isFinite(right) || !Number.isFinite(bottom)
    || right <= 0 || bottom <= 0 || left >= viewportWidth || top >= viewportHeight) return null;
  const scaleX = bufferWidth / viewportWidth, scaleY = bufferHeight / viewportHeight;
  const minX = Math.max(0, Math.floor((left - CAPTURE_PADDING) * scaleX));
  const maxX = Math.min(bufferWidth, Math.ceil((right + CAPTURE_PADDING) * scaleX));
  const minY = Math.max(0, Math.floor((viewportHeight - bottom - CAPTURE_PADDING) * scaleY));
  const maxY = Math.min(bufferHeight, Math.ceil((viewportHeight - top + CAPTURE_PADDING) * scaleY));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, scaleX, scaleY,
    bufferWidth, bufferHeight };
}

const vertexShader = /* glsl */`
  precision highp float;
  in vec3 position;
  void main() { gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  uniform sampler2D uScene;
  uniform vec2 uSourceOrigin;
  uniform vec2 uSourceSize;
  uniform vec2 uPixelScale;
  uniform float uBufferHeight;
  uniform vec4 uBounds;
  uniform vec3 uPage;
  uniform float uDark;
  out vec4 fragColor;

  // The copied framebuffer is already display-encoded and premultiplied. It
  // must not pass through Three's output conversion or ACES a second time.
  vec3 sceneColor(vec2 cssOffset) {
    vec2 delta = vec2(cssOffset.x, -cssOffset.y) * uPixelScale;
    vec2 uv = (gl_FragCoord.xy + delta - uSourceOrigin) / uSourceSize;
    uv = clamp(uv, vec2(0.5) / uSourceSize, vec2(1.0) - vec2(0.5) / uSourceSize);
    vec4 pixel = texture(uScene, uv);
    return pixel.rgb + (1.0 - pixel.a) * uPage;
  }

  vec3 toLinear(vec3 color) {
    return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), color));
  }
  vec3 toDisplay(vec3 color) {
    color = clamp(color, 0.0, 1.0);
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
  }

  float capsuleDistance(vec2 p, vec2 halfSize) {
    float radius = min(halfSize.x, halfSize.y);
    return length(vec2(p.x - clamp(p.x, -halfSize.x + radius, halfSize.x - radius), p.y)) - radius;
  }

  void main() {
    vec2 screen = vec2(gl_FragCoord.x / uPixelScale.x, (uBufferHeight - gl_FragCoord.y) / uPixelScale.y);
    vec2 size = uBounds.zw;
    vec2 p = screen - uBounds.xy - size * 0.5;
    vec2 halfSize = size * 0.5;
    float distance = capsuleDistance(p, halfSize);
    float aa = max(0.35, fwidth(distance) * 0.65);
    float coverage = 1.0 - smoothstep(-aa, aa, distance);

    // A short shadow belongs to the hovering control itself, in screen space.
    // The halo fades completely before the capture rectangle's outer border.
    float shadowDistance = capsuleDistance(p - vec2(1.4, 5.0), halfSize);
    float shadow = exp(-pow(max(0.0, shadowDistance) / 5.0, 2.0))
      * (1.0 - coverage) * mix(0.15, 0.24, uDark);
    if (coverage < 0.00001 && shadow < 0.00001) discard;

    vec3 original = sceneColor(vec2(0.0));
    vec3 under = original * (1.0 - shadow);
    float radius = min(halfSize.x, halfSize.y);
    vec2 radial = vec2(p.x - clamp(p.x, -halfSize.x + radius, halfSize.x - radius), p.y);
    vec2 normal = radial / max(length(radial), 0.001);
    float bevelWidth = min(14.0, size.y * 0.22);
    float bevel = smoothstep(-bevelWidth, -0.7, distance);
    float edge = bevel * bevel;

    // The center stays clear. Only the curved perimeter bends the real scene;
    // the tiny RGB separation is confined to the thickest optical edge.
    vec2 bend = -normal * (0.12 * bevel + 3.4 * edge);
    vec3 refracted = sceneColor(bend);
    refracted.r = sceneColor(bend - normal * 0.16 * edge).r;
    refracted.b = sceneColor(bend + normal * 0.16 * edge).b;
    vec3 light = toLinear(refracted);

    float warm = exp(-pow((p.x + size.x * 0.31) / (size.x * 0.13), 2.0)
      - pow((p.y - size.y * 0.34) / (size.y * 0.24), 2.0));
    float cool = exp(-pow((p.x - size.x * 0.455) / (size.x * 0.065), 2.0)
      - pow((p.y + size.y * 0.015) / (size.y * 0.53), 2.0));
    float rim = exp(-pow((distance + 1.65) / 1.25, 2.0));
    float warmCore = pow(warm, 2.6);
    float directional = pow(max(0.0, dot(normal, normalize(vec2(-0.45, -0.8)))), 5.0);
    // Neutral transmission and localized catches replace a gray fill or a
    // uniformly bright outline. A darker inner lip supplies a little thickness.
    light *= 1.0 - edge * (0.018 + max(normal.y, 0.0) * 0.025);
    light += vec3(1.0, 0.88, 0.70) * warm * (0.065 + 0.30 * rim);
    light += vec3(1.0, 0.98, 0.94) * warmCore * mix(0.25, 0.18, uDark);
    light += vec3(0.66, 0.68, 1.0) * cool * rim * mix(0.19, 0.15, uDark);
    light += vec3(0.95, 0.97, 1.0) * rim * directional * 0.075;
    vec3 glass = toDisplay(light);
    fragColor = vec4(mix(under, glass, coverage), 1.0);
  }
`;

/**
 * One unchanged scene pass, a cropped GPU copy, then a capsule-only overlay.
 * No scene materials, camera, tone mapping, output color space, or state changes.
 */
export function createScreenGlass(renderer) {
  const uniforms = {
    uScene: { value: null }, uSourceOrigin: { value: new THREE.Vector2() },
    uSourceSize: { value: new THREE.Vector2() }, uPixelScale: { value: new THREE.Vector2(1, 1) },
    uBufferHeight: { value: 1 }, uBounds: { value: new THREE.Vector4() },
    uPage: { value: new THREE.Vector3(238 / 255, 237 / 255, 240 / 255) }, uDark: { value: 0 },
  };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, vertexShader, fragmentShader,
    toneMapped: false, transparent: false, blending: THREE.NoBlending,
    depthTest: false, depthWrite: false,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'screen-glass-controls';
  mesh.frustumCulled = false;
  const overlay = new THREE.Scene();
  overlay.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bufferSize = new THREE.Vector2(), copyOrigin = new THREE.Vector2();
  let bounds = null, captureTexture = null, disposed = false;

  function setBounds(next) {
    bounds = next ? { ...next } : null;
  }

  function applyAppearance(theme) {
    const dark = theme === 'dark';
    uniforms.uDark.value = dark ? 1 : 0;
    // Explicit encoded bytes match the CSS background; Color(hex) would convert
    // them to linear values and is inappropriate for this display-space copy.
    uniforms.uPage.value.set(...(dark ? [24 / 255, 26 / 255, 34 / 255] : [238 / 255, 237 / 255, 240 / 255]));
  }

  function render(scene, sceneCamera) {
    renderer.render(scene, sceneCamera);
    if (disposed || !bounds || renderer.getRenderTarget() !== null) return;
    renderer.getDrawingBufferSize(bufferSize);
    const region = screenGlassCapture(bounds, bufferSize.x, bufferSize.y);
    if (!region) return;
    if (!captureTexture || captureTexture.image.width !== region.width || captureTexture.image.height !== region.height) {
      captureTexture?.dispose();
      captureTexture = new THREE.FramebufferTexture(region.width, region.height);
      captureTexture.colorSpace = THREE.NoColorSpace;
      captureTexture.minFilter = captureTexture.magFilter = THREE.LinearFilter;
      captureTexture.generateMipmaps = false;
      uniforms.uScene.value = captureTexture;
    }
    copyOrigin.set(region.x, region.y);
    renderer.copyFramebufferToTexture(captureTexture, copyOrigin);
    uniforms.uSourceOrigin.value.copy(copyOrigin);
    uniforms.uSourceSize.value.set(region.width, region.height);
    uniforms.uPixelScale.value.set(region.scaleX, region.scaleY);
    uniforms.uBufferHeight.value = region.bufferHeight;
    uniforms.uBounds.value.set(bounds.left, bounds.top, bounds.width, bounds.height);
    const left = region.x / region.bufferWidth * 2 - 1, right = (region.x + region.width) / region.bufferWidth * 2 - 1;
    const bottom = region.y / region.bufferHeight * 2 - 1, top = (region.y + region.height) / region.bufferHeight * 2 - 1;
    geometry.attributes.position.array.set([left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0]);
    geometry.attributes.position.needsUpdate = true;
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.render(overlay, camera);
    } finally {
      renderer.autoClear = previousAutoClear;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    captureTexture?.dispose();
    captureTexture = null;
    geometry.dispose(); material.dispose();
  }
  return { render, setBounds, applyAppearance, dispose };
}
