// ACE (Anti-Cuteness Enforcement) officers
// Day: stationary checkpoint guards with scanning head sweep
// Night: roaming patrols with flashlights
// States: CHECKPOINT | PATROL | ALERT | CHASE | RETURNING | TRANSITIONING

import * as THREE from 'three';
import { getSlots, clearInventory, deductMoney } from './inventory.js';
import { isDealOpen } from './dealing.js';
import { getGameHour, isNight, getDaylightFactor, getTimePeriod } from './time-system.js';

// Callback for save system (avoids circular import)
let onCaughtCallback = null;
export function setOnCaughtCallback(fn) { onCaughtCallback = fn; }

// Callback fired when player successfully escapes a chase (all officers give up)
let onEscapeCallback = null;
export function setOnEscapeCallback(fn) { onEscapeCallback = fn; }

// Returns true if any officer is within range units of the player
export function isAnyOfficerWithinRange(range) {
  if (!playerRef) return false;
  const px = playerRef.position.x, pz = playerRef.position.z;
  const r2 = range * range;
  for (const o of officers) {
    const dx = o.group.position.x - px;
    const dz = o.group.position.z - pz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

// --- Constants ---
const PLAYER_WALK_SPEED = 5;

// Day (checkpoint) settings
const DAY_DETECT_RANGE = 14;
const DAY_CONE_HALF = Math.PI / 6;      // 30° each side = 60° total
const DAY_ALERT_DURATION = 3.0;
const DAY_CHASE_SPEED = PLAYER_WALK_SPEED * 1.1;
const DAY_CHASE_GIVE_UP = 20;

// Night (patrol) settings
const NIGHT_DETECT_RANGE = 12;
const NIGHT_CONE_HALF = Math.PI / 8;    // 22.5° each side = 45° total
const NIGHT_ALERT_DURATION = 2.0;
const NIGHT_CHASE_SPEED = PLAYER_WALK_SPEED * 1.3;
const NIGHT_CHASE_GIVE_UP = 30;
const NIGHT_PATROL_SPEED = PLAYER_WALK_SPEED * 0.5;
const NIGHT_PAUSE_DURATION = 2.5;

// Common
const CATCH_DIST = 2;
const FINE_AMOUNT = 30;
const GRACE_PERIOD = 15;
const ROTATE_SPEED = 3;
const TRANSITION_SPEED = PLAYER_WALK_SPEED * 0.4;
const RUINS_Z = -150;
const OFFICER_RADIUS = 0.5;

// Scanning
const SCAN_SPEED = 0.8;
const SCAN_AMPLITUDE = Math.PI / 4;

// Building data for LOS and collision — Town district buildings
// This is updated dynamically via addBuildingsForLOS
let BUILDINGS = [
  // Town buildings (starting area)
  { x: -18, z: -6, w: 6, d: 5, h: 3.5 },
  { x: -12, z: -7.2, w: 5, d: 4, h: 4.0 },
  { x: -6, z: -4.8, w: 4, d: 5, h: 3.0 },
  { x: 6, z: -6, w: 5, d: 4, h: 3.5 },
  { x: 12, z: -7.2, w: 4, d: 5, h: 4.5 },
  { x: 18, z: -4.8, w: 5, d: 4, h: 3.0 },
  { x: -21, z: 6, w: 5, d: 6, h: 4.0 },
  { x: -13.2, z: 7.2, w: 4, d: 5, h: 3.5 },
  { x: -7.2, z: 4.8, w: 5, d: 4, h: 5.0 },
  { x: 7.2, z: 6, w: 4, d: 5, h: 3.5 },
  { x: 13.2, z: 4.8, w: 5, d: 4, h: 4.0 },
  { x: 21, z: 7.2, w: 4, d: 5, h: 3.0 },
  { x: -16.8, z: 21, w: 5, d: 4, h: 4.5 },
  { x: -9, z: 19.2, w: 4, d: 5, h: 3.5 },
  { x: -3, z: 22.8, w: 5, d: 4, h: 4.0 },
  { x: 9, z: 21, w: 4, d: 5, h: 3.0 },
  { x: 15, z: 19.2, w: 5, d: 4, h: 5.0 },
  { x: 22.8, z: 22.8, w: 4, d: 5, h: 3.5 },
];

// Checkpoint positions (daytime posts) — positioned at district entrances
const CHECKPOINTS = [
  // Officer 1: Main Street between Town and Downtown (blocks Downtown)
  { pos: new THREE.Vector3(0, 0, 39), facing: Math.PI },
  // Officer 2: Cross Street eastern edge (blocks Burbs)
  { pos: new THREE.Vector3(57, 0, 30), facing: Math.PI / 2 },
  // Officer 3: Roaming patrol within Town (the only one in starting area)
  { pos: new THREE.Vector3(-9, 0, 12), facing: 0 },
];

// Night patrol routes — within Town area
const NIGHT_ROUTES = [
  // Officer 1: north side of town
  [
    new THREE.Vector3(-12, 0, -6), new THREE.Vector3(6, 0, -6),
    new THREE.Vector3(12, 0, 0), new THREE.Vector3(6, 0, 6),
    new THREE.Vector3(-6, 0, 6), new THREE.Vector3(-12, 0, 0),
  ],
  // Officer 2: east side patrol
  [
    new THREE.Vector3(18, 0, 0), new THREE.Vector3(21, 0, 9),
    new THREE.Vector3(18, 0, 18), new THREE.Vector3(12, 0, 21),
    new THREE.Vector3(6, 0, 18), new THREE.Vector3(9, 0, 9),
  ],
  // Officer 3: south/west patrol
  [
    new THREE.Vector3(-18, 0, 6), new THREE.Vector3(-18, 0, 18),
    new THREE.Vector3(-9, 0, 22.8), new THREE.Vector3(0, 0, 21),
    new THREE.Vector3(0, 0, 12), new THREE.Vector3(-9, 0, 6),
  ],
];

// --- Audio ---
let audioCtx = null;
let chaseOsc = null, chaseOsc2 = null, chaseGainNode = null;
let proximityOsc = null, proximityGain = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playAlertSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.4);
}

function playWhistleSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.45);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5);
}

function startChaseSound() {
  if (chaseOsc) return;
  const ctx = getAudioCtx();
  chaseGainNode = ctx.createGain(); chaseGainNode.gain.value = 0.08;
  chaseGainNode.connect(ctx.destination);
  chaseOsc = ctx.createOscillator(); chaseOsc.type = 'sawtooth'; chaseOsc.frequency.value = 80;
  chaseOsc.connect(chaseGainNode); chaseOsc.start();
  chaseOsc2 = ctx.createOscillator(); chaseOsc2.type = 'square'; chaseOsc2.frequency.value = 120;
  const g2 = ctx.createGain(); g2.gain.value = 0.04;
  chaseOsc2.connect(g2).connect(ctx.destination); chaseOsc2.start();
}

function stopChaseSound() {
  if (chaseOsc) { chaseOsc.stop(); chaseOsc = null; }
  if (chaseOsc2) { chaseOsc2.stop(); chaseOsc2 = null; }
  chaseGainNode = null;
}

function playCaughtSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.6);
}

function initProximitySound() {
  const ctx = getAudioCtx();
  proximityGain = ctx.createGain(); proximityGain.gain.value = 0;
  proximityGain.connect(ctx.destination);
  proximityOsc = ctx.createOscillator(); proximityOsc.type = 'sine'; proximityOsc.frequency.value = 55;
  proximityOsc.connect(proximityGain); proximityOsc.start();
}

function updateProximitySound(minDist) {
  if (!proximityGain) return;
  const t = Math.max(0, 1 - minDist / 15);
  proximityGain.gain.value = t * t * 0.06;
}

// --- HUD overlays ---
let vignetteEl = null, bustedOverlay = null;

