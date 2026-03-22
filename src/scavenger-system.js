// Scavenger Hire system — hire Ash and/or Pip to find materials daily
// Ash: Rank 3 unlock, finds sticker paper + stickers, $15/day
// Pip (Ruins Kid): unlocks after 5 scavenges in ruins, finds stickers + plushies, $20/day
// Both can be hired simultaneously
// Deposits at 4 PM, wages deducted at 6 AM

import * as THREE from 'three';
import { addItem, getMoney, deductMoney, hasItem, removeItem, hasAnyPlushie, removeAnyPlushie } from './inventory.js';
import { getCurrentRankIndex } from './jp-system.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { showNotification } from './notifications.js';
import { getRelationship } from './npc.js';

// Pip position — near first rubble pile in the ruins
const PIP_POS = new THREE.Vector3(-30, 0, -162);
const PIP_INTERACT_RADIUS = 3;

// --- State ---
// Ash
let ashHired = false;
let lastWageDay = 0;
let lastDepositDay = 0;
let npcsRef = [];

// Pip (Ruins Kid)
let pipScavengeCount = 0; // how many rubble piles player has searched (cumulative, never reset)
let pipUnlocked = false;  // Pip has appeared in ruins (5+ scavenges done)
let pipRecruited = false; // player gave Pip a plushie (one-time unlock)
let pipHired = false;
let lastPipWageDay = 0;
let lastPipDepositDay = 0;
let pipMesh = null;

// --- Queries ---
export function isAshHired() { return ashHired; }
export function isAshHireUnlocked() { return getCurrentRankIndex() >= 3; }
export function isPipUnlocked() { return pipUnlocked; }
export function isPipRecruited() { return pipRecruited; }
export function isPipHired() { return pipHired; }
export function isAnyScavengerHired() { return ashHired || pipHired; }

// Backward-compat aliases used by interaction.js and phone.js
export function isRuinsKidHired() { return pipHired; }
export function isRuinsKidHireUnlocked() { return pipRecruited; }

// True if Ash is on scavenger duty (6 AM – 4 PM, hired)
export function isAshOnDuty() {
  if (!ashHired) return false;
  const hour = getGameHour();
  return hour >= 6 && hour < 16;
}

// True if player is near Pip (only when Pip has appeared)
export function isNearRuinsKid(playerPos) {
  if (!pipUnlocked) return false;
  const dx = playerPos.x - PIP_POS.x;
  const dz = playerPos.z - PIP_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < PIP_INTERACT_RADIUS;
}

// Called each time a rubble pile search completes — tracks Pip unlock
export function onPileSearched() {
  if (pipUnlocked) return;
  pipScavengeCount++;
  if (pipScavengeCount >= 5) {
    pipUnlocked = true;
    if (pipMesh) pipMesh.visible = true;
    showNotification({
      id: 'pip_appear',
      npcName: 'Pip',
      title: 'A kid is watching you',
      text: "Someone's huddled near a rubble pile in the ruins...",
    });
  }
}

// One-time recruitment — player gives Pip a plushie (any quality)
export function recruitPip() {
  if (pipRecruited || !hasAnyPlushie()) return false;
  removeAnyPlushie();
  pipRecruited = true;
  pipHired = true;
  lastPipWageDay = getDayNumber();
  showNotification({
    id: 'pip_recruited',
    npcName: 'Pip',
    title: 'Pip joined you',
    text: "They pocketed the plushie and grinned. $20/day, finds at 4 PM.",
  });
  return true;
}

// --- Init ---
export function initScavenger(scene, npcs) {
  npcsRef = npcs;
  _createPipMesh(scene);
}

