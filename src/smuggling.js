// Smuggling system — Gus (Port district) bulk supply orders with delayed delivery
// Player talks to Gus (rel >= 2), picks an order tier, pays upfront.
// Items arrive after 6 game-hours into a delivery crate near the apartment door.

import * as THREE from 'three';
import { getMoney, deductMoney, addItem } from './inventory.js';
import { showInventoryFull } from './hud.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { showNotification } from './notifications.js';
import { getRelationship } from './npc.js';

// ---- Positions ----
const GUS_POS = new THREE.Vector3(-45, 0, 117);
const GUS_INTERACT_RADIUS = 3;

// Delivery crate just outside apartment door
const CRATE_POS = new THREE.Vector3(7.2, 0, 4.2);
const CRATE_INTERACT_RADIUS = 2.5;

// ---- Order tiers ----
const ORDER_TIERS = [
  {
    id: 'small',
    label: 'Small',
    cost: 55,
    minRelLevel: 0,
    items: [
      { type: 'material', sub: 'sticker_paper', qty: 10 },
      { type: 'material', sub: 'fabric_roll',   qty: 3  },
      { type: 'material', sub: 'color_ink',     qty: 5  },
    ],
  },
  {
    id: 'medium',
    label: 'Medium',
    cost: 110,
    minRelLevel: 0,
    items: [
      { type: 'material', sub: 'sticker_paper', qty: 20 },
      { type: 'material', sub: 'fabric_roll',   qty: 5  },
      { type: 'material', sub: 'stuffing',       qty: 5  },
      { type: 'material', sub: 'thread_spool',   qty: 3  },
      { type: 'material', sub: 'color_ink',     qty: 10 },
    ],
  },
  {
    id: 'large',
    label: 'Large',
    cost: 220,
    minRelLevel: 0,
    items: [
      { type: 'material', sub: 'sticker_paper', qty: 40 },
      { type: 'material', sub: 'fabric_roll',   qty: 10 },
      { type: 'material', sub: 'stuffing',       qty: 10 },
      { type: 'material', sub: 'thread_spool',   qty: 5  },
      { type: 'material', sub: 'capsule_shell',  qty: 5  },
      { type: 'material', sub: 'color_ink',     qty: 20 },
    ],
  },
  // Premium tiers — unlocked at relationship level 4+
  {
    id: 'premium_a',
    label: 'Premium A',
    cost: 200,
    minRelLevel: 4,
    items: [
      { type: 'material', sub: 'fabric_roll',      qty: 20 },
      { type: 'material', sub: 'stuffing',          qty: 15 },
      { type: 'material', sub: 'capsule_shell',     qty: 10 },
      { type: 'material', sub: 'plushie_pattern',   qty: 5  },
    ],
  },
  {
    id: 'premium_b',
    label: 'Premium B',
    cost: 350,
    minRelLevel: 4,
    items: [
      { type: 'material', sub: 'fabric_roll',      qty: 30 },
      { type: 'material', sub: 'stuffing',          qty: 25 },
      { type: 'material', sub: 'capsule_shell',     qty: 20 },
      { type: 'material', sub: 'plushie_pattern',   qty: 10 },
      { type: 'material', sub: 'plushie_shell',     qty: 5  },
    ],
  },
];

const DELIVERY_HOURS = 6;

// ---- State ----
let orderPanel = null;
let orderPanelOpen = false;

// Active order: { tierId, items, arrivalDay, arrivalHour } | null
let activeOrder = null;
// Crate contents waiting to be collected: array of {type, sub, qty} | null
let crateContents = null;

let crateMesh = null;

// ---- Public state queries ----
export function isSmuggleUIOpen() { return orderPanelOpen; }
export function isOrderInTransit() { return activeOrder !== null; }
export function isNearGus(playerPos) {
  const dx = playerPos.x - GUS_POS.x;
  const dz = playerPos.z - GUS_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < GUS_INTERACT_RADIUS;
}
export function isNearCrate(playerPos) {
  if (!crateContents) return false;
  const dx = playerPos.x - CRATE_POS.x;
  const dz = playerPos.z - CRATE_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < CRATE_INTERACT_RADIUS;
}
export function isCrateWaiting() { return crateContents !== null; }
export function isGusAvailable() {
  const rel = getRelationship('Gus');
  return Math.floor(rel.level) >= 2;
}

// ---- Init ----
export function initSmuggling(scene) {
  _createCrateMesh(scene);
}

