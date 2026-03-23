// Color restoration system — the world gains color as you deal cute items to NPCs

import * as THREE from 'three';
import { playColorSpread } from './audio.js';
import { isNight, getDaylightFactor } from './time-system.js';
import { updateNPCColor } from './npc-models.js';

// Warm, happy target colors for buildings
const PALETTE = [
  0xF0997B, // soft coral
  0xED93B1, // warm pink
  0x85B7EB, // sky blue
  0x9FE1CB, // mint green
  0xFAC775, // sunny amber
  0xAFA9EC, // lavender
  0xF5C4B3, // soft peach
  0xFAEEDA, // warm yellow
];

const GRAY = new THREE.Color(0x808080);
const GROUND_TARGET = new THREE.Color(0x8A9A6B);

// Sky/fog targets
const FOG_GRAY = new THREE.Color(0xA0A0A0);
const FOG_TARGET = new THREE.Color(0xC8D8E8);
const SKY_GRAY = new THREE.Color(0xA0A0A0);
const SKY_TARGET = new THREE.Color(0x87CEEB);
const SUN_GRAY = new THREE.Color(0xC0C0C0);
const SUN_TARGET = new THREE.Color(0xFFF8E7);

// State
const buildingColors = []; // { mesh, targetColor, colorAmount, displayAmount, material }
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
let npcRelationshipsFn = null;   // callback → getRelationships() from npc.js
let npcColorTimer = 0;

// JP callback — set by main.js to award +2 JP per threshold crossing
let onBuildingThresholdCb = null;
export function setOnBuildingThresholdCallback(fn) { onBuildingThresholdCb = fn; }

const COLOR_THRESHOLDS = [0.25, 0.50, 0.75, 1.0];

// Ripple effects
const ripples = [];

// Temp colors for lerping (avoid allocations)
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

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

  // Assign each building a unique material with a target color.
  // Named buildings use their NPC's signature color; others get a random palette color.
  for (const mesh of buildings) {
    const sigColor = mesh.userData.namedSigColor;
    const targetColor = sigColor
      ? new THREE.Color(sigColor)
      : new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    const mat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    mesh.material = mat;

    buildingColors.push({
      mesh,
      targetColor,
      colorAmount: 0,        // current goal
      displayAmount: 0,      // what's actually rendered (lerps toward colorAmount)
      material: mat,
      x: mesh.position.x,
      z: mesh.position.z,
      namedId: mesh.userData.namedId || null, // for map lookup
      thresholdsCrossed: new Set(), // tracks 0.25/0.50/0.75/1.0 crossings for JP
    });
  }
}

// Called when a deal completes. npcPos is THREE.Vector3, isSticker is boolean.
// Optional npcName and itemType for NPC-specific color modifiers.
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
      // If radius is 0, no color spread (e.g., Sora stockpiling)
      if (RADIUS <= 0) return;
    }
  }

  for (const b of buildingColors) {
    const dx = b.x - npcPos.x;
    const dz = b.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < RADIUS) {
      const prev = b.colorAmount;
      b.colorAmount = Math.min(1.0, b.colorAmount + increment);
      // Award JP for each threshold first crossed in this spread
      if (onBuildingThresholdCb && b.thresholdsCrossed) {
        for (const t of COLOR_THRESHOLDS) {
          if (prev < t && b.colorAmount >= t && !b.thresholdsCrossed.has(t)) {
            b.thresholdsCrossed.add(t);
            onBuildingThresholdCb(2); // +2 JP per threshold crossing
          }
        }
      }
    }
  }

  // Spawn ripple effect
  spawnRipple(npcPos);
  playColorSpread();
}

// NPC color modifier callback — set externally to avoid circular import
let _getNPCColorModifier = null;
export function setNPCColorModifierFn(fn) { _getNPCColorModifier = fn; }

// Register NPC list + relationship getter for color updates
export function setNPCsForColorSystem(npcs, getRelFn) {
  npcList = npcs || [];
  npcRelationshipsFn = getRelFn || null;
}

