// Building generation — ~110 buildings across all districts + landmarks
// All simple Three.js geometry (boxes, cones, cylinders). No imported models.
// Each building tracks colorAmount individually for the color system.

import * as THREE from 'three';
import { isDistrictUnlocked } from './districts.js';
import { getRoadSegments } from './roads.js';
import { generateBuilding } from './building-generator.js';
import { NAMED_BUILDINGS } from './named-buildings.js';
import { getTerrainHeight } from './world.js';

// Window and door materials — updated by color system
const windowMats = [];
const doorMats = [];

// All building meshes (for color system)
const allBuildings = [];
// Building collision data (for ACE LOS, player collision)
const allBuildingBlocks = [];

const DOOR_COLOR_TARGETS = [0xCC7755, 0x7799BB, 0xBB88AA, 0x88AA77, 0xAA8866, 0x9988CC];

// ========== BUILDING DATA PER DISTRICT ==========
// { x, z, w, d, h, district, ?landmark }

// TOWN (center, starting area) — dense urban blocks lining every street
// Player spawns at (0, 1.7, 20). Main Street runs N-S at X=0, secondary streets at X=-40, X=40.
// Cross street at Z=-10 (E-W). Buildings line both sides of every road, 2-3 unit gaps within blocks.
const TOWN_BUILDINGS = [
  // ====== MAIN STREET WEST SIDE (X ~ -8 to -14) — buildings facing Main St ======
  { x: -7.2, z: -4.8, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: -7.2, z: 1.8, w: 8, d: 7, h: 9, btype: 'apartment' },
  { x: -6.6, z: 8.4, w: 7, d: 7, h: 8, btype: 'residential' },
  { x: -7.2, z: 15, w: 8, d: 7, h: 10, btype: 'luna_townhouse', named: 'luna_townhouse', namedSigColor: 0xAFA9EC },
  { x: -6.6, z: 21.6, w: 7, d: 7, h: 7, btype: 'shop' },
  { x: -7.2, z: 27.6, w: 8, d: 6, h: 9, btype: 'residential' },

  // ====== MAIN STREET EAST SIDE (X ~ 8 to 14) — buildings facing Main St ======
  { x: 7.2, z: -4.8, w: 8, d: 7, h: 8, btype: 'shop' },
  { x: 6.6, z: 1.8, w: 7, d: 7, h: 10, btype: 'apartment' },
  { x: 7.2, z: 15, w: 8, d: 7, h: 9, btype: 'residential' },
  { x: 6.6, z: 21.6, w: 7, d: 7, h: 8, btype: 'shop' },
  { x: 7.2, z: 27.6, w: 8, d: 6, h: 10, btype: 'apartment' },

  // === Player apartment (on east side of Main St) ===
  { x: 7.2, z: 8.4, w: 7, d: 7, h: 10, landmark: 'apartment', btype: 'player_apartment' },

  // ====== WEST SECONDARY STREET (X=-40) — WEST SIDE (X ~ -48) ======
  { x: -28.8, z: -4.8, w: 8, d: 7, h: 8, btype: 'residential' },
  { x: -28.8, z: 1.8, w: 8, d: 7, h: 7, btype: 'residential' },
  { x: -28.8, z: 8.4, w: 8, d: 7, h: 9, btype: 'apartment' },
  { x: -28.8, z: 15, w: 8, d: 7, h: 7, btype: 'residential' },
  { x: -28.8, z: 21.6, w: 8, d: 7, h: 10, btype: 'apartment' },
  { x: -28.8, z: 27.6, w: 8, d: 6, h: 8, btype: 'residential' },

  // ====== WEST SECONDARY STREET (X=-40) — EAST SIDE (X ~ -32) ======
  { x: -19.2, z: -4.8, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: -19.2, z: 1.8, w: 8, d: 7, h: 9, btype: 'residential' },
  { x: -19.2, z: 8.4, w: 8, d: 7, h: 8, btype: 'apartment' },
  { x: -19.2, z: 15, w: 8, d: 7, h: 10, btype: 'residential' },
  { x: -19.2, z: 21.6, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: -19.2, z: 27.6, w: 8, d: 6, h: 9, btype: 'residential' },

  // ====== EAST SECONDARY STREET (X=40) — WEST SIDE (X ~ 32) ======
  { x: 19.2, z: -4.8, w: 8, d: 7, h: 9, btype: 'residential' },
  { x: 19.2, z: 1.8, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: 19.2, z: 8.4, w: 8, d: 7, h: 8, btype: 'residential' },
  { x: 19.2, z: 15, w: 8, d: 7, h: 10, btype: 'apartment' },
  { x: 19.2, z: 21.6, w: 8, d: 7, h: 7, btype: 'residential' },
  { x: 19.2, z: 27.6, w: 8, d: 6, h: 9, btype: 'shop' },

  // ====== EAST SECONDARY STREET (X=40) — EAST SIDE (X ~ 48) ======
  { x: 28.8, z: -4.8, w: 8, d: 7, h: 8, btype: 'residential' },
  { x: 28.8, z: 1.8, w: 8, d: 7, h: 10, btype: 'apartment' },
  { x: 28.8, z: 8.4, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: 28.8, z: 15, w: 8, d: 7, h: 10, btype: 'mei_apartment', named: 'mei_apartment', namedSigColor: 0xED93B1 },
  { x: 28.8, z: 21.6, w: 8, d: 7, h: 8, btype: 'apartment' },
  { x: 28.8, z: 27.6, w: 8, d: 6, h: 7, btype: 'residential' },

  // ====== CROSS STREET (Z=-10) — SOUTH SIDE (Z ~ -17) ======
  { x: -16.8, z: -10.2, w: 7, d: 7, h: 8, btype: 'residential' },
  { x: -10.8, z: -10.2, w: 7, d: 7, h: 7, btype: 'shop' },
  { x: 10.8, z: -10.2, w: 7, d: 7, h: 9, btype: 'residential' },
  { x: 16.8, z: -10.2, w: 7, d: 7, h: 7, btype: 'shop' },

  // ====== CORNER STORE at Main/Cross intersection ======
  { x: 15, z: 19.2, w: 8, d: 6, h: 7, btype: 'cornerstore' },

  // === Named buildings — mid-block fills ===
  { x: -13.2, z: 8.4, w: 7, d: 6, h: 8, btype: 'kit_shop', named: 'kit_shop', namedSigColor: 0x9FE1CB },
];

// DOWNTOWN (north-center) — dense commercial/office district
const DOWNTOWN_BUILDINGS = [
  // === Main St west side (X ~ -12), Z: 88-140 ===
  { x: -7.2, z: 52.8, w: 9, d: 8, h: 12, btype: 'office' },
  { x: -7.2, z: 60, w: 9, d: 8, h: 14, btype: 'office' },
  { x: -7.2, z: 67.2, w: 10, d: 9, h: 11, btype: 'commercial' },
  { x: -7.2, z: 74.4, w: 9, d: 8, h: 13, btype: 'office' },
  { x: -7.2, z: 81.6, w: 10, d: 8, h: 10, landmark: 'market', btype: 'market' },
  // === Main St east side (X ~ 12), Z: 88-140 ===
  { x: 7.2, z: 52.8, w: 9, d: 8, h: 10, btype: 'nao_cafe', named: 'nao_cafe', namedSigColor: 0xFAC775 },
  { x: 7.2, z: 60, w: 9, d: 8, h: 15, btype: 'office' },
  { x: 4.8, z: 67.2, w: 5, d: 5, h: 12, landmark: 'clocktower', btype: 'clocktower' },
  { x: 7.2, z: 74.4, w: 9, d: 8, h: 12, btype: 'dt_shop' },
  { x: 7.2, z: 81.6, w: 9, d: 8, h: 11, btype: 'restaurant' },
  // === Secondary street west (X ~ -35), Z: 88-130 ===
  { x: -21, z: 54, w: 9, d: 8, h: 11, btype: 'harper_office', named: 'harper_office', namedSigColor: 0x85B7EB },
  { x: -21, z: 61.2, w: 9, d: 8, h: 13, btype: 'commercial' },
  { x: -21, z: 68.4, w: 9, d: 8, h: 10, btype: 'dt_shop' },
  { x: -21, z: 75.6, w: 9, d: 8, h: 12, btype: 'office' },
  // === East of Main St (X ~ 32-55), Z: 88-135 ===
  { x: 19.2, z: 54, w: 9, d: 8, h: 10, btype: 'dt_shop' },
  { x: 19.2, z: 61.2, w: 9, d: 8, h: 14, btype: 'office' },
  { x: 19.2, z: 68.4, w: 9, d: 8, h: 11, btype: 'commercial' },
  { x: 19.2, z: 75.6, w: 9, d: 8, h: 12, btype: 'dt_shop' },
  { x: 30, z: 54, w: 9, d: 8, h: 11, btype: 'marco_restaurant', named: 'marco_restaurant', namedSigColor: 0xF0997B },
  { x: 30, z: 61.2, w: 9, d: 8, h: 11, btype: 'office' },
  { x: 30, z: 68.4, w: 9, d: 8, h: 10, btype: 'dt_shop' },
  { x: 30, z: 75.6, w: 9, d: 8, h: 14, btype: 'office' },
];

