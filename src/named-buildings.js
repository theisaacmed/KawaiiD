// Named building system — 28 landmark locations tied to NPCs and districts
// Each named building has a signature color (from its ownerNPC) and optional
// decorative props that appear as relationship levels rise.

import * as THREE from 'three';

// ========== NPC SIGNATURE COLORS ==========
// Each NPC has a color that their building absorbs as a target
export const NPC_COLORS = {
  Mei:    0xED93B1, // warm pink
  Hiro:   0xF5C4B3, // soft peach
  Luna:   0xAFA9EC, // lavender
  Kit:    0x9FE1CB, // mint green
  Ash:    0xFAEEDA, // warm yellow
  Dex:    0xF0997B, // soft coral
  Nao:    0xFAC775, // sunny amber
  Marco:  0xF0997B, // soft coral
  Felix:  0xAFA9EC, // lavender
  Harper: 0x85B7EB, // sky blue
  Ren:    0xED93B1, // warm pink
  Mika:   0x9FE1CB, // mint
  Zoe:    0xAFA9EC, // lavender
  Tomas:  0xF5C4B3, // soft peach
  Sara:   0xFAEEDA, // warm yellow
  Jin:    0xF5C4B3, // peach
  Yuna:   0xFAC775, // sunny amber
  Kai:    0x85B7EB, // dock blue
  Taro:   0xF5C4B3, // worn peach
  Vex:    0xED93B1, // punk pink
  Polly:  0x9FE1CB, // mint
  Sora:   0xFAC775, // gold
  Kenji:  0xAFA9EC, // calm lavender
  Mira:   0xF0997B, // soft coral
  Dante:  0xF0997B, // warm coral
  Quinn:  0xAFA9EC, // mysterious lavender
  Gus:    0x85B7EB, // dock blue
  Marina: 0x9FE1CB, // seafoam mint
  Dove:   0xFAEEDA, // warm white
};

// ========== NAMED BUILDING DATA ==========
// Named buildings are placed at their defined positions and given signature colors.
// Props appear at relationship levels 2 and 4.
// isMarker: true means no building mesh (existing landmark or open area)