function _createPipMesh(scene) {
  if (!scene) return;
  const group = new THREE.Group();
  group.position.copy(PIP_POS);
  group.scale.setScalar(0.8); // Pip is shorter than other NPCs

  // Body — patched olive jacket
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a6b4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.35), bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);

  // Patches on jacket
  const patchMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
  const patch1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), patchMat);
  patch1.position.set(0.18, 0.95, 0.19);
  group.add(patch1);
  const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), patchMat);
  patch2.position.set(-0.16, 0.75, 0.19);
  group.add(patch2);

  // Head
  const headMat = new THREE.MeshLambertMaterial({ color: 0xc8a070 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), headMat);
  head.position.y = 1.6;
  group.add(head);

  // Hood — half-sphere behind head (like Kit)
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x3d4d30 });
  const hoodGeo = new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const hood = new THREE.Mesh(hoodGeo, hoodMat);
  hood.position.set(0, 1.68, -0.08);
  hood.rotation.x = 0.3;
  group.add(hood);

  // Eyes
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), eyeMat);
  eyeL.position.set(-0.1, 1.62, 0.2);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), eyeMat);
  eyeR.position.set(0.1, 1.62, 0.2);
  group.add(eyeR);

  // Name label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ccc';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('Pip', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2.2, 0.55, 1);
  sprite.position.y = 2.5; // slightly higher to account for scale
  group.add(sprite);

  group.visible = pipUnlocked; // hidden until 5 scavenges done
  scene.add(group);
  pipMesh = group;
}

// --- Hire / Fire Ash ---
export function hireAsh() {
  if (ashHired || !isAshHireUnlocked()) return false;
  const ash = npcsRef.find(n => n.name === 'Ash');
  if (!ash || !ash.isAvailable) return false;
  ashHired = true;
  lastWageDay = getDayNumber();
  showNotification({
    id: `hire_ash_${Date.now()}`,
    npcName: 'Ash',
    title: 'Ash hired',
    text: "Ash will drop off materials at 4 PM. $15/day.",
  });
  return true;
}

export function fireAsh() {
  if (!ashHired) return;
  ashHired = false;
  showNotification({
    id: `fire_ash_${Date.now()}`,
    npcName: 'Ash',
    title: 'Ash let go',
    text: "Ash is back on their own schedule.",
  });
}

// --- Hire / Fire Pip ---
export function hirePip() {
  if (pipHired || !pipRecruited) return false;
  pipHired = true;
  lastPipWageDay = getDayNumber();
  showNotification({
    id: `hire_pip_${Date.now()}`,
    npcName: 'Pip',
    title: 'Pip rehired',
    text: "They'll drop off finds at 4 PM. $20/day.",
  });
  return true;
}

export function firePip() {
  if (!pipHired) return;
  pipHired = false;
  showNotification({
    id: `fire_pip_${Date.now()}`,
    npcName: 'Pip',
    title: 'Pip let go',
    text: "They've gone back to scavenging on their own.",
  });
}

// Backward-compat aliases used by phone.js
export function hireRuinsKid() { return pipRecruited ? hirePip() : false; }
export function fireRuinsKid() { firePip(); }

// --- Daily logic — Ash ---
function deductWage() {
  const day = getDayNumber();
  if (day <= lastWageDay) return;
  lastWageDay = day;
  const money = getMoney();
  if (money >= 15) {
    deductMoney(15);
    showNotification({
      id: `ash_wage_${day}`,
      npcName: 'Ash',
      title: 'Daily wage paid',
      text: "−$15 for Ash's scavenging work.",
    });
  } else {
    fireAsh();
    showNotification({
      id: `ash_quit_${day}`,
      npcName: 'Ash',
      title: "Ash quit",
      text: "Couldn't pay Ash's wage. They've stopped working for you.",
    });
  }
}

function _relBonus(npcName) {
  const rel = getRelationship(npcName);
  const lvl = Math.floor(rel ? rel.level : 0);
  if (lvl >= 5) return 2;
  if (lvl >= 3) return 1;
  return 0;
}

function depositMaterials() {
  const day = getDayNumber();
  if (day <= lastDepositDay) return;
  lastDepositDay = day;

  const base = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const count = base + _relBonus('Ash');

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.55) {
      addItem('material', 'sticker_paper');
    } else {
      addItem('sticker', 'old');
    }
  }

  showNotification({
    id: `ash_deposit_${day}`,
    npcName: 'Ash',
    title: 'Ash dropped off materials',
    text: `Found ${count} item${count !== 1 ? 's' : ''} near the apartment.`,
  });
}