// Extra color spread from gacha plushie reveal bonus
export function spreadColorBonus(npcPos, bonusAmount) {
  const RADIUS = 25;
  for (const b of buildingColors) {
    const dx = b.x - npcPos.x;
    const dz = b.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < RADIUS) {
      b.colorAmount = Math.min(1.0, b.colorAmount + bonusAmount);
    }
  }
  spawnRipple(npcPos);
}

// --- Ripple visual effect ---
function spawnRipple(pos) {
  if (!sceneRef) return;

  const geo = new THREE.RingGeometry(0.3, 0.6, 48);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xFAC775,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.15, pos.z);
  sceneRef.add(ring);

  ripples.push({
    mesh: ring,
    material: mat,
    age: 0,
    maxAge: 1.8,
    maxRadius: 28,
  });
}

// --- Per-frame update ---
export function updateColorSystem(dt) {
  // Lerp building display amounts toward targets
  for (const b of buildingColors) {
    if (Math.abs(b.displayAmount - b.colorAmount) > 0.001) {
      // Lerp speed: cover distance in ~1.5 seconds
      const speed = 1.0 / 1.5;
      const diff = b.colorAmount - b.displayAmount;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
      b.displayAmount += step;

      // Blend material color: gray -> target
      _c1.copy(GRAY);
      _c1.lerp(b.targetColor, b.displayAmount);
      b.material.color.copy(_c1);
    }
  }

  // Update ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += dt;
    const t = r.age / r.maxAge;

    if (t >= 1) {
      sceneRef.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.material.dispose();
      ripples.splice(i, 1);
      continue;
    }

    // Expand ring
    const scale = 1 + t * r.maxRadius;
    r.mesh.scale.set(scale, scale, 1);

    // Fade out
    r.material.opacity = 0.7 * (1 - t) * (1 - t);
  }

  // Global world color = average of all building colorAmounts
  let totalColor = 0;
  for (const b of buildingColors) {
    totalColor += b.displayAmount;
  }
  const worldColor = buildingColors.length > 0 ? totalColor / buildingColors.length : 0;

  // Update sky, fog, lighting
  updateAtmosphere(worldColor);

  // Update ground color
  updateGround();

  // Update window and door colors
  updateWindowsDoors();

  // Update NPC colors (every 45 frames to keep it cheap)
  npcColorTimer++;
  if (npcColorTimer % 45 === 0) {
    updateNPCColors();
  }
}

function updateAtmosphere(worldColor) {
  if (!sceneRef) return;
  // During dawn/dusk/night, lighting.js controls sky/fog/lights.
  // Only run here at full daytime (8AM–4PM) so the two systems don't fight.
  if (getDaylightFactor() < 1.0) return;

  // Fog color
  _c1.copy(FOG_GRAY).lerp(FOG_TARGET, worldColor);
  sceneRef.fog.color.copy(_c1);

  // Sky/background
  _c1.copy(SKY_GRAY).lerp(SKY_TARGET, worldColor);
  sceneRef.background.copy(_c1);

  // Fog distance — see further as world opens up
  sceneRef.fog.near = fogNear0 + worldColor * 30;
  sceneRef.fog.far = fogFar0 + worldColor * 100;

  // Directional light warmth
  if (sunRef) {
    _c1.copy(SUN_GRAY).lerp(SUN_TARGET, worldColor);
    sunRef.color.copy(_c1);
    sunRef.intensity = 0.8 + worldColor * 0.3;
  }

  // Ambient light brightness
  if (ambientRef) {
    ambientRef.intensity = 0.6 + worldColor * 0.25;
  }
}

function updateGround() {
  if (!groundMat) return;

  // Average color of nearby buildings (weighted by inverse distance from origin for simplicity,
  // or just do overall average since ground is one piece)
  let total = 0;
  for (const b of buildingColors) {
    total += b.displayAmount;
  }
  const avg = buildingColors.length > 0 ? total / buildingColors.length : 0;

  _c1.copy(GRAY).lerp(GROUND_TARGET, avg);
  groundMat.color.copy(_c1);
}

// Pre-allocated colors for window/door updates
const WINDOW_WARM = new THREE.Color(0xFAC775); // warm amber glow
const WINDOW_DAY = new THREE.Color(0x666666);
const WINDOW_BASE = new THREE.Color(0x303030); // darker base when gray
const DOOR_BASE = new THREE.Color(0x5A5A5A);

