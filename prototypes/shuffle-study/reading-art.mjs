/** Original numbered demonstration cards. These are not authored tarot meanings. */

const WIDTH = 384;
const HEIGHT = 632;
const TAU = Math.PI * 2;
const INK = '#203c31';
const GOLD = '#765326';
const LABELS = ['微光', '潮汐', '回声', '静水', '晨星', '归途', '山脊', '月影', '风向', '枝芽', '涟漪', '远岸', '余温'];

function requireCardId(id) {
  if (!Number.isInteger(id) || id < 0 || id >= 78) {
    throw new RangeError('A demonstration card ID must be an integer from 0 to 77.');
  }
  return id;
}

function cardNumber(id) {
  return String(id + 1).padStart(2, '0');
}

export function readingCardLabel(id) {
  requireCardId(id);
  return `示例牌 ${cardNumber(id)} · ${LABELS[id % LABELS.length]}`;
}

function noise(x, y) {
  let value = Math.imul(x ^ 18741, 374761393) ^ Math.imul(y + 18741, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function paper(ctx) {
  const image = ctx.createImageData(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = (y * WIDTH + x) * 4;
      const grain = (noise(x, y) - 0.5) * 4 + Math.sin(y * 1.31) * 0.4;
      image.data[index] = 232 + grain;
      image.data[index + 1] = 223 + grain;
      image.data[index + 2] = 201 + grain;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.stroke();
}

function star(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.quadraticCurveTo(x + radius * 0.16, y - radius * 0.16, x + radius * 0.6, y);
  ctx.quadraticCurveTo(x + radius * 0.16, y + radius * 0.16, x, y + radius);
  ctx.quadraticCurveTo(x - radius * 0.16, y + radius * 0.16, x - radius * 0.6, y);
  ctx.quadraticCurveTo(x - radius * 0.16, y - radius * 0.16, x, y - radius);
  ctx.closePath();
  ctx.stroke();
}

function frame(ctx, inset, radius) {
  const right = WIDTH - inset;
  const bottom = HEIGHT - inset;
  ctx.beginPath();
  ctx.moveTo(inset + radius, inset);
  ctx.lineTo(right - radius, inset);
  ctx.quadraticCurveTo(right, inset, right, inset + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(inset + radius, bottom);
  ctx.quadraticCurveTo(inset, bottom, inset, bottom - radius);
  ctx.lineTo(inset, inset + radius);
  ctx.quadraticCurveTo(inset, inset, inset + radius, inset);
  ctx.closePath();
  ctx.stroke();
}

function waves(ctx, startY, count = 5, width = 91) {
  for (let index = 0; index < count; index += 1) {
    const y = startY + index * 14;
    const w = width - index * 7;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.bezierCurveTo(-w * 0.65, y - 9, -w * 0.35, y + 9, 0, y);
    ctx.bezierCurveTo(w * 0.35, y - 9, w * 0.65, y + 9, w, y);
    ctx.stroke();
  }
}

function compass(ctx, phase) {
  circle(ctx, 0, 0, 81);
  circle(ctx, 0, 0, 74);
  ctx.strokeStyle = GOLD;
  for (let index = 0; index < 48; index += 1) {
    const angle = index * TAU / 48;
    const inner = index % 6 === 0 ? 84 : 89;
    line(ctx, Math.sin(angle) * inner, Math.cos(angle) * inner,
      Math.sin(angle) * 95, Math.cos(angle) * 95);
  }
  ctx.save();
  ctx.rotate(phase * 0.025);
  for (let index = 0; index < 8; index += 1) {
    const radius = index % 2 === 0 ? 62 : 39;
    ctx.rotate(TAU / 8);
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(8, -10);
    ctx.lineTo(0, -18);
    ctx.lineTo(-8, -10);
    ctx.closePath();
    ctx.stroke();
    line(ctx, 0, -radius, 0, -18);
  }
  ctx.restore();
  circle(ctx, 0, 0, 13);
  star(ctx, 0, -128, 9);
  star(ctx, 0, 128, 9);
}

function dawn(ctx, phase) {
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 9, 58, Math.PI, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 9, 50, Math.PI, TAU);
  ctx.stroke();
  for (let index = 0; index <= 16; index += 1) {
    const angle = Math.PI + index * Math.PI / 16;
    const length = index % 2 === 0 ? 100 : 88;
    line(ctx, Math.cos(angle) * 68, 9 + Math.sin(angle) * 68,
      Math.cos(angle) * length, 9 + Math.sin(angle) * length);
  }
  ctx.strokeStyle = INK;
  line(ctx, -107, 10, 107, 10);
  waves(ctx, 31, 6);
  star(ctx, -45 + phase * 7, -130, 7);
}

function moon(ctx, phase) {
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(20, -95);
  ctx.bezierCurveTo(-80, -79, -80, 37, 20, 53);
  ctx.bezierCurveTo(-27, 19, -27, -61, 20, -95);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = INK;
  star(ctx, 64, -46, 12);
  star(ctx, 39, 11, 6);
  star(ctx, -46, -127, 5);
  circle(ctx, 28 + phase * 2, -105, 3);
  waves(ctx, 88, 4, 79);
}

function orbit(ctx, phase) {
  ctx.strokeStyle = GOLD;
  circle(ctx, 0, 0, 25);
  circle(ctx, 0, 0, 17);
  ellipse(ctx, 0, 0, 108, 40, -0.6);
  ctx.strokeStyle = INK;
  ellipse(ctx, 0, 0, 91, 135, 0.34);
  ellipse(ctx, 0, 0, 53, 113, -0.26);
  const angle = phase * 0.45;
  const x = Math.cos(angle) * 107;
  const y = Math.sin(angle) * 40;
  ctx.save();
  ctx.rotate(-0.6);
  ctx.fillStyle = '#e8dfc9';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  star(ctx, 57, -124, 7);
  star(ctx, -73, 115, 6);
}

function passage(ctx, phase) {
  ctx.strokeStyle = INK;
  for (let index = 0; index < 5; index += 1) {
    const radius = 92 - index * 14;
    const base = 101 - index * 8;
    ctx.beginPath();
    ctx.moveTo(-radius, base);
    ctx.lineTo(-radius, -28);
    ctx.arc(0, -28, radius, Math.PI, TAU);
    ctx.lineTo(radius, base);
    ctx.stroke();
  }
  ctx.strokeStyle = GOLD;
  circle(ctx, 0, -17, 18);
  star(ctx, 0, -17, 10);
  for (let index = 0; index < 5; index += 1) {
    const y = 50 + index * 19;
    const w = 12 + index * 14;
    line(ctx, -w, y, w, y);
  }
  circle(ctx, -99, -117 + phase * 2, 3);
}

function branch(ctx, phase) {
  ctx.beginPath();
  ctx.moveTo(0, 119);
  ctx.bezierCurveTo(-12, 60, 12, -33, 0, -106);
  ctx.stroke();
  for (let index = 0; index < 6; index += 1) {
    const y = 70 - index * 29;
    const side = index % 2 === 0 ? -1 : 1;
    const reach = 43 + Math.sin(index + phase) * 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(side * 7, y - 21, side * reach, y - 43, side * reach, y - 29);
    ctx.bezierCurveTo(side * reach, y - 5, side * 17, y + 3, 0, y);
    ctx.stroke();
    line(ctx, 0, y, side * reach, y - 29);
  }
  ctx.strokeStyle = GOLD;
  circle(ctx, 0, -128, 13);
  circle(ctx, 0, -128, 19);
  ellipse(ctx, 0, 129, 51, 8);
  star(ctx, 74, -43, 7);
  star(ctx, -79, 21, 5);
}

const MOTIFS = [compass, dawn, moon, orbit, passage, branch];

/** Call on first reveal and cache the resulting texture in the scene owner. */
export function createReadingCardFace(id) {
  requireCardId(id);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable for demonstration card art.');
  paper(ctx);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  frame(ctx, 15, 14);
  ctx.lineWidth = 0.9;
  frame(ctx, 23, 9);

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '13px Georgia, serif';
  ctx.fillText('A U G U R W E L L', WIDTH / 2, 63);
  ctx.font = '48px Georgia, serif';
  ctx.fillText(cardNumber(id), WIDTH / 2, 113);
  ctx.strokeStyle = GOLD;
  line(ctx, 160, 132, 224, 132);

  ctx.save();
  ctx.translate(WIDTH / 2, 322);
  ctx.strokeStyle = 'rgba(32, 60, 49, 0.48)';
  ctx.lineWidth = 1.1;
  ellipse(ctx, 0, 0, 132, 169);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  MOTIFS[id % MOTIFS.length](ctx, Math.floor(id / MOTIFS.length));
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.font = '34px "Songti SC", "Noto Serif CJK SC", "STSong", serif';
  ctx.fillText(LABELS[id % LABELS.length], WIDTH / 2, 545);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.1;
  line(ctx, 151, 564, 233, 564);
  ctx.fillStyle = '#3c5140';
  ctx.font = '14px "Songti SC", "Noto Serif CJK SC", "STSong", serif';
  ctx.fillText('示 例 牌', WIDTH / 2, 590);
  return canvas;
}
