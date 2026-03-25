// Stray cats & dogs — small mesh critters that wander near buildings,
// sit, sleep, and flee when the player gets close.
// Named critters are special friendly pets with name labels and patrol behaviors.

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const CRITTER_GRAY = new THREE.Color(0x808080);
const EYE_COLOR = 0x111111;
const _c = new THREE.Color();

// District palette targets for critters
const DISTRICT_CRITTER_COLORS = {
  town:      [0xF0997B, 0xED93B1, 0x9FE1CB, 0xFAC775],
  burbs:     [0x9FE1CB, 0xF5C4B3, 0xA8D8A8, 0xFAEEDA],
  northtown: [0xFAC775, 0x9FE1CB, 0xF0997B, 0xF5C4B3],
};

const SPEED = 0.8;
const FLEE_SPEED = 2.4;
const FLEE_RADIUS = 6;
const WANDER_RADIUS = 8;

const critters = [];
let colorCheckTimer = 0;

// Named special critters — friendly pets with labels and patrol routes
const NAMED_CRITTER_DEFS = [
  // Dogs near spawn
  {
    name: 'Ender', type: 'dog', district: 'town',
    color: 0xC8A070, // golden brown
    home: { x: -3, z: -52 },
    patrol: [
      { x: -3, z: -52 },  // ruin entrance west
      { x: 4, z: -55 },   // ruin entrance east
      { x: 0, z: -48 },   // just outside ruins
      { x: -7, z: -58 },  // near Bachi's patrol
    ],
    activities: ['chasing_butterflies', 'digging', 'rolling', 'begging'],
  },
  {
    name: 'Bean', type: 'dog', district: 'town',
    color: 0xF0E0C0, // cream/white
    home: { x: 6, z: -54 },
    patrol: [
      { x: 6, z: -54 },   // ruin entrance east
      { x: 0, z: -50 },   // just outside ruins
      { x: -4, z: -57 },  // near Bachi
      { x: 8, z: -60 },   // deeper toward ruins
    ],
    activities: ['napping_sunny', 'tail_wagging', 'sniffing', 'zoomies'],
  },
  // Black cats near ruin entrance (ruins center is 0, -120; entrance ~z=-60)
  {
    name: 'Bachi', type: 'cat', district: 'town',
    color: 0x1A1A1A, // black
    home: { x: -5, z: -55 },
    patrol: [
      { x: -5, z: -55 }, // ruin entrance west
      { x: 5, z: -58 },  // ruin entrance east
      { x: 0, z: -50 },  // just outside ruins
      { x: -8, z: -62 }, // deeper toward ruins
    ],
    activities: ['stalking', 'grooming', 'pouncing', 'sitting_watching'],
  },
  {
    name: 'Brutus', type: 'cat', district: 'town',
    color: 0x1A1A1A, // black
    home: { x: 3, z: -58 },
    patrol: [
      { x: 3, z: -58 },  // ruin entrance
      { x: -3, z: -52 }, // near Bachi
      { x: 8, z: -60 },  // east ruin entrance
      { x: 0, z: -65 },  // into ruins edge
    ],
    activities: ['hunting', 'stretching', 'hissing', 'napping_shadow'],
  },
];

// 8 critters total: 3 Town, 3 Burbs, 2 Northtown
const CRITTER_DEFS = [
  // Town — near residential buildings
  { x: -8, z: 3, type: 'cat', district: 'town' },
  { x: 20, z: 9, type: 'dog', district: 'town' },
  { x: -27, z: 14, type: 'cat', district: 'town' },
  // Burbs — near houses
  { x: 74, z: -22, type: 'dog', district: 'burbs' },
  { x: 86, z: -8, type: 'cat', district: 'burbs' },
  { x: 97, z: 4, type: 'cat', district: 'burbs' },
  // Northtown
  { x: 66, z: 83, type: 'cat', district: 'northtown' },
  { x: 82, z: 92, type: 'dog', district: 'northtown' },
];

function buildCat() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x808080 });
  const eyeMat = new THREE.MeshLambertMaterial({ color: EYE_COLOR });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.18), mat);
  body.position.y = 0.15;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat);
  head.position.set(0.2, 0.22, 0);
  group.add(head);

  // Ears
  for (const side of [-0.04, 0.04]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), mat);
    ear.position.set(0.2, 0.31, side);
    group.add(ear);
  }

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), mat);
  tail.position.set(-0.22, 0.25, 0);
  tail.rotation.z = 0.6;
  group.add(tail);

  // Eyes
  for (const side of [-0.03, 0.03]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), eyeMat);
    eye.position.set(0.265, 0.23, side);
    group.add(eye);
  }

  return { group, material: mat };
}

