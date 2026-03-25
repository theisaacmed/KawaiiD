// Color restoration system — the world gains color as you deal cute items to NPCs
// Overhauled: district palettes, distance falloff, spatial grid, smoother atmosphere

import * as THREE from 'three';
import { playColorSpread } from './audio.js';
import { isNight, getDaylightFactor } from './time-system.js';
import { updateNPCColor } from './npc-models.js';

// ============================================================
// DISTRICT COLOR PALETTES — each district has its own personality
// ============================================================
const DISTRICT_PALETTES = {
  town:       [0xF0997B, 0xED93B1, 0x9FE1CB, 0xFAC775, 0xF5C4B3, 0xFAEEDA],
  downtown:   [0x85B7EB, 0xAFA9EC, 0xFAC775, 0xC8D8E8, 0x9FC8EB, 0xB0A8E0],
  burbs:      [0x9FE1CB, 0xF5C4B3, 0xFAEEDA, 0xA8D8A8, 0xF0E0C0, 0xE8D0B8],
  northtown:  [0xFAC775, 0x9FE1CB, 0xF0997B, 0xE8D8A0, 0xB8E0C0, 0xD0C090],
  uptown:     [0xAFA9EC, 0x85B7EB, 0xFAC775, 0xC0B0E8, 0x90B8E8, 0xD8D0F0],
  tower:      [0x85B7EB, 0xAFA9EC, 0xC8D8E8, 0x8098C0, 0x9090B8, 0x7080A0],
  industrial: [0xF5C4B3, 0xF0997B, 0xFAC775, 0xC0A890, 0xB09878, 0xD0B8A0],
  port:       [0x85B7EB, 0x9FE1CB, 0xC8D8E8, 0x80B8C8, 0x90C8B0, 0xA0D0E0],
  aceHQ:      [0xF0997B, 0xED93B1, 0xC08080, 0xA07070, 0xB08888, 0xC09090],
};

// Fallback palette for unknown districts
const DEFAULT_PALETTE = [0xF0997B, 0xED93B1, 0x85B7EB, 0x9FE1CB, 0xFAC775, 0xAFA9EC, 0xF5C4B3, 0xFAEEDA];

// ============================================================
// GRAY BASE COLORS — slightly varied per district for visual interest
// ============================================================
const GRAY_BASE = {
  town:       new THREE.Color(0x808080),
  downtown:   new THREE.Color(0x787878),
  burbs:      new THREE.Color(0x888888),
  northtown:  new THREE.Color(0x858580),
  uptown:     new THREE.Color(0x7A7A80),
  tower:      new THREE.Color(0x707078),
  industrial: new THREE.Color(0x757570),
  port:       new THREE.Color(0x787878),
  aceHQ:      new THREE.Color(0x706868),
};
const DEFAULT_GRAY = new THREE.Color(0x808080);

const GROUND_TARGET = new THREE.Color(0x8A9A6B);

// Sky/fog targets
const FOG_GRAY = new THREE.Color(0xA0A0A0);
const FOG_TARGET = new THREE.Color(0xC8D8E8);
const SKY_GRAY = new THREE.Color(0xA0A0A0);
const SKY_TARGET = new THREE.Color(0x87CEEB);
const SUN_GRAY = new THREE.Color(0xC0C0C0);
const SUN_TARGET = new THREE.Color(0xFFF8E7);

// State
const buildingColors = []; // { mesh, targetColor, grayBase, colorAmount, displayAmount, material, district }
let groundMesh = null;
let groundMat = null;
let sceneRef = null;
let ambientRef = null;
let sunRef = null;
let fogNear0 = 40;
let fogFar0 = 200;

// Window/door materials from world.js
let windowMatsList = [];
let doorMatsList = [];

// NPC references for color updates
let npcList = [];
let npcRelationshipsFn = null;
let npcColorTimer = 0;

// JP callback — set by main.js to award +2 JP per threshold crossing
let onBuildingThresholdCb = null;
export function setOnBuildingThresholdCallback(fn) { onBuildingThresholdCb = fn; }

const COLOR_THRESHOLDS = [0.25, 0.50, 0.75, 1.0];

// Ripple effects
const ripples = [];

// ============================================================
// SPATIAL GRID — O(1) lookup for nearby buildings
// ============================================================
const GRID_CELL_SIZE = 20;
const spatialGrid = new Map();

function gridKey(x, z) {
  return `${Math.floor(x / GRID_CELL_SIZE)},${Math.floor(z / GRID_CELL_SIZE)}`;
}

function addToGrid(entry) {
  const key = gridKey(entry.x, entry.z);
  if (!spatialGrid.has(key)) spatialGrid.set(key, []);
  spatialGrid.get(key).push(entry);
}

