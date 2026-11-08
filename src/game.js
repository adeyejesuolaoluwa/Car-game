import * as THREE from 'three';
import './style.css';
import './playability.css';
import './career.css';

const $ = (selector) => document.querySelector(selector);
const sceneRoot = $('#scene');
const ui = {
  lobby: $('#lobby'), hud: $('#race-hud'), result: $('#result-screen'),
  modeButtons: [...document.querySelectorAll('[data-mode]')],
  trackOptions: $('#track-options'), carOptions: $('#car-options'), swatches: $('#color-options'),
  upgradeOptions: $('#upgrade-options'),
  start: $('#start-button'), position: $('#position'), opponentCount: $('#opponent-count'),
  lap: $('#lap'), lapFill: $('#lap-fill'), timer: $('#timer'), status: $('#race-status'),
  timerBlock: $('#timer-block'),
  assistToggle: $('#assist-toggle'), sensitivity: $('#sensitivity-setting'), sensitivityValue: $('#sensitivity-value'),
  touchSize: $('#touch-size-setting'), touchSizeValue: $('#touch-size-value'), throttle: $('#throttle-setting'),
  tutorialCard: $('#tutorial-card'), tutorialTitle: $('#tutorial-title'), tutorialCopy: $('#tutorial-copy'),
  tutorialProgress: $('#tutorial-progress'), pauseScreen: $('#pause-screen'),
  speed: $('#speed'), gear: $('#gear'), boost: $('#boost-fill'), boostPercent: $('#boost-percent'),
  map: $('#minimap'), cameraName: $('#camera-name'), countdown: $('#countdown'),
  drift: $('#drift-score'), toast: $('#toast'), resultPlace: $('#result-place'),
  resultTitle: $('#result-title'), resultCopy: $('#result-copy'), reward: $('#result-reward'),
  resultXp: $('#result-xp'), careerResult: $('#career-result'),
  careerProgress: $('#career-progress'), careerStage: $('#career-stage'),
  careerFill: $('#career-fill'), careerCount: $('#career-count')
};

const cars = [
  { name: 'VOLT GT', type: 'SPORT', color: 0x11bce9, speed: 73, accel: 34, grip: 1.12, nitro: 1.0 },
  { name: 'FALCON R', type: 'SUPERCAR', color: 0xf3f1e8, speed: 81, accel: 37, grip: 1.0, nitro: 1.08 },
  { name: 'HELLCAT X', type: 'MUSCLE', color: 0xd83939, speed: 76, accel: 40, grip: .82, nitro: 1.18 },
  { name: 'APEX RS', type: 'HYPERCAR', color: 0xffb52e, speed: 88, accel: 36, grip: 1.06, nitro: 1.1 },
  { name: 'RALLY PRO', type: 'RALLY', color: 0x76ce7a, speed: 70, accel: 38, grip: 1.22, nitro: .95 },
  { name: 'NIGHTHAWK', type: 'TRACK', color: 0xa184ff, speed: 84, accel: 39, grip: 1.14, nitro: 1.05 }
];
const tracks = [
  { name: 'NEON DISTRICT', label: 'CITY CIRCUIT', sky: 0x8db7c7, ground: 0x59644c, road: 0x30353b, shape: 0, buildings: true },
  { name: 'SUNSET RUN', label: 'DESERT HIGHWAY', sky: 0xffa66d, ground: 0xb28b56, road: 0x4c4945, shape: 1, buildings: false },
  { name: 'ALPINE PASS', label: 'MOUNTAIN ROAD', sky: 0x9abbd0, ground: 0x52654d, road: 0x41494b, shape: 2, buildings: false }
];
const paintColors = [0x11bce9, 0xf3f1e8, 0xd83939, 0xffb52e, 0x76ce7a, 0xa184ff];
const difficulty = { easy: .84, normal: .94, hard: 1.02, pro: 1.1 };
const careerStages = [
  { title: 'NEON SPRINT', track: 0, difficulty: 'easy', reward: 450 },
  { title: 'SUNSET RUN', track: 1, difficulty: 'normal', reward: 600 },
  { title: 'ALPINE APEX', track: 2, difficulty: 'hard', reward: 800 }
];
const upgradeDefinitions = [
  { id: 'engine', name: 'ENGINE', stat: 'ACCEL + TOP SPEED', costs: [350, 600, 900] },
  { id: 'handling', name: 'HANDLING', stat: 'CORNERING + GRIP', costs: [300, 500, 800] },
  { id: 'nitro', name: 'NITRO', stat: 'BOOST POWER + DURATION', costs: [300, 500, 800] }
];
const state = {
  mode: 'race', trackIndex: 0, carIndex: 0, paintIndex: 0, difficulty: 'normal',
  active: false, countdown: 0, elapsed: 0, lap: 0, lastT: 0, playerProgress: 0,
  boost: 100, camera: 0, driftScore: 0, driftChain: 1, finished: false,
  sound: true, toastTime: 0, steer: 0, accelerate: false, braking: false, drifting: false, nitro: false,
  collisionCooldown: 0, stats: readProgress()
};
state.settings = readSettings();
state.tutorialActive = false;
state.tutorialPending = false;
state.tutorialStep = 0;
state.paused = false;
state.accelerateLatch = false;

let renderer, scene, camera, clock, curve, trackLength, worldGroup, sceneryGroup;
let player, rivals = [], obstacles = [], selectedVehicle, engineAudio;
const heldKeys = new Set();
const tmpForward = new THREE.Vector3();
const tmpSide = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraLook = new THREE.Vector3();

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('nitro-x-progress') || '{}');
    const bestLaps = saved.bestLaps && typeof saved.bestLaps === 'object' && !Array.isArray(saved.bestLaps) ? saved.bestLaps : {};
    const unlockedCars = Array.isArray(saved.unlockedCars)
      ? [...new Set([0, ...saved.unlockedCars.filter((index) => Number.isInteger(index) && index >= 0 && index < cars.length)])]
      : [0, 1, 2, 4, 5];
    const careerWins = Math.max(0, Math.floor(Number(saved.careerWins) || 0));
    if (careerWins >= careerStages.length && !unlockedCars.includes(3)) unlockedCars.push(3);
    const upgrades = saved.upgrades && typeof saved.upgrades === 'object' && !Array.isArray(saved.upgrades) ? saved.upgrades : {};
    const savedCredits = Number(saved.credits);
    for (const levels of Object.values(upgrades)) {
      for (const definition of upgradeDefinitions) {
        if (levels && Number.isFinite(levels[definition.id])) levels[definition.id] = THREE.MathUtils.clamp(Math.floor(levels[definition.id]), 0, 3);
      }
    }
    return {
      credits: Number.isFinite(savedCredits) ? Math.max(0, savedCredits) : 1250,
      xp: Number(saved.xp) || 0,
      wins: Number(saved.wins) || 0,
      bestLaps,
      careerWins,
      unlockedCars,
      upgrades
    };
  } catch (error) {
    console.warn('Saved progress could not be loaded:', error);
    return { credits: 1250, xp: 0, wins: 0, bestLaps: {}, careerWins: 0, unlockedCars: [0, 1, 2, 4, 5], upgrades: {} };
  }
}

function getUpgradeLevel(carIndex, upgradeId) {
  const level = state.stats.upgrades[carIndex]?.[upgradeId];
  return Number.isFinite(level) ? THREE.MathUtils.clamp(Math.floor(level), 0, 3) : 0;
}

