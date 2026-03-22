// District system — definitions, unlock logic, barriers
// Districts are NOT hard-walled. They overlap. Defined by building character, not walls.

import * as THREE from 'three';
import { getPhoneStats } from './phone.js';

// ========== DISTRICT DEFINITIONS ==========
// unlockRank: minimum rank index (from jp-system.js RANKS) to unlock via rank system
// unlockDeals: legacy deal-count threshold (kept for backward compat / debug)
export const DISTRICTS = {
  town: {
    name: 'Town',
    center: { x: 0, z: 20 },
    radius: 80,
    unlockDeals: 0,   // always open
    unlockRank: 0,
    unlocked: true,
    description: 'Home. Modest residential, small shops.',
  },
  ruins: {
    name: 'Ruins',
    center: { x: 0, z: -200 },
    radius: 100,
    unlockDeals: 0,   // always open
    unlockRank: 0,
    unlocked: true,
    description: 'Destroyed old city. Scavenging grounds.',
  },
  downtown: {
    name: 'Downtown',
    center: { x: 20, z: 120 },
    radius: 70,
    unlockDeals: 15,
    unlockRank: 2,    // Dealer (150 JP)
    unlocked: false,
    description: 'Commercial hub. Taller buildings, shops, markets.',
  },
  burbs: {
    name: 'Burbs',
    center: { x: 150, z: -20 },
    radius: 70,
    unlockDeals: 20,
    unlockRank: 3,    // Supplier (300 JP)
    unlocked: false,
    description: 'Suburban sprawl. Bigger houses, wider streets.',
  },
  northtown: {
    name: 'Northtown',
    center: { x: 130, z: 150 },
    radius: 60,
    unlockDeals: 25,
    unlockRank: 4,    // Smuggler (500 JP)
    unlocked: false,
    description: 'Quiet residential near the coast.',
  },
  industrial: {
    name: 'Industrial',
    center: { x: 20, z: -100 },
    radius: 70,
    unlockDeals: 30,
    unlockRank: 4,    // Smuggler (500 JP)
    unlocked: false,
    description: 'Factories, warehouses, workshops.',
  },
  uptown: {
    name: 'Uptown',
    center: { x: 170, z: 80 },
    radius: 60,
    unlockDeals: 35,
    unlockRank: 5,    // Distributor (800 JP)
    unlocked: false,
    description: 'Upscale district. Premium customers.',
  },
  tower: {
    name: 'Tower',
    center: { x: -140, z: 120 },
    radius: 60,
    unlockDeals: 40,
    unlockRank: 6,    // Kingpin (1200 JP)
    unlocked: false,
    description: 'High-rise district. Dense, shadowy streets.',
  },
  port: {
    name: 'Port',
    center: { x: -80, z: 200 },
    radius: 50,
    unlockDeals: 50,
    unlockRank: 6,    // Kingpin (1200 JP)
    unlocked: false,
    description: 'Docks. Shipping containers, cranes.',
  },
  aceHQ: {
    name: 'ACE HQ',
    center: { x: -140, z: -60 },
    radius: 50,
    unlockDeals: 60,
    unlockRank: 7,    // Kawaii Kingpin (2000 JP)
    unlocked: false,
    description: 'Institutional. Heavy ACE presence.',
  },
};

// ========== BARRIER POSITIONS ==========
// Barriers are placed on roads leading into locked districts
const BARRIERS = [];
let sceneRef = null;

