import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------ *
 *  CONFIG — tweak these to taste
 * ------------------------------------------------------------------ */
const COVER_URL   = 'assets/loveless.jpg'; // EDIT: drop your cover here
const FADE_SECONDS = 8;                     // how long the volume ramp lasts
const TARGET_VOLUME = 1.0;                   // final "actual sound level"
const SPIN_SPEED  = 0.07;                    // radians/sec around Y (idle, no music)

/* ------------------------------------------------------------------ *
 *  RENDERER + SCENE
 * ------------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

/* faint ambient fill so the shadowed side isn't pitch black */
scene.add(new THREE.AmbientLight(0xffd9ec, 0.45));
/* single soft corner light — gentle so it doesn't burn a hotspot */
const key = new THREE.PointLight(0xff8ec4, 1.4, 30);
key.position.set(3, 2, 5);
scene.add(key);

/* environment map -> gives the sphere a subtle reflection */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ------------------------------------------------------------------ *
 *  THE COVER-ART SPHERE  (cube-sphere construction)
 *  6 cube faces -> regular grid of cells -> each cell projected onto the
 *  sphere as a curved cover patch. Cells share edges, so: no gaps, an
 *  even/deliberate layout, and few enough covers that each stays legible.
 * ------------------------------------------------------------------ */
const SIZE = 2.6;            // kept for the halo sizing
const RADIUS = 1.55;         // sphere radius
const FACE_GRID = 5;         // covers per cube-face edge  -> 6 * N*N covers
const PATCH_SUB = 4;         // curvature smoothness within each cover
const COVER_COUNT = 6 * FACE_GRID * FACE_GRID;

const cover = new THREE.Group();

/* reflective base sphere — backs the covers and catches the env reflection */
const baseSphere = new THREE.Mesh(
  new THREE.SphereGeometry(RADIUS * 0.985, 64, 64),
  new THREE.MeshStandardMaterial({
    color: 0x2a0a18,
    metalness: 1.0,
    roughness: 0.36,
    emissive: 0x6e1a3a,
    emissiveIntensity: 0.25,
    envMapIntensity: 0.6,
  })
);
cover.add(baseSphere);

/* cover-art material (one texture shared by every patch) */
const mat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  roughness: 0.32,
  metalness: 0.5,
  envMapIntensity: 0.45,
  emissive: 0xe85b9c,
  emissiveIntensity: 0.12,
});

/* build the cube-sphere geometry: every cell gets full 0..1 UVs so the
   whole cover art shows inside it */
