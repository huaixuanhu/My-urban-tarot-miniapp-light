import * as THREE from 'three';

// Adapted from the user's cottage Architecture.tsx / Furniture.tsx, revision
// e71fe3fa. This is a curated static environment, not the cottage runtime.
// Source and adaptation boundaries: docs/design/stage2.4.10/cottage-source.md.
export const ROOM_FLOOR_Y = -2.8;
const WINDOW_Z = -15.1;

function seeded(seed) {
  let value = seed;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function paintTexture(width, height, paint) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The room texture could not be created.');
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function oakTexture() {
  // The cottage's seeded staggered oak algorithm, adapted to quieter pale wood.
  const random = seeded(1605);
  return paintTexture(1024, 1024, c => {
    c.fillStyle = '#d6d2c7'; c.fillRect(0, 0, 1024, 1024);
    const plank = 1024 / 14;
    for (let column = 0; column < 14; column++) {
      const x = column * plank;
      let y = -random() * 290;
      while (y < 1024) {
        const length = 260 + random() * 230, tone = random();
        c.fillStyle = `rgb(${194 + tone * 28},${190 + tone * 28},${179 + tone * 30})`;
        c.fillRect(x + .8, y + .8, plank - 1.1, length - 1.3);
        for (let grain = 0; grain < 32; grain++) {
          const gx = x + 3 + random() * (plank - 6);
          c.strokeStyle = `rgba(107,88,62,${.025 + random() * .045})`; c.lineWidth = .6 + random();
          c.beginPath(); c.moveTo(gx, y + 2);
          c.bezierCurveTo(gx + random() * 6, y + length * .33, gx - random() * 6, y + length * .68, gx + random() * 2, y + length - 3); c.stroke();
        }
        c.strokeStyle = 'rgba(255,248,226,.18)'; c.lineWidth = .8;
        c.strokeRect(x + 1.4, y + 1.4, plank - 2.5, length - 2.5);
        y += length;
      }
    }
  });
}

function skylineTexture(dark) {
  // The same deterministic skyline motif as the cottage, deliberately softened.
  const random = seeded(4507);
  return paintTexture(768, 384, c => {
    const sky = c.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, dark ? '#23374a' : '#e7e2dc');
    sky.addColorStop(.62, dark ? '#536478' : '#f0e5cf');
    sky.addColorStop(1, dark ? '#76727a' : '#c5c8bc');
    c.fillStyle = sky; c.fillRect(0, 0, 768, 384);
    c.filter = 'blur(7px)';
    for (let layer = 0; layer < 3; layer++) {
      let x = -20;
      while (x < 768) {
        const width = 18 + random() * 53, height = 28 + random() * 125;
        const base = 320 + layer * 20;
        c.fillStyle = dark ? ['#687583', '#546271', '#394c59'][layer] : ['#b6c1bc', '#a8b5ae', '#95a69c'][layer];
        c.globalAlpha = .36; c.fillRect(x, base - height, width, height + 65);
        if (dark) {
          c.fillStyle = '#ead6ae'; c.globalAlpha = .34;
          for (let y = base - height + 9; y < base; y += 13) for (let wx = x + 6; wx < x + width - 4; wx += 10) {
            if (random() > .72) c.fillRect(wx, y, 3, 4);
          }
        }
        x += width + 7 + random() * 14;
      }
    }
    c.globalAlpha = 1; c.filter = 'none';
    const glow = c.createRadialGradient(550, 95, 6, 550, 95, 320);
    glow.addColorStop(0, dark ? '#c4cde535' : '#fff9e6c0'); glow.addColorStop(1, '#ffffff00');
    c.fillStyle = glow; c.fillRect(0, 0, 768, 384);
  });
}

function mineralTexture() {
  const random = seeded(716);
  return paintTexture(512, 512, c => {
    c.fillStyle = '#d2c9b9'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9500; i++) {
      const tone = random() > .48 ? 255 : 78;
      c.fillStyle = `rgba(${tone},${tone},${tone},${.035 + random() * .11})`;
      c.fillRect(random() * 512, random() * 512, 1 + random() * 3, .7 + random() * 1.4);
    }
  });
}