function getCarStats(carIndex) {
  const car = cars[carIndex];
  const engine = getUpgradeLevel(carIndex, 'engine');
  const handling = getUpgradeLevel(carIndex, 'handling');
  const nitro = getUpgradeLevel(carIndex, 'nitro');
  return {
    ...car,
    speed: car.speed + engine * 4.5,
    accel: car.accel + engine * 3.2,
    grip: car.grip + handling * .12,
    nitro: car.nitro * (1 + nitro * .12),
    nitroDrain: 25 * (1 - nitro * .12)
  };
}

function readSettings() {
  const defaults = { assists: true, steeringSensitivity: 1, touchScale: 1, tapThrottle: false, tutorialSeen: false };
  try {
    const saved = JSON.parse(localStorage.getItem('nitro-x-settings') || '{}');
    return {
      assists: typeof saved.assists === 'boolean' ? saved.assists : defaults.assists,
      steeringSensitivity: Number.isFinite(saved.steeringSensitivity) ? THREE.MathUtils.clamp(saved.steeringSensitivity, .6, 1.4) : defaults.steeringSensitivity,
      touchScale: Number.isFinite(saved.touchScale) ? THREE.MathUtils.clamp(saved.touchScale, .8, 1.3) : defaults.touchScale,
      tapThrottle: Boolean(saved.tapThrottle),
      tutorialSeen: Boolean(saved.tutorialSeen)
    };
  } catch (error) {
    console.warn('Driving settings could not be loaded:', error);
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem('nitro-x-settings', JSON.stringify(state.settings));
  } catch (error) {
    console.warn('Driving settings could not be saved:', error);
    showToast('SETTINGS COULD NOT BE SAVED');
  }
}

function saveProgress() {
  try {
    localStorage.setItem('nitro-x-progress', JSON.stringify(state.stats));
  } catch (error) {
    console.warn('Saved progress could not be written:', error);
    showToast('PROGRESS COULD NOT BE SAVED');
  }
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  sceneRoot.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9db7c1, 260, 1000);
  camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, .1, 1800);
  clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xc9eaff, 0x34362f, 2.15));
  const sun = new THREE.DirectionalLight(0xffe6c6, 3.2);
  sun.position.set(-180, 300, 150);
  scene.add(sun);
  createTrack(0);
  createPlayer();
  buildLobbyOptions();
  bindEvents();
  applySettings();
  updateProgressLabel();
  onResize();
  window.addEventListener('resize', onResize);
  animate();
}

function createTrack(index) {
  state.trackIndex = index;
  const track = tracks[index];
  if (worldGroup) scene.remove(worldGroup);
  obstacles = [];
  worldGroup = new THREE.Group();
  sceneryGroup = new THREE.Group();
  worldGroup.add(sceneryGroup);
  scene.add(worldGroup);
  const points = [];
  const count = index === 2 ? 11 : 13;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    let x, z;
    if (index === 0) {
      x = Math.sin(a) * (194 + 30 * Math.sin(3 * a) + 12 * Math.cos(5 * a));
      z = Math.cos(a) * (145 + 21 * Math.sin(2 * a + .2));
    } else if (index === 1) {
      x = Math.sin(a) * (225 + 45 * Math.sin(2 * a) + 15 * Math.cos(5 * a));
      z = Math.cos(a) * (127 + 27 * Math.sin(3 * a));
    } else {
      x = Math.sin(a) * (178 + 36 * Math.sin(3 * a) + 24 * Math.cos(4 * a));
      z = Math.cos(a) * (180 + 37 * Math.sin(2 * a + .7));
    }
    points.push(new THREE.Vector3(x, 0, z));
  }
  curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', .12);
  trackLength = curve.getLength();
  const groundMaterial = new THREE.MeshStandardMaterial({ color: track.ground, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.72;
  worldGroup.add(ground);
  addRoad();
  addRoadsideObstacles();
  addTrackScenery(track);
  const sky = new THREE.Color(track.sky);
  scene.background = sky;
  scene.fog.color.copy(sky);
  const start = curve.getPointAt(.01);
  const tangent = curve.getTangentAt(.01);
  if (player) placeVehicle(player, start, tangent, -4.1);
  updateMinimap();
}

function addRoad() {
  const segments = 600;
  const roadHalfWidth = 10.2;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const edgeVertices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const left = p.clone().addScaledVector(side, -roadHalfWidth);
    const right = p.clone().addScaledVector(side, roadHalfWidth);
    vertices.push(left.x, .03, left.z, right.x, .03, right.z);
    uvs.push(0, t * 80, 1, t * 80);
    edgeVertices.push({ p, side });
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  worldGroup.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: tracks[state.trackIndex].road, roughness: .88, side: THREE.DoubleSide })));
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe7e6dc, roughness: .8 });
  const edgeGeo = new THREE.BoxGeometry(.2, .035, 2.4);
  for (let i = 0; i < segments; i += 12) {
    const { p, side } = edgeVertices[i];
    for (const sign of [-1, 1]) {
      const stripe = new THREE.Mesh(edgeGeo, edgeMaterial);
      stripe.position.set(p.x + side.x * sign * 9.55, .07, p.z + side.z * sign * 9.55);
      stripe.rotation.y = Math.atan2(-curve.getTangentAt(i / segments).x, -curve.getTangentAt(i / segments).z);
      worldGroup.add(stripe);
    }
  }
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xe7e7d8, roughness: .7, emissive: 0x181816 });
  const dashGeo = new THREE.BoxGeometry(.18, .04, 4.1);
  for (let i = 0; i < segments; i += 25) {
    const p = curve.getPointAt(i / segments);
    const tangent = curve.getTangentAt(i / segments);
    const dash = new THREE.Mesh(dashGeo, dashMaterial);
    dash.position.set(p.x, .085, p.z);
    dash.rotation.y = Math.atan2(-tangent.x, -tangent.z);
    worldGroup.add(dash);
  }
  addBarrier(edgeVertices, segments, roadHalfWidth + 2.4, .45, 0xd8d9d4);
  addBarrier(edgeVertices, segments, roadHalfWidth + 2.4, 1.08, 0x35434a);
  createStartLine();
}

function addBarrier(samples, segments, offset, height, color) {
  const pointsLeft = [], pointsRight = [];
  for (let i = 0; i <= segments; i += 3) {
    const { p, side } = samples[i];
    pointsLeft.push(new THREE.Vector3(p.x - side.x * offset, height, p.z - side.z * offset));
    pointsRight.push(new THREE.Vector3(p.x + side.x * offset, height, p.z + side.z * offset));
  }
  for (const points of [pointsLeft, pointsRight]) {
    points.push(points[0].clone());
    const railCurve = new THREE.CatmullRomCurve3(points, true);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 850, height > 1 ? .11 : .48, 5, true), new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .32 }));
    worldGroup.add(rail);
  }
}

function createStartLine() {
  const p = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0);
  const line = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1.7, .07, 1.5);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const dark = new THREE.MeshStandardMaterial({ color: 0x13181b });
  for (let x = -5; x < 6; x++) for (let z = 0; z < 2; z++) {
    const tile = new THREE.Mesh(boxGeo, (x + z) % 2 ? dark : white);
    tile.position.set(x * 1.65, .12, z * 1.5);
    line.add(tile);
  }
  line.position.copy(p);
  line.rotation.y = Math.atan2(-tangent.x, -tangent.z);
  worldGroup.add(line);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x202c32, metalness: .5, roughness: .4 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x10191e, emissive: 0x08738f, emissiveIntensity: 1.3 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.45, 6, .45), postMat);
    post.position.set(p.x + tangent.z * side * 13, 3, p.z - tangent.x * side * 13);
    worldGroup.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(27, .7, .8), signMat);
  beam.position.set(p.x, 5.3, p.z);
  beam.rotation.y = Math.atan2(-tangent.x, -tangent.z);
  worldGroup.add(beam);
}