// NORTHTOWN (northeast) — orderly residential rows, chapel
const NORTHTOWN_BUILDINGS = [
  // === Row 1 ===
  { x: 63, z: 81, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 70.8, z: 81, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 78, z: 81, w: 7, d: 7, h: 5, landmark: 'chapel', btype: 'chapel' },
  { x: 85.2, z: 81, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 93, z: 81, w: 8, d: 7, h: 7, btype: 'yuna_shop', named: 'yuna_shop', namedSigColor: 0xFAC775 },
  // === Row 2 ===
  { x: 64.8, z: 91.2, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 72.6, z: 91.2, w: 8, d: 7, h: 9, btype: 'nt_residential' },
  { x: 80.4, z: 91.2, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 88.2, z: 91.2, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  // === Row 3 ===
  { x: 66, z: 103.2, w: 8, d: 7, h: 7, btype: 'nt_residential' },
  { x: 75, z: 103.2, w: 8, d: 7, h: 7, btype: 'nt_residential' },
  { x: 84, z: 103.2, w: 8, d: 7, h: 8, btype: 'nt_residential' },
  { x: 93, z: 99, w: 8, d: 7, h: 7, btype: 'shop' },
  { x: 60, z: 90, w: 7, d: 6, h: 5, btype: 'kai_shack', named: 'kai_shack', namedSigColor: 0x85B7EB },
];

// BURBS (southeast) — suburban houses, playground, school
const BURBS_BUILDINGS = [
  // === Block 1: south row ===
  { x: 72, z: -24, w: 9, d: 7, h: 6, btype: 'suburb_house' },
  { x: 82.8, z: -25.2, w: 9, d: 8, h: 6, btype: 'suburb_house' },
  { x: 93, z: -22.8, w: 9, d: 7, h: 6, btype: 'tomas_cottage', named: 'tomas_cottage', namedSigColor: 0xF5C4B3 },
  { x: 105, z: -25.2, w: 14, d: 10, h: 9, btype: 'the_school', named: 'the_school', namedSigColor: 0x85B7EB },
  // === Block 2: middle row ===
  { x: 73.2, z: -10.8, w: 9, d: 7, h: 6, btype: 'suburb_house' },
  { x: 84, z: -9, w: 9, d: 7, h: 7, btype: 'suburb_house' },
  { x: 94.8, z: -12, w: 9, d: 8, h: 6, btype: 'suburb_house' },
  { x: 106.8, z: -10.8, w: 9, d: 7, h: 6, btype: 'suburb_house' },
  // === Block 3: north row ===
  { x: 75, z: 3, w: 8, d: 7, h: 6, landmark: 'playground', btype: 'suburb_house' },
  { x: 85.2, z: 1.2, w: 9, d: 7, h: 6, btype: 'suburb_house' },
  { x: 96, z: 3, w: 9, d: 8, h: 7, btype: 'suburb_house' },
  { x: 108, z: 1.2, w: 9, d: 7, h: 7, btype: 'suburb_house' },
  // === Extra houses ===
  { x: 78, z: 13.2, w: 9, d: 7, h: 6, btype: 'suburb_house' },
  { x: 93, z: 15, w: 9, d: 8, h: 6, btype: 'suburb_house' },
  { x: 117, z: -18, w: 9, d: 7, h: 7, btype: 'suburb_house' },
];

// UPTOWN (east) — sleek offices, hotel, rooftop garden, high-end shops
const UPTOWN_BUILDINGS = [
  // === South row ===
  { x: 93, z: 34.8, w: 9, d: 7, h: 12, btype: 'uptown_shop' },
  { x: 100.8, z: 33, w: 9, d: 7, h: 14, btype: 'kenji_office', named: 'kenji_office', namedSigColor: 0xAFA9EC },
  { x: 109.2, z: 34.8, w: 10, d: 8, h: 16, landmark: 'hotel', btype: 'hotel' },
  { x: 117, z: 33, w: 9, d: 7, h: 12, btype: 'uptown_shop' },
  // === Middle row ===
  { x: 94.8, z: 46.8, w: 9, d: 7, h: 13, btype: 'uptown_office' },
  { x: 103.2, z: 45, w: 10, d: 8, h: 15, btype: 'sora_building', named: 'sora_building', namedSigColor: 0xFAC775 },
  { x: 112.8, z: 46.8, w: 9, d: 7, h: 12, btype: 'uptown_shop' },
  // === North row ===
  { x: 93, z: 58.8, w: 9, d: 7, h: 14, btype: 'uptown_office' },
  { x: 102, z: 57, w: 9, d: 8, h: 13, btype: 'uptown_office' },
  { x: 111, z: 58.8, w: 9, d: 7, h: 12, btype: 'uptown_shop' },
  { x: 118.8, z: 57, w: 9, d: 7, h: 14, btype: 'uptown_office' },
  { x: 120, z: 45, w: 10, d: 7, h: 11, btype: 'uptown_shop' },
];

// TOWER (west) — tallest in game, twin towers, dark canyons
const TOWER_BUILDINGS = [
  // === Twin Towers — Tower A is Dante's lobby ===
  { x: -96, z: 60, w: 10, d: 9, h: 28, btype: 'dante_tower', named: 'dante_tower', namedSigColor: 0xF0997B },
  { x: -87, z: 60, w: 10, d: 9, h: 28, landmark: 'twintower2', btype: 'tower_corp' },
  // === Other mega buildings ===
  { x: -75, z: 61.2, w: 9, d: 9, h: 22, btype: 'tower_corp' },
  { x: -99, z: 72, w: 10, d: 10, h: 30, btype: 'tower_corp' },
  { x: -88.8, z: 73.2, w: 10, d: 9, h: 24, btype: 'tower_corp' },
  { x: -76.8, z: 70.8, w: 10, d: 9, h: 26, btype: 'tower_corp' },
  { x: -94.8, z: 85.2, w: 9, d: 10, h: 22, btype: 'tower_corp' },
  { x: -84, z: 84, w: 10, d: 9, h: 30, btype: 'quinn_apt', named: 'quinn_apt', namedSigColor: 0xAFA9EC },
  { x: -73.2, z: 82.8, w: 9, d: 9, h: 20, btype: 'tower_corp' },
  { x: -81, z: 78, w: 6, d: 6, h: 6, btype: 'tower_service' },
];

// INDUSTRIAL (south-center) — warehouses, factory, workshops
const INDUSTRIAL_BUILDINGS = [
  // === Row 1 ===
  { x: -12, z: -51, w: 12, d: 9, h: 8, btype: 'ind_warehouse' },
  { x: -3, z: -52.8, w: 14, d: 11, h: 10, btype: 'taro_factory', named: 'taro_factory', namedSigColor: 0xF5C4B3 },
  { x: 9, z: -51, w: 12, d: 9, h: 8, btype: 'ind_warehouse' },
  { x: 21, z: -52.8, w: 14, d: 11, h: 8, btype: 'workshop_property', named: 'workshop_property', namedSigColor: 0xF5C4B3 },
  { x: 33, z: -51, w: 10, d: 9, h: 7, btype: 'vex_squat', named: 'vex_squat', namedSigColor: 0xED93B1 },
  // === Row 2 ===
  { x: -13.2, z: -66, w: 12, d: 10, h: 7, btype: 'ind_warehouse' },
  { x: -3, z: -67.2, w: 14, d: 9, h: 8, btype: 'ind_workshop' },
  { x: 9, z: -64.8, w: 12, d: 11, h: 7, btype: 'ind_warehouse' },
  { x: 21, z: -67.2, w: 14, d: 9, h: 8, btype: 'ind_workshop' },
  { x: 33, z: -64.8, w: 12, d: 10, h: 7, btype: 'ind_warehouse' },
  // === Row 3 ===
  { x: -9, z: -78, w: 12, d: 9, h: 7, btype: 'ind_warehouse' },
  { x: 6, z: -79.2, w: 14, d: 11, h: 7, btype: 'ind_warehouse' },
  { x: 24, z: -76.8, w: 12, d: 9, h: 7, btype: 'ind_warehouse' },
  { x: 36, z: -75, w: 9, d: 7, h: 10, btype: 'office' },
];

// PORT (northwest coast) — docks, warehouses, lighthouse
const PORT_BUILDINGS = [
  { x: -60, z: 117, w: 14, d: 10, h: 8, btype: 'port_warehouse' },
  { x: -45, z: 117, w: 12, d: 9, h: 7, btype: 'shipping_yard', named: 'shipping_yard', namedSigColor: 0x85B7EB },
  { x: -57, z: 135, w: 5, d: 5, h: 3, landmark: 'lighthouse', btype: 'port_warehouse' },
  { x: -33, z: 118.8, w: 9, d: 7, h: 7, btype: 'gus_office', named: 'gus_office', namedSigColor: 0x85B7EB },
  { x: -66, z: 126, w: 9, d: 7, h: 6, btype: 'port_shed' },
  { x: -36, z: 129, w: 9, d: 7, h: 6, btype: 'port_shed' },
  { x: -51, z: 126, w: 10, d: 7, h: 6, btype: 'port_warehouse' },
  { x: -28.8, z: 126, w: 8, d: 7, h: 5, btype: 'port_shed' },
];

// ACE HQ (southwest) — main HQ, barracks, watchtower, compound
const ACE_HQ_BUILDINGS = [
  { x: -90, z: -33, w: 16, d: 14, h: 12, landmark: 'acehq', btype: 'ace_hq' },
  { x: -75, z: -30, w: 9, d: 7, h: 7, btype: 'ace_barracks' },
  { x: -75, z: -36, w: 9, d: 7, h: 7, btype: 'ace_barracks' },
  { x: -75, z: -42, w: 9, d: 7, h: 7, btype: 'ace_barracks' },
  { x: -99, z: -42, w: 10, d: 8, h: 7, btype: 'ace_garage' },
  { x: -78, z: -48, w: 4, d: 4, h: 3, landmark: 'watchtower', btype: 'ace_barracks' },
  { x: -99, z: -28.8, w: 9, d: 7, h: 7, btype: 'ace_barracks' },
  { x: -87, z: -46.8, w: 9, d: 7, h: 7, btype: 'ace_barracks' },
];

// ========== TRANSITION ZONE BUILDINGS ==========
// These fill the gaps between districts for natural transitions (30-40 unit span)

// TOWN → DOWNTOWN (z: 30-85): buildings get taller approaching downtown
const TRANSITION_TOWN_DOWNTOWN = [
  // West side of Main St
  { x: -7.2, z: 34.8, w: 8, d: 7, h: 9, btype: 'shop' },
  { x: -7.2, z: 42, w: 8, d: 7, h: 11, btype: 'office' },
  { x: -7.2, z: 49.2, w: 8, d: 7, h: 12, btype: 'office' },
  // East side of Main St
  { x: 7.2, z: 34.8, w: 8, d: 7, h: 10, btype: 'residential' },
  { x: 7.2, z: 42, w: 8, d: 7, h: 11, btype: 'office' },
  { x: 7.2, z: 49.2, w: 8, d: 7, h: 13, btype: 'office' },
  // Further west
  { x: -19.2, z: 36, w: 8, d: 7, h: 8, btype: 'shop' },
  { x: -19.2, z: 43.2, w: 8, d: 7, h: 10, btype: 'residential' },
  // Further east
  { x: 19.2, z: 36, w: 8, d: 7, h: 9, btype: 'shop' },
  { x: 19.2, z: 43.2, w: 8, d: 7, h: 10, btype: 'residential' },
  { x: 28.8, z: 39, w: 8, d: 7, h: 8, btype: 'residential' },
];

// TOWN → RUINS (z: -12 to -120): buildings get damaged
const TRANSITION_TOWN_RUINS = [
  // West side of Main St — damaged buildings
  { x: -7.2, z: -15, w: 8, d: 7, h: 7, btype: 'damaged_light' },
  { x: -7.2, z: -24, w: 8, d: 7, h: 6, btype: 'damaged_medium' },
  { x: -7.2, z: -33, w: 8, d: 7, h: 5, btype: 'damaged_medium' },
  { x: -7.2, z: -42, w: 8, d: 7, h: 4, btype: 'damaged_heavy' },
  // East side of Main St — damaged buildings
  { x: 7.2, z: -15, w: 8, d: 7, h: 8, btype: 'damaged_light' },
  { x: 7.2, z: -24, w: 8, d: 7, h: 6, btype: 'damaged_medium' },
  { x: 7.2, z: -33, w: 8, d: 7, h: 5, btype: 'damaged_heavy' },
  { x: 7.2, z: -42, w: 8, d: 7, h: 4, btype: 'damaged_heavy' },
  // Further out — half-demolished
  { x: -18, z: -30, w: 8, d: 7, h: 5, btype: 'damaged_medium' },
  { x: 18, z: -27, w: 8, d: 7, h: 6, btype: 'damaged_medium' },
  { x: -9, z: -60, w: 8, d: 7, h: 4, btype: 'demolished' },
  { x: 12, z: -63, w: 7, d: 6, h: 3, btype: 'demolished' },
  { x: -21, z: -66, w: 8, d: 7, h: 5, btype: 'demolished' },
  { x: 24, z: -69, w: 7, d: 7, h: 3, btype: 'demolished' },
];

// ========== ALL DISTRICT BUILDING SETS ==========
const DISTRICT_BUILDING_SETS = {
  town: [...TOWN_BUILDINGS, ...TRANSITION_TOWN_DOWNTOWN, ...TRANSITION_TOWN_RUINS],
  downtown: DOWNTOWN_BUILDINGS,
  northtown: NORTHTOWN_BUILDINGS,
  burbs: BURBS_BUILDINGS,
  uptown: UPTOWN_BUILDINGS,
  tower: TOWER_BUILDINGS,
  industrial: INDUSTRIAL_BUILDINGS,
  port: PORT_BUILDINGS,
  aceHQ: ACE_HQ_BUILDINGS,
};

// ========== BUILDING CREATION ==========
function addWindows(scene, b, idx) {
  const winBaseMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const floors = Math.max(1, Math.floor(b.h / 1.8));
  const perFloor = Math.max(1, Math.floor(b.w / 1.5));

  // Front face (z+ side)
  for (let f = 0; f < floors; f++) {
    for (let w = 0; w < perFloor; w++) {
      const wMat = winBaseMat.clone();
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.04), wMat);
      const wx = b.x - b.w / 2 + 0.6 + w * (b.w - 1) / Math.max(1, perFloor - 1);
      const wy = 1.2 + f * 1.8;
      if (wy > b.h - 0.3) continue;
      win.position.set(wx, wy, b.z + b.d / 2 + 0.02);
      scene.add(win);
      windowMats.push({ material: wMat, x: b.x, z: b.z });
    }
  }

  // Side face (x+ side)
  if (b.d > 2) {
    for (let f = 0; f < Math.min(floors, 3); f++) {
      const wMat = winBaseMat.clone();
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.5), wMat);
      const wy = 1.2 + f * 1.8;
      if (wy > b.h - 0.3) continue;
      win.position.set(b.x + b.w / 2 + 0.02, wy, b.z);
      scene.add(win);
      windowMats.push({ material: wMat, x: b.x, z: b.z });
    }
  }
}

function addDoor(scene, b, idx) {
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.04), doorMat);
  door.position.set(b.x, 0.7, b.z + b.d / 2 + 0.02);
  scene.add(door);

  // Door frame
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.05), frameMat);
  frameTop.position.set(b.x, 1.43, b.z + b.d / 2 + 0.02);
  scene.add(frameTop);

  doorMats.push({
    material: doorMat,
    x: b.x, z: b.z,
    targetColor: new THREE.Color(DOOR_COLOR_TARGETS[idx % DOOR_COLOR_TARGETS.length]),
  });
}

function addRoofVariety(scene, b, idx) {
  const variety = idx % 6;

  if (variety === 0) {
    // Pitched roof
    const roofH = b.h * 0.2;
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.55, roofH, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x606060 }));
    roof.position.set(b.x, b.h + roofH / 2, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
  } else if (variety === 1 && b.h > 3) {
    // Setback upper floor
    const setbackH = b.h * 0.25;
    const setback = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.7, setbackH, b.d * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x686868 })
    );
    setback.position.set(b.x, b.h + setbackH / 2, b.z);
    setback.castShadow = true;
    scene.add(setback);
  } else if (variety === 2) {
    // Balcony
    const balconyMat = new THREE.MeshLambertMaterial({ color: 0x656565 });
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 0.08, 0.6), balconyMat);
    balcony.position.set(b.x, b.h * 0.6, b.z + b.d / 2 + 0.3);
    balcony.castShadow = true;
    scene.add(balcony);
  } else if (variety === 3) {
    // Awning
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.7, 0.06, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x5A5A5A })
    );
    awning.position.set(b.x, 2.3, b.z + b.d / 2 + 0.4);
    awning.rotation.x = -0.15;
    awning.castShadow = true;
    scene.add(awning);
  } else if (variety === 4 && b.h > 2) {
    // Rooftop structure
    const rtH = 0.8;
    const rooftop = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.3, rtH, b.d * 0.3),
      new THREE.MeshLambertMaterial({ color: 0x5E5E5E })
    );
    rooftop.position.set(b.x + b.w * 0.15, b.h + rtH / 2, b.z - b.d * 0.15);
    rooftop.castShadow = true;
    scene.add(rooftop);
  }
}

