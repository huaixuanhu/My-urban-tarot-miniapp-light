import * as THREE from 'three';
import { createReadingGlass } from './reading-glass.mjs';

// Only materials and lights vary. No card, camera or reading-state references.
const PALETTES = {
  light: { background: 0xeeedf0, ground: 0xc7c7ce, surface: 0xffffff, hem: 0xc4c2cf, edge: 0x9c99ab, sky: 0xf3f2ff, bounce: 0x9693a3, ambient: 1.6, key: 2.3, rim: 0.9, shadow: 0.56, selection: 0x655c84 },
  dark: { background: 0x181a22, ground: 0x11141b, surface: 0x333844, hem: 0x55586b, edge: 0x454957, sky: 0xd5dcee, bounce: 0x292b3e, ambient: 1.1, key: 2.1, rim: 0.9, shadow: 0.75, selection: 0xd5cde7 },
};

/** An original symmetric instrument motif; never a substitute for source faces. */
export function createReadingBack() {
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 1264;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Card-back canvas unavailable.');
  ctx.fillStyle = '#a2a2a5'; ctx.fillRect(0, 0, 768, 1264);
  // Deterministic, quiet paper grain with no foliage or directional lettering.
  for (let y = 0; y < 1264; y += 3) for (let x = 0; x < 768; x += 3) {
    const a = ((Math.imul(x + 31, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0) % 7;
    ctx.fillStyle = `rgba(255,255,255,${a / 250})`; ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = '#ebe8e3'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(29, 29, 710, 1206, 24); ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(42, 42, 684, 1180, 16); ctx.stroke();
  ctx.translate(384, 632);
  const ellipse = (rx, ry, angle = 0) => { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, angle, 0, Math.PI * 2); ctx.stroke(); };
  ellipse(224, 430); ellipse(224, 430, 0.13);
  ctx.beginPath(); ctx.moveTo(0, -492); ctx.lineTo(0, 492); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.lineWidth = 2.2;
  ellipse(153, 153); ellipse(135, 135);
  ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(14, -14); ctx.lineTo(88, 0); ctx.lineTo(14, 14); ctx.lineTo(0, 112); ctx.lineTo(-14, 14); ctx.lineTo(-88, 0); ctx.lineTo(-14, -14); ctx.closePath(); ctx.stroke();
  for (const sign of [-1, 1]) {
    for (const [y, radius] of [[246, 16], [332, 38], [462, 6]]) {
      ctx.beginPath(); ctx.arc(0, y * sign, radius, 0, Math.PI * 2); ctx.stroke();
    }
  }
  return canvas;
}

export function createReadingSceneStyle(scene, renderer, texture) {
  const hemisphere = new THREE.HemisphereLight(); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xfff4e7, 2.5);
  key.position.set(-3.5, 8, 5.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 25 });
  key.shadow.bias = 0.0002; key.shadow.normalBias = 0.012; scene.add(key);
  const rim = new THREE.DirectionalLight(0xd3d9ff, 1.25); rim.position.set(4, 5, -4); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.18; ground.receiveShadow = true; scene.add(ground);
  const glass = createReadingGlass(renderer); scene.add(glass);
  const back = new THREE.MeshStandardMaterial({ map: texture(createReadingBack()), color: 0x999999, roughness: 0.76, metalness: 0.06 });
  const blank = new THREE.MeshStandardMaterial({ color: 0xe6e2df, roughness: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xd5cfca, roughness: 0.86, metalness: 0 });
  return {
    materials: [back, blank, edge],
    dispose() { glass.userData.dispose(); ground.geometry.dispose(); ground.material.dispose(); back.map.dispose(); back.dispose(); blank.dispose(); edge.dispose(); },
    apply(theme, outline) {
      const p = PALETTES[theme] || PALETTES.light;
      scene.background = null; scene.fog = null;
      renderer.setClearColor(p.background, 0);
      ground.material.opacity = theme === 'dark' ? 0.3 : 0.12;
      glass.userData.applyAppearance(theme);
      hemisphere.color.setHex(p.sky); hemisphere.groundColor.setHex(p.bounce); hemisphere.intensity = p.ambient;
      key.intensity = p.key; key.shadow.intensity = p.shadow; rim.intensity = p.rim;
      if (outline) outline.material.color.setHex(p.selection);
    },
  };
}
