// Road network — main roads, secondary roads, alleys, sidewalks, crosswalks, markings
// Roads define the city structure. Build these FIRST, then place buildings along them.

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

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

// ========== MAIN ROADS (5 units wide, #505050) ==========
const MAIN_ROADS = [
  // MAIN STREET: N-S through center (X ≈ 0)
  { x: 0, z: 0, w: 5, d: 264, label: 'Main Street' },
  // COAST ROAD: E-W along northern coast (Z ≈ 108)
  { x: 0, z: 108, w: 264, d: 5, label: 'Coast Road' },
  // EAST BOULEVARD: N-S on east side (X ≈ 90)
  { x: 90, z: 24, w: 5, d: 216, label: 'East Blvd' },
  // WEST AVENUE: N-S on west side (X ≈ -90)
  { x: -90, z: 18, w: 5, d: 216, label: 'West Ave' },
  // CROSS STREET: E-W through middle (Z ≈ 30)
  { x: 0, z: 30, w: 264, d: 5, label: 'Cross Street' },
  // INDUSTRIAL ROAD: E-W in south (Z ≈ -48)
  { x: 0, z: -48, w: 240, d: 5, label: 'Industrial Rd' },
];

// ========== SECONDARY ROADS (3 units wide, #555555) ==========
const SECONDARY_ROADS = [
  // Town internal streets
  { x: -24, z: 12, w: 3, d: 36 },
  { x: 24, z: 12, w: 3, d: 36 },
  { x: 0, z: -6, w: 48, d: 3 },
  // Downtown internal
  { x: -18, z: 60, w: 3, d: 36 },
  { x: 30, z: 72, w: 3, d: 30 },
  { x: 12, z: 84, w: 48, d: 3 },
  // Northtown
  { x: 78, z: 102, w: 36, d: 3 },
  { x: 66, z: 90, w: 3, d: 30 },
  // Burbs
  { x: 78, z: -12, w: 3, d: 36 },
  { x: 102, z: -24, w: 3, d: 30 },
  { x: 90, z: 0, w: 36, d: 3 },
  // Uptown
  { x: 102, z: 36, w: 3, d: 30 },
  { x: 114, z: 48, w: 3, d: 24 },
  // Tower
  { x: -84, z: 84, w: 36, d: 3 },
  { x: -72, z: 72, w: 3, d: 30 },
  // Industrial
  { x: -24, z: -60, w: 3, d: 30 },
  { x: 30, z: -60, w: 3, d: 30 },
  { x: 12, z: -72, w: 48, d: 3 },
  // Port
  { x: -48, z: 126, w: 36, d: 3 },
  { x: -36, z: 117, w: 3, d: 24 },
  // ACE HQ
  { x: -72, z: -36, w: 3, d: 30 },
  { x: -90, z: -24, w: 24, d: 3 },
  // Additional grid roads — filling gaps
  // Town-Downtown connector (E-W at Z=48)
  { x: 0, z: 48, w: 60, d: 3 },
  // Burbs E-W cross (Z=-24, connecting East Blvd interior)
  { x: 120, z: -24, w: 60, d: 3 },
  // Burbs N-S mid (X=108)
  { x: 108, z: -12, w: 3, d: 36 },
  // Uptown E-W link (Z=60, connecting Uptown to East Blvd)
  { x: 108, z: 60, w: 36, d: 3 },
  // Downtown-Tower E-W connector (Z=72)
  { x: -42, z: 72, w: 60, d: 3 },
  // Tower N-S mid (X=-72)
  { x: -72, z: 96, w: 3, d: 24 },
  // Industrial E-W cross (Z=-72)
  { x: -30, z: -72, w: 60, d: 3 },
  // Port connector (N-S at X=-60)
  { x: -60, z: 114, w: 3, d: 30 },
  // Town N internal (E-W at Z=18)
  { x: 0, z: 18, w: 48, d: 3 },
  // Northtown E-W link (Z=90)
  { x: 48, z: 90, w: 36, d: 3 },
];

