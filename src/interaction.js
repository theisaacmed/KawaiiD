// Interaction system — proximity detection, search mechanic, respawn, NPC talk, sleeping
// Street encounters: walk up to NPC and press E (40% chance they refuse)
// Waypoint meetups: NPC always accepts when you reach their requested meetup point

import * as THREE from 'three';
import { addItem, isFull } from './inventory.js';
import { showPrompt, hidePrompt, showProgress, hideProgress, showInventoryFull } from './hud.js';
import { getNearestNPC, npcLine, resetNPCPurchases } from './npc.js';
import { openDealPanel, isDealOpen, setLocationRefuseCallback } from './dealing.js';
import { getActiveWaypointNearPlayer, completeWaypoint, isPhoneVisible, closePhone } from './phone.js';
import { spawnSearchDust } from './particles.js';
import { canSleep, startSleep, isSleepingNow } from './time-system.js';
import { isNearGachaMachine, isGachaUnlocked, openUI as openGachaUI, isGachaUIOpen } from './gacha.js';
import { playSearchScrape, playItemFound } from './audio.js';
import { isNearKit, isKitAvailable, openShop, isShopOpen } from './shop.js';
import { isNearPrintStation, isPrintStationOpen, openUI as openPrintStationUI } from './stations/print-station.js';
import { isNearCuttingTable, isCuttingTableOpen, openCuttingTableUI } from './stations/cutting-table.js';
import { isNearSewingMachine, isSewingMachineOpen, openSewingMachineUI } from './stations/sewing-machine.js';
import { isNearStuffingStation, isStuffingStationOpen, openStuffingStationUI } from './stations/stuffing-station.js';
import { isNearStationShop, isStationShopOpen, openStationShopUI } from './station-shop.js';

const SEARCH_RADIUS = 3;
const SEARCH_DURATION = 3; // seconds
const STREET_REFUSE_CHANCE = 0.40; // 40% chance NPC refuses cold approach
const BED_RADIUS = 2.5; // how close to be to the bed

// Bed/sleeping spot at player apartment (origin)
const BED_POS = new THREE.Vector3(14, 0, 12);

let piles = [];
let npcs = [];
let playerRef = null;
let searching = false;
let searchTarget = null;
let searchTimer = 0;
let searchStartPos = new THREE.Vector3();
let wasInRuins = false;
let ruinsZStart = 28;
let bedMesh = null;
let sleepConfirmEl = null;
let sleepConfirmVisible = false;
let sceneRef = null;

// Street refusal toast
let refuseToast = null;
let refuseTimeout = null;

function createRefuseToast() {
  refuseToast = document.createElement('div');
  Object.assign(refuseToast.style, {
    position: 'fixed', bottom: '100px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(180,80,40,0.85)', color: '#fff',
    fontFamily: 'monospace', fontSize: '14px',
    padding: '8px 18px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '160',
    display: 'none',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(refuseToast);
}

function showRefusal(text) {
  if (!refuseToast) createRefuseToast();
  refuseToast.textContent = `"${text}"`;
  refuseToast.style.display = 'block';
  refuseToast.style.opacity = '1';
  clearTimeout(refuseTimeout);
  refuseTimeout = setTimeout(() => {
    refuseToast.style.opacity = '0';
    setTimeout(() => { refuseToast.style.display = 'none'; }, 300);
  }, 2000);
}

export function initInteraction(player, ruinsPiles, zStart, npcList, scene) {
  playerRef = player;
  piles = ruinsPiles;
  ruinsZStart = zStart;
  npcs = npcList || [];
  sceneRef = scene;

  createRefuseToast();
  setLocationRefuseCallback(showRefusal);
  createBed(scene);
  createSleepConfirm();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !searching && !isDealOpen() && !isSleepingNow() && !isGachaUIOpen() && !isShopOpen() && !isPrintStationOpen() && !isCuttingTableOpen() && !isSewingMachineOpen() && !isStuffingStationOpen() && !isStationShopOpen()) {
      // Close phone if open
      if (isPhoneVisible()) closePhone();

      // Handle sleep confirmation dialog
      if (sleepConfirmVisible) {
        confirmSleep(true);
        return;
      }

      // Check if near plushie workshop stations
      if (isNearCuttingTable(playerRef.position)) {
        openCuttingTableUI();
        return;
      }
      if (isNearSewingMachine(playerRef.position)) {
        openSewingMachineUI();
        return;
      }
      if (isNearStuffingStation(playerRef.position)) {
        openStuffingStationUI();
        return;
      }

      // Check if near print station
      if (isNearPrintStation(playerRef.position)) {
        openPrintStationUI();
        return;
      }

      // Check if near station shop counter
      if (isNearStationShop(playerRef.position)) {
        openStationShopUI();
        return;
      }

      // Check if near gacha machine (before bed, since they're close together)
      if (isGachaUnlocked() && isNearGachaMachine(playerRef.position)) {
        openGachaUI();
        return;
      }

      // Check if near Kit's shop
      if (isKitAvailable() && isNearKit(playerRef.position)) {
        openShop();
        return;
      }

      // Check if near bed
      if (isNearBed()) {
        showSleepConfirm();
        return;
      }

      // Check if at a waypoint meetup first
      const waypoint = getActiveWaypointNearPlayer(playerRef.position);
      if (waypoint) {
        const npc = npcs.find(n => n.name === waypoint.npcName);
        if (npc) {
          completeWaypoint(waypoint.npcName);
          openDealPanel(npc);
          return;
        }
      }

      // Try NPC street encounter
      const nearNPC = getNearestNPC(npcs, playerRef.position);
      if (nearNPC) {
        // Street encounter — chance of refusal
        if (nearNPC.purchaseCount >= nearNPC.maxPurchases) {
          showRefusal(nearNPC.limitLine);
          return;
        }
        if (Math.random() < STREET_REFUSE_CHANCE) {
          const refuseLine = nearNPC.streetRefuseLines
            ? nearNPC.streetRefuseLines[Math.floor(Math.random() * nearNPC.streetRefuseLines.length)]
            : "Not right now.";
          showRefusal(refuseLine);
          return;
        }
        openDealPanel(nearNPC);
        return;
      }

      tryStartSearch();
    }

    // Cancel sleep confirm with Escape or any other key
    if (sleepConfirmVisible && (e.code === 'Escape' || e.code === 'KeyQ')) {
      confirmSleep(false);
    }
  });
}

