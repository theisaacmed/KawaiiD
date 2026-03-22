// Station Shop — purchase workshop stations for the apartment
// Player interacts with a small counter in the apartment (E key).
// Stations start hidden; purchasing reveals them and enables interaction.

import * as THREE from 'three';
import { getMoney, deductMoney } from './inventory.js';
import { getCurrentRankIndex } from './jp-system.js';
import { showFloatingMoney } from './hud.js';
import { setStationEnabled as enablePrint }    from './stations/print-station.js';
import { setStationEnabled as enableCutting }  from './stations/cutting-table.js';
import { setStationEnabled as enableSewing }   from './stations/sewing-machine.js';
import { setStationEnabled as enableStuffing } from './stations/stuffing-station.js';
import { unlockGacha } from './gacha.js';

// ========== CATALOG ==========

export const STATION_CATALOG = [
  {
    id: 'print_station',
    name: 'Print Station',
    desc: 'Converts sticker paper into fresh stickers.',
    price: 50,
    rankRequired: 0,
    rankName: null,
    requires: null,
  },
  {
    id: 'stuffing_station',
    name: 'Stuffing Station',
    desc: 'Stuffs plushie shells with fluff.',
    price: 75,
    rankRequired: 0,
    rankName: null,
    requires: null,
  },
  {
    id: 'cutting_table',
    name: 'Cutting Table',
    desc: 'Cuts fabric into plushie shells.',
    price: 100,
    rankRequired: 0,
    rankName: null,
    requires: null,
  },
  {
    id: 'sewing_machine',
    name: 'Sewing Machine',
    desc: 'Sews fabric into plushie bodies. The main bottleneck.',
    price: 200,
    rankRequired: 0,
    rankName: null,
    requires: null,
  },
  {
    id: 'gacha_machine',
    name: 'Gacha Machine',
    desc: 'Creates gacha capsules. Premium tier dealing.',
    price: 300,
    rankRequired: 3,
    rankName: 'Supplier',
    requires: null,
  },
  {
    id: 'mk2_print',
    name: 'Print Station Mk2',
    desc: 'Doubled print speed. Worth the cost.',
    price: 500,
    rankRequired: 0,
    rankName: null,
    requires: 'print_station',
  },
  {
    id: 'mk2_stuffing',
    name: 'Stuffing Station Mk2',
    desc: 'Auto-stuffing mechanism. Much faster.',
    price: 500,
    rankRequired: 0,
    rankName: null,
    requires: 'stuffing_station',
  },
  {
    id: 'mk2_cutting',
    name: 'Cutting Table Mk2',
    desc: 'Precision blade. Reduced material waste.',
    price: 500,
    rankRequired: 0,
    rankName: null,
    requires: 'cutting_table',
  },
  {
    id: 'mk2_sewing',
    name: 'Sewing Machine Mk2',
    desc: 'Industrial motor. Doubles throughput.',
    price: 500,
    rankRequired: 0,
    rankName: null,
    requires: 'sewing_machine',
  },
  {
    id: 'workshop_property',
    name: 'Workshop Space',
    desc: 'Rent a proper workshop. Expands everything.',
    price: 1000,
    rankRequired: 4,
    rankName: 'Smuggler',
    requires: null,
  },
];

// ========== STATE ==========

const purchased = {}; // id → true

// Counter mesh + proximity
const SHOP_POS = new THREE.Vector3(14.5, 0, 14);
const INTERACT_RADIUS = 2.0;
let counterMesh = null;
let isOpen = false;
let sceneRef = null;

// UI elements
let backdrop = null;
let panel = null;

// ========== PUBLIC API ==========

export function isStationPurchased(id) {
  return !!purchased[id];
}

