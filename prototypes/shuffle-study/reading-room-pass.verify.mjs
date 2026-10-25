import * as THREE from 'three';
import { createReadingRoomPass } from './reading-room-pass.mjs';
import { createScreenGlass, screenGlassCapture } from './reading-screen-glass.mjs';

const button = document.getElementById('run'), status = document.getElementById('status');
const output = document.getElementById('results'), stage = document.getElementById('stage');
let renderer, roomPass, lens, disposeFixture;

function fixture() {
  const scene = new THREE.Scene(), room = new THREE.Group(), resources = [], artProbes = [];
  const palette = [[241,238,219],[31,117,177],[202,56,72],[236,180,39],[49,149,114],[145,91,181],[0,0,0],[255,255,255]];
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y=0;y<16;y++) for(let x=0;x<16;x++) pixels.set([...palette[(Math.floor(x/4)+Math.floor(y/4)*4)%palette.length],255],(y*16+x)*4);
  const art = new THREE.DataTexture(pixels,16,16);art.colorSpace=THREE.SRGBColorSpace;
  art.minFilter=art.magFilter=THREE.NearestFilter;art.generateMipmaps=false;art.needsUpdate=true;resources.push(art);
  function plane(parent,width,height,material,position) {
    const geometry = new THREE.PlaneGeometry(width,height), mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(...position);parent.add(mesh);resources.push(geometry,material);return mesh;
  }
  plane(scene,2.0,1.7,new THREE.MeshBasicMaterial({map:art,toneMapped:false}),[-1.4,0.45,0]);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)artProbes.push(new THREE.Vector3(-2.4+(x+0.5)*0.5,-0.4+(y+0.5)*0.425,0));
  const white = new THREE.Vector3(1.8,0.8,0);
  plane(scene,0.5,0.5,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),white.toArray());
  const floor = plane(room,10,8,new THREE.MeshStandardMaterial({color:0xa6b6bc,roughness:0.8}),[0,0,-2]);
  for(let i=0;i<12;i++)plane(room,0.2,5,new THREE.MeshStandardMaterial({color:i%2?0xd8ba91:0x334355,roughness:0.7}),[-3.3+i*0.6,0,-1.85]);
  const sphereGeometry=new THREE.SphereGeometry(0.65,32,20), sphereMaterial=new THREE.MeshStandardMaterial({color:0x85754c,roughness:0.4});
  const sphere=new THREE.Mesh(sphereGeometry,sphereMaterial);sphere.position.set(1.4,-0.5,-0.9);room.add(sphere);resources.push(sphereGeometry,sphereMaterial);
  const ambient=new THREE.HemisphereLight(0xffffff,0x35302a,1.3);room.add(ambient);
  const key=new THREE.DirectionalLight(0xffe7c4,3.2);key.position.set(-2,4,5);room.add(key);
  return {scene,room,artProbes,white,applyTheme(theme){floor.material.color.setHex(theme==='dark'?0x334154:0xa6b6bc);ambient.intensity=theme==='dark'?0.6:1.3;key.intensity=theme==='dark'?1.6:3.2;},dispose(){resources.forEach(resource=>resource.dispose());}};
}
function readFrame() {
  const gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(`readPixels error ${error}`);
  return {width,height,pixels};
}
function pixel(frame,x,y) {const offset=(y*frame.width+x)*4;return Array.from(frame.pixels.subarray(offset,offset+4));}
function xy(point,camera,frame){const p=point.clone().project(camera);return [Math.floor((p.x+1)*0.5*frame.width),Math.floor((p.y+1)*0.5*frame.height)];}
function equal(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index]);}
function probeComparison(before,after,points,camera){let samples=0,changed=0;for(const point of points){const [cx,cy]=xy(point,camera,before);for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){samples++;if(!equal(pixel(before,x,y),pixel(after,x,y)))changed++;}}return {samples,changed};}
function backgroundComparison(before,after){let samples=0,changed=0;for(let y=8;y<before.height-8;y+=11)for(let x=Math.floor(before.width*.62);x<before.width-8;x+=11){samples++;if(!equal(pixel(before,x,y),pixel(after,x,y)))changed++;}return{samples,changed};}
function outsideComparison(before,after,capture){let samples=0,changed=0;for(let y=0;y<before.height;y++)for(let x=0;x<before.width;x++){if(x>=capture.x-1&&x<capture.x+capture.width+1&&y>=capture.y-1&&y<capture.y+capture.height+1)continue;samples++;const offset=(y*before.width+x)*4;for(let c=0;c<4;c++)if(before.pixels[offset+c]!==after.pixels[offset+c]){changed++;break;}}return{samples,changed};}
function cleanup(){lens?.dispose();roomPass?.dispose();disposeFixture?.();renderer?.dispose();lens=roomPass=renderer=disposeFixture=null;}

