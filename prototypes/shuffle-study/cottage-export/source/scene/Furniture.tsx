import { memo, useCallback, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { InteractionId, RoomSnapshot, ZoneId } from '../core/types';
import { createMathBoardTexture } from './textures';
import { COFFEE_RUG } from '../core/surfaces';
import { MATH_BOARD } from '../core/boardLayout';

type V3 = [number, number, number];
type FurnitureProps = { onZoneClick: (id: ZoneId) => void; onInteractionClick: (id: InteractionId) => void };

const material = (color: string, roughness = 0.72, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  ivory: material('#eee8d9'), cream: material('#e9e0cc'), white: material('#faf9ef'),
  oak: material('#be966b'), honey: material('#c7a073'), darkWood: material('#785a43'),
  black: material('#222b2d', 0.45), charcoal: material('#343d3c', 0.5),
  gold: material('#b99654', 0.3, 0.65), chrome: material('#a7abaa', 0.24, 0.8),
  sage: material('#a6b4a0'), blue: material('#899fa8'), ink: material('#33455c'),
  rose: material('#d5b4a9'), green: material('#6c8250'), leaf: material('#91a16c'),
  soil: material('#65513b'), pottery: material('#d5bd9c'), burgundy: material('#925d5b'),
  paper: material('#f4e7c9'), shadow: material('#aaa99f'),
  bulb: new THREE.MeshStandardMaterial({ color: '#ffedc5', emissive: '#ffd59b', emissiveIntensity: .8 }),
  deskPad: material('#57605c', .95), seam: material('#d0c4ae', .96),
};
M.green.side = M.leaf.side = THREE.DoubleSide;

function Block({ at, size, mat = M.ivory, radius = 0.035, rotation }: {
  at: V3; size: V3; mat?: THREE.Material; radius?: number; rotation?: V3;
}) {
  return <RoundedBox args={size} radius={Math.min(radius, ...size.map(v => v / 2 - .0001))} smoothness={2}
    position={at} rotation={rotation} material={mat} castShadow receiveShadow />;
}

function Ball({ at, scale, mat = M.ivory }: { at: V3; scale: V3; mat?: THREE.Material }) {
  return <mesh position={at} scale={scale} material={mat} castShadow receiveShadow><sphereGeometry args={[1, 16, 12]} /></mesh>;
}

function Rod({ from, to, radius = .025, mat = M.black }: { from: V3; to: V3; radius?: number; mat?: THREE.Material }) {
  const { mid, length, rotation } = useMemo(() => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    return { mid: start.clone().add(end).multiplyScalar(.5), length: direction.length(), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()) };
  }, [from.join(','), to.join(',')]);
  return <mesh position={mid} quaternion={rotation} material={mat} castShadow><cylinderGeometry args={[radius, radius, length, 10]} /></mesh>;
}

function Disc({ at, radius, height = .04, mat = M.oak }: { at: V3; radius: number; height?: number; mat?: THREE.Material }) {
  return <mesh position={at} material={mat} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 48]} /></mesh>;
}

