// Save/Load system — localStorage persistence with auto-save
import * as THREE from 'three';
import { getSlots, getMoney } from './inventory.js';
import { getBuildingColors } from './color-system.js';
import { getPhoneState, restorePhoneState } from './phone.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { getGachaState, restoreGachaState } from './gacha.js';
import { getDistrictState } from './districts.js';
import { getProgressionState } from './progression.js';
import { getReferralState, restoreReferralState, getRelationships, restoreRelationships, getAffinityOverrides, restoreAffinityOverrides, getRoutineSaveData, restoreRoutineState } from './npc.js';
import { getKitStock, restoreKitStock } from './shop.js';
import { getStationSaveData, restorePrintStationState } from './stations/print-station.js';
import { getCuttingTableSaveData, restoreCuttingTableState } from './stations/cutting-table.js';
import { getSewingMachineSaveData, restoreSewingMachineState } from './stations/sewing-machine.js';
import { getStuffingStationSaveData, restoreStuffingStationState } from './stations/stuffing-station.js';
import { getNotifState, restoreNotifState } from './notifications.js';
import { getJPState, restoreJPState } from './jp-system.js';
import { getStationShopSaveData } from './station-shop.js';
import { getSmugglingState, restoreSmugglingState } from './smuggling.js';
import { getScavengerSaveData, restoreScavenger } from './scavenger-system.js';
import { getStoryEventsSaveData, restoreStoryEvents } from './story-events.js';

const SAVE_KEY = 'kawaiid_save';
const AUTO_SAVE_INTERVAL = 60000; // 60 seconds

let autoSaveTimer = null;
let saveIndicator = null;
let playerRef = null;
let npcsRef = null;
let pilesRef = null;
let officersRef = null;