// Update windows and doors based on nearby building color
let windowDoorTimer = 0;
function updateWindowsDoors() {
  windowDoorTimer++;
  if (windowDoorTimer % 30 !== 0) return; // only update every ~30 frames

  const night = isNight();

  // Windows: transition from dark gray to warm amber glow as colorAmount increases
  for (const wm of windowMatsList) {
    // Find nearest building color
    let nearestColor = 0;
    for (const b of buildingColors) {
      if (Math.abs(b.x - wm.x) < 1 && Math.abs(b.z - wm.z) < 1) {
        nearestColor = b.displayAmount;
        break;
      }
    }
    if (night && nearestColor > 0.3) {
      // Warm amber glow with emissive
      const warmth = (nearestColor - 0.3) / 0.7;
      _c1.copy(WINDOW_BASE).lerp(WINDOW_WARM, warmth * 0.7);
      wm.material.color.copy(_c1);
      // Add emissive glow for colored windows at night
      if (!wm.material.emissive) wm.material.emissive = new THREE.Color();
      _c2.set(0x000000).lerp(WINDOW_WARM, warmth * 0.35);
      wm.material.emissive.copy(_c2);
    } else {
      // Daytime: slightly lighter than building, transition from dark to lighter
      _c1.copy(WINDOW_BASE).lerp(WINDOW_DAY, nearestColor * 0.4);
      wm.material.color.copy(_c1);
      // Remove emissive during day
      if (wm.material.emissive) wm.material.emissive.setHex(0x000000);
    }
  }

  // Doors: gain inviting color with building color
  for (const dm of doorMatsList) {
    let nearestColor = 0;
    for (const b of buildingColors) {
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
// NPC COLOR UPDATE — desaturate/colorize NPCs based on nearby
// building colorAmount and their relationship level with player
// ============================================================
function updateNPCColors() {
  if (!npcList.length) return;
  const relationships = npcRelationshipsFn ? npcRelationshipsFn() : {};
  const NPC_INFLUENCE_RADIUS = 20;

  for (const npc of npcList) {
    if (!npc.bodyMat) continue; // not using new model

    const nx = npc.worldPos ? npc.worldPos.x : (npc.group ? npc.group.position.x : 0);
    const nz = npc.worldPos ? npc.worldPos.z : (npc.group ? npc.group.position.z : 0);

    // Find average colorAmount of nearby buildings
    let nearbyTotal = 0;
    let nearbyCount = 0;
    for (const b of buildingColors) {
      const dx = b.x - nx;
      const dz = b.z - nz;
      if (dx * dx + dz * dz < NPC_INFLUENCE_RADIUS * NPC_INFLUENCE_RADIUS) {
        nearbyTotal += b.displayAmount;
        nearbyCount++;
      }
    }
    const nearbyColor = nearbyCount > 0 ? nearbyTotal / nearbyCount : 0;

    // Get relationship level
    const rel = relationships[npc.name];
    const relLevel = rel ? (rel.level || 0) : 0;

    // Update NPC visual color
    updateNPCColor(npc, nearbyColor, relLevel);
  }
}

// Dynamically add buildings (used when districts unlock)
export function addBuildings(meshes) {
  for (const mesh of meshes) {
    const sigColor = mesh.userData.namedSigColor;
    const targetColor = sigColor
      ? new THREE.Color(sigColor)
      : new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    const mat = new THREE.MeshLambertMaterial({ color: 0x707070 });
    mesh.material = mat;

    buildingColors.push({
      mesh,
      targetColor,
      colorAmount: 0,
      displayAmount: 0,
      material: mat,
      x: mesh.position.x,
      z: mesh.position.z,
      namedId: mesh.userData.namedId || null,
      thresholdsCrossed: new Set(),
    });
  }
}

// After restoring building colors from save, pre-mark thresholds so JP isn't re-awarded
export function syncBuildingThresholds() {
  for (const b of buildingColors) {
    if (!b.thresholdsCrossed) b.thresholdsCrossed = new Set();
    for (const t of COLOR_THRESHOLDS) {
      if (b.colorAmount >= t) b.thresholdsCrossed.add(t);
    }
  }
}

// Query building color data (for minimap)
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