function makeCanvas(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function screenTexture(kind: number) {
  return makeCanvas(768, 480, c => {
    c.fillStyle = '#172429'; c.fillRect(0, 0, 768, 480);
    c.fillStyle = '#24353a'; c.fillRect(0, 0, 768, 47);
    c.fillStyle = '#b5c6bc'; c.font = '15px monospace'; c.fillText(kind ? 'RESEARCH NOTEBOOK' : 'MARKET OBSERVATORY', 24, 30);
    c.fillStyle = '#789083'; c.font = '11px monospace'; c.fillText('ILLUSTRATIVE / DEMO', 590, 29);
    if (!kind) {
      c.strokeStyle = '#30454a'; c.lineWidth = 1;
      for (let y = 85; y < 410; y += 58) { c.beginPath(); c.moveTo(30, y); c.lineTo(736, y); c.stroke(); }
      for (let x = 30; x < 740; x += 85) { c.beginPath(); c.moveTo(x, 70); c.lineTo(x, 418); c.stroke(); }
      c.beginPath();
      for (let i = 0; i < 80; i++) {
        const x = 35 + i * 8.8, y = 340 - i * 2.8 + Math.sin(i * .52) * 29 + Math.cos(i * 1.9) * 8;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = '#dfae78'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#395d59';
      for (let i = 0; i < 60; i++) c.fillRect(35 + i * 11.6, 447 - (12 + (Math.sin(i * 2.1) + 1) * 12), 6, 12 + (Math.sin(i * 2.1) + 1) * 12);
    } else {
      c.fillStyle = '#1e2f35'; c.fillRect(20, 67, 410, 379);
      ['#c6a886', '#a9b6c8', '#85b1a5'].forEach((color, k) => {
        c.fillStyle = color;
        for (let i = 0; i < 8; i++) c.fillRect(38 + (i % 3) * 13, 88 + (i * 3 + k) * 13, 65 + ((i * 37 + k * 61) % 255), 4);
      });
      c.strokeStyle = '#9baecc'; c.lineWidth = 2;
      for (let l = 0; l < 4; l++) {
        c.beginPath();
        for (let i = 0; i < 80; i++) { const x = 458 + i * 3.5, y = 310 - Math.exp(-Math.pow((i - 25 - l * 9) / (11 + l * 2), 2)) * (150 - l * 18); if (!i) c.moveTo(x, y); else c.lineTo(x, y); }
        c.stroke();
      }
      c.fillStyle = '#597670'; for (let i = 0; i < 8; i++) c.fillRect(460 + i * 32, 410 - (i % 4 + 1) * 13, 21, (i % 4 + 1) * 13);
    }
  });
}

function fabricTexture() {
  const t = makeCanvas(128, 128, c => {
    c.fillStyle = '#e6dfce'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 3) {
      c.strokeStyle = i % 2 ? '#d7cfbd' : '#f1eadd'; c.lineWidth = .6;
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke();
      c.strokeStyle = '#cfc7b344'; c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}

function rugTexture() {
  return makeCanvas(1024, 768, c => {
    c.fillStyle = '#d8c6a9'; c.fillRect(0, 0, 1024, 768);
    c.strokeStyle = '#a9917150'; c.lineWidth = 2;
    for (let i = 0; i < 1024; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 768); c.stroke(); }
    c.strokeStyle = '#f2e6cc60'; c.lineWidth = 1;
    for (let i = 0; i < 768; i += 3) { c.beginPath(); c.moveTo(0, i); c.lineTo(1024, i); c.stroke(); }
    c.strokeStyle = '#9c80607a'; c.lineWidth = 9; c.strokeRect(28, 28, 968, 712);
    c.lineWidth = 3; c.strokeRect(48, 48, 928, 672);
    const diamond = (x: number, y: number, w: number, h: number) => { c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h); c.lineTo(x - w, y); c.closePath(); c.stroke(); };
    for (let y = 162; y < 700; y += 222) for (let x = 170; x < 950; x += 228) {
      c.strokeStyle = '#aa89656b'; c.lineWidth = 5; diamond(x, y, 93, 90);
      c.strokeStyle = '#f1e4caab'; c.lineWidth = 6; diamond(x, y, 64, 62);
      c.strokeStyle = '#9f886c8c'; c.lineWidth = 3; diamond(x, y, 18, 18);
      c.beginPath(); c.moveTo(x - 37, y); c.lineTo(x + 37, y); c.moveTo(x, y - 37); c.lineTo(x, y + 37); c.stroke();
    }
  });
}

function DrapedThrow() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(.85, 1, 20, 32), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = .5 - p.getY(i);
      // Follow the cushion, bend across its front edge, then hang in loose folds.
      const z = t < .58 ? -.17 + t * 1.36 : .619 + Math.sin((t - .58) * Math.PI) * .025;
      const y = t < .58 ? .765 : .765 - (t - .58) * 1.5;
      const fold = Math.sin(x * 31 + t * 1.4) * .019;
      p.setXYZ(i, x + .62, y + (t < .58 ? fold : 0), z + (t >= .58 ? fold : 0));
    }
    g.computeVertexNormals(); return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#748f9b', map: fabricTexture(), side: THREE.DoubleSide, roughness: .98 }), []);
  return <group>
    <mesh geometry={geometry} material={mat} castShadow receiveShadow />
    {Array.from({ length: 19 }, (_, i) => <Rod key={i} from={[.22 + i * .044, .135, .64 + Math.sin(i * 1.4) * .02]} to={[.22 + i * .044, .066 + (i % 3) * .007, .66 + Math.sin(i * 1.4) * .02]} radius={.007} mat={M.cream} />)}
  </group>;
}

function Monitor({ z, kind, onClick }: { z: number; kind: number; onClick?: (event: ThreeEvent<MouseEvent>) => void }) {
  const texture = useMemo(() => screenTexture(kind), [kind]);
  const curved = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.15, .7, 28, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, .065 * Math.pow(pos.getX(i) / .575, 2));
    geo.computeVertexNormals(); return geo;
  }, []);
  return <group>
    <Block at={[-4.76, 1.01, z + .25]} size={[.13, .16, .15]} mat={M.charcoal} radius={.01} />
    <Rod from={[-4.73, 1.02, z + .25]} to={[-4.73, 1.53, z + .25]} radius={.035} />
    <Rod from={[-4.73, 1.5, z + .25]} to={[-4.48, 1.65, z + .38]} radius={.036} />
    <Rod from={[-4.48, 1.65, z + .38]} to={[-4.32, 1.61, z]} radius={.034} />
    <Ball at={[-4.48, 1.65, z + .38]} scale={[.065, .065, .065]} mat={M.black} />
    <group position={[-4.29, 1.62, z]} rotation={[0, Math.PI / 2, 0]} onClick={onClick}>
      <mesh geometry={curved} scale={[1.055, 1.085, 1]} material={M.black} castShadow />
      <mesh geometry={curved} position={[0, 0, .008]}>
        <meshStandardMaterial map={texture} roughness={.36} emissive='#ffffff' emissiveMap={texture} emissiveIntensity={.19} />
      </mesh>
      <Block at={[0, -.379, .025]} size={[.11, .009, .014]} mat={M.chrome} radius={.004} />
    </group>
  </group>;
}