function createBuilding(scene, b, idx, district) {
  // Try the template-based generator first
  const generated = generateBuilding(scene, b, idx, district);
  if (generated) {
    const { mainMesh, group, windowMats: wMats, doorMats: dMats, w, h, d } = generated;

    // Named building: stamp signature color on the mesh for the color system
    if (b.namedSigColor) mainMesh.userData.namedSigColor = b.namedSigColor;
    if (b.named) mainMesh.userData.namedId = b.named;

    // Track the main body mesh for the color system
    allBuildings.push({ mesh: mainMesh, district, block: b });
    allBuildingBlocks.push({ x: b.x, z: b.z, w: w, d: d, h: h, district });

    // Merge window/door materials into the global lists
    for (const wm of wMats) windowMats.push(wm);
    for (const dm of dMats) doorMats.push(dm);

    // Still add btype-specific extras (corner store extension, outdoor seating already in template, etc.)
    // Only add extras not covered by templates
    if (b.btype === 'cornerstore') {
      addCornerStoreExtension(scene, { ...b, w, h, d });
    }
    if (b.btype === 'player_apartment') {
      // Brighter door overlay to stand out
      const brightDoorMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
      const brightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.05), brightDoorMat);
      brightDoor.position.set(b.x, 0.8, b.z + d / 2 + 0.04);
      scene.add(brightDoor);
      doorMats.push({ material: brightDoorMat, x: b.x, z: b.z, targetColor: new THREE.Color(0xCCBB88) });
    }

    return mainMesh;
  }

  // Legacy path — for damaged/demolished buildings and fallback
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const mat = new THREE.MeshLambertMaterial({ color: 0x707070 });
  const mesh = new THREE.Mesh(geo, mat);
  const legacyY = getTerrainHeight(b.x, b.z);
  mesh.position.set(b.x, legacyY + b.h / 2, b.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Foundation
  if (legacyY > 0.2) {
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.4, legacyY, b.d + 0.4),
      new THREE.MeshLambertMaterial({ color: 0x666666 })
    );
    foundation.position.set(b.x, legacyY / 2, b.z);
    scene.add(foundation);
  }

  // Named building: stamp signature color on the mesh for the color system
  if (b.namedSigColor) mesh.userData.namedSigColor = b.namedSigColor;
  if (b.named) mesh.userData.namedId = b.named;

  mesh.visible = true;

  scene.add(mesh);
  allBuildings.push({ mesh, district, block: b });
  allBuildingBlocks.push({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h, district });

  // Legacy visual details for damaged buildings
  addRoofVariety(scene, b, idx);
  addWindows(scene, b, idx);
  addDoor(scene, b, idx);
  addBuildingTypeDetail(scene, b, idx);

  return mesh;
}

// Corner store: add an L-shaped extension perpendicular to main body
function addCornerStoreExtension(scene, b) {
  const extMat = new THREE.MeshLambertMaterial({ color: 0x707070 });
  const ext = new THREE.Mesh(new THREE.BoxGeometry(4, b.h, b.d * 0.6), extMat);
  ext.position.set(b.x + b.w / 2 + 1.8, b.h / 2, b.z - b.d * 0.3);
  ext.castShadow = true;
  ext.receiveShadow = true;
  scene.add(ext);
  allBuildingBlocks.push({ x: b.x + b.w / 2 + 1.8, z: b.z - b.d * 0.3, w: 4, d: b.d * 0.6, h: b.h, district: 'town' });
}

