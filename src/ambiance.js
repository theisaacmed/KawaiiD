// Ambiance — extra environmental details that bring the world to life
// - Butterflies (appear in colorful areas, flutter around)
// - Blowing leaves/paper (drift through streets with wind)
// - Flower pots on windowsills (bloom with color)
// - Puddles (reflective ground patches)
// - Awning flaps on shops

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const WIND = { x: 0.3, z: 0.15 };
const GRAY = new THREE.Color(0x808080);
const _c = new THREE.Color();

// ============ BUTTERFLIES ============
// Small colored sprites that flutter around colorful areas

const BUTTERFLY_COUNT = 20;
let butterflyPoints = null;
let butterflyPositions = null;
let butterflyMaterial = null;
const butterflyData = []; // per-butterfly: { phase, speed, baseY, homeX, homeZ }
let butterflyLocalColor = 0;

const BUTTERFLY_COLORS = [
  new THREE.Color(0xFF88BB), // pink
  new THREE.Color(0x88BBFF), // blue
  new THREE.Color(0xFFDD66), // yellow
  new THREE.Color(0xBB88FF), // purple
];

function createButterflies(scene) {
  const positions = new Float32Array(BUTTERFLY_COUNT * 3);

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    // Spread across town center area
    const x = (Math.random() - 0.5) * 60;
    const z = Math.random() * 30 - 5;
    const y = getTerrainHeight(x, z) + 1 + Math.random() * 3;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    butterflyData.push({
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      baseY: y,
      homeX: x,
      homeZ: z,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  butterflyMaterial = new THREE.PointsMaterial({
    color: 0xFF88BB,
    size: 0.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });

  butterflyPoints = new THREE.Points(geo, butterflyMaterial);
  butterflyPositions = geo.attributes.position;
  scene.add(butterflyPoints);
}

function updateButterflies(dt, elapsed) {
  if (!butterflyPositions) return;

  // Only visible when area is colorful
  const targetOpacity = butterflyLocalColor > 0.25 ? Math.min(0.8, (butterflyLocalColor - 0.25) * 2) : 0;
  butterflyMaterial.opacity += (targetOpacity - butterflyMaterial.opacity) * dt * 2;

  // Cycle colors
  const colorIdx = Math.floor(elapsed * 0.3) % BUTTERFLY_COLORS.length;
  _c.copy(GRAY).lerp(BUTTERFLY_COLORS[colorIdx], butterflyLocalColor);
  butterflyMaterial.color.copy(_c);

  // Flutter size
  butterflyMaterial.size = 0.15 + Math.sin(elapsed * 8) * 0.05;

  if (butterflyMaterial.opacity < 0.01) return;

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const bd = butterflyData[i];
    let x = butterflyPositions.getX(i);
    let y = butterflyPositions.getY(i);
    let z = butterflyPositions.getZ(i);

    // Flutter: figure-8 pattern
    const t = elapsed * bd.speed + bd.phase;
    x = bd.homeX + Math.sin(t) * 2;
    y = bd.baseY + Math.sin(t * 1.7) * 0.8 + Math.sin(t * 3.1) * 0.3;
    z = bd.homeZ + Math.cos(t * 0.8) * 2;

    butterflyPositions.setXYZ(i, x, y, z);
  }
  butterflyPositions.needsUpdate = true;
}


// ============ BLOWING DEBRIS ============
// Leaves and paper scraps that blow through streets

const DEBRIS_COUNT = 30;
let debrisPoints = null;
let debrisPositions = null;
let debrisMaterial = null;
const debrisVelocities = [];

function createDebris(scene, playerRef) {
  const positions = new Float32Array(DEBRIS_COUNT * 3);

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = Math.random() * 60 - 10;

    debrisVelocities.push({
      vx: WIND.x * (0.5 + Math.random()),
      vy: 0,
      vz: WIND.z * (0.5 + Math.random()),
      spin: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  debrisMaterial = new THREE.PointsMaterial({
    color: 0x998877,
    size: 0.12,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });

  debrisPoints = new THREE.Points(geo, debrisMaterial);
  debrisPositions = geo.attributes.position;
  scene.add(debrisPoints);
}

let playerRef = null;

function updateDebris(dt, elapsed) {
  if (!debrisPositions || !playerRef) return;

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const v = debrisVelocities[i];
    let x = debrisPositions.getX(i);
    let y = debrisPositions.getY(i);
    let z = debrisPositions.getZ(i);

    // Tumble along ground with wind
    x += v.vx * dt + Math.sin(elapsed * v.spin + v.phase) * 0.3 * dt;
    z += v.vz * dt + Math.cos(elapsed * v.spin * 0.7 + v.phase) * 0.2 * dt;

    // Occasional lift
    y = getTerrainHeight(x, z) + Math.abs(Math.sin(elapsed * 1.5 + v.phase)) * 0.4;

    // Reset if too far from player
    const dx = x - playerRef.x;
    const dz = z - playerRef.z;
    if (dx * dx + dz * dz > 2500) { // 50 unit radius
      x = playerRef.x + (Math.random() - 0.5) * 60;
      z = playerRef.z + (Math.random() - 0.5) * 60;
      y = getTerrainHeight(x, z);
    }

    debrisPositions.setXYZ(i, x, y, z);
  }
  debrisPositions.needsUpdate = true;
}


// ============ FLOWER PLANTERS ============
// Ground-level planters next to building entrances that bloom with color

const flowerPots = [];

// Ground positions near building fronts — just x,z coordinates on the sidewalk
const PLANTER_POSITIONS = [
  // Town — along Main Street sidewalks
  { x: -4, z: 3, district: 'town' },
  { x: 4, z: 7, district: 'town' },
  { x: -5, z: 10, district: 'town' },
  { x: 5, z: 14, district: 'town' },
  { x: -4, z: 18, district: 'town' },
  { x: 4, z: 22, district: 'town' },
  // Burbs — near houses
  { x: 76, z: -20, district: 'burbs' },
  { x: 87, z: -7, district: 'burbs' },
  { x: 80, z: 5, district: 'burbs' },
  // Northtown
  { x: 66, z: 84, district: 'northtown' },
  { x: 76, z: 94, district: 'northtown' },
  // Downtown
  { x: 4, z: 55, district: 'downtown' },
  { x: -4, z: 65, district: 'downtown' },
  // Uptown
  { x: 96, z: 37, district: 'uptown' },
];

const FLOWER_COLORS = {
  town:      [0xFF6B9D, 0xFFBB33, 0xFF88BB, 0xCC66FF],
  burbs:     [0xFF8866, 0xFFCC44, 0xFF99AA, 0x66CC88],
  northtown: [0xFFAA55, 0xFF7799, 0xFFDD44, 0xBB88FF],
  downtown:  [0xCC66FF, 0xFF6688, 0x66BBFF, 0xFFBB44],
  uptown:    [0xBB88FF, 0xFF88BB, 0x88BBFF, 0xFFAA66],
};

const POT_GRAY = new THREE.Color(0x606060);
const POT_BROWN = new THREE.Color(0x705040);
const SOIL_GRAY = new THREE.Color(0x555555);
const SOIL_BROWN = new THREE.Color(0x443322);
const STEM_GRAY = new THREE.Color(0x556655);
const STEM_GREEN = new THREE.Color(0x447744);

function createFlowerPots(scene) {
  for (let i = 0; i < PLANTER_POSITIONS.length; i++) {
    const pos = PLANTER_POSITIONS[i];
    const terrainY = getTerrainHeight(pos.x, pos.z);
    const palette = FLOWER_COLORS[pos.district] || FLOWER_COLORS.town;

    // Pot body — sits on the ground
    const potMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), potMat);
    pot.position.set(pos.x, terrainY + 0.2, pos.z);
    pot.castShadow = true;
    scene.add(pot);

    // Soil top
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), soilMat);
    soil.position.set(pos.x, terrainY + 0.43, pos.z);
    scene.add(soil);

    // Stem
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x556655 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), stemMat);
    stem.position.set(pos.x, terrainY + 0.58, pos.z);
    scene.add(stem);

    // Flower head — blooms with color
    const flowerColor = palette[i % palette.length];
    const flowerMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), flowerMat);
    flower.position.set(pos.x, terrainY + 0.78, pos.z);
    scene.add(flower);

    flowerPots.push({
      x: pos.x,
      z: pos.z,
      district: pos.district,
      localColor: 0,
      potMat,
      soilMat,
      stemMat,
      flowerMat,
      flower,
      targetFlowerColor: new THREE.Color(flowerColor),
    });
  }
}