const Chair = memo(function Chair({ z, x = -3.12, blush = false, onClick }: { z: number; x?: number; blush?: boolean; onClick: (event: ThreeEvent<MouseEvent>) => void }) {
  return <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]} onClick={onClick}>
    <Rod from={[0, .13, 0]} to={[0, .53, 0]} radius={.04} mat={M.chrome} />
    {[0, 1, 2, 3, 4].map(i => { const a = i * Math.PI * 2 / 5, x = Math.cos(a) * .35, z1 = Math.sin(a) * .35; return <group key={i}>
      <Rod from={[0, .17, 0]} to={[x, .11, z1]} radius={.023} />
      <Ball at={[x, .075, z1]} scale={[.055, .055, .055]} mat={M.black} />
    </group>; })}
    <Block at={[0, .59, 0]} size={[.65, .15, .62]} mat={blush ? M.rose : M.shadow} radius={.07} />
    <Block at={[0, 1.03, .26]} size={[.61, .77, .15]} mat={blush ? M.rose : M.shadow} radius={.07} rotation={[-.12, 0, 0]} />
    <Block at={[0, 1.09, .17]} size={[.49, .55, .055]} mat={M.ivory} radius={.025} rotation={[-.12, 0, 0]} />
    {[-1, 1].map(s => <group key={s}><Rod from={[s * .28, .62, .12]} to={[s * .32, .85, .12]} radius={.02} mat={M.chrome} /><Block at={[s * .32, .87, -.015]} size={[.08, .06, .34]} mat={M.charcoal} /></group>)}
  </group>;
});

function Plant({ at, scale = 1, small = false }: { at: V3; scale?: number; small?: boolean }) {
  const leaves = small ? 9 : 22;
  const leafGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 6, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, t = p.getY(i) + .5;
      p.setXYZ(i, u * Math.sin(Math.PI * t) * .16, t * .43, Math.sin(Math.PI * t) * (.055 + Math.abs(u) * .035));
    }
    g.computeVertexNormals(); return g;
  }, []);
  return <group position={at} scale={scale}>
    <mesh position={[0, .17, 0]} material={M.pottery} castShadow><cylinderGeometry args={[.21, .16, .34, 28]} /></mesh>
    <Disc at={[0, .346, 0]} radius={.19} height={.012} mat={M.soil} />
    <Rod from={[0, .34, 0]} to={[.015, small ? .75 : 1.25, .015]} radius={.018} mat={M.green} />
    {Array.from({ length: leaves }, (_, i) => {
      const a = i * 2.4, level = .4 + (i / leaves) * (small ? .35 : .8), reach = (small ? .12 : .22) + (i % 3) * .035;
      const tip: V3 = [Math.cos(a) * reach, level + .1, Math.sin(a) * reach];
      return <group key={i}>
        <Rod from={[0, Math.max(.34, level - .13), 0]} to={tip} radius={.007} mat={M.green} />
        <mesh position={tip} rotation={[Math.cos(a) * .74, -a, Math.sin(a) * .74]} scale={small ? .7 : 1 + (i % 3) * .13} geometry={leafGeometry} material={i % 3 ? M.green : M.leaf} castShadow receiveShadow />
      </group>;
    })}
  </group>;
}

function Lamp({ at, scale = 1 }: { at: V3; scale?: number }) {
  return <group position={at} scale={scale}>
    <Disc at={[0, .025, 0]} radius={.16} height={.045} mat={M.gold} />
    <Rod from={[0, .03, 0]} to={[0, .59, 0]} radius={.018} mat={M.gold} />
    <mesh position={[0, .56, 0]} castShadow><coneGeometry args={[.25, .27, 32, 1, true]} /><meshStandardMaterial color='#f6ddb0' roughness={.68} side={THREE.DoubleSide} /></mesh>
    <Ball at={[0, .47, 0]} scale={[.05, .04, .05]} mat={M.bulb} />
  </group>;
}

function Book({ at, size = [.3, .055, .22], color = M.ink, angle = 0 }: { at: V3; size?: V3; color?: THREE.Material; angle?: number }) {
  return <group position={at} rotation={[0, angle, 0]}>
    <Block at={[0, 0, 0]} size={size} mat={color} radius={.006} />
    <Block at={[.008, .002, .008]} size={[size[0] - .018, size[1] - .018, size[2] - .009]} mat={M.paper} radius={.001} />
  </group>;
}

function Mug({ at, mat = M.ivory }: { at: V3; mat?: THREE.Material }) {
  return <group position={at}>
    <mesh position={[0, .075, 0]} material={mat} castShadow><cylinderGeometry args={[.065, .06, .15, 24]} /></mesh>
    <Disc at={[0, .151, 0]} radius={.052} height={.004} mat={M.darkWood} />
    <mesh position={[.065, .085, 0]} material={mat}><torusGeometry args={[.045, .012, 8, 16]} /></mesh>
  </group>;
}

