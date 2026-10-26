import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Architecture } from './source/scene/Architecture';
import { Furniture, ActivityChairs } from './source/scene/Furniture';
import { RoomLighting } from './source/scene/RoomLighting';
import { FIXED_DAYLIGHT, resolveDaylight } from './source/core/daylight';
import type { RoomSnapshot } from './source/core/types';
import sourceManifest from './source-manifest.json';
import './style.css';

type Theme = 'day' | 'night';
const noop = () => {};
const idle = {characters:{}} as RoomSnapshot;
const night = resolveDaylight('live', new Date(2026, 0, 1, 0, 0, 0));
const palettes = {day:FIXED_DAYLIGHT, night};
const groupRef: {current: THREE.Group | null} = {current:null};

function Scene({theme, onReady}: {theme: Theme; onReady: () => void}) {
  const frames = useRef(0), camera = useThree(state => state.camera);
  useEffect(() => { frames.current = 0; camera.lookAt(0,.3,0); }, [theme, camera]);
  useFrame(() => { if (++frames.current === 8) onReady(); });
  return <>
    <RoomLighting palette={palettes[theme]} reducedMotion />
    <group ref={group => {groupRef.current=group;}} name="cottage-static-original">
      <Architecture onFloorClick={noop} palette={palettes[theme]} reducedMotion />
      <Furniture onZoneClick={noop} onInteractionClick={noop}/>
      <ActivityChairs snapshot={idle} onApproach={noop}/>
    </group>
    <OrbitControls target={[0,.3,0]} minDistance={2} maxDistance={30} maxPolarAngle={Math.PI*.495}/>
  </>;
}

function inventory(root: THREE.Object3D) {
  root.updateWorldMatrix(true,true);
  let meshes=0, vertices=0, triangles=0;
  const materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    meshes++; vertices+=node.geometry.attributes.position?.count || 0;
    triangles+=(node.geometry.index?.count || node.geometry.attributes.position?.count || 0)/3;
    for (const mat of Array.isArray(node.material)?node.material:[node.material]) {
      materials.add(mat);
      Object.values(mat).forEach(value => {if(value instanceof THREE.Texture) textures.add(value);});
    }
  });
  const bounds=new THREE.Box3().setFromObject(root);
  return {meshes,vertices,triangles,materials:materials.size,textures:textures.size,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}

function preserveRuntimeProperties(root: THREE.Object3D) {
  let meshIndex=0, matIndex=0;
  const seen=new Set<THREE.Material>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.name ||= `cottage-mesh-${String(++meshIndex).padStart(4,'0')}`;
    node.userData.cottageRuntime={castShadow:node.castShadow,receiveShadow:node.receiveShadow,renderOrder:node.renderOrder};
    for(const mat of Array.isArray(node.material)?node.material:[node.material]) {
      if(seen.has(mat))continue;seen.add(mat);
      mat.name ||= `cottage-material-${String(++matIndex).padStart(3,'0')}`;
      mat.userData.cottageRuntime={toneMapped:mat.toneMapped,depthWrite:mat.depthWrite,polygonOffset:mat.polygonOffset,polygonOffsetFactor:mat.polygonOffsetFactor,polygonOffsetUnits:mat.polygonOffsetUnits};
    }
  });
}

async function exportRoom(theme: Theme) {
  if(!groupRef.current)throw new Error('Scene is not ready.');
  preserveRuntimeProperties(groupRef.current);
  const before=inventory(groupRef.current);
  const exporter=new GLTFExporter();
  const bytes=await exporter.parseAsync(groupRef.current,{binary:true,onlyVisible:false,trs:true}) as ArrayBuffer;
  const decoded=await new GLTFLoader().parseAsync(bytes,'');
  const after=inventory(decoded.scene);
  const geometryMatches=before.meshes===after.meshes && before.vertices===after.vertices && before.triangles===after.triangles;
  const boundsDelta=Math.max(...before.bounds.min.map((v,i)=>Math.abs(v-after.bounds.min[i])),...before.bounds.max.map((v,i)=>Math.abs(v-after.bounds.max[i])));
  if(!geometryMatches || boundsDelta>1e-4)throw new Error(`GLB round-trip changed geometry: ${JSON.stringify({before,after,boundsDelta})}`);
  const array=new Uint8Array(bytes); let binary='';
  for(let offset=0;offset<array.length;offset+=32768)binary+=String.fromCharCode(...array.subarray(offset,offset+32768));
  const response=await fetch(`/__save/${theme}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({glb:btoa(binary),report:{sourceCommit:sourceManifest.sourceCommit,palette:palettes[theme],original:before,roundTrip:after,geometryMatches,boundsDelta,scope:'Exact static Architecture, Furniture, idle ActivityChairs. Procedural textures embedded. Avatars, navigation, application links and photos excluded.'}})});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

function App() {
  const [theme,setTheme]=useState<Theme>('day'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('Waiting for original components to settle…');
  async function save() {setBusy(true);setStatus(`Exporting ${theme} geometry and textures…`);try {const report=await exportRoom(theme);setStatus(`Saved ${report.filename}\n${report.bytes} bytes · SHA-256 ${report.sha256}\n${report.original.meshes} meshes · ${report.original.triangles} triangles\nRound-trip verified. Evidence saved to docs/design/stage2.4.12.`);}catch(error){setStatus(`ERROR: ${String(error)}`);}finally{setBusy(false);}}
  return <><header><strong>Original cottage · static asset export</strong><span>Source {sourceManifest.sourceCommit.slice(0,8)}</span><button disabled={busy} onClick={()=>{setReady(false);setTheme(theme==='day'?'night':'day');setStatus('Settling palette…');}}>{theme==='day'?'Switch to night':'Switch to day'}</button><button disabled={!ready||busy} onClick={save}>Export {theme} GLB</button></header><main><Canvas shadows camera={{position:[9,14,17],fov:38,near:.05,far:100}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}><Scene theme={theme} onReady={()=>{setReady(true);setStatus(current=>current.startsWith('Waiting')||current.startsWith('Settling')?`${theme} scene ready. Drag to inspect original room; export writes a local GLB only.`:current);}}/></Canvas></main><pre role="status">{status}</pre></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
