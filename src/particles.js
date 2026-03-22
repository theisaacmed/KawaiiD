// Particle systems — ash, sparkles, fireflies, fountain water, flower petals, search dust
// All use THREE.Points or lightweight sprites for performance
// Zone checks run every 2-3 seconds, not every frame

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { isNight } from './time-system.js';

// --- Constants ---
const ASH_COUNT = 60;
const SPARKLE_COUNT = 60;
const FIREFLY_COUNT = 30;
const FOUNTAIN_DROP_COUNT = 40;
const PETAL_COUNT = 20;
const DUST_COUNT = 25;

const ZONE_CHECK_INTERVAL = 2.5; // seconds

// --- State ---
let sceneRef = null;
let playerRef = null;

// Ash particles (gray areas)
let ashPoints = null;
let ashPositions = null;
let ashMat = null;

// Sparkle particles (colorful areas)
let sparklePoints = null;
let sparklePositions = null;
let sparkleMat = null;

// Firefly particles (colorful areas at night)
let fireflyPoints = null;
let fireflyPositions = null;
let fireflyMat = null;

// Fountain water drops
let fountainPoints = null;
let fountainPositions = null;
let fountainVelocities = null;
let fountainMat = null;
let fountainActive = false;
let fountainPos = { x: 0, z: 0 };

// Flower petals (high color trees)
let petalPoints = null;
let petalPositions = null;
let petalMat = null;
let petalsActive = false;

// Ruins dust (heavier particles in ruins zone)
let dustPoints = null;
let dustPositions = null;
let dustMat = null;

// Search dust (burst when searching rubble)
const searchBursts = [];

// Zone data (refreshed periodically)
let zoneTimer = 0;
let localColorAtPlayer = 0;
let isInRuins = false;
let highColorNearby = false; // any building > 0.7 within 20 units
let fountainAreaColor = 0;

// Wind direction (subtle)
const windDir = { x: 0.3, z: 0.15 };

