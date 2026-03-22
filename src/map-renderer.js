// Shared map renderer — used by both minimap (HUD corner) and phone Map tab
// Renders a 2D top-down view of the city: buildings, roads, NPCs, ACE officers, player

import { getBuildingColors } from './color-system.js';
import { getOfficers, getDetectRange, getDetectConeHalf } from './ace.js';
import { DISTRICTS } from './districts.js';

// Road data (duplicated from roads.js to avoid import issues — these are static)
const MAIN_ROADS = [
  { x: 0, z: 0, w: 8, d: 440 },       // Main Street N-S
  { x: 0, z: 180, w: 440, d: 8 },      // Coast Road E-W
  { x: 150, z: 40, w: 8, d: 360 },     // East Blvd N-S
  { x: -150, z: 30, w: 8, d: 360 },    // West Ave N-S
  { x: 0, z: 50, w: 440, d: 8 },       // Cross Street E-W
  { x: 0, z: -80, w: 400, d: 8 },      // Industrial Rd E-W
];

const SECONDARY_ROADS = [
  // Town internal
  { x: -40, z: 20, w: 5, d: 60 },
  { x: 40, z: 20, w: 5, d: 60 },
  { x: 0, z: -10, w: 80, d: 5 },
  // Downtown internal
  { x: -30, z: 100, w: 5, d: 60 },
  { x: 50, z: 120, w: 5, d: 50 },
  { x: 20, z: 140, w: 80, d: 5 },
  // Northtown
  { x: 130, z: 170, w: 60, d: 5 },
  { x: 110, z: 150, w: 5, d: 50 },
  // Burbs
  { x: 130, z: -20, w: 5, d: 60 },
  { x: 170, z: -40, w: 5, d: 50 },
  { x: 150, z: 0, w: 60, d: 5 },
  // Uptown
  { x: 170, z: 60, w: 5, d: 50 },
  { x: 190, z: 80, w: 5, d: 40 },
  // Tower
  { x: -140, z: 140, w: 60, d: 5 },
  { x: -120, z: 120, w: 5, d: 50 },
  // Industrial
  { x: -40, z: -100, w: 5, d: 50 },
  { x: 50, z: -100, w: 5, d: 50 },
  { x: 20, z: -120, w: 80, d: 5 },
  // Port
  { x: -80, z: 210, w: 60, d: 5 },
  { x: -60, z: 195, w: 5, d: 40 },
  // ACE HQ
  { x: -120, z: -60, w: 5, d: 50 },
  { x: -150, z: -40, w: 40, d: 5 },
];

const ALLEYS = [
  { x: -20, z: 10, w: 2.5, d: 30 },
  { x: 25, z: 30, w: 30, d: 2.5 },
  { x: 10, z: 110, w: 2.5, d: 40 },
  { x: -15, z: 130, w: 35, d: 2.5 },
  { x: 140, z: 160, w: 30, d: 2.5 },
  { x: 160, z: -30, w: 2.5, d: 30 },
  { x: 180, z: 70, w: 2.5, d: 25 },
  { x: -130, z: 130, w: 2.5, d: 35 },
  { x: -155, z: 110, w: 25, d: 2.5 },
  { x: 30, z: -110, w: 2.5, d: 30 },
  { x: -90, z: 205, w: 2.5, d: 25 },
  { x: -135, z: -70, w: 2.5, d: 25 },
];

// District colors for overlay borders
const DISTRICT_COLORS = {
  town:       'rgba(100,200,255,0.12)',
  ruins:      'rgba(160,120,80,0.12)',
  downtown:   'rgba(255,200,100,0.12)',
  burbs:      'rgba(100,255,150,0.12)',
  northtown:  'rgba(150,200,255,0.12)',
  industrial: 'rgba(200,150,100,0.12)',
  uptown:     'rgba(255,180,220,0.12)',
  tower:      'rgba(180,150,255,0.12)',
  port:       'rgba(100,180,200,0.12)',
  aceHQ:      'rgba(255,100,100,0.12)',
};

