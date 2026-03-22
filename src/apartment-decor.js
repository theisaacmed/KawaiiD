// Apartment Customization — 8 decoration spots inside the player apartment.
// Each spot accepts specific item types and displays a small colored mesh.
// Placing an item removes it from inventory and adds +0.05 to colorAmount.

import * as THREE from 'three';
import { getSlots, removeFromSlot } from './inventory.js';

// Decor spots — positions are world-space inside the apartment.
// For proximity checks we use flat x,z distance only.
const DECOR_SPOTS = [
  {
    id: 'bed',
    pos: new THREE.Vector3(13.5, 0.32, 12.2),
    allowed: ['plushie'],
    label: 'Bed',
    meshColor: 0xff88bb,
    meshScale: new THREE.Vector3(0.25, 0.22, 0.22),
  },
  {
    id: 'wall1',
    pos: new THREE.Vector3(9.3, 1.2, 13.0),
    allowed: ['sticker'],
    label: 'West Wall (A)',
    meshColor: 0xffdd55,
    meshScale: new THREE.Vector3(0.18, 0.18, 0.04),
  },
  {
    id: 'wall2',
    pos: new THREE.Vector3(9.3, 1.6, 14.0),
    allowed: ['sticker'],
    label: 'West Wall (B)',
    meshColor: 0xff6688,
    meshScale: new THREE.Vector3(0.18, 0.18, 0.04),
  },
  {
    id: 'wall3',
    pos: new THREE.Vector3(9.3, 1.2, 15.0),
    allowed: ['sticker'],
    label: 'West Wall (C)',
    meshColor: 0x88ddff,
    meshScale: new THREE.Vector3(0.18, 0.18, 0.04),
  },
  {
    id: 'shelf1',
    pos: new THREE.Vector3(11.2, 0.85, 11.4),
    allowed: ['gacha'],
    label: 'South Shelf (L)',
    meshColor: 0xcc88ff,
    meshScale: new THREE.Vector3(0.14, 0.14, 0.14),
  },
  {
    id: 'shelf2',
    pos: new THREE.Vector3(12.2, 0.85, 11.4),
    allowed: ['gacha'],
    label: 'South Shelf (M)',
    meshColor: 0xff88cc,
    meshScale: new THREE.Vector3(0.14, 0.14, 0.14),
  },
  {
    id: 'shelf3',
    pos: new THREE.Vector3(13.2, 0.85, 11.4),
    allowed: ['gacha'],
    label: 'South Shelf (R)',
    meshColor: 0x88ffcc,
    meshScale: new THREE.Vector3(0.14, 0.14, 0.14),
  },
  {
    id: 'desk',
    pos: new THREE.Vector3(12.0, 0.68, 14.0),
    allowed: null, // any item
    label: 'Desk',
    meshColor: 0xffffff,
    meshScale: new THREE.Vector3(0.18, 0.12, 0.18),
  },
];

const SPOT_RADIUS = 1.4; // flat x,z interact distance

// Internal state
const placedItems = {}; // spotId → {type, subtype?} | null
let colorAmount = 0;
let sceneRef = null;
const meshes = {}; // spotId → THREE.Mesh | null

// UI
let uiEl = null;
let uiOpen = false;
let activeSpotId = null;

// ==============================
// Public API
// ==============================

export function isDecorUIOpen() { return uiOpen; }

export function getNearestDecorSpot(playerPos) {
  for (const spot of DECOR_SPOTS) {
    const dx = playerPos.x - spot.pos.x;
    const dz = playerPos.z - spot.pos.z;
    if (Math.sqrt(dx * dx + dz * dz) < SPOT_RADIUS) return spot;
  }
  return null;
}

export function openDecorUI(spotId) {
  const spot = DECOR_SPOTS.find(s => s.id === spotId);
  if (!spot) return;
  activeSpotId = spotId;
  uiOpen = true;
  renderUI(spot);
  if (uiEl) uiEl.style.display = 'block';
}

export function closeDecorUI() {
  uiOpen = false;
  activeSpotId = null;
  if (uiEl) uiEl.style.display = 'none';
}

export function getDecorColorAmount() { return colorAmount; }

export function getDecorState() {
  return {
    placedItems: { ...placedItems },
    colorAmount,
  };
}

export function restoreDecorState(data) {
  if (!data) return;
  if (data.placedItems) {
    for (const [id, val] of Object.entries(data.placedItems)) {
      placedItems[id] = val;
      if (val && sceneRef) showMesh(id, val);
    }
  }
  if (data.colorAmount !== undefined) colorAmount = data.colorAmount;
}

export function placeItem(spotId, invSlotIndex) {
  const spot = DECOR_SPOTS.find(s => s.id === spotId);
  if (!spot) return false;
  if (placedItems[spotId]) return false; // already occupied

  const slots = getSlots();
  const slot = slots[invSlotIndex];
  if (!slot || !slot.type) return false;

  // Check allowed types
  if (spot.allowed && !spot.allowed.includes(slot.type)) return false;

  const item = { type: slot.type };
  if (slot.subtype) item.subtype = slot.subtype;

  // Remove one item from inventory
  removeFromSlot(invSlotIndex);
  placedItems[spotId] = item;
  colorAmount += 0.05;

  if (sceneRef) showMesh(spotId, item);
  return true;
}