// Add type-specific building details
function addBuildingTypeDetail(scene, b, idx) {
  const btype = b.btype || '';

  if (btype === 'shop' || btype === 'dt_shop') {
    // Wide shop-front window on ground floor
    const shopWinMat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
    const shopWin = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 1.4, 0.05), shopWinMat);
    shopWin.position.set(b.x, 1.0, b.z + b.d / 2 + 0.03);
    scene.add(shopWin);
    // Blank sign rectangle above shop
    const signMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.6, 0.5, 0.06), signMat);
    sign.position.set(b.x, 2.2, b.z + b.d / 2 + 0.03);
    scene.add(sign);
  }

  if (btype === 'dt_shop') {
    // Awning over storefront
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 0.06, 1.2), awningMat);
    awning.position.set(b.x, 2.6, b.z + b.d / 2 + 0.5);
    awning.rotation.x = -0.12;
    awning.castShadow = true;
    scene.add(awning);
  }

  if (btype === 'restaurant') {
    // Outdoor seating: 2-3 small tables on the sidewalk in front
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    for (let i = 0; i < 3; i++) {
      const tx = b.x - 1.5 + i * 1.5;
      const tz = b.z + b.d / 2 + 1.5;
      // Table top
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.6), tableMat);
      top.position.set(tx, 0.7, tz);
      top.castShadow = true;
      scene.add(top);
      // Table leg
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4), tableMat);
      leg.position.set(tx, 0.35, tz);
      scene.add(leg);
    }
    // Awning
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 0.06, 1.5), awningMat);
    awning.position.set(b.x, 2.8, b.z + b.d / 2 + 0.6);
    awning.rotation.x = -0.1;
    awning.castShadow = true;
    scene.add(awning);
  }

  if (btype === 'apartment') {
    // Extra windows on both sides
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const floors = Math.floor(b.h / 1.8);
    for (let f = 0; f < floors; f++) {
      const wy = 1.2 + f * 1.8;
      if (wy > b.h - 0.3) continue;
      // Left side
      const wl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.5), winMat.clone());
      wl.position.set(b.x - b.w / 2 - 0.02, wy, b.z);
      scene.add(wl);
      windowMats.push({ material: wl.material, x: b.x, z: b.z });
    }
  }

  if (btype === 'player_apartment') {
    // Brighter door to stand out
    const brightDoorMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const brightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.05), brightDoorMat);
    brightDoor.position.set(b.x, 0.8, b.z + b.d / 2 + 0.04);
    scene.add(brightDoor);
    doorMats.push({ material: brightDoorMat, x: b.x, z: b.z, targetColor: new THREE.Color(0xCCBB88) });
  }

  if (btype === 'cornerstore') {
    addCornerStoreExtension(scene, b);
  }

  if (btype === 'office') {
    // More grid windows on both sides
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const floors = Math.floor(b.h / 1.5);
    const perFloor = Math.max(2, Math.floor(b.w / 1.2));
    // Extra side windows (left side)
    for (let f = 0; f < floors; f++) {
      const wy = 1.0 + f * 1.5;
      if (wy > b.h - 0.3) continue;
      const wMat = winMat.clone();
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.4), wMat);
      win.position.set(b.x - b.w / 2 - 0.02, wy, b.z);
      scene.add(win);
      windowMats.push({ material: wMat, x: b.x, z: b.z });
    }
  }

  if (btype === 'commercial') {
    // Multiple entrance markers (simple darker rectangles)
    for (let i = 0; i < 2; i++) {
      const dMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.04), dMat);
      d.position.set(b.x - b.w * 0.2 + i * b.w * 0.4, 0.7, b.z + b.d / 2 + 0.02);
      scene.add(d);
      doorMats.push({ material: dMat, x: b.x, z: b.z, targetColor: new THREE.Color(DOOR_COLOR_TARGETS[(idx + i) % DOOR_COLOR_TARGETS.length]) });
    }
  }

  // === Damaged / transition buildings ===
  if (btype === 'damaged_light') {
    // Darker patches on walls (paint peeling)
    const patchMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
    for (let i = 0; i < 2; i++) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(1 + Math.random(), 0.8 + Math.random(), 0.05), patchMat);
      patch.position.set(
        b.x + (Math.random() - 0.5) * b.w * 0.6,
        1 + Math.random() * (b.h - 2),
        b.z + b.d / 2 + 0.03
      );
      scene.add(patch);
    }
  }

  if (btype === 'damaged_medium') {
    // More dark patches + boarded windows (planks over windows)
    const patchMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
    for (let i = 0; i < 3; i++) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random(), 0.6 + Math.random() * 0.5, 0.05), patchMat);
      patch.position.set(
        b.x + (Math.random() - 0.5) * b.w * 0.7,
        0.8 + Math.random() * (b.h - 1.5),
        b.z + b.d / 2 + 0.03
      );
      scene.add(patch);
    }
    // Boarded window (X of planks)
    const plankMat = new THREE.MeshLambertMaterial({ color: 0x5A5050 });
    const plankX = b.x + (idx % 2 === 0 ? -1 : 1);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.04), plankMat);
    p1.position.set(plankX, 1.5, b.z + b.d / 2 + 0.04);
    p1.rotation.z = 0.6;
    scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.04), plankMat);
    p2.position.set(plankX, 1.5, b.z + b.d / 2 + 0.04);
    p2.rotation.z = -0.6;
    scene.add(p2);
  }

  if (btype === 'damaged_heavy') {
    // Very dark walls, multiple boarded windows, debris at base
    const darkWallMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 4; i++) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 1.5, 0.5 + Math.random(), 0.05), darkWallMat);
      patch.position.set(
        b.x + (Math.random() - 0.5) * b.w * 0.8,
        0.5 + Math.random() * (b.h - 1),
        b.z + b.d / 2 + 0.03
      );
      scene.add(patch);
    }
    // Debris at base
    const debrisMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 + Math.random() * 0.6, 0.2 + Math.random() * 0.3, 0.3 + Math.random() * 0.5),
        debrisMat
      );
      d.position.set(
        b.x + (Math.random() - 0.5) * b.w,
        0.15,
        b.z + b.d / 2 + 0.5 + Math.random() * 0.5
      );
      d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.2);
      d.castShadow = true;
      scene.add(d);
    }
  }

  if (btype === 'demolished') {
    // Half-standing walls with rubble
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
    // One standing wall fragment
    const wallH = b.h + Math.random();
    const wallFrag = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.4, wallH, 0.3), wallMat);
    wallFrag.position.set(b.x + b.w * 0.2, wallH / 2, b.z + b.d / 2);
    wallFrag.rotation.z = (Math.random() - 0.5) * 0.1;
    wallFrag.castShadow = true;
    scene.add(wallFrag);
    // Rubble around
    const debrisMat = new THREE.MeshLambertMaterial({ color: 0x4E4E4E });
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.4 + Math.random() * 0.8, 0.15 + Math.random() * 0.3, 0.4 + Math.random() * 0.6),
        debrisMat
      );
      d.position.set(
        b.x + (Math.random() - 0.5) * (b.w + 2),
        Math.random() * 0.3,
        b.z + (Math.random() - 0.5) * (b.d + 2)
      );
      d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.2);
      d.castShadow = true;
      scene.add(d);
    }
  }

  // ========== BURBS ==========
  if (btype === 'suburb_house') {
    // Flat yard area in front (lighter ground)
    const yardMat = new THREE.MeshLambertMaterial({ color: 0x6E6E60 });
    const yard = new THREE.Mesh(new THREE.BoxGeometry(b.w + 2, 0.03, 3), yardMat);
    yard.position.set(b.x, 0.015, b.z + b.d / 2 + 2);
    yard.receiveShadow = true;
    scene.add(yard);
    // Pitched roof
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.6, b.h * 0.3, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5A5A5A }));
    roof.position.set(b.x, b.h + b.h * 0.15, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    // Picket fence (50% chance)
    if (idx % 2 === 0) {
      const fenceMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
      // Front fence
      const fence = new THREE.Mesh(new THREE.BoxGeometry(b.w + 2, 0.6, 0.06), fenceMat);
      fence.position.set(b.x, 0.3, b.z + b.d / 2 + 3.5);
      scene.add(fence);
      // Fence posts
      for (let fp = 0; fp < 5; fp++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), fenceMat);
        post.position.set(b.x - b.w / 2 - 1 + fp * ((b.w + 2) / 4), 0.4, b.z + b.d / 2 + 3.5);
        scene.add(post);
      }
    }
  }

  if (btype === 'fancy_house') {
    // Bigger pitched roof, nicer yard, columns at entrance
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.6, b.h * 0.35, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x555555 }));
    roof.position.set(b.x, b.h + b.h * 0.17, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    // Large yard
    const yardMat = new THREE.MeshLambertMaterial({ color: 0x6E6E60 });
    const yard = new THREE.Mesh(new THREE.BoxGeometry(b.w + 4, 0.03, 5), yardMat);
    yard.position.set(b.x, 0.015, b.z + b.d / 2 + 3);
    yard.receiveShadow = true;
    scene.add(yard);
    // Entrance columns
    const colMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (const cx of [-1.2, 1.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), colMat);
      col.position.set(b.x + cx, 1.5, b.z + b.d / 2 + 0.5);
      col.castShadow = true;
      scene.add(col);
    }
    // Porch overhang
    const porch = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.5), new THREE.MeshLambertMaterial({ color: 0x666666 }));
    porch.position.set(b.x, 3, b.z + b.d / 2 + 0.5);
    porch.castShadow = true;
    scene.add(porch);
    // White picket fence all around
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
    const fence = new THREE.Mesh(new THREE.BoxGeometry(b.w + 4, 0.7, 0.06), fenceMat);
    fence.position.set(b.x, 0.35, b.z + b.d / 2 + 5.5);
    scene.add(fence);
  }

  // ========== NORTHTOWN ==========
  if (btype === 'nt_residential') {
    // Clean, uniform houses. Pitched roof, tidy appearance
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.55, b.h * 0.25, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5C5C5C }));
    roof.position.set(b.x, b.h + b.h * 0.12, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    // Neat front step
    const stepMat = new THREE.MeshLambertMaterial({ color: 0x656565 });
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.5), stepMat);
    step.position.set(b.x, 0.075, b.z + b.d / 2 + 0.3);
    scene.add(step);
  }

  // ========== UPTOWN ==========
  if (btype === 'uptown_office') {
    // Sleek, clean lines — wider windows, modern setbacks
    const winMat = new THREE.MeshLambertMaterial({ color: 0x556666 });
    const floors = Math.floor(b.h / 1.3);
    const perFloor = Math.max(2, Math.floor(b.w / 1.0));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wMat = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.04), wMat);
        const wx = b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1);
        const wy = 1.0 + f * 1.3;
        if (wy > b.h - 0.3) continue;
        win.position.set(wx, wy, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wMat, x: b.x, z: b.z });
      }
    }
    // Flat roof with subtle ledge
    const ledgeMat = new THREE.MeshLambertMaterial({ color: 0x5E5E5E });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.15, b.d + 0.3), ledgeMat);
    ledge.position.set(b.x, b.h + 0.075, b.z);
    scene.add(ledge);
  }

  if (btype === 'uptown_shop') {
    // High-end shop: large glass storefront, clean awning
    const shopWinMat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
    const shopWin = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 2.0, 0.05), shopWinMat);
    shopWin.position.set(b.x, 1.2, b.z + b.d / 2 + 0.03);
    scene.add(shopWin);
    // Clean awning
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.9, 0.06, 1.0), awningMat);
    awning.position.set(b.x, 2.8, b.z + b.d / 2 + 0.4);
    awning.castShadow = true;
    scene.add(awning);
    // Flat roof ledge
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.15, b.d + 0.3), new THREE.MeshLambertMaterial({ color: 0x5E5E5E }));
    ledge.position.set(b.x, b.h + 0.075, b.z);
    scene.add(ledge);
  }

  if (btype === 'hotel') {
    // Tallest in Uptown, entrance canopy, extra windows
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), canopyMat);
    canopy.position.set(b.x, 3.0, b.z + b.d / 2 + 1);
    canopy.castShadow = true;
    scene.add(canopy);
    // Canopy supports
    for (const cx of [-1.5, 1.5]) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), canopyMat);
      support.position.set(b.x + cx, 1.5, b.z + b.d / 2 + 2);
      scene.add(support);
    }
  }

  // ========== TOWER ==========
  if (btype === 'tower_corp') {
    // Dense grid windows on multiple faces for tall corporate look
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
    const floors = Math.floor(b.h / 1.2);
    const perFloor = Math.max(3, Math.floor(b.w / 1.0));
    // Front face
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wMat = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), wMat);
        const wx = b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1);
        const wy = 1.0 + f * 1.2;
        if (wy > b.h - 0.3) continue;
        win.position.set(wx, wy, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wMat, x: b.x, z: b.z });
      }
    }
    // Back face windows
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wMat = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), wMat);
        const wx = b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1);
        const wy = 1.0 + f * 1.2;
        if (wy > b.h - 0.3) continue;
        win.position.set(wx, wy, b.z - b.d / 2 - 0.02);
        scene.add(win);
        windowMats.push({ material: wMat, x: b.x, z: b.z });
      }
    }
    // Side face windows
    const sideFloors = Math.min(floors, 8);
    for (let f = 0; f < sideFloors; f++) {
      for (const side of [-1, 1]) {
        const wMat = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.6), wMat);
        win.position.set(b.x + side * (b.w / 2 + 0.02), 1.0 + f * 1.2, b.z);
        scene.add(win);
        windowMats.push({ material: wMat, x: b.x, z: b.z });
      }
    }
    // Flat roof with AC units
    const acMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.5), acMat);
    ac.position.set(b.x + b.w * 0.2, b.h + 0.4, b.z - b.d * 0.2);
    scene.add(ac);
  }

  if (btype === 'tower_service') {
    // Small service building in an alley — blank walls, utility door
    const utilDoorMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
    const utilDoor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.04), utilDoorMat);
    utilDoor.position.set(b.x, 0.6, b.z + b.d / 2 + 0.02);
    scene.add(utilDoor);
  }

  // ========== INDUSTRIAL ==========
  if (btype === 'ind_warehouse') {
    // Wide, low, flat roof, fewer windows, loading dock platform
    // Loading dock
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.6, 0.5, 2), dockMat);
    dock.position.set(b.x, 0.25, b.z + b.d / 2 + 1);
    dock.receiveShadow = true;
    scene.add(dock);
    // Rolling door (wider, darker)
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.4, 2.5, 0.05), rollMat);
    rollDoor.position.set(b.x, 1.25, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
    // Minimal windows — just 1-2 high up
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 2; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.04), winMat.clone());
      win.position.set(b.x - b.w * 0.3 + i * b.w * 0.6, b.h - 0.5, b.z + b.d / 2 + 0.02);
      scene.add(win);
      windowMats.push({ material: win.material, x: b.x, z: b.z });
    }
  }

  if (btype === 'ind_factory') {
    // Factory with more industrial details, ventilation
    const ventMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    for (let i = 0; i < 3; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), ventMat);
      vent.position.set(b.x - 3 + i * 3, b.h + 0.3, b.z);
      scene.add(vent);
    }
    // Big rolling door
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 3, 0.05), rollMat);
    rollDoor.position.set(b.x, 1.5, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
  }

  if (btype === 'ind_workshop') {
    // Workshop: smaller rolling door, tool racks suggested by wall panels
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.35, 2.2, 0.05), rollMat);
    rollDoor.position.set(b.x - b.w * 0.2, 1.1, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
    // Side panel (darker)
    const panelMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, b.h * 0.6, b.d * 0.5), panelMat);
    panel.position.set(b.x + b.w / 2 + 0.02, b.h * 0.4, b.z);
    scene.add(panel);
  }

  // ========== PORT ==========
  if (btype === 'port_warehouse') {
    // Corrugated-style walls (horizontal lines), rolling door
    const lineMat = new THREE.MeshLambertMaterial({ color: 0x5E5E5E });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.04, 0.05), lineMat);
      line.position.set(b.x, 0.5 + i * 0.8, b.z + b.d / 2 + 0.03);
      scene.add(line);
    }
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.4, 2.5, 0.05), rollMat);
    rollDoor.position.set(b.x, 1.25, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
  }

  if (btype === 'port_office') {
    // Small office with windows
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 3; i++) {
      const wMat = winMat.clone();
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.04), wMat);
      win.position.set(b.x - 1.5 + i * 1.5, 2, b.z + b.d / 2 + 0.02);
      scene.add(win);
      windowMats.push({ material: wMat, x: b.x, z: b.z });
    }
  }

  if (btype === 'port_shed') {
    // Small storage shed, single door, no windows
    const shedDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.5, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x4A4A4A })
    );
    shedDoor.position.set(b.x, 0.75, b.z + b.d / 2 + 0.02);
    scene.add(shedDoor);
  }

  // ========== NAMED BUILDINGS — unique visual details ==========

  if (btype === 'mei_apartment') {
    // Cheerful residential: pitched roof, extra windows
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.55, b.h * 0.2, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x707070 }));
    roof.position.set(b.x, b.h + b.h * 0.1, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
  }

  if (btype === 'luna_townhouse') {
    // Calm townhouse: pitched roof with slight overhang
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.6, b.h * 0.22, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x686868 }));
    roof.position.set(b.x, b.h + b.h * 0.11, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
  }

  if (btype === 'kit_shop') {
    // Supply shop: wide storefront window + sign + awning
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A5050 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.75, 1.6, 0.05), winMat);
    win.position.set(b.x, 1.1, b.z + b.d / 2 + 0.03);
    scene.add(win);
    const signMat = new THREE.MeshLambertMaterial({ color: 0x607060 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.6, 0.45, 0.06), signMat);
    sign.position.set(b.x, 2.35, b.z + b.d / 2 + 0.03);
    scene.add(sign);
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x6A8A70 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 0.06, 1.0), awningMat);
    awning.position.set(b.x, 2.7, b.z + b.d / 2 + 0.4);
    awning.rotation.x = -0.12;
    awning.castShadow = true;
    scene.add(awning);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0x9FE1CB) });
  }

  if (btype === 'nao_cafe') {
    // Wider ground floor with distinctive awning + outdoor tables suggestion
    const winMat = new THREE.MeshLambertMaterial({ color: 0x554A35 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.85, 1.8, 0.05), winMat);
    win.position.set(b.x, 1.1, b.z + b.d / 2 + 0.03);
    scene.add(win);
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x8A7040 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.9, 0.06, 1.6), awningMat);
    awning.position.set(b.x, 3.0, b.z + b.d / 2 + 0.7);
    awning.rotation.x = -0.1;
    awning.castShadow = true;
    scene.add(awning);
    // Small café sign (rectangle)
    const signMat = new THREE.MeshLambertMaterial({ color: 0x7A6035 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.55, 0.5, 0.06), signMat);
    sign.position.set(b.x, 2.5, b.z + b.d / 2 + 0.03);
    scene.add(sign);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xFAC775) });
  }

  if (btype === 'marco_restaurant') {
    // Italian-style restaurant: arched entrance suggestion + awning
    const winMat = new THREE.MeshLambertMaterial({ color: 0x554040 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 1.6, 0.05), winMat);
    win.position.set(b.x, 1.1, b.z + b.d / 2 + 0.03);
    scene.add(win);
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x7A4030 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.85, 0.06, 1.4), awningMat);
    awning.position.set(b.x, 2.9, b.z + b.d / 2 + 0.6);
    awning.rotation.x = -0.1;
    awning.castShadow = true;
    scene.add(awning);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xF0997B) });
  }

  if (btype === 'harper_office') {
    // News office: grid-style windows, antenna suggestion
    const winMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
    const floors = Math.floor(b.h / 2);
    const perFloor = 3;
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wm = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.04), wm);
        win.position.set(b.x - b.w * 0.3 + w * (b.w * 0.3), 1.2 + f * 2.0, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wm, x: b.x, z: b.z });
      }
    }
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0x85B7EB) });
  }

  if (btype === 'tomas_cottage') {
    // Cozy cottage: pitched roof, garden fence
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.58, b.h * 0.3, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5A5A5A }));
    roof.position.set(b.x, b.h + b.h * 0.15, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    // Garden path
    const pathMat = new THREE.MeshLambertMaterial({ color: 0x6E6858 });
    const path = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 2.0), pathMat);
    path.position.set(b.x, 0.01, b.z + b.d / 2 + 1.5);
    scene.add(path);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xF5C4B3) });
  }

  if (btype === 'the_school') {
    // Institutional building: flat roof, columns at entrance, steps
    const colMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (const cx of [-2.5, -0.8, 0.8, 2.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 7), colMat);
      col.position.set(b.x + cx, 2.0, b.z + b.d / 2 + 0.5);
      col.castShadow = true;
      scene.add(col);
    }
    // Roof ledge
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.3, b.d + 0.4), new THREE.MeshLambertMaterial({ color: 0x6A6A6A }));
    ledge.position.set(b.x, b.h + 0.15, b.z);
    scene.add(ledge);
    // Steps
    const stepsMat = new THREE.MeshLambertMaterial({ color: 0x7A7A7A });
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.5), stepsMat);
      step.position.set(b.x, s * 0.15, b.z + b.d / 2 + 1.5 - s * 0.5);
      scene.add(step);
    }
    // Flagpole
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x909090 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 5), poleMat);
    pole.position.set(b.x + b.w * 0.4, b.h + 2, b.z);
    scene.add(pole);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0x85B7EB) });
  }

  if (btype === 'taro_factory' || btype === 'workshop_property') {
    // Factory/workshop: vents on roof, rolling door
    const ventMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    for (let i = 0; i < 3; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), ventMat);
      vent.position.set(b.x - 3 + i * 3, b.h + 0.35, b.z);
      scene.add(vent);
    }
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 3, 0.05), rollMat);
    rollDoor.position.set(b.x, 1.5, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
    if (btype === 'workshop_property') {
      // "FOR SALE" suggestion — lighter panel on the wall
      const panelMat = new THREE.MeshLambertMaterial({ color: 0x909080 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 0.06), panelMat);
      panel.position.set(b.x + b.w * 0.25, 2.5, b.z + b.d / 2 + 0.04);
      scene.add(panel);
    }
  }

  if (btype === 'vex_squat') {
    // Squat: corrugated walls, dark look, improvised entrance
    const lineMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.04, 0.05), lineMat);
      line.position.set(b.x, 0.5 + i * 0.7, b.z + b.d / 2 + 0.03);
      scene.add(line);
    }
    // Makeshift door (offset)
    const doorMat2 = new THREE.MeshLambertMaterial({ color: 0x404040 });
    const door2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.04), doorMat2);
    door2.position.set(b.x - b.w * 0.2, 0.85, b.z + b.d / 2 + 0.02);
    scene.add(door2);
  }

  if (btype === 'yuna_shop') {
    // Flower shop: wide display window, warm wooden sign
    const winMat = new THREE.MeshLambertMaterial({ color: 0x504A30 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 1.6, 0.05), winMat);
    win.position.set(b.x, 1.1, b.z + b.d / 2 + 0.03);
    scene.add(win);
    const signMat = new THREE.MeshLambertMaterial({ color: 0x7A6A30 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.55, 0.45, 0.06), signMat);
    sign.position.set(b.x, 2.4, b.z + b.d / 2 + 0.03);
    scene.add(sign);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xFAC775) });
  }

  if (btype === 'kai_shack') {
    // Small dock shack: low pitched roof, rope coil suggestion
    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.55, b.h * 0.28, 4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x505050 }));
    roof.position.set(b.x, b.h + b.h * 0.14, b.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    // Single weathered window
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A4A40 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.04), winMat);
    win.position.set(b.x - 0.5, 1.6, b.z + b.d / 2 + 0.02);
    scene.add(win);
    // Rope coil on ground (torus)
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0x8A7060 });
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 5, 10), ropeMat);
    coil.rotation.x = -Math.PI / 2;
    coil.position.set(b.x + b.w * 0.25, 0.06, b.z + b.d / 2 + 0.7);
    scene.add(coil);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x4A4A40 }), x: b.x, z: b.z, targetColor: new THREE.Color(0x85B7EB) });
  }

  if (btype === 'sora_building') {
    // Upscale residential: sleek lines, setback upper floor, wide windows
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555A45 });
    const floors = Math.floor(b.h / 1.4);
    const perFloor = Math.max(2, Math.floor(b.w / 1.2));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wm = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.04), wm);
        win.position.set(b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1), 1.0 + f * 1.4, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wm, x: b.x, z: b.z });
      }
    }
    // Setback top floor
    const setbackH = b.h * 0.18;
    const setback = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, setbackH, b.d * 0.7), new THREE.MeshLambertMaterial({ color: 0x606060 }));
    setback.position.set(b.x, b.h + setbackH / 2, b.z);
    setback.castShadow = true;
    scene.add(setback);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xFAC775) });
  }

  if (btype === 'kenji_office') {
    // Finance office: grid windows, clean flat roof with ledge
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A5060 });
    const floors = Math.floor(b.h / 1.5);
    const perFloor = Math.max(2, Math.floor(b.w / 1.1));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wm = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.04), wm);
        win.position.set(b.x - b.w / 2 + 0.45 + w * (b.w - 0.9) / Math.max(1, perFloor - 1), 1.0 + f * 1.5, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wm, x: b.x, z: b.z });
      }
    }
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.2, b.d + 0.4), new THREE.MeshLambertMaterial({ color: 0x5E5E68 }));
    ledge.position.set(b.x, b.h + 0.1, b.z);
    scene.add(ledge);
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0xAFA9EC) });
  }

  if (btype === 'dante_tower') {
    // Tower A — Dante's lobby: lobby glass entrance at ground, dense window grid
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
    const floors = Math.floor(b.h / 1.2);
    const perFloor = Math.max(3, Math.floor(b.w / 1.0));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wm = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), wm);
        win.position.set(b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1), 1.0 + f * 1.2, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wm, x: b.x, z: b.z });
      }
    }
    // Lobby glass entrance (ground floor, wider)
    const lobbyMat = new THREE.MeshLambertMaterial({ color: 0x555560 });
    const lobby = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 2.5, 0.06), lobbyMat);
    lobby.position.set(b.x, 1.25, b.z + b.d / 2 + 0.03);
    scene.add(lobby);
    // Canopy
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 0.1, 1.5), canopyMat);
    canopy.position.set(b.x, 2.8, b.z + b.d / 2 + 0.7);
    canopy.castShadow = true;
    scene.add(canopy);
    // AC units on roof
    const acMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.5), acMat);
    ac.position.set(b.x + b.w * 0.2, b.h + 0.4, b.z - b.d * 0.2);
    scene.add(ac);
  }

  if (btype === 'quinn_apt') {
    // Quinn's tower: same as tower_corp but with a distinctive top floor
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
    const floors = Math.floor(b.h / 1.2);
    const perFloor = Math.max(3, Math.floor(b.w / 1.0));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < perFloor; w++) {
        const wm = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), wm);
        win.position.set(b.x - b.w / 2 + 0.5 + w * (b.w - 1) / Math.max(1, perFloor - 1), 1.0 + f * 1.2, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wm, x: b.x, z: b.z });
      }
    }
    // Distinctive top: slightly narrowed setback
    const topH = 3.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, topH, b.d * 0.8), new THREE.MeshLambertMaterial({ color: 0x555560 }));
    top.position.set(b.x, b.h + topH / 2, b.z);
    top.castShadow = true;
    scene.add(top);
    const acMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.5), acMat);
    ac.position.set(b.x + b.w * 0.2, b.h + 0.4, b.z - b.d * 0.2);
    scene.add(ac);
  }

  if (btype === 'gus_office') {
    // Dock office: corrugated walls, small windows, functional
    const lineMat = new THREE.MeshLambertMaterial({ color: 0x5E5E5E });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.04, 0.05), lineMat);
      line.position.set(b.x, 0.5 + i * 0.8, b.z + b.d / 2 + 0.03);
      scene.add(line);
    }
    const winMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 3; i++) {
      const wm = winMat.clone();
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.04), wm);
      win.position.set(b.x - 1.5 + i * 1.5, 2.0, b.z + b.d / 2 + 0.02);
      scene.add(win);
      windowMats.push({ material: wm, x: b.x, z: b.z });
    }
    doorMats.push({ material: new THREE.MeshLambertMaterial({ color: 0x5A5A5A }), x: b.x, z: b.z, targetColor: new THREE.Color(0x85B7EB) });
  }

  if (btype === 'shipping_yard') {
    // Shipping yard warehouse: corrugated + big rolling door
    const lineMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.04, 0.05), lineMat);
      line.position.set(b.x, 0.4 + i * 0.7, b.z + b.d / 2 + 0.03);
      scene.add(line);
    }
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.45, 2.8, 0.05), rollMat);
    rollDoor.position.set(b.x, 1.4, b.z + b.d / 2 + 0.02);
    scene.add(rollDoor);
  }

  // ========== ACE HQ ==========
  if (btype === 'ace_hq') {
    // Institutional, flat, dark red trim at edges
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x663333 });
    // Top trim
    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.3, b.d + 0.2), trimMat);
    topTrim.position.set(b.x, b.h + 0.15, b.z);
    scene.add(topTrim);
    // Bottom trim
    const botTrim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.3, b.d + 0.2), trimMat);
    botTrim.position.set(b.x, 0.15, b.z);
    scene.add(botTrim);
    // Heavy entrance door
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const bigDoor = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.06), doorMat);
    bigDoor.position.set(b.x, 1.5, b.z + b.d / 2 + 0.03);
    scene.add(bigDoor);
    // Grid windows (small, narrow, institutional)
    const winMat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
    const floors = Math.floor(b.h / 1.5);
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < 5; w++) {
        const wMat = winMat.clone();
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.04), wMat);
        win.position.set(b.x - b.w * 0.35 + w * (b.w * 0.7 / 4), 1.0 + f * 1.5, b.z + b.d / 2 + 0.02);
        scene.add(win);
        windowMats.push({ material: wMat, x: b.x, z: b.z });
      }
    }
  }

  if (btype === 'ace_barracks') {
    // Identical small buildings, minimal detail, dark red accent
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x663333 });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.15, b.d + 0.1), trimMat);
    trim.position.set(b.x, b.h + 0.075, b.z);
    scene.add(trim);
    // Small institutional door
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.04), doorMat);
    door.position.set(b.x, 0.65, b.z + b.d / 2 + 0.02);
    scene.add(door);
  }

  if (btype === 'ace_garage') {
    // Wide rolling doors
    const rollMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
    for (let i = 0; i < 2; i++) {
      const rollDoor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 0.05), rollMat);
      rollDoor.position.set(b.x - 1.5 + i * 3, 1.25, b.z + b.d / 2 + 0.02);
      scene.add(rollDoor);
    }
    // Dark red trim
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x663333 });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.15, b.d + 0.1), trimMat);
    trim.position.set(b.x, b.h + 0.075, b.z);
    scene.add(trim);
  }
}

