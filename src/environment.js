// Environment storytelling — ACE propaganda posters, graffiti system,
// boarded-up shops, NPC home glow at night
// All visual-only, responds to color system

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { isNight, getGameHour } from './time-system.js';

// --- State ---
const posters = [];      // { mesh, material, x, z }
const boardedShops = [];  // { group, x, z, signColor }
const graffitiMarks = []; // { mesh, material, x, z, buildingColor }
const npcHomeGlows = [];  // { light, mesh, material, x, z, npcName }
let sceneRef = null;

let checkTimer = 0;
const CHECK_INTERVAL = 3.0;

// Cached local colors
const localColors = new Map();

const _c = new THREE.Color();

// --- ACE Propaganda Posters ---
const POSTER_TEXTS = [
  'CUTE IS CRIME',
  'REPORT CUTE ACTIVITY',
  'GRAY IS GOOD',
  'COLOR KILLS',
  'STAY DULL STAY SAFE',
];

function createPosters(scene, buildings) {
  // Place posters on some building walls
  const posterBuildings = [
    // indices into the building colors array (various walls)
    { bIdx: 0, side: 'z+', offset: 0 },
    { bIdx: 3, side: 'x-', offset: 0 },
    { bIdx: 6, side: 'z-', offset: 0 },
    { bIdx: 9, side: 'x+', offset: 0 },
    { bIdx: 11, side: 'z+', offset: 0 },
    { bIdx: 14, side: 'z-', offset: 0 },
    { bIdx: 16, side: 'x-', offset: 0 },
  ];

  const bColors = getBuildingColors();

  for (let i = 0; i < posterBuildings.length && i < bColors.length; i++) {
    const pb = posterBuildings[i];
    if (pb.bIdx >= bColors.length) continue;
    const b = bColors[pb.bIdx];

    const posterMat = new THREE.MeshBasicMaterial({
      color: 0xDDDDCC,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    // Backing
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), posterMat);

    // Position on building wall
    const bMesh = b.mesh;
    const bPos = bMesh.position;
    let px = bPos.x, pz = bPos.z, py = bPos.y;

    // Get building dimensions from geometry
    const bGeo = bMesh.geometry;
    const params = bGeo.parameters;
    const hw = params ? params.width / 2 : 2;
    const hd = params ? params.depth / 2 : 2;

    if (pb.side === 'z+') { pz += hd + 0.02; }
    else if (pb.side === 'z-') { pz -= hd + 0.02; backing.rotation.y = Math.PI; }
    else if (pb.side === 'x+') { px += hw + 0.02; backing.rotation.y = -Math.PI / 2; }
    else if (pb.side === 'x-') { px -= hw + 0.02; backing.rotation.y = Math.PI / 2; }

    py = 2.2;
    backing.position.set(px, py, pz);
    scene.add(backing);

    // Text strip (darker bar representing text)
    const textMat = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const textStrip = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.15), textMat);
    textStrip.position.copy(backing.position);
    textStrip.position.y -= 0.1;
    textStrip.rotation.copy(backing.rotation);
    // Offset slightly in front
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(backing.rotation);
    textStrip.position.addScaledVector(normal, 0.005);
    scene.add(textStrip);

    posters.push({
      mesh: backing, material: posterMat,
      textMesh: textStrip, textMat,
      x: px, z: pz,
    });
  }
}