function addRoadsideObstacles() {
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: .8 });
  const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff783b, roughness: .5, emissive: 0x68220b, emissiveIntensity: .35 });
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xf6eee0, roughness: .45 });
  for (const t of [.16, .36, .58, .81]) {
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    for (const direction of [-1, 1]) {
      const position = point.clone().addScaledVector(side, direction * 7.7);
      const cone = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.68, .68, .18, 8), baseMaterial);
      base.position.y = .12;
      cone.add(base);
      const body = new THREE.Mesh(new THREE.ConeGeometry(.48, 1.25, 8), coneMaterial);
      body.position.y = .8;
      cone.add(body);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(.33, .42, .16, 8), stripeMaterial);
      stripe.position.y = .77;
      cone.add(stripe);
      cone.position.copy(position);
      worldGroup.add(cone);
      obstacles.push(position);
    }
  }
}

function addTrackScenery(track) {
  let seed = 9521 + state.trackIndex * 1193;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const roadPos = [];
  for (let i = 0; i < 180; i++) roadPos.push(curve.getPointAt(i / 180));
  const candidates = track.buildings ? 130 : 150;
  let windowInstances = null;
  if (track.buildings) {
    windowInstances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(.95, 1.25, .08),
      new THREE.MeshStandardMaterial({ color: 0x92d8e6, emissive: 0x203c46, emissiveIntensity: .65, metalness: .2, roughness: .35 }),
      5000
    );
    windowInstances.count = 0;
    sceneryGroup.add(windowInstances);
  }
  const windowPose = new THREE.Object3D();
  let windowCount = 0;
  for (let i = 0; i < candidates; i++) {
    const x = (random() - .5) * 950;
    const z = (random() - .5) * 850;
    let near = Infinity;
    for (let j = 0; j < roadPos.length; j += 3) near = Math.min(near, roadPos[j].distanceTo(new THREE.Vector3(x, 0, z)));
    if (near < 32) continue;
    if (track.buildings && random() > .83) windowCount = addBuilding(x, z, random, windowInstances, windowPose, windowCount);
    else if (!track.buildings && random() > .25) addTree(x, z, track, random);
    else addRock(x, z, track, random);
  }
  if (windowInstances) {
    windowInstances.count = windowCount;
    windowInstances.instanceMatrix.needsUpdate = true;
  }
  if (state.trackIndex === 0) {
    for (let i = 0; i < 34; i++) {
      const t = i / 34;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      for (const side of [-1, 1]) {
        const pole = new THREE.Group();
        const x = p.x + tan.z * side * 16;
        const z = p.z - tan.x * side * 16;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, 8, 7), new THREE.MeshStandardMaterial({ color: 0x26323a, metalness: .55 }));
        stem.position.y = 4;
        pole.add(stem);
        const light = new THREE.Mesh(new THREE.BoxGeometry(1.4, .22, .42), new THREE.MeshStandardMaterial({ color: 0xc9f3ff, emissive: 0x66ccff, emissiveIntensity: 2 }));
        light.position.set(-side * .7, 7.7, 0);
        pole.add(light);
        pole.position.set(x, 0, z);
        sceneryGroup.add(pole);
      }
    }
  }
}

function addBuilding(x, z, random, windowInstances, pose, windowCount) {
  const width = 8 + random() * 18, depth = 8 + random() * 17, height = 16 + random() * 68;
  const colors = [0x3c4b54, 0x52616a, 0x313d49, 0x64645f, 0x415766];
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: colors[Math.floor(random() * colors.length)], roughness: .82, metalness: .16 }));
  body.position.y = height / 2 - .7;
  group.add(body);
  const rows = Math.floor(height / 5);
  const rotation = random() * Math.PI;
  const sin = Math.sin(rotation), cos = Math.cos(rotation);
  for (let row = 0; row < rows; row++) for (let col = 0; col < Math.max(2, Math.floor(width / 3)); col++) {
    const localX = -width / 2 + 1.7 + col * 2.6, localZ = depth / 2 + .05;
    pose.position.set(x + localX * cos + localZ * sin, 2.5 + row * 4.5, z - localX * sin + localZ * cos);
    pose.rotation.set(0, rotation, 0);
    pose.scale.set(1, 1, 1);
    pose.updateMatrix();
    windowInstances.setMatrixAt(windowCount++, pose.matrix);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  sceneryGroup.add(group);
  return windowCount;
}

function addTree(x, z, track, random) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.3, .52, 4.5, 6), new THREE.MeshStandardMaterial({ color: track.shape === 1 ? 0x785533 : 0x554435 }));
  trunk.position.y = 2.25;
  group.add(trunk);
  const color = track.shape === 1 ? 0x718747 : [0x376b46, 0x3d7950, 0x527b45][Math.floor(random() * 3)];
  for (let tier = 0; tier < 3; tier++) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2 - tier * .48, 5, 7), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    crown.position.y = 4 + tier * 2.3;
    group.add(crown);
  }
  group.scale.setScalar(.8 + random() * .8);
  group.position.set(x, 0, z);
  sceneryGroup.add(group);
}

function addRock(x, z, track, random) {
  const colors = track.shape === 1 ? [0xa28661, 0x8c785f] : [0x68706d, 0x777b76, 0x555f60];
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + random() * 3, 0), new THREE.MeshStandardMaterial({ color: colors[Math.floor(random() * colors.length)], roughness: 1 }));
  rock.scale.y = .55 + random() * .6;
  rock.position.set(x, .8, z);
  sceneryGroup.add(rock);
}

function makeCarModel(carData, colorOverride) {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorOverride ?? carData.color, metalness: .62, roughness: .25 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x111820, metalness: .48, roughness: .28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x122431, metalness: .55, roughness: .15 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: .91 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xb9c4c9, metalness: .85, roughness: .2 });
  const headlight = new THREE.MeshStandardMaterial({ color: 0xe8f7ff, emissive: 0xc9edff, emissiveIntensity: 1.5 });
  const tailLight = new THREE.MeshStandardMaterial({ color: 0xff2825, emissive: 0xd71914, emissiveIntensity: 1.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, .66, 4.35), paint);
  body.position.y = .68;
  root.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, .22, 1.15), paint);
  hood.position.set(0, 1.08, -1.26);
  root.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, .68, 1.8), darkPaint);
  cabin.position.set(0, 1.25, .03);
  root.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.46, .48, .07), glass);
  windshield.position.set(0, 1.44, -.62);
  windshield.rotation.x = -.3;
  root.add(windshield);
  const rearWindow = windshield.clone();
  rearWindow.position.z = .68;
  rearWindow.rotation.x = .3;
  root.add(rearWindow);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.75, .2, .22), darkPaint);
  nose.position.set(0, .47, -2.05);
  root.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, .22, .25), darkPaint);
  bumper.position.set(0, .46, 2.08);
  root.add(bumper);
  for (const x of [-.72, .72]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.42, .16, .08), headlight);
    lamp.position.set(x, .84, -2.19);
    root.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.42, .16, .08), tailLight);
    tail.position.set(x, .83, 2.19);
    root.add(tail);
  }
  const wheels = [];
  for (const x of [-1.04, 1.04]) for (const z of [-1.38, 1.43]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .32, 18), rubber);
    tire.rotation.z = Math.PI / 2;
    wheel.add(tire);
    const wheelRim = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .34, 12), rim);
    wheelRim.rotation.z = Math.PI / 2;
    wheel.add(wheelRim);
    wheel.position.set(x, .49, z);
    root.add(wheel);
    wheels.push(wheel);
  }
  const spoiler = new THREE.Group();
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, .12, .48), paint);
  wing.position.y = 1.52;
  spoiler.add(wing);
  for (const x of [-.57, .57]) {
    const stem = new THREE.Mesh(new THREE.BoxGeometry(.1, .48, .1), darkPaint);
    stem.position.set(x, 1.3, 1.5);
    spoiler.add(stem);
  }
  root.add(spoiler);
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x28d9ff, transparent: true, opacity: .8 });
  const flames = [];
  for (const x of [-.55, .55]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.18, 1.1, 8), flameMaterial);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, .48, 2.72);
    flame.visible = false;
    root.add(flame);
    flames.push(flame);
  }
  return { root, wheels, flames };
}

