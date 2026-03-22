// World detail — street furniture, benches, trash cans, parked cars, fences, trees
// All objects respond to the color system via nearby building colorAmount
// Roads are now handled by roads.js. This file only does furniture/props.

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';

// Color targets
const GRAY = new THREE.Color(0x808080);
const BENCH_COLOR = new THREE.Color(0x8B5E3C);
const FENCE_WHITE = new THREE.Color(0xF0E8D8);
const FENCE_BROWN = new THREE.Color(0x7A5230);
const CAR_COLORS = [
  new THREE.Color(0x4477BB),
  new THREE.Color(0xBB4444),
  new THREE.Color(0xE8E8E8),
  new THREE.Color(0x44AA66),
  new THREE.Color(0xCC8833),
];
const TREE_TRUNK_COLOR = new THREE.Color(0x6B4226);
const TREE_CANOPY_COLOR = new THREE.Color(0x3A8A3A);
const ROAD_MARKING_PASTEL = [
  new THREE.Color(0xFFB0C0),
  new THREE.Color(0xA0C0FF),
  new THREE.Color(0xC0FFB0),
];

const worldObjects = [];
const _c = new THREE.Color();
let fountainParts = null;

function createBenches(scene) {
  // Benches placed around Town district
  const positions = [
    { x: -15, z: 18 }, { x: 8, z: 22 }, { x: -25, z: 30 },
    { x: 20, z: 12 }, { x: -5, z: 38 }, { x: 30, z: 35 },
    { x: -35, z: 10 }, { x: 15, z: -5 },
  ];

  for (const pos of positions) {
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), benchMat);
    seat.position.y = 0.45; seat.castShadow = true; group.add(seat);

    for (const lx of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), benchMat);
      leg.position.set(lx, 0.225, 0); group.add(leg);
    }

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.06), benchMat);
    back.position.set(0, 0.7, -0.22); back.castShadow = true; group.add(back);

    scene.add(group);
    worldObjects.push({ mesh: group, material: benchMat, type: 'bench', targetColor: BENCH_COLOR, x: pos.x, z: pos.z });
  }
}

function createTrashCans(scene) {
  const positions = [
    { x: -20, z: -8 }, { x: 5, z: 10 }, { x: 25, z: 25 },
    { x: -30, z: 35 }, { x: 35, z: 8 }, { x: -10, z: 38 },
    { x: 15, z: 32 }, { x: -35, z: 12 },
  ];

  for (const pos of positions) {
    const canMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.7, 8), canMat);
    body.position.y = 0.35; body.castShadow = true; group.add(body);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 8), canMat);
    lid.position.y = 0.73; group.add(lid);

    const stickerMat = new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: 0 });
    const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.01), stickerMat);
    sticker.position.set(0, 0.4, 0.26); group.add(sticker);

    scene.add(group);
    worldObjects.push({ mesh: group, material: canMat, type: 'trashcan', targetColor: new THREE.Color(0x606060), stickerMat, x: pos.x, z: pos.z });
  }
}

function createParkedCars(scene) {
  const positions = [
    { x: -28, z: -5, rot: 0 },
    { x: 30, z: -10, rot: Math.PI / 2 },
    { x: -22, z: 30, rot: 0 },
    { x: 25, z: 35, rot: Math.PI / 2 },
    { x: 15, z: -8, rot: 0 },
    { x: -35, z: 20, rot: Math.PI / 2 },
    { x: 38, z: 15, rot: 0 },
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const carMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = pos.rot;

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.2), carMat);
    body.position.y = 0.5; body.castShadow = true; group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), carMat);
    cabin.position.set(-0.1, 1.05, 0); cabin.castShadow = true; group.add(cabin);

    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const wx of [-0.6, 0.6]) {
      for (const wz of [-0.55, 0.55]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), wheelMat);
        wheel.position.set(wx, 0.2, wz); wheel.rotation.x = Math.PI / 2; group.add(wheel);
      }
    }

    scene.add(group);
    worldObjects.push({ mesh: group, material: carMat, type: 'car', targetColor: CAR_COLORS[i % CAR_COLORS.length], x: pos.x, z: pos.z });
  }
}

