// Print Station — first manufacturing station
// Converts sticker paper → fresh stickers
// Features: input/output slots, auto-queue, progress bar, offline processing
// Animations: print head, paper feed, output stacking, status light pulse, ink particles
// State persists in save data

import * as THREE from 'three';
import { hasItem, removeItem, addItem, isFull, getSlots } from '../inventory.js';
import { PRINT_STATION_POS } from '../apartment.js';

// --- Constants ---
const PRINT_TIME = 4; // seconds per print
const OUTPUT_MAX = 5; // max stickers in output queue
const INTERACT_RADIUS = 2.5;

// --- State ---
let stationState = {
  isRunning: false,
  inputQueue: 0,         // total sticker paper sheets queued
  inkQueue: 0,           // how many of those have ink loaded with them
  runningIsInked: false, // whether the currently-printing item had ink
  outputQueue: 0,        // total stickers ready to collect
  outputQueueFresh: 0,   // how many of those are fresh (inked) stickers
  progress: 0,           // 0-1 progress on current print
};

let stationMesh = null;
let statusLight = null;
let statusLightMat = null;
let sceneRef = null;
let isUIOpen = false;
let playerRef = null;
let enabled = false;

// Animation refs
let printHead = null;
let printHeadMat = null;
let feedPaper = null;
let feedPaperMat = null;
let outputStack = null;  // group of stacked sheets
let outputSheets = [];   // individual sheet meshes in the stack
let inkParticles = null;
let inkPositions = null;
let inkVelocities = null;
let inkMat = null;
const INK_COUNT = 16;
let inkActive = false;
let completionFlash = 0; // countdown for flash effect on print complete

// UI elements
let backdrop = null;
let panel = null;
let uiDirty = true; // only re-render DOM when state changes

// Audio context (reuse game audio)
let audioCtx = null;

// Track last UI state to avoid needless DOM rebuilds
let lastUIHash = '';

// --- Public API ---

export function isNearPrintStation(playerPos) {
  if (!stationMesh || !enabled) return false;
  const dx = playerPos.x - PRINT_STATION_POS.x;
  const dz = playerPos.z - PRINT_STATION_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function setStationEnabled(val) {
  enabled = val;
  if (stationMesh) stationMesh.visible = val;
}

export function isPrintStationOpen() { return isUIOpen; }

export function getPrintStationState() {
  return { ...stationState };
}

export function restorePrintStationState(data) {
  if (!data) return;
  stationState.inputQueue = data.inputQueue || 0;
  stationState.inkQueue = data.inkQueue || 0;
  stationState.runningIsInked = data.runningIsInked || false;
  stationState.outputQueue = data.outputQueue || 0;
  stationState.outputQueueFresh = data.outputQueueFresh || 0;
  stationState.progress = data.progress || 0;
  stationState.isRunning = data.isRunning || false;

  // Calculate offline processing
  if (data.lastUpdateTime && (stationState.isRunning || stationState.inputQueue > 0)) {
    const elapsed = (Date.now() - data.lastUpdateTime) / 1000;
    processOfflineTime(elapsed);
  }

  updateStatusLight();
  updateOutputStack();
}

export function getStationSaveData() {
  return {
    ...stationState,
    lastUpdateTime: Date.now(),
  };
}

// --- Init ---

export function initPrintStation(scene, player) {
  sceneRef = scene;
  playerRef = player;
  createStationMesh();
  if (stationMesh) stationMesh.visible = false; // hidden until purchased
  createUI();

  // Try to get audio context
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { /* no audio */ }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isUIOpen) closeUI();
  });
}

// --- 3D Station Mesh ---

