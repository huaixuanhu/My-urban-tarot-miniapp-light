import * as THREE from 'three';
import { GLASS_WIDTH, GLASS_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

/** Original decorative engraving: an open observation instrument, not a spread. */
export function createReadingRitual(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round(canvas.width * GLASS_LENGTH / GLASS_WIDTH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Glass engraving canvas unavailable.');
  ctx.scale(canvas.width / GLASS_WIDTH, canvas.height / GLASS_LENGTH);
  ctx.translate(GLASS_WIDTH / 2, GLASS_LENGTH / 2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  const rad = degrees => degrees * Math.PI / 180;
  const centerZ = -.25;
  function arc(rx, rz, start, end, alpha, width = .016) {
    ctx.globalAlpha = alpha; ctx.lineWidth = width;
    ctx.beginPath(); ctx.ellipse(0, centerZ, rx, rz, 0, rad(start), rad(end)); ctx.stroke();
  }
  function line(x1, z1, x2, z2, alpha, width = .016) {
    ctx.globalAlpha = alpha; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, z1); ctx.lineTo(x2, z2); ctx.stroke();
  }
  function dot(x, z, radius, alpha) {
    ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, z, radius, 0, Math.PI * 2); ctx.fill();
  }
  function star(x, z, radius, alpha) {
    ctx.globalAlpha = alpha; ctx.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const theta = i * Math.PI / 8 - Math.PI / 2;
      const length = i % 2 ? radius * .17 : i % 4 ? radius * .46 : radius;
      const px = x + Math.cos(theta) * length, pz = z + Math.sin(theta) * length;
      if (i === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
    }
    ctx.closePath(); ctx.fill();
  }

  // The main arcs frame the far edge. Their center stays open for free placing.
  arc(6.72, 4.70, 198, 261, .80);
  arc(6.72, 4.70, 279, 342, .80);
  arc(6.48, 4.46, 212, 249, .40, .011);
  arc(6.48, 4.46, 292, 331, .40, .011);
  for (let degrees = 202; degrees <= 338; degrees += 8) {
    if (degrees > 258 && degrees < 282) continue;
    const theta = rad(degrees), long = (degrees - 202) % 24 === 0;
    const inset = long ? .13 : .065;
    line(Math.cos(theta) * 6.72, centerZ + Math.sin(theta) * 4.70,
      Math.cos(theta) * (6.72 - inset), centerZ + Math.sin(theta) * (4.70 - inset), .58, .011);
  }
  star(0, -4.95, .23, .94);
  line(0, -5.37, 0, -5.21, .55, .011);
  dot(0, -4.55, .022, .64);
  star(-5.82, -2.12, .10, .68);
  dot(5.89, -1.92, .028, .70);

  // Two short, unconnected near-edge echoes keep the view balanced when orbited.
  arc(6.72, 4.70, 29, 47, .30, .011);
  arc(6.72, 4.70, 132, 151, .30, .011);
  dot(-4.65, 3.14, .018, .38);
  dot(4.65, 3.14, .018, .38);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({
    map, color: 0x7a7265, transparent: true, opacity: .68,
    depthTest: true, depthWrite: false, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(GLASS_WIDTH, GLASS_LENGTH);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'glass-observation-engraving';
  mesh.position.set(0, -.006, CLOTH_CENTER_Z);
  // This surface is presentation only and cannot become a picking target.
  mesh.raycast = () => {};
  let disposed = false;
  return {
    mesh,
    applyAppearance(theme) {
      const dark = theme === 'dark';
      material.color.setHex(dark ? 0xd4c29e : 0x7a7265);
      material.opacity = dark ? .58 : .68;
    },
    dispose() {
      if (disposed) return;
      disposed = true; geometry.dispose(); material.dispose(); map.dispose();
    },
  };
}