// --- Bed mesh ---
function createBed(scene) {
  const group = new THREE.Group();
  group.position.copy(BED_POS);

  // Sleeping bag — a flat elongated shape
  const bagMat = new THREE.MeshLambertMaterial({ color: 0x4466aa });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 2.0), bagMat);
  bag.position.y = 0.08;
  bag.receiveShadow = true;
  group.add(bag);

  // Pillow
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0x8899bb });
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), pillowMat);
  pillow.position.set(0, 0.2, -0.7);
  group.add(pillow);

  scene.add(group);
  bedMesh = group;
}

function isNearBed() {
  if (!playerRef) return false;
  const dx = playerRef.position.x - BED_POS.x;
  const dz = playerRef.position.z - BED_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < BED_RADIUS;
}

// --- Sleep confirmation dialog ---
function createSleepConfirm() {
  sleepConfirmEl = document.createElement('div');
  Object.assign(sleepConfirmEl.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(8,8,18,0.95)',
    border: '1px solid rgba(100,180,255,0.2)',
    borderRadius: '12px',
    padding: '20px 30px',
    fontFamily: 'monospace', fontSize: '16px', color: '#fff',
    textAlign: 'center',
    zIndex: '400',
    display: 'none',
  });
  sleepConfirmEl.innerHTML = `
    <div style="margin-bottom:14px">Sleep until morning?</div>
    <div style="font-size:12px;color:#666">Press <span style="color:#6cf">E</span> to sleep &middot; <span style="color:#888">Esc</span> to cancel</div>
  `;
  document.body.appendChild(sleepConfirmEl);
}

function showSleepConfirm() {
  if (!canSleep()) return;
  sleepConfirmEl.style.display = 'block';
  sleepConfirmVisible = true;
  document.exitPointerLock();
}

function confirmSleep(yes) {
  sleepConfirmEl.style.display = 'none';
  sleepConfirmVisible = false;
  if (yes) {
    startSleep();
  }
}

function tryStartSearch() {
  if (isFull()) {
    showInventoryFull();
    return;
  }
  const nearest = getNearestSearchable();
  if (!nearest) return;

  searching = true;
  searchTarget = nearest;
  searchTimer = 0;
  searchStartPos.copy(playerRef.position);
  playSearchScrape();
}

function getNearestSearchable() {
  let best = null;
  let bestDist = SEARCH_RADIUS;
  const playerXZ = new THREE.Vector2(playerRef.position.x, playerRef.position.z);

  for (const pile of piles) {
    if (pile.searched) continue;
    const pileXZ = new THREE.Vector2(pile.worldPos.x, pile.worldPos.z);
    const dist = playerXZ.distanceTo(pileXZ);
    if (dist < bestDist) {
      bestDist = dist;
      best = pile;
    }
  }
  return best;
}