const FACES = [
  { n: [ 1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // +X
  { n: [-1, 0, 0], u: [0, 0,  1], v: [0, 1, 0] }, // -X
  { n: [ 0, 1, 0], u: [1, 0,  0], v: [0, 0, -1] }, // +Y
  { n: [ 0,-1, 0], u: [1, 0,  0], v: [0, 0,  1] }, // -Y
  { n: [ 0, 0, 1], u: [1, 0,  0], v: [0, 1, 0] }, // +Z
  { n: [ 0, 0,-1], u: [-1,0,  0], v: [0, 1, 0] }, // -Z
];
const positions = [];
const normals = [];
const uvs = [];
const indices = [];
let vbase = 0;
const _d = new THREE.Vector3();
// tangent warp: equalizes cell areas so corner covers aren't stretched
// (without it, covers near cube-face corners look squished vs. the others)
const warp = (x) => Math.tan(x * Math.PI * 0.25);
function dirAt(f, s, t) { // s,t in [-1,1] across a cube face
  return _d.set(
    f.n[0] + f.u[0] * s + f.v[0] * t,
    f.n[1] + f.u[1] * s + f.v[1] * t,
    f.n[2] + f.u[2] * s + f.v[2] * t
  ).normalize();
}
for (const f of FACES) {
  for (let ci = 0; ci < FACE_GRID; ci++) {
    for (let cj = 0; cj < FACE_GRID; cj++) {
      const s0 = -1 + (2 * ci) / FACE_GRID, s1 = -1 + (2 * (ci + 1)) / FACE_GRID;
      const t0 = -1 + (2 * cj) / FACE_GRID, t1 = -1 + (2 * (cj + 1)) / FACE_GRID;
      for (let a = 0; a <= PATCH_SUB; a++) {
        for (let b = 0; b <= PATCH_SUB; b++) {
          const fa = a / PATCH_SUB, fb = b / PATCH_SUB;
          const d = dirAt(f, warp(s0 + (s1 - s0) * fa), warp(t0 + (t1 - t0) * fb));
          positions.push(d.x * RADIUS, d.y * RADIUS, d.z * RADIUS);
          normals.push(d.x, d.y, d.z);
          uvs.push(fa, fb); // full cover art per cell
        }
      }
      const stride = PATCH_SUB + 1;
      for (let a = 0; a < PATCH_SUB; a++) {
        for (let b = 0; b < PATCH_SUB; b++) {
          const i0 = vbase + a * stride + b;
          indices.push(i0, i0 + stride, i0 + 1, i0 + 1, i0 + stride, i0 + stride + 1);
        }
      }
      vbase += stride * stride;
    }
  }
}
const coverGeo = new THREE.BufferGeometry();
coverGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
coverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
coverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
coverGeo.setIndex(indices);
const coverMesh = new THREE.Mesh(coverGeo, mat);
cover.add(coverMesh);

scene.add(cover);

/* subtle pink halo behind the cover for that loveless glare */
const haloMat = new THREE.MeshBasicMaterial({
  color: 0xe85b9c,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
});
const halo = new THREE.Mesh(new THREE.CircleGeometry(SIZE * 0.95, 48), haloMat);
halo.position.z = -0.15;
scene.add(halo);

/* ---- load cover texture, fall back to a procedural placeholder ---- */
const loader = new THREE.TextureLoader();
loader.load(
  COVER_URL,
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.emissiveIntensity = 0.45;
    mat.needsUpdate = true;
  },
  undefined,
  () => {
    // no file yet → generate a washed-out pink placeholder
    mat.map = makePlaceholderTexture();
    mat.needsUpdate = true;
  }
);

function makePlaceholderTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(512, 440, 60, 512, 512, 760);
  g.addColorStop(0, '#ffd9ec');
  g.addColorStop(0.4, '#e85b9c');
  g.addColorStop(1, '#5e1230');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  // motion-blur streaks
  x.globalAlpha = 0.12;
  x.strokeStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    x.lineWidth = Math.random() * 6;
    x.beginPath();
    x.moveTo(Math.random() * 1024, 0);
    x.lineTo(Math.random() * 1024, 1024);
    x.stroke();
  }
  x.globalAlpha = 0.85;
  x.fillStyle = '#fff';
  x.font = '300 84px Helvetica, Arial, sans-serif';
  x.textAlign = 'center';
  x.filter = 'blur(2px)';
  x.fillText('loveless', 512, 540);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  BLOOM (the glare)
 * ------------------------------------------------------------------ */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.85, // strength
  0.7,  // radius
  0.2   // threshold
);
composer.addPass(bloom);

/* ------------------------------------------------------------------ *
 *  AUDIO — fade in from low to full on first interaction
 * ------------------------------------------------------------------ */
const track = document.getElementById('track');
const soundBtn = document.getElementById('sound');
const hint = document.getElementById('hint');
let started = false;
let fadeRAF = null;

/* Web Audio analyser — lets the visuals react to the track */
let analyser = null;
let freqData = null;
let audioLevel = 0; // smoothed 0..1 energy

function setupAnalyser() {
  if (analyser) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaElementSource(track);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.68;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    ctx.resume();
  } catch (e) {
    analyser = null; // routing failed — visuals fall back to steady spin
  }
}

track.volume = 0;

