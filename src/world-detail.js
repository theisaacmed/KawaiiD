// World detail — street furniture, benches, trash cans, parked cars, fences, trees
// All objects respond to the color system via nearby building colorAmount
// Roads are now handled by roads.js. This file only does furniture/props.

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

// Color targets
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
// Fountain removed

function createBenches(scene) {
  // Benches placed around Town district — doubled count, positions ×0.6
  const positions = [
    { x: -5.4, z: 6.6 }, { x: 3, z: 7.8 }, { x: -9, z: 10.8 },
    { x: 7.2, z: 4.2 }, { x: -1.8, z: 13.8 }, { x: 10.8, z: 12.6 },
    { x: -12.6, z: 3.6 }, { x: 5.4, z: -1.8 },
    { x: -3.6, z: 9.6 }, { x: 8.4, z: 1.8 }, { x: -10.8, z: 5.4 },
    { x: 4.2, z: 11.4 }, { x: -6, z: 15.6 }, { x: 12, z: 6 },
    // Additional benches
    { x: -7.2, z: 3 }, { x: 4.8, z: 10.2 }, { x: -11.4, z: 7.8 },
    { x: 9, z: 6 }, { x: -2.4, z: 15 }, { x: 12.6, z: 8.4 },
    { x: -13.8, z: 4.8 }, { x: 6.6, z: -3 },
    { x: -4.2, z: 11.4 }, { x: 9.6, z: 3 }, { x: -12, z: 6.6 },
    { x: 5.4, z: 13.2 }, { x: -7.8, z: 17.4 }, { x: 13.8, z: 7.2 },
  ];

  for (const pos of positions) {
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    const group = new THREE.Group();
    group.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);

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
  // Doubled count, positions ×0.6
  const positions = [
    { x: -7.2, z: -3 }, { x: 1.8, z: 3.6 }, { x: 9, z: 9 },
    { x: -10.8, z: 12.6 }, { x: 12.6, z: 3 }, { x: -3.6, z: 13.8 },
    { x: 5.4, z: 11.4 }, { x: -12.6, z: 4.2 },
    { x: -4.8, z: 1.2 }, { x: 6.6, z: 7.8 }, { x: -8.4, z: 10.8 },
    { x: 10.2, z: -1.2 }, { x: -2.4, z: 14.4 }, { x: 13.8, z: 6.6 },
    // Additional
    { x: -9, z: -1.8 }, { x: 3, z: 5.4 }, { x: 11.4, z: 11.4 },
    { x: -12, z: 14.4 }, { x: 13.8, z: 4.2 }, { x: -4.2, z: 15 },
    { x: 7.8, z: 13.2 }, { x: -13.8, z: 5.4 },
    { x: -6, z: 0 }, { x: 8.4, z: 9.6 }, { x: -10.2, z: 12 },
    { x: 11.4, z: -2.4 }, { x: -3, z: 16.2 }, { x: 15, z: 8.4 },
  ];

  for (const pos of positions) {
    const canMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const group = new THREE.Group();
    group.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);

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
  // More cars, positions ×0.6
  const positions = [
    { x: -10.2, z: -1.8, rot: 0 },
    { x: 10.8, z: -3.6, rot: Math.PI / 2 },
    { x: -7.8, z: 10.8, rot: 0 },
    { x: 9, z: 12.6, rot: Math.PI / 2 },
    { x: 5.4, z: -3, rot: 0 },
    { x: -12.6, z: 7.2, rot: Math.PI / 2 },
    { x: 13.8, z: 5.4, rot: 0 },
    { x: -8.4, z: 4.2, rot: 0 },
    { x: 12, z: 1.8, rot: Math.PI / 2 },
    { x: -11.4, z: 13.8, rot: 0 },
    { x: 7.8, z: -2.4, rot: Math.PI / 2 },
    { x: -13.8, z: 10.2, rot: 0 },
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const carMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const group = new THREE.Group();
    group.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);
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
  // Positions ×0.6
  const segments = [
    { x: -9, z: 1.8, w: 3, rot: 0 },
    { x: 10.8, z: 1.8, w: 2.5, rot: 0 },
    { x: -10.8, z: 9, w: 4, rot: Math.PI / 2 },
    { x: 12.6, z: 9, w: 3, rot: Math.PI / 2 },
    { x: -5.4, z: 14.4, w: 3, rot: 0 },
  ];

  for (let i = 0; i < segments.length; i++) {
    const f = segments[i];
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    const group = new THREE.Group();
    group.position.set(f.x, getTerrainHeight(f.x, f.z), f.z);
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
  // Positions ×0.6
  const positions = [
    { x: -10.2, z: -4.2 }, { x: 10.2, z: -3.6 }, { x: -13.8, z: 5.4 },
    { x: 13.8, z: 6.6 }, { x: -3.6, z: 14.4 }, { x: 9, z: 14.4 },
    { x: -7.2, z: 0 }, { x: 5.4, z: 0 },
  ];

  for (const tp of positions) {
    const group = new THREE.Group();
    group.position.set(tp.x, getTerrainHeight(tp.x, tp.z), tp.z);

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

// Street lamps along main roads in Town — doubled, tighter intervals, positions ×0.6
function createStreetLamps(scene) {
  const positions = [
    // Along Main Street (x≈±1.8)
    { x: -1.8, z: -4.8 }, { x: 1.8, z: -4.8 },
    { x: -1.8, z: -1.8 }, { x: 1.8, z: -1.8 },
    { x: -1.8, z: 1.8 },  { x: 1.8, z: 1.8 },
    { x: -1.8, z: 5.4 },  { x: 1.8, z: 5.4 },
    { x: -1.8, z: 9 },    { x: 1.8, z: 9 },
    { x: -1.8, z: 12.6 }, { x: 1.8, z: 12.6 },
    { x: -1.8, z: 15 },   { x: 1.8, z: 15 },
    // Side streets
    { x: -7.2, z: 3.6 }, { x: 7.2, z: 3.6 },
    { x: -7.2, z: 7.2 }, { x: 7.2, z: 7.2 },
    { x: -7.2, z: 10.8 }, { x: 7.2, z: 10.8 },
    { x: -10.8, z: 7.2 }, { x: 10.8, z: 7.2 },
    { x: -3.6, z: 10.8 }, { x: 3.6, z: 10.8 },
    { x: -3.6, z: 3.6 },  { x: 3.6, z: 3.6 },
    { x: -12, z: 4.8 },   { x: 12, z: 4.8 },
    { x: -6, z: 18 },     { x: 6, z: 18 },
    { x: -3.6, z: 16.8 }, { x: 3.6, z: 16.8 },
  ];

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

  for (const pos of positions) {
    const T = getTerrainHeight(pos.x, pos.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.5, 6), poleMat);
    pole.position.set(pos.x, T + 1.75, pos.z);
    pole.castShadow = true;
    scene.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lampMat);
    lamp.position.set(pos.x, T + 3.6, pos.z);
    scene.add(lamp);
  }
}

// ACE propaganda posters on building walls
function createACEPosters(scene) {
  // Town: 3 posters — positions ×0.6
  const townPosters = [
    { x: -10.8, z: -3.6 + 2.5 + 0.03, ry: 0 },
    { x: 3.6, z: -3.6 + 2.0 + 0.03, ry: 0 },
    { x: 12.6, z: 4.2 + 3.0 + 0.03, ry: 0 },
  ];
  // Downtown: 6 posters — positions ×0.6
  const dtPosters = [
    { x: -7.2, z: 32.4 + 2.5 + 0.03, ry: 0 },
    { x: 6.6, z: 32.4 + 3.0 + 0.03, ry: 0 },
    { x: -9, z: 39.6 + 2.5 + 0.03, ry: 0 },
    { x: 13.8, z: 40.2 + 3.0 + 0.03, ry: 0 },
    { x: 18.6, z: 39 + 2.5 + 0.03, ry: 0 },
    { x: -6.6, z: 46.8 + 2.5 + 0.03, ry: 0 },
  ];

  const posterMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const aceMat = new THREE.MeshBasicMaterial({ color: 0x883333 });

  for (const p of [...townPosters, ...dtPosters]) {
    const poster = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.04), posterMat);
    poster.position.set(p.x, 2.0, p.z);
    poster.rotation.y = p.ry;
    scene.add(poster);
    const symbol = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), aceMat);
    symbol.position.set(p.x, 2.0, p.z + 0.01);
    symbol.rotation.y = p.ry;
    scene.add(symbol);
  }
}