function updateFlowerPots() {
  for (const fp of flowerPots) {
    const lc = fp.localColor;
    // Pot: gray → brown
    _c.copy(POT_GRAY).lerp(POT_BROWN, lc);
    fp.potMat.color.copy(_c);
    // Soil: gray → brown
    _c.copy(SOIL_GRAY).lerp(SOIL_BROWN, lc);
    fp.soilMat.color.copy(_c);
    // Stem: gray-green → green
    _c.copy(STEM_GRAY).lerp(STEM_GREEN, lc);
    fp.stemMat.color.copy(_c);
    // Flower: gray → bright color, also scale bloom
    _c.set(0x707070).lerp(fp.targetFlowerColor, lc);
    fp.flowerMat.color.copy(_c);
    fp.flower.scale.setScalar(0.6 + lc * 0.6);
  }
}


// ============ PUDDLES ============
// Reflective ground patches scattered through town

const puddles = [];

const PUDDLE_POSITIONS = [
  { x: -3, z: 2 }, { x: 5, z: 8 }, { x: -10, z: 12 },
  { x: 12, z: 5 }, { x: -6, z: 18 }, { x: 8, z: 15 },
  { x: -15, z: 7 }, { x: 15, z: 20 },
  // Downtown
  { x: -5, z: 55 }, { x: 10, z: 62 }, { x: 22, z: 58 },
  { x: -12, z: 70 },
  // Burbs
  { x: 80, z: -15 }, { x: 95, z: -8 },
];