function fadeTo(target, seconds, onDone) {
  cancelAnimationFrame(fadeRAF);
  const from = track.volume;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min((now - t0) / (seconds * 1000), 1);
    // ease-in-out for a smooth swell
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    track.volume = from + (target - from) * e;
    if (k < 1) fadeRAF = requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  fadeRAF = requestAnimationFrame(step);
}

function playMusic() {
  const firstStart = !started;
  if (firstStart) {
    started = true;
    setupAnalyser();
    hint.classList.add('gone');
  }
  track.play()
    .then(() => fadeTo(TARGET_VOLUME, firstStart ? FADE_SECONDS : 2.5))
    .catch(() => { /* no file / blocked — visuals still run */ });
  soundBtn.classList.remove('muted');
}

function stopMusic() {
  fadeTo(0, 1.0, () => track.pause());
  soundBtn.classList.add('muted');
}

function isPlaying() {
  return started && !track.paused;
}

// reveal hint shortly after load, then wait for first interaction
setTimeout(() => hint.style.opacity = '', 1400);

// click/keypress anywhere (except the links + sound button):
//   first time -> start (fades in);  while playing -> stop the music
function onPageInteract(e) {
  if (e.button && e.button !== 0) return; // left-click / tap only (right-click = troll)
  if (e.target.closest && (e.target.closest('a') || e.target.closest('.sound'))) return;
  if (isPlaying()) stopMusic();
  else playMusic();
}
window.addEventListener('pointerdown', onPageInteract); // clicks/taps only

// the corner button just toggles play/stop too
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isPlaying()) stopMusic();
  else playMusic();
});

/* ------------------------------------------------------------------ *
 *  POINTER PARALLAX (subtle)
 * ------------------------------------------------------------------ */
const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
  pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ------------------------------------------------------------------ *
 *  ANIMATE
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // read BASS energy only (lowest frequency bins) and smooth it
  let level = 0;
  if (analyser) {
    analyser.getByteFrequencyData(freqData);
    // fftSize 256 -> 128 bins over ~22kHz; first ~6 bins ≈ sub/low bass (<1kHz)
    const lo = 1;                    // skip bin 0 (DC offset)
    const hi = 6;                    // bass cutoff
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += freqData[i];
    level = sum / (hi - lo) / 255;
  }
  // faster attack so beats hit hard
  audioLevel += (level - audioLevel) * 0.28;

  // soft idle "breathing" so the glow/reflection effects are always alive,
  // just gently when no music is playing; the music rides on top of it
  const idle = (Math.sin(t * 0.42) * 0.5 + 0.5) * 0.3;
  const glow = Math.max(idle, audioLevel); // glare energy: idle floor + music

  // spin eases with the music (much calmer than before); gentle wobble + float
  cover.rotation.y += (SPIN_SPEED + audioLevel * 1.4) * dt;
  cover.rotation.x = Math.sin(t * 0.5) * 0.12 + pointer.y * 0.15 + audioLevel * 0.1;
  cover.rotation.z = audioLevel * 0.06 * Math.sin(t * 4.0);
  cover.position.y = Math.sin(t * 0.8) * 0.12 + audioLevel * 0.1;
  // cover pulses softly on the beat
  const pulse = 1 + audioLevel * 0.1;
  cover.scale.setScalar(pulse);
  cover.position.z = audioLevel * 0.2;

  halo.position.y = cover.position.y;
  halo.rotation.z = t * 0.05;
  halo.scale.setScalar(pulse * (1 + glow * 0.35));

  // halo, glare and lights swell with `glow` -> soft when idle, fuller with music
  haloMat.opacity = 0.26 + glow * 0.7;
  bloom.strength = 0.7 + glow * 2.4;
  bloom.radius = 0.7 + glow * 0.4;
  key.intensity = 1.4 + glow * 1.6;

  // camera drifts toward pointer for depth
  camera.position.x += (pointer.x * 0.4 - camera.position.x) * 0.04;
  camera.lookAt(0, 0, 0);

  composer.render();
  requestAnimationFrame(tick);
}
tick();

/* ------------------------------------------------------------------ *
 *  RESIZE
 * ------------------------------------------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
