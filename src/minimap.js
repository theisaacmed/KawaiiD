// Mini-map — top-down view showing buildings, player, NPCs, ACE officers
// Uses shared map-renderer for consistent rendering with phone Map tab

import { renderMap } from './map-renderer.js';

const SIZE = 200;
const WORLD_RANGE = 280; // units from center to edge shown on minimap

let canvas = null;
let ctx = null;
let playerRef = null;
let npcsRef = null;

export function initMinimap(player, npcs) {
  playerRef = player;
  npcsRef = npcs;

  canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.id = 'minimap';
  Object.assign(canvas.style, {
    position: 'fixed', bottom: '16px', right: '16px',
    width: SIZE + 'px', height: SIZE + 'px',
    borderRadius: '12px',
    background: 'rgba(10,10,18,0.7)',
    border: '1px solid rgba(255,255,255,0.12)',
    zIndex: '150', pointerEvents: 'none',
    imageRendering: 'pixelated',
  });
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
}

export function updateMinimap() {
  if (!ctx || !playerRef) return;

  const camera = {
    centerX: playerRef.position.x,
    centerZ: playerRef.position.z,
    worldRange: WORLD_RANGE,
  };

  const player = {
    x: playerRef.position.x,
    z: playerRef.position.z,
    yaw: playerRef.yaw,
  };

  renderMap(ctx, SIZE, SIZE, camera, player, npcsRef, {
    showLabels: true,
    showNPCNames: false,
    showDistrictOverlays: false,
    showLockInfo: false,
    showColorPercent: false,
    showApartment: false,
    labelSize: 8,
    dotSize: 3,
    dirLen: 8,
  });
}
