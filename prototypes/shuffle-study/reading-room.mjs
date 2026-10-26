import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLOTH_WIDTH, CLOTH_LENGTH } from './reading-layout.mjs';

// Exact static cottage export; source and rendering boundary are recorded in
// docs/design/stage2.4.12/cottage-source-and-export.md. No cottage runtime code
// (React, navigation, app links or avatar state) is imported by this module.
export const COTTAGE_SOURCE_REVISION = 'e71fe3fafe7aa4ab4074a6e32669e3b76779101a';
export const COTTAGE_METRES_PER_UNIT = .14;
export const COTTAGE_ANCHOR = Object.freeze({ x: 1.1, y: .9, z: 0 });
export const READING_TABLE_CENTER_Z = -.6;
export const ROOM_FLOOR_Y = (.002 - COTTAGE_ANCHOR.y) / COTTAGE_METRES_PER_UNIT;
export const ROOM_PALETTES = Object.freeze({
  light: Object.freeze({ background:'#e8dac5', ambientColor:'#fff3df', ambientIntensity:.22,
    skyColor:'#f0f6ff', groundColor:'#ac8765', hemisphereIntensity:.65,
    keyColor:'#ffe0a5', keyIntensity:2.6, fillColor:'#e3ecff', fillIntensity:.5 }),
  dark: Object.freeze({ background:'#586475', ambientColor:'#ffe5c8', ambientIntensity:.3,
    skyColor:'#9aaed6', groundColor:'#95745d', hemisphereIntensity:.54,
    keyColor:'#a5bde8', keyIntensity:.38, fillColor:'#ffe1b3', fillIntensity:.95 }),
});

export function cottageToReadingPosition(x, y, z) {
  return [(x-COTTAGE_ANCHOR.x)/COTTAGE_METRES_PER_UNIT,
    (y-COTTAGE_ANCHOR.y)/COTTAGE_METRES_PER_UNIT,
    (z-COTTAGE_ANCHOR.z)/COTTAGE_METRES_PER_UNIT+READING_TABLE_CENTER_Z];
}

function restoreStaticRuntime(root) {
  const seen = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    const flags = node.userData.cottageRuntime;
    if (flags) {
      node.castShadow = flags.castShadow === true;
      node.receiveShadow = flags.receiveShadow === true;
      if (Number.isFinite(flags.renderOrder)) node.renderOrder = flags.renderOrder;
    }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      const settings = material.userData.cottageRuntime;
      if (settings) {
        for (const key of ['toneMapped','depthWrite','polygonOffset']) if (typeof settings[key] === 'boolean') material[key] = settings[key];
        for (const key of ['polygonOffsetFactor','polygonOffsetUnits']) if (Number.isFinite(settings[key])) material[key] = settings[key];
        material.needsUpdate = true;
      }
    }
  });
}

function staticInventory(root) {
  let meshes=0, vertices=0, triangles=0;
  root.updateWorldMatrix(true,true);
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++; vertices+=node.geometry.attributes.position?.count || 0;
    triangles+=(node.geometry.index?.count || node.geometry.attributes.position?.count || 0)/3;
  });
  const box=new THREE.Box3().setFromObject(root);
  return {meshes,vertices,triangles,bounds:{min:box.min.toArray(),max:box.max.toArray()}};
}

function disposeRoots(roots) {
  const geometries=new Set(), materials=new Set(), textures=new Set(), bitmaps=new Set();
  for (const root of roots) root.traverse(node => {
    if(node.geometry)geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      materials.add(material);
      Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});
    }
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  for(const texture of textures){
    const image=texture.source?.data;
    if(image && typeof image.close==='function')bitmaps.add(image);
    texture.dispose();
  }
  for(const bitmap of bitmaps)bitmap.close();
  for(const root of roots){root.removeFromParent();root.clear();}
}

function createOriginalEnvironment(renderer) {
  // The original two Lightformers, including their target orientation and
  // radiance, reconstructed as planes for a one-time PMREM capture.
  const scene=new THREE.Scene(), geometry=new THREE.PlaneGeometry(1,1);
  const topMaterial=new THREE.MeshBasicMaterial({color:'#fff4e4',side:THREE.DoubleSide,toneMapped:false});
  const windowMaterial=new THREE.MeshBasicMaterial({color:'#ffe6bf',side:THREE.DoubleSide,toneMapped:false});
  topMaterial.color.multiplyScalar(.65); windowMaterial.color.multiplyScalar(.9);
  const top=new THREE.Mesh(geometry,topMaterial); top.position.set(0,4,0); top.rotation.x=Math.PI/2;top.scale.set(12,12,1);
  const window=new THREE.Mesh(geometry,windowMaterial); window.position.set(0,2,-5);window.scale.set(10,4,1);
  scene.add(top,window);
  const generator=new THREE.PMREMGenerator(renderer);
  try {
    const result=generator.fromScene(scene,0,.1,100,{size:128});
    result.texture.name='original-cottage-warm-environment';
    return result;
  } finally {generator.dispose();geometry.dispose();topMaterial.dispose();windowMaterial.dispose();scene.clear();}
}