function cancelSearch() {
  searching = false;
  searchTarget = null;
  searchTimer = 0;
  hideProgress();
}

function completeSearch() {
  // Loot table: products and materials
  const roll = Math.random();
  let type, subtype, count = 1;

  if (roll < 0.25) {
    // 25% — finished sticker
    type = 'sticker';
  } else if (roll < 0.45) {
    // 20% — finished plushie
    type = 'plushie';
  } else if (roll < 0.65) {
    // 20% — sticker paper (2-4 sheets)
    type = 'material'; subtype = 'sticker_paper';
    count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
  } else if (roll < 0.80) {
    // 15% — fabric scrap
    type = 'material'; subtype = 'fabric_scrap';
  } else if (roll < 0.90) {
    // 10% — stuffing bag
    type = 'material'; subtype = 'stuffing';
  } else if (roll < 0.95) {
    // 5% — capsule shell (rare)
    type = 'material'; subtype = 'capsule_shell';
  } else {
    // 5% — thread spool
    type = 'material'; subtype = 'thread_spool';
  }

  let added = false;
  if (type === 'material') {
    // Add multiple for sticker_paper, single for others
    for (let i = 0; i < count; i++) {
      if (addItem('material', subtype)) added = true;
      else break;
    }
  } else {
    added = addItem(type);
  }

  if (added) {
    playItemFound(type === 'material' ? 'sticker' : type); // reuse sticker sound for materials
  } else {
    showInventoryFull();
  }

  // Spawn dust particles at search location
  spawnSearchDust(searchTarget.worldPos);

  // Mark pile as searched — hide glow
  searchTarget.searched = true;
  searchTarget.glow.visible = false;
  searchTarget.light.visible = false;

  searching = false;
  searchTarget = null;
  searchTimer = 0;
  hideProgress();
}

function checkRuinsTransition() {
  const inRuins = playerRef.position.z < ruinsZStart;

  // Player just left the ruins — respawn all piles and reset NPC purchases
  if (wasInRuins && !inRuins) {
    for (const pile of piles) {
      pile.searched = false;
      pile.glow.visible = true;
      pile.light.visible = true;
    }
    resetNPCPurchases(npcs);
  }
  wasInRuins = inRuins;
}

export function updateInteraction(dt) {
  if (!playerRef) return;

  // Don't update prompts while deal panel, phone, or any station UI is open
  if (isDealOpen() || isPrintStationOpen() || isCuttingTableOpen() || isSewingMachineOpen() || isStuffingStationOpen()) return;

  checkRuinsTransition();

  // Check if player moved during search (cancel if so)
  if (searching) {
    const moved = playerRef.position.distanceTo(searchStartPos) > 0.3;
    if (moved) {
      cancelSearch();
    } else {
      searchTimer += dt;
      showProgress(searchTimer / SEARCH_DURATION);
      if (searchTimer >= SEARCH_DURATION) {
        completeSearch();
        return;
      }
    }
  }

  // Show prompt based on context
  if (isSleepingNow() || sleepConfirmVisible) return;

  const nearCuttingTable = isNearCuttingTable(playerRef.position);
  const nearSewingMachine = isNearSewingMachine(playerRef.position);
  const nearStuffingStation = isNearStuffingStation(playerRef.position);
  const nearPrintStation = isNearPrintStation(playerRef.position);
  const nearGacha = isGachaUnlocked() && isNearGachaMachine(playerRef.position);
  const nearKit = isKitAvailable() && isNearKit(playerRef.position);
  const waypoint = getActiveWaypointNearPlayer(playerRef.position);
  const nearNPC = getNearestNPC(npcs, playerRef.position);
  const nearPile = getNearestSearchable();
  const nearBed = isNearBed();

  if (nearCuttingTable && !searching) {
    showPrompt('Press E to use Cutting Table');
  } else if (nearSewingMachine && !searching) {
    showPrompt('Press E to use Sewing Machine');
  } else if (nearStuffingStation && !searching) {
    showPrompt('Press E to use Stuffing Station');
  } else if (nearPrintStation && !searching) {
    showPrompt('Press E to use print station');
  } else if (nearGacha && !searching) {
    showPrompt('Press E to use gacha machine');
  } else if (nearKit && !searching) {
    showPrompt('Press E to shop');
  } else if (nearBed && !searching) {
    showPrompt('Press E to sleep');
  } else if (waypoint && !searching) {
    showPrompt('Press E to meet');
  } else if (nearNPC && !searching) {
    showPrompt('Press E to talk');
  } else if (nearPile && !searching) {
    showPrompt('Press E to search');
  } else if (!searching) {
    hidePrompt();
  } else {
    showPrompt('Searching...');
  }
}
