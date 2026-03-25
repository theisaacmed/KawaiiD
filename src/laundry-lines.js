// Laundry lines — hanging cloth between buildings that sway in the wind
// Each line has a rope mesh and 3-5 cloth item meshes

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const GRAY = new THREE.Color(0xD0D0D0);
const _c = new THREE.Color();

// District palette pastels for cloth colors
const CLOTH_PALETTES = {
  town:      [0xFFB0C0, 0xA0C0FF, 0xC0FFB0, 0xFFE0A0, 0xE0B0FF],
  burbs:     [0xC0FFB0, 0xFFE0C0, 0xFFF0B0, 0xB0E0B0, 0xFFD0D0],
  northtown: [0xFFE0A0, 0xC0FFB0, 0xFFB0C0, 0xD0E8FF, 0xF0D0B0],
};

const laundryLines = [];
let colorCheckTimer = 0;

// Hardcoded anchor pairs: two points + height + district
// Placed between facing buildings or across alleys
const LINE_DEFS = [
  // Town — between Main St west buildings
  { x1: -9, z1: 4, x2: -5, z2: 4, h: 6, district: 'town' },
  { x1: -9, z1: 11, x2: -5, z2: 11, h: 5.5, district: 'town' },
  // Town — between west secondary buildings
  { x1: -26, z1: 5, x2: -22, z2: 5, h: 5, district: 'town' },
  // Town — east side
  { x1: 5, z1: 24, x2: 9, z2: 24, h: 6, district: 'town' },
  // Burbs — between houses
  { x1: 75, z1: -12, x2: 81, z2: -12, h: 4, district: 'burbs' },
  { x1: 87, z1: -10, x2: 93, z2: -10, h: 4.5, district: 'burbs' },
  { x1: 78, z1: 2, x2: 83, z2: 2, h: 4, district: 'burbs' },
  // Northtown — between residential rows
  { x1: 65, z1: 84, x2: 69, z2: 84, h: 5.5, district: 'northtown' },
  { x1: 74, z1: 94, x2: 79, z2: 94, h: 5, district: 'northtown' },
  { x1: 82, z1: 84, x2: 87, z2: 84, h: 5.5, district: 'northtown' },
];

export function createLaundry(scene) {
  for (const def of LINE_DEFS) {
    const t1 = getTerrainHeight(def.x1, def.z1);
    const t2 = getTerrainHeight(def.x2, def.z2);
    const avgTerrain = (t1 + t2) / 2;
    const ropeY = avgTerrain + def.h;

    const dx = def.x2 - def.x1;
    const dz = def.z2 - def.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const midX = (def.x1 + def.x2) / 2;
    const midZ = (def.z1 + def.z2) / 2;
    const angle = Math.atan2(dz, dx);

    // Rope mesh
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const ropeGeo = new THREE.CylinderGeometry(0.015, 0.015, length, 4);
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(midX, ropeY, midZ);
    rope.rotation.z = Math.PI / 2;
    rope.rotation.y = -angle;
    scene.add(rope);

    // Cloth items
    const palette = CLOTH_PALETTES[def.district] || CLOTH_PALETTES.town;
    const clothCount = 3 + Math.floor(Math.random() * 3); // 3-5
    const clothItems = [];

    for (let i = 0; i < clothCount; i++) {
      const t = (i + 1) / (clothCount + 1); // even spacing along rope
      const cx = def.x1 + dx * t;
      const cz = def.z1 + dz * t;
      const cy = ropeY - 0.3; // hang below rope

      const clothMat = new THREE.MeshLambertMaterial({ color: 0xD0D0D0 });
      // Vary cloth sizes slightly
      const cw = 0.3 + Math.random() * 0.2;
      const ch = 0.4 + Math.random() * 0.2;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.02), clothMat);
      cloth.position.set(cx, cy, cz);
      cloth.rotation.y = angle + (Math.random() - 0.5) * 0.3;
      cloth.castShadow = true;
      scene.add(cloth);

      clothItems.push({
        mesh: cloth,
        material: clothMat,
        baseX: cx,
        baseY: cy,
        baseZ: cz,
        phase: Math.random() * Math.PI * 2,
        targetColor: new THREE.Color(palette[i % palette.length]),
      });
    }

    laundryLines.push({
      rope,
      clothItems,
      x: midX,
      z: midZ,
      district: def.district,
      localColor: 0,
    });
  }
}

function refreshLaundryColors() {
  const buildings = getBuildingColors();
  for (const line of laundryLines) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - line.x;
      const dz = b.z - line.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    line.localColor = weight > 0 ? total / weight : 0;
  }
}

export function updateLaundry(dt, elapsed) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= 3) {
    colorCheckTimer = 0;
    refreshLaundryColors();
  }

  for (const line of laundryLines) {
    for (const ci of line.clothItems) {
      // Sway animation (absolute positions, no drift)
      ci.mesh.position.x = ci.baseX + Math.sin(elapsed * 1.2 + ci.phase) * 0.06;
      ci.mesh.position.y = ci.baseY + Math.sin(elapsed * 0.8 + ci.phase) * 0.03;
      ci.mesh.rotation.z = Math.sin(elapsed * 1.5 + ci.phase) * 0.15;

      // Color: white-gray → pastel
      _c.copy(GRAY).lerp(ci.targetColor, line.localColor);
      ci.material.color.copy(_c);
    }
  }
}