function makeVehicle(data, colorOverride, isPlayer = false) {
  const model = makeCarModel(data, colorOverride);
  scene.add(model.root);
  return {
    ...model, data, isPlayer, speed: 0, lateral: 0, yaw: 0, t: 0, previousT: 0,
    laps: 0, progress: 0, lane: 0, finished: false, color: colorOverride ?? data.color
  };
}

function createPlayer() {
  selectedVehicle = getCarStats(state.carIndex);
  player = makeVehicle(selectedVehicle, paintColors[state.paintIndex], true);
  placeVehicle(player, curve.getPointAt(.01), curve.getTangentAt(.01), -4.1);
}

function placeVehicle(vehicle, point, tangent, lane) {
  vehicle.root.position.copy(point);
  const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  vehicle.root.position.addScaledVector(side, lane);
  vehicle.t = projectToTrack(point, vehicle.t).t;
  vehicle.yaw = Math.atan2(-tangent.x, -tangent.z);
  vehicle.root.rotation.y = vehicle.yaw;
}

function currentCareerStage() {
  return careerStages[Math.min(state.stats.careerWins, careerStages.length - 1)];
}

function renderCareerProgress() {
  const wins = Math.min(state.stats.careerWins, careerStages.length);
  const unlocked = state.stats.unlockedCars.includes(3);
  const nextStage = currentCareerStage();
  ui.careerStage.textContent = wins === careerStages.length ? 'SERIES COMPLETE · ALPINE APEX' : `${String(wins + 1).padStart(2, '0')} · ${nextStage.title}`;
  ui.careerFill.style.width = `${wins / careerStages.length * 100}%`;
  ui.careerCount.textContent = unlocked
    ? `${wins} / 3 WINS · APEX RS UNLOCKED`
    : `${wins} / 3 WINS · APEX RS LOCKED`;
  ui.careerProgress.classList.toggle('complete', unlocked);
}

function prepareCareerStage() {
  const stage = currentCareerStage();
  state.trackIndex = stage.track;
  state.difficulty = stage.difficulty;
  $('#difficulty').value = stage.difficulty;
  [...ui.trackOptions.children].forEach((button, index) => button.classList.toggle('active', index === stage.track));
  createTrack(stage.track);
  renderCareerProgress();
}

function renderUpgrades() {
  if (!ui.upgradeOptions) return;
  const owned = state.stats.unlockedCars.includes(state.carIndex);
  const levels = state.stats.upgrades[state.carIndex] ?? {};
  $('#upgrade-car-name').textContent = cars[state.carIndex].name;
  ui.upgradeOptions.innerHTML = '';
  for (const definition of upgradeDefinitions) {
    const level = levels[definition.id] ?? 0;
    const cost = definition.costs[level];
    const button = document.createElement('button');
    button.className = 'upgrade-card';
    button.disabled = !owned || level >= definition.costs.length || state.stats.credits < cost;
    button.innerHTML = `<span class="upgrade-name">${definition.name} <i>${level} / 3</i></span><small>${definition.stat}</small><span class="upgrade-action">${level >= 3 ? 'MAX LEVEL' : `UPGRADE · ◈ ${cost} CR`}</span>`;
    button.addEventListener('click', () => purchaseUpgrade(definition));
    ui.upgradeOptions.appendChild(button);
  }
}

function purchaseUpgrade(definition) {
  if (!state.stats.unlockedCars.includes(state.carIndex)) {
    showToast('UNLOCK THIS CAR BEFORE UPGRADING');
    return;
  }
  const level = getUpgradeLevel(state.carIndex, definition.id);
  if (level >= definition.costs.length) return showToast(`${definition.name} MAXED OUT`);
  const cost = definition.costs[level];
  if (state.stats.credits < cost) return showToast(`NEED ${cost - state.stats.credits} MORE CREDITS`);
  state.stats.credits -= cost;
  state.stats.upgrades[state.carIndex] ??= {};
  state.stats.upgrades[state.carIndex][definition.id] = level + 1;
  selectedVehicle = getCarStats(state.carIndex);
  replacePlayerModel();
  saveProgress();
  renderUpgrades();
  updateProgressLabel();
  showToast(`${definition.name} UPGRADED · LVL ${level + 1}`);
}

function buildLobbyOptions() {
  ui.trackOptions.innerHTML = '';
  tracks.forEach((track, i) => {
    const button = document.createElement('button');
    button.className = `track-choice${i === state.trackIndex ? ' active' : ''}`;
    button.innerHTML = `<span><span class="track-index">0${i + 1}</span>${track.name}</span><small>${track.label}</small>`;
    button.addEventListener('click', () => {
      if (state.mode === 'career') return;
      state.trackIndex = i;
      [...ui.trackOptions.children].forEach((el, j) => el.classList.toggle('active', i === j));
      createTrack(i);
      if (rivals.length) {
        rivals.forEach((r) => scene.remove(r.root));
        rivals = [];
      }
    });
    ui.trackOptions.appendChild(button);
  });
  ui.carOptions.innerHTML = '';
  cars.forEach((car, i) => {
    const button = document.createElement('button');
    const locked = !state.stats.unlockedCars.includes(i);
    button.className = `car-choice${i === state.carIndex ? ' active' : ''}${locked ? ' locked' : ''}`;
    button.disabled = locked;
    button.innerHTML = `<i class="car-chip" style="background:#${car.color.toString(16).padStart(6, '0')}"></i><span>${car.name}</span><small>${locked ? '3 CAREER WINS' : car.type}</small>`;
    button.addEventListener('click', () => {
      if (locked) return showToast('WIN 3 CAREER EVENTS TO UNLOCK');
      selectCar(i);
    });
    ui.carOptions.appendChild(button);
  });
  ui.swatches.innerHTML = '';
  paintColors.forEach((color, i) => {
    const swatch = document.createElement('button');
    swatch.className = `swatch${i === state.paintIndex ? ' active' : ''}`;
    swatch.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
    swatch.setAttribute('aria-label', `Paint color ${i + 1}`);
    swatch.addEventListener('click', () => {
      state.paintIndex = i;
      [...ui.swatches.children].forEach((el, j) => el.classList.toggle('active', j === i));
      replacePlayerModel();
      renderUpgrades();
    });
    ui.swatches.appendChild(swatch);
  });
  ui.modeButtons.forEach((button) => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    if (state.mode === 'career') prepareCareerStage();
    ui.modeButtons.forEach((el) => el.classList.toggle('active', el === button));
    ui.careerProgress.classList.toggle('active', state.mode === 'career');
  }));
  renderCareerProgress();
  renderUpgrades();
}

function selectCar(index) {
  if (!state.stats.unlockedCars.includes(index)) return showToast('CAR LOCKED — WIN CAREER EVENTS');
  state.carIndex = index;
  state.paintIndex = index;
  selectedVehicle = getCarStats(index);
  [...ui.carOptions.children].forEach((el, j) => el.classList.toggle('active', j === index));
  [...ui.swatches.children].forEach((el, j) => el.classList.toggle('active', j === index));
  replacePlayerModel();
  renderUpgrades();
}

