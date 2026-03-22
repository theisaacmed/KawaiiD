// Road network — main roads, secondary roads, alleys, sidewalks, crosswalks, markings
// Roads define the city structure. Build these FIRST, then place buildings along them.

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';

// Road marking pastel targets (when color spreads)
const ROAD_MARKING_PASTEL = [
  new THREE.Color(0xFFB0C0), // pink
  new THREE.Color(0xA0C0FF), // blue
  new THREE.Color(0xC0FFB0), // mint
];

// State for color updates
const roadMarkings = []; // { mesh, material, x, z }
const allRoadMeshes = []; // for minimap / collision

// Temp color
const _c = new THREE.Color();

// ========== MAIN ROADS (8 units wide, #505050) ==========
const MAIN_ROADS = [
  // MAIN STREET: N-S through center (X ≈ 0)
  { x: 0, z: 0, w: 8, d: 440, label: 'Main Street' },
  // COAST ROAD: E-W along northern coast (Z ≈ 180)
  { x: 0, z: 180, w: 440, d: 8, label: 'Coast Road' },
  // EAST BOULEVARD: N-S on east side (X ≈ 150)
  { x: 150, z: 40, w: 8, d: 360, label: 'East Blvd' },
  // WEST AVENUE: N-S on west side (X ≈ -150)
  { x: -150, z: 30, w: 8, d: 360, label: 'West Ave' },
  // CROSS STREET: E-W through middle (Z ≈ 50)
  { x: 0, z: 50, w: 440, d: 8, label: 'Cross Street' },
  // INDUSTRIAL ROAD: E-W in south (Z ≈ -80)
  { x: 0, z: -80, w: 400, d: 8, label: 'Industrial Rd' },
];

// ========== SECONDARY ROADS (5 units wide, #555555) ==========
const SECONDARY_ROADS = [
  // Town internal streets
  { x: -40, z: 20, w: 5, d: 60 },
  { x: 40, z: 20, w: 5, d: 60 },
  { x: 0, z: -10, w: 80, d: 5 },
  // Downtown internal
  { x: -30, z: 100, w: 5, d: 60 },
  { x: 50, z: 120, w: 5, d: 50 },
  { x: 20, z: 140, w: 80, d: 5 },
  // Northtown
  { x: 130, z: 170, w: 60, d: 5 },
  { x: 110, z: 150, w: 5, d: 50 },
  // Burbs
  { x: 130, z: -20, w: 5, d: 60 },
  { x: 170, z: -40, w: 5, d: 50 },
  { x: 150, z: 0, w: 60, d: 5 },
  // Uptown
  { x: 170, z: 60, w: 5, d: 50 },
  { x: 190, z: 80, w: 5, d: 40 },
  // Tower
  { x: -140, z: 140, w: 60, d: 5 },
  { x: -120, z: 120, w: 5, d: 50 },
  // Industrial
  { x: -40, z: -100, w: 5, d: 50 },
  { x: 50, z: -100, w: 5, d: 50 },
  { x: 20, z: -120, w: 80, d: 5 },
  // Port
  { x: -80, z: 210, w: 60, d: 5 },
  { x: -60, z: 195, w: 5, d: 40 },
  // ACE HQ
  { x: -120, z: -60, w: 5, d: 50 },
  { x: -150, z: -40, w: 40, d: 5 },
];

// ========== ALLEYS (2.5 units wide, #585858) ==========
const ALLEYS = [
  // Town alleys
  { x: -20, z: 10, w: 2.5, d: 30 },
  { x: 25, z: 30, w: 30, d: 2.5 },
  // Downtown alleys
  { x: 10, z: 110, w: 2.5, d: 40 },
  { x: -15, z: 130, w: 35, d: 2.5 },
  // Northtown alley
  { x: 140, z: 160, w: 30, d: 2.5 },
  // Burbs alley
  { x: 160, z: -30, w: 2.5, d: 30 },
  // Uptown alley
  { x: 180, z: 70, w: 2.5, d: 25 },
  // Tower alleys
  { x: -130, z: 130, w: 2.5, d: 35 },
  { x: -155, z: 110, w: 25, d: 2.5 },
  // Industrial alleys
  { x: 30, z: -110, w: 2.5, d: 30 },
  // Port alley
  { x: -90, z: 205, w: 2.5, d: 25 },
  // ACE HQ - narrow
  { x: -135, z: -70, w: 2.5, d: 25 },
];

function createRoadSurface(scene, road, color, yOffset) {
  const geo = new THREE.BoxGeometry(road.w, 0.02, road.d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(road.x, yOffset, road.z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  allRoadMeshes.push({ x: road.x, z: road.z, w: road.w, d: road.d });
  return mesh;
}

function createDashedCenterLine(scene, road) {
  const markMat = new THREE.MeshBasicMaterial({ color: 0x707070 });
  const isHorizontal = road.w > road.d;
  const length = isHorizontal ? road.w : road.d;
  const count = Math.floor(length / 4);

  for (let i = 0; i < count; i++) {
    const dashW = isHorizontal ? 2 : 0.15;
    const dashD = isHorizontal ? 0.15 : 2;
    const mat = markMat.clone();
    const dash = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.025, dashD), mat);
    if (isHorizontal) {
      dash.position.set(road.x - length / 2 + i * 4 + 2, 0.025, road.z);
    } else {
      dash.position.set(road.x, 0.025, road.z - length / 2 + i * 4 + 2);
    }
    scene.add(dash);
    roadMarkings.push({ mesh: dash, material: mat, x: dash.position.x, z: dash.position.z });
  }
}

