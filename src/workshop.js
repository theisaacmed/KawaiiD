// Workshop — Industrial district second production location
// Unlocks at Rank 5 (Distributor) for $1000 via the station shop.
// Provides 30-slot storage and 2x of each station type with separate queues.
// Mk2 per station: 35% faster, $500 each.

import * as THREE from 'three';
import { getMoney, deductMoney, getSlots, addItem, removeFromSlot } from './inventory.js';
import { getCurrentRankIndex } from './jp-system.js';
import { showFloatingMoney } from './hud.js';

// workshop_property building center is at x:35, z:-88 (14w × 11d)
// Entrance is at the south face: z = -88 + 11/2 = -82.5
const WORKSHOP_POS = new THREE.Vector3(35, 0, -82.5);
const INTERACT_RADIUS = 2.5;

// 30-slot storage
const STORAGE_SIZE = 30;
let storage = Array.from({ length: STORAGE_SIZE }, () => null); // null | {type, count, subtype?}

// Station types mirrored in the workshop (separate from apartment stations)
const STATION_TYPES = ['print', 'cutting', 'sewing', 'stuffing'];
// stationType → { mk2: bool }
const stationFlags = {};
for (const t of STATION_TYPES) stationFlags[t] = { mk2: false };

let workshopPurchased = false;
let storageOpen = false;
let playerRef = null;

// UI elements
let promptEl = null;
let storageBackdrop = null;
let storagePanel = null;

// ==============================
// Public API
// ==============================

export function isWorkshopPurchased() { return workshopPurchased; }

export function purchaseWorkshop() {
  workshopPurchased = true;
}

export function isWorkshopStorageOpen() { return storageOpen; }

export function isNearWorkshopBuilding(playerPos) {
  if (!playerRef) return false;
  const pos = playerPos || playerRef.position;
  const dx = pos.x - WORKSHOP_POS.x;
  const dz = pos.z - WORKSHOP_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function getWorkshopState() {
  return {
    purchased: workshopPurchased,
    storage: storage.map(s => s ? { ...s } : null),
    stationFlags: Object.fromEntries(STATION_TYPES.map(t => [t, { mk2: stationFlags[t].mk2 }])),
  };
}

export function restoreWorkshopState(data) {
  if (!data) return;
  workshopPurchased = !!data.purchased;
  if (data.storage) {
    data.storage.forEach((s, i) => { storage[i] = s ? { ...s } : null; });
  }
  if (data.stationFlags) {
    for (const t of STATION_TYPES) {
      if (data.stationFlags[t]) {
        stationFlags[t].mk2 = !!data.stationFlags[t].mk2;
      }
    }
  }
}

// Apply Mk2 upgrade for a workshop station (called from station-shop)
export function applyWorkshopMk2(stationType) {
  if (stationFlags[stationType]) stationFlags[stationType].mk2 = true;
}

export function isWorkshopMk2(stationType) {
  return !!(stationFlags[stationType] && stationFlags[stationType].mk2);
}

// ==============================
// Init
// ==============================

export function initWorkshop(scene, player) {
  playerRef = player;
  createSignMesh(scene);
  createPromptEl();
  createStorageUI();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && storageOpen) closeStorageUI();
  });
}

// ==============================
// Game loop update
// ==============================

export function updateWorkshop() {
  if (!workshopPurchased || !playerRef) {
    if (promptEl && promptEl.style.display !== 'none') promptEl.style.display = 'none';
    return;
  }

  const near = isNearWorkshopBuilding(playerRef.position);
  if (promptEl) {
    promptEl.style.display = near && !storageOpen ? 'block' : 'none';
  }
}

// ==============================
// Scene geometry — sign post outside workshop building
// ==============================

function createSignMesh(scene) {
  const group = new THREE.Group();
  group.position.set(WORKSHOP_POS.x, 0, WORKSHOP_POS.z);

  const postMat = new THREE.MeshLambertMaterial({ color: 0x7a6040 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), postMat);
  post.position.y = 0.75;
  group.add(post);

  const signMat = new THREE.MeshLambertMaterial({ color: 0x8fcf8f });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.06), signMat);
  sign.position.y = 1.5;
  group.add(sign);

  // Small border around sign
  const borderMat = new THREE.MeshLambertMaterial({ color: 0x5a9a5a });
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.39, 0.04), borderMat);
  border.position.y = 1.5;
  border.position.z = -0.015;
  group.add(border);

  scene.add(group);
}

// ==============================
// Proximity prompt
// ==============================

function createPromptEl() {
  promptEl = document.createElement('div');
  Object.assign(promptEl.style, {
    position: 'fixed', bottom: '80px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.75)', color: '#8fcf8f',
    fontFamily: 'monospace', fontSize: '14px',
    padding: '6px 18px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '80',
    display: 'none',
  });
  promptEl.textContent = '[E] Open Workshop Storage';
  document.body.appendChild(promptEl);
}

// ==============================
// Storage UI
// ==============================

function createStorageUI() {
  storageBackdrop = document.createElement('div');
  Object.assign(storageBackdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.6)',
    display: 'none', zIndex: '210',
    fontFamily: 'monospace',
  });
  document.body.appendChild(storageBackdrop);

  storagePanel = document.createElement('div');
  Object.assign(storagePanel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#131a13',
    border: '2px solid #5a9a5a',
    borderRadius: '10px',
    padding: '20px 24px',
    width: '520px',
    maxHeight: '80vh',
    overflowY: 'auto',
    color: '#dff0df',
    zIndex: '211',
    display: 'none',
  });
  document.body.appendChild(storagePanel);
}

