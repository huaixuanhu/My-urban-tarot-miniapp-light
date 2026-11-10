import * as THREE from 'three';
import { createReadingGlass } from '../../client/src/reading-glass.mjs';

// Local comparison only; never imported by the application or deployed bundle.
let mode = 'perspective', theme = 'light';
const panels = ['soft', 'firm'].map((id, i) => {
  const canvas = document.getElementById(id);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  const glass = createReadingGlass(renderer, { cornerK: i ? 1.8 : 1.5 }); scene.add(glass);
  const hemisphere = new THREE.HemisphereLight(0xf0eff7, 0x827c8a, .9); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xfff0db, 2.65); key.position.set(-8, 14, -7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd1d9ef, 1.15); rim.position.set(5, 4.5, -5.5); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xb3a68f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.20; scene.add(ground);
  const grid = new THREE.GridHelper(60, 60, 0x8f826a, 0xb2a38a); grid.position.y = -.19; scene.add(grid);
  return { canvas, renderer, scene, camera, glass, ground, hemisphere, key, rim };
});
function render() {
  document.body.dataset.theme = theme;
  for (const p of panels) {
    const dark = theme === 'dark', width = p.canvas.clientWidth, height = p.canvas.clientHeight;
    p.renderer.setSize(width, height, false); p.renderer.setClearColor(dark ? 0x211e1a : 0xeee9e0);
    p.camera.aspect = width / height;
    p.camera.up.set(0, 1, 0);
    if (mode === 'top') { p.camera.position.set(0, 25, -.599); p.camera.lookAt(0, 0, -.6); }
    else if (mode === 'corner') { p.camera.position.set(9.9, 3.7, 9.6); p.camera.lookAt(6.4, -.05, 4.2); }
    else { p.camera.position.set(0, 15.8, 17.8); p.camera.lookAt(0, 0, -.6); }
    p.camera.updateProjectionMatrix();
    p.glass.userData.applyAppearance(theme); p.ground.material.color.setHex(dark ? 0x403729 : 0xb3a68f);
    p.hemisphere.intensity = dark ? .64 : .9; p.key.intensity = dark ? 2.25 : 2.65;
    p.rim.color.setHex(dark ? 0xe9d9c5 : 0xd1d9ef);
    p.renderer.render(p.scene, p.camera);
  }
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
document.getElementById('theme').addEventListener('click', () => { theme = theme === 'light' ? 'dark' : 'light'; render(); });
new ResizeObserver(render).observe(document.querySelector('main'));
render();