// --- Save indicator UI ---
function createSaveIndicator() {
  saveIndicator = document.createElement('div');
  Object.assign(saveIndicator.style, {
    position: 'fixed', top: '48px', left: '16px',
    fontFamily: 'monospace', fontSize: '14px',
    color: '#fff', background: 'rgba(0,0,0,0.5)',
    padding: '4px 10px', borderRadius: '4px',
    pointerEvents: 'none', zIndex: '100',
    opacity: '0',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(saveIndicator);
}

function showSaveMessage(text) {
  if (!saveIndicator) createSaveIndicator();
  saveIndicator.textContent = text;
  saveIndicator.style.opacity = '1';
  setTimeout(() => {
    saveIndicator.style.opacity = '0';
  }, 1000);
}

// --- Gather current game state ---
function gatherSaveData() {
  const data = {
    version: 1,
    timestamp: new Date().toISOString(),
    gameHour: getGameHour(),
    dayNumber: getDayNumber(),
  };

  // Player position & rotation
  if (playerRef) {
    data.player = {
      position: {
        x: playerRef.position.x,
        y: playerRef.position.y,
        z: playerRef.position.z,
      },
      euler: {
        x: playerRef.pitch,
        y: playerRef.yaw,
        z: 0,
      },
    };
  }

  // Inventory & money (include contains for gacha capsules, subtype for materials)
  data.inventory = {
    slots: getSlots().map((s, i) => {
      const slot = { slot: i, itemType: s.type, count: s.count };
      if (s.subtype) slot.subtype = s.subtype;
      if (s.contains) slot.contains = s.contains;
      return slot;
    }),
    money: getMoney(),
  };

  // Kit's shop daily stock
  data.kitStock = getKitStock();

  // NPC deal counts + gacha purchases
  if (npcsRef) {
    data.npcs = {};
    for (const npc of npcsRef) {
      data.npcs[npc.name] = {
        purchaseCount: npc.purchaseCount,
        gachaPurchases: npc.gachaPurchases || 0,
      };
    }
  }

  // Building colors
  const colors = getBuildingColors();
  data.buildingColors = colors.map(b => ({
    x: b.x,
    z: b.z,
    colorAmount: b.colorAmount,
  }));

  // Rubble piles
  if (pilesRef) {
    data.rubblePiles = pilesRef.map(p => ({
      x: p.worldPos.x,
      z: p.worldPos.z,
      searched: p.searched,
    }));
  }

  // ACE officers
  const officers = officersRef || [];
  data.aceOfficers = officers.map(o => ({
    waypointIndex: o.waypointIndex,
  }));

  // Phone state
  data.phone = getPhoneState();

  // Gacha state
  data.gacha = getGachaState();

  // District unlock state
  data.districts = getDistrictState();

  // Progression state
  data.progression = getProgressionState();

  // NPC referral & social connection state
  data.referrals = getReferralState();

  // Relationship levels and deal history
  data.relationships = getRelationships();

  // Affinity overrides (dynamic changes like Ash's plushie growth)
  data.affinityOverrides = getAffinityOverrides();

  // Print station state
  data.printStation = getStationSaveData();

  // Plushie workshop stations
  data.cuttingTable = getCuttingTableSaveData();
  data.sewingMachine = getSewingMachineSaveData();
  data.stuffingStation = getStuffingStationSaveData();

  // Notification history
  data.notifications = getNotifState();

  // NPC routine states (current schedule entry, activity, position)
  data.routines = getRoutineSaveData();

  // Joy Points and rank
  data.jp = getJPState();

  // Station shop purchases
  data.stationShop = getStationShopSaveData();

  // Smuggling order state
  data.smuggling = getSmugglingState();

  // Scavenger hire state
  data.scavenger = getScavengerSaveData();

  // Story events triggered state
  data.storyEvents = getStoryEventsSaveData();

  return data;
}

// --- Save to localStorage ---
export function saveGame() {
  try {
    const data = gatherSaveData();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed:', e);
    return false;
  }
}

// Save with visual indicator
export function saveWithMessage(msg) {
  const ok = saveGame();
  if (ok) showSaveMessage(msg || 'Saving...');
}

// --- Load from localStorage ---
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load save:', e);
    return null;
  }
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// --- Apply loaded data to game state ---
export function applySave(data, player, npcs, piles) {
  // Player position
  if (data.player && player) {
    player.position.set(data.player.position.x, data.player.position.y, data.player.position.z);
    player.pitch = data.player.euler.x;
    player.yaw = data.player.euler.y;
    player.camera.rotation.x = player.pitch;
    player.camera.rotation.y = player.yaw;
    player.velocity.set(0, 0, 0);
  }

  // Inventory & money — use the restoreState function from inventory.js
  // This is called by main.js which imports restoreInventory
  // (handled externally so we keep this module decoupled)

  // NPC deal counts + gacha purchases
  if (data.npcs && npcs) {
    for (const npc of npcs) {
      if (data.npcs[npc.name]) {
        npc.purchaseCount = data.npcs[npc.name].purchaseCount;
        if (data.npcs[npc.name].gachaPurchases !== undefined) {
          npc.gachaPurchases = data.npcs[npc.name].gachaPurchases;
        }
      }
    }
  }

  // Building colors
  if (data.buildingColors) {
    const colors = getBuildingColors();
    for (const saved of data.buildingColors) {
      // Match by position
      const match = colors.find(b =>
        Math.abs(b.x - saved.x) < 0.5 && Math.abs(b.z - saved.z) < 0.5
      );
      if (match) {
        match.colorAmount = saved.colorAmount;
        match.displayAmount = saved.colorAmount; // skip the lerp on load
      }
    }
  }

  // Rubble piles
  if (data.rubblePiles && piles) {
    for (const saved of data.rubblePiles) {
      const match = piles.find(p =>
        Math.abs(p.worldPos.x - saved.x) < 0.5 && Math.abs(p.worldPos.z - saved.z) < 0.5
      );
      if (match && saved.searched) {
        match.searched = true;
        // Hide the glow
        match.glow.visible = false;
        match.light.intensity = 0;
      }
    }
  }

  // Phone state
  if (data.phone) restorePhoneState(data.phone);

  // Gacha state
  if (data.gacha) restoreGachaState(data.gacha);

  // Referral & social state
  if (data.referrals) restoreReferralState(data.referrals);

  // Relationship levels and deal history
  if (data.relationships) restoreRelationships(data.relationships);

  // Affinity overrides
  if (data.affinityOverrides) restoreAffinityOverrides(data.affinityOverrides);

  // Kit's shop stock
  if (data.kitStock) restoreKitStock(data.kitStock);

  // Print station state
  if (data.printStation) restorePrintStationState(data.printStation);

  // Plushie workshop stations
  if (data.cuttingTable) restoreCuttingTableState(data.cuttingTable);
  if (data.sewingMachine) restoreSewingMachineState(data.sewingMachine);
  if (data.stuffingStation) restoreStuffingStationState(data.stuffingStation);

  // Notification history
  if (data.notifications) restoreNotifState(data.notifications);

  // NPC routine states
  if (data.routines) restoreRoutineState(data.routines);

  // Joy Points and rank
  if (data.jp) restoreJPState(data.jp);

  // Smuggling order state
  if (data.smuggling) restoreSmugglingState(data.smuggling);

  // Scavenger hire state
  if (data.scavenger) restoreScavenger(data.scavenger);

  // Story events triggered state (visual sync done in main.js after load)
  if (data.storyEvents) restoreStoryEvents(data.storyEvents);

  // ACE officers — restore waypoint index (mode will sync from game hour)
  if (data.aceOfficers && officersRef) {
    for (let i = 0; i < Math.min(data.aceOfficers.length, officersRef.length); i++) {
      const o = officersRef[i];
      o.waypointIndex = data.aceOfficers[i].waypointIndex || 0;
      o.alertTimer = 0;
      o.alertIcon.visible = false;
      o.body.rotation.x = 0;
    }
  }
}

// --- Init: store references & start auto-save ---
export function initSaveSystem(player, npcs, piles, officers) {
  playerRef = player;
  npcsRef = npcs;
  pilesRef = piles;
  officersRef = officers;

  createSaveIndicator();

  // Auto-save every 60 seconds
  autoSaveTimer = setInterval(() => {
    saveWithMessage('Saving...');
  }, AUTO_SAVE_INTERVAL);

  // F5 manual save (prevent browser refresh)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'F5') {
      e.preventDefault();
      saveWithMessage('Game saved!');
    }
  });
}

// --- Trigger save from external events ---
export function triggerSave(msg) {
  saveWithMessage(msg || 'Saving...');
}