function windowLightTexture() {
  // Static, feathered mullion and leaf silhouettes; no drifting particle field.
  const random = seeded(91);
  return paintTexture(1024, 1024, c => {
    c.clearRect(0, 0, 1024, 1024);
    const pool = c.createRadialGradient(350, 420, 60, 430, 520, 570);
    pool.addColorStop(0, '#fff7df7a'); pool.addColorStop(.58, '#fff8e53c'); pool.addColorStop(1, '#fff9ea00');
    c.fillStyle = pool; c.fillRect(0, 0, 1024, 1024);
    c.filter = 'blur(10px)'; c.fillStyle = '#665e4b28';
    c.save(); c.translate(240, 20); c.rotate(-.27);
    for (let i = 0; i < 4; i++) c.fillRect(i * 210, -150, 22, 1200);
    c.fillRect(-300, 410, 1500, 24); c.restore();
    c.filter = 'blur(12px)';
    for (let i = 0; i < 22; i++) {
      const x = 65 + random() * 230, y = 170 + random() * 650;
      c.save(); c.translate(x, y); c.rotate(random() * Math.PI);
      c.beginPath(); c.ellipse(0, 0, 12 + random() * 15, 27 + random() * 26, 0, 0, Math.PI * 2);
      c.fill(); c.restore();
    }
    c.filter = 'none';
  });
}

function floatingShadowTexture() {
  // Deliberate static approximation of the broad penumbra from the elevated
  // glass footprint. Clear margins preserve the untouched room floor around it.
  return paintTexture(768, 640, c => {
    c.clearRect(0, 0, 768, 640);
    c.filter = 'blur(25px)'; c.fillStyle = '#302c38a6';
    c.beginPath(); c.roundRect(128, 124, 512, 398, 20); c.fill();
    // A much softer outer falloff supplies distance without a hard dark border.
    c.filter = 'blur(49px)'; c.fillStyle = '#4c43542e';
    c.beginPath(); c.roundRect(119, 115, 530, 416, 28); c.fill();
    c.filter = 'none';
  });
}

function floatingCausticTexture() {
  // Hand-authored, bounded refracted light accents; this is not a ray-traced
  // caustic solution. The broken arcs occupy only a small part of the floor.
  return paintTexture(768, 640, c => {
    c.clearRect(0, 0, 768, 640); c.lineCap = 'round';
    function arc(color, width, blur, dx = 0, dy = 0) {
      c.strokeStyle = color; c.lineWidth = width; c.filter = `blur(${blur}px)`;
      c.beginPath(); c.moveTo(116 + dx, 345 + dy);
      c.bezierCurveTo(93 + dx, 449 + dy, 160 + dx, 533 + dy, 310 + dx, 520 + dy); c.stroke();
      c.beginPath(); c.moveTo(566 + dx, 156 + dy);
      c.bezierCurveTo(648 + dx, 180 + dy, 662 + dx, 230 + dy, 646 + dx, 280 + dy); c.stroke();
    }
    arc('#fff1ca58', 24, 14);
    arc('#ffedbdb0', 5, 3);
    arc('#c4c8ff6b', 3, 3, 4, 2);
    arc('#fff9e8b0', 1.7, 1, -1, 0);
    c.filter = 'none';
  });
}

export function createRoomLeafGeometry() {
  // Derived from the cottage Plant's curved leaf profile, with a rounder
  // outline and softer twist for this close foreground composition.
  const geometry = new THREE.PlaneGeometry(1, 1, 6, 10), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, t = p.getY(i) + .5;
    p.setXYZ(i, u * Math.pow(Math.sin(Math.PI * t), .8) * .17 + Math.sin(Math.PI * t) * .025, t * .43, Math.sin(Math.PI * t) * (.07 + Math.abs(u) * .05) + u * t * .025);
  }
  geometry.computeVertexNormals(); return geometry;
}