function WorkDesk({ onClick, onProjectMapClick }: { onClick: (event: ThreeEvent<MouseEvent>) => void; onProjectMapClick: (event: ThreeEvent<MouseEvent>) => void }) {
  const keyboard = useMemo(() => makeCanvas(180, 440, c => {
    c.fillStyle = '#343d3c'; c.fillRect(0, 0, 180, 440);
    c.fillStyle = '#929c99';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 12; j++) c.fillRect(8 + i * 33, 8 + j * 35, 25, 26);
    c.fillStyle = '#343d3c'; c.fillRect(7, 157, 27, 130);
    c.fillStyle = '#929c99'; c.fillRect(8, 159, 25, 124);
  }), []);
  return <group onClick={onClick}>
    <Block at={[-4.31, .94, -1.92]} size={[1.14, .1, 3.32]} mat={M.honey} radius={.035} />
    <Block at={[-4.31, .884, -1.92]} size={[1.07, .025, 3.25]} mat={M.ivory} radius={.008} />
    {[-4.77, -3.87].flatMap(x => [-3.39, -.46].map(z => <Rod key={`${x}-${z}`} from={[x, .05, z]} to={[x, .9, z]} radius={.035} mat={M.ivory} />))}
    <Block at={[-4.55, .47, -.6]} size={[.53, .77, .58]} mat={M.ivory} />
    {[.29, .53, .77].map(y => <group key={y}><Block at={[-4.272, y, -.6]} size={[.012, .19, .52]} mat={M.cream} radius={.005} /><Rod from={[-4.26, y, -.7]} to={[-4.26, y, -.5]} radius={.008} mat={M.gold} /></group>)}
    <Monitor z={-2.62} kind={0} /><Monitor z={-1.32} kind={1} onClick={onProjectMapClick} />
    {[-2.62, -1.32].map(z => <group key={z}>
      <Block at={[-4.03, .997, z]} size={[.51, .008, .94]} mat={M.deskPad} radius={.003} />
      <Block at={[-3.98, 1.012, z]} size={[.21, .025, .56]} mat={M.charcoal} radius={.012} />
      <mesh position={[-3.98, 1.026, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.195, .54]} /><meshStandardMaterial map={keyboard} roughness={.75} /></mesh>
      <Ball at={[-3.98, 1.035, z + .42]} scale={[.07, .035, .045]} mat={M.ivory} />
    </group>)}
    <Block at={[-4.22, 1.012, -.56]} size={[.49, .035, .36]} mat={M.black} radius={.019} rotation={[0, .12, 0]} />
    <Ball at={[-4.22, 1.031, -.56]} scale={[.025, .002, .025]} mat={M.chrome} />
    <group position={[-4.35, 1, -3.27]}>
      <Disc at={[0, .035, 0]} radius={.17} height={.07} mat={M.charcoal} />
      <mesh position={[0, .07, 0]}><sphereGeometry args={[.172, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color='#99a5a1' roughness={.12} metalness={.08} transparent opacity={.55} depthWrite={false} /></mesh>
      <mesh position={[0, .16, 0]} material={M.charcoal}><cylinderGeometry args={[.08, .11, .18, 24]} /></mesh>
      <Disc at={[0, .076, 0]} radius={.173} height={.015} mat={M.gold} />
    </group>
    <Lamp at={[-4.62, .99, -3.02]} scale={.85} />
    <Mug at={[-3.96, .99, -1.91]} mat={M.sage} />

    <Plant at={[-4.55, 0, -4.07]} scale={1.25} />
  </group>;
}

function MobileBoard({ task = false, onClick }: { task?: boolean; onClick: (event: ThreeEvent<MouseEvent>) => void }) {
  const mathTexture = useMemo(() => task ? null : createMathBoardTexture(), [task]);
  const width = task ? 1.14 : 1.6, height = task ? 1.45 : 1.82;
  const at: V3 = task ? [-2.2, 0, -2.45] : [MATH_BOARD.position.x, 0, MATH_BOARD.position.z];
  return <group position={at} rotation={[0, task ? -.06 : MATH_BOARD.heading, 0]} onClick={onClick}>
    <Block at={[0, 1.51, 0]} size={[width + .08, height + .08, .075]} mat={M.chrome} radius={.015} />
    <Block at={[0, 1.51, .042]} size={[width, height, .016]} mat={M.white} radius={.005} />
    {!task && mathTexture && <mesh position={[0, 1.51, .053]}><planeGeometry args={[width - .045, height - .045]} /><meshStandardMaterial map={mathTexture} roughness={.8} /></mesh>}
    {task && [
      [-.29, 1.91, M.rose, -.04], [.23, 1.82, M.paper, .06], [-.26, 1.52, M.paper, .025],
      [.25, 1.39, M.blue, -.06], [-.24, 1.12, M.blue, -.025], [.25, 1.05, M.rose, .04],
    ].map((v, i) => <group key={i} position={[v[0] as number, v[1] as number, .058]} rotation={[0, 0, v[3] as number]}>
      <Block at={[0, 0, 0]} size={[.27, .24, .012]} mat={v[2] as THREE.Material} radius={.002} />
      <Block at={[0, .105, .008]} size={[.08, .034, .004]} mat={M.cream} radius={.001} />
      {[0, 1].map(j => <Block key={j} at={[-.012, .025 - j * .045, .009]} size={[j ? .11 : .16, .007, .003]} mat={M.shadow} radius={.001} />)}
    </group>)}
    <Block at={[0, 1.51 - height / 2 - .035, .085]} size={[width + .04, .045, .15]} mat={M.charcoal} radius={.012} />
    <Rod from={[-.25, 1.51 - height / 2, .08]} to={[-.07, 1.51 - height / 2, .08]} radius={.018} mat={M.blue} />
    <Rod from={[.04, 1.51 - height / 2, .08]} to={[.22, 1.51 - height / 2, .08]} radius={.018} mat={M.black} />
    {[-1, 1].map(s => <group key={s}>
      <Rod from={[s * (width / 2 - .02), .12, 0]} to={[s * (width / 2 - .02), 1.1, 0]} radius={.023} mat={M.chrome} />
      <Rod from={[s * (width / 2 - .02), .13, -.25]} to={[s * (width / 2 - .02), .13, .25]} radius={.032} mat={M.chrome} />
      {[-.23, .23].map(z => <mesh key={z} position={[s * (width / 2 - .02), .078, z]} rotation={[0, 0, Math.PI / 2]} material={M.black} castShadow><cylinderGeometry args={[.063, .063, .05, 16]} /></mesh>)}
    </group>)}
  </group>;
}

function Sofa({ fabric, onClick, onTablet }: { fabric: THREE.Material; onClick: (event: ThreeEvent<MouseEvent>) => void; onTablet: (event: ThreeEvent<MouseEvent>) => void }) {
  return <group position={[4.1, 0, -1.02]} rotation={[0, -Math.PI / 2, 0]} onClick={onClick}>
    {[-1.28, 1.28].flatMap(x => [-.43, .43].map(z => <Rod key={`${x}-${z}`} from={[x, .04, z]} to={[x, .28, z]} radius={.045} mat={M.darkWood} />))}
    <Block at={[0, .36, 0]} size={[2.9, .35, 1.24]} mat={fabric} radius={.13} />
    <Block at={[0, .82, -.49]} size={[2.86, .76, .27]} mat={fabric} radius={.13} />
    {[-1.35, 1.35].map(x => <Block key={x} at={[x, .69, .01]} size={[.28, .72, 1.22]} mat={fabric} radius={.13} />)}
    {[-.84, 0, .84].map(x => <group key={x}>
      <Block at={[x, .61, .05]} size={[.81, .22, .91]} mat={fabric} radius={.105} />
      <Block at={[x, .99, -.31]} size={[.81, .65, .21]} mat={fabric} radius={.1} rotation={[.08, 0, 0]} />
    </group>)}
    <Block at={[-1.08, 1.01, -.19]} size={[.43, .55, .22]} mat={M.sage} radius={.12} rotation={[.17, 0, -.21]} />
    <Block at={[1.08, .99, -.19]} size={[.43, .55, .22]} mat={M.rose} radius={.12} rotation={[.2, 0, .22]} />
    <DrapedThrow />
    <group position={[-.07, .745, .17]} rotation={[-Math.PI / 2, 0, -.15]} onClick={onTablet}>
      <Block at={[0, 0, 0]} size={[.36, .47, .022]} mat={M.charcoal} radius={.018} />
      <Block at={[0, 0, .014]} size={[.325, .425, .003]} mat={M.ink} radius={.009} />
      <Block at={[.02, .02, .017]} size={[.19, .13, .002]} mat={M.sage} radius={.007} />
    </group>
  </group>;
}

function LuckyCat() {
  return <group position={[0, .71, 0]} scale={.58}>
    <Ball at={[0, .2, 0]} scale={[.23, .28, .2]} mat={M.white} />
    <Ball at={[0, .5, -.025]} scale={[.235, .21, .2]} mat={M.white} />
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * .15, .69, -.02]} rotation={[0, 0, -s * .14]} material={M.white} castShadow><coneGeometry args={[.09, .18, 3]} /></mesh>
      <Ball at={[s * .088, .52, -.203]} scale={[.016, .023, .008]} mat={M.black} />
      <Ball at={[s * .11, .07, -.15]} scale={[.1, .07, .09]} mat={M.white} />
    </group>)}
    <Ball at={[0, .458, -.22]} scale={[.025, .015, .012]} mat={M.rose} />
    <mesh position={[0, .36, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.burgundy}><torusGeometry args={[.16, .021, 8, 20]} /></mesh>
    <Ball at={[0, .33, -.18]} scale={[.04, .04, .025]} mat={M.gold} />
    <Ball at={[.245, .47, 0]} scale={[.075, .17, .075]} mat={M.white} />
    <Ball at={[-.12, .2, -.17]} scale={[.085, .115, .025]} mat={M.gold} />
    <Ball at={[.1, .18, .18]} scale={[.07, .095, .04]} mat={M.gold} />
  </group>;
}

