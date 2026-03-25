// Graffiti art — colorful street art decals on building walls
// Invisible when gray, fade in as nearby buildings gain color
// Each graffiti piece is a thin box with a canvas-drawn texture

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';

const graffiti = [];
let colorCheckTimer = 0;

// Graffiti pattern generators — each returns a canvas with pixel art
const PATTERNS = [
  // Heart
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    // Pixel heart
    const rows = [
      [0,0,1,1,0,0,1,1],
      [0,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1],
      [0,0,1,1,1,1,1,0],
      [0,0,0,1,1,1,0,0],
      [0,0,0,0,1,0,0,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4, r * 4 + 4, 4, 4);
    return c;
  },
  // Star
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [0,0,0,1,0,0,0],
      [0,0,1,1,1,0,0],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,1,0,1,0,1,0],
      [1,0,0,0,0,0,1],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4 + 2, r * 4 + 4, 4, 4);
    return c;
  },
  // Cat face
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [1,0,0,0,0,0,1],
      [1,1,0,0,0,1,1],
      [1,1,1,1,1,1,1],
      [1,0,1,0,1,0,1],
      [1,1,1,1,1,1,1],
      [1,0,1,1,1,0,1],
      [0,0,1,0,1,0,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4 + 2, r * 4 + 2, 4, 4);
    return c;
  },
  // Flower
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 5 + 4, r * 5 + 4, 5, 5);
    // Stem
    ctx.fillStyle = '#4A8A4A';
    ctx.fillRect(14, 28, 4, 4);
    ctx.fillRect(14, 24, 4, 4);
    return c;
  },
  // Smiley
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    // Circle outline
    const rows = [
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1],
      [1,0,1,0,0,1,0,1],
      [1,0,0,0,0,0,0,1],
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,1,0,1,0],
      [0,0,1,1,1,1,0,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4, r * 4, 4, 4);
    return c;
  },
  // Peace sign
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [0,0,1,1,1,1,0,0],
      [0,1,0,1,1,0,1,0],
      [1,0,0,1,1,0,0,1],
      [1,0,0,1,1,0,0,1],
      [1,0,1,0,0,1,0,1],
      [1,1,0,0,0,0,1,1],
      [0,1,0,0,0,0,1,0],
      [0,0,1,1,1,1,0,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4, r * 4, 4, 4);
    return c;
  },
  // Music note
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [0,0,0,1,1,1],
      [0,0,0,1,0,1],
      [0,0,0,1,0,1],
      [0,0,0,1,0,1],
      [0,0,0,1,0,0],
      [1,1,0,1,0,0],
      [1,1,1,1,0,0],
      [0,1,1,0,0,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4 + 4, r * 4, 4, 4);
    return c;
  },
  // Bunny
  (color) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    const rows = [
      [0,1,0,0,1,0],
      [0,1,0,0,1,0],
      [0,1,0,0,1,0],
      [1,1,1,1,1,1],
      [1,0,1,1,0,1],
      [1,1,1,1,1,1],
      [0,1,0,0,1,0],
    ];
    for (let r = 0; r < rows.length; r++)
      for (let c2 = 0; c2 < rows[r].length; c2++)
        if (rows[r][c2]) ctx.fillRect(c2 * 4 + 4, r * 4 + 2, 4, 4);
    return c;
  },
];

const GRAFFITI_COLORS = [
  '#FF6B9D', '#C084FC', '#60D5F7', '#34D399',
  '#FBBF24', '#FB923C', '#F87171', '#A78BFA',
  '#38BDF8', '#4ADE80', '#FACC15', '#FB7185',
];