export function openStorageUI() {
  if (storageOpen || !workshopPurchased) return;
  storageOpen = true;
  renderStorageUI();
  storageBackdrop.style.display = 'block';
  storagePanel.style.display = 'block';
  storageBackdrop.onclick = () => closeStorageUI();
}

export function closeStorageUI() {
  storageOpen = false;
  if (storageBackdrop) storageBackdrop.style.display = 'none';
  if (storagePanel) storagePanel.style.display = 'none';
}

function renderStorageUI() {
  storagePanel.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Workshop Storage';
  Object.assign(title.style, {
    fontSize: '18px', fontWeight: 'bold',
    color: '#8fcf8f', marginBottom: '4px', textAlign: 'center',
  });
  storagePanel.appendChild(title);

  const hint = document.createElement('div');
  hint.textContent = 'Click a slot to transfer items between storage and inventory.';
  Object.assign(hint.style, { fontSize: '11px', color: '#777', marginBottom: '14px', textAlign: 'center' });
  storagePanel.appendChild(hint);

  // Mk2 status row
  const mk2Row = document.createElement('div');
  Object.assign(mk2Row.style, {
    display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', justifyContent: 'center',
  });
  for (const t of STATION_TYPES) {
    const badge = document.createElement('div');
    const hasMk2 = stationFlags[t].mk2;
    badge.textContent = t.charAt(0).toUpperCase() + t.slice(1) + (hasMk2 ? ' Mk2 ✓' : ' Mk2 ✗');
    Object.assign(badge.style, {
      fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
      background: hasMk2 ? '#1a3a1a' : '#1e1e1e',
      color: hasMk2 ? '#8fcf8f' : '#555',
      border: '1px solid ' + (hasMk2 ? '#5a9a5a' : '#333'),
    });
    mk2Row.appendChild(badge);
  }
  storagePanel.appendChild(mk2Row);

  // Storage grid label
  const storLabel = document.createElement('div');
  storLabel.textContent = `Storage (${storage.filter(Boolean).length}/${STORAGE_SIZE})`;
  Object.assign(storLabel.style, { fontSize: '12px', color: '#999', marginBottom: '6px' });
  storagePanel.appendChild(storLabel);

  const storGrid = buildGrid(
    storage,
    (i) => {
      moveStorageToInventory(i);
      renderStorageUI();
    },
    '#2a3a2a', '#5a8a5a', '#c8f0c8'
  );
  storagePanel.appendChild(storGrid);

  // Inventory grid label
  const invLabel = document.createElement('div');
  invLabel.textContent = 'Inventory — click to store';
  Object.assign(invLabel.style, { fontSize: '12px', color: '#999', margin: '12px 0 6px' });
  storagePanel.appendChild(invLabel);

  const invSlots = getSlots();
  const invGrid = buildGrid(
    invSlots.map(s => s.type ? { type: s.type, count: s.count, subtype: s.subtype } : null),
    (i) => {
      moveInventoryToStorage(i);
      renderStorageUI();
    },
    '#2a2a3a', '#5a5a8a', '#c8c8f0'
  );
  storagePanel.appendChild(invGrid);

  const closeHint = document.createElement('div');
  closeHint.textContent = '[Esc] Close';
  Object.assign(closeHint.style, { fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '12px' });
  storagePanel.appendChild(closeHint);
}

function buildGrid(items, onClickFilled, bgFilled, borderFilled, textColor) {
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '4px',
  });

  const total = Math.max(items.length, 6);
  for (let i = 0; i < total; i++) {
    const item = items[i];
    const cell = document.createElement('div');
    Object.assign(cell.style, {
      background: item ? bgFilled : '#1a1a1a',
      border: '1px solid ' + (item ? borderFilled : '#2a2a2a'),
      borderRadius: '4px',
      padding: '5px 3px',
      textAlign: 'center',
      cursor: item ? 'pointer' : 'default',
      fontSize: '10px',
      minHeight: '38px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    });
    if (item) {
      const nameEl = document.createElement('div');
      nameEl.textContent = item.subtype ? item.subtype.replace(/_/g, ' ') : item.type;
      nameEl.style.color = textColor;
      nameEl.style.fontWeight = 'bold';
      const countEl = document.createElement('div');
      countEl.textContent = 'x' + item.count;
      countEl.style.color = '#888';
      cell.appendChild(nameEl);
      cell.appendChild(countEl);
      cell.onclick = () => onClickFilled(i);
      cell.title = 'Click to transfer';
    }
    grid.appendChild(cell);
  }
  return grid;
}

function moveStorageToInventory(slotIndex) {
  const item = storage[slotIndex];
  if (!item) return;
  const sub = item.subtype || undefined;
  let added = 0;
  for (let i = 0; i < item.count; i++) {
    if (addItem(item.type, sub)) added++;
    else break;
  }
  if (added > 0) {
    if (added >= item.count) {
      storage[slotIndex] = null;
    } else {
      item.count -= added;
    }
  }
}

function moveInventoryToStorage(invIndex) {
  const slots = getSlots();
  if (invIndex < 0 || invIndex >= slots.length) return;
  const s = slots[invIndex];
  if (!s || !s.type) return;

  const emptyIdx = storage.findIndex(slot => slot === null);
  if (emptyIdx === -1) return; // storage full

  const count = s.count;
  const entry = { type: s.type, count };
  if (s.subtype) entry.subtype = s.subtype;
  storage[emptyIdx] = entry;

  // Remove all items from this inventory slot (removeFromSlot removes 1 at a time)
  for (let i = 0; i < count; i++) {
    removeFromSlot(invIndex);
  }
}