// Barrier definitions: position on road + which district they gate
const BARRIER_DEFS = [
  // Downtown: on Main Street between Town and Downtown
  { district: 'downtown', x: 0, z: 70, w: 10, d: 0.4, label: 'Downtown' },
  // Downtown: secondary entrance from west
  { district: 'downtown', x: -30, z: 85, w: 0.4, d: 8, label: 'Downtown West' },
  // Burbs: on East Blvd south of Cross Street
  { district: 'burbs', x: 150, z: 10, w: 10, d: 0.4, label: 'Burbs' },
  // Burbs: on Cross Street heading east
  { district: 'burbs', x: 100, z: 50, w: 0.4, d: 10, label: 'Burbs East' },
  // Northtown: on East Blvd heading north
  { district: 'northtown', x: 150, z: 130, w: 10, d: 0.4, label: 'Northtown' },
  // Industrial: on Main Street heading south
  { district: 'industrial', x: 0, z: -50, w: 10, d: 0.4, label: 'Industrial' },
  // Industrial: from west
  { district: 'industrial', x: -80, z: -80, w: 0.4, d: 10, label: 'Industrial West' },
  // Uptown: on East Blvd between Cross and Northtown
  { district: 'uptown', x: 150, z: 70, w: 10, d: 0.4, label: 'Uptown South' },
  // Tower: on West Ave heading north
  { district: 'tower', x: -150, z: 80, w: 10, d: 0.4, label: 'Tower' },
  // Tower: on Coast Road heading west
  { district: 'tower', x: -100, z: 180, w: 0.4, d: 10, label: 'Tower Coast' },
  // Port: on Coast Road
  { district: 'port', x: -50, z: 180, w: 0.4, d: 10, label: 'Port' },
  // ACE HQ: on West Ave heading south
  { district: 'aceHQ', x: -150, z: -30, w: 10, d: 0.4, label: 'ACE HQ' },
  // ACE HQ: from Industrial Road
  { district: 'aceHQ', x: -100, z: -80, w: 0.4, d: 10, label: 'ACE HQ East' },
];

function createBarrier(scene, def) {
  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);

  // Striped barricade (red/white)
  const barricadeGeo = new THREE.BoxGeometry(def.w, 1.2, def.d);
  const barricadeMat = new THREE.MeshLambertMaterial({ color: 0xCC3333 });
  const barricade = new THREE.Mesh(barricadeGeo, barricadeMat);
  barricade.position.y = 0.6;
  barricade.castShadow = true;
  group.add(barricade);

  // White stripes
  const stripeCount = Math.max(3, Math.floor(Math.max(def.w, def.d) / 2));
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
  for (let i = 0; i < stripeCount; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        def.w > def.d ? def.w * 0.15 : def.w + 0.02,
        0.15,
        def.d > def.w ? def.d * 0.15 : def.d + 0.02
      ),
      stripeMat
    );
    if (def.w > def.d) {
      stripe.position.set(-def.w / 2 + (i + 0.5) * (def.w / stripeCount), 0.6, 0);
    } else {
      stripe.position.set(0, 0.6, -def.d / 2 + (i + 0.5) * (def.d / stripeCount));
    }
    group.add(stripe);
  }

  // ACE sign post
  const postGeo = new THREE.BoxGeometry(0.15, 2.5, 0.15);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(def.w > def.d ? def.w / 2 + 0.5 : 0, 1.25, def.d > def.w ? def.d / 2 + 0.5 : 0);
  post.castShadow = true;
  group.add(post);

  // ACE sign
  const signGeo = new THREE.BoxGeometry(1.5, 0.8, 0.08);
  const signMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(post.position.x, 2.2, post.position.z + 0.1);
  group.add(sign);

  // "ACE" text backing
  const textMat = new THREE.MeshBasicMaterial({ color: 0xCC3333 });
  const textBg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.09), textMat);
  textBg.position.set(post.position.x, 2.2, post.position.z + 0.12);
  group.add(textBg);

  scene.add(group);

  return {
    group,
    district: def.district,
    x: def.x, z: def.z,
    w: def.w, d: def.d,
    removed: false,
  };
}

// ========== INIT ==========
export function createDistricts(scene) {
  sceneRef = scene;
  BARRIERS.length = 0;

  for (const def of BARRIER_DEFS) {
    const district = DISTRICTS[def.district];
    if (district && !district.unlocked) {
      BARRIERS.push(createBarrier(scene, def));
    }
  }
}

// ========== UNLOCK LOGIC ==========