function _createCrateMesh(scene) {
  const group = new THREE.Group();
  group.position.copy(CRATE_POS);
  group.visible = false;

  const mat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.7), mat);
  box.position.y = 0.35;
  box.castShadow = true;
  group.add(box);

  // Label sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe080';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('Delivery', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2.2, 0.55, 1);
  sprite.position.y = 1.3;
  group.add(sprite);

  scene.add(group);
  crateMesh = group;
}

// ---- Update (call each frame) ----
export function updateSmuggling() {
  if (!activeOrder) return;

  const hour = getGameHour();
  const day  = getDayNumber();

  const totalHoursNow     = day * 24 + hour;
  const totalHoursArrival = activeOrder.arrivalDay * 24 + activeOrder.arrivalHour;

  if (totalHoursNow >= totalHoursArrival) {
    _deliverOrder();
  }
}

function _deliverOrder() {
  crateContents = activeOrder.items;
  activeOrder = null;
  if (crateMesh) crateMesh.visible = true;
  showNotification('[Gus] Delivery arrived — crate is outside your apartment.');
}

// ---- Collect crate ----
export function collectCrate() {
  if (!crateContents) return;
  const remaining = [];
  let inventoryFull = false;

  for (const entry of crateContents) {
    let left = entry.qty;
    while (left > 0) {
      if (!addItem(entry.type, entry.sub)) {
        inventoryFull = true;
        break;
      }
      left--;
    }
    if (left > 0) {
      remaining.push({ ...entry, qty: left });
    }
  }

  crateContents = remaining.length > 0 ? remaining : null;
  if (crateMesh) crateMesh.visible = crateContents !== null;
  if (inventoryFull) showInventoryFull();
}

// ---- Order UI ----
export function openOrderUI() {
  if (orderPanelOpen) return;
  orderPanelOpen = true;

  document.exitPointerLock();

  orderPanel = document.createElement('div');
  Object.assign(orderPanel.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '440px',
    background: 'rgba(10,12,20,0.95)',
    border: '1px solid rgba(100,150,220,0.3)',
    borderRadius: '16px',
    padding: '22px 26px',
    fontFamily: 'monospace', fontSize: '14px', color: '#dde',
    zIndex: '500',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    userSelect: 'none',
  });

  // Title
  const title = document.createElement('div');
  Object.assign(title.style, {
    fontSize: '18px', fontWeight: 'bold', color: '#7af',
    textAlign: 'center', marginBottom: '6px',
  });
  title.textContent = "Gus — Port Supplies";
  orderPanel.appendChild(title);

  const sub = document.createElement('div');
  Object.assign(sub.style, {
    textAlign: 'center', color: '#778', fontSize: '12px',
    marginBottom: '16px', fontStyle: 'italic',
  });
  sub.textContent = '"Arrives in 6 hours. No questions asked."';
  orderPanel.appendChild(sub);

  // Active order notice
  if (activeOrder) {
    const notice = document.createElement('div');
    Object.assign(notice.style, {
      background: 'rgba(255,200,50,0.08)',
      border: '1px solid rgba(255,200,50,0.2)',
      borderRadius: '8px', padding: '10px 14px',
      color: '#fc8', fontSize: '13px', marginBottom: '14px',
      textAlign: 'center',
    });
    const tier = ORDER_TIERS.find(t => t.id === activeOrder.tierId);
    notice.textContent = `Order in transit (${tier ? tier.label : ''}) — arrives day ${activeOrder.arrivalDay} at ${_fmtHour(activeOrder.arrivalHour)}`;
    orderPanel.appendChild(notice);
  }

  // Tiers — filter by relationship level
  const balance = getMoney();
  const rel = getRelationship('Gus');
  const relLevel = Math.floor(rel.level || 0);

  // Section label for premium tiers if unlocked
  let addedPremiumLabel = false;
  for (const tier of ORDER_TIERS) {
    if ((tier.minRelLevel || 0) > relLevel) continue;
    if ((tier.minRelLevel || 0) >= 4 && !addedPremiumLabel) {
      addedPremiumLabel = true;
      const premLabel = document.createElement('div');
      Object.assign(premLabel.style, {
        fontSize: '11px', color: '#7af', letterSpacing: '0.05em',
        marginBottom: '6px', marginTop: '4px',
        textTransform: 'uppercase',
      });
      premLabel.textContent = '— Premium (Trust level 4) —';
      orderPanel.appendChild(premLabel);
    }
    const card = _makeTierCard(tier, balance);
    orderPanel.appendChild(card);
  }

  // Balance row
  const balRow = document.createElement('div');
  Object.assign(balRow.style, {
    marginTop: '14px', paddingTop: '10px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', justifyContent: 'space-between',
    fontSize: '13px', color: '#778',
  });
  balRow.innerHTML = `<span>Balance</span><span style="color:#6f9">$${balance}</span>`;
  orderPanel.appendChild(balRow);

  // Feedback
  const feedback = document.createElement('div');
  feedback.id = 'smug-feedback';
  Object.assign(feedback.style, {
    textAlign: 'center', fontSize: '13px', marginTop: '8px',
    minHeight: '18px', color: '#f88', opacity: '0',
    transition: 'opacity 0.3s',
  });
  orderPanel.appendChild(feedback);

  // Close button
  const closeBtn = document.createElement('button');
  Object.assign(closeBtn.style, {
    display: 'block', margin: '12px auto 0',
    background: 'rgba(255,255,255,0.05)', color: '#778',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    padding: '7px 20px', fontFamily: 'monospace', fontSize: '13px',
    cursor: 'pointer',
  });
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closeOrderUI);
  orderPanel.appendChild(closeBtn);

  document.body.appendChild(orderPanel);
  document.addEventListener('keydown', _smugKeyHandler);
}

