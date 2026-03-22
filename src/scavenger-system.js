// Scavenger Hire system — hire Ash to find raw materials daily
// Unlocks at Rank 3 (Supplier, 300 JP)
// Hired via phone Contacts tab
// When hired, Ash is unavailable for deals 6 AM – 4 PM
// At 4 PM, Ash deposits 3–5 materials at the apartment
// Daily wage of $15 auto-deducted at 6 AM
// One scavenger (Ash) supported

import { addItem, getMoney, deductMoney } from './inventory.js';
import { getCurrentRankIndex } from './jp-system.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { showNotification } from './notifications.js';

// --- State ---
let ashHired = false;
let lastWageDay = 0;
let lastDepositDay = 0;
let npcsRef = [];

// --- Queries ---
export function isAshHired() { return ashHired; }
export function isAshHireUnlocked() { return getCurrentRankIndex() >= 3; }

// True if Ash is on scavenger duty (6 AM – 4 PM, hired)
export function isAshOnDuty() {
  if (!ashHired) return false;
  const hour = getGameHour();
  return hour >= 6 && hour < 16;
}

// --- Init ---
export function initScavenger(npcs) {
  npcsRef = npcs;
}

// --- Hire / Fire ---
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

function depositMaterials() {
  const day = getDayNumber();
  if (day <= lastDepositDay) return;
  lastDepositDay = day;

  // 3–5 items: mix of sticker_paper and old stickers
  const count = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const deposited = [];

  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    if (roll < 0.55) {
      addItem('material', 'sticker_paper');
      deposited.push('sticker paper');
    } else {
      addItem('sticker');
      deposited.push('old sticker');
    }
  }

  const summary = `Found ${count} item${count > 1 ? 's' : ''} near the apartment.`;
  showNotification({
    id: `ash_deposit_${day}`,
    npcName: 'Ash',
    title: 'Ash dropped off materials',
    text: summary,
  });
}

// Called each frame from main update loop
let prevHour = -1;
export function updateScavenger(dt) {
  if (!ashHired) return;

  const hour = getGameHour();

  // Check 6 AM wage deduction (on transition)
  if (prevHour < 6 && hour >= 6) {
    deductWage();
  }

  // Check 4 PM material deposit (on transition)
  if (prevHour < 16 && hour >= 16) {
    depositMaterials();
  }

  prevHour = hour;
}

// Called at new day start (sleeping resets the hour from 18→6)
export function onNewDayScavenger() {
  prevHour = -1; // ensure transitions fire fresh each day
}

// --- Save / Load ---
export function getScavengerSaveData() {
  return { ashHired, lastWageDay, lastDepositDay };
}

export function restoreScavenger(data) {
  if (!data) return;
  ashHired = data.ashHired || false;
  lastWageDay = data.lastWageDay || 0;
  lastDepositDay = data.lastDepositDay || 0;
}
