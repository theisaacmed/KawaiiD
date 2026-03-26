// Gacha system — capsule machine, creation UI, post-deal reveal mechanic
//
// Unlocks after 25 total deals. Machine appears in apartment.
// Player loads stickers/plushies into the machine to create mystery capsules.
// Capsules hide the original item — NPCs don't know what's inside.
// After a gacha deal completes, a reveal animation plays showing the contents.

import * as THREE from 'three';
import { addItem, removeFromSlot } from './inventory.js';
import { playGachaMachineRumble, playGachaRevealDrumroll, playGachaRevealCymbal } from './audio.js';

// --- State ---
let machineUnlocked = false;
let machineMesh = null;
let sceneRef = null;
let isUIOpen = false;

// Input/output slots for the gacha UI
let inputItem = null;   // { slotIndex, type } — item dragged into input
let outputItem = null;  // { type: 'gacha', contains: 'sticker'|'plushie' } — created capsule
let isCreating = false; // animation in progress

// UI elements
let backdrop = null;
let panel = null;

// Reveal state (set after a gacha deal completes)
let revealOverlay = null;

// Callbacks set by main.js
let onRevealBonusFn = null;   // (amount) => add bonus money
let onRevealColorFn = null;   // (npcPos, bonus) => extra color spread

// --- Machine position (next to apartment at 12,0,10) ---
const MACHINE_POS = new THREE.Vector3(14.0, 0, 12.0);
const MACHINE_INTERACT_RADIUS = 2.5;

// --- Public API ---

export function setRevealCallbacks(onBonus, onColor) {
  onRevealBonusFn = onBonus;
  onRevealColorFn = onColor;
}

export function isGachaUnlocked() { return machineUnlocked; }

export function unlockGacha() {
  if (machineUnlocked) return;
  machineUnlocked = true;
  if (sceneRef && !machineMesh) {
    createMachineMesh();
  }
}

export function isGachaUIOpen() { return isUIOpen; }

export function getGachaState() {
  return { unlocked: machineUnlocked };
}

export function restoreGachaState(data) {
  if (!data) return;
  if (data.unlocked) {
    machineUnlocked = true;
    if (sceneRef && !machineMesh) createMachineMesh();
  }
}

// Check if player is near the gacha machine
export function isNearGachaMachine(playerPos) {
  if (!machineUnlocked || !machineMesh) return false;
  const dx = playerPos.x - MACHINE_POS.x;
  const dz = playerPos.z - MACHINE_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < MACHINE_INTERACT_RADIUS;
}

// --- Init ---
export function initGacha(scene) {
  sceneRef = scene;
  createUI();
  createRevealOverlay();

  if (machineUnlocked && !machineMesh) {
    createMachineMesh();
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isUIOpen) closeUI();
  });
}

// --- 3D Machine Mesh ---
function createMachineMesh() {
  if (!sceneRef) return;

  const group = new THREE.Group();
  group.position.copy(MACHINE_POS);

  // Body — tall rounded box (cylinder approximation)
  const bodyGeo = new THREE.CylinderGeometry(0.45, 0.5, 1.6, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xff6b9d,
    emissive: 0x331122,
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  // Dome top
  const domeGeo = new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x7bc8e8,
    emissive: 0x112233,
    emissiveIntensity: 0.2,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 1.6;
  dome.castShadow = true;
  group.add(dome);

  // Base platform
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xfac775 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.15, 8), baseMat);
  base.position.y = 0.075;
  base.receiveShadow = true;
  group.add(base);

  // Capsule window (glass sphere in the middle)
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    emissive: 0x6cf,
    emissiveIntensity: 0.1,
  });
  const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), windowMat);
  windowMesh.position.set(0, 1.0, 0.4);
  group.add(windowMesh);

  // Label sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(20, 8, 216, 48, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('GACHA', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.2;
  group.add(sprite);

  // Gentle point light
  const light = new THREE.PointLight(0xff6b9d, 0.5, 5);
  light.position.y = 1.5;
  group.add(light);

  sceneRef.add(group);
  machineMesh = group;
}