// A separate, restrained lighting cue for the newly introduced floating table.
// Original cottage geometry/materials remain untouched. The soft footprint is
// displaced away from the back-left window, onto the existing rug's upper face.
function createTableShadow() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('The table shadow texture could not be created.');
  context.filter='blur(16px)';context.fillStyle='#000';
  context.beginPath();context.roundRect(40,36,432,312,24);context.fill();
  const texture=new THREE.CanvasTexture(canvas);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.12,depthWrite:false,toneMapped:false});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(CLOTH_WIDTH+2,CLOTH_LENGTH+2),material);
  shadow.name='new-glass-soft-floor-shadow';shadow.rotation.x=-Math.PI/2;
  shadow.position.set(.55,(.045-COTTAGE_ANCHOR.y)/COTTAGE_METRES_PER_UNIT,READING_TABLE_CENTER_Z+.65);
  return {shadow,dispose(){shadow.geometry.dispose();material.dispose();texture.dispose();}};
}

/** Load both static themes once. A failed asset rejects rather than silently
 * substituting an approximate room. The caller owns the visible failure UI. */
export async function createReadingRoom(renderer) {
  if (!renderer?.isWebGLRenderer) throw new Error('The cottage needs the active WebGL renderer.');
  const start=performance.now(), loader=new GLTFLoader();
  const urls=[new URL('./assets/cottage-day.glb',import.meta.url).href,new URL('./assets/cottage-night.glb',import.meta.url).href];
  const results=await Promise.allSettled(urls.map(url=>loader.loadAsync(url)));
  const loaded=results.filter(result=>result.status==='fulfilled').map(result=>result.value.scene);
  const failure=results.find(result=>result.status==='rejected');
  if(failure){disposeRoots(loaded);throw new Error('The original cottage room could not be loaded.',{cause:failure.reason});}
  const [day,night]=loaded;
  let environment;
  try {
    const inventories={light:staticInventory(day),dark:staticInventory(night)};
    for(const [theme,value] of Object.entries(inventories)){
      if(value.meshes!==645 || value.vertices!==383435 || value.triangles!==158560)throw new Error(`The ${theme} cottage asset does not match the verified static model.`);
    }
    for(const root of loaded)restoreStaticRuntime(root);
    environment=createOriginalEnvironment(renderer);
    const group=new THREE.Group();group.name='original-cottage-reading-environment';
    const foreground=new THREE.Group();foreground.name='cottage-reading-props';
    const physical=new THREE.Group();physical.name='cottage-uniform-metre-transform';
    physical.scale.setScalar(1/COTTAGE_METRES_PER_UNIT);
    physical.position.set(...cottageToReadingPosition(0,0,0));
    day.name='original-cottage-day';night.name='original-cottage-night';
    physical.add(day,night);group.add(physical);
    const tableShadow=createTableShadow();group.add(tableShadow.shadow);
    const ambient=new THREE.AmbientLight();
    const hemisphere=new THREE.HemisphereLight();
    const key=new THREE.DirectionalLight();key.position.set(-3,8,-5);
    const fill=new THREE.DirectionalLight();fill.position.set(6,6,6);
    key.target.position.set(0,0,0);fill.target.position.set(0,0,0);
    key.castShadow=true;key.shadow.mapSize.set(2048,2048);
    const scale=1/COTTAGE_METRES_PER_UNIT;
    Object.assign(key.shadow.camera,{left:-8*scale,right:8*scale,top:8*scale,bottom:-8*scale,near:.5*scale,far:30*scale});
    key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.025*scale;key.shadow.bias=-.0002;
    physical.add(ambient,key,fill,key.target,fill.target);
    // Hemisphere direction is world-up; translating it with the cottage would
    // incorrectly turn its sky direction toward the room's shifted origin.
    group.add(hemisphere);
    const background=new THREE.Color();
    group.userData={floorY:ROOM_FLOOR_Y,sourceRevision:COTTAGE_SOURCE_REVISION,decorativeOnly:true,
      environmentTexture:environment.texture,backgroundColor:background,environmentIntensity:1,
      inventories,loadMilliseconds:performance.now()-start,metresPerGameplayUnit:COTTAGE_METRES_PER_UNIT};
    let disposed=false;
    function applyAppearance(theme){
      if(disposed)return;
      const dark=theme==='dark',palette=ROOM_PALETTES[dark?'dark':'light'];
      day.visible=!dark;night.visible=dark;background.set(palette.background);
      ambient.color.set(palette.ambientColor);ambient.intensity=palette.ambientIntensity;
      hemisphere.color.set(palette.skyColor);hemisphere.groundColor.set(palette.groundColor);hemisphere.intensity=palette.hemisphereIntensity;
      key.color.set(palette.keyColor);key.intensity=palette.keyIntensity;
      fill.color.set(palette.fillColor);fill.intensity=palette.fillIntensity;
      group.userData.appearance=dark?'dark':'light';
      tableShadow.shadow.material.opacity=dark?.17:.12;
      key.shadow.needsUpdate=true;
    }
    function dispose(){
      if(disposed)return;disposed=true;
      disposeRoots(loaded);key.shadow.dispose();environment.dispose();tableShadow.dispose();
      group.removeFromParent();foreground.removeFromParent();physical.clear();group.clear();foreground.clear();
    }
    applyAppearance('light');
    return {group,foreground,applyAppearance,dispose};
  }catch(error){disposeRoots(loaded);environment?.dispose();throw error;}
}
