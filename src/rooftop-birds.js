// Rooftop birds — small flocks that perch on building edges,
// scatter when player approaches, then disappear and reappear elsewhere

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const BIRD_GRAY = new THREE.Color(0x808080);
const BIRD_DARK = new THREE.Color(0x4A3A30);
const _c = new THREE.Color();

const flocks = [];
let colorCheckTimer = 0;

// Each flock has a pool of candidate buildings to perch on
const FLOCK_DEFS = [
  // Town — taller buildings
  { candidates: [
    { x: -7.2, z: 1.8, h: 9 },
    { x: 7.2, z: 27.6, h: 10 },
    { x: -28.8, z: 21.6, h: 10 },
  ], count: 4 },
  { candidates: [
    { x: 6.6, z: 1.8, h: 10 },
    { x: -19.2, z: 15, h: 10 },
    { x: 28.8, z: 1.8, h: 10 },
  ], count: 3 },
  // Downtown — tall offices
  { candidates: [
    { x: -7.2, z: 60, h: 14 },
    { x: 7.2, z: 60, h: 15 },
    { x: 19.2, z: 61.2, h: 14 },
  ], count: 5 },
  { candidates: [
    { x: -7.2, z: 74.4, h: 13 },
    { x: 30, z: 75.6, h: 14 },
    { x: -21, z: 61.2, h: 13 },
  ], count: 4 },
  // Northtown
  { candidates: [
    { x: 72.6, z: 91.2, h: 9 },
    { x: 85.2, z: 81, h: 8 },
    { x: 63, z: 81, h: 8 },
  ], count: 3 },
  // Burbs — on the school and houses
  { candidates: [
    { x: 105, z: -25.2, h: 9 },
    { x: 84, z: -9, h: 7 },
    { x: 96, z: 3, h: 7 },
  ], count: 4 },
  // Uptown
  { candidates: [
    { x: 100.8, z: 33, h: 14 },
    { x: 93, z: 34.8, h: 12 },
    { x: 109.2, z: 34.8, h: 16 },
  ], count: 5 },
  // Tower district
  { candidates: [
    { x: -7.2, z: 52.8, h: 12 },
    { x: -21, z: 54, h: 11 },
    { x: 19.2, z: 54, h: 10 },
  ], count: 3 },
];

const SCATTER_SPEED = 4;
const SCATTER_DURATION = 1.5;
const HIDDEN_MIN = 8;
const HIDDEN_MAX = 20;
const PERCH_MIN = 15;
const PERCH_MAX = 40;
const APPEAR_DURATION = 0.5;
const FLEE_RADIUS = 12;

function getPerchPositions(building, count) {
  const terrainY = getTerrainHeight(building.x, building.z);
  const roofY = terrainY + building.h;
  const hw = 3.5; // approximate half-width
  const hd = 3;   // approximate half-depth
  const positions = [];

  // Generate candidate perch spots along roof edges
  const candidates = [
    { x: building.x - hw, z: building.z - hd },
    { x: building.x + hw, z: building.z - hd },
    { x: building.x - hw, z: building.z + hd },
    { x: building.x + hw, z: building.z + hd },
    { x: building.x, z: building.z - hd },
    { x: building.x, z: building.z + hd },
    { x: building.x - hw, z: building.z },
    { x: building.x + hw, z: building.z },
  ];

  for (let i = 0; i < count; i++) {
    const c = candidates[i % candidates.length];
    positions.push(c.x + (Math.random() - 0.5) * 0.5, roofY, c.z + (Math.random() - 0.5) * 0.5);
  }
  return positions;
}