function createACEHud() {
  vignetteEl = document.createElement('div');
  Object.assign(vignetteEl.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '80',
    opacity: '0', transition: 'opacity 0.3s',
    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(200,30,30,0.4) 100%)',
  });
  document.body.appendChild(vignetteEl);

  bustedOverlay = document.createElement('div');
  Object.assign(bustedOverlay.style, {
    position: 'fixed', inset: '0', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', pointerEvents: 'none',
    zIndex: '350', opacity: '0', transition: 'opacity 0.3s', background: 'rgba(180,20,20,0.0)',
  });
  bustedOverlay.innerHTML = `
    <div style="font-family:monospace;font-size:36px;font-weight:bold;color:#fff;text-shadow:0 0 20px rgba(255,60,60,0.8);letter-spacing:3px">BUSTED!</div>
    <div style="font-family:monospace;font-size:16px;color:#faa;margin-top:12px">ACE confiscated your cute contraband.</div>
  `;
  document.body.appendChild(bustedOverlay);
}

function showVignette(pulse) {
  vignetteEl.style.opacity = String(0.3 + 0.15 * Math.sin(pulse * Math.PI * 2) + 0.2);
}
function hideVignette() { vignetteEl.style.opacity = '0'; }
function showBusted() {
  bustedOverlay.style.background = 'rgba(200,20,20,0.6)'; bustedOverlay.style.opacity = '1';
  setTimeout(() => { bustedOverlay.style.background = 'rgba(200,20,20,0.0)'; }, 300);
  setTimeout(() => { bustedOverlay.style.opacity = '0'; }, 2000);
}

// --- Sprite helpers ---
function makeACELabel() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const x = c.getContext('2d');
  x.font = 'bold 28px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(180,20,20,0.75)'; x.beginPath(); x.roundRect(29, 7, 70, 34, 8); x.fill();
  x.fillStyle = '#E24B4A'; x.fillText('ACE', 64, 24);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(1.6, 0.6, 1); return s;
}

function makeAlertIcon() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 48px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#E24B4A'; x.fillText('!', 32, 32);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.6, 0.6, 1); s.visible = false; return s;
}

// --- Officer mesh creation ---
function createOfficerMesh(scene) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2C2C2A });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12), bodyMat);
  body.position.y = 1.0; body.castShadow = true; group.add(body);
  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), bodyMat);
  bc.position.y = 0.3; bc.castShadow = true; group.add(bc);
  const tc = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), bodyMat);
  tc.position.y = 1.7; tc.castShadow = true; group.add(tc);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x3A3A38 }));
  head.position.y = 2.1; head.castShadow = true; group.add(head);

  const label = makeACELabel(); label.position.y = 2.7; group.add(label);
  const alertIcon = makeAlertIcon(); alertIcon.position.y = 3.1; group.add(alertIcon);
  const aura = new THREE.PointLight(0xE24B4A, 0.3, 8); aura.position.y = 1.0; group.add(aura);

  // Flashlight SpotLight (night only)
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -0.5, 16);
  group.add(spotTarget);
  const spotLight = new THREE.SpotLight(0xFFF8E0, 0, 22, Math.PI / 8, 0.4, 1.5);
  spotLight.position.set(0, 1.8, 0);
  spotLight.target = spotTarget;
  group.add(spotLight);

  // Visible flashlight cone mesh
  const coneLen = 16;
  const coneRad = coneLen * Math.tan(Math.PI / 8);
  const coneGeo = new THREE.ConeGeometry(coneRad, coneLen, 16, 1, true);
  coneGeo.translate(0, -coneLen / 2, 0);
  coneGeo.rotateX(Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xFFF8E0, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.position.set(0, 1.5, 0);
  coneMesh.visible = false;
  group.add(coneMesh);

  scene.add(group);
  return { group, body, alertIcon, aura, spotLight, spotTarget, coneMesh };
}

// --- State ---
let officers = [];
let playerRef = null;
let graceCooldown = 0;
let anyChasing = false;
let chasePulse = 0;
let currentMode = 'day';
let proximityStarted = false;

export function createACEOfficers(scene) {
  createACEHud();
  for (let i = 0; i < CHECKPOINTS.length; i++) {
    const cp = CHECKPOINTS[i];
    const mesh = createOfficerMesh(scene);
    mesh.group.position.copy(cp.pos);
    mesh.group.rotation.y = cp.facing;
    officers.push({
      index: i, ...mesh,
      checkpointPos: cp.pos.clone(), checkpointFacing: cp.facing,
      patrolRoute: NIGHT_ROUTES[i], waypointIndex: 0, pauseTimer: 0,
      state: 'CHECKPOINT', alertTimer: 0,
      scanTime: Math.random() * 10, swayTime: Math.random() * 10,
      chaseLostTimer: 0, lastKnownPos: null, chaseStartPos: null,
    });
  }
  return officers;
}