function CoffeeCorner({ rugMat, onBooksClick }: { rugMat: THREE.Material; onBooksClick: (event: ThreeEvent<MouseEvent>) => void }) {
  const bookCover = useMemo(() => makeCanvas(512, 384, c => {
    c.fillStyle = '#925d5b'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = '#dec6a2'; c.lineWidth = 4; c.strokeRect(25, 25, 462, 334);
    c.fillStyle = '#f3e8d4'; c.textAlign = 'center';
    c.font = 'italic 72px Georgia, serif'; c.fillText('mimi', 256, 153);
    c.font = '32px Georgia, serif'; c.fillText('W O R D S', 256, 225);
    c.strokeStyle = '#e2cda7'; c.lineWidth = 3; c.beginPath(); c.moveTo(210, 282); c.lineTo(302, 282); c.stroke();
  }), []);
  return <group>
    <Block at={COFFEE_RUG.position} size={COFFEE_RUG.size} mat={rugMat} radius={COFFEE_RUG.radius} />
    {Array.from({ length: 40 }, (_, i) => <group key={i}>
      <Rod from={[-1.24 + i * .1, .021, -2.07]} to={[-1.24 + i * .1, .02, -2.16]} radius={.008} mat={M.cream} />
      <Rod from={[-1.24 + i * .1, .021, .99]} to={[-1.24 + i * .1, .02, 1.08]} radius={.008} mat={M.cream} />
    </group>)}
    <group position={[.1, 0, -.65]}>
      <Disc at={[0, .49, 0]} radius={.62} height={.065} mat={M.honey} />
      {[0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3; return <Rod key={i} from={[Math.cos(a) * .43, .05, Math.sin(a) * .43]} to={[Math.cos(a) * .33, .46, Math.sin(a) * .33]} radius={.04} mat={M.darkWood} />; })}
      <group onClick={onBooksClick}>
        <Book at={[.15, .56, .09]} /><Book at={[.15, .615, .09]} color={M.burgundy} angle={.12} />
        <group position={[.15, .615, .09]} rotation={[0, .12, 0]}>
          <mesh position={[0, .028, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.29, .21]} /><meshStandardMaterial map={bookCover} roughness={.88} /></mesh>
        </group>
      </group>
      <Mug at={[-.3, .526, .13]} />
      <group position={[-.12, .53, -.22]}>
        <Ball at={[0, .12, 0]} scale={[.085, .13, .085]} mat={M.pottery} />
        {[-1, 0, 1].map((v, i) => <group key={v}><Rod from={[0, .18, 0]} to={[v * .065, .37 + i * .015, .02]} radius={.006} mat={M.green} /><Ball at={[v * .065, .37 + i * .015, .02]} scale={[.06, .045, .055]} mat={M.paper} /></group>)}
      </group>
    </group>
    <group position={[2.8, 0, -3.65]}>
      <Disc at={[0, .68, 0]} radius={.43} height={.055} mat={M.ivory} />
      {[0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3; return <Rod key={i} from={[Math.cos(a) * .31, .04, Math.sin(a) * .31]} to={[Math.cos(a) * .25, .66, Math.sin(a) * .25]} radius={.026} mat={M.honey} />; })}
      <LuckyCat />
      <Plant at={[-.26, .708, .08]} scale={.3} small />
    </group>
  </group>;
}

