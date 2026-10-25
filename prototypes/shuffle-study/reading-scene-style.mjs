import * as THREE from 'three';
import { createReadingGlass } from './reading-glass.mjs';
import { createReadingBack } from './reading-back.mjs';

export { createReadingBack } from './reading-back.mjs';

// Only materials and lights vary. No card, camera or reading-state references.
const PALETTES = {
  light: { background: 0xeeedf0, sky: 0xf0eff7, bounce: 0x827c8a, ambient: 0.9, key: 2.65, rim: 1.15, pool: 52, coolPool: 20, shadow: 0.66, selection: 0x786745, paperEdge: 0xd1c7b5, backGlow: 0.08 },
  dark: { background: 0x181a22, sky: 0xd3dce4, bounce: 0x1f252d, ambient: 0.64, key: 2.25, rim: 1.25, pool: 48, coolPool: 25, shadow: 0.84, selection: 0xd0b98d, paperEdge: 0xb8aa90, backGlow: 0.16 },
};

export function createReadingSceneStyle(scene, renderer, texture) {
  const hemisphere = new THREE.HemisphereLight(); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xfff0db, 2.65);
  key.position.set(-4.5, 9, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 25 });
  key.shadow.bias = 0.00016; key.shadow.normalBias = 0.009;
  key.shadow.radius = 3; scene.add(key);
  const rim = new THREE.DirectionalLight(0xd1d9ef, 1.15); rim.position.set(5, 4.5, -5.5); scene.add(rim);
  // One stationary broad pool gives the transmitted backing a directional
  // light gradient; no animated particles, visible fixture or extra shadows.
  const pool = new THREE.SpotLight(0xffedda, 42, 30, 0.72, 0.92, 1.6);
  pool.position.set(-4.8, 8, 3.8); pool.target.position.set(-1.6, -0.1, -1.1);
  scene.add(pool, pool.target);
  const coolPool = new THREE.SpotLight(0xd0dcff, 20, 26, 0.64, 1, 1.6);
  coolPool.position.set(5.5, 6, -3.6); coolPool.target.position.set(2.8, -0.1, 1.8);
  scene.add(coolPool, coolPool.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.18; ground.receiveShadow = true; scene.add(ground);
  const glass = createReadingGlass(renderer); scene.add(glass);
  // Each print is generated/uploaded once and shared by all 78 meshes.
  const backMaps = Object.fromEntries(['light', 'dark'].map(theme => [theme, texture(createReadingBack(theme))]));
  const back = new THREE.MeshStandardMaterial({
    map: backMaps.light, color: 0xffffff, roughness: 0.8, metalness: 0.035,
    emissiveMap: backMaps.light, emissive: 0xffffff, emissiveIntensity: 0.08,
  });
  const blank = new THREE.MeshStandardMaterial({ color: 0xe6e2df, roughness: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xd1c7b5, roughness: 0.72, metalness: 0.035 });
  let disposed = false;
  return {
    materials: [back, blank, edge],
    // Borrowed texture: its lifetime is owned only by reading-glass.
    environmentTexture: glass.userData.environmentTexture,
    dispose() {
      if (disposed) return; disposed = true;
      scene.remove(hemisphere, key, rim, pool, pool.target, coolPool, coolPool.target, ground, glass);
      key.shadow.dispose(); glass.userData.dispose(); ground.geometry.dispose(); ground.material.dispose();
      for (const map of Object.values(backMaps)) map.dispose();
      back.dispose(); blank.dispose(); edge.dispose();
    },
    apply(theme, outline) {
      const resolved = theme === 'dark' ? 'dark' : 'light';
      const p = PALETTES[resolved];
      scene.background = null; scene.fog = null;
      renderer.setClearColor(p.background, 0);
      ground.material.opacity = resolved === 'dark' ? 0.32 : 0.14;
      glass.userData.applyAppearance(resolved);
      hemisphere.color.setHex(p.sky); hemisphere.groundColor.setHex(p.bounce); hemisphere.intensity = p.ambient;
      key.intensity = p.key; key.shadow.intensity = p.shadow; rim.intensity = p.rim; pool.intensity = p.pool; coolPool.intensity = p.coolPool;
      back.map = backMaps[resolved]; back.emissiveMap = backMaps[resolved]; back.emissiveIntensity = p.backGlow;
      edge.color.setHex(p.paperEdge);
      if (outline) outline.material.color.setHex(p.selection);
    },
  };
}
