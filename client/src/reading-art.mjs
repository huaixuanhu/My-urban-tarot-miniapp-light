import { readingCard, fittedArtwork } from './reading-content.mjs';

// Vite packages the original files; the application keeps no second source deck.
const images = import.meta.glob('../public/images/cards/*.webp', { eager: true, query: '?url', import: 'default' });

export function readingCardImage(id) {
  const path = `../public${readingCard(id).image}`;
  const url = images[path];
  if (!url) throw new Error(`Missing original artwork: ${path}`);
  return url;
}

export async function createReadingCardFace(id) {
  const image = new Image();
  image.src = readingCardImage(id);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1264;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable for card art.');
  const fit = fittedArtwork(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
  ctx.fillStyle = '#171d19';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, fit.x, fit.y, fit.width, fit.height);
  return canvas;
}