function getNearbyBuildings(x, z, radius) {
  const results = [];
  const cellRadius = Math.ceil(radius / GRID_CELL_SIZE);
  const cx = Math.floor(x / GRID_CELL_SIZE);
  const cz = Math.floor(z / GRID_CELL_SIZE);
  const r2 = radius * radius;

  for (let gx = cx - cellRadius; gx <= cx + cellRadius; gx++) {
    for (let gz = cz - cellRadius; gz <= cz + cellRadius; gz++) {
      const cell = spatialGrid.get(`${gx},${gz}`);
      if (!cell) continue;
      for (const b of cell) {
        const dx = b.x - x;
        const dz = b.z - z;
        if (dx * dx + dz * dz < r2) {
          results.push(b);
        }
      }
    }
  }
  return results;
}

// Temp colors for lerping (avoid allocations)
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

// ============================================================
// PALETTE SELECTION — pick color based on district + position seed
// ============================================================
function pickTargetColor(mesh, district) {
  const sigColor = mesh.userData.namedSigColor;
  if (sigColor) return new THREE.Color(sigColor);

  const palette = DISTRICT_PALETTES[district] || DEFAULT_PALETTE;
  // Deterministic pick based on position
  const seed = Math.abs(Math.round(mesh.position.x * 73 + mesh.position.z * 137)) % palette.length;
  return new THREE.Color(palette[seed]);
}

function getGrayBase(district) {
  return GRAY_BASE[district] || DEFAULT_GRAY;
}

// ============================================================
// INIT
// ============================================================
export function initColorSystem(scene, buildings, ground, windowMats, doorMats) {
  sceneRef = scene;
  groundMesh = ground;
  groundMat = ground.material;

  // Find lights in the scene
  scene.traverse((obj) => {
    if (obj.isAmbientLight) ambientRef = obj;
    if (obj.isDirectionalLight) sunRef = obj;
  });

  // Store window/door material references
  windowMatsList = windowMats || [];
  doorMatsList = doorMats || [];

  for (const mesh of buildings) {
    const district = mesh.userData.district || 'town';
    const targetColor = pickTargetColor(mesh, district);
    const grayBase = getGrayBase(district);
    const mat = new THREE.MeshLambertMaterial({ color: grayBase.getHex() });
    mesh.material = mat;

    const entry = {
      mesh,
      targetColor,
      grayBase,
      district,
      colorAmount: 0,
      displayAmount: 0,
      material: mat,
      x: mesh.position.x,
      z: mesh.position.z,
      namedId: mesh.userData.namedId || null,
      thresholdsCrossed: new Set(),
    };
    buildingColors.push(entry);
    addToGrid(entry);
  }
}

// ============================================================
// COLOR SPREAD — with distance falloff
// ============================================================
export function spreadColor(npcPos, isSticker, npcName, itemType) {
  let increment = isSticker ? 0.18 : 0.12;
  let RADIUS = 25;

  // Apply NPC-specific color modifiers
  if (npcName && _getNPCColorModifier) {
    const mod = _getNPCColorModifier(npcName, itemType || (isSticker ? 'sticker' : 'plushie'));
    if (mod) {
      if (mod.radiusMult !== undefined) RADIUS *= mod.radiusMult;
      if (mod.increment !== undefined && mod.increment !== null) increment = mod.increment;
      if (mod.incrementMult !== undefined) increment *= mod.incrementMult;
      if (RADIUS <= 0) return;
    }
  }

  const nearby = getNearbyBuildings(npcPos.x, npcPos.z, RADIUS);
  for (const b of nearby) {
    const dx = b.x - npcPos.x;
    const dz = b.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Distance falloff — full effect up close, linear decay to edge
    const falloff = 1.0 - (dist / RADIUS);
    const amount = increment * falloff;

    const prev = b.colorAmount;
    b.colorAmount = Math.min(1.0, b.colorAmount + amount);

    // Award JP for each threshold first crossed
    if (onBuildingThresholdCb && b.thresholdsCrossed) {
      for (const t of COLOR_THRESHOLDS) {
        if (prev < t && b.colorAmount >= t && !b.thresholdsCrossed.has(t)) {
          b.thresholdsCrossed.add(t);
          onBuildingThresholdCb(2);
        }
      }
    }
  }

  spawnRipple(npcPos);
  playColorSpread();
}

// NPC color modifier callback
let _getNPCColorModifier = null;
export function setNPCColorModifierFn(fn) { _getNPCColorModifier = fn; }

// Register NPC list + relationship getter
export function setNPCsForColorSystem(npcs, getRelFn) {
  npcList = npcs || [];
  npcRelationshipsFn = getRelFn || null;
}