// Bus stop shelter on Main Street (Town) — position ×0.6
function createBusStop(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x555560, transparent: true, opacity: 0.6 });
  const x = 2.4, z = 1.8; // along Main Street in Town
  const bsT = getTerrainHeight(x, z);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.5), mat);
  roof.position.set(x, bsT + 2.5, z);
  roof.castShadow = true;
  scene.add(roof);

  for (const px of [-1.3, 1.3]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), mat);
    pole.position.set(x + px, bsT + 1.25, z + 0.65);
    pole.castShadow = true;
    scene.add(pole);
  }

  const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 2.0, 0.06), glassMat);
  panel.position.set(x, bsT + 1.2, z - 0.7);
  scene.add(panel);

  const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), mat);
  bench.position.set(x, bsT + 0.5, z - 0.4);
  scene.add(bench);

  worldObjects.push({ mesh: roof, material: mat, type: 'bench', targetColor: BENCH_COLOR, x, z });
}

// Downtown: newspaper boxes — positions ×0.6
function createNewspaperBoxes(scene) {
  const positions = [
    { x: -3, z: 34.8 }, { x: 11.4, z: 34.8 },
    { x: 1.8, z: 33.6 }, { x: 7.8, z: 41.4 },
  ];

  const boxMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  for (const pos of positions) {
    const group = new THREE.Group();
    group.position.set(pos.x + 2, getTerrainHeight(pos.x + 2, pos.z), pos.z);

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

// Downtown: construction barriers — positions ×0.6
function createConstructionBarriers(scene) {
  const barriers = [
    { x: 27, z: 60 },
    { x: 28.2, z: 60 },
    { x: 29.4, z: 60 },
    { x: 27.6, z: 61.8 },
    { x: 28.8, z: 61.8 },
  ];

  for (const b of barriers) {
    const bT = getTerrainHeight(b.x, b.z);
    const barMat = new THREE.MeshLambertMaterial({ color: 0x666055 });
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.15), barMat);
    barrier.position.set(b.x, bT + 0.4, b.z);
    barrier.castShadow = true;
    scene.add(barrier);

    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x554433 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.16), stripeMat);
    stripe.position.set(b.x, bT + 0.5, b.z);
    scene.add(stripe);
  }
}

