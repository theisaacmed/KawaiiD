// Smoke/steam particle emitters on chimneys and named buildings
// Particles rise, drift with wind, fade and recycle

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const WIND = { x: 0.3, z: 0.15 };
const SMOKE_GRAY = new THREE.Color(0x999999);
const SMOKE_WARM = new THREE.Color(0xF0E8D8);
const _c = new THREE.Color();

const emitters = [];
let colorCheckTimer = 0;

// Emitter placements: { x, z, y (above terrain), district }
const EMITTER_DEFS = [
  // Nao's cafe rooftop steam — h=10, smoke from near rooftop
  { x: 8, z: 53.5, roofH: 9.5, district: 'downtown' },
  // Marco's restaurant chimney — h=11
  { x: 31, z: 54.5, roofH: 10.5, district: 'downtown' },
  // Town residential chimneys — offset to chimney position on roof
  { x: -6, z: 2.5, roofH: 8.5, district: 'town' },
  { x: -28, z: 9, roofH: 8.5, district: 'town' },
  // Burbs cottage chimney — h=6, lower buildings
  { x: 94, z: -22, roofH: 6, district: 'burbs' },
  // Northtown residential chimney — h=8
  { x: 71.5, z: 81.5, roofH: 7.5, district: 'northtown' },
];

const PARTICLES_PER_EMITTER = 10;
const MAX_AGE = 3.0;

export function createSmoke(scene) {
  for (const def of EMITTER_DEFS) {
    const terrainY = getTerrainHeight(def.x, def.z);
    const originY = terrainY + def.roofH + 0.5;

    const count = PARTICLES_PER_EMITTER;
    const positions = new Float32Array(count * 3);
    const ages = new Float32Array(count);

    // Stagger ages so particles are evenly distributed in lifecycle
    for (let i = 0; i < count; i++) {
      ages[i] = (i / count) * MAX_AGE;
      positions[i * 3] = def.x + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = originY + (ages[i] / MAX_AGE) * 2.5;
      positions[i * 3 + 2] = def.z + (Math.random() - 0.5) * 0.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x999999,
      size: 0.25,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    emitters.push({
      points,
      positions: geo.attributes.position,
      ages,
      material: mat,
      count,
      originX: def.x,
      originY,
      originZ: def.z,
      district: def.district,
      localColor: 0,
    });
  }
}

function refreshSmokeColors() {
  const buildings = getBuildingColors();
  for (const em of emitters) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - em.originX;
      const dz = b.z - em.originZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    em.localColor = weight > 0 ? total / weight : 0;
  }
}

export function updateSmoke(dt, elapsed) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= 3) {
    colorCheckTimer = 0;
    refreshSmokeColors();
  }

  for (const em of emitters) {
    const pos = em.positions;
    let ageSum = 0;

    for (let i = 0; i < em.count; i++) {
      em.ages[i] += dt;

      if (em.ages[i] >= MAX_AGE) {
        // Recycle particle
        pos.setXYZ(
          i,
          em.originX + (Math.random() - 0.5) * 0.2,
          em.originY,
          em.originZ + (Math.random() - 0.5) * 0.2
        );
        em.ages[i] = 0;
      } else {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        // Rise
        y += (0.8 + 0.3 * Math.sin(i * 2.7)) * dt;

        // Wind drift
        x += WIND.x * 0.4 * dt + Math.sin(elapsed + i * 1.3) * 0.05 * dt;
        z += WIND.z * 0.3 * dt;

        // Slight random spread
        x += (Math.random() - 0.5) * 0.02;
        z += (Math.random() - 0.5) * 0.02;

        pos.setXYZ(i, x, y, z);
      }

      ageSum += em.ages[i];
    }

    pos.needsUpdate = true;

    // Averaged size (grows as particles age)
    const avgT = ageSum / (em.count * MAX_AGE);
    em.material.size = 0.25 + 0.15 * avgT;

    // Gentle opacity pulse
    em.material.opacity = 0.25 + Math.sin(elapsed * 0.5 + em.originX) * 0.05;

    // Color: gray → warm cream
    _c.copy(SMOKE_GRAY).lerp(SMOKE_WARM, em.localColor);
    em.material.color.copy(_c);
  }
}
