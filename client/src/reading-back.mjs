/** Crisp procedural print for the shared physical deck. Original faces stay separate. */
export function createReadingBack(theme = 'dark') {
  const dark = theme === 'dark';
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1688;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Card-back canvas unavailable.');
  const { width, height } = canvas;
  const cx = width / 2, cy = height / 2;
  const palette = dark
    ? { center: '#152223', edge: '#0b1517', gold: '#c7b18b', bright: '#dfcba5', faint: '#897c63', grain: '211,219,208' }
    : { center: '#e6dfd2', edge: '#cfc6b6', gold: '#473c2d', bright: '#2b251c', faint: '#6e6150', grain: '103,96,83' };
  const paper = ctx.createRadialGradient(cx, cy, 80, cx, cy, 1010);
  paper.addColorStop(0, palette.center); paper.addColorStop(1, palette.edge);
  ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);

  // Pair each grain mark with its half-turn counterpart. Even the texture
  // cannot identify the top of a concealed card when it is rotated 180°.
  for (let y = 0; y < height / 2; y += 3) for (let x = 0; x < width; x += 3) {
    const n = (Math.imul(x + 31, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0;
    const size = n % 13 === 0 ? 2 : 1;
    ctx.fillStyle = `rgba(${palette.grain},${0.025 + (n % 9) * 0.006})`;
    ctx.fillRect(x, y, size, size);
    ctx.fillRect(width - x - size, height - y - size, size, size);
  }
  const metal = ctx.createLinearGradient(0, 0, 0, height);
  metal.addColorStop(0, palette.faint); metal.addColorStop(0.5, palette.bright); metal.addColorStop(1, palette.faint);
  ctx.strokeStyle = metal;
  ctx.lineWidth = dark ? 4.5 : 8;
  ctx.beginPath(); ctx.roundRect(26, 26, width - 52, height - 52, 48); ctx.stroke();
  ctx.strokeStyle = palette.gold; ctx.lineWidth = dark ? 2.1 : 4.5;
  ctx.beginPath(); ctx.roundRect(47, 47, width - 94, height - 94, 28); ctx.stroke();
  ctx.globalAlpha = 0.46; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(56, 56, width - 112, height - 112, 21); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.translate(cx, cy);
  // The celestial instrument has no directional lettering. Three nested rings,
  // a clear eight-point star and paired moons carry the reference's vocabulary.
  ctx.strokeStyle = palette.gold; ctx.lineWidth = dark ? 3.5 : 8;
  const ring = (radius, opacity) => {
    ctx.globalAlpha = opacity; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  };
  ring(350, dark ? 0.64 : 0.9); ring(267, dark ? 0.72 : 0.94); ring(173, 0.98);
  ctx.globalAlpha = dark ? 0.42 : 0.72; ctx.lineWidth = dark ? 1.5 : 4;
  ctx.beginPath(); ctx.moveTo(0, -725); ctx.lineTo(0, -144); ctx.moveTo(0, 144); ctx.lineTo(0, 725); ctx.stroke();
  ctx.globalAlpha = 1;

  const dot = (x, y, radius, color = palette.gold) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  };
  for (const sign of [-1, 1]) {
    dot(0, sign * 594, 7.5);
    dot(0, sign * 437, 13.5);
    dot(0, sign * 350, 5);
    dot(0, sign * 267, 9);
  }
  // Opposite crescents are rotated together, retaining half-turn symmetry.
  for (const angle of [0, Math.PI]) {
    ctx.save(); ctx.rotate(angle); ctx.translate(-267, 0);
    ctx.fillStyle = palette.bright;
    ctx.beginPath(); ctx.moveTo(-21, -11);
    ctx.bezierCurveTo(-25, 23, 25, 23, 21, -11);
    ctx.bezierCurveTo(12, 11, -12, 11, -21, -11);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = palette.bright; ctx.strokeStyle = palette.gold; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 8;
    const radius = i % 2 ? 19 : i % 4 === 0 ? 115 : 86;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = palette.faint; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.8;
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    const radius = i % 2 ? 86 : 115;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  dot(0, 0, 5, palette.gold);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) dot(sx * 444, sy * 774, 3.5, palette.gold);
  return canvas;
}