// --- Daily logic — Pip ---
function deductPipWage() {
  const day = getDayNumber();
  if (day <= lastPipWageDay) return;
  lastPipWageDay = day;
  const money = getMoney();
  if (money >= 20) {
    deductMoney(20);
    showNotification({
      id: `pip_wage_${day}`,
      npcName: 'Pip',
      title: 'Daily wage paid',
      text: "−$20 for Pip's scavenging work.",
    });
  } else {
    firePip();
    showNotification({
      id: `pip_quit_${day}`,
      npcName: 'Pip',
      title: "Pip stopped showing up",
      text: "Couldn't pay the wage. Pip went back to scavenging alone.",
    });
  }
}

const PIP_DEPOSIT_LINES = [
  "Found these behind the old school",
  "Almost got spotted but I'm fast",
  "This plushie was buried under a wall",
  "Good haul today",
];

function depositPipFinds() {
  const day = getDayNumber();
  if (day <= lastPipDepositDay) return;
  lastPipDepositDay = day;

  // 2–4 items: 60% old sticker, 40% old plushie (scavenged, worn)
  const count = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.6) {
      addItem('sticker', 'old');
    } else {
      addItem('plushie', 'old');
    }
  }

  // 10% chance Pip also finds a color ink hidden in the ruins
  if (Math.random() < 0.1) {
    addItem('material', 'color_ink');
  }

  const line = PIP_DEPOSIT_LINES[Math.floor(Math.random() * PIP_DEPOSIT_LINES.length)];
  showNotification({
    id: `pip_deposit_${day}`,
    npcName: 'Pip',
    title: 'Pip dropped off finds',
    text: `"${line}" — ${count} item${count !== 1 ? 's' : ''}.`,
  });
}

// Called each frame from main update loop
let prevHour = -1;
export function updateScavenger(dt) {
  if (!ashHired && !pipHired) return;

  const hour = getGameHour();

  // 6 AM — wage deductions
  if (prevHour < 6 && hour >= 6) {
    if (ashHired) deductWage();
    if (pipHired) deductPipWage();
  }

  // 4 PM — deposits
  if (prevHour < 16 && hour >= 16) {
    if (ashHired) depositMaterials();
    if (pipHired) depositPipFinds();
  }

  prevHour = hour;
}

// Called at new day start
export function onNewDayScavenger() {
  prevHour = -1;
}

// --- Save / Load ---
export function getScavengerSaveData() {
  return {
    ashHired, lastWageDay, lastDepositDay,
    pipScavengeCount, pipUnlocked, pipRecruited,
    pipHired, lastPipWageDay, lastPipDepositDay,
  };
}

export function restoreScavenger(data) {
  if (!data) return;
  ashHired = data.ashHired || false;
  lastWageDay = data.lastWageDay || 0;
  lastDepositDay = data.lastDepositDay || 0;

  pipScavengeCount = data.pipScavengeCount || 0;
  pipUnlocked = data.pipUnlocked || false;
  pipRecruited = data.pipRecruited || false;
  pipHired = data.pipHired || false;
  lastPipWageDay = data.lastPipWageDay || 0;
  lastPipDepositDay = data.lastPipDepositDay || 0;

  // Show pip mesh if already unlocked (mesh created before restore is called)
  if (pipMesh && pipUnlocked) pipMesh.visible = true;

  // Backward compat: migrate old ruinsKidHired save data
  if (!pipRecruited && data.ruinsKidHired) {
    pipRecruited = true;
    pipHired = data.ruinsKidHired;
    lastPipWageDay = data.lastRuinsKidWageDay || 0;
    lastPipDepositDay = data.lastRuinsKidDepositDay || 0;
    pipUnlocked = true;
    if (pipMesh) pipMesh.visible = true;
  }
}