async function run(){
  button.disabled=true;status.textContent='Running…';cleanup();stage.replaceChildren();const cases=[];
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    stage.append(renderer.domElement);const f=fixture();disposeFixture=f.dispose;
    roomPass=createReadingRoomPass(renderer,f.room);lens=createScreenGlass(renderer);
    const camera=new THREE.OrthographicCamera(-3.2,3.2,2.1,-2.1,0.1,20);camera.position.set(0,0,6);camera.lookAt(0,0,0);
    for(const theme of ['light','dark'])for(const dpr of [1,2])for(const [width,height] of [[420,280],[620,390]]){
      renderer.setPixelRatio(dpr);renderer.setSize(width,height);renderer.setClearColor(theme==='dark'?0x181a22:0xeeedf0,1);
      camera.position.set(0,0,6);camera.lookAt(0,0,0);camera.top=3.2*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      f.scene.background=new THREE.Color(theme==='dark'?0x181a22:0xeeedf0);renderer.render(f.scene,camera);const flat=readFrame();
      f.applyTheme(theme);roomPass.applyAppearance(theme);
      const renderedAfterInputChange=roomPass.render(camera),cachedStatic=roomPass.render(camera)===false;
      camera.position.x=0.18;const cameraInvalidated=roomPass.render(camera),cameraCached=roomPass.render(camera)===false;
      camera.position.x=0;const cameraRestored=roomPass.render(camera);
      f.scene.background=roomPass.texture;renderer.render(f.scene,camera);const roomFrame=readFrame();
      const bounds={left:width*.18,top:height*.76,width:width*.64,height:46,viewportWidth:width,viewportHeight:height};
      lens.applyAppearance(theme);lens.setBounds(bounds);lens.render(f.scene,camera);const withLens=readFrame();
      const artOverRoom=probeComparison(flat,roomFrame,f.artProbes,camera),artOverLens=probeComparison(flat,withLens,f.artProbes,camera);
      const whiteXY=xy(f.white,camera,flat),whiteFlat=pixel(flat,...whiteXY),whiteRoom=pixel(roomFrame,...whiteXY),whiteLens=pixel(withLens,...whiteXY);
      const whitePreserved=whiteFlat.every(value=>value===255)&&equal(whiteFlat,whiteRoom)&&equal(whiteFlat,whiteLens);
      const background=backgroundComparison(flat,roomFrame),capture=screenGlassCapture(bounds,flat.width,flat.height),outside=outsideComparison(roomFrame,withLens,capture);
      const rendererStatePreserved=renderer.getRenderTarget()===null&&renderer.autoClear===true&&renderer.toneMapping===THREE.ACESFilmicToneMapping&&renderer.outputColorSpace===THREE.SRGBColorSpace&&renderer.toneMappingExposure===1.18;
      const pass=artOverRoom.changed===0&&artOverLens.changed===0&&whitePreserved&&background.changed>0&&outside.changed===0&&renderedAfterInputChange&&cachedStatic&&cameraInvalidated&&cameraCached&&cameraRestored&&rendererStatePreserved;
      cases.push({theme,dpr,viewport:[width,height],framebuffer:[flat.width,flat.height],pass,artOverRoom,artOverLens,whitePreserved,whiteFlat,whiteRoom,whiteLens,background,outside,renderedAfterInputChange,cachedStatic,cameraInvalidated,cameraCached,cameraRestored,rendererStatePreserved});
      status.textContent=`${cases.length}/8 cases`;output.textContent=JSON.stringify({status:'running',cases},null,2);await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    const passed=cases.filter(item=>item.pass).length,report={status:passed===8?'PASS':'FAIL',passed,total:cases.length,foregroundTolerance:'exact RGBA bytes at sixteen 5x5 artwork probes and opaque white center',cases};
    output.textContent=JSON.stringify(report,null,2);status.textContent=`${report.status}: ${passed}/${cases.length}`;document.body.dataset.result=report.status.toLowerCase();
  }catch(error){output.textContent=JSON.stringify({status:'FAIL',error:String(error?.stack||error),cases},null,2);status.textContent='FAIL';document.body.dataset.result='fail';}
  finally{button.disabled=false;}
}
button.addEventListener('click',run);addEventListener('pagehide',cleanup);