// --- Gacha UI ---
function createUI() {
  // Backdrop
  backdrop = document.createElement('div');
  backdrop.id = 'gacha-backdrop';
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.5)',
    zIndex: '190',
    display: 'none',
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && !isCreating) closeUI();
  });
  document.body.appendChild(backdrop);

  // Panel
  panel = document.createElement('div');
  panel.id = 'gacha-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(12,12,22,0.96)',
    border: '1px solid rgba(255,107,157,0.3)',
    borderRadius: '16px',
    padding: '0',
    width: '420px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    zIndex: '200',
    display: 'none',
    pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 30px rgba(255,107,157,0.1)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);
}

export function openUI() {
  if (isUIOpen) return;
  isUIOpen = true;
  inputItem = null;
  outputItem = null;
  isCreating = false;

  document.exitPointerLock();
  backdrop.style.display = 'block';
  panel.style.display = 'block';
  renderMachineUI();
}

export function closeUI() {
  if (!isUIOpen) return;
  isUIOpen = false;
  inputItem = null;
  outputItem = null;
  isCreating = false;
  backdrop.style.display = 'none';
  panel.style.display = 'none';
}

function renderMachineUI() {
  const inputLabel = inputItem ? (inputItem.type === 'sticker' ? 'Sticker' : 'Plushie') : 'Empty';
  const inputColor = inputItem
    ? (inputItem.type === 'sticker' ? '#e87bda' : '#7bc8e8')
    : '#333';

  const hasInput = inputItem !== null;
  const hasOutput = outputItem !== null;

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:20px;font-weight:bold;color:#ff6b9d;letter-spacing:0.5px">Gacha Machine</span>
        <button id="gacha-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:#888;font-size:12px;margin-bottom:16px">Load items to create mystery capsules</div>
    </div>

    <div style="padding:0 24px">
      <div style="display:flex;gap:20px;align-items:center;justify-content:center;margin-bottom:16px">
        <!-- Input slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#666;margin-bottom:6px">INPUT</div>
          <div id="gacha-input-zone" style="
            width:72px;height:72px;
            border:2px dashed ${hasInput ? inputColor : 'rgba(255,255,255,0.15)'};
            border-radius:12px;
            background:${hasInput ? inputColor + '15' : 'rgba(255,255,255,0.03)'};
            display:flex;align-items:center;justify-content:center;
            transition:border-color 0.2s, background 0.2s;
            position:relative;
          ">
            ${hasInput ? renderItemIcon(inputItem.type) : '<span style="color:#444;font-size:11px">Drag here</span>'}
          </div>
        </div>

        <!-- Arrow -->
        <div style="font-size:24px;color:#555;margin-top:16px">&rarr;</div>

        <!-- Output slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#666;margin-bottom:6px">OUTPUT</div>
          <div id="gacha-output-zone" style="
            width:72px;height:72px;
            border:2px solid ${hasOutput ? 'rgba(255,180,220,0.4)' : 'rgba(255,255,255,0.08)'};
            border-radius:12px;
            background:${hasOutput ? 'rgba(255,180,220,0.08)' : 'rgba(255,255,255,0.02)'};
            display:flex;align-items:center;justify-content:center;
            position:relative;
          ">
            ${hasOutput ? renderCapsuleIcon() : '<span style="color:#333;font-size:11px">—</span>'}
          </div>
        </div>
      </div>

      <!-- Create button -->
      <div style="text-align:center;margin:8px 0 16px">
        ${isCreating ? `
          <div style="color:#ff6b9d;font-size:13px;animation:gacha-pulse 0.5s infinite alternate">
            Creating capsule...
          </div>
        ` : hasOutput ? `
          <button id="gacha-collect" style="
            padding:10px 28px;border-radius:8px;
            font-family:monospace;font-size:14px;font-weight:bold;
            cursor:pointer;
            border:1px solid #6f6;
            background:rgba(100,255,100,0.12);
            color:#6f6;
          ">Collect Capsule</button>
        ` : `
          <button id="gacha-create" ${!hasInput ? 'disabled' : ''} style="
            padding:10px 28px;border-radius:8px;
            font-family:monospace;font-size:14px;font-weight:bold;
            cursor:${hasInput ? 'pointer' : 'default'};
            border:1px solid ${hasInput ? '#ff6b9d' : 'rgba(255,255,255,0.1)'};
            background:${hasInput ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.03)'};
            color:${hasInput ? '#ff6b9d' : '#444'};
          ">Create Capsule</button>
        `}
      </div>

      ${!hasInput && !hasOutput && !isCreating ? `
        <div style="color:#555;font-size:11px;text-align:center;margin-bottom:8px">
          Drag a sticker or plushie from your inventory into the input slot
        </div>
      ` : ''}
    </div>

    <div style="padding:8px 24px 16px"></div>

    <style>
      @keyframes gacha-pulse {
        from { opacity: 0.6; }
        to { opacity: 1; }
      }
    </style>
  `;

  // Wire buttons
  panel.querySelector('#gacha-close')?.addEventListener('click', closeUI);
  panel.querySelector('#gacha-create')?.addEventListener('click', startCreation);
  panel.querySelector('#gacha-collect')?.addEventListener('click', collectCapsule);
}

function renderItemIcon(type) {
  if (type === 'sticker') {
    return `<div style="width:32px;height:32px;border-radius:4px;background:linear-gradient(135deg,#e87bda,#b56eff);box-shadow:0 0 8px rgba(200,100,255,0.3)"></div>`;
  }
  return `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7bc8e8,#6b9fff);box-shadow:0 0 8px rgba(100,180,255,0.3)"></div>`;
}

