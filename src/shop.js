// Kit's Supply Shop — material purchasing UI, daily stock, Kit NPC mesh
// Kit is a static supplier NPC in a hidden alley in Town district

import * as THREE from 'three';
import { MATERIALS, getMaterialIconStyle } from './materials.js';
import { addItem, getMoney, deductMoney, isFull, roomFor } from './inventory.js';
import { showInventoryFull } from './hud.js';
import { isNPCActive } from './time-system.js';
import { getTerrainHeight } from './world.js';

// Kit's position — hidden alley off a secondary road in Town
const KIT_POS = new THREE.Vector3(28, 0, 25);
const KIT_INTERACT_RADIUS = 3;

// Purchasable materials (exclude fabric_scrap — ruins only)
const SHOP_ITEMS = ['sticker_paper', 'fabric_roll', 'stuffing', 'capsule_shell', 'thread_spool'];

// Daily stock — resets each morning
const kitStock = {};
resetKitStock();

// Kit dialogue lines
const KIT_LINES = [
  "What do you need today?",
  "Fresh stock every morning.",
  "You're keeping me in business, friend.",
];

// Shop UI state
let shopPanel = null;
let shopOpen = false;
let kitMesh = null;

export function resetKitStock() {
  for (const key of SHOP_ITEMS) {
    kitStock[key] = MATERIALS[key].dailyStock;
  }
}

export function getKitStock() {
  return { ...kitStock };
}

export function restoreKitStock(data) {
  if (!data) return;
  for (const key of SHOP_ITEMS) {
    if (data[key] !== undefined) kitStock[key] = data[key];
  }
}

export function isShopOpen() {
  return shopOpen;
}

export function isNearKit(playerPos) {
  const dx = playerPos.x - KIT_POS.x;
  const dz = playerPos.z - KIT_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < KIT_INTERACT_RADIUS;
}

export function isKitAvailable() {
  return isNPCActive();
}

// --- Kit 3D mesh ---
export function createKit(scene) {
  const group = new THREE.Group();
  group.position.copy(KIT_POS);
  group.position.y = getTerrainHeight(KIT_POS.x, KIT_POS.z);

  // Body
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a7a5a }); // muted green
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Head
  const headMat = new THREE.MeshLambertMaterial({ color: 0xe8c8a0 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

  // Cap / hat
  const capMat = new THREE.MeshLambertMaterial({ color: 0x4a6a4a });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), capMat);
  cap.position.y = 1.96;
  group.add(cap);

  // Name sprite
  const nameSprite = createNameSprite('Kit');
  nameSprite.position.y = 2.3;
  group.add(nameSprite);

  scene.add(group);
  kitMesh = group;
  return group;
}

function createNameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 0.5, 1);
  return sprite;
}

// --- Update Kit visibility based on time ---
export function updateKit() {
  if (!kitMesh) return;
  kitMesh.visible = isNPCActive();
}

// --- Shop UI ---
export function openShop() {
  if (shopOpen) return;
  shopOpen = true;

  // Release pointer lock for UI
  document.exitPointerLock();

  shopPanel = document.createElement('div');
  Object.assign(shopPanel.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '420px',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(100,180,100,0.25)',
    borderRadius: '16px',
    padding: '20px 24px',
    fontFamily: 'monospace', fontSize: '14px', color: '#fff',
    zIndex: '500',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    userSelect: 'none',
  });

  // Title
  const title = document.createElement('div');
  Object.assign(title.style, {
    fontSize: '18px', fontWeight: 'bold', color: '#8c8',
    textAlign: 'center', marginBottom: '6px',
  });
  title.textContent = "Kit's Supply Shop";
  shopPanel.appendChild(title);

  // Kit dialogue
  const dialogue = document.createElement('div');
  Object.assign(dialogue.style, {
    textAlign: 'center', color: '#999', fontSize: '13px',
    marginBottom: '16px', fontStyle: 'italic',
  });
  dialogue.textContent = `"${KIT_LINES[Math.floor(Math.random() * KIT_LINES.length)]}"`;
  shopPanel.appendChild(dialogue);

  // Items grid
  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'flex', flexDirection: 'column', gap: '8px' });

  for (const key of SHOP_ITEMS) {
    const mat = MATERIALS[key];
    const row = createShopRow(key, mat);
    grid.appendChild(row);
  }
  shopPanel.appendChild(grid);

  // Bottom row: balance + close
  const bottom = document.createElement('div');
  Object.assign(bottom.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '16px', paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  });

  const balanceEl = document.createElement('div');
  balanceEl.id = 'shop-balance';
  Object.assign(balanceEl.style, { fontSize: '13px', color: '#888' });
  balanceEl.textContent = `Balance: $${getMoney()}`;
  bottom.appendChild(balanceEl);

  const closeBtn = document.createElement('button');
  Object.assign(closeBtn.style, {
    background: 'rgba(255,255,255,0.05)', color: '#888',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    padding: '8px 16px', fontFamily: 'monospace', fontSize: '14px',
    cursor: 'pointer',
  });
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closeShop);
  bottom.appendChild(closeBtn);

  shopPanel.appendChild(bottom);

  // Feedback text
  const feedback = document.createElement('div');
  feedback.id = 'shop-feedback';
  Object.assign(feedback.style, {
    textAlign: 'center', fontSize: '13px', marginTop: '8px',
    minHeight: '18px', color: '#c66', opacity: '0',
    transition: 'opacity 0.3s',
  });
  shopPanel.appendChild(feedback);

  document.body.appendChild(shopPanel);

  // Close on Escape
  document.addEventListener('keydown', shopKeyHandler);
}