function curtainGeometry() {
  const vertices = [], divisions = 48;
  const vertex = (column, top) => {
    const p = column / divisions;
    return [(p - .5) * 3.4, top ? 8.8 : 0, Math.sin(p * Math.PI * 16) * (top ? .10 : .18)];
  };
  for (let i = 0; i < divisions; i++) vertices.push(...vertex(i, false), ...vertex(i + 1, false), ...vertex(i, true), ...vertex(i, true), ...vertex(i + 1, false), ...vertex(i + 1, true));
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  return geometry;
}

export function createReadingRoom() {
  const group = new THREE.Group(); group.name = 'cottage-reading-environment';
  const foreground = new THREE.Group(); foreground.name = 'cottage-reading-props';
  let target = group;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const keepGeometry = geometry => { geometries.add(geometry); return geometry; };
  const standard = (color, roughness = .82, extra = {}) => { const material = new THREE.MeshStandardMaterial({color, roughness, ...extra}); materials.add(material); return material; };
  const basic = (parameters) => { const material = new THREE.MeshBasicMaterial(parameters); materials.add(material); return material; };
  const texture = value => { textures.add(value); return value; };
  const boxGeometry = keepGeometry(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeometry = keepGeometry(new THREE.SphereGeometry(1, 24, 16));
  const makeMesh = (geometry, material, position, scale = null) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); if (scale) mesh.scale.set(...scale);
    mesh.receiveShadow = true; target.add(mesh); return mesh;
  };
  const box = (position, size, material, castShadow = true) => { const mesh = makeMesh(boxGeometry, material, position, size); mesh.castShadow = castShadow; return mesh; };
  const rod = (from, to, radius, material) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), direction = end.clone().sub(start);
    const geometry = keepGeometry(new THREE.CylinderGeometry(radius, radius, direction.length(), 8));
    const mesh = makeMesh(geometry, material, start.clone().add(end).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); mesh.castShadow = true; return mesh;
  };

  const oak = texture(oakTexture()); oak.wrapS = oak.wrapT = THREE.RepeatWrapping; oak.repeat.set(2.5, 2.5);
  const daySky = texture(skylineTexture(false)), nightSky = texture(skylineTexture(true));
  const stoneMap = texture(mineralTexture()); stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  const floorMaterial = standard('#f5eee1', .84, {map: oak});
  const neutralFloor = standard('#ded8cd', .94);
  const wall = standard('#e9e1ce', .94);
  const frame = standard('#555956', .68, {metalness:.12});
  const fabric = standard('#dedbcc', .97);
  const sage = standard('#a6b4a0', .98), rose = standard('#c8aba4', .98);
  const darkWood = standard('#785a43', .86);
  const stone = standard('#e2d7c3', .93, {map:stoneMap, bumpMap:stoneMap, bumpScale:.025});
  const leaf = standard('#708365', .8, {side:THREE.DoubleSide, emissive:0x6c8055, emissiveIntensity:.12});
  const leafLight = standard('#8b9c72', .82, {side:THREE.DoubleSide, emissive:0x869b68, emissiveIntensity:.12});
  const sky = basic({map:daySky, toneMapped:false});
  const curtainMaterial = standard('#fff4df', 1, {side:THREE.DoubleSide, transparent:true, opacity:.63, depthWrite:false});

  // The open room surrounds the unchanged table and camera, with its floor
  // below the glass. No click handlers, app destinations or character assets.
  const floorPlane = keepGeometry(new THREE.PlaneGeometry(180, 180));
  const floor = makeMesh(floorPlane, neutralFloor, [0, ROOM_FLOOR_Y - .025, 0]); floor.rotation.x = -Math.PI / 2;
  const oakPlane = keepGeometry(new THREE.PlaneGeometry(34, 37));
  const oakFloor = makeMesh(oakPlane, floorMaterial, [0, ROOM_FLOOR_Y, .8]); oakFloor.rotation.x = -Math.PI / 2;
  box([-17.2, 2.0, 1], [.26,9.6,33], wall);
  box([17.2, 1.0, 1], [.24,7.6,33], wall);
  box([0, -2.58, WINDOW_Z], [34.5,.44,.35], wall);
  const skyPlane = keepGeometry(new THREE.PlaneGeometry(34.4, 11.8));
  makeMesh(skyPlane, sky, [0, 3.0, WINDOW_Z - .2]);
  for (const x of [-17,-10.2,-3.4,3.4,10.2,17]) box([x,2.6,WINDOW_Z], [.16,10.8,.18], frame);
  for (const y of [-2.52,.65,7.95]) box([0,y,WINDOW_Z], [34.2,.15,.2], frame);
  for (const x of [-13.6,-6.8,0,6.8,13.6]) box([x,7.56,WINDOW_Z+.13], [6.55,.7,.11], wall);
  const curtain = keepGeometry(curtainGeometry());
  makeMesh(curtain, curtainMaterial, [-14.8,ROOM_FLOOR_Y+.12,WINDOW_Z+.4]);
  makeMesh(curtain, curtainMaterial, [14.8,ROOM_FLOOR_Y+.12,WINDOW_Z+.4]);

  // A softly rounded right-side sofa keeps the cottage's recognizable layout.
  // Rounded cushions use scaled spheres; the original proportions/palette are
  // adapted instead of importing the cottage's R3F RoundedBox dependency.
  const cushion = (position, scale, material) => {const mesh=makeMesh(sphereGeometry,material,position,scale);mesh.castShadow=true;return mesh;};
  box([13.1,ROOM_FLOOR_Y+1.05,-3.1],[3.35,1.05,8.7],fabric);
  cushion([14.45,ROOM_FLOOR_Y+2.35,-3.1],[.55,1.2,4.45],fabric);
  for (const z of [-5.9,-3.1,-.3]) {
    cushion([12.8,ROOM_FLOOR_Y+1.8,z],[1.55,.43,1.27],fabric);
    cushion([13.86,ROOM_FLOOR_Y+2.7,z],[.4,1.03,1.27],fabric);
  }
  for(const z of[-7.3,1.1])cushion([13.1,ROOM_FLOOR_Y+2,z],[1.76,.75,.48],fabric);
  cushion([12.9,ROOM_FLOOR_Y+2.55,-6.1],[.62,.87,.64],sage).rotation.z=-.23;
  cushion([12.9,ROOM_FLOOR_Y+2.5,.0],[.62,.87,.64],rose).rotation.z=.25;
  for(const z of[-6.6,.4])for(const x of[12.1,14.1])box([x,ROOM_FLOOR_Y+.3,z],[.2,.6,.2],darkWood);

  target = foreground;
  // A low stone dish rests on the floor outside the free-placement footprint.
  // It is newly authored; cottage leaf geometry is softly curved and splayed.
  foreground.position.y = ROOM_FLOOR_Y + .23;
  const bowlProfile=[[0,-.23],[.58,-.23],[.84,-.18],[1.04,-.05],[1.1,.12],[1.04,.22],[.95,.21],[.88,.08],[.72,-.05],[.3,-.12],[0,-.12]].map(([x,y])=>new THREE.Vector2(x,y));
  const bowl=makeMesh(keepGeometry(new THREE.LatheGeometry(bowlProfile,48)),stone,[-8.65,.02,-2.1]);bowl.castShadow=true;
  const pebbleMaterial=standard('#b4ada0',.88,{map:stoneMap});
  for(const [x,z,s,angle] of[[-.3,-.05,.23,.4],[.25,.14,.19,-.3],[.06,-.34,.17,.8]]){
    const pebble=makeMesh(sphereGeometry,pebbleMaterial,[-8.65+x,.02,-2.1+z],[s,.11,s*.73]);pebble.rotation.y=angle;pebble.castShadow=true;
  }
  const leafGeometry=keepGeometry(createRoomLeafGeometry());
  // The inward-most leaf stays left of x=-7.5; it cannot cover a card/drop.
  const stemBase=[-9.05,.02,-2.48], stemTip=[-9.6,1.62,-2.96];
  rod(stemBase,stemTip,.026,leaf);
  for(let i=0;i<8;i++){
    const t=.18+i*.10, side=i%2?1:-1;
    const start=new THREE.Vector3(...stemBase).lerp(new THREE.Vector3(...stemTip),t);
    const end=start.clone().add(new THREE.Vector3(side*.34,.13,(i%3-1)*.21));
    rod(start.toArray(),end.toArray(),.012,leaf);
    const blade=makeMesh(leafGeometry,i%3?leaf:leafLight,end.toArray());
    blade.scale.setScalar(1.55+(i%3)*.12);blade.rotation.set(-1.1 + .18*(i%3),side*.53+i*.26,-side*.65+i*.08);blade.castShadow=true;
  }

  target = group;
  const projectedLight = basic({map:texture(windowLightTexture()),transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
  const lightPool=makeMesh(keepGeometry(new THREE.PlaneGeometry(28,30)),projectedLight,[-1.8,ROOM_FLOOR_Y+.015,-2.6]);
  lightPool.rotation.set(-Math.PI/2,0,.23); lightPool.receiveShadow=false; lightPool.renderOrder=1;

  // Glass remains at y≈0 while these floor-only layers sit 2.8 units below.
  // Offset and blur provide a spatial separation cue through the clear table.
  const floatingShadow = basic({map:texture(floatingShadowTexture()),transparent:true,opacity:.22,depthWrite:false,toneMapped:false});
  const shadowPlane = makeMesh(keepGeometry(new THREE.PlaneGeometry(22.2,18)),floatingShadow,[1.15,ROOM_FLOOR_Y+.022,1.35]);
  shadowPlane.rotation.x=-Math.PI/2;shadowPlane.receiveShadow=false;shadowPlane.renderOrder=2;
  const floatingCaustic = basic({map:texture(floatingCausticTexture()),transparent:true,opacity:.55,depthWrite:false,toneMapped:false});
  const causticPlane = makeMesh(keepGeometry(new THREE.PlaneGeometry(22.2,18)),floatingCaustic,[1.15,ROOM_FLOOR_Y+.026,1.35]);
  causticPlane.rotation.x=-Math.PI/2;causticPlane.receiveShadow=false;causticPlane.renderOrder=3;

  // Owned only by the room group, so an isolated background scene has useful
  // light without importing the cottage runtime or touching foreground lights.
  const hemisphere = new THREE.HemisphereLight(0xf5f2e9, 0x8b7e68, 1.35);
  const sunlight = new THREE.DirectionalLight(0xfff0d7, 2.2); sunlight.position.set(-12,15,-8);
  const fill = new THREE.DirectionalLight(0xe4edff,.65); fill.position.set(8,10,5);
  group.add(hemisphere,sunlight,fill);
  let disposed=false;
  function applyAppearance(theme){
    const dark=theme==='dark';
    floorMaterial.color.set(dark?'#697486':'#eeedf0'); neutralFloor.color.set(dark?'#292f3b':'#d9d7d3');
    wall.color.set(dark?'#657083':'#e3e2dd'); frame.color.set(dark?'#303b4b':'#777b77');
    fabric.color.set(dark?'#8a939f':'#dedbcc'); stone.color.set(dark?'#a5acb7':'#e2d7c3');
    curtainMaterial.color.set(dark?'#98a9c4':'#fff4df'); curtainMaterial.opacity=dark?.4:.63;
    leaf.color.set(dark?'#506969':'#708365');leafLight.color.set(dark?'#7b8c7d':'#8b9c72');
    sky.map=dark?nightSky:daySky; sky.needsUpdate=true; projectedLight.opacity=dark?.10:.9;
    floatingShadow.opacity=dark?.34:.38; floatingCaustic.opacity=dark?.08:.2;
    hemisphere.intensity=dark?.38:.85; hemisphere.color.set(dark?0xa9bdd7:0xf5f2e9);
    sunlight.intensity=dark?.20:1.65; sunlight.color.set(dark?0xb3c7ef:0xfff8ee); fill.intensity=dark?.22:.55;
  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();foreground.removeFromParent();
    geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
    group.clear();foreground.clear();
  }
  group.userData={floorY:ROOM_FLOOR_Y,sourceRevision:'e71fe3fafe7aa4ab4074a6e32669e3b76779101a',decorativeOnly:true};
  applyAppearance('light');
  return {group,foreground,applyAppearance,dispose};
}