function createFences(scene) {
  const segments = [
    { x: -25, z: 5, w: 3, rot: 0 },
    { x: 30, z: 5, w: 2.5, rot: 0 },
    { x: -30, z: 25, w: 4, rot: Math.PI / 2 },
    { x: 35, z: 25, w: 3, rot: Math.PI / 2 },
    { x: -15, z: 40, w: 3, rot: 0 },
  ];

  for (let i = 0; i < segments.length; i++) {
    const f = segments[i];
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    const group = new THREE.Group();
    group.position.set(f.x, 0, f.z);
    group.rotation.y = f.rot;

    const rail = new THREE.Mesh(new THREE.BoxGeometry(f.w, 0.08, 0.06), fenceMat);
    rail.position.y = 0.8; rail.castShadow = true; group.add(rail);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(f.w, 0.08, 0.06), fenceMat);
    rail2.position.y = 0.4; group.add(rail2);

    const postCount = Math.ceil(f.w / 0.8);
    for (let p = 0; p <= postCount; p++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), fenceMat);
      post.position.set(-f.w / 2 + p * (f.w / postCount), 0.5, 0);
      post.castShadow = true; group.add(post);
    }

    scene.add(group);
    worldObjects.push({ mesh: group, material: fenceMat, type: 'fence', targetColor: i % 2 === 0 ? FENCE_WHITE : FENCE_BROWN, x: f.x, z: f.z });
  }
}

function createTrees(scene) {
  // Trees scattered around Town
  const positions = [
    { x: -28, z: -12 }, { x: 28, z: -10 }, { x: -38, z: 15 },
    { x: 38, z: 18 }, { x: -10, z: 40 }, { x: 25, z: 40 },
    { x: -20, z: 0 }, { x: 15, z: 0 },
  ];

  for (const tp of positions) {
    const group = new THREE.Group();
    group.position.set(tp.x, 0, tp.z);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.0, 6), trunkMat);
    trunk.position.y = 1.0; trunk.castShadow = true; group.add(trunk);

    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x686868 });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), canopyMat);
    canopy.position.y = 2.8; canopy.castShadow = true; group.add(canopy);

    scene.add(group);
    worldObjects.push({
      mesh: group, material: canopyMat, type: 'tree',
      targetColor: TREE_CANOPY_COLOR, trunkMat,
      trunkTarget: TREE_TRUNK_COLOR,
      x: tp.x, z: tp.z,
    });
  }
}

// Street lamps along main roads in Town
function createStreetLamps(scene) {
  const positions = [
    { x: -5, z: -5 }, { x: 5, z: -5 }, { x: -5, z: 15 },
    { x: 5, z: 15 }, { x: -5, z: 35 }, { x: 5, z: 35 },
    { x: -20, z: 20 }, { x: 20, z: 20 },
  ];

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

  for (const pos of positions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.5, 6), poleMat);
    pole.position.set(pos.x, 1.75, pos.z);
    pole.castShadow = true;
    scene.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lampMat);
    lamp.position.set(pos.x, 3.6, pos.z);
    scene.add(lamp);
  }
}

// ACE propaganda posters on building walls
function createACEPosters(scene) {
  // Town: 3 posters
  const townPosters = [
    { x: -30, z: -10 + 2.5 + 0.03, ry: 0 },      // on building front wall
    { x: 10, z: -10 + 2.0 + 0.03, ry: 0 },
    { x: 35, z: 12 + 3.0 + 0.03, ry: 0 },
  ];
  // Downtown: 6 posters
  const dtPosters = [
    { x: -20, z: 90 + 2.5 + 0.03, ry: 0 },
    { x: 18, z: 90 + 3.0 + 0.03, ry: 0 },
    { x: -25, z: 110 + 2.5 + 0.03, ry: 0 },
    { x: 38, z: 112 + 3.0 + 0.03, ry: 0 },
    { x: 52, z: 108 + 2.5 + 0.03, ry: 0 },
    { x: -18, z: 130 + 2.5 + 0.03, ry: 0 },
  ];

  const posterMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const aceMat = new THREE.MeshBasicMaterial({ color: 0x883333 });

  for (const p of [...townPosters, ...dtPosters]) {
    // Poster backing
    const poster = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.04), posterMat);
    poster.position.set(p.x, 2.0, p.z);
    poster.rotation.y = p.ry;
    scene.add(poster);
    // ACE symbol (smaller red box inside)
    const symbol = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), aceMat);
    symbol.position.set(p.x, 2.0, p.z + 0.01);
    symbol.rotation.y = p.ry;
    scene.add(symbol);
  }
}