function removeBarriersForDistrict(key) {
  for (const barrier of BARRIERS) {
    if (barrier.district === key && !barrier.removed) {
      barrier.removed = true;
      if (sceneRef && barrier.group) {
        sceneRef.remove(barrier.group);
        barrier.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    }
  }
}

// Called after each deal to check if new districts should unlock (legacy deal-count system)
export function checkDistrictUnlocks(totalDeals) {
  const unlocked = [];

  for (const [key, district] of Object.entries(DISTRICTS)) {
    if (!district.unlocked && totalDeals >= district.unlockDeals) {
      district.unlocked = true;
      unlocked.push(key);
      removeBarriersForDistrict(key);
    }
  }

  return unlocked; // list of newly unlocked district keys
}

// Called on rank-up — unlocks all districts whose unlockRank <= new rank index
export function checkDistrictUnlocksByRank(rankIndex) {
  const unlocked = [];

  for (const [key, district] of Object.entries(DISTRICTS)) {
    if (!district.unlocked && district.unlockRank > 0 && rankIndex >= district.unlockRank) {
      district.unlocked = true;
      unlocked.push(key);
      removeBarriersForDistrict(key);
    }
  }

  return unlocked;
}

// Force-unlock a district (for save restoration)
export function forceUnlockDistrict(key) {
  const district = DISTRICTS[key];
  if (!district || district.unlocked) return;
  district.unlocked = true;

  for (const barrier of BARRIERS) {
    if (barrier.district === key && !barrier.removed) {
      barrier.removed = true;
      if (sceneRef && barrier.group) {
        sceneRef.remove(barrier.group);
        barrier.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    }
  }
}

// ========== QUERIES ==========
export function isDistrictUnlocked(key) {
  return DISTRICTS[key]?.unlocked ?? false;
}

export function getUnlockedDistricts() {
  return Object.entries(DISTRICTS)
    .filter(([, d]) => d.unlocked)
    .map(([key]) => key);
}

export function getLockedDistricts() {
  return Object.entries(DISTRICTS)
    .filter(([, d]) => !d.unlocked)
    .map(([key, d]) => ({ key, name: d.name, dealsNeeded: d.unlockDeals, rankNeeded: d.unlockRank }));
}

// Get all active barrier boxes for player collision
export function getBarrierBoxes() {
  return BARRIERS
    .filter(b => !b.removed)
    .map(b => ({ x: b.x, z: b.z, w: Math.max(b.w, 1.5), d: Math.max(b.d, 1.5) }));
}

// For proximity check — "This area is restricted by ACE. [X more deals to access]"
export function getNearbyLockedDistrict(px, pz) {
  for (const barrier of BARRIERS) {
    if (barrier.removed) continue;
    const dx = px - barrier.x;
    const dz = pz - barrier.z;
    if (Math.abs(dx) < 8 && Math.abs(dz) < 8) {
      const district = DISTRICTS[barrier.district];
      if (district && !district.unlocked) {
        return {
          name: district.name,
          dealsNeeded: district.unlockDeals,
          rankNeeded: district.unlockRank,
        };
      }
    }
  }
  return null;
}

// Get district save state
export function getDistrictState() {
  const state = {};
  for (const [key, d] of Object.entries(DISTRICTS)) {
    if (d.unlocked && d.unlockDeals > 0) {
      state[key] = true;
    }
  }
  return state;
}

// Restore district state from save
export function restoreDistrictState(state) {
  if (!state) return;
  for (const key of Object.keys(state)) {
    if (state[key]) forceUnlockDistrict(key);
  }
}

// Which district is the player currently in?
export function getPlayerDistrict(px, pz) {
  let closest = 'town';
  let closestDist = Infinity;
  for (const [key, d] of Object.entries(DISTRICTS)) {
    if (!d.unlocked) continue;
    const dx = px - d.center.x;
    const dz = pz - d.center.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < d.radius && dist < closestDist) {
      closest = key;
      closestDist = dist;
    }
  }
  return closest;
}
