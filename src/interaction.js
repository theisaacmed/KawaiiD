// Interaction system — proximity detection, search mechanic, respawn, NPC talk, sleeping
// Street encounters: walk up to NPC and press E (40% chance they refuse)
// Waypoint meetups: NPC always accepts when you reach their requested meetup point

import * as THREE from 'three';
import { addItem, isFull } from './inventory.js';
import { showPrompt, hidePrompt, showProgress, hideProgress, showInventoryFull } from './hud.js';
import { getNearestNPC, resetNPCPurchases } from './npc.js';
import { openDealPanel, isDealOpen, setLocationRefuseCallback } from './dealing.js';
import { getActiveWaypointNearPlayer, completeWaypoint, isPhoneVisible, closePhone } from './phone.js';
import { spawnSearchDust } from './particles.js';
import { canSleep, startSleep, isSleepingNow } from './time-system.js';
import { playSearchScrape, playItemFound } from './audio.js';
import { isTutorialDealStep } from './tutorial.js';

const SEARCH_RADIUS = 3;
const SEARCH_DURATION = 2.5; // seconds (snappier feel)
const STREET_REFUSE_CHANCE = 0.40; // 40% chance NPC refuses cold approach
const BED_RADIUS = 2.5; // how close to be to the bed

// Bed/sleeping spot at player apartment (origin)
const BED_POS = new THREE.Vector3(8.4, 0, 7.2);

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

// Found item toast
let foundToast = null;
let foundTimeout = null;

function showFoundToast(type) {
  if (!foundToast) {
    foundToast = document.createElement('div');
    Object.assign(foundToast.style, {
      position: 'fixed', bottom: '140px', left: '50%',
      transform: 'translateX(-50%) scale(0.8)',
      background: 'rgba(40,160,100,0.9)', color: '#fff',
      fontFamily: 'monospace', fontSize: '15px', fontWeight: 'bold',
      padding: '10px 22px', borderRadius: '8px',
      pointerEvents: 'none', zIndex: '160',
      display: 'none',
      transition: 'opacity 0.4s, transform 0.3s',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(foundToast);
  }
  const label = type === 'sticker' ? 'Old Sticker' : 'Old Plushie';
  const icon = type === 'sticker' ? '\u2B50' : '\uD83E\uDDF8';
  foundToast.textContent = `Found: ${label} ${icon}`;
  foundToast.style.display = 'block';
  foundToast.style.opacity = '1';
  foundToast.style.transform = 'translateX(-50%) scale(1)';
  clearTimeout(foundTimeout);
  foundTimeout = setTimeout(() => {
    foundToast.style.opacity = '0';
    foundToast.style.transform = 'translateX(-50%) scale(0.9)';
    setTimeout(() => { foundToast.style.display = 'none'; }, 400);
  }, 1800);
}

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
    if (e.code === 'KeyE' && !searching && !isDealOpen() && !isSleepingNow()) {
      // Close phone if open
      if (isPhoneVisible()) closePhone();

      // Handle sleep confirmation dialog
      if (sleepConfirmVisible) {
        confirmSleep(true);
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
        // Street encounter — chance of refusal (bypassed during tutorial deal step)
        if (!isTutorialDealStep() && nearNPC.purchaseCount >= nearNPC.maxPurchases) {
          showRefusal(nearNPC.limitLine);
          return;
        }
        if (!isTutorialDealStep() && Math.random() < STREET_REFUSE_CHANCE) {
          const refuseLine = nearNPC.streetRefuseLines
            ? nearNPC.streetRefuseLines[Math.floor(Math.random() * nearNPC.streetRefuseLines.length)]
            : "Not right now.";
          showRefusal(refuseLine);
          return;
        }
        openDealPanel(nearNPC, isTutorialDealStep());
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
  // Simplified loot table: only stickers and plushies (core loop)
  const roll = Math.random();
  let type, subtype;

  if (roll < 0.55) {
    // 55% — old sticker
    type = 'sticker'; subtype = 'old';
  } else {
    // 45% — old plushie
    type = 'plushie'; subtype = 'old';
  }

  const added = addItem(type, subtype);

  if (added) {
    playItemFound(type);
    showFoundToast(type);
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

  // Don't update prompts while deal panel is open
  if (isDealOpen()) return;

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

  // Show prompt based on context (core only)
  if (isSleepingNow() || sleepConfirmVisible) return;

  const waypoint = getActiveWaypointNearPlayer(playerRef.position);
  const nearNPC = getNearestNPC(npcs, playerRef.position);
  const nearPile = getNearestSearchable();
  const nearBed = isNearBed();

  if (nearBed && !searching) {
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