// Bus stop shelter on Main Street (Town)
function createBusStop(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x555560, transparent: true, opacity: 0.6 });
  const x = 6, z = 5; // along Main Street in Town

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.5), mat);
  roof.position.set(x, 2.5, z);
  roof.castShadow = true;
  scene.add(roof);

  // Two support poles
  for (const px of [-1.3, 1.3]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), mat);
    pole.position.set(x + px, 1.25, z + 0.65);
    pole.castShadow = true;
    scene.add(pole);
  }

  // Glass back panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 2.0, 0.06), glassMat);
  panel.position.set(x, 1.2, z - 0.7);
  scene.add(panel);

  // Small bench inside
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), mat);
  bench.position.set(x, 0.5, z - 0.4);
  scene.add(bench);

  worldObjects.push({ mesh: roof, material: mat, type: 'bench', targetColor: BENCH_COLOR, x, z });
}

// Downtown: newspaper boxes (small thin boxes on sidewalks)
function createNewspaperBoxes(scene) {
  const positions = [
    { x: -8, z: 92 + 3 }, { x: 32, z: 92 + 3 },
    { x: 5, z: 88 + 3 }, { x: 22, z: 110 + 3 },
  ];

  const boxMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  for (const pos of positions) {
    const group = new THREE.Group();
    group.position.set(pos.x + 2, 0, pos.z);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.3), boxMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.35), boxMat);
    top.position.y = 0.92;
    group.add(top);

    scene.add(group);
    worldObjects.push({ mesh: group, material: boxMat, type: 'bench', targetColor: new THREE.Color(0x4477BB), x: pos.x + 2, z: pos.z });
  }
}

// Downtown: construction barriers on side street (ACE renovation area)
function createConstructionBarriers(scene) {
  // Place on a side street area near downtown edge
  const barriers = [
    { x: 45, z: 100 },
    { x: 47, z: 100 },
    { x: 49, z: 100 },
    { x: 46, z: 103 },
    { x: 48, z: 103 },
  ];

  for (const b of barriers) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x666055 }); // orange-gray
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.15), barMat);
    barrier.position.set(b.x, 0.4, b.z);
    barrier.castShadow = true;
    scene.add(barrier);

    // Stripe (darker band)
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x554433 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.16), stripeMat);
    stripe.position.set(b.x, 0.5, b.z);
    scene.add(stripe);
  }
}

// Downtown street lamps (10 total)
function createDowntownStreetLamps(scene) {
  const positions = [
    { x: -20, z: 85 }, { x: 18, z: 85 }, { x: 45, z: 85 },
    { x: -25, z: 105 }, { x: 8, z: 105 }, { x: 38, z: 105 },
    { x: 52, z: 105 }, { x: -18, z: 125 }, { x: 28, z: 125 },
    { x: 55, z: 125 },
  ];

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

  for (const pos of positions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.5, 6), poleMat);
    pole.position.set(pos.x, 1.75, pos.z);
    pole.castShadow = true;
    scene.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lampMat);
    lamp.position.set(pos.x, 3.6, pos.z);
    scene.add(lamp);
  }
}

// Downtown trash cans (6)
function createDowntownTrashCans(scene) {
  const positions = [
    { x: -8, z: 86 }, { x: 32, z: 86 }, { x: 5, z: 95 },
    { x: 22, z: 115 }, { x: -10, z: 115 }, { x: 42, z: 128 },
  ];

  for (const pos of positions) {
    const canMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.7, 8), canMat);
    body.position.y = 0.35; body.castShadow = true; group.add(body);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 8), canMat);
    lid.position.y = 0.73; group.add(lid);

    scene.add(group);
    worldObjects.push({ mesh: group, material: canMat, type: 'trashcan', targetColor: new THREE.Color(0x606060), x: pos.x, z: pos.z });
  }
}