function createPuddles(scene) {
  for (const pos of PUDDLE_POSITIONS) {
    const terrainY = getTerrainHeight(pos.x, pos.z);
    const size = 0.6 + Math.random() * 0.8;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.5,
    });

    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(size, 12),
      mat
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(pos.x, terrainY + 0.01, pos.z);
    scene.add(puddle);

    puddles.push({ mesh: puddle, material: mat, x: pos.x, z: pos.z, localColor: 0 });
  }
}

function updatePuddles(elapsed) {
  for (const p of puddles) {
    // Slight shimmer
    p.material.roughness = 0.12 + Math.sin(elapsed * 0.7 + p.x) * 0.03;
    // Tint bluer with color
    const lc = p.localColor;
    _c.set(0x445566).lerp(new THREE.Color(0x5588AA), lc);
    p.material.color.copy(_c);
  }
}


// ============ AWNING FLAPS ============
// Small cloth-like overhangs on shop fronts that sway

const awnings = [];

const AWNING_DEFS = [
  // Town shops — bd = depth (Z-axis)
  { bx: -7.2, bz: -4.8, bw: 8, bd: 7, bh: 7, district: 'town' },
  { bx: 7.2, bz: -4.8, bw: 8, bd: 7, bh: 8, district: 'town' },
  { bx: -6.6, bz: 21.6, bw: 7, bd: 7, bh: 7, district: 'town' },
  { bx: 6.6, bz: 21.6, bw: 7, bd: 7, bh: 8, district: 'town' },
  // Downtown
  { bx: 7.2, bz: 52.8, bw: 9, bd: 8, bh: 10, district: 'downtown' },
  { bx: 19.2, bz: 68.4, bw: 9, bd: 8, bh: 11, district: 'downtown' },
  { bx: 30, bz: 68.4, bw: 9, bd: 8, bh: 10, district: 'downtown' },
  // Northtown shop
  { bx: 93, bz: 81, bw: 8, bd: 7, bh: 7, district: 'northtown' },
];