function replacePlayerModel() {
  const position = player?.root.position.clone();
  const yaw = player?.yaw ?? 0;
  const speed = player?.speed ?? 0;
  if (player) scene.remove(player.root);
  player = makeVehicle(getCarStats(state.carIndex), paintColors[state.paintIndex], true);
  if (position) {
    player.root.position.copy(position);
    player.yaw = yaw;
    player.speed = speed;
    player.root.rotation.y = yaw;
  }
  selectedVehicle = getCarStats(state.carIndex);
}

function bindEvents() {
  ui.start.addEventListener('click', startRace);
  $('#camera-button').addEventListener('click', cycleCamera);
  $('#sound-button').addEventListener('click', toggleSound);
  $('#pause-button').addEventListener('click', togglePause);
  $('#resume-button').addEventListener('click', togglePause);
  $('#pause-garage-button').addEventListener('click', returnToGarage);
  $('#again-button').addEventListener('click', startRace);
  $('#garage-button').addEventListener('click', returnToGarage);
  $('#tutorial-button').addEventListener('click', startTutorialRace);
  $('#tutorial-skip').addEventListener('click', finishTutorial);
  $('#difficulty').addEventListener('change', (event) => { state.difficulty = event.target.value; });
  ui.assistToggle.addEventListener('change', () => {
    state.settings.assists = ui.assistToggle.checked;
    saveSettings();
  });
  ui.sensitivity.addEventListener('input', () => {
    state.settings.steeringSensitivity = Number(ui.sensitivity.value) / 100;
    applySettings();
    saveSettings();
  });
  ui.touchSize.addEventListener('input', () => {
    state.settings.touchScale = Number(ui.touchSize.value) / 100;
    applySettings();
    saveSettings();
  });
  ui.throttle.addEventListener('change', () => {
    state.settings.tapThrottle = ui.throttle.value === 'toggle';
    state.accelerateLatch = false;
    saveSettings();
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    heldKeys.add(key);
    if (key === 'c' && !event.repeat) cycleCamera();
    if (key === 'escape' && state.active && !event.repeat) togglePause();
  });
  window.addEventListener('keyup', (event) => heldKeys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => {
    heldKeys.clear();
    state.accelerateLatch = false;
    $('#touch-accelerate').classList.remove('latched');
  });
  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    const down = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      if (control === 'accelerate' && state.settings.tapThrottle) {
        state.accelerateLatch = !state.accelerateLatch;
        button.classList.toggle('latched', state.accelerateLatch);
      } else heldKeys.add(`touch-${control}`);
    };
    const up = () => {
      if (!(control === 'accelerate' && state.settings.tapThrottle)) heldKeys.delete(`touch-${control}`);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  });
}

function applySettings() {
  ui.assistToggle.checked = state.settings.assists;
  ui.sensitivity.value = String(Math.round(state.settings.steeringSensitivity * 100));
  ui.sensitivityValue.value = `${ui.sensitivity.value}%`;
  ui.touchSize.value = String(Math.round(state.settings.touchScale * 100));
  ui.touchSizeValue.value = `${ui.touchSize.value}%`;
  ui.throttle.value = state.settings.tapThrottle ? 'toggle' : 'hold';
  document.documentElement.style.setProperty('--touch-scale', String(state.settings.touchScale));
}

function getInput() {
  const gamepads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gamepad = gamepads[0];
  const axes = gamepad?.axes ?? [];
  const buttons = gamepad?.buttons ?? [];
  const keyboardLeft = heldKeys.has('a') || heldKeys.has('arrowleft') || heldKeys.has('touch-left');
  const keyboardRight = heldKeys.has('d') || heldKeys.has('arrowright') || heldKeys.has('touch-right');
  const stick = Math.abs(axes[0] ?? 0) > .16 ? axes[0] : 0;
  const keyboardAccelerate = heldKeys.has('w') || heldKeys.has('arrowup') || heldKeys.has('touch-accelerate') || state.accelerateLatch;
  const gamepadAccelerate = (buttons[7]?.value ?? 0) > .15 || (buttons[0]?.pressed ?? false);
  const gamepadBrake = (buttons[6]?.value ?? 0) > .15 || (buttons[1]?.pressed ?? false);
  return {
    steer: THREE.MathUtils.clamp((keyboardRight ? 1 : 0) - (keyboardLeft ? 1 : 0) + stick, -1, 1),
    accelerate: keyboardAccelerate || gamepadAccelerate,
    braking: heldKeys.has('s') || heldKeys.has('arrowdown') || heldKeys.has('touch-brake') || gamepadBrake,
    drifting: heldKeys.has(' ') || heldKeys.has('touch-drift') || (buttons[4]?.pressed ?? false),
    nitro: heldKeys.has('shift') || heldKeys.has('touch-nitro') || (buttons[2]?.pressed ?? false) || (buttons[5]?.pressed ?? false)
  };
}

function startTutorialRace() {
  state.mode = 'race';
  ui.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === 'race'));
  state.tutorialPending = true;
  startRace();
}