function _makeTierCard(tier, balance) {
  const card = document.createElement('div');
  const canOrder = !activeOrder && balance >= tier.cost;
  Object.assign(card.style, {
    background: canOrder ? 'rgba(80,130,220,0.07)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${canOrder ? 'rgba(80,130,220,0.25)' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: '10px', padding: '12px 14px', marginBottom: '10px',
    opacity: canOrder ? '1' : '0.5',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '6px',
  });
  const labelEl = document.createElement('div');
  labelEl.style.fontWeight = 'bold';
  labelEl.style.color = '#9cf';
  labelEl.textContent = tier.label;
  const priceEl = document.createElement('div');
  priceEl.style.color = '#6f9';
  priceEl.style.fontWeight = 'bold';
  priceEl.textContent = `$${tier.cost}`;
  header.appendChild(labelEl);
  header.appendChild(priceEl);
  card.appendChild(header);

  const itemList = document.createElement('div');
  Object.assign(itemList.style, { fontSize: '12px', color: '#889', lineHeight: '1.6' });
  itemList.textContent = tier.items.map(i => `${i.qty}x ${i.sub.replace(/_/g, ' ')}`).join('  /  ');
  card.appendChild(itemList);

  if (canOrder) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      marginTop: '8px',
      background: 'rgba(80,130,220,0.15)', color: '#9cf',
      border: '1px solid rgba(80,130,220,0.3)', borderRadius: '6px',
      padding: '5px 16px', fontFamily: 'monospace', fontSize: '13px',
      cursor: 'pointer', fontWeight: 'bold',
    });
    btn.textContent = 'Order';
    btn.addEventListener('click', () => _placeOrder(tier));
    card.appendChild(btn);
  }

  return card;
}

function _placeOrder(tier) {
  if (activeOrder) return _showFeedback('Already have an active order.');
  if (getMoney() < tier.cost) return _showFeedback('Not enough money.');

  deductMoney(tier.cost);

  const nowDay  = getDayNumber();
  const nowHour = getGameHour();
  let arrivalHour = nowHour + DELIVERY_HOURS;
  let arrivalDay  = nowDay;
  if (arrivalHour >= 24) {
    arrivalHour -= 24;
    arrivalDay++;
  }

  activeOrder = {
    tierId: tier.id,
    items: tier.items,
    arrivalDay,
    arrivalHour,
  };

  closeOrderUI();
  showNotification({ npcName: 'Gus', title: 'Order placed', text: `${tier.label} crate arrives in ~6 hours.` });
}

function _showFeedback(msg) {
  const el = document.getElementById('smug-feedback');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

function _smugKeyHandler(e) {
  if (e.code === 'Escape' && orderPanelOpen) closeOrderUI();
}

export function closeOrderUI() {
  if (!orderPanelOpen) return;
  orderPanelOpen = false;
  if (orderPanel) { orderPanel.remove(); orderPanel = null; }
  document.removeEventListener('keydown', _smugKeyHandler);
}

function _fmtHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ---- Save / Load ----
export function getSmugglingState() {
  return {
    activeOrder:   activeOrder   ? { ...activeOrder }                       : null,
    crateContents: crateContents ? crateContents.map(e => ({ ...e })) : null,
  };
}

export function restoreSmugglingState(data) {
  if (!data) return;
  activeOrder   = data.activeOrder   || null;
  crateContents = data.crateContents || null;
  if (crateMesh) crateMesh.visible = !!crateContents;
}
