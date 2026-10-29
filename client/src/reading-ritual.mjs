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
  function crescent(x, z, radius, mirror = 1) {
    ctx.save(); ctx.translate(x, z); ctx.scale(mirror, 1);
    ctx.globalAlpha = .53; ctx.lineWidth = .013;
    ctx.beginPath(); ctx.arc(0, 0, radius, rad(68), rad(292));
    ctx.quadraticCurveTo(-radius * .28, 0, Math.cos(rad(68)) * radius, Math.sin(rad(68)) * radius);
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  function orbit(x, z, radius) {
    ctx.globalAlpha = .35; ctx.lineWidth = .011;
    ctx.beginPath(); ctx.ellipse(x, z, radius, radius * .40, -.46, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, z, radius * .62, rad(34), rad(307)); ctx.stroke();
    dot(x, z, .022, .60);
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

  // Peripheral lunar/orbital marks enrich the instrument without implying
  // card positions, a prescribed spread, or connections between drawn cards.
  arc(7.00, 4.94, 190, 255, .30, .011);
  arc(7.00, 4.94, 285, 350, .30, .011);
  crescent(-1.02, -4.94, .14);
  crescent(1.02, -4.94, .14, -1);
  dot(-.54, -4.95, .018, .46); dot(.54, -4.95, .018, .46);
  orbit(-6.63, -.12, .34); orbit(6.63, -.12, .34);
  for (const side of [-1, 1]) {
    line(side * 6.76, .56, side * 6.76, 1.28, .32, .011);
    dot(side * 6.76, 1.44, .022, .48);
    star(side * 6.76, 1.72, .10, .56);
    const nodes = [[5.32, -4.72], [5.72, -4.43], [6.12, -4.64], [6.38, -4.23]];
    for (let i = 0; i < nodes.length; i += 1) {
      const [x, z] = nodes[i];
      dot(side * x, z, i === 1 ? .031 : .019, .50);
      if (i) line(side * nodes[i - 1][0], nodes[i - 1][1], side * x, z, .26, .011);
    }
  }

  // A broken, shallow orbit sits between the side marks and the source fan.
  // Its uneven gaps keep the engraving airy when cards occupy this area.
  ctx.globalAlpha = .30; ctx.lineWidth = .011;
  ctx.beginPath();
  ctx.ellipse(0, .32, 5.50, .38, -.025, rad(12), rad(76));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, .32, 5.50, .38, -.025, rad(105), rad(167));
  ctx.stroke();
  ctx.globalAlpha = .21;
  ctx.beginPath();
  ctx.ellipse(0, .32, 5.50, .38, -.025, rad(194), rad(248));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, .32, 5.50, .38, -.025, rad(289), rad(347));
  ctx.stroke();
  star(-3.86, .69, .075, .44);
  dot(-2.17, .72, .019, .36);
  dot(2.33, -.08, .020, .40);
  star(4.53, .01, .062, .40);
  line(-4.66, .70, -4.63, .81, .28, .010);
  line(3.32, .49, 3.35, .60, .28, .010);

  // Two short, unconnected near-edge echoes keep the view balanced when orbited.
  arc(6.72, 4.70, 29, 47, .30, .011);
  arc(6.72, 4.70, 132, 151, .30, .011);
  dot(-4.65, 3.14, .018, .38);
  dot(4.65, 3.14, .018, .38);
  arc(6.48, 4.46, 36, 57, .25, .011);
  arc(6.48, 4.46, 122, 143, .25, .011);
  crescent(-6.00, 2.46, .12, -1); crescent(6.00, 2.46, .12);

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