export function initACE(player) { playerRef = player; }
export function getOfficers() { return officers; }

// Enable officer at specific index (for district unlocks)
export function enableEastsideOfficer() {
  // No-op for backwards compatibility — officers are now always enabled
}

// Add building data for LOS and collision
export function addEastsideBuildings(blocks) {
  for (const b of blocks) {
    BUILDINGS.push(b);
  }
}

// Add buildings dynamically for LOS checks
export function addBuildingsForLOS(blocks) {
  for (const b of blocks) {
    BUILDINGS.push(b);
  }
}

// --- LOS ---
function hasLineOfSight(fromPos, toPos) {
  for (const b of BUILDINGS) {
    if (lineIntersectsAABB(fromPos.x, fromPos.z, toPos.x, toPos.z,
        b.x - b.w/2, b.z - b.d/2, b.x + b.w/2, b.z + b.d/2)) return false;
  }
  return true;
}

function lineIntersectsAABB(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  let tMin = 0, tMax = 1;
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) < 1e-8) { if (x1 < minX || x1 > maxX) return false; }
  else {
    let t1 = (minX - x1) / dx, t2 = (maxX - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-8) { if (y1 < minY || y1 > maxY) return false; }
  else {
    let t1 = (minY - y1) / dy, t2 = (maxY - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

function isInCone(officer, playerPos, coneHalf) {
  const oPos = officer.group.position;
  const angle = Math.atan2(playerPos.x - oPos.x, playerPos.z - oPos.z);
  let diff = angle - officer.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < coneHalf;
}

function distBetween(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function playerHasItems() { return getSlots().length > 0; }

// --- Movement ---
function collidesWithBuilding(x, z) {
  for (const b of BUILDINGS) {
    if (x >= b.x - b.w/2 - OFFICER_RADIUS && x <= b.x + b.w/2 + OFFICER_RADIUS &&
        z >= b.z - b.d/2 - OFFICER_RADIUS && z <= b.z + b.d/2 + OFFICER_RADIUS) return true;
  }
  return false;
}

function rotateToward(officer, targetX, targetZ, dt) {
  const oPos = officer.group.position;
  const targetAngle = Math.atan2(targetX - oPos.x, targetZ - oPos.z);
  let diff = targetAngle - officer.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = ROTATE_SPEED * dt;
  if (Math.abs(diff) < step) officer.group.rotation.y = targetAngle;
  else officer.group.rotation.y += Math.sign(diff) * step;
}

function moveToward(officer, target, speed, dt) {
  const pos = officer.group.position;
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.3) return true;
  const step = speed * dt;
  let mx, mz;
  if (step >= dist) { mx = target.x; mz = target.z; }
  else { mx = pos.x + (dx / dist) * step; mz = pos.z + (dz / dist) * step; }
  if (mz > RUINS_Z - 2) mz = RUINS_Z - 2;
  if (!collidesWithBuilding(mx, mz)) { pos.x = mx; pos.z = mz; }
  else if (!collidesWithBuilding(mx, pos.z)) pos.x = mx;
  else if (!collidesWithBuilding(pos.x, mz)) pos.z = mz;
  rotateToward(officer, target.x, target.z, dt);
  return step >= dist && !collidesWithBuilding(target.x, target.z);
}

function nearestWaypointIndex(officer) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < officer.patrolRoute.length; i++) {
    const d = distBetween(officer.group.position, officer.patrolRoute[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// --- Caught ---
function onCaught(officer) {
  stopChaseSound(); hideVignette(); playCaughtSound();
  clearInventory(); deductMoney(FINE_AMOUNT); showBusted();
  playerRef.position.set(0, 1.7, 0); playerRef.velocity.set(0, 0, 0);
  graceCooldown = GRACE_PERIOD;
  if (onCaughtCallback) onCaughtCallback();

  officer.state = 'RETURNING'; officer.alertTimer = 0;
  officer.alertIcon.visible = false; officer.body.rotation.x = 0;
  officer.chaseLostTimer = 0; officer.lastKnownPos = null; officer.chaseStartPos = null;

  for (const o of officers) {
    if (o !== officer && o.state === 'CHASE') {
      o.state = 'RETURNING'; o.alertIcon.visible = false; o.body.rotation.x = 0;
      o.chaseLostTimer = 0; o.lastKnownPos = null; o.chaseStartPos = null;
    }
  }
  anyChasing = false;
}

// --- Mode transitions ---
function setFlashlight(o, on) {
  o.spotLight.intensity = on ? 2.0 : 0;
  o.coneMesh.visible = on;
}

// Lunch break: 12 PM – 1 PM, officer index 1 goes off-route
let lunchActive = false;

function updateMode() {
  const night = isNight();
  const hour = getGameHour();
  const period = getTimePeriod();
  const isDusk = period === 'dusk';
  const isDawn = period === 'dawn';

  if (isDusk && currentMode === 'day') {
    currentMode = 'to_night';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'CHECKPOINT') { o.state = 'TRANSITIONING'; o.waypointIndex = 0; }
    }
  } else if (isDawn && currentMode === 'night') {
    currentMode = 'to_day';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'PATROL') o.state = 'TRANSITIONING';
    }
  } else if (night && !isDusk && currentMode === 'to_night') {
    currentMode = 'night';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'TRANSITIONING') {
        o.state = 'PATROL'; o.waypointIndex = nearestWaypointIndex(o); o.pauseTimer = 0;
      }
      setFlashlight(o, true);
    }
  } else if (!night && !isDawn && currentMode === 'to_day') {
    currentMode = 'day';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'TRANSITIONING') {
        o.state = 'CHECKPOINT';
        o.group.position.copy(o.checkpointPos);
        o.group.rotation.y = o.checkpointFacing;
      }
      setFlashlight(o, false);
    }
  }

  // Sync on load: if mode doesn't match time
  if (currentMode === 'day' && night && !isDawn) {
    currentMode = 'night';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'CHECKPOINT') {
        o.state = 'PATROL'; o.waypointIndex = nearestWaypointIndex(o);
      }
      setFlashlight(o, true);
    }
  } else if (currentMode === 'night' && !night && !isDusk) {
    currentMode = 'day';
    for (const o of officers) {
      if (o.state === 'DISABLED') continue;
      if (o.state === 'PATROL') {
        o.state = 'CHECKPOINT';
        o.group.position.copy(o.checkpointPos);
        o.group.rotation.y = o.checkpointFacing;
      }
      setFlashlight(o, false);
    }
  }

  // Lunch break: 12 PM – 1 PM, officer index 1 pauses at their checkpoint (effectively off-route)
  if (currentMode === 'day') {
    const lunchNow = hour >= 12 && hour < 13;
    if (lunchNow && !lunchActive) {
      lunchActive = true;
      // Officer 1 goes to a far corner (off their checkpoint)
      const lunchOfficer = officers[1];
      if (lunchOfficer && lunchOfficer.state === 'CHECKPOINT') {
        lunchOfficer.state = 'TRANSITIONING';
        // Temporarily move checkpoint to a corner
        lunchOfficer._savedCheckpoint = lunchOfficer.checkpointPos.clone();
        lunchOfficer.checkpointPos = new THREE.Vector3(18, 0, 20);
      }
    } else if (!lunchNow && lunchActive) {
      lunchActive = false;
      // Restore officer 1
      const lunchOfficer = officers[1];
      if (lunchOfficer && lunchOfficer._savedCheckpoint) {
        lunchOfficer.checkpointPos = lunchOfficer._savedCheckpoint;
        lunchOfficer._savedCheckpoint = null;
        if (lunchOfficer.state === 'TRANSITIONING') lunchOfficer.state = 'CHECKPOINT';
        lunchOfficer.group.position.copy(lunchOfficer.checkpointPos);
        lunchOfficer.group.rotation.y = CHECKPOINTS[1].facing;
      }
    }
  }
}

