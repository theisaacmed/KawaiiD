// Print Station — first manufacturing station
// Converts sticker paper → fresh stickers
// Features: input/output slots, auto-queue, progress bar, offline processing
// State persists in save data

import * as THREE from 'three';
import { hasItem, removeItem, addItem, isFull } from '../inventory.js';
import { PRINT_STATION_POS } from '../apartment.js';

// --- Constants ---
const PRINT_TIME = 4; // seconds per print
const OUTPUT_MAX = 5; // max stickers in output queue
const INTERACT_RADIUS = 2.5;

// --- State ---
let stationState = {
  isRunning: false,
  inputQueue: 0,    // number of sticker paper sheets queued
  outputQueue: 0,   // number of fresh stickers ready
  progress: 0,      // 0-1 progress on current print
};

let stationMesh = null;
let statusLight = null;
let statusLightMat = null;
let sceneRef = null;
let isUIOpen = false;
let playerRef = null;
let enabled = false;

// UI elements
let backdrop = null;
let panel = null;

// Audio context (reuse game audio)
let audioCtx = null;

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
  stationState.outputQueue = data.outputQueue || 0;
  stationState.progress = data.progress || 0;
  stationState.isRunning = data.isRunning || false;

  // Calculate offline processing
  if (data.lastUpdateTime && (stationState.isRunning || stationState.inputQueue > 0)) {
    const elapsed = (Date.now() - data.lastUpdateTime) / 1000;
    processOfflineTime(elapsed);
  }

  updateStatusLight();
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

function updateStatusLight() {
  if (!statusLightMat) return;

  if (stationState.outputQueue >= OUTPUT_MAX) {
    // Red — output full
    statusLightMat.color.setHex(0xff4444);
    statusLightMat.emissive.setHex(0xff4444);
  } else if (stationState.isRunning) {
    // Yellow — printing
    statusLightMat.color.setHex(0xffcc44);
    statusLightMat.emissive.setHex(0xffcc44);
  } else {
    // Green — idle
    statusLightMat.color.setHex(0x44ff44);
    statusLightMat.emissive.setHex(0x44ff44);
  }
}

// --- Offline Processing ---

function processOfflineTime(elapsed) {
  // Calculate how many prints could complete
  if (stationState.isRunning || stationState.inputQueue > 0) {
    // Account for current progress
    let remaining = elapsed;

    // Finish current print
    if (stationState.isRunning && stationState.progress > 0) {
      const timeLeft = PRINT_TIME * (1 - stationState.progress);
      if (remaining >= timeLeft) {
        remaining -= timeLeft;
        if (stationState.outputQueue < OUTPUT_MAX) {
          stationState.outputQueue++;
        }
        stationState.progress = 0;
        stationState.isRunning = false;
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
      stationState.outputQueue++;
    }

    // Partial progress on next item
    if (stationState.inputQueue > 0 && remaining > 0 && stationState.outputQueue < OUTPUT_MAX) {
      stationState.inputQueue--;
      stationState.isRunning = true;
      stationState.progress = remaining / PRINT_TIME;
    }
  }
}

// --- Update (called each frame) ---

export function updatePrintStation(dt) {
  if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
    // Start printing next item from queue
    stationState.inputQueue--;
    stationState.isRunning = true;
    stationState.progress = 0;
    playThunk();
  }

  if (stationState.isRunning) {
    stationState.progress += dt / PRINT_TIME;

    // Pulse the station mesh slightly during printing
    if (stationMesh) {
      stationMesh.position.y = Math.sin(Date.now() * 0.008) * 0.005;
    }

    if (stationState.progress >= 1) {
      // Print complete
      stationState.progress = 0;
      stationState.isRunning = false;
      stationState.outputQueue++;
      playDing();

      // Reset mesh position
      if (stationMesh) stationMesh.position.y = 0;

      // Check if output is full
      if (stationState.outputQueue >= OUTPUT_MAX) {
        stationState.isRunning = false;
      }
    }

    updateStatusLight();
  }

  // Update UI if open
  if (isUIOpen) renderUI();
}

// --- UI ---

function createUI() {
  // Backdrop
  backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.4)',
    zIndex: '190',
    display: 'none',
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeUI();
  });
  document.body.appendChild(backdrop);

  // Panel
  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(100,180,255,0.2)',
    borderRadius: '16px',
    padding: '0',
    width: '420px',
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
}