function renderCapsuleIcon() {
  return `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ffb4d8,#b8a0ff,#7bc8e8,#fac775);box-shadow:0 0 12px rgba(255,180,220,0.4)"></div>`;
}

// --- Handle item drop into gacha input ---
export function handleGachaDrop(slotIndex, itemType) {
  if (!isUIOpen || isCreating || outputItem) return false;
  if (itemType !== 'sticker' && itemType !== 'plushie') return false;

  // Accept the input
  inputItem = { slotIndex, type: itemType };
  renderMachineUI();
  return true;
}

// --- Creation animation ---
function startCreation() {
  if (!inputItem || isCreating || outputItem) return;

  // Remove the item from inventory now
  removeFromSlot(inputItem.slotIndex);

  const containedType = inputItem.type;
  isCreating = true;
  inputItem = null;
  renderMachineUI();
  playGachaMachineRumble();

  // 2-second creation animation
  setTimeout(() => {
    isCreating = false;
    outputItem = { type: 'gacha', contains: containedType };
    renderMachineUI();
  }, 2000);
}

// --- Collect capsule to inventory ---
function collectCapsule() {
  if (!outputItem) return;

  const added = addItem('gacha', outputItem.contains);
  if (!added) {
    // Show inventory full message in the panel
    const msgEl = panel.querySelector('#gacha-create') || panel.querySelector('#gacha-collect');
    if (msgEl) {
      msgEl.textContent = 'Inventory full!';
      msgEl.style.color = '#f66';
      msgEl.style.borderColor = '#f66';
    }
    return;
  }

  outputItem = null;
  renderMachineUI();
}

// ============================
//  POST-DEAL GACHA REVEAL
// ============================

function createRevealOverlay() {
  revealOverlay = document.createElement('div');
  revealOverlay.id = 'gacha-reveal';
  Object.assign(revealOverlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.7)',
    display: 'none',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    zIndex: '350',
    fontFamily: 'monospace',
    color: '#fff',
    pointerEvents: 'auto',
  });
  document.body.appendChild(revealOverlay);
}