// ========== LANDMARKS ==========
function createLandmarks(scene) {
  // TOWN: Town square with fountain, benches, trees, ground
  createTownSquare(scene, 0, 20);

  // DOWNTOWN: Clock Tower
  createClockTower(scene, 8, 108);

  // DOWNTOWN: Market building (covered, open sides)
  createMarketBuilding(scene, -5, 132);

  // ========== NORTHTOWN ==========
  createChapel(scene, 130, 135);
  createPark(scene, 120, 165);
  // Benches along streets
  createBench(scene, 112, 145, 0);
  createBench(scene, 138, 145, 0);
  // Street lamps (moderate density)
  createStreetLamp(scene, 100, 140);
  createStreetLamp(scene, 115, 155);
  createStreetLamp(scene, 135, 140);
  createStreetLamp(scene, 150, 155);
  createStreetLamp(scene, 115, 175);
  createStreetLamp(scene, 140, 175);
  // 1 propaganda poster
  createPropagandaPoster(scene, 108, 155);
  // 1 parked car
  createParkedCar(scene, 145, 145, 0);

  // ========== BURBS ==========
  createPlayground(scene, 125, 5);
  // Parked cars — 2 per block (car-oriented)
  createParkedCar(scene, 130, -38, 0);
  createParkedCar(scene, 148, -38, Math.PI);
  createParkedCar(scene, 130, -15, 0);
  createParkedCar(scene, 165, -15, Math.PI);
  createParkedCar(scene, 150, 5, 0);
  createParkedCar(scene, 170, 5, Math.PI);
  createParkedCar(scene, 140, 25, 0);
  createParkedCar(scene, 185, -35, Math.PI);
  // Street lamps (fewer, wider spacing)
  createStreetLamp(scene, 125, -30);
  createStreetLamp(scene, 155, -30);
  createStreetLamp(scene, 185, -30);
  createStreetLamp(scene, 125, -5);
  createStreetLamp(scene, 155, -5);
  createStreetLamp(scene, 125, 15);
  // 2 propaganda posters
  createPropagandaPoster(scene, 140, -15);
  createPropagandaPoster(scene, 160, 5);

  // ========== UPTOWN ==========
  createHotelSign(scene, 182, 58);
  createRooftopGarden(scene, 172, 75, 15.0);
  // Street lamps (clean, well-spaced)
  createStreetLamp(scene, 160, 65);
  createStreetLamp(scene, 178, 65);
  createStreetLamp(scene, 195, 65);
  createStreetLamp(scene, 160, 85);
  createStreetLamp(scene, 180, 85);
  createStreetLamp(scene, 160, 100);
  createStreetLamp(scene, 190, 100);
  // NO propaganda posters (Uptown is "above" that)
  // 1 parked car (nicer area)
  createParkedCar(scene, 190, 60, Math.PI / 2);

  // ========== TOWER ==========
  createSkyBridge(scene, -160, 100, -145, 100, 22);
  // Dark alleys
  createAlleyDumpster(scene, -135, 110);
  createAlleyDumpster(scene, -155, 132);
  // Street lamps (dim, fewer — canyon effect)
  createStreetLamp(scene, -155, 108);
  createStreetLamp(scene, -135, 108);
  createStreetLamp(scene, -150, 130);
  createStreetLamp(scene, -130, 130);
  // Many propaganda posters (most suppressed)
  createPropagandaPoster(scene, -160, 100);
  createPropagandaPoster(scene, -145, 100);
  createPropagandaPoster(scene, -148, 122);
  createPropagandaPoster(scene, -128, 118);
  createPropagandaPoster(scene, -140, 140);

  // ========== INDUSTRIAL ==========
  // Note: factory template buildings already include smokestacks via templateFactory
  createLoadingDock(scene, 35, -88);
  // Chain-link fences around some properties
  createChainLinkFence(scene, -20, -85, 12, 'x');
  createChainLinkFence(scene, 55, -85, 12, 'x');
  createChainLinkFence(scene, -22, -110, 12, 'x');
  // Parking lot flat areas
  createParkingLot(scene, 15, -98, 12, 8);
  createParkingLot(scene, -15, -120, 10, 6);
  // Street lamps (industrial, functional)
  createStreetLamp(scene, -10, -90);
  createStreetLamp(scene, 25, -90);
  createStreetLamp(scene, 50, -90);
  createStreetLamp(scene, -10, -115);
  createStreetLamp(scene, 25, -115);
  createStreetLamp(scene, 50, -115);
  createStreetLamp(scene, 0, -130);
  createStreetLamp(scene, 30, -130);
  // Propaganda posters (many)
  createPropagandaPoster(scene, -5, -88);
  createPropagandaPoster(scene, 35, -88);
  createPropagandaPoster(scene, 15, -108);
  createPropagandaPoster(scene, -5, -112);

  // ========== PORT ==========
  createLighthouse(scene, -95, 225);
  createShippingContainers(scene, -70, 208);
  createCrane(scene, -85, 218);
  // Docks (wooden platforms extending over water)
  createDock(scene, -90, 230, 15, 5);
  createDock(scene, -65, 228, 12, 4);
  createDock(scene, -50, 230, 10, 4);
  // Moored boats
  createBoat(scene, -92, 237);
  createBoat(scene, -60, 235);
  createBoat(scene, -48, 236);
  // Street lamps
  createStreetLamp(scene, -95, 200);
  createStreetLamp(scene, -70, 200);
  createStreetLamp(scene, -55, 200);
  createStreetLamp(scene, -80, 215);
  // Propaganda posters (moderate)
  createPropagandaPoster(scene, -100, 195);
  createPropagandaPoster(scene, -75, 195);

  // ========== ACE HQ ==========
  createACESign(scene, -150, -55, 12);
  createWatchtower(scene, -130, -80);
  // High fence surrounding compound
  createACEFence(scene);
  // Gate entrance with barriers
  createACEGate(scene, -140, -42);
  // ACE vehicles parked inside (dark red boxes)
  createACEVehicle(scene, -158, -65);
  createACEVehicle(scene, -162, -65);
  createACEVehicle(scene, -158, -72);
  // Spotlight on watchtower already handled by watchtower
  // Street lamps (sterile, bright)
  createStreetLamp(scene, -145, -50);
  createStreetLamp(scene, -145, -65);
  createStreetLamp(scene, -130, -55);
  createStreetLamp(scene, -160, -55);
  // 1 propaganda poster (inside compound)
  createPropagandaPoster(scene, -150, -55);
}