function Tarot({ onClick }: { onClick: (event: ThreeEvent<MouseEvent>) => void }) {
  const texture = useMemo(() => makeCanvas(180, 300, c => {
    c.fillStyle = '#293746'; c.fillRect(0, 0, 180, 300);
    c.strokeStyle = '#d4b66f'; c.lineWidth = 3; c.strokeRect(10, 10, 160, 280); c.lineWidth = 1; c.strokeRect(17, 17, 146, 266);
    c.beginPath(); c.arc(90, 145, 46, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(105, 130, 36, .5, 4.6); c.stroke();
    for (let i = 0; i < 8; i++) { const x = 30 + (i * 37 % 120), y = 35 + (i * 61 % 225); c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); }
    c.beginPath(); c.moveTo(50, 240); c.lineTo(90, 196); c.lineTo(130, 240); c.closePath(); c.stroke();
  }), []);
  return <group position={[1.6, .055, .48]} onClick={onClick}>
    {[[-.28, -.08, -.25], [.06, -.12, .18], [.31, .14, -.3], [-.1, .28, .38]].map((v, i) => <group key={i} position={[v[0], i * .003, v[1]]} rotation={[0, v[2], 0]}>
      <Block at={[0, 0, 0]} size={[.29, .012, .44]} mat={M.gold} radius={.009} />
      <mesh position={[0, .007, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.275, .423]} /><meshStandardMaterial map={texture} roughness={.9} /></mesh>
    </group>)}
  </group>;
}