// Placement: wall positions on buildings { x, y, z, rotY, size, district }
// bw = width (X), bd = depth (Z). face: front(+Z), back(-Z), east(+X), west(-X)
const GRAFFITI_DEFS = [
  // Town — on building walls facing streets
  { bx: -7.2, bz: -4.8, bw: 8, bd: 7, bh: 7, face: 'front', district: 'town' },
  { bx: 7.2, bz: -4.8, bw: 8, bd: 7, bh: 8, face: 'front', district: 'town' },
  { bx: -28.8, bz: 1.8, bw: 8, bd: 7, bh: 7, face: 'east', district: 'town' },
  { bx: 19.2, bz: 8.4, bw: 8, bd: 7, bh: 8, face: 'west', district: 'town' },
  { bx: -19.2, bz: 15, bw: 8, bd: 7, bh: 10, face: 'front', district: 'town' },
  { bx: 28.8, bz: 21.6, bw: 8, bd: 7, bh: 8, face: 'west', district: 'town' },
  { bx: -6.6, bz: 21.6, bw: 7, bd: 7, bh: 7, face: 'east', district: 'town' },
  // Downtown — larger walls
  { bx: -7.2, bz: 52.8, bw: 9, bd: 8, bh: 12, face: 'front', district: 'downtown' },
  { bx: 19.2, bz: 54, bw: 9, bd: 8, bh: 10, face: 'west', district: 'downtown' },
  { bx: -21, bz: 68.4, bw: 9, bd: 8, bh: 10, face: 'east', district: 'downtown' },
  { bx: 30, bz: 61.2, bw: 9, bd: 8, bh: 11, face: 'front', district: 'downtown' },
  { bx: 7.2, bz: 74.4, bw: 9, bd: 8, bh: 12, face: 'west', district: 'downtown' },
  // Northtown
  { bx: 63, bz: 81, bw: 8, bd: 7, bh: 8, face: 'front', district: 'northtown' },
  { bx: 80.4, bz: 91.2, bw: 8, bd: 7, bh: 8, face: 'east', district: 'northtown' },
  // Burbs
  { bx: 72, bz: -24, bw: 9, bd: 7, bh: 6, face: 'front', district: 'burbs' },
  { bx: 94.8, bz: -12, bw: 9, bd: 8, bh: 6, face: 'west', district: 'burbs' },
  // More Town
  { bx: -7.2, bz: -4.8, bw: 8, bd: 7, bh: 7, face: 'west', district: 'town' },
  { bx: -28.8, bz: 15, bw: 8, bd: 7, bh: 7, face: 'front', district: 'town' },
  // Uptown
  { bx: 93, bz: 34.8, bw: 9, bd: 7, bh: 12, face: 'front', district: 'uptown' },
  { bx: 100.8, bz: 33, bw: 9, bd: 7, bh: 14, face: 'east', district: 'uptown' },
];

function createGraffitiTexture(patternIndex, colorStr) {
  const canvas = PATTERNS[patternIndex](colorStr);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function createGraffiti(scene) {
  for (let i = 0; i < GRAFFITI_DEFS.length; i++) {
    const def = GRAFFITI_DEFS[i];
    const terrainY = getTerrainHeight(def.bx, def.bz);
    const patternIdx = i % PATTERNS.length;
    const colorStr = GRAFFITI_COLORS[i % GRAFFITI_COLORS.length];
    const tex = createGraffitiTexture(patternIdx, colorStr);

    // Size: 1.2-2.0 units, proportional to building
    const size = 1.2 + (def.bh / 16) * 0.8;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);

    // Position on building wall face
    // front/back faces use bd/2 for Z offset, east/west use bw/2 for X offset
    const hw = def.bw / 2;
    const hd = def.bd / 2;
    const wallY = terrainY + def.bh * 0.45 + (Math.random() - 0.5) * def.bh * 0.2;
    const offset = 0.05; // slight offset from wall to avoid z-fighting

    switch (def.face) {
      case 'front': // +Z face
        mesh.position.set(
          def.bx + (Math.random() - 0.5) * hw * 0.6,
          wallY,
          def.bz + hd + offset
        );
        mesh.rotation.y = 0;
        break;
      case 'back': // -Z face
        mesh.position.set(
          def.bx + (Math.random() - 0.5) * hw * 0.6,
          wallY,
          def.bz - hd - offset
        );
        mesh.rotation.y = Math.PI;
        break;
      case 'east': // +X face
        mesh.position.set(
          def.bx + hw + offset,
          wallY,
          def.bz + (Math.random() - 0.5) * hd * 0.6
        );
        mesh.rotation.y = Math.PI / 2;
        break;
      case 'west': // -X face
        mesh.position.set(
          def.bx - hw - offset,
          wallY,
          def.bz + (Math.random() - 0.5) * hd * 0.6
        );
        mesh.rotation.y = -Math.PI / 2;
        break;
    }

    scene.add(mesh);

    graffiti.push({
      mesh,
      material: mat,
      x: def.bx,
      z: def.bz,
      district: def.district,
      localColor: 0,
    });
  }
}

function refreshGraffitiColors() {
  const buildings = getBuildingColors();
  for (const g of graffiti) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - g.x;
      const dz = b.z - g.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    g.localColor = weight > 0 ? total / weight : 0;
  }
}

export function updateGraffiti(dt) {
  colorCheckTimer += dt;
  if (colorCheckTimer >= 3) {
    colorCheckTimer = 0;
    refreshGraffitiColors();
  }

  for (const g of graffiti) {
    // Fade in: invisible below 0.15, fully visible above 0.6
    const t = Math.max(0, Math.min(1, (g.localColor - 0.15) / 0.45));
    g.material.opacity = t * 0.85; // slightly transparent even at full
  }
}