export function removeItem(spotId) {
  if (!placedItems[spotId]) return false;
  placedItems[spotId] = null;
  colorAmount = Math.max(0, colorAmount - 0.05);
  hideMesh(spotId);
  return true;
}

// ==============================
// Init
// ==============================

export function initDecor(scene) {
  sceneRef = scene;
  createUI();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && uiOpen) closeDecorUI();
  });
}

// ==============================
// Scene meshes for placed items
// ==============================

function showMesh(spotId, item) {
  if (!sceneRef) return;
  hideMesh(spotId); // remove old if any

  const spot = DECOR_SPOTS.find(s => s.id === spotId);
  if (!spot) return;

  const color = spot.meshColor;
  const mat = new THREE.MeshLambertMaterial({ color });
  const geo = new THREE.BoxGeometry(spot.meshScale.x, spot.meshScale.y, spot.meshScale.z);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(spot.pos);
  mesh.castShadow = true;
  sceneRef.add(mesh);
  meshes[spotId] = mesh;
}

function hideMesh(spotId) {
  if (meshes[spotId]) {
    sceneRef.remove(meshes[spotId]);
    meshes[spotId] = null;
  }
}

// ==============================
// Placement UI
// ==============================

function createUI() {
  uiEl = document.createElement('div');
  Object.assign(uiEl.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1a1228',
    border: '2px solid #c088ff',
    borderRadius: '10px',
    padding: '18px 22px',
    minWidth: '300px',
    maxWidth: '400px',
    color: '#ede0ff',
    fontFamily: 'monospace',
    zIndex: '220',
    display: 'none',
  });
  document.body.appendChild(uiEl);
}

function renderUI(spot) {
  if (!uiEl) return;
  uiEl.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = spot.label;
  Object.assign(title.style, {
    fontSize: '16px', fontWeight: 'bold',
    color: '#c088ff', marginBottom: '4px', textAlign: 'center',
  });
  uiEl.appendChild(title);

  const allowedText = document.createElement('div');
  allowedText.textContent = spot.allowed ? `Accepts: ${spot.allowed.join(', ')}` : 'Accepts: any item';
  Object.assign(allowedText.style, { fontSize: '11px', color: '#888', marginBottom: '12px', textAlign: 'center' });
  uiEl.appendChild(allowedText);

  const currentItem = placedItems[spot.id];

  if (currentItem) {
    // Show current item with remove button
    const currentEl = document.createElement('div');
    const label = currentItem.subtype ? `${currentItem.type} (${currentItem.subtype})` : currentItem.type;
    currentEl.textContent = `Placed: ${label}`;
    Object.assign(currentEl.style, { fontSize: '13px', color: '#c8a0ff', marginBottom: '10px', textAlign: 'center' });
    uiEl.appendChild(currentEl);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove Item';
    styleBtn(removeBtn, '#4a2a5a', '#c088ff');
    removeBtn.onclick = () => {
      removeItem(spot.id);
      closeDecorUI();
    };
    uiEl.appendChild(removeBtn);
  } else {
    // List inventory items that can be placed
    const slots = getSlots();
    const eligible = slots
      .map((s, i) => ({ ...s, invIndex: i }))
      .filter(s => s.type && (spot.allowed === null || spot.allowed.includes(s.type)));

    if (eligible.length === 0) {
      const none = document.createElement('div');
      none.textContent = 'No eligible items in inventory.';
      Object.assign(none.style, { fontSize: '12px', color: '#666', textAlign: 'center', marginBottom: '10px' });
      uiEl.appendChild(none);
    } else {
      const listLabel = document.createElement('div');
      listLabel.textContent = 'Choose item to place:';
      Object.assign(listLabel.style, { fontSize: '12px', color: '#888', marginBottom: '8px' });
      uiEl.appendChild(listLabel);

      for (const s of eligible) {
        const btn = document.createElement('button');
        const label = s.subtype ? `${s.type} (${s.subtype}) x${s.count}` : `${s.type} x${s.count}`;
        btn.textContent = label;
        styleBtn(btn, '#2a1a3a', '#c088ff');
        btn.style.marginBottom = '6px';
        btn.onclick = () => {
          placeItem(spot.id, s.invIndex);
          closeDecorUI();
        };
        uiEl.appendChild(btn);
      }
    }
  }

  const closeHint = document.createElement('div');
  closeHint.textContent = '[Esc] Close';
  Object.assign(closeHint.style, { fontSize: '10px', color: '#444', textAlign: 'center', marginTop: '10px' });
  uiEl.appendChild(closeHint);
}

function styleBtn(btn, bg, color) {
  Object.assign(btn.style, {
    display: 'block', width: '100%',
    background: bg, color,
    border: '1px solid ' + color,
    borderRadius: '5px',
    padding: '6px 10px',
    fontFamily: 'monospace', fontSize: '12px',
    cursor: 'pointer',
    marginBottom: '4px',
  });
}