// Called after a gacha deal completes
export function triggerReveal(contains, npcName, npcWorldPos) {
  const isPlushie = contains === 'plushie';

  revealOverlay.style.display = 'flex';
  playGachaRevealDrumroll();

  // Phase 1: Show sealed capsule
  revealOverlay.innerHTML = `
    <div id="reveal-capsule" style="
      width:120px;height:120px;border-radius:50%;
      background:linear-gradient(135deg,#ffb4d8,#b8a0ff,#7bc8e8,#fac775);
      box-shadow:0 0 40px rgba(255,180,220,0.5);
      margin-bottom:24px;
      animation:reveal-spin 0.8s linear infinite;
    "></div>
    <div style="font-size:16px;color:#aaa">Opening capsule...</div>
    <style>
      @keyframes reveal-spin {
        from { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(1.1); }
        to { transform: rotate(360deg) scale(1); }
      }
      @keyframes reveal-sparkle {
        0% { opacity: 0; transform: scale(0.5); }
        50% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0; transform: scale(0.8); }
      }
    </style>
  `;

  // Phase 2: Reveal after 1.5s
  setTimeout(() => {
    playGachaRevealCymbal();
    const itemName = isPlushie ? 'Plushie' : 'Sticker';
    const itemColor = isPlushie ? '#7bc8e8' : '#e87bda';
    const bonusText = isPlushie
      ? `<div style="color:#6f6;font-size:20px;font-weight:bold;margin-top:12px">+$10 Bonus!</div>
         <div style="color:#fac775;font-size:13px;margin-top:4px">Extra color spread!</div>`
      : `<div style="color:#aaa;font-size:14px;margin-top:12px">Normal color spread</div>`;

    const npcReaction = isPlushie
      ? `<div style="color:#ff6b9d;font-size:15px;font-weight:bold;margin-top:16px">${npcName}: "OH WOW! A plushie! Best capsule ever!"</div>`
      : `<div style="color:#aaa;font-size:14px;margin-top:16px">${npcName}: "A sticker! Pretty cool."</div>`;

    revealOverlay.innerHTML = `
      <div style="position:relative">
        ${renderSparkles()}
        <div style="
          width:100px;height:100px;border-radius:${isPlushie ? '50%' : '12px'};
          background:linear-gradient(135deg, ${itemColor}, ${isPlushie ? '#6b9fff' : '#b56eff'});
          box-shadow:0 0 40px ${itemColor}66;
          margin:0 auto 16px;
          animation:reveal-sparkle 0.5s ease-out;
        "></div>
      </div>
      <div style="font-size:24px;font-weight:bold;color:${itemColor}">${itemName}!</div>
      ${bonusText}
      ${npcReaction}
      <button id="reveal-dismiss" style="
        margin-top:24px;padding:10px 32px;border-radius:8px;
        font-family:monospace;font-size:14px;cursor:pointer;
        border:1px solid rgba(255,255,255,0.2);
        background:rgba(255,255,255,0.08);
        color:#aaa;
      ">Continue</button>
    `;

    // Apply bonuses
    if (isPlushie) {
      if (onRevealBonusFn) onRevealBonusFn(10);
      if (onRevealColorFn) onRevealColorFn(npcWorldPos, 0.25);
    }

    revealOverlay.querySelector('#reveal-dismiss')?.addEventListener('click', () => {
      revealOverlay.style.display = 'none';
    });
  }, 1500);
}

function renderSparkles() {
  let html = '';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 70;
    const y = Math.sin(angle) * 70;
    html += `<div style="
      position:absolute;
      left:calc(50% + ${x}px - 4px);
      top:calc(50% + ${y}px - 4px);
      width:8px;height:8px;
      border-radius:50%;
      background:#fac775;
      animation:reveal-sparkle 0.6s ease-out ${i * 0.08}s;
      opacity:0;
    "></div>`;
  }
  return html;
}

// --- Gacha input drop zone detection (called from hud.js drag system) ---
export function isOverGachaInput(clientX, clientY) {
  if (!isUIOpen) return false;
  const zone = document.getElementById('gacha-input-zone');
  if (!zone) return false;
  const rect = zone.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right &&
         clientY >= rect.top && clientY <= rect.bottom;
}

// Update gacha input zone highlight during drag
export function updateGachaDropHighlight(clientX, clientY) {
  if (!isUIOpen) return;
  const zone = document.getElementById('gacha-input-zone');
  if (!zone) return;
  const rect = zone.getBoundingClientRect();
  const over = clientX >= rect.left && clientX <= rect.right &&
               clientY >= rect.top && clientY <= rect.bottom;
  zone.style.borderColor = over ? 'rgba(100,255,150,0.7)' : 'rgba(255,255,255,0.15)';
  zone.style.background = over ? 'rgba(100,255,150,0.08)' : 'rgba(255,255,255,0.03)';
}