export function isNearStationShop(playerPos) {
  if (!counterMesh) return false;
  const dx = playerPos.x - SHOP_POS.x;
  const dz = playerPos.z - SHOP_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function isStationShopOpen() { return isOpen; }

export function getStationShopSaveData() {
  return { purchased: { ...purchased } };
}

export function restoreStationShopState(data) {
  if (!data || !data.purchased) return;
  for (const [id, val] of Object.entries(data.purchased)) {
    if (val) {
      purchased[id] = true;
      _applyPurchase(id, false); // apply without sound/notification
    }
  }
}

// Apply purchased stations on load
export function applyRestoredPurchases() {
  for (const id of Object.keys(purchased)) {
    _applyPurchase(id, false);
  }
}

// ========== INIT ==========

export function initStationShop(scene) {
  sceneRef = scene;
  createCounter(scene);
  createUI();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isOpen) closeUI();
  });
}

// ========== COUNTER MESH ==========

function createCounter(scene) {
  const group = new THREE.Group();
  group.position.copy(SHOP_POS);

  // Counter body
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 0.5), bodyMat);
  body.position.y = 0.375;
  body.castShadow = true;
  group.add(body);

  // Counter top (slightly lighter)
  const topMat = new THREE.MeshLambertMaterial({ color: 0xa08060 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.6), topMat);
  top.position.y = 0.775;
  group.add(top);

  // Small sign on top
  const signMat = new THREE.MeshLambertMaterial({ color: 0xf5e6c8 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.04), signMat);
  sign.position.set(0, 1.0, -0.2);
  group.add(sign);

  // Sign border
  const borderMat = new THREE.MeshLambertMaterial({ color: 0xc8a878 });
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.02), borderMat);
  border.position.set(0, 1.0, -0.21);
  group.add(border);

  scene.add(group);
  counterMesh = group;
}

// ========== UI ==========

function createUI() {
  backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.55)',
    display: 'none', zIndex: '200',
    fontFamily: 'monospace',
  });
  document.body.appendChild(backdrop);

  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1a1a2e',
    border: '2px solid #a08060',
    borderRadius: '10px',
    padding: '20px 24px',
    minWidth: '380px',
    maxWidth: '480px',
    maxHeight: '80vh',
    overflowY: 'auto',
    color: '#f0e6d0',
    zIndex: '201',
    display: 'none',
  });
  document.body.appendChild(panel);
}

export function openStationShopUI() {
  if (isOpen) return;
  isOpen = true;
  renderUI();
  backdrop.style.display = 'block';
  panel.style.display = 'block';

  backdrop.onclick = () => closeUI();
}

function closeUI() {
  isOpen = false;
  backdrop.style.display = 'none';
  panel.style.display = 'none';
}

function renderUI() {
  const money = getMoney();
  const rank = getCurrentRankIndex();

  panel.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.textContent = 'Workshop Catalog';
  Object.assign(title.style, {
    fontSize: '18px', fontWeight: 'bold',
    color: '#f5c842', marginBottom: '6px',
    textAlign: 'center', letterSpacing: '1px',
  });
  panel.appendChild(title);

  // Money display
  const moneyEl = document.createElement('div');
  moneyEl.textContent = `$${money.toFixed(0)} on hand`;
  Object.assign(moneyEl.style, {
    fontSize: '12px', color: '#aaa',
    textAlign: 'center', marginBottom: '16px',
  });
  panel.appendChild(moneyEl);

  // Divider
  const div = document.createElement('hr');
  Object.assign(div.style, { borderColor: '#a08060', marginBottom: '12px' });
  panel.appendChild(div);

  // Station rows
  for (const station of STATION_CATALOG) {
    panel.appendChild(buildRow(station, money, rank));
  }

  // Close hint
  const hint = document.createElement('div');
  hint.textContent = '[Esc] Close';
  Object.assign(hint.style, {
    fontSize: '11px', color: '#666',
    textAlign: 'center', marginTop: '14px',
  });
  panel.appendChild(hint);
}