function Bedroom({ fabric }: { fabric: THREE.Material }) {
  return <group>
    <Block at={[3, .28, 3.4]} size={[2.26, .42, 2.56]} mat={M.darkWood} radius={.07} />
    <Block at={[3, .55, 3.4]} size={[2.22, .34, 2.56]} mat={fabric} radius={.13} />
    <Block at={[3, .75, 2.12]} size={[2.34, 1.15, .16]} mat={M.cream} radius={.065} />
    {[-.5, .5].map(x => <Block key={x} at={[3 + x, .79, 2.55]} size={[.88, .24, .55]} mat={fabric} radius={.11} rotation={[.08, 0, x * .06]} />)}
    <Block at={[3, .77, 3.69]} size={[2.23, .16, 1.63]} mat={fabric} radius={.07} />
    {Array.from({ length: 8 }, (_, i) => <Block key={i} at={[2.02 + i * .28, .85, 3.7]} size={[.009, .004, 1.38]} mat={M.cream} radius={.001} />)}
    <Block at={[3.03, .87, 4.16]} size={[2.25, .1, .69]} mat={M.sage} radius={.035} rotation={[0, .025, 0]} />
    <Block at={[3.03, .59, 4.61]} size={[2.25, .5, .04]} mat={M.sage} radius={.018} />
    <Block at={[3.5, .97, 2.77]} size={[.55, .5, .15]} mat={M.sage} radius={.09} rotation={[-.45, .1, -.06]} />
    <group position={[2.8, 1.04, 2.68]} rotation={[-.48, 0, 0]}>
      {[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return <Ball key={i} at={[Math.cos(a) * .16, Math.sin(a) * .16, 0]} scale={[.095, .095, .05]} mat={M.white} />; })}
      <Ball at={[0, 0, .04]} scale={[.095, .095, .05]} mat={M.gold} />
    </group>
    <Block at={[4.54, .4, 2.55]} size={[.55, .75, .64]} mat={M.honey} radius={.03} />
    <Block at={[4.54, .62, 2.88]} size={[.46, .22, .017]} mat={M.oak} radius={.003} />
    <Rod from={[4.46, .62, 2.899]} to={[4.62, .62, 2.899]} radius={.01} mat={M.gold} />
    <Lamp at={[4.54, .79, 2.54]} scale={.7} />
    <Block at={[3.1, .025, 3.65]} size={[3.2, .025, 2.7]} mat={M.cream} radius={.01} />
  </group>;
}

function Bathroom() {
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#bcd2d2', transparent: true, opacity: .17, roughness: .08, metalness: .05, side: THREE.DoubleSide, depthWrite: false }), []);
  return <group>
    <Block at={[.04, .08, 2.3]} size={[1.03, .13, 1.35]} mat={M.white} radius={.025} />
    <Block at={[-.48, .96, 2.3]} size={[.018, 1.75, 1.35]} mat={glass} radius={.001} />
    <Block at={[.04, .96, 2.98]} size={[1.04, 1.75, .018]} mat={glass} radius={.001} />
    <Rod from={[-.5, .13, 2.98]} to={[-.5, 1.86, 2.98]} radius={.015} mat={M.chrome} />
    <Rod from={[-.5, 1.86, 2.98]} to={[.57, 1.86, 2.98]} radius={.015} mat={M.chrome} />
    <Rod from={[-.5, 1.86, 1.65]} to={[-.5, 1.86, 2.98]} radius={.015} mat={M.chrome} />
    <Rod from={[.3, .35, 1.73]} to={[.3, 1.73, 1.73]} radius={.018} mat={M.chrome} />
    <Rod from={[.3, 1.72, 1.73]} to={[.3, 1.72, 2.05]} radius={.018} mat={M.chrome} />
    <Disc at={[.3, 1.72, 2.06]} radius={.13} height={.025} mat={M.chrome} />
    <Rod from={[.29, .85, 3.01]} to={[.29, 1.13, 3.01]} radius={.017} mat={M.chrome} />
    <group position={[-.96, 0, 3.68]}>
      <Ball at={[0, .25, 0]} scale={[.24, .27, .3]} mat={M.white} />
      <Ball at={[0, .44, -.04]} scale={[.28, .14, .34]} mat={M.white} />
      <Block at={[0, .48, -.035]} size={[.47, .07, .57]} mat={M.ivory} radius={.034} />
      <Block at={[0, .69, .24]} size={[.48, .65, .18]} mat={M.white} radius={.045} />
      <Disc at={[0, 1.025, .24]} radius={.028} height={.008} mat={M.chrome} />
    </group>
    <Block at={[-1.3, .43, 2.05]} size={[.68, .78, .62]} mat={M.oak} radius={.025} />
    <Block at={[-1.3, .87, 2.05]} size={[.73, .13, .66]} mat={M.white} radius={.035} />
    <Ball at={[-1.3, .932, 2.06]} scale={[.24, .015, .19]} mat={M.shadow} />
    <Rod from={[-1.3, .94, 1.8]} to={[-1.3, 1.12, 1.8]} radius={.022} mat={M.chrome} />
    <Rod from={[-1.3, 1.12, 1.8]} to={[-1.3, 1.12, 1.95]} radius={.022} mat={M.chrome} />
    <Block at={[-1.3, 1.48, 1.675]} size={[.65, .73, .035]} mat={M.gold} radius={.015} />
    <Block at={[-1.3, 1.48, 1.698]} size={[.6, .68, .015]} mat={M.chrome} radius={.007} />
    <Block at={[-1.62, .98, 2.17]} size={[.1, .14, .1]} mat={M.sage} radius={.025} />
    <Block at={[-.75, .025, 4.35]} size={[.95, .03, .42]} mat={M.cream} radius={.01} />
  </group>;
}