export const NAMED_BUILDINGS = [
  // ===== TOWN =====
  {
    id: 'mei_apartment',
    name: "Mei's Apartment",
    district: 'town',
    x: 29, z: 15, w: 8, d: 7, h: 10,
    type: 'residential',
    ownerNPC: 'Mei',
    sigColor: NPC_COLORS.Mei,
    description: 'A cheerful apartment covered in stickers.',
    props: [
      { level: 2, type: 'stickers', desc: 'Colorful sticker clusters on the wall' },
      { level: 4, type: 'flower_box', desc: 'Flower box on every windowsill' },
    ],
  },
  {
    id: 'luna_townhouse',
    name: "Luna's Townhouse",
    district: 'town',
    x: -7, z: 15, w: 8, d: 7, h: 10,
    type: 'residential',
    ownerNPC: 'Luna',
    sigColor: NPC_COLORS.Luna,
    description: 'A calm townhouse with healing vibes.',
    props: [
      { level: 2, type: 'wind_chime', desc: 'Wind chime by the door' },
      { level: 4, type: 'banner', desc: 'Colorful banner above entrance' },
    ],
  },
  {
    id: 'kit_shop',
    name: "Kit's Supply Shop",
    district: 'town',
    x: -13, z: 8, w: 7, d: 6, h: 8,
    type: 'commercial',
    ownerNPC: 'Kit',
    sigColor: NPC_COLORS.Kit,
    description: "The town's crafting supply shop. Mei works here part-time.",
    props: [
      { level: 2, type: 'display_crate', desc: 'Display crate with crafts outside' },
      { level: 4, type: 'awning_colored', desc: 'Bright awning above the shop window' },
    ],
  },
  {
    id: 'fountain_square',
    name: 'Fountain Square',
    district: 'town',
    x: 0, z: 12,
    type: 'unique',
    ownerNPC: null,
    sigColor: null,
    isMarker: true,
    description: 'The heart of Town. Everyone meets here.',
  },
  {
    id: 'player_apartment',
    name: 'Your Apartment',
    district: 'town',
    x: 7, z: 8, w: 7, d: 7, h: 10,
    type: 'residential',
    ownerNPC: null,
    sigColor: 0xFAEEDA,
    isMarker: true, // already created as btype:player_apartment
    description: 'Home base. Workshop, stash, and bed.',
  },

  // ===== DOWNTOWN =====
  {
    id: 'nao_cafe',
    name: "Nao's Café",
    district: 'downtown',
    x: 7, z: 53, w: 9, d: 8, h: 10,
    type: 'commercial',
    ownerNPC: 'Nao',
    sigColor: NPC_COLORS.Nao,
    description: 'The warmest spot in Downtown. Everyone ends up here.',
    props: [
      { level: 2, type: 'cafe_tables', desc: 'Outdoor café tables on the sidewalk' },
      { level: 4, type: 'colored_awning', desc: 'Amber awning glows in the evening' },
    ],
  },
  {
    id: 'marco_restaurant',
    name: "Marco's Restaurant",
    district: 'downtown',
    x: 30, z: 54, w: 9, d: 8, h: 11,
    type: 'commercial',
    ownerNPC: 'Marco',
    sigColor: NPC_COLORS.Marco,
    description: "Marco's place. Everyone who's anyone eats here.",
    props: [
      { level: 2, type: 'outdoor_seating', desc: 'Outdoor dining tables set up' },
      { level: 4, type: 'lanterns', desc: 'String lanterns above the entrance' },
    ],
  },
  {
    id: 'clock_tower',
    name: 'Clock Tower',
    district: 'downtown',
    x: 5, z: 67,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0xFAEEDA,
    isMarker: true,
    description: "Downtown's landmark. Everyone knows where it is.",
  },
  {
    id: 'harper_office',
    name: "Harper's News Office",
    district: 'downtown',
    x: -21, z: 54, w: 9, d: 8, h: 11,
    type: 'commercial',
    ownerNPC: 'Harper',
    sigColor: NPC_COLORS.Harper,
    description: 'The Gazette offices. Harper works late most nights.',
    props: [
      { level: 2, type: 'news_board', desc: 'Pinboard of headlines outside' },
      { level: 4, type: 'antenna', desc: 'Satellite dish on the roof' },
    ],
  },

  // ===== BURBS =====
  {
    id: 'playground',
    name: 'Playground',
    district: 'burbs',
    x: 75, z: 3,
    type: 'unique',
    ownerNPC: null,
    sigColor: null,
    isMarker: true,
    description: "Sara's daughter plays here every afternoon.",
  },
  {
    id: 'tomas_cottage',
    name: "Tomas's Cottage",
    district: 'burbs',
    x: 93, z: -23, w: 9, d: 7, h: 6,
    type: 'residential',
    ownerNPC: 'Tomas',
    sigColor: NPC_COLORS.Tomas,
    description: 'A cozy cottage on a quiet Burbs street.',
    props: [
      { level: 2, type: 'garden_pots', desc: 'Clay pots with herbs along the path' },
      { level: 4, type: 'bench_outside', desc: 'Garden bench by the front door' },
    ],
  },
  {
    id: 'the_school',
    name: 'The School',
    district: 'burbs',
    x: 105, z: -25, w: 14, d: 10, h: 9,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0x85B7EB,
    description: 'Where Ash, Zoe, and Mika all went. Still going for Zoe.',
  },

  // ===== INDUSTRIAL =====
  {
    id: 'taro_factory',
    name: "Taro's Old Factory",
    district: 'industrial',
    x: -3, z: -53, w: 14, d: 11, h: 10,
    type: 'unique',
    ownerNPC: 'Taro',
    sigColor: NPC_COLORS.Taro,
    description: "Taro's family ran this factory for decades before it went dark.",
    props: [
      { level: 2, type: 'potted_plant', desc: 'A single potted plant by the door' },
      { level: 4, type: 'colored_drum', desc: 'A colorful barrel left in the yard' },
    ],
  },
  {
    id: 'workshop_property',
    name: 'The Workshop',
    district: 'industrial',
    x: 21, z: -53, w: 14, d: 11, h: 8,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0xF5C4B3,
    description: 'An abandoned workshop. Rumor is it can be bought at the right rank.',
  },
  {
    id: 'vex_squat',
    name: "Vex's Squat",
    district: 'industrial',
    x: 33, z: -51, w: 10, d: 9, h: 7,
    type: 'residential',
    ownerNPC: 'Vex',
    sigColor: NPC_COLORS.Vex,
    description: 'Vex made this warehouse her own. Graffiti covers every surface.',
    props: [
      { level: 2, type: 'graffiti_tag', desc: 'Fresh pink graffiti tag on the wall' },
      { level: 4, type: 'spray_cans', desc: 'Row of spray cans lined up outside' },
    ],
  },

  // ===== NORTHTOWN =====
  {
    id: 'yuna_flower_shop',
    name: "Yuna's Flower Shop",
    district: 'northtown',
    x: 93, z: 81, w: 8, d: 7, h: 7,
    type: 'commercial',
    ownerNPC: 'Yuna',
    sigColor: NPC_COLORS.Yuna,
    description: "The only splash of color in Northtown that people don't question.",
    props: [
      { level: 2, type: 'flower_display', desc: 'Flower buckets on the sidewalk' },
      { level: 4, type: 'hanging_flowers', desc: 'Hanging flower baskets from the awning' },
    ],
  },
  {
    id: 'chapel',
    name: 'Chapel',
    district: 'northtown',
    x: 78, z: 81,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0xFAEEDA,
    isMarker: true,
    description: 'Quiet chapel. Locals come here more out of habit than faith.',
  },
  {
    id: 'kai_shack',
    name: "Kai's Dock Shack",
    district: 'northtown',
    x: 60, z: 90, w: 7, d: 6, h: 5,
    type: 'residential',
    ownerNPC: 'Kai',
    sigColor: NPC_COLORS.Kai,
    description: "Kai's lived out of this shack for years. It suits him.",
    props: [
      { level: 2, type: 'buoy', desc: 'A faded orange buoy hanging by the door' },
      { level: 4, type: 'fishing_net', desc: 'Old fishing net draped on the wall' },
    ],
  },

  // ===== UPTOWN =====
  {
    id: 'sora_building',
    name: "Sora's Building",
    district: 'uptown',
    x: 103, z: 45, w: 10, d: 8, h: 15,
    type: 'residential',
    ownerNPC: 'Sora',
    sigColor: NPC_COLORS.Sora,
    description: "Sora's penthouse suite. She's stockpiling something up there.",
    props: [
      { level: 2, type: 'rooftop_chairs', desc: 'Designer chairs visible on the rooftop' },
      { level: 4, type: 'rooftop_lights', desc: 'Tiny lights strung across the rooftop' },
    ],
  },
  {
    id: 'kenji_office',
    name: "Kenji's Office",
    district: 'uptown',
    x: 101, z: 33, w: 9, d: 7, h: 14,
    type: 'commercial',
    ownerNPC: 'Kenji',
    sigColor: NPC_COLORS.Kenji,
    description: "Kenji's finance office. Serious facade, secret inside.",
    props: [
      { level: 2, type: 'nameplate', desc: 'Polished nameplate by the door' },
      { level: 4, type: 'art_piece', desc: 'Small art piece appeared in the lobby window' },
    ],
  },
  {
    id: 'the_hotel',
    name: 'The Grand Hotel',
    district: 'uptown',
    x: 109, z: 35,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0xF0997B,
    isMarker: true,
    description: 'The only hotel in Uptown. Expensive, quiet.',
  },

  // ===== TOWER =====
  {
    id: 'dante_tower',
    name: "Twin Tower — Dante's Lobby",
    district: 'tower',
    x: -96, z: 60, w: 10, d: 9, h: 28,
    type: 'unique',
    ownerNPC: 'Dante',
    sigColor: NPC_COLORS.Dante,
    description: "Dante runs the lobby of Tower A. Nothing gets past him.",
    props: [
      { level: 2, type: 'lobby_plant', desc: 'Large plant appears in the lobby window' },
      { level: 4, type: 'lobby_art', desc: 'Colorful poster in the lobby window' },
    ],
  },
  {
    id: 'quinn_apartment',
    name: "Quinn's Apartment",
    district: 'tower',
    x: -84, z: 84, w: 10, d: 9, h: 30,
    type: 'residential',
    ownerNPC: 'Quinn',
    sigColor: NPC_COLORS.Quinn,
    description: 'Very high up. Quinn likes being above it all.',
    props: [
      { level: 2, type: 'satellite_dish', desc: 'Satellite dish on the roof' },
      { level: 4, type: 'led_strip', desc: 'Faint LED strip along the top floor' },
    ],
  },

  // ===== PORT =====
  {
    id: 'gus_dock_office',
    name: "Gus's Dock Office",
    district: 'port',
    x: -33, z: 119, w: 9, d: 7, h: 7,
    type: 'commercial',
    ownerNPC: 'Gus',
    sigColor: NPC_COLORS.Gus,
    description: "Gus runs the docks out of this office. Always smells like brine.",
    props: [
      { level: 2, type: 'dock_crate', desc: 'Painted crate stacked outside' },
      { level: 4, type: 'flag', desc: 'Small colorful flag on a pole outside' },
    ],
  },
  {
    id: 'marina_lighthouse',
    name: "Marina's Lighthouse",
    district: 'port',
    x: -57, z: 135,
    type: 'unique',
    ownerNPC: 'Marina',
    sigColor: NPC_COLORS.Marina,
    isMarker: true,
    description: "Marina's home and workshop. The light has been dark for years.",
  },
  {
    id: 'shipping_yard',
    name: 'Shipping Yard',
    district: 'port',
    x: -45, z: 117, w: 12, d: 9, h: 7,
    type: 'unique',
    ownerNPC: null,
    sigColor: 0x85B7EB,
    description: 'Where the big containers come and go.',
  },
];