function buildDog() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x808080 });
  const eyeMat = new THREE.MeshLambertMaterial({ color: EYE_COLOR });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.22), mat);
  body.position.y = 0.22;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.14), mat);
  head.position.set(0.25, 0.3, 0);
  group.add(head);

  // Ears (floppy — rotated down)
  for (const side of [-0.06, 0.06]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), mat);
    ear.position.set(0.25, 0.34, side);
    ear.rotation.x = side > 0 ? 0.4 : -0.4;
    group.add(ear);
  }

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 4), mat);
  tail.position.set(-0.25, 0.32, 0);
  tail.rotation.z = 0.8;
  group.add(tail);

  // Legs
  for (const lx of [-0.12, 0.12]) {
    for (const lz of [-0.07, 0.07]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), mat);
      leg.position.set(lx, 0.06, lz);
      group.add(leg);
    }
  }

  // Eyes
  for (const side of [-0.035, 0.035]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), eyeMat);
    eye.position.set(0.326, 0.31, side);
    group.add(eye);
  }

  return { group, material: mat };
}

function buildCritterLabel(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(name);
  const pw = metrics.width + 20;
  const ph = 38;
  const px = (256 - pw) / 2;
  const py = (64 - ph) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.fill();

  ctx.fillStyle = '#f0e8d8';
  ctx.fillText(name, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

export function createCritters(scene) {
  // --- Regular stray critters ---
  for (let i = 0; i < CRITTER_DEFS.length; i++) {
    const def = CRITTER_DEFS[i];
    const { group, material } = def.type === 'cat' ? buildCat() : buildDog();
    group.scale.setScalar(2.0);

    const terrainY = getTerrainHeight(def.x, def.z);
    group.position.set(def.x, terrainY, def.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);

    const palette = DISTRICT_CRITTER_COLORS[def.district] || DISTRICT_CRITTER_COLORS.town;
    const targetColor = new THREE.Color(palette[i % palette.length]);

    critters.push({
      group,
      material,
      type: def.type,
      homeX: def.x,
      homeZ: def.z,
      x: def.x,
      z: def.z,
      state: 'idle',
      stateTimer: 2 + Math.random() * 4,
      targetX: def.x,
      targetZ: def.z,
      speed: SPEED,
      direction: Math.random() * Math.PI * 2,
      district: def.district,
      targetColor,
      localColor: 0,
      bodyRef: group.children[0],
    });
  }

  // --- Named special critters (friendly, don't flee, have labels + patrol) ---
  for (const def of NAMED_CRITTER_DEFS) {
    const { group, material } = def.type === 'cat' ? buildCat() : buildDog();
    group.scale.setScalar(2.0);

    // Set color directly (named critters always have their color)
    material.color.set(def.color);

    const terrainY = getTerrainHeight(def.home.x, def.home.z);
    group.position.set(def.home.x, terrainY, def.home.z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // Add name label above
    const label = buildCritterLabel(def.name);
    label.position.set(0, 0.45, 0); // above the critter (in local scaled space)
    group.add(label);

    scene.add(group);

    critters.push({
      group,
      material,
      type: def.type,
      homeX: def.home.x,
      homeZ: def.home.z,
      x: def.home.x,
      z: def.home.z,
      state: 'idle',
      stateTimer: 2 + Math.random() * 4,
      targetX: def.home.x,
      targetZ: def.home.z,
      speed: SPEED * 0.8, // slightly slower patrol pace
      direction: Math.random() * Math.PI * 2,
      district: def.district,
      targetColor: new THREE.Color(def.color),
      localColor: 1, // always full color
      bodyRef: group.children[0],
      // Named critter extras
      named: true,
      critterName: def.name,
      patrol: def.patrol,
      patrolIndex: 0,
      activities: def.activities,
      activityState: null,
      activityTimer: 0,
    });
  }
}

function pickWanderTarget(critter) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 2 + Math.random() * (WANDER_RADIUS - 2);
  return {
    x: critter.homeX + Math.cos(angle) * dist,
    z: critter.homeZ + Math.sin(angle) * dist,
  };
}

function refreshCritterColors() {
  const buildings = getBuildingColors();
  for (const cr of critters) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - cr.x;
      const dz = b.z - cr.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    cr.localColor = weight > 0 ? total / weight : 0;
  }
}

export function updateCritters(dt, elapsed, playerPos) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= 3) {
    colorCheckTimer = 0;
    refreshCritterColors();
  }

  for (const cr of critters) {
    const pdx = playerPos.x - cr.x;
    const pdz = playerPos.z - cr.z;
    const playerDist = Math.sqrt(pdx * pdx + pdz * pdz);

    if (cr.named) {
      // === NAMED CRITTER UPDATE — friendly, patrol-based, no fleeing ===
      updateNamedCritter(cr, dt, elapsed, playerDist);
    } else {
      // === STRAY CRITTER UPDATE — original flee behavior ===

      // Flee trigger
      if (cr.state !== 'fleeing' && playerDist < FLEE_RADIUS) {
        cr.state = 'fleeing';
        cr.stateTimer = 3;
        const norm = playerDist || 1;
        cr.targetX = cr.x - (pdx / norm) * 10;
        cr.targetZ = cr.z - (pdz / norm) * 10;
        if (cr.bodyRef) cr.bodyRef.scale.y = 1;
      }

      switch (cr.state) {
        case 'idle': {
          cr.stateTimer -= dt;
          if (cr.stateTimer <= 0) {
            const roll = Math.random();
            if (roll < 0.4) {
              cr.state = 'walking';
              const tgt = pickWanderTarget(cr);
              cr.targetX = tgt.x;
              cr.targetZ = tgt.z;
              cr.stateTimer = 8;
            } else if (roll < 0.7) {
              cr.stateTimer = 2 + Math.random() * 4;
            } else {
              cr.state = 'sleeping';
              cr.stateTimer = 4 + Math.random() * 6;
              if (cr.bodyRef) cr.bodyRef.scale.y = 0.7;
            }
          }
          break;
        }

        case 'walking': {
          const dx = cr.targetX - cr.x;
          const dz = cr.targetZ - cr.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < 0.3 || cr.stateTimer <= 0) {
            cr.state = 'idle';
            cr.stateTimer = 2 + Math.random() * 4;
          } else {
            const step = Math.min(cr.speed * dt, dist);
            cr.x += (dx / dist) * step;
            cr.z += (dz / dist) * step;
            cr.direction = Math.atan2(dx, dz);
            cr.stateTimer -= dt;
          }
          break;
        }

        case 'sleeping': {
          cr.stateTimer -= dt;
          if (cr.stateTimer <= 0) {
            cr.state = 'idle';
            cr.stateTimer = 1 + Math.random() * 2;
            if (cr.bodyRef) cr.bodyRef.scale.y = 1;
          }
          break;
        }

        case 'fleeing': {
          const dx = cr.targetX - cr.x;
          const dz = cr.targetZ - cr.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < 0.5 || cr.stateTimer <= 0) {
            cr.state = 'walking';
            cr.targetX = cr.homeX + (Math.random() - 0.5) * 4;
            cr.targetZ = cr.homeZ + (Math.random() - 0.5) * 4;
            cr.stateTimer = 6;
          } else {
            const step = Math.min(FLEE_SPEED * dt, dist);
            cr.x += (dx / dist) * step;
            cr.z += (dz / dist) * step;
            cr.direction = Math.atan2(dx, dz);
            cr.stateTimer -= dt;
          }
          break;
        }
      }

      // Clamp to wander radius * 1.5 from home
      const maxDist = WANDER_RADIUS * 1.5;
      const hx = cr.x - cr.homeX;
      const hz = cr.z - cr.homeZ;
      const homeDist = Math.sqrt(hx * hx + hz * hz);
      if (homeDist > maxDist) {
        cr.x = cr.homeX + (hx / homeDist) * maxDist;
        cr.z = cr.homeZ + (hz / homeDist) * maxDist;
      }

      // Color: gray → district palette
      _c.copy(CRITTER_GRAY).lerp(cr.targetColor, cr.localColor);
      cr.material.color.copy(_c);
    }

    // Update mesh position and rotation
    const terrainY = getTerrainHeight(cr.x, cr.z);
    cr.group.position.set(cr.x, terrainY, cr.z);
    cr.group.rotation.y = cr.direction;
  }
}