function createTownSquare(scene, x, z) {
  // Slightly different colored ground for the town square (15x15 area)
  const squareMat = new THREE.MeshLambertMaterial({ color: 0x6E6E6E });
  const squareGround = new THREE.Mesh(new THREE.BoxGeometry(16, 0.04, 16), squareMat);
  squareGround.position.set(x, 0.02, z);
  squareGround.receiveShadow = true;
  scene.add(squareGround);

  // Fountain in center
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x707070 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 16), stoneMat);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const innerMat = new THREE.MeshLambertMaterial({ color: 0x505560 });
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.1, 16), innerMat);
  inner.position.y = 0.5;
  group.add(inner);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 8), stoneMat);
  column.position.y = 1.3;
  column.castShadow = true;
  group.add(column);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 0.35, 12), stoneMat);
  bowl.position.y = 2.3;
  bowl.castShadow = true;
  group.add(bowl);

  scene.add(group);
  _fountainData = { x, z, group, material: stoneMat };

  // 4 benches around the fountain (square arrangement)
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const benchPositions = [
    { bx: x - 5, bz: z, rot: Math.PI / 2 },
    { bx: x + 5, bz: z, rot: -Math.PI / 2 },
    { bx: x, bz: z - 5, rot: 0 },
    { bx: x, bz: z + 5, rot: Math.PI },
  ];
  for (const bp of benchPositions) {
    const bg = new THREE.Group();
    bg.position.set(bp.bx, 0, bp.bz);
    bg.rotation.y = bp.rot;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), benchMat);
    seat.position.y = 0.45; seat.castShadow = true; bg.add(seat);
    for (const lx of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), benchMat);
      leg.position.set(lx, 0.225, 0); bg.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.06), benchMat);
    back.position.set(0, 0.7, -0.22); back.castShadow = true; bg.add(back);
    scene.add(bg);
  }

  // 2 trees flanking the square
  createTree(scene, x - 7, z - 5);
  createTree(scene, x + 7, z + 5);
}

let _fountainData = null;
export function getFountainData() { return _fountainData; }

function createClockTower(scene, x, z) {
  // Extra tall narrow building with clock face
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x686868 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3), towerMat);
  tower.position.set(x, 5, z);
  tower.castShadow = true;
  scene.add(tower);

  // Clock face (white circle)
  const clockMat = new THREE.MeshBasicMaterial({ color: 0xDDDDDD });
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 16), clockMat);
  clock.position.set(x, 9, z + 1.55);
  clock.rotation.x = Math.PI / 2;
  scene.add(clock);

  // Clock hands (stopped)
  const handMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.05), handMat);
  hourHand.position.set(x, 9.1, z + 1.6);
  hourHand.rotation.z = 0.3;
  scene.add(hourHand);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.05), handMat);
  minuteHand.position.set(x, 9.2, z + 1.6);
  minuteHand.rotation.z = -0.8;
  scene.add(minuteHand);

  // Pointed top
  const topGeo = new THREE.ConeGeometry(2, 2, 4);
  const top = new THREE.Mesh(topGeo, towerMat);
  top.position.set(x, 11, z);
  top.rotation.y = Math.PI / 4;
  top.castShadow = true;
  scene.add(top);
}

function createMarketBuilding(scene, x, z) {
  // Covered market — roof supported by pillars, open sides
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 9), roofMat);
  roof.position.set(x, 4.5, z);
  roof.castShadow = true;
  roof.receiveShadow = true;
  scene.add(roof);

  // 8 pillars supporting the roof
  const pillarPositions = [
    { px: -5, pz: -3.5 }, { px: -5, pz: 0 }, { px: -5, pz: 3.5 },
    { px: 5, pz: -3.5 }, { px: 5, pz: 0 }, { px: 5, pz: 3.5 },
    { px: 0, pz: -3.5 }, { px: 0, pz: 3.5 },
  ];
  for (const pp of pillarPositions) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.5, 6), pillarMat);
    pillar.position.set(x + pp.px, 2.25, z + pp.pz);
    pillar.castShadow = true;
    scene.add(pillar);
  }

  // Awnings along the edges (gray variants)
  const awningColors = [0x5A5A5A, 0x585858, 0x5C5C5C];
  for (let i = 0; i < 3; i++) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.08, 1.5),
      new THREE.MeshLambertMaterial({ color: awningColors[i] })
    );
    awning.position.set(x - 4 + i * 4, 2.5, z + 5);
    awning.rotation.x = -0.1;
    awning.castShadow = true;
    scene.add(awning);
  }

  // Market ground (slightly different shade)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x686868 });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(12, 0.03, 9), groundMat);
  ground.position.set(x, 0.015, z);
  ground.receiveShadow = true;
  scene.add(ground);
}

function createChapel(scene, x, z) {
  // Pointed roof higher than normal
  const roofGeo = new THREE.ConeGeometry(4, 4, 4);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5A5A5A }));
  roof.position.set(x, 5.5, z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);
}

function createPark(scene, x, z) {
  // Flat green-gray area with trees
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x707060 });
  const parkGround = new THREE.Mesh(new THREE.BoxGeometry(15, 0.03, 12), parkMat);
  parkGround.position.set(x, 0.015, z);
  parkGround.receiveShadow = true;
  scene.add(parkGround);

  // Trees
  const treePositions = [
    { tx: x - 5, tz: z - 4 },
    { tx: x + 3, tz: z + 2 },
    { tx: x - 2, tz: z + 5 },
    { tx: x + 6, tz: z - 3 },
  ];
  for (const tp of treePositions) {
    createTree(scene, tp.tx, tp.tz);
  }
}

function createTree(scene, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.0, 6), trunkMat);
  trunk.position.y = 1.0;
  trunk.castShadow = true;
  group.add(trunk);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x686868 });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), canopyMat);
  canopy.position.y = 2.8;
  canopy.castShadow = true;
  group.add(canopy);
  scene.add(group);
}

function createPlayground(scene, x, z) {
  const matGray = new THREE.MeshLambertMaterial({ color: 0x606060 });

  // Swing frame (A-frame)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.1), matGray);
  frame.position.set(x, 1.5, z);
  frame.castShadow = true;
  scene.add(frame);
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.1), matGray);
  crossbar.position.set(x, 3, z);
  scene.add(crossbar);

  // Slide shape (angled box)
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 3), matGray);
  slide.position.set(x + 4, 1, z);
  slide.rotation.x = 0.4;
  slide.castShadow = true;
  scene.add(slide);

  // Colored ground pad
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.03, 6),
    new THREE.MeshLambertMaterial({ color: 0x707060 })
  );
  pad.position.set(x + 2, 0.015, z);
  pad.receiveShadow = true;
  scene.add(pad);
}

function createHotelSign(scene, x, z) {
  // Sign on top of the hotel building (hotel h=16)
  const signMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.1), signMat);
  sign.position.set(x, 16.5, z + 4.1);
  scene.add(sign);
}

function createRooftopGarden(scene, x, z, buildingH) {
  // Green patches on top of building
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x607060 });
  for (let i = 0; i < 4; i++) {
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(1.5 + Math.random(), 0.15, 1.5 + Math.random()),
      greenMat
    );
    patch.position.set(x + (Math.random() - 0.5) * 4, buildingH + 0.1, z + (Math.random() - 0.5) * 4);
    scene.add(patch);
  }
}

function createSkyBridge(scene, x1, z1, x2, z2, height) {
  const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(length, 2, 4), bridgeMat);
  bridge.position.set((x1 + x2) / 2, height, (z1 + z2) / 2);
  bridge.rotation.y = Math.atan2(dx, dz);
  bridge.castShadow = true;
  scene.add(bridge);
}

function createSmokestack(scene, x, z, buildingH) {
  const stackMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 8), stackMat);
  stack.position.set(x + 2, buildingH + 2.5, z - 1);
  stack.castShadow = true;
  scene.add(stack);
}

function createLoadingDock(scene, x, z) {
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 3), dockMat);
  platform.position.set(x, 0.25, z + 5);
  platform.receiveShadow = true;
  scene.add(platform);
}

function createLighthouse(scene, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x707070 });
  // Tall cylinder
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 10, 12), mat);
  tower.position.set(x, 5, z);
  tower.castShadow = true;
  scene.add(tower);
  // Wider top
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.2, 1.5, 12), mat);
  top.position.set(x, 10.5, z);
  scene.add(top);
  // Light housing
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 12), glassMat);
  glass.position.set(x, 11.5, z);
  scene.add(glass);
}

function createShippingContainers(scene, x, z) {
  const colors = [0x555555, 0x585858, 0x525252, 0x5A5A5A, 0x505050];
  // Stack of containers
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      for (let level = 0; level < (col < 2 ? 3 : 2); level++) {
        const container = new THREE.Mesh(
          new THREE.BoxGeometry(3, 2.5, 6),
          new THREE.MeshLambertMaterial({ color: colors[(row + col + level) % colors.length] })
        );
        container.position.set(x + col * 3.5, 1.25 + level * 2.5, z + row * 7);
        container.castShadow = true;
        container.receiveShadow = true;
        scene.add(container);
      }
    }
  }
}

function createCrane(scene, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  // Vertical mast
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 20, 0.8), mat);
  mast.position.set(x, 10, z);
  mast.castShadow = true;
  scene.add(mast);
  // Horizontal boom
  const boom = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 0.5), mat);
  boom.position.set(x + 5, 19, z);
  boom.castShadow = true;
  scene.add(boom);
  // Counter-weight
  const cw = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1), mat);
  cw.position.set(x - 3, 18, z);
  scene.add(cw);
}

function createACESign(scene, x, z, buildingH) {
  // Large ACE sign on main building
  const signMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.15), signMat);
  sign.position.set(x, buildingH * 0.8, z + 5.1);
  scene.add(sign);

  // Red ACE text backing
  const textMat = new THREE.MeshBasicMaterial({ color: 0xAA3333 });
  const text = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 0.16), textMat);
  text.position.set(x, buildingH * 0.8, z + 5.12);
  scene.add(text);
}

// ========== DISTRICT DETAIL HELPERS ==========

function createStreetLamp(scene, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), mat);
  pole.position.set(x, 2, z);
  pole.castShadow = true;
  scene.add(pole);
  // Lamp head
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x999988 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), lampMat);
  lamp.position.set(x, 4.1, z);
  scene.add(lamp);
}