// ========== POSITION LOOKUP ==========
const _byId = {};
for (const b of NAMED_BUILDINGS) {
  _byId[b.id] = b;
}

export function getNamedBuildingPosition(id) {
  const b = _byId[id];
  if (!b) return null;
  return { x: b.x, z: b.z };
}

export function getNamedBuildingData(id) {
  return _byId[id] || null;
}

export function getAllNamedBuildings() {
  return NAMED_BUILDINGS;
}

// Return all named buildings for a given district
export function getNamedBuildingsByDistrict(district) {
  return NAMED_BUILDINGS.filter(b => b.district === district);
}

// ========== PROP TRACKING ==========
// Track which prop levels have been spawned per building
const _spawnedProps = {}; // { buildingId: Set<level> }

// ========== PROP SPAWNING ==========
// Called when an NPC relationship reaches a new level.
// Creates decorative props outside the named building at levels 2 and 4.
export function spawnPropsIfNeeded(scene, npcName, relLevel) {
  // Find buildings owned by this NPC
  const ownedBuildings = NAMED_BUILDINGS.filter(b => b.ownerNPC === npcName && b.props);

  for (const building of ownedBuildings) {
    if (!_spawnedProps[building.id]) _spawnedProps[building.id] = new Set();
    const spawned = _spawnedProps[building.id];

    for (const prop of building.props) {
      if (relLevel >= prop.level && !spawned.has(prop.level)) {
        spawned.add(prop.level);
        _createProp(scene, building, prop);
      }
    }
  }
}