// --- Boarded-up Storefronts ---
function createBoardedShops(scene) {
  const shopData = [
    { x: -20, z: -20.5, name: 'Plushie Palace', color: 0xCC88DD },
    { x: 3, z: -21.5, name: 'Sweet Things Bakery', color: 0xFFBB88 },
    { x: 16, z: 5.5, name: 'Color & Joy Art Supply', color: 0x88CCEE },
  ];

  const boardMat = new THREE.MeshLambertMaterial({ color: 0x5A4A3A });
  const signBgMat = new THREE.MeshBasicMaterial({
    color: 0x777766,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });

  for (const shop of shopData) {
    const group = new THREE.Group();
    group.position.set(shop.x, 0, shop.z);

    // Boards over the "door" area
    for (let i = 0; i < 3; i++) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.5, 0.04),
        boardMat
      );
      board.position.set(-0.5 + i * 0.5, 1.0, 0);
      board.rotation.z = (Math.random() - 0.5) * 0.1;
      board.castShadow = true;
      group.add(board);
    }

    // Diagonal board
    const diagBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.0, 0.04),
      boardMat
    );
    diagBoard.position.set(0, 1.0, 0);
    diagBoard.rotation.z = 0.6;
    group.add(diagBoard);

    // Faded sign above
    const signMat = new THREE.MeshBasicMaterial({
      color: shop.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), signBgMat.clone());
    sign.position.set(0, 2.2, 0.02);
    group.add(sign);

    // Colored accent (faded shop name color)
    const accent = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.25), signMat);
    accent.position.set(0, 2.2, 0.025);
    group.add(accent);

    scene.add(group);
    boardedShops.push({ group, x: shop.x, z: shop.z, signColor: shop.color });
  }
}

// --- Graffiti system (appears on walls when buildings reach 0.7+ color) ---
function initGraffitiSpots(scene) {
  // Pre-create hidden graffiti spots on buildings
  const bColors = getBuildingColors();
  const graffitiSpots = [
    { bIdx: 2, side: 'z+', shape: 'heart' },
    { bIdx: 5, side: 'x-', shape: 'star' },
    { bIdx: 7, side: 'z-', shape: 'smiley' },
    { bIdx: 10, side: 'x+', shape: 'heart' },
    { bIdx: 13, side: 'z+', shape: 'star' },
    { bIdx: 15, side: 'x-', shape: 'smiley' },
    { bIdx: 17, side: 'z-', shape: 'heart' },
  ];

  for (const gs of graffitiSpots) {
    if (gs.bIdx >= bColors.length) continue;
    const b = bColors[gs.bIdx];
    const bMesh = b.mesh;
    const bPos = bMesh.position;

    const params = bMesh.geometry.parameters;
    const hw = params ? params.width / 2 : 2;
    const hd = params ? params.depth / 2 : 2;

    let gx = bPos.x, gz = bPos.z;
    let rotY = 0;

    if (gs.side === 'z+') { gz += hd + 0.02; }
    else if (gs.side === 'z-') { gz -= hd + 0.02; rotY = Math.PI; }
    else if (gs.side === 'x+') { gx += hw + 0.02; rotY = -Math.PI / 2; }
    else if (gs.side === 'x-') { gx -= hw + 0.02; rotY = Math.PI / 2; }

    // Create graffiti shape (simple geometry)
    let graffitiGeo;
    if (gs.shape === 'heart') {
      // Approximate heart with a small diamond + circle
      graffitiGeo = new THREE.CircleGeometry(0.2, 6);
    } else if (gs.shape === 'star') {
      // 5-pointed star approximation
      graffitiGeo = new THREE.CircleGeometry(0.25, 5);
    } else {
      // Smiley — just a circle
      graffitiGeo = new THREE.CircleGeometry(0.2, 12);
    }

    const graffitiMat = new THREE.MeshBasicMaterial({
      color: b.targetColor.getHex(),
      transparent: true,
      opacity: 0, // hidden until building hits 0.7
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const graffiti = new THREE.Mesh(graffitiGeo, graffitiMat);
    graffiti.position.set(gx, bPos.y * 0.5 + Math.random() * 0.5, gz);
    graffiti.rotation.y = rotY;
    scene.add(graffiti);

    graffitiMarks.push({
      mesh: graffiti,
      material: graffitiMat,
      x: bPos.x,
      z: bPos.z,
      buildingIdx: gs.bIdx,
    });
  }
}

// --- NPC Home Glows ---
// Each NPC has a home building — at night with high color, a warm glow appears
function createNPCHomeGlows(scene, npcs) {
  const bColors = getBuildingColors();

  for (const npc of npcs) {
    if (!npc.homePos) continue;

    // Find closest building
    let closestDist = Infinity;
    let closestB = null;
    for (const b of bColors) {
      const dx = b.x - npc.homePos.x;
      const dz = b.z - npc.homePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDist) {
        closestDist = dist;
        closestB = b;
      }
    }

    if (!closestB || closestDist > 8) continue;

    // Create a small point light + tiny glowing window mesh
    const glowColor = closestB.targetColor.getHex();
    const light = new THREE.PointLight(glowColor, 0, 5, 2);
    const bMesh = closestB.mesh;
    const params = bMesh.geometry.parameters;
    const hd = params ? params.depth / 2 : 2;

    light.position.set(closestB.x, bMesh.position.y * 0.7, closestB.z + hd + 0.3);
    scene.add(light);

    // Glowing window quad
    const windowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0,
    });
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), windowMat);
    windowMesh.position.copy(light.position);
    windowMesh.position.z -= 0.1;
    scene.add(windowMesh);

    npcHomeGlows.push({
      light, mesh: windowMesh, material: windowMat,
      x: closestB.x, z: closestB.z,
      npcName: npc.name,
      buildingColor: closestB,
    });
  }
}