function EntryAndShelves() {
  return <group>
    <Block at={[-4.65, .55, 3.3]} size={[.55, 1.08, 1.34]} mat={M.ivory} radius={.025} />
    <Block at={[-4.65, 1.11, 3.3]} size={[.58, .05, 1.4]} mat={M.honey} radius={.015} />
    {[-.38, .38].map(z => <Block key={z} at={[-4.365, .61, 3.3 + z]} size={[.017, .75, .53]} mat={M.cream} radius={.008} />)}
    <Plant at={[-4.65, 1.15, 3.1]} scale={.42} small />
    <Disc at={[-4.6, 1.16, 3.6]} radius={.13} height={.025} mat={M.pottery} />
    <Block at={[-3.65, .019, 4.03]} size={[1.62, .03, .62]} mat={M.shadow} radius={.012} />
    <group position={[4.52, 0, -3.05]}>
      {[-.28, .28].map(x => <Block key={x} at={[x, .94, 0]} size={[.05, 1.88, .58]} mat={M.ivory} radius={.008} />)}
      {[.16, .68, 1.2, 1.85].map(y => <Block key={y} at={[0, y, 0]} size={[.6, .05, .58]} mat={M.ivory} radius={.008} />)}
      {[0, 1, 2, 3].map(i => <Block key={i} at={[-.18 + i * .105, .42, .04]} size={[.078, .43 - i * .035, .33]} mat={[M.sage, M.rose, M.paper, M.ink][i]} radius={.006} rotation={[0, 0, i === 3 ? -.15 : 0]} />)}
      <Book at={[0, .73, .05]} size={[.35, .065, .31]} color={M.rose} />
      <Book at={[0, .8, .05]} size={[.37, .065, .31]} color={M.paper} angle={.1} />
      <Ball at={[0, 1.41, 0]} scale={[.14, .19, .14]} mat={M.pottery} />
      <Plant at={[0, 1.89, 0]} scale={.44} small />
    </group>
    <Plant at={[4.55, 0, .89]} scale={.67} />
    <Plant at={[3.9, 0, -3.92]} scale={.86} />
  </group>;
}

/** Hand-built low-poly furniture, independent from movement and application state. */
export function Furniture({ onZoneClick, onInteractionClick }: FurnitureProps) {
  const fabric = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eee7d8', map: fabricTexture(), roughness: .93 }), []);
  const rugMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', map: rugTexture(), roughness: 1 }), []);
  const click = (id: ZoneId) => (event: ThreeEvent<MouseEvent>) => { if (event.delta > 4) return; event.stopPropagation(); onZoneClick(id); };
  return <group name='home-furniture'>
    <WorkDesk onClick={click('trading')} onProjectMapClick={click('projectmap')} />
    <MobileBoard task onClick={click('tasks')} />
    <Sofa fabric={fabric} onTablet={click('math')} onClick={e=>{if(e.delta>4)return;e.stopPropagation();onInteractionClick(e.point.z < -1.02 ? 'sofa-window' : 'sofa-room');}} />
    <MobileBoard onClick={click('math')} />
    <CoffeeCorner rugMat={rugMat} onBooksClick={click('words')} />
    <Tarot onClick={click('tarot')} />
    <Bedroom fabric={fabric} />
    <Bathroom />
    <EntryAndShelves />
  </group>;
}

/** Separate from the static desk so avatar ticks do not rebuild its detailed meshes. */
function ActivityChair({snapshot,id,index,onApproach}: {snapshot: RoomSnapshot;id: 'desk-trading'|'desk-projectmap';index:number;onApproach:(id:InteractionId)=>void}) {
  const click=useCallback((e:ThreeEvent<MouseEvent>)=>{if(e.delta>4)return;e.stopPropagation();onApproach(id);},[id,onApproach]);
  const activity=Object.values(snapshot.characters).find(c=>c.activity?.target.id===id)?.activity;
  const progress=activity?.progress??0,t=progress*progress*(3-2*progress);
  return <Chair z={index ? -.99-.33*t : -2.62} x={-3.12-.5*t} blush={!!index} onClick={click}/>;
}
export function ActivityChairs({snapshot,onApproach}: {snapshot: RoomSnapshot; onApproach: (id: InteractionId)=>void}) {
  return <group>{(['desk-trading','desk-projectmap'] as const).map((id,index)=><ActivityChair key={id} id={id} index={index} snapshot={snapshot} onApproach={onApproach}/>)}</group>;
}