// Re-spawn all props appropriate to current relationship levels (for save restore)
export function restoreAllProps(scene, relationships) {
  for (const building of NAMED_BUILDINGS) {
    if (!building.ownerNPC || !building.props) continue;
    const rel = relationships[building.ownerNPC];
    if (!rel) continue;
    const relLevel = Math.floor(rel.level || 0);

    if (!_spawnedProps[building.id]) _spawnedProps[building.id] = new Set();
    const spawned = _spawnedProps[building.id];

    for (const prop of building.props) {
      if (relLevel >= prop.level && !spawned.has(prop.level)) {
        spawned.add(prop.level);
        _createProp(scene, building, prop);
      }
    }
  }
}

// ========== PROP CREATION ==========
function _createProp(scene, building, prop) {
  const { x, z, w = 8, d = 7 } = building;
  const frontZ = z + d / 2; // in front of the building

  switch (prop.type) {
    // -- TOWN --
    case 'stickers': {
      // 4 small colored planes stuck to the building face
      const colors = [0xED93B1, 0xFAC775, 0x9FE1CB, 0x85B7EB];
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide });
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), mat);
        s.position.set(x - w * 0.25 + i * (w * 0.18), 1.5 + (i % 2) * 0.6, frontZ + 0.06);
        scene.add(s);
      }
      break;
    }
    case 'flower_box': {
      const mat = new THREE.MeshLambertMaterial({ color: 0x7A5C4A });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.2, 0.3), mat);
      box.position.set(x, 2.8, frontZ + 0.18);
      scene.add(box);
      const flMat = new THREE.MeshLambertMaterial({ color: 0xED93B1 });
      for (let i = 0; i < 3; i++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 5), flMat);
        fl.position.set(x - 0.5 + i * 0.5, 3.15, frontZ + 0.18);
        scene.add(fl);
      }
      break;
    }
    case 'wind_chime': {
      const postMat = new THREE.MeshLambertMaterial({ color: 0x9A9A9A });
      for (let i = 0; i < 4; i++) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3 + i * 0.08, 4), postMat);
        rod.position.set(x - 0.3 + i * 0.2, 2.2, frontZ + 0.04);
        scene.add(rod);
      }
      break;
    }
    case 'banner': {
      const mat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xED93B1, side: THREE.DoubleSide });
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, 0.6), mat);
      banner.position.set(x, 3.5, frontZ + 0.06);
      scene.add(banner);
      break;
    }
    case 'display_crate': {
      const mat = new THREE.MeshLambertMaterial({ color: 0x9FE1CB });
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat);
      crate.position.set(x + w * 0.25, 0.3, frontZ + 1.0);
      scene.add(crate);
      break;
    }
    case 'awning_colored': {
      const mat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0x9FE1CB });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.06, 1.2), mat);
      awning.position.set(x, 2.8, frontZ + 0.5);
      awning.rotation.x = -0.12;
      scene.add(awning);
      break;
    }

    // -- DOWNTOWN --
    case 'cafe_tables': {
      const tMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xFAC775 });
      for (let i = 0; i < 2; i++) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8), tMat);
        top.position.set(x - 1.2 + i * 2.4, 0.72, frontZ + 1.4);
        scene.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5), tMat);
        leg.position.set(x - 1.2 + i * 2.4, 0.36, frontZ + 1.4);
        scene.add(leg);
        // Chair
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.35), tMat);
        chair.position.set(x - 1.2 + i * 2.4, 0.45, frontZ + 1.9);
        scene.add(chair);
      }
      break;
    }
    case 'colored_awning': {
      const mat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xFAC775 });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.06, 1.5), mat);
      awning.position.set(x, 3.0, frontZ + 0.6);
      awning.rotation.x = -0.1;
      scene.add(awning);
      break;
    }
    case 'outdoor_seating': {
      const tMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xF0997B });
      for (let i = 0; i < 3; i++) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.6), tMat);
        top.position.set(x - 2 + i * 2, 0.7, frontZ + 1.5);
        scene.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4), tMat);
        leg.position.set(x - 2 + i * 2, 0.35, frontZ + 1.5);
        scene.add(leg);
      }
      break;
    }
    case 'lanterns': {
      const lMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xF0997B });
      for (let i = 0; i < 5; i++) {
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), lMat);
        lantern.position.set(x - w * 0.4 + i * (w * 0.2), 3.5, frontZ + 0.3);
        scene.add(lantern);
      }
      break;
    }
    case 'news_board': {
      const boardMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.06), boardMat);
      board.position.set(x + w * 0.3, 1.1, frontZ + 0.06);
      scene.add(board);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0x85B7EB });
      for (let i = 0; i < 3; i++) {
        const slip = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), pinMat);
        slip.position.set(x + w * 0.3 - 0.3 + (i % 2) * 0.3, 1.1 - 0.2 + Math.floor(i / 2) * 0.3, frontZ + 0.1);
        scene.add(slip);
      }
      break;
    }
    case 'antenna': {
      const mat = new THREE.MeshLambertMaterial({ color: 0x707070 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), mat);
      const { h = 10 } = building;
      pole.position.set(x + w * 0.3, h + 1.25, z);
      scene.add(pole);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 8), mat);
      dish.position.set(x + w * 0.3, h + 2.6, z);
      dish.rotation.x = Math.PI / 4;
      scene.add(dish);
      break;
    }

    // -- BURBS --
    case 'garden_pots': {
      const potMat = new THREE.MeshLambertMaterial({ color: 0xC07060 });
      const soilMat = new THREE.MeshLambertMaterial({ color: 0x6B5040 });
      for (let i = 0; i < 3; i++) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 6), potMat);
        pot.position.set(x - 1 + i, 0.15, frontZ + 0.8);
        scene.add(pot);
        const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 6), soilMat);
        soil.position.set(x - 1 + i, 0.32, frontZ + 0.8);
        scene.add(soil);
      }
      break;
    }
    case 'bench_outside': {
      const mat = new THREE.MeshLambertMaterial({ color: 0x8A6A50 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), mat);
      seat.position.set(x + w * 0.25, 0.42, frontZ + 0.9);
      scene.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), mat);
      back.position.set(x + w * 0.25, 0.7, frontZ + 0.7);
      scene.add(back);
      break;
    }

    // -- INDUSTRIAL --
    case 'potted_plant': {
      const potMat = new THREE.MeshLambertMaterial({ color: 0x7A5C4A });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 8), potMat);
      pot.position.set(x + w * 0.35, 0.2, frontZ + 0.5);
      scene.add(pot);
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x5A8A4A });
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), leafMat);
      leaves.position.set(x + w * 0.35, 0.75, frontZ + 0.5);
      scene.add(leaves);
      break;
    }
    case 'colored_drum': {
      const mat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xF5C4B3 });
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 10), mat);
      drum.position.set(x - w * 0.35, 0.4, frontZ + 0.7);
      scene.add(drum);
      break;
    }
    case 'graffiti_tag': {
      const colors = [0xED93B1, 0xFAC775, 0x9FE1CB];
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.DoubleSide });
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8 + Math.random() * 0.4, 0.5 + Math.random() * 0.3), mat);
        tag.position.set(x - w * 0.3 + i * (w * 0.22), 1.0 + i * 0.7, frontZ + 0.06);
        tag.rotation.z = (Math.random() - 0.5) * 0.25;
        scene.add(tag);
      }
      break;
    }
    case 'spray_cans': {
      const canColors = [0xED93B1, 0x85B7EB, 0xFAC775];
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshLambertMaterial({ color: canColors[i] });
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 7), mat);
        can.position.set(x + w * 0.3 + (i - 1) * 0.25, 0.175, frontZ + 0.6);
        scene.add(can);
      }
      break;
    }

    // -- NORTHTOWN --
    case 'flower_display': {
      const bucketMat = new THREE.MeshLambertMaterial({ color: 0x5A7A5A });
      const flMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xFAC775 });
      for (let i = 0; i < 3; i++) {
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 7), bucketMat);
        bucket.position.set(x - 0.8 + i * 0.8, 0.2, frontZ + 0.7);
        scene.add(bucket);
        for (let f = 0; f < 3; f++) {
          const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), flMat);
          fl.position.set(x - 0.8 + i * 0.8 + (Math.random() - 0.5) * 0.25,
            0.55 + Math.random() * 0.15, frontZ + 0.7);
          scene.add(fl);
        }
      }
      break;
    }
    case 'hanging_flowers': {
      const ropeMat = new THREE.MeshLambertMaterial({ color: 0x8A7060 });
      const flMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0xFAC775 });
      for (let i = 0; i < 3; i++) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), ropeMat);
        rope.position.set(x - 1.5 + i * 1.5, 3.45, frontZ + 0.1);
        scene.add(rope);
        const basket = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), flMat);
        basket.position.set(x - 1.5 + i * 1.5, 3.15, frontZ + 0.1);
        scene.add(basket);
      }
      break;
    }
    case 'buoy': {
      const mat = new THREE.MeshLambertMaterial({ color: 0xF08030 });
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
      buoy.position.set(x - w * 0.35, 1.2, frontZ + 0.15);
      scene.add(buoy);
      // Rope
      const ropeMat = new THREE.MeshLambertMaterial({ color: 0xA0907A });
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), ropeMat);
      rope.position.set(x - w * 0.35, 0.9, frontZ + 0.15);
      scene.add(rope);
      break;
    }
    case 'fishing_net': {
      // Simplified: dark plane with slight opacity to suggest netting
      const mat = new THREE.MeshLambertMaterial({ color: 0x708070, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const net = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.5), mat);
      net.position.set(x, 1.8, frontZ + 0.07);
      scene.add(net);
      break;
    }

    // -- UPTOWN --
    case 'rooftop_chairs': {
      const { h = 15 } = building;
      const mat = new THREE.MeshLambertMaterial({ color: 0xF0EED8 });
      for (let i = 0; i < 2; i++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), mat);
        seat.position.set(x - 1 + i * 2, h + 0.08, z + (i === 0 ? 1 : -1));
        scene.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), mat);
        back.position.set(x - 1 + i * 2, h + 0.35, z + (i === 0 ? 0.8 : -0.8));
        scene.add(back);
      }
      break;
    }
    case 'rooftop_lights': {
      const { h = 15 } = building;
      const mat = new THREE.MeshBasicMaterial({ color: building.sigColor || 0xFAC775 });
      for (let i = 0; i < 6; i++) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), mat);
        bulb.position.set(x - w / 2 + i * (w / 5), h + 0.3, z + d / 2 - 0.2);
        scene.add(bulb);
      }
      break;
    }
    case 'nameplate': {
      const mat = new THREE.MeshLambertMaterial({ color: 0xBBAA88 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.04), mat);
      plate.position.set(x + w * 0.2, 1.2, frontZ + 0.05);
      scene.add(plate);
      break;
    }
    case 'art_piece': {
      const mat = new THREE.MeshBasicMaterial({ color: building.sigColor || 0xAFA9EC, side: THREE.DoubleSide });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), mat);
      art.position.set(x - w * 0.2, 1.4, frontZ + 0.04);
      scene.add(art);
      break;
    }

    // -- TOWER --
    case 'lobby_plant': {
      const potMat = new THREE.MeshLambertMaterial({ color: 0x5A4A3A });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 8), potMat);
      pot.position.set(x - w * 0.3, 0.25, frontZ + 0.3);
      scene.add(pot);
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x4A7A4A });
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 7), leafMat);
      leaves.position.set(x - w * 0.3, 0.95, frontZ + 0.3);
      scene.add(leaves);
      break;
    }
    case 'lobby_art': {
      const mat = new THREE.MeshBasicMaterial({ color: building.sigColor || 0xF0997B, side: THREE.DoubleSide });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat);
      poster.position.set(x + w * 0.2, 2.0, frontZ + 0.04);
      scene.add(poster);
      break;
    }
    case 'satellite_dish': {
      const { h = 30 } = building;
      const mat = new THREE.MeshLambertMaterial({ color: 0x909090 });
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), mat);
      arm.position.set(x + w * 0.3, h + 0.5, z + d * 0.3);
      arm.rotation.z = 0.5;
      scene.add(arm);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 9), mat);
      dish.position.set(x + w * 0.3, h + 1.0, z + d * 0.3);
      dish.rotation.x = Math.PI / 5;
      scene.add(dish);
      break;
    }
    case 'led_strip': {
      const { h = 30 } = building;
      const mat = new THREE.MeshBasicMaterial({ color: building.sigColor || 0xAFA9EC });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), mat);
      strip.position.set(x, h + 0.1, frontZ);
      scene.add(strip);
      break;
    }

    // -- PORT --
    case 'dock_crate': {
      const mat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0x85B7EB });
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), mat);
      crate.position.set(x + w * 0.3, 0.4, frontZ + 0.8);
      scene.add(crate);
      // Wood slat lines
      const slatMat = new THREE.MeshLambertMaterial({ color: 0x6A5A4A });
      for (let i = 0; i < 3; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.04), slatMat);
        slat.position.set(x + w * 0.3, 0.1 + i * 0.3, frontZ + 0.8 + 0.5);
        scene.add(slat);
      }
      break;
    }
    case 'flag': {
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x909090 });
      const { h = 7 } = building;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5), poleMat);
      pole.position.set(x - w * 0.35, h + 1.0, frontZ + 0.3);
      scene.add(pole);
      const flagMat = new THREE.MeshLambertMaterial({ color: building.sigColor || 0x85B7EB, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), flagMat);
      flag.position.set(x - w * 0.35 + 0.35, h + 1.8, frontZ + 0.3);
      scene.add(flag);
      break;
    }

    default:
      break;
  }
}