function createBench(scene, x, z, rot) {
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const bg = new THREE.Group();
  bg.position.set(x, 0, z);
  bg.rotation.y = rot;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), benchMat);
  seat.position.y = 0.45; seat.castShadow = true; bg.add(seat);
  for (const lx of [-0.45, 0.45]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), benchMat);
    leg.position.set(lx, 0.225, 0); bg.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.06), benchMat);
  back.position.set(0, 0.7, -0.22); back.castShadow = true; bg.add(back);
  scene.add(bg);
}

function createParkedCar(scene, x, z, rot) {
  const carMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rot || 0;
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.5), carMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), new THREE.MeshLambertMaterial({ color: 0x505050 }));
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  // Wheels
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const wx of [-0.8, 0.8]) {
    for (const wz of [-1.0, 1.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8), wheelMat);
      wheel.position.set(wx, 0.25, wz);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    }
  }
  scene.add(group);
}

function createPropagandaPoster(scene, x, z) {
  // Flat poster on nearest building wall
  const posterMat = new THREE.MeshLambertMaterial({ color: 0x883333 });
  const poster = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.03), posterMat);
  poster.position.set(x, 1.8, z + 0.5);
  scene.add(poster);
  // ACE text strip
  const textMat = new THREE.MeshBasicMaterial({ color: 0xAA4444 });
  const text = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.04), textMat);
  text.position.set(x, 2.2, z + 0.52);
  scene.add(text);
}

function createAlleyDumpster(scene, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x404040 });
  const dumpster = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), mat);
  dumpster.position.set(x, 0.5, z);
  dumpster.castShadow = true;
  scene.add(dumpster);
  // Lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.1), mat);
  lid.position.set(x, 1.03, z);
  scene.add(lid);
}

function createChainLinkFence(scene, x, z, length, axis) {
  // Thin semi-transparent fence
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
  const w = axis === 'x' ? length : 0.08;
  const d = axis === 'z' ? length : 0.08;
  const fence = new THREE.Mesh(new THREE.BoxGeometry(w, 2.0, d), fenceMat);
  fence.position.set(x, 1, z + (axis === 'x' ? -4 : 0));
  scene.add(fence);
  // Fence posts
  const postMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const posts = Math.floor(length / 3);
  for (let i = 0; i <= posts; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4), postMat);
    if (axis === 'x') {
      post.position.set(x - length / 2 + i * (length / posts), 1.1, z - 4);
    } else {
      post.position.set(x, 1.1, z - length / 2 + i * (length / posts));
    }
    scene.add(post);
  }
}

function createParkingLot(scene, x, z, w, d) {
  // Flat asphalt area with line markings
  const lotMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const lot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), lotMat);
  lot.position.set(x, 0.015, z);
  lot.receiveShadow = true;
  scene.add(lot);
  // Parking lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
  const spots = Math.floor(w / 2.5);
  for (let i = 0; i <= spots; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, d * 0.6), lineMat);
    line.position.set(x - w / 2 + i * (w / spots), 0.035, z);
    scene.add(line);
  }
}

function createDock(scene, x, z, w, d) {
  // Wooden platform extending over water
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x5A5040 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), dockMat);
  platform.position.set(x, 0.4, z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  scene.add(platform);
  // Support posts
  const postMat = new THREE.MeshLambertMaterial({ color: 0x504030 });
  for (let px = -w / 2 + 1; px <= w / 2 - 1; px += 3) {
    for (const pz of [-d / 2 + 0.5, d / 2 - 0.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 6), postMat);
      post.position.set(x + px, -0.3, z + pz);
      scene.add(post);
    }
  }
  // Mooring bollards
  const bollardMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  for (const bx of [x - w / 3, x + w / 3]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8), bollardMat);
    bollard.position.set(bx, 0.8, z + d / 2 - 0.3);
    scene.add(bollard);
  }
}

function createBoat(scene, x, z) {
  // Simple low box shape on water
  const boatMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 4), boatMat);
  hull.position.set(x, 0.1, z);
  hull.castShadow = true;
  scene.add(hull);
  // Cabin
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.5), cabinMat);
  cabin.position.set(x, 0.8, z - 0.5);
  cabin.castShadow = true;
  scene.add(cabin);
}

function createACEFence(scene) {
  // High fence (2-unit tall) surrounding the ACE compound
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  // Compound bounds: roughly x: -105 to -115, z: -51 to -40
  // North fence
  const north = new THREE.Mesh(new THREE.BoxGeometry(65, 2.5, 0.15), fenceMat);
  north.position.set(-145, 1.25, -40);
  scene.add(north);
  // South fence
  const south = new THREE.Mesh(new THREE.BoxGeometry(65, 2.5, 0.15), fenceMat);
  south.position.set(-145, 1.25, -87);
  scene.add(south);
  // West fence
  const west = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 47), fenceMat);
  west.position.set(-177, 1.25, -63.5);
  scene.add(west);
  // East fence (with gap for gate)
  const eastN = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 15), fenceMat);
  eastN.position.set(-113, 1.25, -47.5);
  scene.add(eastN);
  const eastS = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 20), fenceMat);
  eastS.position.set(-113, 1.25, -75);
  scene.add(eastS);
  // Barbed wire topper (thin line on top)
  const barbMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const barbN = new THREE.Mesh(new THREE.BoxGeometry(65, 0.1, 0.2), barbMat);
  barbN.position.set(-145, 2.55, -40);
  scene.add(barbN);
  const barbS = new THREE.Mesh(new THREE.BoxGeometry(65, 0.1, 0.2), barbMat);
  barbS.position.set(-145, 2.55, -87);
  scene.add(barbS);
}

function createACEGate(scene, x, z) {
  // Double barriers at the gate entrance
  const barrierMat = new THREE.MeshLambertMaterial({ color: 0x663333 });
  // Left barrier arm
  const armL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.1), barrierMat);
  armL.position.set(x - 2, 1.0, z);
  scene.add(armL);
  // Right barrier arm
  const armR = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.1), barrierMat);
  armR.position.set(x + 2, 1.0, z);
  scene.add(armR);
  // Gate posts
  const postMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  for (const gx of [x - 0.5, x + 0.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), postMat);
    post.position.set(gx, 0.75, z);
    post.castShadow = true;
    scene.add(post);
  }
  // Guard booth
  const boothMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), boothMat);
  booth.position.set(x + 4, 1, z);
  booth.castShadow = true;
  scene.add(booth);
}

function createACEVehicle(scene, x, z) {
  // Dark red box shapes (ACE patrol vehicles)
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x663333 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 3.5), bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), new THREE.MeshLambertMaterial({ color: 0x553030 }));
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  // Wheels
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const wx of [-0.8, 0.8]) {
    for (const wz of [-1.0, 1.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8), wheelMat);
      wheel.position.set(wx, 0.25, wz);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    }
  }
  scene.add(group);
}

function createWatchtower(scene, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  // Legs (4 thin posts)
  for (const ox of [-1, 1]) {
    for (const oz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8, 0.2), mat);
      leg.position.set(x + ox, 4, z + oz);
      leg.castShadow = true;
      scene.add(leg);
    }
  }
  // Platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), mat);
  platform.position.set(x, 7.5, z);
  platform.castShadow = true;
  scene.add(platform);
  // Railing
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.1), mat);
    rail.position.set(x, 8, z + side * 1.5);
    scene.add(rail);
  }
}

// ========== PLACEMENT VALIDATION SYSTEM ==========

// Landmark positions that buildings must not overlap with
const LANDMARK_ZONES = [
  { x: 0, z: 12, w: 16, d: 16 },      // Town square / fountain
  { x: 75, z: 3, w: 10, d: 8 },       // Playground
  { x: -57, z: 135, w: 6, d: 6 },      // Lighthouse
];

// Check if a building's CENTER is inside a road rectangle (not just edge overlap).
// Buildings alongside roads with minor edge overlap are fine — only catch buildings
// that are actually sitting on top of a road.
function overlapsRoadBuffer(bx, bz, bw, bd, roads) {
  for (const road of roads) {
    const isHoriz = road.w > road.d;
    const roadHalfW = road.roadWidth / 2;

    // Check if building center is within the road's narrow dimension
    // AND within the road's long dimension (length)
    if (isHoriz) {
      const roadMinX = road.x - road.w / 2;
      const roadMaxX = road.x + road.w / 2;
      // Building center must be within road length AND within road width
      if (bx >= roadMinX && bx <= roadMaxX && Math.abs(bz - road.z) < roadHalfW) {
        return {
          road, isHoriz,
          rMinX: roadMinX, rMaxX: roadMaxX,
          rMinZ: road.z - roadHalfW, rMaxZ: road.z + roadHalfW
        };
      }
    } else {
      const roadMinZ = road.z - road.d / 2;
      const roadMaxZ = road.z + road.d / 2;
      if (bz >= roadMinZ && bz <= roadMaxZ && Math.abs(bx - road.x) < roadHalfW) {
        return {
          road, isHoriz,
          rMinX: road.x - roadHalfW, rMaxX: road.x + roadHalfW,
          rMinZ: roadMinZ, rMaxZ: roadMaxZ
        };
      }
    }
  }
  return null;
}

// Stricter check: does the building footprint significantly overlap the road?
// Used in the final validation pass. Returns true if >25% of building footprint overlaps road.
function significantlyOverlapsRoad(bx, bz, bw, bd, roads) {
  const bMinX = bx - bw / 2;
  const bMaxX = bx + bw / 2;
  const bMinZ = bz - bd / 2;
  const bMaxZ = bz + bd / 2;
  const bArea = bw * bd;

  for (const road of roads) {
    const rMinX = road.x - road.w / 2;
    const rMaxX = road.x + road.w / 2;
    const rMinZ = road.z - road.d / 2;
    const rMaxZ = road.z + road.d / 2;

    const overlapX = Math.max(0, Math.min(bMaxX, rMaxX) - Math.max(bMinX, rMinX));
    const overlapZ = Math.max(0, Math.min(bMaxZ, rMaxZ) - Math.max(bMinZ, rMinZ));
    const overlapArea = overlapX * overlapZ;

    if (overlapArea / bArea > 0.25) {
      const isHoriz = road.w > road.d;
      return { road, isHoriz, rMinX, rMaxX, rMinZ, rMaxZ };
    }
  }
  return null;
}

// Find intersections where two roads cross, creating clearance zones
function findIntersectionZones(roads) {
  const zones = [];
  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const r1 = roads[i];
      const r2 = roads[j];
      // Check if the two road rectangles overlap
      const r1MinX = r1.x - r1.w / 2;
      const r1MaxX = r1.x + r1.w / 2;
      const r1MinZ = r1.z - r1.d / 2;
      const r1MaxZ = r1.z + r1.d / 2;
      const r2MinX = r2.x - r2.w / 2;
      const r2MaxX = r2.x + r2.w / 2;
      const r2MinZ = r2.z - r2.d / 2;
      const r2MaxZ = r2.z + r2.d / 2;

      if (r1MinX < r2MaxX && r1MaxX > r2MinX && r1MinZ < r2MaxZ && r1MaxZ > r2MinZ) {
        // Intersection found — clearance zone = wider road + 0.6 unit on each side (scaled 40%)
        const widerRoad = Math.max(r1.roadWidth, r2.roadWidth);
        const clearance = widerRoad + 1.2; // 0.6 unit on each side
        const cx = Math.max(r1MinX, r2MinX) + (Math.min(r1MaxX, r2MaxX) - Math.max(r1MinX, r2MinX)) / 2;
        const cz = Math.max(r1MinZ, r2MinZ) + (Math.min(r1MaxZ, r2MaxZ) - Math.max(r1MinZ, r2MinZ)) / 2;
        zones.push({ x: cx, z: cz, w: clearance, d: clearance });
      }
    }
  }
  return zones;
}

// Check if building CENTER is inside any intersection clearance zone
function overlapsIntersection(bx, bz, bw, bd, intersections) {
  for (const iz of intersections) {
    if (Math.abs(bx - iz.x) < iz.w / 2 && Math.abs(bz - iz.z) < iz.d / 2) {
      return true;
    }
  }
  return false;
}

// Check if building overlaps any landmark zone
function overlapsLandmark(bx, bz, bw, bd) {
  const bMinX = bx - bw / 2;
  const bMaxX = bx + bw / 2;
  const bMinZ = bz - bd / 2;
  const bMaxZ = bz + bd / 2;

  for (const lz of LANDMARK_ZONES) {
    const lMinX = lz.x - lz.w / 2;
    const lMaxX = lz.x + lz.w / 2;
    const lMinZ = lz.z - lz.d / 2;
    const lMaxZ = lz.z + lz.d / 2;

    if (bMinX < lMaxX && bMaxX > lMinX && bMinZ < lMaxZ && bMaxZ > lMinZ) {
      return true;
    }
  }
  return false;
}