// --- Detection check ---
function checkDetection(officer, playerPos, playerInRuins, dealOpen) {
  if (typeof window.__adminGodMode === 'function' && window.__adminGodMode()) return false;
  if (graceCooldown > 0 || playerInRuins || dealOpen || !playerHasItems()) return false;
  if (officer.state === 'TRANSITIONING' || officer.state === 'RETURNING') return false;
  const nightMode = currentMode === 'night' || currentMode === 'to_night';
  const range = nightMode ? NIGHT_DETECT_RANGE : DAY_DETECT_RANGE;
  const cone = nightMode ? NIGHT_CONE_HALF : DAY_CONE_HALF;
  const dist = distBetween(officer.group.position, playerPos);
  if (dist >= range) return false;
  if (!isInCone(officer, playerPos, cone)) return false;
  if (!hasLineOfSight(officer.group.position, playerPos)) return false;
  return true;
}

// --- Main update ---
export function updateACE(dt) {
  if (!playerRef) return;

  if (!proximityStarted && audioCtx) { initProximitySound(); proximityStarted = true; }
  if (graceCooldown > 0) graceCooldown -= dt;

  updateMode();

  const playerPos = playerRef.position;
  const playerInRuins = playerPos.z > RUINS_Z;
  const dealOpen = isDealOpen();
  const nightMode = currentMode === 'night' || currentMode === 'to_night';
  anyChasing = false;
  let minDist = Infinity;

  for (const officer of officers) {
    // Skip disabled officers (Eastside officer before unlock)
    if (officer.state === 'DISABLED') continue;

    const oDist = distBetween(officer.group.position, playerPos);
    if (oDist < minDist) minDist = oDist;

    switch (officer.state) {
      case 'CHECKPOINT': {
        officer.scanTime += dt;
        officer.swayTime += dt;
        officer.group.rotation.y = officer.checkpointFacing +
          Math.sin(officer.scanTime * SCAN_SPEED) * SCAN_AMPLITUDE;
        officer.body.position.x = Math.sin(officer.swayTime * 0.7) * 0.03;
        if (checkDetection(officer, playerPos, playerInRuins, dealOpen)) {
          officer.state = 'ALERT'; officer.alertTimer = 0;
          officer.alertIcon.visible = true; playAlertSound();
        }
        break;
      }

      case 'PATROL': {
        if (officer.pauseTimer > 0) {
          officer.pauseTimer -= dt;
          officer.scanTime += dt;
          officer.group.rotation.y += Math.sin(officer.scanTime * 1.5) * dt * 0.5;
        } else {
          const wp = officer.patrolRoute[officer.waypointIndex];
          if (moveToward(officer, wp, NIGHT_PATROL_SPEED, dt)) {
            officer.waypointIndex = (officer.waypointIndex + 1) % officer.patrolRoute.length;
            officer.pauseTimer = NIGHT_PAUSE_DURATION;
          }
        }
        officer.body.rotation.x = -0.05;
        if (checkDetection(officer, playerPos, playerInRuins, dealOpen)) {
          officer.state = 'ALERT'; officer.alertTimer = 0;
          officer.alertIcon.visible = true; playAlertSound();
        }
        break;
      }

      case 'ALERT': {
        officer.alertTimer += dt;
        rotateToward(officer, playerPos.x, playerPos.z, dt);
        const b = 1 + 0.15 * Math.sin(officer.alertTimer * 12);
        officer.alertIcon.scale.set(0.6 * b, 0.6 * b, 1);
        officer.alertIcon.position.y = 3.1 + 0.05 * Math.sin(officer.alertTimer * 10);

        if (!checkDetection(officer, playerPos, playerInRuins, dealOpen)) {
          officer.state = nightMode ? 'PATROL' : 'CHECKPOINT';
          officer.alertIcon.visible = false; officer.alertIcon.scale.set(0.6, 0.6, 1);
          break;
        }
        const dur = nightMode ? NIGHT_ALERT_DURATION : DAY_ALERT_DURATION;
        if (officer.alertTimer >= dur) {
          officer.state = 'CHASE'; officer.alertIcon.visible = false;
          officer.alertIcon.scale.set(0.6, 0.6, 1);
          officer.chaseLostTimer = 0; officer.lastKnownPos = null;
          officer.chaseStartPos = officer.group.position.clone();
          playWhistleSound(); startChaseSound();
        }
        break;
      }

      case 'CHASE': {
        anyChasing = true;
        if (officer.chaseLostTimer === undefined) officer.chaseLostTimer = 0;
        const canSee = hasLineOfSight(officer.group.position, playerPos) && !playerInRuins;
        if (canSee) {
          officer.lastKnownPos = new THREE.Vector3(playerPos.x, 0, playerPos.z);
          officer.chaseLostTimer = 0;
        } else officer.chaseLostTimer += dt;

        const spd = nightMode ? NIGHT_CHASE_SPEED : DAY_CHASE_SPEED;
        const maxDist = nightMode ? NIGHT_CHASE_GIVE_UP : DAY_CHASE_GIVE_UP;
        const target = officer.lastKnownPos || new THREE.Vector3(playerPos.x, 0, playerPos.z);
        if (target.z > RUINS_Z - 2) target.z = RUINS_Z - 2;
        moveToward(officer, target, spd, dt);
        officer.body.rotation.x = -0.15;

        const dist = distBetween(officer.group.position, playerPos);
        if (dist < CATCH_DIST) { onCaught(officer); break; }

        const fromStart = officer.chaseStartPos ? distBetween(officer.group.position, officer.chaseStartPos) : 0;
        if (dist > 40 || playerInRuins || officer.chaseLostTimer > 3 || fromStart > maxDist) {
          officer.state = 'RETURNING'; officer.body.rotation.x = 0;
          officer.chaseLostTimer = 0; officer.lastKnownPos = null; officer.chaseStartPos = null;
          if (!officers.some(o => o !== officer && o.state === 'CHASE')) {
            stopChaseSound(); hideVignette(); anyChasing = false;
            // Player successfully escaped — fire escape callback for JP bonus
            if (onEscapeCallback) onEscapeCallback();
          }
        }
        break;
      }

      case 'RETURNING': {
        const tgt = (currentMode === 'day' || currentMode === 'to_day')
          ? officer.checkpointPos
          : officer.patrolRoute[nearestWaypointIndex(officer)];
        if (moveToward(officer, tgt, TRANSITION_SPEED * 1.5, dt)) {
          if (currentMode === 'day' || currentMode === 'to_day') {
            officer.state = 'CHECKPOINT'; officer.group.rotation.y = officer.checkpointFacing;
          } else {
            officer.state = 'PATROL'; officer.waypointIndex = nearestWaypointIndex(officer); officer.pauseTimer = 0;
          }
        }
        officer.body.rotation.x = 0;
        break;
      }

      case 'TRANSITIONING': {
        const tgt = currentMode === 'to_night' ? officer.patrolRoute[0] : officer.checkpointPos;
        moveToward(officer, tgt, TRANSITION_SPEED, dt);
        break;
      }
    }
  }

  if (anyChasing) { chasePulse += dt * 3; showVignette(chasePulse); }

  for (const o of officers) {
    if (o.state === 'CHASE') o.aura.intensity = 0.4 + 0.2 * Math.sin(chasePulse * Math.PI * 2);
    else if (o.state === 'ALERT') o.aura.intensity = 0.35;
    else o.aura.intensity = 0.2;

    // Flashlight intensity pulse at night
    if (nightMode && o.spotLight.intensity > 0) {
      o.spotLight.intensity = 1.8 + 0.3 * Math.sin(o.scanTime * 2);
    }
  }

  updateProximitySound(minDist);
}

// --- Accessors for minimap ---
export function getDetectRange() {
  return (currentMode === 'night' || currentMode === 'to_night') ? NIGHT_DETECT_RANGE : DAY_DETECT_RANGE;
}
export function getDetectConeHalf() {
  return (currentMode === 'night' || currentMode === 'to_night') ? NIGHT_CONE_HALF : DAY_CONE_HALF;
}
export function getCurrentMode() { return currentMode; }