// Downtown street lamps — doubled count, tighter intervals, positions ×0.6
function createDowntownStreetLamps(scene) {
  const positions = [
    // Original 10 scaled
    { x: -12, z: 51 }, { x: 10.8, z: 51 }, { x: 27, z: 51 },
    { x: -15, z: 63 }, { x: 4.8, z: 63 }, { x: 22.8, z: 63 },
    { x: 31.2, z: 63 }, { x: -10.8, z: 75 }, { x: 16.8, z: 75 },
    { x: 33, z: 75 },
    // Additional — tighter grid
    { x: -18, z: 57 }, { x: 7.2, z: 57 }, { x: 28.8, z: 57 },
    { x: -14.4, z: 69 }, { x: 13.2, z: 69 }, { x: 30, z: 69 },
    { x: -8.4, z: 46.8 }, { x: 18, z: 46.8 },
    { x: -6, z: 78 }, { x: 24, z: 78 },
    { x: -12, z: 45 }, { x: 12, z: 45 },
    { x: -20.4, z: 54 }, { x: 22.2, z: 54 },
    { x: -16.8, z: 72 }, { x: 19.2, z: 72 },
  ];

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

  for (const pos of positions) {
    const T = getTerrainHeight(pos.x, pos.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.5, 6), poleMat);
    pole.position.set(pos.x, T + 1.75, pos.z);
    pole.castShadow = true;
    scene.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lampMat);
    lamp.position.set(pos.x, T + 3.6, pos.z);
    scene.add(lamp);
  }
}