function createStationMesh() {
  if (!sceneRef) return;

  const group = new THREE.Group();
  group.position.copy(PRINT_STATION_POS);

  // Desk body — flat box
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x5a6a7a,
    emissive: 0x111520,
    emissiveIntensity: 0.2,
  });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), deskMat);
  desk.position.y = 0.35;
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);

  // Flat top surface (printer surface)
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    emissive: 0x112233,
    emissiveIntensity: 0.1,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.8), topMat);
  top.position.y = 0.725;
  top.castShadow = true;
  group.add(top);

  // Paper feed slot (left side indent)
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x333844 });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.4), slotMat);
  slot.position.set(-0.4, 0.76, 0);
  group.add(slot);

  // Output tray (right side)
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x444e58 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.5), trayMat);
  tray.position.set(0.4, 0.72, 0.05);
  group.add(tray);

  // --- Print head (slides back and forth during printing) ---
  printHeadMat = new THREE.MeshStandardMaterial({
    color: 0x222830,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  printHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.35), printHeadMat);
  printHead.position.set(0, 0.78, 0);
  group.add(printHead);

  // --- Feed paper (slides from input to output during printing) ---
  feedPaperMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    emissive: 0x000000,
    transparent: true,
    opacity: 0,
  });
  feedPaper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.28), feedPaperMat);
  feedPaper.position.set(-0.4, 0.77, 0);
  group.add(feedPaper);

  // --- Output stack (grows as outputQueue increases) ---
  outputStack = new THREE.Group();
  outputStack.position.set(0.4, 0.74, 0.05);
  group.add(outputStack);
  // Pre-create sheet meshes for the stack (up to OUTPUT_MAX)
  for (let i = 0; i < OUTPUT_MAX; i++) {
    const sheetMat = new THREE.MeshStandardMaterial({
      color: 0xe8e0f0,
      emissive: 0x000000,
    });
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.3), sheetMat);
    sheet.position.y = i * 0.013;
    sheet.visible = false;
    outputStack.add(sheet);
    outputSheets.push({ mesh: sheet, mat: sheetMat });
  }

  // --- Ink mist particles ---
  const inkGeo = new THREE.BufferGeometry();
  inkPositions = new Float32Array(INK_COUNT * 3);
  inkVelocities = new Float32Array(INK_COUNT * 3);
  for (let i = 0; i < INK_COUNT; i++) {
    inkPositions[i * 3] = 0;
    inkPositions[i * 3 + 1] = 0.8;
    inkPositions[i * 3 + 2] = 0;
    inkVelocities[i * 3] = (Math.random() - 0.5) * 0.3;
    inkVelocities[i * 3 + 1] = Math.random() * 0.4 + 0.1;
    inkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  inkGeo.setAttribute('position', new THREE.BufferAttribute(inkPositions, 3));
  inkMat = new THREE.PointsMaterial({
    color: 0xd080ff,
    size: 0.04,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  inkParticles = new THREE.Points(inkGeo, inkMat);
  inkParticles.position.set(0, 0, 0);
  group.add(inkParticles);

  // Status light (small sphere on front)
  statusLightMat = new THREE.MeshStandardMaterial({
    color: 0x44ff44,
    emissive: 0x44ff44,
    emissiveIntensity: 0.8,
  });
  statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), statusLightMat);
  statusLight.position.set(0, 0.55, 0.36);
  group.add(statusLight);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(20, 8, 216, 48, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('PRINT STATION', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 1.3;
  group.add(sprite);

  sceneRef.add(group);
  stationMesh = group;
  updateStatusLight();
}

// --- Status Light ---

function updateStatusLight() {
  if (!statusLightMat) return;

  if (stationState.outputQueue >= OUTPUT_MAX) {
    statusLightMat.color.setHex(0xff4444);
    statusLightMat.emissive.setHex(0xff4444);
  } else if (stationState.isRunning) {
    statusLightMat.color.setHex(0xffcc44);
    statusLightMat.emissive.setHex(0xffcc44);
  } else {
    statusLightMat.color.setHex(0x44ff44);
    statusLightMat.emissive.setHex(0x44ff44);
  }
}

// --- Output Stack Visual ---

function updateOutputStack() {
  if (!outputSheets.length) return;
  const total = stationState.outputQueue;
  const fresh = stationState.outputQueueFresh;
  const gray = total - fresh;

  for (let i = 0; i < OUTPUT_MAX; i++) {
    const s = outputSheets[i];
    if (i < total) {
      s.mesh.visible = true;
      // Color: gray sheets first at bottom, fresh on top
      if (i < gray) {
        s.mat.color.setHex(0xa0a0a8);
        s.mat.emissive.setHex(0x000000);
        s.mat.emissiveIntensity = 0;
      } else {
        s.mat.color.setHex(0xe0a0f0);
        s.mat.emissive.setHex(0xc060e0);
        s.mat.emissiveIntensity = 0.15;
      }
    } else {
      s.mesh.visible = false;
    }
  }
}

// --- Offline Processing ---

function startNextItem() {
  stationState.isRunning = true;
  stationState.progress = 0;
  if (stationState.inkQueue > 0) {
    stationState.inkQueue--;
    stationState.runningIsInked = true;
  } else {
    stationState.runningIsInked = false;
  }
}

function finishCurrentItem() {
  if (stationState.outputQueue < OUTPUT_MAX) {
    stationState.outputQueue++;
    if (stationState.runningIsInked) stationState.outputQueueFresh++;
  }
  stationState.progress = 0;
  stationState.isRunning = false;
  stationState.runningIsInked = false;
}

function processOfflineTime(elapsed) {
  if (!stationState.isRunning && stationState.inputQueue === 0) return;

  let remaining = elapsed;

  // Finish current print
  if (stationState.isRunning && stationState.progress > 0) {
    const timeLeft = PRINT_TIME * (1 - stationState.progress);
    if (remaining >= timeLeft) {
      remaining -= timeLeft;
      finishCurrentItem();
    } else {
      stationState.progress += remaining / PRINT_TIME;
      return;
    }
  }

  // Process remaining input queue
  while (stationState.inputQueue > 0 && remaining >= PRINT_TIME) {
    if (stationState.outputQueue >= OUTPUT_MAX) break;
    remaining -= PRINT_TIME;
    stationState.inputQueue--;
    const isInked = stationState.inkQueue > 0;
    if (isInked) stationState.inkQueue--;
    stationState.outputQueue++;
    if (isInked) stationState.outputQueueFresh++;
  }

  // Partial progress on next item
  if (stationState.inputQueue > 0 && remaining > 0 && stationState.outputQueue < OUTPUT_MAX) {
    stationState.inputQueue--;
    stationState.runningIsInked = stationState.inkQueue > 0;
    if (stationState.runningIsInked) stationState.inkQueue--;
    stationState.isRunning = true;
    stationState.progress = remaining / PRINT_TIME;
  }
}

// --- Update (called each frame) ---

export function updatePrintStation(dt) {
  if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
    stationState.inputQueue--;
    startNextItem();
    playThunk();
    uiDirty = true;
  }

  if (stationState.isRunning) {
    const wasPrinting = stationState.progress < 1;
    stationState.progress += dt / PRINT_TIME;

    // --- Print head animation: sweep back and forth ---
    if (printHead) {
      // Sweep across z-axis (front to back), 2 full sweeps per print
      const sweepT = (stationState.progress * 4) % 2;
      const sweepPos = sweepT < 1 ? sweepT : 2 - sweepT; // triangle wave 0→1→0
      printHead.position.z = -0.15 + sweepPos * 0.3;
      // Subtle glow when printing
      printHeadMat.emissive.setHex(stationState.runningIsInked ? 0xc060e0 : 0x4488cc);
      printHeadMat.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.02) * 0.2;
    }

    // --- Feed paper animation: slide from left to right ---
    if (feedPaper && feedPaperMat) {
      const p = stationState.progress;
      // Paper appears at 5%, slides across, disappears at 95%
      if (p > 0.05 && p < 0.95) {
        feedPaperMat.opacity = Math.min(1, (p - 0.05) * 10, (0.95 - p) * 10);
        // Slide from input slot (-0.4) to output tray (0.4)
        feedPaper.position.x = -0.4 + (p - 0.05) / 0.9 * 0.8;
        // Add color tint if inked
        if (stationState.runningIsInked && p > 0.3) {
          const inkProgress = Math.min(1, (p - 0.3) / 0.4);
          const r = 0.94 + inkProgress * (0.88 - 0.94);
          const g = 0.94 + inkProgress * (0.63 - 0.94);
          const b = 0.94 + inkProgress * (0.94 - 0.94);
          feedPaperMat.color.setRGB(r, g, b);
          feedPaperMat.emissive.setHex(0xc060e0);
          feedPaperMat.emissiveIntensity = inkProgress * 0.2;
        } else {
          feedPaperMat.color.setHex(0xf0f0f0);
          feedPaperMat.emissive.setHex(0x000000);
          feedPaperMat.emissiveIntensity = 0;
        }
      } else {
        feedPaperMat.opacity = 0;
      }
    }

    // --- Ink mist particles (only for color prints) ---
    if (inkParticles && stationState.runningIsInked) {
      inkActive = true;
      const t = Date.now() * 0.001;
      const headZ = printHead ? printHead.position.z : 0;
      for (let i = 0; i < INK_COUNT; i++) {
        const life = ((t * 1.5 + i * 0.37) % 1); // 0-1 lifecycle
        const px = feedPaper ? feedPaper.position.x : 0;
        inkPositions[i * 3] = px + (Math.sin(i * 2.1 + t * 3) * 0.06);
        inkPositions[i * 3 + 1] = 0.78 + life * 0.12;
        inkPositions[i * 3 + 2] = headZ + (Math.cos(i * 1.7 + t * 2) * 0.06);
      }
      inkParticles.geometry.attributes.position.needsUpdate = true;
      inkMat.opacity = 0.5 + Math.sin(t * 4) * 0.15;
    } else if (inkActive) {
      inkMat.opacity = Math.max(0, inkMat.opacity - dt * 3);
      if (inkMat.opacity <= 0) inkActive = false;
    }

    // --- Subtle vibration during printing ---
    if (stationMesh) {
      stationMesh.position.y = Math.sin(Date.now() * 0.025) * 0.003;
    }

    // --- Status light pulse ---
    if (statusLight) {
      const pulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;
      statusLight.scale.setScalar(pulse);
      statusLightMat.emissiveIntensity = 0.5 + pulse * 0.5;
    }

    if (stationState.progress >= 1) {
      finishCurrentItem();
      playDing();
      completionFlash = 0.4; // 0.4s flash
      uiDirty = true;

      // Reset animations
      if (stationMesh) stationMesh.position.y = 0;
      if (printHead) {
        printHead.position.z = 0;
        printHeadMat.emissive.setHex(0x000000);
        printHeadMat.emissiveIntensity = 0;
      }
      if (feedPaperMat) feedPaperMat.opacity = 0;
      if (statusLight) statusLight.scale.setScalar(1);

      updateOutputStack();
    }

    updateStatusLight();
    uiDirty = true; // progress bar needs updating
  } else {
    // Idle state — gentle breathing glow on status light
    if (statusLight) {
      const breath = 0.85 + Math.sin(Date.now() * 0.002) * 0.15;
      statusLight.scale.setScalar(breath);
      statusLightMat.emissiveIntensity = 0.4 + breath * 0.3;
    }

    // Fade ink if still visible
    if (inkActive && inkMat) {
      inkMat.opacity = Math.max(0, inkMat.opacity - dt * 3);
      if (inkMat.opacity <= 0) inkActive = false;
    }
  }

  // Completion flash on output stack
  if (completionFlash > 0) {
    completionFlash -= dt;
    const flashI = Math.max(0, completionFlash / 0.4);
    const topIdx = stationState.outputQueue - 1;
    if (topIdx >= 0 && topIdx < outputSheets.length) {
      const s = outputSheets[topIdx];
      s.mat.emissiveIntensity = flashI * 0.8;
    }
  }

  // Update UI if open (only when state changed)
  if (isUIOpen && uiDirty) {
    renderUI();
    uiDirty = false;
  }
}