// Check if building overlaps any other building in the placed list
function overlapsOtherBuilding(bx, bz, bw, bd, placedBuildings, selfIndex) {
  const bMinX = bx - bw / 2;
  const bMaxX = bx + bw / 2;
  const bMinZ = bz - bd / 2;
  const bMaxZ = bz + bd / 2;

  for (let i = 0; i < placedBuildings.length; i++) {
    if (i === selfIndex) continue;
    const ob = placedBuildings[i];
    const oMinX = ob.x - ob.w / 2;
    const oMaxX = ob.x + ob.w / 2;
    const oMinZ = ob.z - ob.d / 2;
    const oMaxZ = ob.z + ob.d / 2;

    if (bMinX < oMaxX && bMaxX > oMinX && bMinZ < oMaxZ && bMaxZ > oMinZ) {
      return true;
    }
  }
  return false;
}

// Find the nearest road to a building and compute snap-to-edge position
function snapToRoadEdge(b, roads) {
  let bestDist = Infinity;
  let bestRoad = null;
  let bestIsHoriz = false;

  for (const road of roads) {
    const isHoriz = road.w > road.d;
    // Distance from building center to road centerline
    let dist;
    if (isHoriz) {
      // Check if building is within road's X extent
      const roadMinX = road.x - road.w / 2;
      const roadMaxX = road.x + road.w / 2;
      if (b.x >= roadMinX && b.x <= roadMaxX) {
        dist = Math.abs(b.z - road.z);
      } else {
        continue; // Building not alongside this road
      }
    } else {
      // Check if building is within road's Z extent
      const roadMinZ = road.z - road.d / 2;
      const roadMaxZ = road.z + road.d / 2;
      if (b.z >= roadMinZ && b.z <= roadMaxZ) {
        dist = Math.abs(b.x - road.x);
      } else {
        continue;
      }
    }

    if (dist < bestDist) {
      bestDist = dist;
      bestRoad = road;
      bestIsHoriz = isHoriz;
    }
  }

  if (!bestRoad) return null;

  const sidewalkEdge = bestRoad.roadWidth / 2 + 0.3; // Half road width + small gap (scaled 40%)

  if (bestIsHoriz) {
    // Road runs E-W, building should be north or south
    const side = b.z >= bestRoad.z ? 1 : -1;
    const newZ = bestRoad.z + side * (sidewalkEdge + b.d / 2);
    return { x: b.x, z: newZ };
  } else {
    // Road runs N-S, building should be east or west
    const side = b.x >= bestRoad.x ? 1 : -1;
    const newX = bestRoad.x + side * (sidewalkEdge + b.w / 2);
    return { x: newX, z: b.z };
  }
}

// Try to shift a building away from road overlap
function shiftAwayFromRoad(b, overlap) {
  const { road, isHoriz, rMinX, rMaxX, rMinZ, rMaxZ } = overlap;

  if (isHoriz) {
    // Shift along Z axis away from road
    const side = b.z >= road.z ? 1 : -1;
    const edgeDist = side > 0 ? rMaxZ : rMinZ;
    const newZ = edgeDist + side * (b.d / 2 + 0.3); // 0.3 gap (scaled 40%)
    return { x: b.x, z: newZ };
  } else {
    // Shift along X axis away from road
    const side = b.x >= road.x ? 1 : -1;
    const edgeDist = side > 0 ? rMaxX : rMinX;
    const newX = edgeDist + side * (b.w / 2 + 0.3); // 0.3 gap (scaled 40%)
    return { x: newX, z: b.z };
  }
}

// Main validation: fix all building positions before creating meshes
function validateAndFixPlacements(districtSets) {
  const roads = getRoadSegments();
  const intersections = findIntersectionZones(roads);

  // Flatten all buildings into a single list with district tags
  const allPlaced = [];
  for (const [district, buildings] of Object.entries(districtSets)) {
    for (const b of buildings) {
      allPlaced.push({ ...b, district, original: { x: b.x, z: b.z } });
    }
  }

  let repositioned = 0;
  let removed = 0;

  // Pass 1: Fix road overlaps, intersection overlaps, landmark overlaps
  for (let i = 0; i < allPlaced.length; i++) {
    const b = allPlaced[i];

    // Never move the player's apartment or named buildings
    if (b.landmark === 'apartment' || b.btype === 'player_apartment' || b.named) continue;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      let needsFix = false;

      // Check road overlap
      const roadOverlap = overlapsRoadBuffer(b.x, b.z, b.w, b.d, roads);
      if (roadOverlap) {
        const shifted = shiftAwayFromRoad(b, roadOverlap);
        b.x = shifted.x;
        b.z = shifted.z;
        needsFix = true;
        repositioned++;
      }

      // Check intersection overlap
      if (overlapsIntersection(b.x, b.z, b.w, b.d, intersections)) {
        // Try snapping to nearest road edge instead
        const snapped = snapToRoadEdge(b, roads);
        if (snapped) {
          b.x = snapped.x;
          b.z = snapped.z;
          needsFix = true;
          repositioned++;
        } else {
          // Shift by 1.2 units in both axes (scaled 40%)
          b.x += (b.x >= 0 ? 1.2 : -1.2);
          b.z += (b.z >= 0 ? 1.2 : -1.2);
          needsFix = true;
          repositioned++;
        }
      }

      // Check landmark overlap
      if (overlapsLandmark(b.x, b.z, b.w, b.d)) {
        const snapped = snapToRoadEdge(b, roads);
        if (snapped) {
          b.x = snapped.x;
          b.z = snapped.z;
          needsFix = true;
          repositioned++;
        } else {
          b.x += 1.8; // 1.8 units (scaled 40%)
          needsFix = true;
          repositioned++;
        }
      }

      if (!needsFix) break;
      attempts++;
    }

    // After max attempts, verify no road overlap remains — if still overlapping, remove
    if (overlapsRoadBuffer(b.x, b.z, b.w, b.d, roads)) {
      allPlaced.splice(i, 1);
      i--;
      removed++;
      continue;
    }
  }

  // Pass 2: Fix building-to-building overlaps (run twice for cascades)
  for (let pass2iter = 0; pass2iter < 2; pass2iter++) {
  for (let i = 0; i < allPlaced.length; i++) {
    const b = allPlaced[i];
    // Never move named buildings, player apartment, or landmark buildings
    if (b.landmark === 'apartment' || b.btype === 'player_apartment' || b.named) continue;

    if (overlapsOtherBuilding(b.x, b.z, b.w, b.d, allPlaced, i)) {
      // Try shifting in multiple directions at scaled distances (0.6x of original)
      let fixed = false;
      for (const shift of [
        { dx: 0, dz: 1.2 }, { dx: 0, dz: -1.2 },
        { dx: 1.2, dz: 0 }, { dx: -1.2, dz: 0 },
        { dx: 0, dz: 2.4 }, { dx: 0, dz: -2.4 },
        { dx: 2.4, dz: 0 }, { dx: -2.4, dz: 0 },
        { dx: 1.2, dz: 1.2 }, { dx: -1.2, dz: -1.2 },
        { dx: 1.2, dz: -1.2 }, { dx: -1.2, dz: 1.2 },
      ]) {
        const nx = b.x + shift.dx;
        const nz = b.z + shift.dz;
        if (!overlapsOtherBuilding(nx, nz, b.w, b.d, allPlaced, i) &&
            !overlapsRoadBuffer(nx, nz, b.w, b.d, roads)) {
          b.x = nx;
          b.z = nz;
          repositioned++;
          fixed = true;
          break;
        }
      }
      if (!fixed) {
        // Remove if can't fix
        allPlaced.splice(i, 1);
        i--;
        removed++;
      }
    }
  }
  } // end pass2iter

  // Pass 3: Final validation — check for significant road overlap after repositioning
  for (let i = 0; i < allPlaced.length; i++) {
    const b = allPlaced[i];
    if (b.landmark === 'apartment' || b.btype === 'player_apartment') continue;

    const sigOverlap = significantlyOverlapsRoad(b.x, b.z, b.w, b.d, roads);
    if (sigOverlap) {
      const { road, isHoriz } = sigOverlap;
      const halfRoadW = road.roadWidth / 2;
      if (isHoriz) {
        const side = b.z >= road.z ? 1 : -1;
        b.z = road.z + side * (halfRoadW + b.d / 2 + 0.6); // 0.6 gap (scaled 40%)
      } else {
        const side = b.x >= road.x ? 1 : -1;
        b.x = road.x + side * (halfRoadW + b.w / 2 + 0.6); // 0.6 gap (scaled 40%)
      }
      repositioned++;
    }
  }

  console.log(`[Building Validation] Repositioned: ${repositioned}, Removed: ${removed}, Final count: ${allPlaced.length}`);

  // Rebuild district sets from validated data
  const validated = {};
  for (const b of allPlaced) {
    if (!validated[b.district]) validated[b.district] = [];
    // Strip the extra fields we added
    const { district, original, ...buildingData } = b;
    validated[b.district].push(buildingData);
  }

  return validated;
}

// ========== MAIN EXPORT ==========
export function createBuildings(scene) {
  let globalIdx = 0;

  // Run placement validation before creating any meshes
  const validatedSets = validateAndFixPlacements(DISTRICT_BUILDING_SETS);

  for (const [district, buildings] of Object.entries(validatedSets)) {
    try {
      console.log(`Generating ${district}: ${buildings.length} buildings`);
      for (const b of buildings) {
        // DEV MODE: skip procedural/filler buildings, keep only named story buildings
        if (!b.named) continue;
        createBuilding(scene, b, globalIdx, district);
        globalIdx++;
      }
    } catch (e) {
      console.error(`ERROR generating ${district}:`, e);
    }
  }

  // Create landmarks
  try {
    createLandmarks(scene);
    console.log('Landmarks created');
  } catch (e) {
    console.error('ERROR creating landmarks:', e);
  }

  console.log(`Total buildings created: ${allBuildings.length}`);
  return { buildings: allBuildings.map(b => b.mesh), windowMats, doorMats };
}

// Show buildings when a district is unlocked
// (Buildings are now always visible, so this is a no-op but kept for API compatibility)
export function showDistrictBuildings(districtKey, scene) {
  // All buildings are already visible and detailed at creation time
}

// Get building collision data (for ACE LOS checks)
export function getBuildingBlocks() {
  return allBuildingBlocks.filter(b => {
    // Only include buildings from unlocked districts
    return b.district === 'town' || b.district === 'ruins' || isDistrictUnlocked(b.district);
  });
}

// Get all building meshes for a district
export function getDistrictBuildingMeshes(districtKey) {
  return allBuildings.filter(b => b.district === districtKey).map(b => b.mesh);
}

// Get all building block data (for minimap, etc)
export function getAllBuildingBlocks() {
  return allBuildingBlocks;
}

export function getWindowMats() { return windowMats; }
export function getDoorMats() { return doorMats; }

// ========== NPC SPAWN POINTS (future use) ==========
export const NPC_SPAWN_POINTS = {
  burbs: [
    { x: 78, z: -21 }, { x: 93, z: -9 }, { x: 105, z: -22.8 }, { x: 87, z: 4.8 },
  ],
  northtown: [
    { x: 69, z: 84 }, { x: 84, z: 93 }, { x: 75, z: 100.8 }, { x: 93, z: 96 },
  ],
  uptown: [
    { x: 96, z: 37.2 }, { x: 108, z: 37.2 }, { x: 99, z: 49.2 }, { x: 114, z: 57 },
  ],
  tower: [
    { x: -93, z: 64.8 }, { x: -81, z: 75 }, { x: -88.8, z: 82.8 }, { x: -78, z: 67.2 },
  ],
  industrial: [
    { x: -6, z: -55.2 }, { x: 15, z: -55.2 }, { x: 9, z: -69 }, { x: 27, z: -67.2 },
  ],
  port: [
    { x: -54, z: 120 }, { x: -39, z: 120 }, { x: -33, z: 126 }, { x: -48, z: 130.8 },
  ],
  aceHQ: [
    { x: -87, z: -30 }, { x: -81, z: -39 },
  ],
};

// ========== ACE PATROL WAYPOINTS (future use) ==========
export const ACE_PATROL_WAYPOINTS = {
  burbs: [
    { x: 78, z: -18 }, { x: 96, z: -18 }, { x: 96, z: 6 }, { x: 78, z: 6 },
  ],
  northtown: [
    { x: 66, z: 84 }, { x: 90, z: 84 }, { x: 90, z: 102 }, { x: 66, z: 102 },
  ],
  uptown: [
    { x: 94.8, z: 36 }, { x: 117, z: 36 }, { x: 117, z: 57 }, { x: 94.8, z: 57 },
  ],
  tower: [
    { x: -99, z: 60 }, { x: -75, z: 60 }, { x: -75, z: 84 }, { x: -99, z: 84 },
  ],
  industrial: [
    { x: -12, z: -51 }, { x: 33, z: -51 }, { x: 33, z: -78 }, { x: -12, z: -78 },
  ],
  port: [
    { x: -60, z: 117 }, { x: -30, z: 117 }, { x: -30, z: 132 }, { x: -60, z: 132 },
  ],
  aceHQ: [
    { x: -102, z: -27 }, { x: -72, z: -27 }, { x: -72, z: -49.2 }, { x: -102, z: -49.2 },
  ],
};
