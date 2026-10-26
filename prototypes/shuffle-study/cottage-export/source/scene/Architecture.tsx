import { useEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute,
  MeshStandardMaterial, SRGBColorSpace,
} from 'three';
import type { MeshBasicMaterial, MeshPhysicalMaterial } from 'three';
import { FIXED_DAYLIGHT } from '../core/daylight';
import type { DaylightPalette } from '../core/daylight';

type V3 = [number, number, number];
const charcoal = '#393d3c';
const cream = '#e9e1ce';

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The room textures could not be created.');
  paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeOak() {
  const random = seeded(1605);
  return canvasTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#c3a37a'; ctx.fillRect(0, 0, 1024, 1024);
    const plank = 57;
    for (let column = 0; column < 18; column++) {
      const x = column * plank;
      let y = -random() * 270;
      while (y < 1024) {
        const length = 230 + random() * 170;
        const tone = random();
        ctx.fillStyle = `rgb(${192 + tone * 24},${158 + tone * 25},${112 + tone * 25})`;
        ctx.fillRect(x + 0.8, y + 0.8, plank - 1.3, length - 1.2);
        for (let grain = 0; grain < 40; grain++) {
          const gx = x + 3 + random() * (plank - 6);
          ctx.strokeStyle = `rgba(102,73,39,${0.045 + random() * 0.105})`;
          ctx.lineWidth = 0.55 + random() * 1.3;
          ctx.beginPath(); ctx.moveTo(gx, y + 2);
          ctx.bezierCurveTo(gx + random() * 5, y + length * 0.33,
            gx - random() * 5, y + length * 0.68, gx + random() * 2, y + length - 3);
          ctx.stroke();
        }
        if (random() > 0.64) {
          const knotX = x + 16 + random() * 25;
          const knotY = y + length * (0.3 + random() * 0.4);
          for (let contour = 1; contour < 5; contour++) {
            ctx.strokeStyle = `rgba(114,81,43,${0.12 - contour * 0.018})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.ellipse(knotX, knotY, 1.2 + contour * 1.7, 3 + contour * 9, 0, 0, Math.PI * 2); ctx.stroke();
          }
        }
        const wash = ctx.createLinearGradient(x, 0, x + plank, 0);
        wash.addColorStop(0, 'rgba(255,240,211,0.12)');
        wash.addColorStop(0.48, 'rgba(102,67,33,0.025)');
        wash.addColorStop(1, 'rgba(238,211,164,0.09)');
        ctx.fillStyle = wash; ctx.fillRect(x + 1, y + 1, plank - 2, length - 2);
        ctx.strokeStyle = 'rgba(249,229,189,0.34)'; ctx.lineWidth = 0.8;
        ctx.strokeRect(x + 1.3, y + 1.3, plank - 2.3, length - 2.2);
        y += length;
      }
    }
  });
}

function makeTile() {
  const random = seeded(421);
  return canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#b9b2a5'; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
      const tone = random() * 12;
      ctx.fillStyle = `rgb(${219 + tone},${214 + tone},${201 + tone})`;
      ctx.fillRect(col * 85.333 + 1.1, row * 64 + 1.1, 83.5, 62.2);
    }
  });
}

function makeCityPanorama(night = false) {
  const random = seeded(4507);
  return canvasTexture(2048, 768, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 768);
    sky.addColorStop(0, night ? '#18283e' : '#e8d9c8'); sky.addColorStop(0.37, night ? '#293952' : '#f9e5c4');
    sky.addColorStop(0.65, night ? '#495464' : '#eadbc4'); sky.addColorStop(1, night ? '#69656b' : '#bbbba8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 2048, 768);
    const sunshine = ctx.createRadialGradient(1510, 180, 12, 1510, 180, 590);
    sunshine.addColorStop(0, night ? 'rgba(168,187,220,0.13)' : 'rgba(255,249,215,0.95)');
    sunshine.addColorStop(0.3, night ? 'rgba(168,187,220,0.04)' : 'rgba(255,240,196,0.45)');
    sunshine.addColorStop(1, 'rgba(255,240,196,0)');
    ctx.fillStyle = sunshine; ctx.fillRect(0, 0, 2048, 768);
    for (let layer = 0; layer < 3; layer++) {
      ctx.save(); ctx.filter = `blur(${3 - layer}px)`;
      let x = -35;
      while (x < 2048) {
        const width = 28 + random() * (layer === 0 ? 52 : 90);
        const height = 90 + random() * (layer === 0 ? 225 : 340);
        const baseline = 655 + layer * 50;
        const top = baseline - height;
        const colors = night
          ? layer === 0 ? ['#465366', '#434b60', '#505361']
            : layer === 1 ? ['#293e51', '#424550', '#314451'] : ['#243547', '#373e48', '#2c3e49']
          : layer === 0 ? ['#c6c9c2', '#c6c7c3', '#d1c8b8']
            : layer === 1 ? ['#b6bfc0', '#c5bba9', '#b9c1b6'] : ['#a7b3b3', '#b8b29f', '#acb6ab'];
        ctx.globalAlpha = layer === 0 ? 0.5 : layer === 1 ? 0.67 : 0.8;
        ctx.fillStyle = colors[Math.floor(random() * colors.length)];
        ctx.fillRect(x, top, width, height);
        if (random() > 0.6) ctx.fillRect(x + width * 0.2, top - 10, width * 0.6, 10);
        const side = ctx.createLinearGradient(x, 0, x + width, 0);
        side.addColorStop(0, night ? 'rgba(165,188,218,0.14)' : 'rgba(255,240,213,0.26)'); side.addColorStop(0.72, 'rgba(255,240,213,0)');
        side.addColorStop(1, 'rgba(80,100,106,0.1)');
        ctx.fillStyle = side; ctx.fillRect(x, top, width, height);
        if (layer > 0) {
          for (let wy = top + 13; wy < baseline; wy += 19) {
            for (let wx = x + 8; wx < x + width - 6; wx += 14) {
              const lit = random() > (night ? 0.48 : 0.78);
              ctx.fillStyle = lit ? night ? 'rgba(255,218,155,0.9)' : 'rgba(255,232,176,0.65)' : night ? 'rgba(125,158,193,0.16)' : 'rgba(100,126,133,0.2)';
              ctx.fillRect(wx, wy, 5, 8);
            }
          }
        }
        x += width + 8 + random() * 21;
      }
      ctx.restore();
    }
    const haze = ctx.createLinearGradient(0, 300, 0, 768);
    haze.addColorStop(0, 'rgba(251,228,194,0)');
    haze.addColorStop(0.7, night ? 'rgba(159,143,147,0.05)' : 'rgba(245,222,183,0.12)');
    haze.addColorStop(1, night ? 'rgba(177,151,142,0.18)' : 'rgba(235,219,182,0.4)');
    ctx.fillStyle = haze; ctx.fillRect(0, 0, 2048, 768);
  });
}

function curtainGeometry() {
  const vertices: number[] = [];
  const divisions = 48;
  const vertex = (column: number, top: boolean) => {
    const progress = column / divisions;
    const x = (progress - 0.5) * 1.2;
    return [x, top ? 2.79 : 0, Math.sin(progress * Math.PI * 16) * (top ? 0.035 : 0.065)];
  };
  for (let i = 0; i < divisions; i++) {
    vertices.push(...vertex(i, false), ...vertex(i + 1, false), ...vertex(i, true),
      ...vertex(i, true), ...vertex(i + 1, false), ...vertex(i + 1, true));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function Solid({ at, size, color = cream, radius = 0.025 }: {
  at: V3; size: V3; color?: string; radius?: number;
}) {
  return <RoundedBox position={at} args={size} radius={radius} smoothness={2} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={0.86} />
  </RoundedBox>;
}

function Beam({ at, size }: { at: V3; size: V3 }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={charcoal} roughness={0.55} metalness={0.18} />
  </mesh>;
}

export function Architecture({ onFloorClick, palette = FIXED_DAYLIGHT, reducedMotion = false }: {
  onFloorClick: (point: { x: number; z: number }) => void;
  palette?: Readonly<DaylightPalette>;
  reducedMotion?: boolean;
}) {
  const cityMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  const nightMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  const glassMaterials = useRef<(MeshPhysicalMaterial | null)[]>([]);
  const tint = useMemo(() => ({city: new Color(palette.cityTint), window: new Color(palette.windowTint)}), [palette.cityTint, palette.windowTint]);
  useFrame((_, dt) => {
    const blend = reducedMotion ? 1 : 1 - Math.exp(-2.8 * Math.min(dt, .1));
    for (const material of cityMaterials.current) material?.color.lerp(tint.city, blend);
    for (const material of glassMaterials.current) material?.color.lerp(tint.window, blend);
    for (const material of nightMaterials.current) if (material) material.opacity += (palette.nightMix - material.opacity) * blend;
  });
  const assets = useMemo(() => {
    const oak = makeOak(), tile = makeTile(), city = makeCityPanorama(), nightCity = makeCityPanorama(true);
    const curtain = curtainGeometry();
    const curtainMaterial = new MeshStandardMaterial({
      color: '#fff2d5', roughness: 1, transparent: true, opacity: 0.57,
      side: DoubleSide, depthWrite: false,
    });
    return { oak, tile, city, nightCity, curtain, curtainMaterial };
  }, []);
  useEffect(() => () => {
    assets.oak.dispose(); assets.tile.dispose(); assets.city.dispose(); assets.nightCity.dispose();
    assets.curtain.dispose(); assets.curtainMaterial.dispose();
  }, [assets]);
  const clickFloor = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    event.stopPropagation();
    onFloorClick({ x: event.point.x, z: event.point.z });
  };

  return <group name="apartment-architecture">
    <Solid at={[0, -0.2, 0.2]} size={[10.28, 0.38, 9.88]} color="#b29a78" radius={0.11} />
    <Solid at={[0, -0.075, 0.2]} size={[10.12, 0.13, 9.72]} color="#e3c9a1" radius={0.045} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.2]} receiveShadow onClick={clickFloor}>
      <planeGeometry args={[10, 9.6]} />
      <meshStandardMaterial map={assets.oak} color="#f8e5be" roughness={0.73} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.5, 0.012, 3.2]} receiveShadow onClick={clickFloor}>
      <planeGeometry args={[2.4, 3.2]} /><meshStandardMaterial map={assets.tile} roughness={0.67} />
    </mesh>

    {/* Solid sides become low cutaway walls on the camera-facing edges. */}
    <Solid at={[-5, 1.4, 1.45]} size={[0.16, 2.8, 7.1]} />
    <Solid at={[-4.895, 0.09, 1.45]} size={[0.055, 0.18, 7.1]} color="#d7c9af" radius={0.012} />
    <Solid at={[5, 0.27, 0.2]} size={[0.16, 0.54, 9.6]} />
    <Solid at={[0, 0.13, 5]} size={[10, 0.26, 0.16]} />
    <Solid at={[5, 0.55, 0.2]} size={[0.19, 0.055, 9.6]} color="#c7b99f" radius={0.018} />
    <Solid at={[0, 0.275, 5]} size={[10.1, 0.055, 0.2]} color="#c7b99f" radius={0.018} />

    {[[-1.95, -0.65], [0.35, 2], [3.05, 5]].map(([start, end]) => <group key={start}>
      <Solid at={[(start + end) / 2, 0.2, 1.45]} size={[end - start, 0.4, 0.15]} />
      <Solid at={[(start + end) / 2, 0.415, 1.45]} size={[end - start + 0.03, 0.045, 0.19]} color="#c3b498" radius={0.016} />
      <Solid at={[(start + end) / 2, 0.08, 1.345]} size={[end - start, 0.16, 0.045]} color="#d8cab2" radius={0.01} />
    </group>)}
    <Solid at={[-1.85, 0.3, 3.225]} size={[0.14, 0.6, 3.55]} />
    <Solid at={[-1.85, 0.615, 3.225]} size={[0.18, 0.045, 3.58]} color="#c3b498" radius={0.016} />
    <Solid at={[0.8, 0.3, 3.775]} size={[0.14, 0.6, 2.45]} />
    <Solid at={[0.8, 0.615, 3.775]} size={[0.18, 0.045, 2.48]} color="#c3b498" radius={0.016} />

    {/* Entrance door lies against the left wall; the cutaway remains open in front. */}
    <Solid at={[-4.88, 1.04, 3.82]} size={[0.085, 2.08, 1.08]} color="#80705c" radius={0.018} />
    <Solid at={[-4.82, 1.04, 3.82]} size={[0.04, 1.93, 0.93]} color="#92795d" radius={0.012} />
    <Beam at={[-4.775, 1.0, 3.49]} size={[0.045, 0.16, 0.045]} />
    <Beam at={[-4.71, 1.04, 3.55]} size={[0.12, 0.035, 0.16]} />
    <Solid at={[-4.3, 0.024, 3.85]} size={[1.1, 0.035, 1.2]} color="#b6aa92" radius={0.04} />

    {/* Floor-to-ceiling glass, with narrow mullions and raised roller blinds. */}
    <mesh position={[0, 1.55, -4.59]}>
      <planeGeometry args={[10, 3.1]} />
      <meshPhysicalMaterial ref={material => {glassMaterials.current[0] = material;}} color="#d8e7e6" transparent opacity={0.11} roughness={0.15}
        metalness={0.1} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[-4.99, 1.55, -3.35]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[2.5, 3.1]} />
      <meshPhysicalMaterial ref={material => {glassMaterials.current[1] = material;}} color="#d8e7e6" transparent opacity={0.1} roughness={0.15}
        metalness={0.1} side={DoubleSide} depthWrite={false} />
    </mesh>
    {[-5, -3, -1, 1, 3, 5].map(x => <Beam key={x} at={[x, 1.55, -4.57]} size={[0.075, 3.1, 0.11]} />)}
    {[0.055, 1.04, 3.08].map(y => <Beam key={y} at={[0, y, -4.57]} size={[10.1, y === 3.08 ? 0.13 : 0.065, 0.11]} />)}
    {[-4.6, -3.35, -2.1].map(z => <Beam key={z} at={[-4.98, 1.55, z]} size={[0.1, 3.1, 0.07]} />)}
    {[0.055, 1.04, 3.08].map(y => <Beam key={y} at={[-4.98, y, -3.35]} size={[0.11, y === 3.08 ? 0.13 : 0.065, 2.5]} />)}
    {[-4, -2, 0, 2, 4].map((x, index) => <group key={x}>
      <Solid at={[x, 2.96 - index % 2 * 0.025, -4.48]} size={[1.91, 0.26 + index % 2 * 0.05, 0.035]}
        color="#8d887b" radius={0.012} />
      <Beam at={[x, 2.82 - index % 2 * 0.05, -4.46]} size={[1.91, 0.022, 0.045]} />
    </group>)}
    <mesh geometry={assets.curtain} material={assets.curtainMaterial} position={[-4.29, 0.25, -4.34]} />
    <mesh geometry={assets.curtain} material={assets.curtainMaterial} position={[-4.78, 0.25, -3.83]} rotation={[0, Math.PI / 2, 0]} />
    <Beam at={[-4.29, 3.04, -4.33]} size={[1.31, 0.025, 0.025]} />

    {/* The painted distant view is bounded by the real window frames. */}
    <mesh position={[0, 1.55, -4.65]} name="city-through-back-window">
      <planeGeometry args={[9.94, 3.04]} />
      <meshBasicMaterial ref={material => {cityMaterials.current[0] = material;}} map={assets.city} toneMapped={false} />
    </mesh>
    <mesh position={[-5.045, 1.55, -3.35]} rotation={[0, Math.PI / 2, 0]} name="city-through-side-window">
      <planeGeometry args={[2.44, 3.04]} />
      <meshBasicMaterial ref={material => {cityMaterials.current[1] = material;}} map={assets.city} toneMapped={false} />
    </mesh>
    {/* Same deterministic skyline, with lit windows; textures stay allocated across clock ticks. */}
    <mesh position={[0, 1.55, -4.649]} name="night-city-through-back-window">
      <planeGeometry args={[9.94, 3.04]} />
      <meshBasicMaterial ref={material => {nightMaterials.current[0] = material;}} map={assets.nightCity} toneMapped={false} transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh position={[-5.044, 1.55, -3.35]} rotation={[0, Math.PI / 2, 0]} name="night-city-through-side-window">
      <planeGeometry args={[2.44, 3.04]} />
      <meshBasicMaterial ref={material => {nightMaterials.current[1] = material;}} map={assets.nightCity} toneMapped={false} transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>;
}