const AWNING_COLORS = {
  town:      [0xCC4444, 0x4466AA, 0x44AA66, 0xAA8833],
  downtown:  [0x6644AA, 0xAA4444, 0x3388AA, 0x888844],
  northtown: [0xCC6633, 0x446688, 0x668844, 0x884466],
};

function createAwnings(scene) {
  for (let i = 0; i < AWNING_DEFS.length; i++) {
    const def = AWNING_DEFS[i];
    const terrainY = getTerrainHeight(def.bx, def.bz);
    const hd = def.bd / 2; // half depth for Z offset
    const palette = AWNING_COLORS[def.district] || AWNING_COLORS.town;
    const targetColor = new THREE.Color(palette[i % palette.length]);

    const awningY = terrainY + def.bh * 0.38;
    const awningZ = def.bz + hd + 0.5; // just past front wall

    const mat = new THREE.MeshLambertMaterial({ color: 0x707070, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(def.bw * 0.6, 0.04, 1.0),
      mat
    );
    awning.position.set(def.bx, awningY, awningZ);
    awning.castShadow = true;
    scene.add(awning);

    // Hanging fringe
    const fringeMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const fringe = new THREE.Mesh(
      new THREE.BoxGeometry(def.bw * 0.6, 0.15, 0.03),
      fringeMat
    );
    fringe.position.set(def.bx, awningY - 0.08, awningZ + 0.48);
    scene.add(fringe);

    awnings.push({
      mesh: awning,
      fringe,
      material: mat,
      fringeMat,
      baseY: awningY,
      baseZ: awningZ,
      x: def.bx,
      z: def.bz,
      targetColor,
      localColor: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function updateAwnings(dt, elapsed) {
  for (const a of awnings) {
    // Gentle sway
    const sway = Math.sin(elapsed * 1.3 + a.phase) * 0.02;
    a.mesh.rotation.x = sway;
    a.fringe.position.y = a.baseY - 0.08 + Math.sin(elapsed * 2 + a.phase) * 0.01;

    // Color
    _c.set(0x707070).lerp(a.targetColor, a.localColor);
    a.material.color.copy(_c);
    _c.set(0x606060).lerp(a.targetColor, a.localColor * 0.7);
    a.fringeMat.color.copy(_c);
  }
}


// ============ MAIN EXPORTS ============

let allAmbiance = []; // for color refresh

export function createAmbiance(scene, player) {
  playerRef = player.position;
  createButterflies(scene);
  createDebris(scene, player);
  createFlowerPots(scene);
  createPuddles(scene);
  createAwnings(scene);
}

function refreshAmbianceColors() {
  const buildings = getBuildingColors();

  // Butterflies — use average of town center area
  {
    let total = 0, weight = 0;
    for (const b of buildings) {
      if (Math.abs(b.x) < 40 && b.z > -10 && b.z < 30) {
        total += b.displayAmount;
        weight += 1;
      }
    }
    butterflyLocalColor = weight > 0 ? total / weight : 0;
  }

  // Flower pots
  for (const fp of flowerPots) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - fp.x;
      const dz = b.z - fp.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    fp.localColor = weight > 0 ? total / weight : 0;
  }

  // Puddles
  for (const p of puddles) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    p.localColor = weight > 0 ? total / weight : 0;
  }

  // Awnings
  for (const a of awnings) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    a.localColor = weight > 0 ? total / weight : 0;
  }
}

let ambColorTimer = 0;

export function updateAmbiance(dt, elapsed) {
  ambColorTimer += dt;
  if (ambColorTimer >= 3) {
    ambColorTimer = 0;
    refreshAmbianceColors();
  }

  updateButterflies(dt, elapsed);
  updateDebris(dt, elapsed);
  updateFlowerPots();
  updatePuddles(elapsed);
  updateAwnings(dt, elapsed);
}