export function openUI() {
  if (isUIOpen) return;
  isUIOpen = true;
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

function renderUI() {
  const hasPaper = hasItem('material', 'sticker_paper');
  const canLoad = hasPaper && (stationState.inputQueue + stationState.outputQueue + (stationState.isRunning ? 1 : 0)) < OUTPUT_MAX + 5;
  const canCollect = stationState.outputQueue > 0;
  const isProcessing = stationState.isRunning;
  const totalQueued = stationState.inputQueue + (isProcessing ? 1 : 0);

  // Progress bar
  const progressPct = isProcessing ? Math.min(stationState.progress * 100, 100) : 0;
  const progressColor = isProcessing ? '#6cf' : '#333';

  // Status text
  let statusText = 'Idle';
  let statusColor = '#4a4';
  if (stationState.outputQueue >= OUTPUT_MAX) {
    statusText = 'Output Full';
    statusColor = '#f44';
  } else if (isProcessing) {
    statusText = `Printing... (${totalQueued} in queue)`;
    statusColor = '#fc4';
  }

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:18px;font-weight:bold;letter-spacing:0.5px">Print Station</span>
        <button id="ps-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:${statusColor};font-size:12px;margin-bottom:14px">${statusText}</div>
    </div>

    <div style="padding:0 24px">
      <!-- Input / Arrow / Output row -->
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px">
        <!-- Input slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:6px">INPUT</div>
          <div style="
            width:72px;height:72px;
            border:2px ${canLoad ? 'solid rgba(100,200,255,0.4)' : 'dashed rgba(255,255,255,0.15)'};
            border-radius:10px;
            background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            position:relative;
          ">
            ${totalQueued > 0 ? `
              <div style="width:22px;height:22px;borderRadius:2px;background:linear-gradient(135deg,#f0f0f0,#d8d8d8);border:1px solid rgba(255,255,255,0.3)"></div>
              <span style="font-size:11px;color:#aaa;margin-top:4px">${totalQueued}</span>
            ` : `
              <span style="font-size:11px;color:#555">Empty</span>
            `}
          </div>
        </div>

        <!-- Arrow + Print button -->
        <div style="text-align:center">
          <div style="font-size:20px;color:#555;margin-bottom:6px">&rarr;</div>
          <button id="ps-load" style="
            padding:6px 14px;
            border-radius:6px;
            font-family:monospace;font-size:12px;
            cursor:${canLoad ? 'pointer' : 'default'};
            border:1px solid ${canLoad ? 'rgba(100,200,255,0.4)' : 'rgba(255,255,255,0.1)'};
            background:${canLoad ? 'rgba(100,200,255,0.1)' : 'rgba(255,255,255,0.03)'};
            color:${canLoad ? '#6cf' : '#444'};
          " ${canLoad ? '' : 'disabled'}>Load Paper</button>
        </div>

        <!-- Output slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:6px">OUTPUT</div>
          <div style="
            width:72px;height:72px;
            border:2px ${canCollect ? 'solid rgba(100,255,150,0.4)' : 'dashed rgba(255,255,255,0.15)'};
            border-radius:10px;
            background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${stationState.outputQueue > 0 ? `
              <div style="width:28px;height:28px;borderRadius:4px;background:linear-gradient(135deg,#f0a0e8,#c87aff);boxShadow:0 0 10px rgba(220,120,255,0.4)"></div>
              <span style="font-size:11px;color:#aaa;margin-top:2px">${stationState.outputQueue}/${OUTPUT_MAX}</span>
            ` : `
              <span style="font-size:11px;color:#555">Empty</span>
            `}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:12px">
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:10px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:${progressColor};border-radius:4px;transition:width 0.1s linear"></div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">
        <button id="ps-load-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canLoad ? 'pointer' : 'default'};
          border:1px solid ${canLoad ? 'rgba(100,200,255,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canLoad ? 'rgba(100,200,255,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canLoad ? '#6cf' : '#444'};
        " ${canLoad ? '' : 'disabled'}>Load All</button>
        <button id="ps-collect" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(100,255,150,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(100,255,150,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#6f6' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect</button>
        <button id="ps-collect-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(100,255,150,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(100,255,150,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#6f6' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect All</button>
      </div>

      <div style="font-size:11px;color:#555;text-align:center;margin-bottom:4px">
        Sticker Paper &rarr; Fresh Sticker (${PRINT_TIME}s)
      </div>
    </div>

    <div style="padding:8px 24px 16px;text-align:center">
      <button id="ps-done" style="
        padding:6px 20px;border-radius:6px;font-family:monospace;font-size:13px;
        cursor:pointer;border:1px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.06);color:#888;
      ">Done</button>
    </div>
  `;

  // Wire up buttons
  panel.querySelector('#ps-close').addEventListener('click', closeUI);
  panel.querySelector('#ps-done').addEventListener('click', closeUI);

  const loadBtn = panel.querySelector('#ps-load');
  if (loadBtn && canLoad) {
    loadBtn.addEventListener('click', () => loadPaper(1));
  }

  const loadAllBtn = panel.querySelector('#ps-load-all');
  if (loadAllBtn && canLoad) {
    loadAllBtn.addEventListener('click', () => loadAllPaper());
  }

  const collectBtn = panel.querySelector('#ps-collect');
  if (collectBtn && canCollect) {
    collectBtn.addEventListener('click', () => collectSticker(1));
  }

  const collectAllBtn = panel.querySelector('#ps-collect-all');
  if (collectAllBtn && canCollect) {
    collectAllBtn.addEventListener('click', () => collectAllStickers());
  }
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

  // Auto-start if not running
  if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
    stationState.inputQueue--;
    stationState.isRunning = true;
    stationState.progress = 0;
  }

  updateStatusLight();
  renderUI();
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

    // Auto-start if not running
    if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
      stationState.inputQueue--;
      stationState.isRunning = true;
      stationState.progress = 0;
    }
  }

  updateStatusLight();
  renderUI();
}

function collectSticker(count) {
  let collected = 0;
  for (let i = 0; i < count; i++) {
    if (stationState.outputQueue <= 0) break;
    if (isFull()) break;
    if (addItem('sticker', 'fresh')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }

  if (collected > 0) {
    playDing();
    updateStatusLight();
  }

  renderUI();
}

function collectAllStickers() {
  let collected = 0;
  while (stationState.outputQueue > 0 && !isFull()) {
    if (addItem('sticker', 'fresh')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }

  if (collected > 0) {
    playDing();
    updateStatusLight();
  }

  renderUI();
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