// Extra color spread from gacha plushie reveal bonus
export function spreadColorBonus(npcPos, bonusAmount) {
  const RADIUS = 25;
  const nearby = getNearbyBuildings(npcPos.x, npcPos.z, RADIUS);
  for (const b of nearby) {
    const dx = b.x - npcPos.x;
    const dz = b.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const falloff = 1.0 - (dist / RADIUS);
    b.colorAmount = Math.min(1.0, b.colorAmount + bonusAmount * falloff);
  }
  spawnRipple(npcPos);
}

// ============================================================
// RIPPLE EFFECTS
// ============================================================
function spawnRipple(pos) {
  if (!sceneRef) return;

  const geo = new THREE.RingGeometry(0.4, 0.9, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xFAC775,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.15, pos.z);
  sceneRef.add(ring);

  ripples.push({ mesh: ring, material: mat, age: 0, maxAge: 2.5, maxRadius: 32 });

  const geo2 = new THREE.RingGeometry(0.2, 0.5, 48);
  const mat2 = new THREE.MeshBasicMaterial({
    color: 0xED93B1,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring2 = new THREE.Mesh(geo2, mat2);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.set(pos.x, 0.12, pos.z);
  sceneRef.add(ring2);

  ripples.push({ mesh: ring2, material: mat2, age: -0.3, maxAge: 2.0, maxRadius: 24 });
}

// ============================================================
// PER-FRAME UPDATE
// ============================================================
let _updateTimer = 0;

export function updateColorSystem(dt) {
  _updateTimer += dt;

  // Lerp building display amounts toward targets
  for (const b of buildingColors) {
    if (Math.abs(b.displayAmount - b.colorAmount) > 0.001) {
      const speed = 1.0 / 1.5;
      const diff = b.colorAmount - b.displayAmount;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
      b.displayAmount += step;

      // Blend: district-specific gray base -> target color
      _c1.copy(b.grayBase);
      _c1.lerp(b.targetColor, b.displayAmount);
      b.material.color.copy(_c1);
    }
  }

  // Update ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += dt;

    if (r.age < 0) { r.mesh.visible = false; continue; }
    r.mesh.visible = true;

    const t = r.age / r.maxAge;
    if (t >= 1) {
      sceneRef.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.material.dispose();
      ripples.splice(i, 1);
      continue;
    }

    const eased = 1 - (1 - t) * (1 - t);
    const scale = 1 + eased * r.maxRadius;
    r.mesh.scale.set(scale, scale, 1);
    r.material.opacity = 0.85 * (1 - t) * (1 - t);
  }

  // Global world color = average of all building colorAmounts
  let totalColor = 0;
  for (const b of buildingColors) {
    totalColor += b.displayAmount;
  }
  const worldColor = buildingColors.length > 0 ? totalColor / buildingColors.length : 0;

  // Update sky, fog, lighting
  updateAtmosphere(worldColor);

  // Update ground (every 3 frames — cheap but not every frame)
  if (_updateTimer > 0.05) {
    updateGround();
  }

  // Update window and door colors (every ~30 frames)
  updateWindowsDoors();

  // Update NPC colors (every 45 frames)
  npcColorTimer++;
  if (npcColorTimer % 45 === 0) {
    updateNPCColors();
  }
}

// ============================================================
// ATMOSPHERE — smooth eased transitions
// ============================================================
let _smoothWorldColor = 0;

function updateAtmosphere(worldColor) {
  if (!sceneRef) return;
  if (getDaylightFactor() < 1.0) return;

  // Smooth the world color to prevent jittering
  _smoothWorldColor += (worldColor - _smoothWorldColor) * 0.02;
  const wc = _smoothWorldColor;

  // Fog color — ease-in-out curve for more dramatic transition
  const eased = wc * wc * (3 - 2 * wc); // smoothstep
  _c1.copy(FOG_GRAY).lerp(FOG_TARGET, eased);
  sceneRef.fog.color.copy(_c1);

  // Sky/background
  _c1.copy(SKY_GRAY).lerp(SKY_TARGET, eased);
  sceneRef.background.copy(_c1);

  // Fog distance — see further as world opens up
  sceneRef.fog.near = fogNear0 + eased * 40;
  sceneRef.fog.far = fogFar0 + eased * 120;

  // Directional light warmth
  if (sunRef) {
    _c1.copy(SUN_GRAY).lerp(SUN_TARGET, eased);
    sunRef.color.copy(_c1);
    sunRef.intensity = 0.8 + eased * 0.35;
  }

  // Ambient light brightness
  if (ambientRef) {
    ambientRef.intensity = 0.55 + eased * 0.3;
  }
}

// ============================================================
// GROUND — uses regional color average, not global
// ============================================================
let _groundTimer = 0;

function updateGround() {
  if (!groundMat) return;
  _groundTimer++;
  if (_groundTimer % 5 !== 0) return; // update every 5th call

  let total = 0;
  for (const b of buildingColors) {
    total += b.displayAmount;
  }
  const avg = buildingColors.length > 0 ? total / buildingColors.length : 0;

  _c1.copy(DEFAULT_GRAY).lerp(GROUND_TARGET, avg);
  groundMat.color.copy(_c1);
}

// ============================================================
// WINDOWS & DOORS
// ============================================================
const WINDOW_WARM = new THREE.Color(0xFAC775);
const WINDOW_DAY = new THREE.Color(0x666666);
const WINDOW_BASE = new THREE.Color(0x303030);
const DOOR_BASE = new THREE.Color(0x5A5A5A);

let windowDoorTimer = 0;
function updateWindowsDoors() {
  windowDoorTimer++;
  if (windowDoorTimer % 30 !== 0) return;

  const night = isNight();

  for (const wm of windowMatsList) {
    let nearestColor = 0;
    // Use spatial grid for faster lookup
    const nearby = getNearbyBuildings(wm.x, wm.z, 2);
    for (const b of nearby) {
      if (Math.abs(b.x - wm.x) < 1 && Math.abs(b.z - wm.z) < 1) {
        nearestColor = b.displayAmount;
        break;
      }
    }
    if (night && nearestColor > 0.3) {
      const warmth = (nearestColor - 0.3) / 0.7;
      _c1.copy(WINDOW_BASE).lerp(WINDOW_WARM, warmth * 0.7);
      wm.material.color.copy(_c1);
      if (!wm.material.emissive) wm.material.emissive = new THREE.Color();
      _c2.set(0x000000).lerp(WINDOW_WARM, warmth * 0.35);
      wm.material.emissive.copy(_c2);
    } else {
      _c1.copy(WINDOW_BASE).lerp(WINDOW_DAY, nearestColor * 0.4);
      wm.material.color.copy(_c1);
      if (wm.material.emissive) wm.material.emissive.setHex(0x000000);
    }
  }

  for (const dm of doorMatsList) {
    let nearestColor = 0;
    const nearby = getNearbyBuildings(dm.x, dm.z, 2);
    for (const b of nearby) {
      if (Math.abs(b.x - dm.x) < 1 && Math.abs(b.z - dm.z) < 1) {
        nearestColor = b.displayAmount;
        break;
      }
    }
    _c1.copy(DOOR_BASE).lerp(dm.targetColor, nearestColor);
    dm.material.color.copy(_c1);
  }
}

// ============================================================
// NPC COLORS
// ============================================================
function updateNPCColors() {
  if (!npcList.length) return;
  const relationships = npcRelationshipsFn ? npcRelationshipsFn() : {};
  const NPC_INFLUENCE_RADIUS = 20;

  for (const npc of npcList) {
    if (!npc.bodyMat) continue;

    const nx = npc.worldPos ? npc.worldPos.x : (npc.group ? npc.group.position.x : 0);
    const nz = npc.worldPos ? npc.worldPos.z : (npc.group ? npc.group.position.z : 0);

    const nearby = getNearbyBuildings(nx, nz, NPC_INFLUENCE_RADIUS);
    let nearbyTotal = 0;
    let nearbyCount = 0;
    for (const b of nearby) {
      nearbyTotal += b.displayAmount;
      nearbyCount++;
    }
    const nearbyColor = nearbyCount > 0 ? nearbyTotal / nearbyCount : 0;

    const rel = relationships[npc.name];
    const relLevel = rel ? (rel.level || 0) : 0;

    updateNPCColor(npc, nearbyColor, relLevel);
  }
}

// ============================================================
// DYNAMIC BUILDING MANAGEMENT
// ============================================================
export function addBuildings(meshes) {
  for (const mesh of meshes) {
    const district = mesh.userData.district || 'town';
    const targetColor = pickTargetColor(mesh, district);
    const grayBase = getGrayBase(district);
    const mat = new THREE.MeshLambertMaterial({ color: grayBase.getHex() });
    mesh.material = mat;

    const entry = {
      mesh,
      targetColor,
      grayBase,
      district,
      colorAmount: 0,
      displayAmount: 0,
      material: mat,
      x: mesh.position.x,
      z: mesh.position.z,
      namedId: mesh.userData.namedId || null,
      thresholdsCrossed: new Set(),
    };
    buildingColors.push(entry);
    addToGrid(entry);
  }
}

export function syncBuildingThresholds() {
  for (const b of buildingColors) {
    if (!b.thresholdsCrossed) b.thresholdsCrossed = new Set();
    for (const t of COLOR_THRESHOLDS) {
      if (b.colorAmount >= t) b.thresholdsCrossed.add(t);
    }
  }
}

export function getBuildingColors() {
  return buildingColors;
}

export function getWorldColor() {
  let total = 0;
  for (const b of buildingColors) {
    total += b.displayAmount;
  }
  return buildingColors.length > 0 ? total / buildingColors.length : 0;
}