/**
 * Render the map to a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasW - canvas pixel width
 * @param {number} canvasH - canvas pixel height
 * @param {object} camera - { centerX, centerZ, worldRange }
 *   centerX/centerZ = world coords at canvas center
 *   worldRange = how many world units from center to canvas edge
 * @param {object} player - { x, z, yaw }
 * @param {Array} npcs - array of NPC refs
 * @param {object} opts - optional rendering flags
 *   opts.showLabels      - show district labels (default true)
 *   opts.showNPCNames    - show NPC initials (default false for minimap, true for phone)
 *   opts.showDistrictOverlays - show district boundary circles (default false)
 *   opts.showLockInfo    - show lock icons / deal counts (default false)
 *   opts.showColorPercent - show district color % (default false)
 *   opts.showApartment   - show apartment marker (default false)
 *   opts.activeWaypoints - array of { pos: [x,y,z] } for pulsing waypoint markers
 *   opts.metNPCs         - Set of NPC names the player has interacted with (for filtering)
 *   opts.labelSize       - font size for labels (default 8)
 *   opts.dotSize         - base dot size (default 3)
 *   opts.dirLen           - direction indicator length in world units (default 8)
 */
export function renderMap(ctx, canvasW, canvasH, camera, player, npcs, opts = {}) {
  const { centerX, centerZ, worldRange } = camera;
  const halfW = canvasW / 2;
  const halfH = canvasH / 2;
  const scaleX = halfW / worldRange;
  const scaleZ = halfH / worldRange;

  // World-to-canvas coordinate conversion
  function toMap(wx, wz) {
    return [
      halfW + (wx - centerX) * scaleX,
      halfH + (wz - centerZ) * scaleZ,
    ];
  }

  const {
    showLabels = true,
    showNPCNames = false,
    showDistrictOverlays = false,
    showLockInfo = false,
    showColorPercent = false,
    showApartment = false,
    activeWaypoints = null,
    metNPCs = null,
    labelSize = 8,
    dotSize = 3,
    dirLen = 8,
  } = opts;

  // Clear
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = 'rgba(10,10,18,0.01)';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // --- Water (north side, Z > 220) ---
  const [wx1, wz1] = toMap(-300, 220);
  const [wx2, wz2] = toMap(300, 420);
  if (wz1 < canvasH && wz2 > 0) {
    ctx.fillStyle = 'rgba(90,122,138,0.3)';
    ctx.fillRect(
      Math.max(0, wx1), Math.max(0, wz1),
      Math.min(canvasW, wx2) - Math.max(0, wx1),
      Math.min(canvasH, wz2) - Math.max(0, wz1)
    );
  }

  // --- Ruins area (south, Z < -150) ---
  const [rx1, rz1] = toMap(-300, -350);
  const [rx2, rz2] = toMap(300, -150);
  if (rz2 > 0 && rz1 < canvasH) {
    ctx.fillStyle = 'rgba(120,90,60,0.15)';
    ctx.fillRect(
      Math.max(0, rx1), Math.max(0, rz1),
      Math.min(canvasW, rx2) - Math.max(0, rx1),
      Math.min(canvasH, rz2) - Math.max(0, rz1)
    );
  }

  // --- District overlays ---
  if (showDistrictOverlays) {
    for (const [key, d] of Object.entries(DISTRICTS)) {
      const [cx, cz] = toMap(d.center.x, d.center.z);
      const radiusPx = d.radius * scaleX;
      if (cx + radiusPx < 0 || cx - radiusPx > canvasW || cz + radiusPx < 0 || cz - radiusPx > canvasH) continue;

      ctx.save();
      ctx.globalAlpha = d.unlocked ? 0.5 : 0.25;
      ctx.fillStyle = DISTRICT_COLORS[key] || 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(cx, cz, radiusPx, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = d.unlocked
        ? (DISTRICT_COLORS[key] || 'rgba(255,255,255,0.1)').replace(/[\d.]+\)$/, '0.3)')
        : 'rgba(100,100,100,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- Roads ---
  // Main roads (thicker)
  ctx.strokeStyle = 'rgba(80,80,80,0.5)';
  for (const road of MAIN_ROADS) {
    const [rx, rz] = toMap(road.x, road.z);
    const rw = road.w * scaleX;
    const rd = road.d * scaleZ;
    ctx.fillStyle = 'rgba(70,70,70,0.4)';
    ctx.fillRect(rx - rw / 2, rz - rd / 2, rw, rd);
  }
  // Secondary roads
  for (const road of SECONDARY_ROADS) {
    const [rx, rz] = toMap(road.x, road.z);
    const rw = road.w * scaleX;
    const rd = road.d * scaleZ;
    ctx.fillStyle = 'rgba(65,65,65,0.3)';
    ctx.fillRect(rx - rw / 2, rz - rd / 2, rw, rd);
  }
  // Alleys (thinnest)
  for (const road of ALLEYS) {
    const [rx, rz] = toMap(road.x, road.z);
    const rw = road.w * scaleX;
    const rd = road.d * scaleZ;
    ctx.fillStyle = 'rgba(60,60,60,0.25)';
    ctx.fillRect(rx - rw / 2, rz - rd / 2, rw, rd);
  }

  // --- Buildings ---
  const buildings = getBuildingColors();
  const gray = [128, 128, 128];
  for (const b of buildings) {
    if (!b.mesh.visible) continue;
    const [mx, mz] = toMap(b.x, b.z);
    if (mx < -20 || mx > canvasW + 20 || mz < -20 || mz > canvasH + 20) continue;
    const bw = Math.max(2, b.mesh.geometry.parameters.width * scaleX);
    const bd = Math.max(2, b.mesh.geometry.parameters.depth * scaleZ);
    const t = b.displayAmount;
    const tr = b.targetColor.r * 255, tg = b.targetColor.g * 255, tb = b.targetColor.b * 255;
    const r = Math.round(gray[0] + (tr - gray[0]) * t);
    const g = Math.round(gray[1] + (tg - gray[1]) * t);
    const bl = Math.round(gray[2] + (tb - gray[2]) * t);
    ctx.fillStyle = `rgb(${r},${g},${bl})`;
    ctx.fillRect(mx - bw / 2, mz - bd / 2, bw, bd);
  }

  // --- District labels ---
  if (showLabels) {
    ctx.font = `${labelSize}px monospace`;
    ctx.textAlign = 'center';
    for (const [key, d] of Object.entries(DISTRICTS)) {
      const [lx, lz] = toMap(d.center.x, d.center.z);
      if (lx < -20 || lx > canvasW + 20 || lz < -20 || lz > canvasH + 20) continue;

      if (!d.unlocked) {
        if (showLockInfo) {
          // Dimmed name + lock icon
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillText(`🔒 ${d.name}`, lx, lz);
          // Deal count needed
          ctx.font = `${Math.max(7, labelSize - 2)}px monospace`;
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillText(`${d.unlockDeals} deals to unlock`, lx, lz + labelSize + 2);
          ctx.font = `${labelSize}px monospace`;
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        let label = d.name;
        if (showColorPercent) {
          const pct = getDistrictColorPercent(key);
          label += ` — ${pct}%`;
        }
        ctx.fillText(label, lx, lz);
      }
    }
  }

  // --- Apartment marker ---
  if (showApartment) {
    // Player apartment is at approximately (0, 20) — Town center area
    const [ax, az] = toMap(0, 20);
    if (ax > 0 && ax < canvasW && az > 0 && az < canvasH) {
      ctx.fillStyle = 'rgba(100,200,255,0.7)';
      ctx.font = `${Math.max(10, labelSize)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('🏠', ax, az);
    }
  }

  // --- Active waypoint (pulsing yellow diamond) ---
  if (activeWaypoints && activeWaypoints.length > 0) {
    const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.4;
    for (const wp of activeWaypoints) {
      const [wpx, wpz] = toMap(wp.pos[0], wp.pos[2]);
      if (wpx < 0 || wpx > canvasW || wpz < 0 || wpz > canvasH) continue;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffcc00';
      // Diamond shape
      const ds = dotSize + 2;
      ctx.beginPath();
      ctx.moveTo(wpx, wpz - ds);
      ctx.lineTo(wpx + ds, wpz);
      ctx.lineTo(wpx, wpz + ds);
      ctx.lineTo(wpx - ds, wpz);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // --- NPCs (with activity-based status colors) ---
  if (npcs) {
    for (const npc of npcs) {
      // Filter by met NPCs if provided
      if (metNPCs && !metNPCs.has(npc.name)) continue;

      const [mx, mz] = toMap(npc.worldPos.x, npc.worldPos.z);
      if (mx < -10 || mx > canvasW + 10 || mz < -10 || mz > canvasH + 10) continue;

      // Determine NPC dot color based on status
      let dotColor, nameColor;
      const dimmed = !npc.group.visible || !npc.isAvailable;

      if (dimmed) {
        // At home / unavailable — show dimmed at home position
        const [hx, hz] = toMap(npc.homePos.x, npc.homePos.z);
        if (hx < -10 || hx > canvasW + 10 || hz < -10 || hz > canvasH + 10) continue;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#556';
        ctx.beginPath();
        ctx.arc(hx, hz, dotSize - 1, 0, Math.PI * 2);
        ctx.fill();
        if (showNPCNames) {
          ctx.fillStyle = 'rgba(100,100,120,0.4)';
          ctx.font = `bold ${Math.max(8, labelSize - 1)}px monospace`;
          ctx.textAlign = 'left';
          ctx.fillText(npc.name[0], hx + dotSize + 1, hz + 3);
        }
        ctx.globalAlpha = 1;
        continue;
      }

      if (npc.isWalking) {
        dotColor = '#ca6'; // yellow-orange — walking
        nameColor = 'rgba(204,170,102,0.8)';
      } else if (npc.currentActivity === 'sitting' || npc.currentActivity === 'eating') {
        dotColor = '#6cf'; // blue — stationary activity
        nameColor = 'rgba(102,204,255,0.8)';
      } else {
        dotColor = '#4a7'; // green — available
        nameColor = 'rgba(68,170,119,0.8)';
      }

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(mx, mz, dotSize, 0, Math.PI * 2);
      ctx.fill();

      if (showNPCNames) {
        ctx.fillStyle = nameColor;
        ctx.font = `bold ${Math.max(8, labelSize - 1)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(npc.name[0], mx + dotSize + 2, mz + 3);
      }
    }
  }

  // --- ACE officers ---
  const officers = getOfficers();
  if (officers && officers.length > 0) {
    const detectRange = getDetectRange();
    const coneHalf = getDetectConeHalf();
    const conePixelLen = detectRange * scaleX;

    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      const [omx, omz] = toMap(o.group.position.x, o.group.position.z);
      if (omx < -30 || omx > canvasW + 30 || omz < -30 || omz > canvasH + 30) continue;
      const facing = o.group.rotation.y;

      // Detection cone
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = o.state === 'ALERT' || o.state === 'CHASE' ? '#ff4444' : '#e55';
      ctx.beginPath();
      ctx.moveTo(omx, omz);
      const startAngle = facing - coneHalf;
      const endAngle = facing + coneHalf;
      const arcSteps = 12;
      for (let i = 0; i <= arcSteps; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / arcSteps);
        const dx = Math.sin(a) * conePixelLen;
        const dz = Math.cos(a) * conePixelLen;
        ctx.lineTo(omx + dx, omz + dz);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Officer dot
      ctx.fillStyle = o.state === 'CHASE' ? '#ff2222' : '#e55';
      ctx.beginPath();
      ctx.arc(omx, omz, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Player ---
  const [pmx, pmz] = toMap(player.x, player.z);
  const yaw = player.yaw;

  // Direction triangle
  const triSize = dotSize + 2;
  const dirWorldLen = dirLen;
  const tipX = pmx + (-Math.sin(yaw) * dirWorldLen * scaleX);
  const tipZ = pmz + (-Math.cos(yaw) * dirWorldLen * scaleZ);
  const leftX = pmx + Math.sin(yaw + 2.5) * triSize;
  const leftZ = pmz + Math.cos(yaw + 2.5) * triSize;
  const rightX = pmx + Math.sin(yaw - 2.5) * triSize;
  const rightZ = pmz + Math.cos(yaw - 2.5) * triSize;

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(tipX, tipZ);
  ctx.lineTo(leftX, leftZ);
  ctx.lineTo(rightX, rightZ);
  ctx.closePath();
  ctx.fill();

  // Player dot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pmx, pmz, dotSize + 1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Calculate color percentage for a district.
 */
function getDistrictColorPercent(districtKey) {
  const d = DISTRICTS[districtKey];
  if (!d) return 0;
  const buildings = getBuildingColors();
  let total = 0, count = 0;
  for (const b of buildings) {
    const dx = b.x - d.center.x;
    const dz = b.z - d.center.z;
    if (Math.sqrt(dx * dx + dz * dz) <= d.radius * 1.2) {
      total += b.displayAmount;
      count++;
    }
  }
  return count > 0 ? Math.round((total / count) * 100) : 0;
}