function shopKeyHandler(e) {
  if (e.code === 'Escape' && shopOpen) {
    closeShop();
  }
}

export function closeShop() {
  if (!shopOpen) return;
  shopOpen = false;
  if (shopPanel) {
    shopPanel.remove();
    shopPanel = null;
  }
  document.removeEventListener('keydown', shopKeyHandler);
}

function canBuyTen(key) {
  return kitStock[key] >= 10
    && getMoney() >= 10 * MATERIALS[key].price
    && roomFor('material', key) >= 10;
}

function createShopRow(key, mat) {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
    padding: '8px 10px',
  });

  // Icon
  const iconWrap = document.createElement('div');
  Object.assign(iconWrap.style, {
    width: '30px', height: '30px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0',
  });
  const icon = document.createElement('div');
  Object.assign(icon.style, getMaterialIconStyle(key));
  iconWrap.appendChild(icon);
  row.appendChild(iconWrap);

  // Name + price
  const info = document.createElement('div');
  Object.assign(info.style, { flex: '1', minWidth: '0' });
  const nameEl = document.createElement('div');
  nameEl.style.fontSize = '13px';
  nameEl.textContent = mat.name;
  info.appendChild(nameEl);
  const priceEl = document.createElement('div');
  Object.assign(priceEl.style, { fontSize: '11px', color: '#6f6' });
  priceEl.textContent = `$${mat.price} each`;
  info.appendChild(priceEl);
  row.appendChild(info);

  // Stock
  const stockEl = document.createElement('div');
  stockEl.id = `shop-stock-${key}`;
  Object.assign(stockEl.style, { fontSize: '11px', color: '#888', width: '50px', textAlign: 'center' });
  stockEl.textContent = `${kitStock[key]} left`;
  row.appendChild(stockEl);

  // Buy 10 button
  const buyBtn = document.createElement('button');
  buyBtn.id = `shop-buy10-${key}`;
  const ok = canBuyTen(key);
  Object.assign(buyBtn.style, {
    padding: '5px 10px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px',
    fontWeight: 'bold', whiteSpace: 'nowrap',
    background: ok ? 'rgba(100,200,100,0.15)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${ok ? 'rgba(100,200,100,0.35)' : 'rgba(255,255,255,0.1)'}`,
    color: ok ? '#6f6' : '#444',
    cursor: ok ? 'pointer' : 'default',
  });
  buyBtn.textContent = `Buy 10 — $${10 * mat.price}`;
  if (!ok) buyBtn.disabled = true;
  buyBtn.addEventListener('click', () => buyTen(key));
  row.appendChild(buyBtn);

  return row;
}

function refreshShopButtons() {
  for (const key of SHOP_ITEMS) {
    const btn = document.getElementById(`shop-buy10-${key}`);
    if (!btn) continue;
    const ok = canBuyTen(key);
    btn.disabled = !ok;
    Object.assign(btn.style, {
      background: ok ? 'rgba(100,200,100,0.15)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${ok ? 'rgba(100,200,100,0.35)' : 'rgba(255,255,255,0.1)'}`,
      color: ok ? '#6f6' : '#444',
      cursor: ok ? 'pointer' : 'default',
    });
    const stockEl = document.getElementById(`shop-stock-${key}`);
    if (stockEl) stockEl.textContent = `${kitStock[key]} left`;
  }
  const balanceEl = document.getElementById('shop-balance');
  if (balanceEl) balanceEl.textContent = `Balance: $${getMoney()}`;
}

