/** Original procedural artwork for the local motion study. No external assets. */

const TAU = Math.PI * 2;
const CARD_WIDTH = 768;
const CARD_HEIGHT = 1264;

function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for the card materials.');
  return { canvas, context };
}

// Integer hashing makes each surface repeatable, including across fresh loads.
function grain(x, y, seed) {
  let value = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function paper(context, width, height, color, seed, strength = 3) {
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const noise = (grain(x, y, seed) - 0.5) * strength;
      const fibers = Math.sin(y * 1.31) * 0.45 + Math.sin(x * 0.37) * 0.25;
      pixels.data[offset] = color[0] + noise + fibers;
      pixels.data[offset + 1] = color[1] + noise + fibers;
      pixels.data[offset + 2] = color[2] + noise + fibers;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function circle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function ellipse(context, x, y, radiusX, radiusY) {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, TAU);
  context.stroke();
}

function line(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function diamond(context, x, y, width, height, fill = false) {
  context.beginPath();
  context.moveTo(x, y - height);
  context.lineTo(x + width, y);
  context.lineTo(x, y + height);
  context.lineTo(x - width, y);
  context.closePath();
  if (fill) context.fill();
  else context.stroke();
}

function ticks(context, radius, count, longEvery, length, smallLength) {
  for (let index = 0; index < count; index += 1) {
    const angle = index * TAU / count;
    const inner = radius - (index % longEvery === 0 ? length : smallLength);
    line(context, Math.cos(angle) * inner, Math.sin(angle) * inner,
      Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}

function compass(context, radius) {
  for (let index = 0; index < 8; index += 1) {
    const angle = index * TAU / 8;
    const length = index % 2 === 0 ? radius : radius * 0.69;
    context.save();
    context.rotate(angle);
    context.beginPath();
    context.moveTo(0, -length);
    context.lineTo(length * 0.14, -length * 0.19);
    context.lineTo(0, -length * 0.32);
    context.lineTo(-length * 0.14, -length * 0.19);
    context.closePath();
    context.stroke();
    line(context, 0, -length, 0, -length * 0.32);
    context.restore();
  }
}

function crescent(context, x, y, radius, mirror = 1) {
  context.save();
  context.translate(x, y);
  context.scale(mirror, 1);
  context.beginPath();
  context.moveTo(radius * 0.28, -radius * 0.96);
  context.bezierCurveTo(-radius * 1.27, -radius * 0.8, -radius * 1.27,
    radius * 0.8, radius * 0.28, radius * 0.96);
  context.bezierCurveTo(-radius * 0.4, radius * 0.59, -radius * 0.4,
    -radius * 0.59, radius * 0.28, -radius * 0.96);
  context.closePath();
  context.stroke();
  context.restore();
}

function cornerOrnament(context, x, y, rotation) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  context.moveTo(0, 92);
  context.lineTo(0, 24);
  context.quadraticCurveTo(0, 0, 24, 0);
  context.lineTo(92, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(10, 78);
  context.bezierCurveTo(9, 35, 31, 40, 43, 44);
  context.bezierCurveTo(38, 24, 35, 12, 78, 10);
  context.stroke();
  diamond(context, 25, 25, 7, 7);
  circle(context, 50, 11, 2.5);
  circle(context, 11, 50, 2.5);
  context.restore();
}

export function createCardBack() {
  const { canvas, context: ctx } = canvas2d(CARD_WIDTH, CARD_HEIGHT);
  paper(ctx, CARD_WIDTH, CARD_HEIGHT, [20, 42, 43], 92761, 4);

  const sheen = ctx.createRadialGradient(384, 580, 60, 384, 632, 700);
  sheen.addColorStop(0, 'rgba(82, 106, 97, 0.13)');
  sheen.addColorStop(1, 'rgba(0, 5, 8, 0.22)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.strokeStyle = '#d2b779';
  ctx.fillStyle = '#d2b779';
  ctx.lineWidth = 2.2;
  roundedRect(ctx, 26, 26, 716, 1212, 31);
  ctx.stroke();
  ctx.lineWidth = 1.25;
  roundedRect(ctx, 40, 40, 688, 1184, 23);
  ctx.stroke();
  ctx.globalAlpha = 0.66;
  cornerOrnament(ctx, 64, 64, 0);
  cornerOrnament(ctx, 704, 64, Math.PI / 2);
  cornerOrnament(ctx, 704, 1200, Math.PI);
  cornerOrnament(ctx, 64, 1200, -Math.PI / 2);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(384, 632);

  // The paired instrument has 180-degree symmetry, so the back hides orientation.
  ctx.lineWidth = 2.2;
  ellipse(ctx, 0, 0, 240, 451);
  ctx.lineWidth = 1;
  ellipse(ctx, 0, 0, 228, 437);
  ctx.globalAlpha = 0.52;
  ellipse(ctx, 0, 0, 189, 411);
  line(ctx, -258, 0, 258, 0);
  line(ctx, 0, -470, 0, 470);
  ctx.globalAlpha = 1;

  for (const rotation of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(rotation);
    line(ctx, 0, -179, 0, -242);
    diamond(ctx, 0, -213, 6, 13, true);
    circle(ctx, 0, -302, 60);
    circle(ctx, 0, -302, 68);
    crescent(ctx, -3, -302, 32);
    diamond(ctx, 22, -302, 5, 10, true);
    line(ctx, 0, -377, 0, -401);
    diamond(ctx, 0, -421, 9, 15);

    ctx.globalAlpha = 0.6;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(72, -358);
      ctx.bezierCurveTo(159, -272, 196, -165, 191, -71);
      ctx.stroke();
      for (const [x, y, size] of [[102, -272, 6], [149, -195, 4], [178, -119, 5]]) {
        diamond(ctx, x, y, size * 0.6, size * 1.5);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.lineWidth = 1.6;
  circle(ctx, 0, 0, 168);
  circle(ctx, 0, 0, 153);
  circle(ctx, 0, 0, 122);
  ctx.lineWidth = 1.1;
  ticks(ctx, 165, 72, 6, 10, 4);
  ctx.lineWidth = 2;
  compass(ctx, 112);
  ctx.lineWidth = 1.3;
  circle(ctx, 0, 0, 25);
  circle(ctx, 0, 0, 17);
  ctx.save();
  ctx.rotate(Math.PI / 24);
  ticks(ctx, 39, 24, 2, 9, 5);
  ctx.restore();

  for (const side of [-1, 1]) {
    diamond(ctx, side * 259, 0, 8, 17);
    circle(ctx, side * 281, 0, 3);
  }

  // Tiny paired marks preserve rotational symmetry without competing with the art.
  for (const rotation of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(rotation);
    ctx.font = '17px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('A U G U R W E L L', 0, 511);
    line(ctx, -53, 530, 53, 530);
    diamond(ctx, 0, 548, 3, 5, true);
    ctx.restore();
  }
  ctx.restore();
  return canvas;
}

export function createCardFace() {
  const { canvas, context: ctx } = canvas2d(CARD_WIDTH, CARD_HEIGHT);
  paper(ctx, CARD_WIDTH, CARD_HEIGHT, [232, 223, 201], 18741, 5);

  ctx.strokeStyle = '#5b695e';
  ctx.fillStyle = '#3a514b';
  ctx.lineWidth = 2;
  roundedRect(ctx, 31, 31, 706, 1202, 25);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundedRect(ctx, 46, 46, 676, 1172, 19);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '25px Georgia, serif';
  ctx.fillText('I', 384, 123);
  line(ctx, 341, 147, 427, 147);

  ctx.save();
  ctx.translate(384, 553);
  ctx.lineWidth = 1.5;
  ellipse(ctx, 0, 20, 230, 315);
  ctx.globalAlpha = 0.55;
  ellipse(ctx, 0, 20, 218, 303);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#b4914f';
  circle(ctx, 0, -31, 108);
  circle(ctx, 0, -31, 98);
  ctx.save();
  ctx.translate(0, -31);
  ticks(ctx, 153, 48, 4, 27, 13);
  ctx.strokeStyle = '#52685c';
  circle(ctx, 0, 0, 35);
  compass(ctx, 78);
  ctx.restore();

  // Original abstract horizon, reflection and orbital marks; no deck image traced.
  ctx.strokeStyle = '#52685c';
  for (const [x, y, size] of [[-109, -207, 7], [93, -230, 5], [155, -129, 6], [-168, 54, 5]]) {
    diamond(ctx, x, y, size * 0.65, size * 1.6);
  }
  crescent(ctx, 0, -226, 22);
  ctx.beginPath();
  ctx.moveTo(-203, 160);
  ctx.bezierCurveTo(-148, 172, -125, 136, -69, 150);
  ctx.bezierCurveTo(-22, 163, 28, 141, 77, 151);
  ctx.bezierCurveTo(134, 165, 153, 142, 203, 160);
  ctx.stroke();
  for (let index = 0; index < 8; index += 1) {
    const y = 178 + index * 15;
    const width = 114 - index * 11;
    ctx.globalAlpha = 0.7 - index * 0.045;
    line(ctx, -width, y, width, y);
  }
  ctx.globalAlpha = 1;
  line(ctx, 0, 88, 0, 129);
  diamond(ctx, 0, 142, 4, 7);
  ctx.restore();

  ctx.fillStyle = '#3a514b';
  ctx.font = '27px Georgia, serif';
  ctx.fillText('THE STILL POINT', 384, 1003);
  ctx.strokeStyle = '#b4914f';
  line(ctx, 280, 1031, 488, 1031);
  ctx.font = '16px Georgia, serif';
  ctx.fillText('A U G U R W E L L', 384, 1095);
  return canvas;
}

export function createTableTexture() {
  const size = 1024;
  const { canvas, context } = canvas2d(size, size);
  const pixels = context.createImageData(size, size);
  // Both opposite edges share samples. Periodic threads and grain tile cleanly.
  const period = size - 1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x % period;
      const v = y % period;
      const warp = Math.sin(TAU * u * 128 / period);
      const weft = Math.sin(TAU * v * 128 / period);
      const weave = warp * weft * 1.05 + (warp + weft) * 0.45;
      const noise = (grain(u, v, 39477) - 0.5) * 2.0;
      const cloud = Math.sin(TAU * u * 3 / period) * Math.cos(TAU * v * 2 / period) * 0.45;
      const offset = (y * size + x) * 4;
      pixels.data[offset] = 25 + weave + noise + cloud;
      pixels.data[offset + 1] = 39 + weave + noise + cloud;
      pixels.data[offset + 2] = 36 + weave + noise + cloud;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function createRitualMat() {
  const { canvas, context: ctx } = canvas2d(1024, 1024);
  ctx.translate(512, 512);
  ctx.strokeStyle = 'rgba(194, 165, 105, 0.35)';
  ctx.fillStyle = 'rgba(194, 165, 105, 0.3)';
  ctx.lineWidth = 1.4;
  circle(ctx, 0, 0, 436);
  circle(ctx, 0, 0, 426);
  ctx.lineWidth = 0.9;
  ticks(ctx, 436, 120, 10, 16, 5);
  ctx.strokeStyle = 'rgba(194, 165, 105, 0.19)';
  circle(ctx, 0, 0, 383);
  for (let index = 0; index < 8; index += 1) {
    ctx.save();
    ctx.rotate(index * TAU / 8);
    line(ctx, 0, -365, 0, -394);
    diamond(ctx, 0, -405, 4, 7);
    ctx.restore();
  }
  return canvas;
}
