import * as THREE from 'three';
import { createScreenGlass, screenGlassCapture } from './reading-screen-glass.mjs';

// An isolated browser fixture. No application scene, card state or storage imports.
const runButton = document.getElementById('run');
const status = document.getElementById('status');
const output = document.getElementById('results');
const stage = document.getElementById('stage');
let renderer = null, compositor = null, cleanup = null;

function createFixtureScene() {
  const scene = new THREE.Scene();
  const resources = [];
  function add(geometry, material, position) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
    scene.add(mesh); resources.push(geometry, material); return mesh;
  }
  const data = new Uint8Array(16 * 16 * 4);
  const palette = [[241,238,219],[31,117,177],[202,56,72],[236,180,39],[49,149,114],[145,91,181]];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const color = palette[(Math.floor(x / 3) + Math.floor(y / 4)) % palette.length];
    data.set([...color,255], (y * 16 + x) * 4);
  }
  const art = new THREE.DataTexture(data,16,16); art.colorSpace = THREE.SRGBColorSpace;
  art.magFilter = art.minFilter = THREE.NearestFilter; art.needsUpdate = true; resources.push(art);
  add(new THREE.PlaneGeometry(5.8,3.6),new THREE.MeshStandardMaterial({color:0x64788c,roughness:0.56}),[0,0,-0.35]);
  add(new THREE.PlaneGeometry(2.0,2.7),new THREE.MeshBasicMaterial({map:art,toneMapped:false}),[-1.35,0,0]);
  add(new THREE.SphereGeometry(0.86,36,24),new THREE.MeshStandardMaterial({color:0xc67b46,metalness:0.22,roughness:0.27}),[1.25,0.1,0.08]);
  const probePosition = new THREE.Vector3(-2.55,1.38,0.04);
  add(new THREE.PlaneGeometry(0.32,0.32),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),probePosition.toArray());
  scene.add(new THREE.HemisphereLight(0xe8edff,0x35303c,1.25));
  const key = new THREE.DirectionalLight(0xffe4c1,3.4); key.position.set(-3,5,7); scene.add(key);
  return {scene,probePosition,dispose:() => resources.forEach(resource => resource.dispose())};
}

function readFrame(renderer) {
  const gl = renderer.getContext();
  const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
  const pixels = new Uint8Array(width * height * 4);
  // Read synchronously, immediately after render: no preserveDrawingBuffer requirement.
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const error = gl.getError();
  if (error !== gl.NO_ERROR) throw new Error(`readPixels WebGL error ${error}`);
  return {width,height,pixels};
}

function pixelAt(frame,x,y) {
  const offset = (y * frame.width + x) * 4;
  return Array.from(frame.pixels.subarray(offset,offset + 4));
}

function compareFrames(before,after,bounds,capture) {
  if (before.width !== after.width || before.height !== after.height) throw new Error('Framebuffer dimensions changed during comparison.');
  let outsidePixels = 0, outsideChanged = 0, insidePixels = 0, insideChanged = 0, maximumOutsideByteDifference = 0;
  const scaleX = before.width / bounds.viewportWidth, scaleY = before.height / bounds.viewportHeight;
  const radius = bounds.height / 2, straight = bounds.width / 2 - radius;
  for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
    const offset = (y * before.width + x) * 4;
    let maximumDifference = 0;
    for (let channel = 0; channel < 4; channel++) maximumDifference = Math.max(maximumDifference,Math.abs(before.pixels[offset+channel] - after.pixels[offset+channel]));
    // Capture coordinates already use framebuffer's lower-left origin.
    // One additional pixel bounds rasterization at the quad's exact edge.
    const outside = x < capture.x - 1 || x >= capture.x + capture.width + 1 || y < capture.y - 1 || y >= capture.y + capture.height + 1;
    if (outside) {
      outsidePixels++;
      if (maximumDifference) outsideChanged++;
      maximumOutsideByteDifference = Math.max(maximumOutsideByteDifference,maximumDifference);
    }
    const cssX = (x + 0.5) / scaleX, cssY = (before.height - y - 0.5) / scaleY;
    const dx = Math.max(0,Math.abs(cssX - bounds.left - bounds.width/2) - straight);
    const dy = cssY - bounds.top - bounds.height/2;
    if (dx*dx + dy*dy < (radius-1)*(radius-1)) {
      insidePixels++;
      if (maximumDifference) insideChanged++;
    }
  }
  return {outsidePixels,outsideChanged,maximumOutsideByteDifference,insidePixels,insideChanged};
}