function showFeedback(text, color) {
  const el = document.getElementById('shop-feedback');
  if (!el) return;
  el.textContent = text;
  el.style.color = color || '#c66';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function buyTen(key) {
  if (!canBuyTen(key)) return;
  const cost = 10 * MATERIALS[key].price;
  deductMoney(cost);
  for (let i = 0; i < 10; i++) {
    addItem('material', key);
    kitStock[key]--;
  }
  showFeedback(`Bought 10 ${MATERIALS[key].name}!`, '#6f6');
  refreshShopButtons();
}

// ============================================================
// Yuna's Ink Shop — sells color_ink once relationship >= 2
// ============================================================

const YUNA_POS = new THREE.Vector3(155, 0, 165);
const YUNA_INTERACT_RADIUS = 3;
const YUNA_INK_PRICE = 8;
const YUNA_INK_DAILY_STOCK = 10;

let yunaInkStock = YUNA_INK_DAILY_STOCK;
let yunaShopPanel = null;
let yunaShopOpen = false;

const YUNA_INK_LINES = [
  "These dyes come from flowers you'll never find in a catalog.",
  "Color is just light that learned to stay. Take some with you.",
  "I press the petals myself. $8 each — worth every petal.",
  "My secret garden yields maybe five a day. Don't tell anyone.",
];

export function resetYunaInkStock() {
  yunaInkStock = YUNA_INK_DAILY_STOCK;
}

export function getYunaInkStock() { return yunaInkStock; }

export function restoreYunaInkStock(data) {
  if (data !== undefined) yunaInkStock = data;
}

export function isYunaShopOpen() { return yunaShopOpen; }

export function isNearYuna(playerPos) {
  const dx = playerPos.x - YUNA_POS.x;
  const dz = playerPos.z - YUNA_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < YUNA_INTERACT_RADIUS;
}

export function openYunaShop() {
  if (yunaShopOpen) return;
  yunaShopOpen = true;
  document.exitPointerLock();

  yunaShopPanel = document.createElement('div');
  Object.assign(yunaShopPanel.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '360px',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(200,80,220,0.3)',
    borderRadius: '16px',
    padding: '20px 24px',
    fontFamily: 'monospace', fontSize: '14px', color: '#fff',
    zIndex: '500',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    userSelect: 'none',
  });

  const BULK = 10;
  const bulkCost = BULK * YUNA_INK_PRICE;

  function canBuyInk() {
    return yunaInkStock >= BULK
      && getMoney() >= bulkCost
      && roomFor('material', 'color_ink') >= BULK;
  }

  function render() {
    const ok = canBuyInk();
    yunaShopPanel.innerHTML = `
      <div style="font-size:18px;font-weight:bold;color:#d080ff;text-align:center;margin-bottom:6px">Yuna's Ink</div>
      <div style="text-align:center;color:#999;font-size:12px;margin-bottom:14px;font-style:italic">
        "${YUNA_INK_LINES[Math.floor(Math.random() * YUNA_INK_LINES.length)]}"
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:rgba(200,80,220,0.06);border:1px solid rgba(200,80,220,0.15);border-radius:8px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#ff80d0,#c030a0);box-shadow:0 0 8px rgba(200,50,180,0.5)"></div>
          <div>
            <div style="font-size:13px;font-weight:bold">Color Ink</div>
            <div style="font-size:11px;color:#d080ff">$${YUNA_INK_PRICE} each · ${yunaInkStock} left today</div>
          </div>
        </div>
        <button id="yuna-buy" style="padding:6px 12px;border-radius:5px;font-family:monospace;font-size:12px;font-weight:bold;white-space:nowrap;cursor:${ok ? 'pointer' : 'default'};border:1px solid ${ok ? 'rgba(200,80,220,0.4)' : 'rgba(255,255,255,0.1)'};background:${ok ? 'rgba(200,80,220,0.15)' : 'rgba(255,255,255,0.03)'};color:${ok ? '#d080ff' : '#444'}" ${ok ? '' : 'disabled'}>Buy 10 — $${bulkCost}</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:#888">Balance: $${getMoney()}</span>
      </div>
      <div id="yuna-feedback" style="font-size:12px;text-align:center;min-height:16px;margin-bottom:8px;transition:opacity 0.5s;opacity:0"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="yuna-close" style="padding:7px 18px;border-radius:6px;font-family:monospace;font-size:13px;cursor:pointer;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#888">Close</button>
      </div>
    `;

    yunaShopPanel.querySelector('#yuna-buy').addEventListener('click', () => {
      if (!canBuyInk()) return;
      deductMoney(bulkCost);
      for (let i = 0; i < BULK; i++) {
        addItem('material', 'color_ink');
        yunaInkStock--;
      }
      const fb = yunaShopPanel.querySelector('#yuna-feedback');
      if (fb) {
        fb.textContent = `Bought ${BULK} Color Ink!`;
        fb.style.color = '#d080ff';
        fb.style.opacity = '1';
        setTimeout(() => { fb.style.opacity = '0'; }, 2000);
      }
      render();
    });
    yunaShopPanel.querySelector('#yuna-close').addEventListener('click', closeYunaShop);
  }

  render();
  document.body.appendChild(yunaShopPanel);

  document.addEventListener('keydown', yunaEscHandler);
}

function yunaEscHandler(e) {
  if (e.code === 'Escape') closeYunaShop();
}

function closeYunaShop() {
  yunaShopOpen = false;
  if (yunaShopPanel) { yunaShopPanel.remove(); yunaShopPanel = null; }
  document.removeEventListener('keydown', yunaEscHandler);
}