export function createBirds(scene) {
  for (const def of FLOCK_DEFS) {
    const count = def.count;
    const startBuilding = def.candidates[0];
    const perchPositions = getPerchPositions(startBuilding, count);

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = perchPositions[i * 3];
      positions[i * 3 + 1] = perchPositions[i * 3 + 1];
      positions[i * 3 + 2] = perchPositions[i * 3 + 2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x808080,
      size: 0.3,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    flocks.push({
      points,
      positions: geo.attributes.position,
      velocities,
      material: mat,
      count,
      candidates: def.candidates,
      currentBuilding: startBuilding,
      state: 'perched',
      stateTimer: PERCH_MIN + Math.random() * (PERCH_MAX - PERCH_MIN),
      localColor: 0,
    });
  }
}

function pickRandomBuilding(flock, excludeBuilding) {
  const options = flock.candidates.filter(b => b !== excludeBuilding);
  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : flock.candidates[0];
}

function refreshBirdColors() {
  const buildings = getBuildingColors();
  for (const flock of flocks) {
    const bx = flock.currentBuilding.x;
    const bz = flock.currentBuilding.z;
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - bx;
      const dz = b.z - bz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    flock.localColor = weight > 0 ? total / weight : 0;
  }
}

export function updateBirds(dt, elapsed, playerPos) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= 3) {
    colorCheckTimer = 0;
    refreshBirdColors();
  }

  for (const flock of flocks) {
    const pos = flock.positions;
    const bx = flock.currentBuilding.x;
    const bz = flock.currentBuilding.z;

    switch (flock.state) {
      case 'perched': {
        // Gentle bob
        for (let i = 0; i < flock.count; i++) {
          const baseY = pos.getY(i);
          // Small oscillation (reset-safe by using sin of elapsed)
          const bob = Math.sin(elapsed * 2 + i * 1.7) * 0.02;
          pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)) + flock.currentBuilding.h + bob);
        }
        pos.needsUpdate = true;

        // Check player proximity
        const pdx = playerPos.x - bx;
        const pdz = playerPos.z - bz;
        const playerDist = Math.sqrt(pdx * pdx + pdz * pdz);

        if (playerDist < FLEE_RADIUS) {
          // Scatter!
          flock.state = 'scattering';
          flock.stateTimer = 0;
          for (let i = 0; i < flock.count; i++) {
            flock.velocities[i * 3] = (Math.random() - 0.5) * SCATTER_SPEED;
            flock.velocities[i * 3 + 1] = 2 + Math.random() * 3;
            flock.velocities[i * 3 + 2] = (Math.random() - 0.5) * SCATTER_SPEED;
          }
        } else {
          // Random disappear timer
          flock.stateTimer -= dt;
          if (flock.stateTimer <= 0) {
            flock.state = 'hidden';
            flock.stateTimer = HIDDEN_MIN + Math.random() * (HIDDEN_MAX - HIDDEN_MIN);
            flock.material.opacity = 0;
          }
        }
        break;
      }

      case 'scattering': {
        flock.stateTimer += dt;
        const t = flock.stateTimer / SCATTER_DURATION;

        for (let i = 0; i < flock.count; i++) {
          let x = pos.getX(i) + flock.velocities[i * 3] * dt;
          let y = pos.getY(i) + flock.velocities[i * 3 + 1] * dt;
          let z = pos.getZ(i) + flock.velocities[i * 3 + 2] * dt;

          // Slow upward velocity over time
          flock.velocities[i * 3 + 1] -= dt * 1.5;

          pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;

        // Fade out
        flock.material.opacity = Math.max(0, 1 - t);

        if (flock.stateTimer >= SCATTER_DURATION) {
          flock.state = 'hidden';
          flock.stateTimer = HIDDEN_MIN + Math.random() * (HIDDEN_MAX - HIDDEN_MIN);
          flock.material.opacity = 0;
        }
        break;
      }

      case 'hidden': {
        flock.stateTimer -= dt;
        if (flock.stateTimer <= 0) {
          // Pick new building and set perch positions
          const newBuilding = pickRandomBuilding(flock, flock.currentBuilding);
          flock.currentBuilding = newBuilding;
          const perchPos = getPerchPositions(newBuilding, flock.count);
          for (let i = 0; i < flock.count; i++) {
            pos.setXYZ(i, perchPos[i * 3], perchPos[i * 3 + 1], perchPos[i * 3 + 2]);
          }
          pos.needsUpdate = true;
          flock.state = 'appearing';
          flock.stateTimer = 0;
        }
        break;
      }

      case 'appearing': {
        flock.stateTimer += dt;
        const t = Math.min(1, flock.stateTimer / APPEAR_DURATION);
        flock.material.opacity = t;

        if (t >= 1) {
          flock.state = 'perched';
          flock.stateTimer = PERCH_MIN + Math.random() * (PERCH_MAX - PERCH_MIN);
        }
        break;
      }
    }

    // Color: gray → dark bird color
    _c.copy(BIRD_GRAY).lerp(BIRD_DARK, flock.localColor);
    flock.material.color.copy(_c);
  }
}