async function run() {
  runButton.disabled = true; status.textContent = 'Running…';
  compositor?.dispose(); cleanup?.(); renderer?.dispose(); stage.replaceChildren();
  compositor = null; cleanup = null; renderer = null;
  const results = [];
  try {
    renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    stage.append(renderer.domElement);
    const fixture = createFixtureScene(); cleanup = fixture.dispose;
    compositor = createScreenGlass(renderer);
    const camera = new THREE.OrthographicCamera(-3.2,3.2,2.1,-2.1,0.1,20);
    camera.position.set(0,0,6); camera.lookAt(0,0,0); camera.updateMatrixWorld();
    for (const theme of ['light','dark']) for (const dpr of [1,2]) for (const [width,height] of [[420,280],[620,390]]) {
      renderer.setPixelRatio(dpr); renderer.setSize(width,height);
      renderer.setClearColor(theme === 'dark' ? 0x181a22 : 0xeeedf0,0);
      stage.style.background = theme === 'dark' ? '#181a22' : '#eeedf0';
      camera.top = 3.2 * height / width; camera.bottom = -camera.top; camera.updateProjectionMatrix();
      const bounds = {left:width*0.18,top:height*0.58,width:width*0.64,height:62,viewportWidth:width,viewportHeight:height};
      compositor.setBounds(bounds); compositor.applyAppearance(theme);
      renderer.render(fixture.scene,camera);
      const before = readFrame(renderer);
      compositor.render(fixture.scene,camera);
      const after = readFrame(renderer);
      const capture = screenGlassCapture(bounds,before.width,before.height);
      if (!capture) throw new Error('Fixture capsule has no capture region.');
      const comparison = compareFrames(before,after,bounds,capture);
      const projectedProbe = fixture.probePosition.clone().project(camera);
      const px = Math.floor((projectedProbe.x+1)*0.5*before.width);
      const py = Math.floor((projectedProbe.y+1)*0.5*before.height);
      const whiteBefore = pixelAt(before,px,py), whiteAfter = pixelAt(after,px,py);
      const sourceWhitePreserved = whiteBefore.every(value => value===255) && whiteAfter.every(value => value===255);
      const rendererStatePreserved = renderer.toneMapping===THREE.ACESFilmicToneMapping && renderer.toneMappingExposure===1.18 && renderer.outputColorSpace===THREE.SRGBColorSpace && renderer.autoClear===true && renderer.getRenderTarget()===null;
      const pass = comparison.outsidePixels>0 && comparison.outsideChanged===0 && comparison.insidePixels>0 && comparison.insideChanged>0 && sourceWhitePreserved && rendererStatePreserved;
      results.push({theme,dpr,viewport:[width,height],framebuffer:[before.width,before.height],pass,...comparison,sourceWhitePreserved,whiteBefore,whiteAfter,rendererStatePreserved});
      output.textContent = JSON.stringify({status:'running',cases:results},null,2);
      status.textContent = `${results.length}/8 cases complete`;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const passed = results.filter(result => result.pass).length;
    const report = {status:passed===8?'PASS':'FAIL',passed,total:results.length,outsideTolerance:'exact RGBA bytes',excludedRegion:'capsule + 24 CSS pixels capture padding + 1 framebuffer pixel',cases:results};
    output.textContent = JSON.stringify(report,null,2);
    status.textContent = `${report.status}: ${passed}/${results.length}`;
    document.body.dataset.result = report.status.toLowerCase();
  } catch (error) {
    output.textContent = JSON.stringify({status:'FAIL',error:String(error?.stack||error),cases:results},null,2);
    status.textContent = 'FAIL'; document.body.dataset.result = 'fail';
  } finally { runButton.disabled = false; }
}
runButton.addEventListener('click',run);
addEventListener('pagehide',() => {compositor?.dispose(); cleanup?.(); renderer?.dispose();});