// Downtown trash cans — doubled, positions ×0.6
function createDowntownTrashCans(scene) {
  const positions = [
    { x: -4.8, z: 51.6 }, { x: 19.2, z: 51.6 }, { x: 3, z: 57 },
    { x: 13.2, z: 69 }, { x: -6, z: 69 }, { x: 25.2, z: 76.8 },
    // Additional
    { x: -8.4, z: 54 }, { x: 23.4, z: 54 }, { x: 6, z: 63 },
    { x: 16.8, z: 72 }, { x: -9, z: 72 }, { x: 27.6, z: 73.2 },
  ];

  for (const pos of positions) {
    const canMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const group = new THREE.Group();
    group.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.7, 8), canMat);
    body.position.y = 0.35; body.castShadow = true; group.add(body);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 8), canMat);
    lid.position.y = 0.73; group.add(lid);

    scene.add(group);
    worldObjects.push({ mesh: group, material: canMat, type: 'trashcan', targetColor: new THREE.Color(0x606060), x: pos.x, z: pos.z });
  }
}

// Downtown parked cars — more cars, positions ×0.6
function createDowntownParkedCars(scene) {
  const positions = [
    { x: -9, z: 52.8, rot: Math.PI / 2 },
    { x: 24, z: 57, rot: 0 },
    { x: -13.2, z: 69, rot: Math.PI / 2 },
    { x: 28.8, z: 69, rot: 0 },
    { x: 9, z: 81, rot: Math.PI / 2 },
    { x: 18, z: 52.8, rot: 0 },
    { x: -16.2, z: 63, rot: 0 },
    { x: 25.8, z: 75, rot: Math.PI / 2 },
    { x: 6, z: 52.8, rot: Math.PI / 2 },
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const carMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const group = new THREE.Group();
    group.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);
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
  // Town furniture — commented out, replaced by hand-placed createTownCenter()
  // createBenches(scene);
  // createTrashCans(scene);
  // createParkedCars(scene);
  // createFences(scene);
  // createTrees(scene);
  // createStreetLamps(scene);
  // createBusStop(scene);

  // Downtown furniture — commented out for now
  // createDowntownStreetLamps(scene);
  // createDowntownTrashCans(scene);
  // createDowntownParkedCars(scene);
  // createNewspaperBoxes(scene);
  // createConstructionBarriers(scene);

  // ACE posters removed

  return { worldObjects, fountainParts: null, parkTrees: [] };
}

export function createTownCenter(scene) {
  // --- Trees (4) ---
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x686868 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x665544 });
  const treePositions = [
    [5, 15], [-5, 10], [8, 18], [-3, 5],
  ];
  for (const [tx, tz] of treePositions) {
    const ty = getTerrainHeight(tx, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 6), trunkMat);
    trunk.position.set(tx, ty + 1, tz);
    trunk.castShadow = true;
    scene.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), treeMat);
    canopy.position.set(tx, ty + 2.8, tz);
    canopy.castShadow = true;
    scene.add(canopy);
    worldObjects.push({ mesh: canopy, material: treeMat, type: 'tree', targetColor: TREE_CANOPY_COLOR, trunkMat, trunkTarget: TREE_TRUNK_COLOR, x: tx, z: tz });
  }

  // --- Lamp posts (6, along Main Street) ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const lampPositions = [
    [2, 5], [2, 15], [2, 25],
    [-2, 5], [-2, 15], [-2, 25],
  ];
  for (const [lx, lz] of lampPositions) {
    const ly = getTerrainHeight(lx, lz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), poleMat);
    pole.position.set(lx, ly + 2, lz);
    pole.castShadow = true;
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lampMat);
    bulb.position.set(lx, ly + 4.1, lz);
    scene.add(bulb);
  }

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