// Named critter behavior — patrol between points, do fun activities, react to player
function updateNamedCritter(cr, dt, elapsed, playerDist) {
  cr.stateTimer -= dt;

  switch (cr.state) {
    case 'idle': {
      // If player is close, look at them (friendly)
      if (playerDist < 4) {
        // Tail wag animation via body bob
        cr.group.children[0].position.y = 0.22 + Math.sin(elapsed * 8) * 0.02;
      }

      if (cr.stateTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.35) {
          // Patrol to next point
          cr.state = 'patrolling';
          cr.patrolIndex = (cr.patrolIndex + 1) % cr.patrol.length;
          const next = cr.patrol[cr.patrolIndex];
          cr.targetX = next.x + (Math.random() - 0.5) * 3;
          cr.targetZ = next.z + (Math.random() - 0.5) * 3;
          cr.stateTimer = 15;
        } else if (roll < 0.6) {
          // Do a fun activity
          cr.state = 'activity';
          cr.activityState = cr.activities[Math.floor(Math.random() * cr.activities.length)];
          cr.activityTimer = 3 + Math.random() * 4;
          cr.stateTimer = cr.activityTimer;
        } else if (roll < 0.8) {
          // Nap
          cr.state = 'sleeping';
          cr.stateTimer = 3 + Math.random() * 5;
          if (cr.bodyRef) cr.bodyRef.scale.y = 0.7;
        } else {
          // Short wander nearby
          cr.state = 'walking';
          const angle = Math.random() * Math.PI * 2;
          const dist = 1 + Math.random() * 3;
          cr.targetX = cr.x + Math.cos(angle) * dist;
          cr.targetZ = cr.z + Math.sin(angle) * dist;
          cr.stateTimer = 6;
        }
      }
      break;
    }

    case 'patrolling':
    case 'walking': {
      const dx = cr.targetX - cr.x;
      const dz = cr.targetZ - cr.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3 || cr.stateTimer <= 0) {
        cr.state = 'idle';
        cr.stateTimer = 2 + Math.random() * 3;
      } else {
        const spd = cr.state === 'patrolling' ? cr.speed : cr.speed * 0.6;
        const step = Math.min(spd * dt, dist);
        cr.x += (dx / dist) * step;
        cr.z += (dz / dist) * step;
        cr.direction = Math.atan2(dx, dz);
      }
      break;
    }

    case 'sleeping': {
      if (cr.stateTimer <= 0) {
        cr.state = 'idle';
        cr.stateTimer = 1 + Math.random() * 2;
        if (cr.bodyRef) cr.bodyRef.scale.y = 1;
      }
      // Gentle breathing
      if (cr.bodyRef) {
        cr.bodyRef.scale.y = 0.7 + Math.sin(elapsed * 2) * 0.03;
      }
      break;
    }

    case 'activity': {
      // Fun animations based on activity type
      switch (cr.activityState) {
        case 'chasing_butterflies':
        case 'zoomies':
        case 'hunting': {
          // Quick circles
          const angle = elapsed * 3;
          const r = 1.5;
          cr.targetX = cr.x + Math.cos(angle) * r * dt * 2;
          cr.targetZ = cr.z + Math.sin(angle) * r * dt * 2;
          cr.direction = angle;
          // Small hops
          cr.group.position.y += Math.abs(Math.sin(elapsed * 6)) * 0.15;
          break;
        }
        case 'digging':
        case 'sniffing': {
          // Nose-down bobbing
          cr.group.children[0].rotation.x = Math.sin(elapsed * 5) * 0.15;
          break;
        }
        case 'rolling':
        case 'stretching': {
          // Side-to-side roll
          cr.group.rotation.z = Math.sin(elapsed * 3) * 0.3;
          break;
        }
        case 'pouncing':
        case 'stalking': {
          // Low crouch then hop
          const phase = (elapsed * 2) % 4;
          if (phase < 3) {
            // Crouch
            if (cr.bodyRef) cr.bodyRef.scale.y = 0.6;
          } else {
            // Pounce
            if (cr.bodyRef) cr.bodyRef.scale.y = 1.2;
            cr.group.position.y += 0.3;
          }
          break;
        }
        case 'grooming':
        case 'sitting_watching': {
          // Sit still, small head turns
          cr.direction += Math.sin(elapsed * 1.5) * 0.01;
          break;
        }
        case 'begging':
        case 'tail_wagging': {
          // Energetic bobbing
          cr.group.children[0].position.y = 0.22 + Math.sin(elapsed * 10) * 0.03;
          break;
        }
        case 'napping_sunny':
        case 'napping_shadow': {
          if (cr.bodyRef) cr.bodyRef.scale.y = 0.75;
          break;
        }
        case 'hissing': {
          // Puffed up — scale up slightly
          cr.group.children[0].scale.set(1.15, 1.1, 1.15);
          break;
        }
      }

      if (cr.stateTimer <= 0) {
        // Reset any activity transforms
        cr.group.rotation.z = 0;
        if (cr.bodyRef) {
          cr.bodyRef.scale.set(1, 1, 1);
          cr.bodyRef.rotation.x = 0;
        }
        cr.group.children[0].scale.set(1, 1, 1);
        cr.state = 'idle';
        cr.stateTimer = 2 + Math.random() * 3;
        cr.activityState = null;
      }
      break;
    }
  }
}