function buildRow(station, money, rank) {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '8px 0',
    borderBottom: '1px solid #2a2a3e',
    gap: '10px',
  });

  const alreadyOwned = !!purchased[station.id];
  const cantAfford = money < station.price;
  const rankLocked = rank < station.rankRequired;
  const missingReq = station.requires && !purchased[station.requires];
  const unavailable = !alreadyOwned && (cantAfford || rankLocked || missingReq);

  // Info side
  const info = document.createElement('div');
  info.style.flex = '1';

  const nameEl = document.createElement('div');
  nameEl.textContent = station.name;
  Object.assign(nameEl.style, {
    fontWeight: 'bold',
    fontSize: '13px',
    color: alreadyOwned ? '#6a8a6a' : unavailable ? '#666' : '#f0e6d0',
  });
  info.appendChild(nameEl);

  const descEl = document.createElement('div');
  descEl.textContent = station.desc;
  Object.assign(descEl.style, {
    fontSize: '11px',
    color: alreadyOwned ? '#558855' : '#888',
    marginTop: '2px',
  });
  info.appendChild(descEl);

  // Lock reason
  if (!alreadyOwned) {
    let lockText = null;
    if (rankLocked) {
      lockText = `Requires rank: ${station.rankName}`;
    } else if (missingReq) {
      const reqDef = STATION_CATALOG.find(s => s.id === station.requires);
      lockText = `Requires: ${reqDef ? reqDef.name : station.requires}`;
    } else if (cantAfford) {
      lockText = `Need $${station.price - money} more`;
    }
    if (lockText) {
      const lock = document.createElement('div');
      lock.textContent = lockText;
      Object.assign(lock.style, { fontSize: '10px', color: '#c06060', marginTop: '3px' });
      info.appendChild(lock);
    }
  }

  row.appendChild(info);

  // Action side
  const action = document.createElement('div');
  action.style.flexShrink = '0';

  if (alreadyOwned) {
    const badge = document.createElement('div');
    badge.textContent = '✓ Owned';
    Object.assign(badge.style, {
      fontSize: '12px', color: '#6a8a6a',
      padding: '4px 8px',
      border: '1px solid #3a5a3a',
      borderRadius: '4px',
    });
    action.appendChild(badge);
  } else {
    const btn = document.createElement('button');
    btn.textContent = `$${station.price}`;
    Object.assign(btn.style, {
      fontSize: '13px', fontWeight: 'bold',
      fontFamily: 'monospace',
      padding: '5px 12px',
      borderRadius: '5px',
      border: 'none',
      cursor: unavailable ? 'not-allowed' : 'pointer',
      background: unavailable ? '#333' : '#c8a050',
      color: unavailable ? '#555' : '#1a1a0a',
      opacity: unavailable ? '0.7' : '1',
    });

    if (!unavailable) {
      btn.onclick = () => {
        if (buyStation(station.id)) {
          renderUI(); // refresh panel
        }
      };
    }
    action.appendChild(btn);
  }

  row.appendChild(action);
  return row;
}

// ========== PURCHASE LOGIC ==========

function buyStation(id) {
  const station = STATION_CATALOG.find(s => s.id === id);
  if (!station) return false;
  if (purchased[id]) return false;
  if (getMoney() < station.price) return false;
  if (getCurrentRankIndex() < station.rankRequired) return false;
  if (station.requires && !purchased[station.requires]) return false;

  deductMoney(station.price);
  purchased[id] = true;
  _applyPurchase(id, true);

  showFloatingMoney(-station.price);
  return true;
}

function _applyPurchase(id, withEffect) {
  switch (id) {
    case 'print_station':    enablePrint(true);    break;
    case 'cutting_table':    enableCutting(true);  break;
    case 'sewing_machine':   enableSewing(true);   break;
    case 'stuffing_station': enableStuffing(true); break;
    case 'gacha_machine':    unlockGacha();        break;
    // mk2 upgrades and workshop_property noted but no mesh change yet
    default: break;
  }
}