function updateTutorialPrompt() {
  const steps = [
    ['GET MOVING', 'Hold W or the GO button to accelerate.'],
    ['STEER THROUGH THE COURSE', 'Try A / D, the arrow keys, or the on-screen arrows.'],
    ['SLOW DOWN', 'Tap S or BRAKE before a tight turn.'],
    ['TRY A DRIFT', 'Hold Space or DRIFT while you are moving.'],
    ['LIGHT THE NITRO', 'Hold Shift or N₂O to boost once you are up to speed.']
  ];
  const step = steps[state.tutorialStep];
  if (!step) return finishTutorial();
  ui.tutorialProgress.textContent = `${String(state.tutorialStep + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
  ui.tutorialTitle.textContent = step[0];
  ui.tutorialCopy.textContent = step[1];
  ui.tutorialCard.classList.remove('hidden');
}

function advanceTutorial(input) {
  const conditions = [
    input.accelerate && Math.abs(player.speed) > 8,
    Math.abs(input.steer) > .1 && Math.abs(player.speed) > 8,
    input.braking,
    input.drifting && Math.abs(player.speed) > 10,
    input.nitro && state.boost < 99.9
  ];
  if (conditions[state.tutorialStep]) {
    state.tutorialStep++;
    if (state.tutorialStep >= conditions.length) finishTutorial();
    else updateTutorialPrompt();
  }
}

function finishTutorial() {
  state.tutorialActive = false;
  state.tutorialPending = false;
  state.settings.tutorialSeen = true;
  saveSettings();
  ui.tutorialCard.classList.add('hidden');
  showToast('DRIVING SCHOOL COMPLETE');
}

function togglePause() {
  if (!state.active) return;
  state.paused = !state.paused;
  state.accelerateLatch = false;
  heldKeys.clear();
  $('#touch-accelerate').classList.remove('latched');
  ui.pauseScreen.classList.toggle('hidden', !state.paused);
  if (state.paused) stopEngineSound();
  else if (state.sound) startEngineSound();
}

function startRace() {
  if (state.mode === 'career') {
    prepareCareerStage();
    state.careerStageIndex = Math.min(state.stats.careerWins, careerStages.length - 1);
  }
  state.active = true;
  state.paused = false;
  state.finished = false;
  state.elapsed = 0;
  state.lapStartTime = 0;
  state.lastLapRecordAt = -Infinity;
  state.lap = 0;
  state.lastT = .01;
  state.playerProgress = .01;
  state.boost = 100;
  state.driftScore = 0;
  state.driftChain = 1;
  state.countdown = 3.2;
  state.toastTime = 0;
  state.accelerateLatch = false;
  $('#touch-accelerate').classList.remove('latched');
  state.tutorialActive = state.tutorialPending || (!state.settings.tutorialSeen && state.mode === 'race');
  state.tutorialPending = false;
  state.tutorialStep = 0;
  player.speed = 0;
  player.lateral = 0;
  selectedVehicle = getCarStats(state.carIndex);
  placeVehicle(player, curve.getPointAt(.01), curve.getTangentAt(.01), -4.1);
  if (rivals.length) rivals.forEach((r) => scene.remove(r.root));
  rivals = [];
  if (!['time', 'drift', 'free'].includes(state.mode)) {
    const pace = difficulty[state.difficulty] ?? .94;
    for (let i = 0; i < 3; i++) {
      const data = cars[(state.carIndex + i + 1) % cars.length];
      const rival = makeVehicle(data, data.color, false);
      rival.t = .008 - i * .003;
      rival.previousT = rival.t;
      rival.progress = rival.t;
      rival.lane = [4.1, -1.2, 1.3][i];
      rival.aiPace = pace * (1 + (i - 1) * .035);
      rival.speed = 37 + i * 1.2;
      placeVehicle(rival, curve.getPointAt(rival.t), curve.getTangentAt(rival.t), rival.lane);
      rivals.push(rival);
    }
  }
  ui.lobby.classList.add('hidden');
  ui.result.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.pauseScreen.classList.add('hidden');
  if (state.tutorialActive) updateTutorialPrompt();
  else ui.tutorialCard.classList.add('hidden');
  ui.drift.classList.toggle('hidden', state.mode !== 'drift');
  ui.timerBlock.classList.toggle('hidden', state.mode === 'free');
  $('#hud-track').textContent = tracks[state.trackIndex].name;
  $('#hud-mode').textContent = ({ race: 'QUICK RACE', time: 'TIME TRIAL', drift: 'DRIFT ATTACK', free: 'FREE DRIVE', career: 'CAREER LADDER' })[state.mode];
  ui.opponentCount.textContent = String(rivals.length + 1);
  ui.lap.innerHTML = state.mode === 'free' || state.mode === 'drift' ? '—<span> / ∞</span>' : '1<span> / 3</span>';
  ui.position.textContent = '1';
  ui.status.textContent = 'GET READY';
  updateMinimap();
  clock.getDelta();
  if (state.sound) startEngineSound();
}

function returnToGarage() {
  state.active = false;
  state.paused = false;
  state.tutorialActive = false;
  heldKeys.clear();
  state.accelerateLatch = false;
  $('#touch-accelerate').classList.remove('latched');
  ui.hud.classList.add('hidden');
  ui.result.classList.add('hidden');
  ui.pauseScreen.classList.add('hidden');
  ui.tutorialCard.classList.add('hidden');
  ui.lobby.classList.remove('hidden');
  if (rivals.length) {
    rivals.forEach((r) => scene.remove(r.root));
    rivals = [];
  }
  player.speed = 0;
  createTrack(state.trackIndex);
  placeVehicle(player, curve.getPointAt(.01), curve.getTangentAt(.01), -4.1);
  stopEngineSound();
}

function updatePlayer(dt) {
  const input = getInput();
  const car = player;
  const maxSpeed = selectedVehicle.speed;
  const boosting = input.nitro && state.boost > 0 && car.speed > 5 && state.mode !== 'free';
  if (state.countdown > 0) return;
  if (input.accelerate) car.speed += selectedVehicle.accel * dt;
  if (input.braking) {
    if (car.speed > 1.2) car.speed -= 66 * dt;
    else car.speed -= 25 * dt;
  }
  if (boosting) {
    car.speed += 32 * selectedVehicle.nitro * dt;
    state.boost = Math.max(0, state.boost - (selectedVehicle.nitroDrain ?? 25) * dt);
  } else {
    state.boost = Math.min(100, state.boost + 5.4 * dt);
  }
  if (!input.accelerate && !input.braking) car.speed *= Math.exp(-.32 * dt);
  if (car.speed < -18) car.speed = -18;
  const speedLimit = maxSpeed + (boosting ? 19 : 0);
  if (car.speed > speedLimit) car.speed = speedLimit;
  const speedRatio = Math.min(1, Math.abs(car.speed) / Math.max(25, maxSpeed * .78));
  const reverseSign = car.speed < -1 ? -1 : 1;
  const steerRate = (1.05 + speedRatio * .95) * selectedVehicle.grip * (input.drifting ? 1.28 : 1);
  const steeringInput = input.steer * state.settings.steeringSensitivity;
  const beforeMove = projectToTrack(car.root.position, car.t);
  car.t = beforeMove.t;
  const lookAhead = Math.max(10, Math.abs(car.speed) * .28);
  const targetT = (beforeMove.t + lookAhead / trackLength) % 1;
  const targetPoint = curve.getPointAt(targetT);
  const targetYaw = Math.atan2(-(targetPoint.x - car.root.position.x), -(targetPoint.z - car.root.position.z)) + (reverseSign < 0 ? Math.PI : 0);
  const yawError = Math.atan2(Math.sin(targetYaw - car.yaw), Math.cos(targetYaw - car.yaw));
  const steeringAssist = state.settings.assists ? 2.2 : .55;
  car.yaw += THREE.MathUtils.clamp(yawError * steeringAssist, state.settings.assists ? -1.35 : -.55, state.settings.assists ? 1.35 : .55) * dt;
  car.yaw -= steeringInput * steerRate * dt * reverseSign;
  if (state.settings.assists && !input.drifting && car.speed > 0) {
    const futureTangent = curve.getTangentAt((beforeMove.t + .025) % 1);
    const currentTangent = curve.getTangentAt(beforeMove.t);
    const bend = Math.acos(THREE.MathUtils.clamp(futureTangent.dot(currentTangent), -1, 1));
    const cornerSpeed = maxSpeed / (1 + bend * .55);
    if (car.speed > cornerSpeed && !boosting) car.speed = THREE.MathUtils.damp(car.speed, cornerSpeed, 2, dt);
  }
  tmpForward.set(-Math.sin(car.yaw), 0, -Math.cos(car.yaw));
  tmpSide.set(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
  car.lateral += steeringInput * car.speed * .105 * dt;
  car.lateral *= Math.exp(-(input.drifting ? 1.45 : (state.settings.assists ? 10.2 : 6.4) * selectedVehicle.grip) * dt);
  car.root.position.addScaledVector(tmpForward, car.speed * dt);
  car.root.position.addScaledVector(tmpSide, car.lateral * dt);
  const nearest = projectToTrack(car.root.position, car.t);
  car.t = nearest.t;
  const edge = Math.max(0, nearest.distance - 10.4);
  if (edge > 0) {
    car.speed *= Math.exp(-Math.min(state.settings.assists ? 3.5 : 1.2, edge * (state.settings.assists ? .13 : .055)) * dt);
    const tangent = curve.getTangentAt(nearest.t);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const signed = Math.sign(new THREE.Vector3().subVectors(car.root.position, curve.getPointAt(nearest.t)).dot(side));
    car.root.position.addScaledVector(side, -signed * Math.min(edge, 5.5) * (state.settings.assists ? .34 : .12) * dt);
  }
  car.root.position.y = .06 + Math.sin(state.elapsed * 16) * Math.min(.035, speedRatio * .035);
  car.root.rotation.y = car.yaw;
  car.root.rotation.z = THREE.MathUtils.damp(car.root.rotation.z, -steeringInput * car.lateral * .004, 5, dt);
  car.wheels.forEach((wheel, i) => {
    wheel.rotation.x -= car.speed * dt * 1.7;
    if (i < 2) wheel.rotation.y = steeringInput * .22;
  });
  car.flames.forEach((flame, i) => {
    flame.visible = boosting;
    if (boosting) {
      flame.scale.setScalar(.7 + Math.random() * .8);
      flame.material.color.setHex(i ? 0x70efff : 0x189cff);
    }
  });
  if (state.mode === 'drift' && input.drifting && Math.abs(car.speed) > 24 && Math.abs(car.lateral) > 1.7) {
    state.driftScore += Math.abs(car.lateral) * Math.abs(car.speed) * dt * 1.35;
    state.driftChain = Math.min(9, state.driftChain + dt * .12);
    ui.drift.querySelector('strong').textContent = Math.floor(state.driftScore).toLocaleString();
    ui.drift.querySelector('span').textContent = `CHAIN x${state.driftChain.toFixed(1)}`;
  } else if (state.mode === 'drift' && state.driftChain > 1) state.driftChain = 1;
  if (state.mode !== 'free' && state.mode !== 'drift') updatePlayerLap(nearest.t);
  if (state.tutorialActive) advanceTutorial(input);
  if (state.mode === 'drift' && state.elapsed >= 90) finishRace(false);
  if (state.mode === 'free' && state.elapsed > 0 && Math.floor(state.elapsed) % 32 === 0 && state.toastTime <= 0) {
    state.toastTime = .8;
    showToast('OPEN ROAD');
  }
}

function projectToTrack(position, hint = 0) {
  let bestT = hint, bestDistance = Infinity;
  const samples = 180, windowSize = .16;
  for (let i = -samples / 2; i <= samples / 2; i++) {
    let t = (hint + i / samples * windowSize) % 1;
    if (t < 0) t += 1;
    const p = curve.getPointAt(t);
    const d = (p.x - position.x) ** 2 + (p.z - position.z) ** 2;
    if (d < bestDistance) { bestDistance = d; bestT = t; }
  }
  return { t: bestT, distance: Math.sqrt(bestDistance) };
}

function updatePlayerLap(t) {
  if (state.lastT > .88 && t < .12) {
    state.lap++;
    const lapTime = state.elapsed - state.lapStartTime;
    state.lapStartTime = state.elapsed;
    if (state.mode === 'time') {
      const previousBest = state.stats.bestLaps[state.trackIndex];
      if (!previousBest || lapTime < previousBest) {
        state.stats.bestLaps[state.trackIndex] = lapTime;
        state.lastLapRecordAt = state.elapsed;
        saveProgress();
        showToast(`NEW LAP RECORD · ${formatTime(lapTime)}`);
      } else {
        showToast(`LAP ${state.lap} · ${formatTime(lapTime)}`);
      }
    } else showToast(`LAP ${state.lap} COMPLETE`);
    if (state.lap >= 3) finishRace(true);
  }
  state.lastT = t;
  state.playerProgress = state.lap + t;
  const lapShown = Math.min(3, state.lap + 1);
  ui.lap.innerHTML = `${lapShown}<span> / 3</span>`;
  ui.lapFill.style.width = `${Math.max(0, t * 100)}%`;
}

function updateRivals(dt) {
  for (const rival of rivals) {
    if (state.countdown > 0 || rival.finished) continue;
    const targetSpeed = (43 + 8 * Math.sin(state.elapsed * .21 + rival.lane) + selectedVehicle.speed * .18) * rival.aiPace;
    rival.speed = THREE.MathUtils.damp(rival.speed, targetSpeed, .58, dt);
    rival.t = (rival.t + rival.speed * dt / trackLength) % 1;
    rival.progress += rival.speed * dt / trackLength;
    const point = curve.getPointAt(rival.t);
    const tangent = curve.getTangentAt(rival.t);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    rival.root.position.copy(point).addScaledVector(side, rival.lane);
    rival.root.position.y = .04 + Math.sin(state.elapsed * 15 + rival.lane) * .02;
    rival.yaw = Math.atan2(-tangent.x, -tangent.z);
    rival.root.rotation.y = rival.yaw;
    rival.wheels.forEach((wheel) => { wheel.rotation.x -= rival.speed * dt * 1.7; });
  }
}

function resolveCollisions(dt) {
  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
  for (const rival of rivals) {
    const dx = player.root.position.x - rival.root.position.x;
    const dz = player.root.position.z - rival.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 3.15) {
      const normalX = distance > .001 ? dx / distance : -Math.sin(player.yaw);
      const normalZ = distance > .001 ? dz / distance : -Math.cos(player.yaw);
      player.root.position.x += normalX * (3.3 - distance);
      player.root.position.z += normalZ * (3.3 - distance);
      player.speed *= .78;
      player.lateral *= .6;
      if (state.collisionCooldown === 0) {
        showToast('CONTACT!');
        state.collisionCooldown = .8;
      }
    }
  }
  for (const obstacle of obstacles) {
    const dx = player.root.position.x - obstacle.x;
    const dz = player.root.position.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1.65) {
      const normalX = distance > .001 ? dx / distance : -Math.sin(player.yaw);
      const normalZ = distance > .001 ? dz / distance : -Math.cos(player.yaw);
      player.root.position.x += normalX * (1.8 - distance);
      player.root.position.z += normalZ * (1.8 - distance);
      player.speed *= .72;
      if (state.collisionCooldown === 0) {
        showToast('CONE HIT');
        state.collisionCooldown = .8;
      }
    }
  }
}

function finishRace(completedLaps) {
  if (state.finished) return;
  state.finished = true;
  state.active = false;
  state.paused = false;
  stopEngineSound();
  const ranking = [{ vehicle: player, progress: state.playerProgress }, ...rivals.map((r) => ({ vehicle: r, progress: r.progress }))].sort((a, b) => b.progress - a.progress);
  const place = ranking.findIndex((entry) => entry.vehicle === player) + 1;
  const won = place === 1 && completedLaps;
  const careerWin = state.mode === 'career' && won;
  const careerStage = careerStages[state.careerStageIndex ?? Math.min(state.stats.careerWins, careerStages.length - 1)];
  const reward = careerWin ? careerStage.reward : won ? 350 : completedLaps ? 160 : 90;
  const xp = won ? 120 : completedLaps ? 75 : 40;
  state.stats.credits += reward;
  state.stats.xp += xp;
  if (won) state.stats.wins++;
  if (careerWin) {
    state.stats.careerWins = Math.min(careerStages.length, state.stats.careerWins + 1);
    if (state.stats.careerWins >= careerStages.length && !state.stats.unlockedCars.includes(3)) {
      state.stats.unlockedCars.push(3);
    }
  }
  saveProgress();
  updateProgressLabel();
  renderCareerProgress();
  renderUpgrades();
  const apexButton = ui.carOptions.children[3];
  if (apexButton && state.stats.unlockedCars.includes(3)) {
    apexButton.disabled = false;
    apexButton.classList.remove('locked');
    apexButton.querySelector('small').textContent = cars[3].type;
  }
  ui.hud.classList.add('hidden');
  ui.pauseScreen.classList.add('hidden');
  ui.tutorialCard.classList.add('hidden');
  ui.result.classList.remove('hidden');
  ui.resultPlace.innerHTML = `${String(place).padStart(2, '0')} <small>${place === 1 ? 'ST' : place === 2 ? 'ND' : place === 3 ? 'RD' : 'TH'}</small>`;
  ui.resultTitle.textContent = careerWin && state.stats.careerWins === careerStages.length
    ? 'APEX RS UNLOCKED.'
    : state.mode === 'drift' ? 'STYLE POINTS.' : won ? 'CLEAN FINISH.' : completedLaps ? 'RACE COMPLETE.' : 'TIME IS UP.';
  ui.resultCopy.textContent = careerWin
    ? state.stats.careerWins === careerStages.length
      ? 'Career complete. The Apex RS is yours—select it in the garage.'
      : `${careerStage.title} won. Next up: ${currentCareerStage().title}.`
    : state.mode === 'drift' ? `${Math.floor(state.driftScore).toLocaleString()} drift points banked.` : won ? 'The city knows your name.' : 'Run it back. The podium is waiting.';
  ui.reward.textContent = `+${reward.toLocaleString()} CR`;
  ui.resultXp.textContent = `+${xp} XP`;
  ui.careerResult.classList.toggle('hidden', state.mode !== 'career');
  if (state.mode === 'career') {
    ui.careerResult.textContent = careerWin
      ? `CAREER WINS ${state.stats.careerWins} / 3 · ${state.stats.unlockedCars.includes(3) ? 'APEX RS UNLOCKED' : 'NEXT: ' + currentCareerStage().title}`
      : `CAREER WINS ${state.stats.careerWins} / 3 · FINISH FIRST TO ADVANCE`;
  }
}

function updatePositionAndTimer(dt) {
  state.elapsed += dt;
  ui.timer.textContent = formatTime(state.elapsed);
  if (state.mode === 'time' && state.elapsed - state.lastLapRecordAt < 2.5) ui.status.textContent = 'NEW LAP RECORD';
  else if (state.mode === 'time') ui.status.textContent = 'TIME TRIAL';
  else if (state.mode === 'free') ui.status.textContent = 'FREE DRIVE';
  else if (state.mode === 'drift') ui.status.textContent = 'SCORE ATTACK';
  else ui.status.textContent = state.elapsed < 15 ? 'RACE IN PROGRESS' : 'PUSH TO THE LIMIT';
  ui.position.textContent = String(1 + rivals.filter((r) => r.progress > state.playerProgress).length);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60), whole = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function updateHud() {
  const kmh = Math.round(Math.abs(player.speed) * 3.6);
  ui.speed.textContent = String(kmh).padStart(3, '0');
  ui.gear.textContent = player.speed < -1 ? 'R' : String(Math.max(1, Math.min(6, Math.floor(kmh / 48) + 1)));
  ui.boost.style.width = `${state.boost}%`;
  ui.boostPercent.textContent = `${Math.round(state.boost)}%`;
  updateMinimap();
}

function updateMinimap() {
  if (!ui.map || !curve || !player) return;
  const ctx = ui.map.getContext('2d');
  const w = ui.map.width, h = ui.map.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(5,10,14,.32)';
  ctx.fillRect(0, 0, w, h);
  const points = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i <= 160; i++) {
    const p = curve.getPointAt(i / 160);
    points.push(p);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const scale = Math.min((w - 28) / (maxX - minX), (h - 25) / (maxZ - minZ));
  const mapPoint = (p) => ({ x: (w - (maxX - minX) * scale) / 2 + (p.x - minX) * scale, y: (h - (maxZ - minZ) * scale) / 2 + (p.z - minZ) * scale });
  ctx.beginPath();
  points.forEach((p, i) => {
    const q = mapPoint(p);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#5d6970';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#b7c1c6';
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const rival of rivals) {
    const q = mapPoint(curve.getPointAt(rival.t));
    ctx.fillStyle = '#ff5a53';
    ctx.beginPath(); ctx.arc(q.x, q.y, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  const playerPoint = mapPoint(player.root.position);
  ctx.fillStyle = '#43d9ff';
  ctx.shadowColor = '#43d9ff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(playerPoint.x, playerPoint.y, 4.3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function updateCamera(dt) {
  const p = player.root.position;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  if (!state.active) {
    const angle = performance.now() * .00007;
    cameraTarget.set(p.x + Math.sin(angle) * 23, 10, p.z + Math.cos(angle) * 23);
    cameraLook.copy(p).add(new THREE.Vector3(0, 1, 0));
  } else if (state.camera === 0) {
    cameraTarget.copy(p).addScaledVector(fwd, -10.5).add(new THREE.Vector3(0, 5.4, 0));
    cameraLook.copy(p).addScaledVector(fwd, 9).add(new THREE.Vector3(0, 1.3, 0));
  } else if (state.camera === 1) {
    cameraTarget.copy(p).addScaledVector(fwd, -5.2).add(new THREE.Vector3(0, 2.7, 0));
    cameraLook.copy(p).addScaledVector(fwd, 13).add(new THREE.Vector3(0, 1.1, 0));
  } else if (state.camera === 2) {
    cameraTarget.copy(p).addScaledVector(fwd, .38).add(new THREE.Vector3(0, 1.65, 0));
    cameraLook.copy(p).addScaledVector(fwd, 35).add(new THREE.Vector3(0, 1.2, 0));
  } else {
    cameraTarget.copy(curve.getPointAt((player.t + .045) % 1)).add(new THREE.Vector3(0, 14, 0));
    cameraLook.copy(p).add(new THREE.Vector3(0, .5, 0));
  }
  camera.position.lerp(cameraTarget, 1 - Math.exp(-3.8 * dt));
  camera.lookAt(cameraLook);
}

function cycleCamera() {
  state.camera = (state.camera + 1) % 4;
  ui.cameraName.textContent = ['CHASE', 'CLOSE', 'COCKPIT', 'CINEMA'][state.camera];
  showToast(`${ui.cameraName.textContent} CAMERA`);
}

function toggleSound() {
  state.sound = !state.sound;
  $('#sound-state').textContent = state.sound ? 'ON' : 'OFF';
  if (state.sound && state.active) startEngineSound();
  else stopEngineSound();
}

function startEngineSound() {
  if (!state.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!engineAudio) {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 52;
      filter.type = 'lowpass';
      filter.frequency.value = 350;
      gain.gain.value = .025;
      oscillator.connect(filter).connect(gain).connect(context.destination);
      oscillator.start();
      engineAudio = { context, oscillator, gain, filter };
    }
    if (engineAudio.context.state === 'suspended') engineAudio.context.resume();
    engineAudio.gain.gain.setTargetAtTime(.025, engineAudio.context.currentTime, .1);
  } catch (error) {
    console.warn('Engine audio could not start:', error);
  }
}

function stopEngineSound() {
  if (engineAudio) engineAudio.gain.gain.setTargetAtTime(0, engineAudio.context.currentTime, .12);
}

function updateEngineSound() {
  if (!engineAudio || !state.sound) return;
  const now = engineAudio.context.currentTime;
  engineAudio.oscillator.frequency.setTargetAtTime(48 + Math.abs(player.speed) * 1.45, now, .08);
  engineAudio.filter.frequency.setTargetAtTime(240 + Math.abs(player.speed) * 7, now, .1);
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove('hidden');
  state.toastTime = 1.35;
}

function updateProgressLabel() {
  const level = Math.floor(state.stats.xp / 500) + 1;
  $('#driver-level').textContent = `${level < 3 ? 'ROOKIE' : level < 8 ? 'STREET PRO' : 'ELITE'} · LVL ${level}`;
  $('#driver-wallet').textContent = `◈ ${state.stats.credits.toLocaleString()} CR`;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .045);
  if (state.active && !state.paused) {
    if (state.countdown > 0) {
      state.countdown -= dt;
      const number = Math.max(1, Math.ceil(state.countdown));
      ui.countdown.textContent = state.countdown > .18 ? String(number) : 'GO';
      ui.countdown.classList.remove('hidden');
      if (state.countdown <= 0) {
        ui.countdown.classList.add('hidden');
        showToast('GO!');
      }
    } else {
      ui.countdown.classList.add('hidden');
      updatePlayer(dt);
      updateRivals(dt);
      resolveCollisions(dt);
      updatePositionAndTimer(dt);
      updateHud();
      updateEngineSound();
    }
  } else if (!state.active) player.root.rotation.y += dt * .08;
  if (state.toastTime > 0) {
    state.toastTime -= dt;
    if (state.toastTime <= 0) ui.toast.classList.add('hidden');
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