// --- UI ---

function createUI() {
  backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.55)',
    zIndex: '190',
    display: 'none',
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeUI();
  });
  document.body.appendChild(backdrop);

  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(100,180,255,0.2)',
    borderRadius: '16px',
    padding: '0',
    width: '520px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    zIndex: '200',
    display: 'none',
    pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);

  if (!document.getElementById('ps-animations')) {
    const style = document.createElement('style');
    style.id = 'ps-animations';
    style.textContent = `
      @keyframes ps-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes ps-pop {
        0% { transform: scale(0.3); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes ps-pulse-border {
        0%,100% { border-color: rgba(100,255,150,0.25); }
        50% { border-color: rgba(100,255,150,0.65); }
      }
      @keyframes ps-feed {
        0% { transform: translateX(-6px); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: translateX(6px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

export function openUI() {
  if (isUIOpen) return;
  isUIOpen = true;
  lastUIHash = '';
  uiDirty = true;
  document.exitPointerLock();
  backdrop.style.display = 'block';
  panel.style.display = 'block';
  renderUI();
}

function closeUI() {
  isUIOpen = false;
  backdrop.style.display = 'none';
  panel.style.display = 'none';
}

function getUIHash() {
  const hasPaper = hasItem('material', 'sticker_paper');
  const hasInk = hasItem('material', 'color_ink');
  const progQ = stationState.isRunning ? Math.floor(stationState.progress * 50) : -1;
  const invSlots = getSlots();
  const paperInInv = invSlots.filter(s => s.type === 'material' && s.subtype === 'sticker_paper').reduce((n, s) => n + s.count, 0);
  const inkInInv = invSlots.filter(s => s.type === 'material' && s.subtype === 'color_ink').reduce((n, s) => n + s.count, 0);
  return `${hasPaper}|${hasInk}|${paperInInv}|${inkInInv}|${stationState.inputQueue}|${stationState.inkQueue}|${stationState.runningIsInked}|${stationState.outputQueue}|${stationState.outputQueueFresh}|${stationState.isRunning}|${progQ}|${isFull()}`;
}

function renderUI() {
  const hash = getUIHash();
  if (hash === lastUIHash) return;
  lastUIHash = hash;

  const isProcessing = stationState.isRunning;
  const totalQueued = stationState.inputQueue + (isProcessing ? 1 : 0);
  const inkedCount = stationState.inkQueue + (isProcessing && stationState.runningIsInked ? 1 : 0);
  const grayOutputCount = stationState.outputQueue - stationState.outputQueueFresh;
  const invFull = isFull();
  const canCollect = stationState.outputQueue > 0 && !invFull;
  const canLoadPaper = hasItem('material', 'sticker_paper') &&
    (stationState.inputQueue + stationState.outputQueue + (isProcessing ? 1 : 0)) < OUTPUT_MAX + 5;
  const canLoadInk = hasItem('material', 'color_ink');
  const canPrint = totalQueued > 0 || canLoadPaper;

  const progressPct = isProcessing ? Math.min(stationState.progress * 100, 100) : 0;
  const progressColor = isProcessing ? (stationState.runningIsInked ? '#f8a0ff' : '#6cf') : '#4a4';

  // Count items in inventory for display
  const slots = getSlots();
  const paperInInv = slots.filter(s => s.type === 'material' && s.subtype === 'sticker_paper').reduce((n, s) => n + s.count, 0);
  const inkInInv = slots.filter(s => s.type === 'material' && s.subtype === 'color_ink').reduce((n, s) => n + s.count, 0);

  const btn = (active, label, id) =>
    `<button id="${id}" style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:5px;` +
    `background:${active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'};` +
    `color:${active ? '#ccc' : '#3a3a3a'};` +
    `border:1px solid ${active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'};` +
    `cursor:${active ? 'pointer' : 'default'};transition:all 0.15s" ${active ? '' : 'disabled'}>${label}</button>`;

  const zone = (id, borderCol, bgCol, pulse, clickable) =>
    `<div id="${id}" style="width:100px;height:100px;border-radius:10px;border:2px ${borderCol};background:${bgCol};` +
    `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `box-sizing:border-box;transition:border-color 0.15s,background 0.15s;` +
    `cursor:${clickable ? 'pointer' : 'default'};` +
    (pulse ? 'animation:ps-pulse-border 1.5s ease infinite;' : '') + '">';

  panel.innerHTML = `
    <!-- Header -->
    <div style="padding:18px 22px 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-size:17px;font-weight:bold;letter-spacing:0.5px;color:#dde">Print Station</span>
      <button id="ps-close" style="background:none;border:none;color:#556;font-size:22px;cursor:pointer;padding:0 4px;line-height:1">&times;</button>
    </div>

    <!-- Three zones -->
    <div style="padding:0 22px;display:flex;gap:12px;justify-content:center;align-items:flex-start;margin-bottom:14px">

      <!-- Paper -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:10px;color:#667;letter-spacing:1px">PAPER</span>
        ${zone('ps-paper-zone',
          canLoadPaper ? 'solid rgba(100,200,255,0.55)' : totalQueued > 0 ? 'solid rgba(100,200,255,0.3)' : 'dashed rgba(255,255,255,0.13)',
          totalQueued > 0 ? 'rgba(100,200,255,0.05)' : 'rgba(255,255,255,0.02)',
          false, canLoadPaper)}
          ${totalQueued > 0 ? `
            <div style="width:26px;height:32px;border-radius:2px;background:linear-gradient(160deg,#f2f2f2,#d8d8e8);border:1px solid rgba(255,255,255,0.5);box-shadow:2px 2px 5px rgba(0,0,0,0.5)"></div>
            <span style="font-size:12px;color:#acd;margin-top:5px;font-weight:bold">×${totalQueued}</span>
            ${inkedCount > 0 ? `<span style="font-size:9px;color:#d080ff;margin-top:1px">${inkedCount} inked</span>` : ''}
          ` : `
            <div style="font-size:26px;opacity:${canLoadPaper ? '0.5' : '0.15'};line-height:1;user-select:none">📄</div>
            <span style="font-size:9px;color:#445;margin-top:4px">${canLoadPaper ? 'click to load' : 'empty'}</span>
          `}
        </div>
        <span style="font-size:9px;color:#445">inv: ${paperInInv}</span>
        ${btn(canLoadPaper, 'Load All', 'ps-load-all-paper')}
      </div>

      <!-- Ink -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:10px;color:#667;letter-spacing:1px">INK</span>
        ${zone('ps-ink-zone',
          canLoadInk ? 'solid rgba(200,100,255,0.55)' : stationState.inkQueue > 0 ? 'solid rgba(200,100,255,0.3)' : 'dashed rgba(255,255,255,0.13)',
          stationState.inkQueue > 0 ? 'rgba(200,100,255,0.05)' : 'rgba(255,255,255,0.02)',
          false, canLoadInk)}
          ${stationState.inkQueue > 0 ? `
            <div style="width:22px;height:26px;border-radius:50% 50% 5px 5px;background:linear-gradient(160deg,#e080ff,#7030b0);box-shadow:0 0 12px rgba(192,80,255,0.5)"></div>
            <span style="font-size:12px;color:#d8a0ff;margin-top:5px;font-weight:bold">×${stationState.inkQueue}</span>
          ` : `
            <div style="font-size:26px;opacity:${canLoadInk ? '0.5' : '0.15'};line-height:1;user-select:none">🎨</div>
            <span style="font-size:9px;color:#445;margin-top:4px">${canLoadInk ? 'click to load' : 'optional'}</span>
          `}
        </div>
        <span style="font-size:9px;color:#445">inv: ${inkInInv}</span>
        ${btn(canLoadInk, 'Load All', 'ps-load-all-ink')}
      </div>

      <!-- Arrow -->
      <div style="display:flex;align-items:center;margin-top:42px;font-size:20px;color:${isProcessing ? '#6cf' : '#2a2a3a'};${isProcessing ? 'animation:ps-feed 1.5s ease infinite' : ''}">→</div>

      <!-- Output -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:10px;color:#667;letter-spacing:1px">OUTPUT</span>
        ${zone('ps-output-zone',
          stationState.outputQueue > 0 ? 'solid rgba(100,255,150,0.45)' : 'dashed rgba(255,255,255,0.13)',
          stationState.outputQueue > 0 ? 'rgba(100,255,150,0.05)' : 'rgba(255,255,255,0.02)',
          stationState.outputQueue > 0, canCollect)}
          ${stationState.outputQueue > 0 ? `
            <div style="width:28px;height:28px;border-radius:4px;background:${stationState.outputQueueFresh > 0 ? 'linear-gradient(135deg,#ff90f0,#d080ff)' : 'linear-gradient(135deg,#a0a0a8,#707078)'};box-shadow:${stationState.outputQueueFresh > 0 ? '0 0 12px rgba(220,120,255,0.5)' : 'none'};animation:ps-pop 0.3s ease"></div>
            <span style="font-size:12px;color:#8f8;margin-top:5px;font-weight:bold">×${stationState.outputQueue}</span>
            ${stationState.outputQueueFresh > 0 && grayOutputCount > 0 ? `<span style="font-size:9px;color:#888">${stationState.outputQueueFresh}✦+${grayOutputCount}○</span>` : ''}
          ` : `
            <span style="font-size:26px;opacity:0.12;line-height:1;user-select:none">✨</span>
            <span style="font-size:9px;color:#333;margin-top:4px">empty</span>
          `}
        </div>
        <span style="font-size:9px;color:#445">&nbsp;</span>
        ${btn(canCollect, 'Collect All', 'ps-collect-all')}
      </div>

    </div>

    ${invFull && stationState.outputQueue > 0 ? `<div style="padding:0 22px;font-size:10px;color:#f80;margin-bottom:4px;text-align:center">Inventory full — make room to collect</div>` : ''}

    <!-- Progress bar -->
    <div style="padding:0 22px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:10px;color:#557">${isProcessing ? (stationState.runningIsInked ? 'Printing (color)…' : 'Printing…') : totalQueued > 0 ? 'Queued' : 'Idle'}</span>
        ${isProcessing ? `<span style="font-size:10px;color:#557">${Math.round(progressPct)}%</span>` : ''}
      </div>
      <div style="background:rgba(255,255,255,0.07);border-radius:4px;height:7px;overflow:hidden;position:relative">
        <div style="width:${progressPct}%;height:100%;background:${progressColor};border-radius:4px;transition:width 0.15s linear"></div>
        ${isProcessing ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%);background-size:200% 100%;animation:ps-shimmer 1.5s ease infinite;border-radius:4px;pointer-events:none"></div>` : ''}
      </div>
    </div>

    <!-- PRINT button -->
    <div style="padding:0 22px 16px;text-align:center">
      <button id="ps-print" style="width:100%;padding:10px;border-radius:8px;font-family:monospace;font-size:15px;font-weight:bold;letter-spacing:2px;border:1px solid ${canPrint ? 'rgba(80,220,100,0.45)' : 'rgba(255,255,255,0.07)'};background:${canPrint ? 'rgba(60,180,80,0.15)' : 'rgba(255,255,255,0.03)'};color:${canPrint ? '#7fa' : '#444'};cursor:${canPrint ? 'pointer' : 'default'};transition:all 0.15s" ${canPrint ? '' : 'disabled'}>PRINT</button>
      <div style="font-size:10px;color:#3a3a4a;margin-top:6px">Press E or Esc to close</div>
    </div>
  `;

  // Wire buttons
  panel.querySelector('#ps-close').addEventListener('click', closeUI);

  const paperZone = panel.querySelector('#ps-paper-zone');
  if (paperZone && canLoadPaper) {
    paperZone.addEventListener('click', () => { loadPaper(1); lastUIHash = ''; renderUI(); });
  }

  const inkZone = panel.querySelector('#ps-ink-zone');
  if (inkZone && canLoadInk) {
    inkZone.addEventListener('click', () => { loadOneInk(); lastUIHash = ''; renderUI(); });
  }

  const loadAllPaperBtn = panel.querySelector('#ps-load-all-paper');
  if (loadAllPaperBtn && canLoadPaper) {
    loadAllPaperBtn.addEventListener('click', () => { loadAllPaper(); lastUIHash = ''; renderUI(); });
  }

  const loadAllInkBtn = panel.querySelector('#ps-load-all-ink');
  if (loadAllInkBtn && canLoadInk) {
    loadAllInkBtn.addEventListener('click', () => { loadAllInk(); lastUIHash = ''; renderUI(); });
  }

  const collectAllBtn = panel.querySelector('#ps-collect-all');
  if (collectAllBtn && canCollect) {
    collectAllBtn.addEventListener('click', () => { collectAllStickers(); lastUIHash = ''; renderUI(); });
  }

  const outputZone = panel.querySelector('#ps-output-zone');
  if (outputZone && canCollect) {
    outputZone.addEventListener('click', () => { collectSticker(1); lastUIHash = ''; renderUI(); });
  }

  const printBtn = panel.querySelector('#ps-print');
  if (printBtn && canPrint) {
    printBtn.addEventListener('click', () => {
      if (canLoadPaper) loadAllPaper();
      lastUIHash = ''; renderUI();
    });
  }
}

// --- Drop zone hit testing (called by hud.js during drag) ---

export function isOverPrintPaperZone(x, y) {
  if (!isUIOpen) return false;
  const el = document.getElementById('ps-paper-zone');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export function isOverPrintInkZone(x, y) {
  if (!isUIOpen) return false;
  const el = document.getElementById('ps-ink-zone');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export function updatePrintDropHighlights(x, y, type, subtype) {
  if (!isUIOpen) return;

  const paperZone = document.getElementById('ps-paper-zone');
  if (paperZone) {
    const isPaper = type === 'material' && subtype === 'sticker_paper';
    if (isPaper) {
      const r = paperZone.getBoundingClientRect();
      const over = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      paperZone.style.borderColor = over ? 'rgba(100,255,150,0.9)' : 'rgba(100,200,255,0.6)';
      paperZone.style.borderStyle = 'solid';
      paperZone.style.background = over ? 'rgba(100,255,150,0.15)' : 'rgba(100,200,255,0.08)';
    }
  }

  const inkZone = document.getElementById('ps-ink-zone');
  if (inkZone) {
    const isInk = type === 'material' && subtype === 'color_ink';
    if (isInk) {
      const r = inkZone.getBoundingClientRect();
      const over = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      inkZone.style.borderColor = over ? 'rgba(220,120,255,0.9)' : 'rgba(200,100,255,0.6)';
      inkZone.style.borderStyle = 'solid';
      inkZone.style.background = over ? 'rgba(220,120,255,0.15)' : 'rgba(200,100,255,0.08)';
    }
  }
}

export function handlePrintDrop(slotIndex, type, subtype, zone) {
  if (!isUIOpen) return false;

  if (zone === 'paper' && type === 'material' && subtype === 'sticker_paper') {
    const slots = getSlots();
    const slot = slots[slotIndex];
    if (!slot || slot.type !== 'material' || slot.subtype !== 'sticker_paper') return false;
    const count = slot.count || 1;
    let loaded = 0;
    for (let i = 0; i < count; i++) {
      if ((stationState.inputQueue + stationState.outputQueue + (stationState.isRunning ? 1 : 0)) >= OUTPUT_MAX + 5) break;
      if (!removeItem('material', 'sticker_paper')) break;
      stationState.inputQueue++;
      loaded++;
    }
    if (loaded > 0) {
      if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
        stationState.inputQueue--;
        startNextItem();
      }
      updateStatusLight();
      uiDirty = true;
      playThunk();
      return true;
    }
  }

  if (zone === 'ink' && type === 'material' && subtype === 'color_ink') {
    const slots = getSlots();
    const slot = slots[slotIndex];
    if (!slot || slot.type !== 'material' || slot.subtype !== 'color_ink') return false;
    const count = slot.count || 1;
    let loaded = 0;
    for (let i = 0; i < count; i++) {
      if (!removeItem('material', 'color_ink')) break;
      stationState.inkQueue++;
      loaded++;
    }
    if (loaded > 0) {
      uiDirty = true;
      playThunk();
      return true;
    }
  }

  return false;
}

// --- Actions ---

function loadPaper(count) {
  for (let i = 0; i < count; i++) {
    if (!hasItem('material', 'sticker_paper')) break;
    if ((stationState.inputQueue + stationState.outputQueue + (stationState.isRunning ? 1 : 0)) >= OUTPUT_MAX + 5) break;
    if (removeItem('material', 'sticker_paper')) {
      stationState.inputQueue++;
      playThunk();
    }
  }

  if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
    stationState.inputQueue--;
    startNextItem();
  }

  updateStatusLight();
  uiDirty = true;
}

function loadAllPaper() {
  let loaded = 0;
  while (hasItem('material', 'sticker_paper') &&
         (stationState.inputQueue + stationState.outputQueue + (stationState.isRunning ? 1 : 0)) < OUTPUT_MAX + 5) {
    if (removeItem('material', 'sticker_paper')) {
      stationState.inputQueue++;
      loaded++;
    } else break;
  }

  if (loaded > 0) {
    playThunk();
    if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
      stationState.inputQueue--;
      startNextItem();
    }
  }

  updateStatusLight();
  uiDirty = true;
}

function loadOneInk() {
  if (!hasItem('material', 'color_ink')) return;
  if (removeItem('material', 'color_ink')) {
    stationState.inkQueue++;
    playThunk();
    updateStatusLight();
    uiDirty = true;
  }
}

function loadAllInk() {
  let loaded = 0;
  while (hasItem('material', 'color_ink')) {
    if (!removeItem('material', 'color_ink')) break;
    stationState.inkQueue++;
    loaded++;
  }
  if (loaded > 0) {
    playThunk();
    updateStatusLight();
    uiDirty = true;
  }
}

function collectSticker(count) {
  let collected = 0;
  for (let i = 0; i < count; i++) {
    if (stationState.outputQueue <= 0) break;
    if (isFull()) break;
    const subtype = stationState.outputQueueFresh > 0 ? 'fresh' : 'old';
    if (addItem('sticker', subtype)) {
      stationState.outputQueue--;
      if (subtype === 'fresh') stationState.outputQueueFresh--;
      collected++;
    } else break;
  }

  if (collected > 0) {
    playDing();
    updateStatusLight();
    updateOutputStack();
  }

  uiDirty = true;
}

function collectAllStickers() {
  let collected = 0;
  while (stationState.outputQueue > 0 && !isFull()) {
    const subtype = stationState.outputQueueFresh > 0 ? 'fresh' : 'old';
    if (addItem('sticker', subtype)) {
      stationState.outputQueue--;
      if (subtype === 'fresh') stationState.outputQueueFresh--;
      collected++;
    } else break;
  }

  if (collected > 0) {
    playDing();
    updateStatusLight();
    updateOutputStack();
  }

  uiDirty = true;
}

// --- Audio (synthesized) ---

function playThunk() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) { /* ignore */ }
}

function playDing() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) { /* ignore */ }
}