// ========== ALLEYS (1.5 units wide, #585858) ==========
const ALLEYS = [
  // Town alleys
  { x: -12, z: 6, w: 1.5, d: 18 },
  { x: 15, z: 18, w: 18, d: 1.5 },
  // Downtown alleys
  { x: 6, z: 66, w: 1.5, d: 24 },
  { x: -9, z: 78, w: 21, d: 1.5 },
  // Northtown alley
  { x: 84, z: 96, w: 18, d: 1.5 },
  // Burbs alley
  { x: 96, z: -18, w: 1.5, d: 18 },
  // Uptown alley
  { x: 108, z: 42, w: 1.5, d: 15 },
  // Tower alleys
  { x: -78, z: 78, w: 1.5, d: 21 },
  { x: -93, z: 66, w: 15, d: 1.5 },
  // Industrial alleys
  { x: 18, z: -66, w: 1.5, d: 18 },
  // Port alley
  { x: -54, z: 123, w: 1.5, d: 15 },
  // ACE HQ - narrow
  { x: -81, z: -42, w: 1.5, d: 15 },
];

function createRoadSurface(scene, road, color) {
  const ty = getTerrainHeight(road.x, road.z);
  const geo = new THREE.BoxGeometry(road.w, 0.4, road.d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(road.x, ty + 0.01, road.z);
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
    let dx, dz;
    if (isHorizontal) {
      dx = road.x - length / 2 + i * 4 + 2;
      dz = road.z;
    } else {
      dx = road.x;
      dz = road.z - length / 2 + i * 4 + 2;
    }
    dash.position.set(dx, getTerrainHeight(dx, dz) + 0.025, dz);
    scene.add(dash);
    roadMarkings.push({ mesh: dash, material: mat, x: dx, z: dz });
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
      const sx = road.x, sz = road.z + side * (road.d / 2 + swWidth / 2);
      const ty = getTerrainHeight(sx, sz);
      const geo = new THREE.BoxGeometry(road.w, swHeight, swWidth);
      const mat = new THREE.MeshLambertMaterial({ color: swColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sx, ty + swHeight / 2, sz);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  } else {
    // Sidewalks on east and west sides
    for (const side of [-1, 1]) {
      const sx = road.x + side * (road.w / 2 + swWidth / 2), sz = road.z;
      const ty = getTerrainHeight(sx, sz);
      const geo = new THREE.BoxGeometry(swWidth, swHeight, road.d);
      const mat = new THREE.MeshLambertMaterial({ color: swColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sx, ty + swHeight / 2, sz);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

function createCrosswalks(scene) {
  // At major intersections
  const intersections = [
    // Main Street x Cross Street
    { x: 0, z: 30 },
    // Main Street x Coast Road
    { x: 0, z: 108 },
    // Main Street x Industrial Road
    { x: 0, z: -48 },
    // Main Street x Town center
    { x: 0, z: 12 },
    // East Blvd x Cross Street
    { x: 90, z: 30 },
    // East Blvd x Coast Road
    { x: 90, z: 108 },
    // West Ave x Cross Street
    { x: -90, z: 30 },
    // West Ave x Coast Road
    { x: -90, z: 108 },
    // West Ave x Industrial
    { x: -90, z: -48 },
    // East Blvd x Industrial
    { x: 90, z: -48 },
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
        let sx, sz;
        if (isHoriz) {
          sx = cw.x - 2.1 + i * 0.7;
          sz = cw.z + offset;
        } else {
          sx = cw.x + offset;
          sz = cw.z - 2.1 + i * 0.7;
        }
        stripe.position.set(sx, getTerrainHeight(sx, sz) + 0.025, sz);
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
    const x = (Math.random() - 0.5) * 120;
    const z = -72 - Math.random() * 48;
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.5 + Math.random() * 2),
      crackMat
    );
    crack.position.set(x, getTerrainHeight(x, z) + 0.015, z);
    crack.rotation.y = Math.random() * Math.PI;
    scene.add(crack);
  }
}

// ========== MAIN EXPORT ==========
export function createRoads(scene) {
  // Main roads
  for (const road of MAIN_ROADS) {
    createRoadSurface(scene, road, 0x505050);
    createDashedCenterLine(scene, road);
    createSidewalks(scene, road);
  }

  // Secondary roads
  for (const road of SECONDARY_ROADS) {
    createRoadSurface(scene, road, 0x555555);
  }

  // Alleys
  for (const road of ALLEYS) {
    createRoadSurface(scene, road, 0x585858);
  }

  // Crosswalks removed

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
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 5, type: 'main' });
  }
  for (const r of SECONDARY_ROADS) {
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 3, type: 'secondary' });
  }
  for (const r of ALLEYS) {
    segments.push({ x: r.x, z: r.z, w: r.w, d: r.d, roadWidth: 1.5, type: 'alley' });
  }
  return segments;
}