// --- Utility ---
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// --- Create particle systems ---
function createAshParticles(scene) {
  const positions = new Float32Array(ASH_COUNT * 3);
  for (let i = 0; i < ASH_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = Math.random() * 6 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  ashMat = new THREE.PointsMaterial({
    color: 0x999999,
    size: 0.15,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    sizeAttenuation: true,
  });
  ashPoints = new THREE.Points(geo, ashMat);
  scene.add(ashPoints);
  ashPositions = geo.attributes.position;
}

function createSparkleParticles(scene) {
  const positions = new Float32Array(SPARKLE_COUNT * 3);
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = Math.random() * 5 + 0.3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sparkleMat = new THREE.PointsMaterial({
    color: 0xFFEECC,
    size: 0.12,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  sparklePoints = new THREE.Points(geo, sparkleMat);
  scene.add(sparklePoints);
  sparklePositions = geo.attributes.position;
}

function createFireflyParticles(scene) {
  const positions = new Float32Array(FIREFLY_COUNT * 3);
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = 0.5 + Math.random() * 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fireflyMat = new THREE.PointsMaterial({
    color: 0xFFDD66,
    size: 0.1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  fireflyPoints = new THREE.Points(geo, fireflyMat);
  scene.add(fireflyPoints);
  fireflyPositions = geo.attributes.position;
}

function createFountainParticles(scene) {
  const positions = new Float32Array(FOUNTAIN_DROP_COUNT * 3);
  fountainVelocities = new Float32Array(FOUNTAIN_DROP_COUNT * 3);
  for (let i = 0; i < FOUNTAIN_DROP_COUNT; i++) {
    resetFountainDrop(positions, fountainVelocities, i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fountainMat = new THREE.PointsMaterial({
    color: 0xAADDFF,
    size: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  fountainPoints = new THREE.Points(geo, fountainMat);
  scene.add(fountainPoints);
  fountainPositions = geo.attributes.position;
}

function resetFountainDrop(positions, velocities, i) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.5;
  positions[i * 3] = fountainPos.x;
  positions[i * 3 + 1] = 2.1 + Math.random() * 0.3;
  positions[i * 3 + 2] = fountainPos.z;
  velocities[i * 3] = Math.cos(angle) * speed;
  velocities[i * 3 + 1] = 1.5 + Math.random() * 1.0;
  velocities[i * 3 + 2] = Math.sin(angle) * speed;
}

function createPetalParticles(scene) {
  const positions = new Float32Array(PETAL_COUNT * 3);
  for (let i = 0; i < PETAL_COUNT; i++) {
    positions[i * 3] = -8 + (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = 2 + Math.random() * 3;
    positions[i * 3 + 2] = -18 + (Math.random() - 0.5) * 12;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  petalMat = new THREE.PointsMaterial({
    color: 0xFFAACC,
    size: 0.1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  petalPoints = new THREE.Points(geo, petalMat);
  scene.add(petalPoints);
  petalPositions = geo.attributes.position;
}

function createRuinsDustParticles(scene) {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = Math.random() * 4 + 0.3;
    positions[i * 3 + 2] = 28 + Math.random() * 35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustMat = new THREE.PointsMaterial({
    color: 0x887766,
    size: 0.2,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    sizeAttenuation: true,
  });
  dustPoints = new THREE.Points(geo, dustMat);
  scene.add(dustPoints);
  dustPositions = geo.attributes.position;
}

// --- Init ---
export function initParticles(scene, player) {
  sceneRef = scene;
  playerRef = player;

  createAshParticles(scene);
  createSparkleParticles(scene);
  createFireflyParticles(scene);
  createFountainParticles(scene);
  createPetalParticles(scene);
  createRuinsDustParticles(scene);
}

// Set fountain world position
export function setFountainPosition(x, z) {
  fountainPos.x = x;
  fountainPos.z = z;
}

// --- Zone check (runs every 2-3 seconds) ---
function refreshZoneData() {
  if (!playerRef) return;

  const px = playerRef.position.x;
  const pz = playerRef.position.z;

  isInRuins = pz > 26;

  // Calculate local color near player
  const buildings = getBuildingColors();
  let total = 0;
  let count = 0;
  highColorNearby = false;
  for (const b of buildings) {
    const dx = b.x - px;
    const dz = b.z - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 25) {
      const w = 1 - dist / 25;
      total += b.displayAmount * w;
      count += w;
      if (b.displayAmount > 0.7 && dist < 20) highColorNearby = true;
    }
  }
  localColorAtPlayer = count > 0 ? total / count : 0;

  // Fountain area color (buildings near 0,0)
  let fTotal = 0;
  let fCount = 0;
  for (const b of buildings) {
    const dx = b.x - fountainPos.x;
    const dz = b.z - fountainPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 20) {
      fTotal += b.displayAmount;
      fCount++;
    }
  }
  fountainAreaColor = fCount > 0 ? fTotal / fCount : 0;
  fountainActive = fountainAreaColor >= 0.5;

  // Petals active when park trees area has high color
  let parkColor = 0;
  let pCount = 0;
  for (const b of buildings) {
    const dx = b.x - (-8);
    const dz = b.z - (-18);
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 15) {
      parkColor += b.displayAmount;
      pCount++;
    }
  }
  petalsActive = pCount > 0 && (parkColor / pCount) > 0.7;
}

// --- Per-frame update ---
export function updateParticles(dt, elapsed) {
  if (!playerRef) return;

  zoneTimer += dt;
  if (zoneTimer >= ZONE_CHECK_INTERVAL) {
    zoneTimer = 0;
    refreshZoneData();
  }

  const px = playerRef.position.x;
  const pz = playerRef.position.z;
  const night = isNight();

  // --- Ash particles (visible in gray areas, fade in colorful) ---
  const ashOpacity = Math.max(0, 0.3 * (1 - localColorAtPlayer * 1.5));
  ashMat.opacity = ashOpacity;
  if (ashOpacity > 0.01) {
    for (let i = 0; i < ASH_COUNT; i++) {
      let x = ashPositions.getX(i);
      let y = ashPositions.getY(i);
      let z = ashPositions.getZ(i);

      // Drift down + wind
      y -= dt * (0.15 + Math.sin(i * 0.7) * 0.05);
      x += windDir.x * dt * 0.5 + Math.sin(i * 0.3 + elapsed * 0.5) * dt * 0.1;
      z += windDir.z * dt * 0.5 + Math.cos(i * 0.5 + elapsed * 0.3) * dt * 0.08;

      // Reset if too low or too far
      if (y < 0) { y = 4 + Math.random() * 3; x = px + (Math.random() - 0.5) * 50; z = pz + (Math.random() - 0.5) * 50; }
      if (Math.abs(x - px) > 30) x = px + (Math.random() - 0.5) * 50;
      if (Math.abs(z - pz) > 30) z = pz + (Math.random() - 0.5) * 50;

      ashPositions.setXYZ(i, x, y, z);
    }
    ashPositions.needsUpdate = true;
  }

  // --- Sparkle particles (visible in colorful areas) ---
  const sparkleOpacity = Math.max(0, Math.min(0.6, (localColorAtPlayer - 0.3) * 1.5));
  sparkleMat.opacity = sparkleOpacity;
  if (sparkleOpacity > 0.01) {
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      let x = sparklePositions.getX(i);
      let y = sparklePositions.getY(i);
      let z = sparklePositions.getZ(i);

      // Gentle upward drift + twinkle
      y += dt * (0.2 + Math.sin(i * 1.3 + elapsed * 2) * 0.15);
      x += Math.sin(elapsed * 1.5 + i * 0.8) * dt * 0.3;
      z += Math.cos(elapsed * 1.2 + i * 0.6) * dt * 0.2;

      if (y > 6) { y = 0.3; x = px + (Math.random() - 0.5) * 40; z = pz + (Math.random() - 0.5) * 40; }
      if (Math.abs(x - px) > 25) x = px + (Math.random() - 0.5) * 40;
      if (Math.abs(z - pz) > 25) z = pz + (Math.random() - 0.5) * 40;

      sparklePositions.setXYZ(i, x, y, z);
    }
    sparklePositions.needsUpdate = true;
  }

  // --- Firefly particles (colorful areas at night) ---
  const fireflyOpacity = (night && localColorAtPlayer > 0.3) ?
    Math.min(0.7, (localColorAtPlayer - 0.3) * 1.5) : 0;
  fireflyMat.opacity = fireflyOpacity;
  if (fireflyOpacity > 0.01) {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      let x = fireflyPositions.getX(i);
      let y = fireflyPositions.getY(i);
      let z = fireflyPositions.getZ(i);

      // Slow drifting, gentle bob
      x += Math.sin(elapsed * 0.3 + i * 2) * dt * 0.4;
      y += Math.sin(elapsed * 0.5 + i * 3) * dt * 0.2;
      z += Math.cos(elapsed * 0.4 + i * 1.5) * dt * 0.3;

      // Keep in reasonable range
      y = Math.max(0.3, Math.min(3.5, y));
      if (Math.abs(x - px) > 20) x = px + (Math.random() - 0.5) * 30;
      if (Math.abs(z - pz) > 20) z = pz + (Math.random() - 0.5) * 30;

      fireflyPositions.setXYZ(i, x, y, z);
    }
    fireflyPositions.needsUpdate = true;
    // Pulsing size
    fireflyMat.size = 0.08 + Math.sin(elapsed * 2) * 0.04;
  }

  // --- Fountain water (active when area color >= 0.5) ---
  const fOpacity = fountainActive ? Math.min(0.6, (fountainAreaColor - 0.5) * 2) : 0;
  fountainMat.opacity = fOpacity;
  if (fOpacity > 0.01) {
    for (let i = 0; i < FOUNTAIN_DROP_COUNT; i++) {
      let x = fountainPositions.getX(i);
      let y = fountainPositions.getY(i);
      let z = fountainPositions.getZ(i);

      // Apply velocity + gravity
      x += fountainVelocities[i * 3] * dt;
      y += fountainVelocities[i * 3 + 1] * dt;
      z += fountainVelocities[i * 3 + 2] * dt;

      // Gravity
      fountainVelocities[i * 3 + 1] -= 4.0 * dt;

      // Reset if below basin level
      if (y < 0.3) {
        resetFountainDrop(
          fountainPositions.array, fountainVelocities, i
        );
        x = fountainPositions.array[i * 3];
        y = fountainPositions.array[i * 3 + 1];
        z = fountainPositions.array[i * 3 + 2];
      }

      fountainPositions.setXYZ(i, x, y, z);
    }
    fountainPositions.needsUpdate = true;
  }

  // --- Flower petals (high color park area) ---
  petalMat.opacity = petalsActive ? 0.5 : 0;
  if (petalsActive) {
    for (let i = 0; i < PETAL_COUNT; i++) {
      let x = petalPositions.getX(i);
      let y = petalPositions.getY(i);
      let z = petalPositions.getZ(i);

      // Flutter down
      y -= dt * (0.3 + Math.sin(i * 2 + elapsed) * 0.15);
      x += Math.sin(elapsed + i * 1.5) * dt * 0.5 + windDir.x * dt;
      z += Math.cos(elapsed * 0.8 + i) * dt * 0.3 + windDir.z * dt;

      if (y < 0) {
        x = -8 + (Math.random() - 0.5) * 14;
        y = 3 + Math.random() * 2;
        z = -18 + (Math.random() - 0.5) * 12;
      }

      petalPositions.setXYZ(i, x, y, z);
    }
    petalPositions.needsUpdate = true;
  }

  // --- Ruins dust (always present in ruins, heavier than fog) ---
  if (isInRuins || (pz > 20 && pz < 70)) {
    dustMat.opacity = 0.25;
    for (let i = 0; i < DUST_COUNT; i++) {
      let x = dustPositions.getX(i);
      let y = dustPositions.getY(i);
      let z = dustPositions.getZ(i);

      y -= dt * 0.08;
      x += (Math.sin(i * 0.5 + elapsed * 0.2) * 0.15 + windDir.x * 0.3) * dt;
      z += (Math.cos(i * 0.7 + elapsed * 0.15) * 0.1 + windDir.z * 0.3) * dt;

      if (y < 0.1) { y = 3 + Math.random() * 2; }
      if (Math.abs(x - px) > 25) x = px + (Math.random() - 0.5) * 40;
      if (z < 26 || z > 66) z = 28 + Math.random() * 35;

      dustPositions.setXYZ(i, x, y, z);
    }
    dustPositions.needsUpdate = true;
  } else {
    dustMat.opacity = 0;
  }

  // --- Search burst particles ---
  updateSearchBursts(dt);
}

// --- Search dust burst (call when player searches a rubble pile) ---
export function spawnSearchDust(worldPos) {
  if (!sceneRef) return;

  const count = 20;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    positions[i * 3] = worldPos.x;
    positions[i * 3 + 1] = 0.5 + Math.random() * 0.5;
    positions[i * 3 + 2] = worldPos.z;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = 1.0 + Math.random() * 1.5;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x998877,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  sceneRef.add(points);

  searchBursts.push({
    points, geo, mat, velocities,
    positions: geo.attributes.position,
    age: 0, maxAge: 1.5,
  });
}

function updateSearchBursts(dt) {
  for (let b = searchBursts.length - 1; b >= 0; b--) {
    const burst = searchBursts[b];
    burst.age += dt;

    if (burst.age >= burst.maxAge) {
      sceneRef.remove(burst.points);
      burst.geo.dispose();
      burst.mat.dispose();
      searchBursts.splice(b, 1);
      continue;
    }

    const t = burst.age / burst.maxAge;
    burst.mat.opacity = 0.6 * (1 - t);

    const pos = burst.positions;
    const vel = burst.velocities;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + vel[i * 3] * dt);
      pos.setY(i, pos.getY(i) + vel[i * 3 + 1] * dt);
      pos.setZ(i, pos.getZ(i) + vel[i * 3 + 2] * dt);
      // Gravity
      vel[i * 3 + 1] -= 3.0 * dt;
    }
    pos.needsUpdate = true;
  }
}