function createSidewalks(scene, road) {
  const swColor = 0x8A8A8A;
  const swWidth = 0.8;
  const swHeight = 0.05;
  const isHorizontal = road.w > road.d;

  if (isHorizontal) {
    // Sidewalks on north and south sides
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(road.w, swHeight, swWidth);
      const mat = new THREE.MeshLambertMaterial({ color: swColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(road.x, swHeight / 2, road.z + side * (road.d / 2 + swWidth / 2));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  } else {
    // Sidewalks on east and west sides
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(swWidth, swHeight, road.d);
      const mat = new THREE.MeshLambertMaterial({ color: swColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(road.x + side * (road.w / 2 + swWidth / 2), swHeight / 2, road.z);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

function createCrosswalks(scene) {
  // At major intersections
  const intersections = [
    // Main Street x Cross Street
    { x: 0, z: 50 },
    // Main Street x Coast Road
    { x: 0, z: 180 },
    // Main Street x Industrial Road
    { x: 0, z: -80 },
    // Main Street x Town center
    { x: 0, z: 20 },
    // East Blvd x Cross Street
    { x: 150, z: 50 },
    // East Blvd x Coast Road
    { x: 150, z: 180 },
    // West Ave x Cross Street
    { x: -150, z: 50 },
    // West Ave x Coast Road
    { x: -150, z: 180 },
    // West Ave x Industrial
    { x: -150, z: -80 },
    // East Blvd x Industrial
    { x: 150, z: -80 },
  ];

  const cwMat = new THREE.MeshBasicMaterial({ color: 0xCCCCCC });
  for (const cw of intersections) {
    // 4 crosswalks per intersection (N, S, E, W)
    for (const dir of ['n', 's', 'e', 'w']) {
      const isHoriz = dir === 'n' || dir === 's';
      const offset = dir === 'n' ? -6 : dir === 's' ? 6 : dir === 'w' ? -6 : 6;
      for (let i = -3; i <= 3; i++) {
        const mat = cwMat.clone();
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(
            isHoriz ? 6 : 0.4,
            0.025,
            isHoriz ? 0.4 : 6
          ),
          mat
        );
        if (isHoriz) {
          stripe.position.set(cw.x, 0.025, cw.z + offset + i * 0.7 * 0);
          // Actually position along the offset axis
          stripe.position.set(cw.x, 0.025, cw.z + offset);
          stripe.position.x = cw.x - 2.1 + i * 0.7;
          stripe.position.z = cw.z + offset;
        } else {
          stripe.position.set(cw.x + offset, 0.025, cw.z - 2.1 + i * 0.7);
        }
        scene.add(stripe);
        roadMarkings.push({ mesh: stripe, material: mat, x: cw.x, z: cw.z });
      }
    }
  }
}

// Cracking effect for roads approaching ruins
function createCrackedTransition(scene) {
  // Roads south of z = -120 get progressively cracked
  const crackMat = new THREE.MeshLambertMaterial({ color: 0x404040 });
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 200;
    const z = -120 - Math.random() * 80;
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.5 + Math.random() * 2),
      crackMat
    );
    crack.position.set(x, 0.015, z);
    crack.rotation.y = Math.random() * Math.PI;
    scene.add(crack);
  }
}

// ========== MAIN EXPORT ==========
export function createRoads(scene) {
  // Main roads
  for (const road of MAIN_ROADS) {
    createRoadSurface(scene, road, 0x505050, 0.01);
    createDashedCenterLine(scene, road);
    createSidewalks(scene, road);
  }

  // Secondary roads
  for (const road of SECONDARY_ROADS) {
    createRoadSurface(scene, road, 0x555555, 0.008);
  }

  // Alleys
  for (const road of ALLEYS) {
    createRoadSurface(scene, road, 0x585858, 0.006);
  }

  // Crosswalks at major intersections
  createCrosswalks(scene);

  // Cracked transition to ruins
  createCrackedTransition(scene);
}

// ========== COLOR UPDATE ==========
const cachedLocalColors = new Map();
let colorCheckTimer = 0;

function refreshLocalColors() {
  cachedLocalColors.clear();
  const buildings = getBuildingColors();
  for (const rm of roadMarkings) {
    let total = 0, count = 0;
    for (const b of buildings) {
      const dx = b.x - rm.x;
      const dz = b.z - rm.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const weight = 1 - dist / 30;
        total += b.displayAmount * weight;
        count += weight;
      }
    }
    const localColor = count > 0 ? total / count : 0;
    cachedLocalColors.set(`${Math.round(rm.x)},${Math.round(rm.z)}`, localColor);
  }
}

export function updateRoads(dt) {
  colorCheckTimer += dt;
  if (colorCheckTimer < 3) return;
  colorCheckTimer = 0;
  refreshLocalColors();

  for (const rm of roadMarkings) {
    const localColor = cachedLocalColors.get(`${Math.round(rm.x)},${Math.round(rm.z)}`) || 0;
    if (localColor > 0.3) {
      const pastel = ROAD_MARKING_PASTEL[
        Math.abs(Math.floor(rm.x * 3 + rm.z * 5)) % ROAD_MARKING_PASTEL.length
      ];
      _c.set(0xCCCCCC).lerp(pastel, (localColor - 0.3) / 0.7);
      rm.material.color.copy(_c);
    }
  }
}

// Get all road data for minimap
export function getRoadData() {
  return allRoadMeshes;
}

// Get road segment data for building placement validation
// Returns array of { x, z, w, d, roadWidth } where roadWidth is the actual road width category
export function getRoadSegments() {
  const segments = [];
  for (const r of MAIN_ROADS) {
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 8, type: 'main' });
  }
  for (const r of SECONDARY_ROADS) {
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 5, type: 'secondary' });
  }
  for (const r of ALLEYS) {
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 2.5, type: 'alley' });
  }
  return segments;
}