// --- Init ---
export function initEnvironment(scene, npcs) {
  sceneRef = scene;

  createPosters(scene);
  createBoardedShops(scene);
  initGraffitiSpots(scene);
  createNPCHomeGlows(scene, npcs);
}

// --- Refresh local colors ---
function refreshLocalColors() {
  localColors.clear();
  const buildings = getBuildingColors();
  const allObjects = [...posters, ...graffitiMarks, ...npcHomeGlows];

  for (const obj of allObjects) {
    let total = 0;
    let count = 0;
    for (const b of buildings) {
      const dx = b.x - obj.x;
      const dz = b.z - obj.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 20) {
        const w = 1 - dist / 20;
        total += b.displayAmount * w;
        count += w;
      }
    }
    const key = `${Math.round(obj.x)},${Math.round(obj.z)}`;
    localColors.set(key, count > 0 ? total / count : 0);
  }
}

function getLocalColor(x, z) {
  const key = `${Math.round(x)},${Math.round(z)}`;
  return localColors.get(key) || 0;
}

// --- Per-frame update ---
export function updateEnvironment(dt) {
  checkTimer += dt;
  if (checkTimer >= CHECK_INTERVAL) {
    checkTimer = 0;
    refreshLocalColors();
  }

  const night = isNight();
  const bColors = getBuildingColors();

  // --- Posters: fade/peel as nearby color increases ---
  for (const poster of posters) {
    const localColor = getLocalColor(poster.x, poster.z);
    // Opacity decreases from 0.85 as color grows
    poster.material.opacity = Math.max(0.1, 0.85 - localColor * 0.8);
    poster.textMat.opacity = Math.max(0.05, 0.8 - localColor * 0.85);
  }

  // --- Graffiti: appears when building reaches 0.7+ color ---
  for (const g of graffitiMarks) {
    if (g.buildingIdx < bColors.length) {
      const bColor = bColors[g.buildingIdx].displayAmount;
      if (bColor >= 0.7) {
        g.material.opacity = Math.min(0.8, (bColor - 0.7) * 3);
      } else {
        g.material.opacity = 0;
      }
    }
  }

  // --- NPC Home Glows: visible at night when building has high color ---
  for (const glow of npcHomeGlows) {
    const bColor = glow.buildingColor ? glow.buildingColor.displayAmount : 0;
    if (night && bColor > 0.4) {
      const intensity = (bColor - 0.4) * 1.5;
      glow.light.intensity = intensity * (0.8 + Math.sin(Date.now() * 0.001) * 0.1);
      glow.material.opacity = Math.min(0.6, intensity * 0.5);
    } else {
      glow.light.intensity = 0;
      glow.material.opacity = 0;
    }
  }
}

// --- NPC homes gain color faster ---
// Call this during color spread to give NPC home buildings a boost
export function boostNPCHomeColor(npcName, amount) {
  const bColors = getBuildingColors();
  for (const glow of npcHomeGlows) {
    if (glow.npcName === npcName && glow.buildingColor) {
      glow.buildingColor.colorAmount = Math.min(1.0, glow.buildingColor.colorAmount + amount * 0.5);
    }
  }
}
