// Scavenger Hire system — hire Ash or Ruins Kid to find raw materials daily
// Unlocks at Rank 3 (Supplier, 300 JP)
// Hired via phone Contacts tab or by talking to NPC
// When hired, scavenger is unavailable for deals 6 AM – 4 PM
// At 4 PM, scavenger deposits 3–5 materials at the apartment
// Daily wages auto-deducted at 6 AM ($15 Ash, $20 Ruins Kid)
// One scavenger at a time

import * as THREE from 'three';
import { addItem, getMoney, deductMoney } from './inventory.js';
import { getCurrentRankIndex } from './jp-system.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { showNotification } from './notifications.js';
import { getRelationship } from './npc.js';

// Ruins Kid position — inside ruins zone
const RUINS_KID_POS = new THREE.Vector3(22, 0, -80);
const RUINS_KID_INTERACT_RADIUS = 3;

// --- State ---
let ashHired = false;
let lastWageDay = 0;
let lastDepositDay = 0;
let npcsRef = [];

// Ruins Kid state
let ruinsKidHired = false;
let lastRuinsKidWageDay = 0;
let lastRuinsKidDepositDay = 0;
let ruinsKidMesh = null;

// --- Queries ---
export function isAshHired() { return ashHired; }
export function isRuinsKidHired() { return ruinsKidHired; }
export function isAshHireUnlocked() { return getCurrentRankIndex() >= 3; }
export function isRuinsKidHireUnlocked() { return getCurrentRankIndex() >= 3; }
export function isAnyScavengerHired() { return ashHired || ruinsKidHired; }

// True if Ash is on scavenger duty (6 AM – 4 PM, hired)
export function isAshOnDuty() {
  if (!ashHired) return false;
  const hour = getGameHour();
  return hour >= 6 && hour < 16;
}

// True if Ruins Kid is near player
export function isNearRuinsKid(playerPos) {
  const dx = playerPos.x - RUINS_KID_POS.x;
  const dz = playerPos.z - RUINS_KID_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < RUINS_KID_INTERACT_RADIUS;
}

// --- Init ---
export function initScavenger(scene, npcs) {
  npcsRef = npcs;
  _createRuinsKidMesh(scene);
}

function _createRuinsKidMesh(scene) {
  if (!scene) return;
  const group = new THREE.Group();
  group.position.copy(RUINS_KID_POS);

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6a7a5a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.35), bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);

  const headMat = new THREE.MeshLambertMaterial({ color: 0xd4a87a });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), headMat);
  head.position.y = 1.6;
  group.add(head);

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
  ctx.fillText('Ruins Kid', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2.2, 0.55, 1);
  sprite.position.y = 2.2;
  group.add(sprite);

  scene.add(group);
  ruinsKidMesh = group;
}

// --- Hire / Fire ---
export function hireAsh() {
  if (ashHired || !isAshHireUnlocked()) return false;
  if (ruinsKidHired) return false; // one scavenger at a time
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

export function hireRuinsKid() {
  if (ruinsKidHired || !isRuinsKidHireUnlocked()) return false;
  if (ashHired) return false; // one scavenger at a time
  ruinsKidHired = true;
  lastRuinsKidWageDay = getDayNumber();
  showNotification({
    id: `hire_rk_${Date.now()}`,
    npcName: 'Ruins Kid',
    title: 'Ruins Kid hired',
    text: "They'll drop off fabric and stuffing at 4 PM. $20/day.",
  });
  return true;
}

export function fireRuinsKid() {
  if (!ruinsKidHired) return;
  ruinsKidHired = false;
  showNotification({
    id: `fire_rk_${Date.now()}`,
    npcName: 'Ruins Kid',
    title: 'Ruins Kid let go',
    text: "They've gone back to scavenging on their own.",
  });
}

// --- Daily logic ---
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
    // Can't afford — Ash quits
    fireAsh();
    showNotification({
      id: `ash_quit_${day}`,
      npcName: 'Ash',
      title: "Ash quit",
      text: "Couldn't pay Ash's wage. They've stopped working for you.",
    });
  }
}

// Bonus items from relationship level with a scavenger NPC
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

  // 3–5 items + relationship bonus: level 3 = +1, level 5 = +2
  const base = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const count = base + _relBonus('Ash');

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.55) {
      addItem('material', 'sticker_paper');
    } else {
      addItem('sticker');
    }
  }

  showNotification({
    id: `ash_deposit_${day}`,
    npcName: 'Ash',
    title: 'Ash dropped off materials',
    text: `Found ${count} item${count !== 1 ? 's' : ''} near the apartment.`,
  });
}

// --- Ruins Kid daily logic ---
function deductRuinsKidWage() {
  const day = getDayNumber();
  if (day <= lastRuinsKidWageDay) return;
  lastRuinsKidWageDay = day;
  const money = getMoney();
  if (money >= 20) {
    deductMoney(20);
    showNotification({
      id: `rk_wage_${day}`,
      npcName: 'Ruins Kid',
      title: 'Daily wage paid',
      text: "−$20 for Ruins Kid's scavenging work.",
    });
  } else {
    fireRuinsKid();
    showNotification({
      id: `rk_quit_${day}`,
      npcName: 'Ruins Kid',
      title: "Ruins Kid quit",
      text: "Couldn't pay the wage. They've stopped working for you.",
    });
  }
}

function depositRuinsKidMaterials() {
  const day = getDayNumber();
  if (day <= lastRuinsKidDepositDay) return;
  lastRuinsKidDepositDay = day;

  // 3–5 items (fabric_roll + stuffing) + relationship bonus
  const base = 3 + Math.floor(Math.random() * 3);
  const count = base + _relBonus('Ruins Kid');

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.6) {
      addItem('material', 'fabric_roll');
    } else {
      addItem('material', 'stuffing');
    }
  }

  showNotification({
    id: `rk_deposit_${day}`,
    npcName: 'Ruins Kid',
    title: 'Ruins Kid dropped off materials',
    text: `Found ${count} item${count !== 1 ? 's' : ''} in the ruins.`,
  });
}

// Called each frame from main update loop
let prevHour = -1;
export function updateScavenger(dt) {
  if (!ashHired && !ruinsKidHired) return;

  const hour = getGameHour();

  // 6 AM — wage deductions
  if (prevHour < 6 && hour >= 6) {
    if (ashHired) deductWage();
    if (ruinsKidHired) deductRuinsKidWage();
  }

  // 4 PM — material deposits
  if (prevHour < 16 && hour >= 16) {
    if (ashHired) depositMaterials();
    if (ruinsKidHired) depositRuinsKidMaterials();
  }

  prevHour = hour;
}

// Called at new day start (sleeping resets the hour from 18→6)
export function onNewDayScavenger() {
  prevHour = -1; // ensure transitions fire fresh each day
}

// --- Save / Load ---
export function getScavengerSaveData() {
  return {
    ashHired, lastWageDay, lastDepositDay,
    ruinsKidHired, lastRuinsKidWageDay, lastRuinsKidDepositDay,
  };
}

export function restoreScavenger(data) {
  if (!data) return;
  ashHired = data.ashHired || false;
  lastWageDay = data.lastWageDay || 0;
  lastDepositDay = data.lastDepositDay || 0;
  ruinsKidHired = data.ruinsKidHired || false;
  lastRuinsKidWageDay = data.lastRuinsKidWageDay || 0;
  lastRuinsKidDepositDay = data.lastRuinsKidDepositDay || 0;
}