// Downtown parked cars (5)
function createDowntownParkedCars(scene) {
  const positions = [
    { x: -15, z: 88, rot: Math.PI / 2 },
    { x: 40, z: 95, rot: 0 },
    { x: -22, z: 115, rot: Math.PI / 2 },
    { x: 48, z: 115, rot: 0 },
    { x: 15, z: 135, rot: Math.PI / 2 },
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const carMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = pos.rot;

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.2), carMat);
    body.position.y = 0.5; body.castShadow = true; group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), carMat);
    cabin.position.set(-0.1, 1.05, 0); cabin.castShadow = true; group.add(cabin);

    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const wx of [-0.6, 0.6]) {
      for (const wz of [-0.55, 0.55]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), wheelMat);
        wheel.position.set(wx, 0.2, wz); wheel.rotation.x = Math.PI / 2; group.add(wheel);
      }
    }

    scene.add(group);
    worldObjects.push({ mesh: group, material: carMat, type: 'car', targetColor: CAR_COLORS[i % CAR_COLORS.length], x: pos.x, z: pos.z });
  }
}

export function createWorldDetail(scene) {
  // Town furniture
  createBenches(scene);
  createTrashCans(scene);
  createParkedCars(scene);
  createFences(scene);
  createTrees(scene);
  createStreetLamps(scene);
  createBusStop(scene);

  // Downtown furniture
  createDowntownStreetLamps(scene);
  createDowntownTrashCans(scene);
  createDowntownParkedCars(scene);
  createNewspaperBoxes(scene);
  createConstructionBarriers(scene);

  // Shared
  createACEPosters(scene);

  return { worldObjects, fountainParts: null, parkTrees: [] };
}

// Per-frame update: color world objects based on nearby building color
const cachedLocalColors = new Map();
let colorCheckTimer = 0;
const COLOR_CHECK_INTERVAL = 3;

function refreshLocalColors() {
  cachedLocalColors.clear();
  const buildings = getBuildingColors();
  for (const obj of worldObjects) {
    let total = 0, count = 0;
    for (const b of buildings) {
      const dx = b.x - obj.x;
      const dz = b.z - obj.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const weight = 1 - dist / 30;
        total += b.displayAmount * weight;
        count += weight;
      }
    }
    const localColor = count > 0 ? total / count : 0;
    cachedLocalColors.set(`${Math.round(obj.x)},${Math.round(obj.z)}`, localColor);
  }
}

function getLocalColor(x, z) {
  return cachedLocalColors.get(`${Math.round(x)},${Math.round(z)}`) || 0;
}

export function updateWorldDetail(dt) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= COLOR_CHECK_INTERVAL) {
    colorCheckTimer = 0;
    refreshLocalColors();
  }

  for (const obj of worldObjects) {
    const localColor = getLocalColor(obj.x, obj.z);

    if (obj.type === 'bench') {
      _c.set(0x707070).lerp(obj.targetColor, localColor);
      obj.material.color.copy(_c);
    } else if (obj.type === 'trashcan') {
      if (obj.stickerMat) {
        obj.stickerMat.opacity = localColor > 0.2 ? Math.min(1, (localColor - 0.2) * 2) : 0;
        if (localColor > 0.2) {
          const stickerColor = ROAD_MARKING_PASTEL[Math.floor(obj.x * 7 + obj.z * 3) % ROAD_MARKING_PASTEL.length];
          if (stickerColor) obj.stickerMat.color.copy(stickerColor);
        }
      }
    } else if (obj.type === 'car') {
      _c.set(0x555555).lerp(obj.targetColor, localColor);
      obj.material.color.copy(_c);
    } else if (obj.type === 'fence') {
      _c.set(0x707070).lerp(obj.targetColor, localColor);
      obj.material.color.copy(_c);
    } else if (obj.type === 'tree') {
      _c.set(0x686868).lerp(obj.targetColor, localColor);
      obj.material.color.copy(_c);
      if (obj.trunkMat) {
        _c.set(0x606060).lerp(obj.trunkTarget, localColor);
        obj.trunkMat.color.copy(_c);
      }
    }
  }
}

// Expose fountain data for particles — now in buildings.js
export function getFountainData() {
  // Delegate to buildings.js getFountainData
  return null; // Overridden in main.js
}

export function getLocalColorAmount(x, z) {
  return getLocalColor(x, z);
}

export function getWorldObjects() {
  return worldObjects;
}
