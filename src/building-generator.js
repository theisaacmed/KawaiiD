// Building generator — applies templates with random variations per district
// Replaces the old plain-box building creation in buildings.js
// Each building gets a template + deterministic variations based on position.

import * as THREE from 'three';
import { TEMPLATES, TEMPLATE_CATEGORIES } from './building-templates.js';
import { getTerrainHeight } from './world.js';

// ============================================================
// DISTRICT TEMPLATE WEIGHTS
// Keys are district names, values are { category: weight } objects.
// Within each category, a random template is chosen.
// ============================================================
const DISTRICT_WEIGHTS = {
  town:       { residential: 60, commercial: 30, unique: 10 },
  downtown:   { residential: 20, commercial: 60, unique: 20 },
  burbs:      { residential: 80, commercial: 15, unique: 5 },
  industrial: { residential: 10, commercial: 30, industrial: 60 },
  uptown:     { residential: 30, commercial: 50, unique: 20 },
  tower:      { residential: 10, commercial: 40, unique: 50 },
  northtown:  { residential: 70, commercial: 20, unique: 10 },
  port:       { industrial: 100 },
  aceHQ:      { industrial: 100 },  // will get ACE-specific treatment in buildings.js
};

// ============================================================
// SEEDED RANDOM — deterministic from building position
// ============================================================
function seedRandom(x, z) {
  // Simple hash from position
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return {
    // Returns 0..1
    next() {
      h = (h * 1103515245 + 12345) | 0;
      return ((h >> 16) & 0x7fff) / 0x7fff;
    }
  };
}

// ============================================================
// PICK TEMPLATE FOR A BUILDING
// Uses district weights + building btype hint + deterministic seed
// ============================================================
function pickTemplate(district, btype, rng) {
  // Some btypes have hardcoded template mappings
  const btypeMap = {
    'suburb_house': 'basicHouse',
    'fancy_house': 'basicHouse',  // gets extra detail in buildings.js
    'cottage': 'cottage',
    'nt_residential': 'basicHouse',
    'shop': 'shop',
    'dt_shop': 'shop',
    'restaurant': 'restaurant',
    'apartment': 'apartmentBlock',
    'office': 'office',
    'uptown_office': 'office',
    'uptown_shop': 'shop',
    'commercial': 'office',
    'hotel': 'office',
    'tower_corp': 'tower',
    'tower_service': 'warehouse',
    'ind_warehouse': 'warehouse',
    'ind_factory': 'factory',
    'ind_workshop': 'warehouse',
    'port_warehouse': 'warehouse',
    'port_office': 'office',
    'port_shed': 'warehouse',
    'ace_hq': 'office',
    'ace_barracks': 'warehouse',
    'ace_garage': 'warehouse',
    'chapel': 'church',
    'clocktower': 'tower',
    'market': 'marketStall',
    'cornerstore': 'shop',
    'player_apartment': 'townhouse',
    'residential': null,   // use district weights
    'townhouse': 'townhouse',
  };

  // Check direct mapping first
  if (btype && btypeMap[btype] !== undefined && btypeMap[btype] !== null) {
    return btypeMap[btype];
  }

  // Use district weights to pick a category
  const weights = DISTRICT_WEIGHTS[district] || DISTRICT_WEIGHTS.town;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng.next() * totalWeight;

  let chosenCategory = 'residential'; // fallback
  for (const [cat, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      chosenCategory = cat;
      break;
    }
  }

  // Pick random template from the category
  const templates = TEMPLATE_CATEGORIES[chosenCategory];
  if (!templates || templates.length === 0) return 'basicHouse';

  // For district-specific flavor, prefer certain templates
  if (district === 'burbs' && chosenCategory === 'residential') {
    // Prefer cottage and basicHouse in burbs
    const burbResidential = ['basicHouse', 'cottage', 'basicHouse', 'townhouse'];
    return burbResidential[Math.floor(rng.next() * burbResidential.length)];
  }
  if (district === 'uptown' && chosenCategory === 'residential') {
    return 'apartmentBlock'; // tall apartments in uptown
  }
  if (district === 'tower' && chosenCategory === 'unique') {
    return 'tower';
  }

  return templates[Math.floor(rng.next() * templates.length)];
}

// ============================================================
// APPLY VARIATIONS
// Returns modified { w, h, d } with ±variations
// ============================================================
function applyVariations(b, rng) {
  const hVar = 0.2;  // ±20% height
  const wVar = 0.15; // ±15% width
  const dVar = 0.10; // ±10% depth

  return {
    w: b.w * (1 + (rng.next() - 0.5) * 2 * wVar),
    h: b.h * (1 + (rng.next() - 0.5) * 2 * hVar),
    d: b.d * (1 + (rng.next() - 0.5) * 2 * dVar),
  };
}

// ============================================================
// GENERATE A BUILDING
// Creates a fully detailed building from template + variation
// Returns { mainMesh, group, windowMats[], doorMats[] }
// ============================================================
export function generateBuilding(scene, b, idx, district) {
  const rng = seedRandom(Math.round(b.x * 100), Math.round(b.z * 100));

  // Skip template system for damaged/demolished buildings (they have their own look)
  const skipTemplates = ['damaged_light', 'damaged_medium', 'damaged_heavy', 'demolished'];
  if (skipTemplates.includes(b.btype)) {
    return null; // signal to use legacy creation
  }

  // Pick template
  const templateName = pickTemplate(district, b.btype, rng);
  const templateFn = TEMPLATES[templateName];
  if (!templateFn) return null;

  // Apply size variations
  const varied = applyVariations(b, rng);

  // Generate template geometry
  const result = templateFn(varied.w, varied.h, varied.d);
  const { group, windows, doors, bodyMesh } = result;

  // Position the group in the world, offset for terrain height
  group.position.set(b.x, getTerrainHeight(b.x, b.z), b.z);
  scene.add(group);

  // The bodyMesh is the main wall — it will be colored by the color system
  // Its world position is (b.x, varied.h/2, b.z) since it's at (0, h/2, 0) in the group

  // Collect window/door material references with world position for color system lookup
  const winMats = windows.map(w => ({
    material: w.material,
    x: b.x,
    z: b.z,
  }));

  const DOOR_COLOR_TARGETS = [0xCC7755, 0x7799BB, 0xBB88AA, 0x88AA77, 0xAA8866, 0x9988CC];
  const drMats = doors.map((d, i) => ({
    material: d.material,
    x: b.x,
    z: b.z,
    targetColor: new THREE.Color(DOOR_COLOR_TARGETS[(idx + i) % DOOR_COLOR_TARGETS.length]),
  }));

  return {
    mainMesh: bodyMesh,
    group,
    windowMats: winMats,
    doorMats: drMats,
    w: varied.w,
    h: varied.h,
    d: varied.d,
  };
}
