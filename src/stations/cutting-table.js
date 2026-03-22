// Cutting Table — first station in the plushie pipeline
// Converts fabric rolls → plushie patterns (2 per run)
// Features: queue-based, offline processing, diminishing efficiency (items 4+ take 50% longer)

import * as THREE from 'three';
import { hasItem, removeItem, addItem, isFull } from '../inventory.js';
import { CUTTING_TABLE_POS } from '../apartment.js';

// --- Constants ---
const BASE_TIME = 5;       // seconds per cut
const OUTPUT_PER_RUN = 2;  // patterns produced per fabric roll
const OUTPUT_MAX = 10;     // max patterns in output tray
const MAX_INPUT = 8;       // max fabric rolls queued
const INTERACT_RADIUS = 2.5;

// --- State ---
let stationState = {
  isRunning: false,
  inputQueue: 0,
  outputQueue: 0,
  progress: 0,
  batchProcessed: 0, // resets when station goes idle; items 4+ (batchProcessed>=3) take 50% longer
};

let stationMesh = null;
let statusLightMat = null;
let sceneRef = null;
let isUIOpen = false;

let backdrop = null;
let panel = null;
let audioCtx = null;

// --- Public API ---

export function isNearCuttingTable(playerPos) {
  if (!stationMesh) return false;
  const dx = playerPos.x - CUTTING_TABLE_POS.x;
  const dz = playerPos.z - CUTTING_TABLE_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function isCuttingTableOpen() { return isUIOpen; }

export function getCuttingTableSaveData() {
  return { ...stationState, lastUpdateTime: Date.now() };
}

export function restoreCuttingTableState(data) {
  if (!data) return;
  stationState.inputQueue = data.inputQueue || 0;
  stationState.outputQueue = data.outputQueue || 0;
  stationState.progress = data.progress || 0;
  stationState.isRunning = data.isRunning || false;
  stationState.batchProcessed = data.batchProcessed || 0;

  if (data.lastUpdateTime && (stationState.isRunning || stationState.inputQueue > 0)) {
    const elapsed = (Date.now() - data.lastUpdateTime) / 1000;
    processOfflineTime(elapsed);
  }
  updateStatusLight();
}

// --- Init ---

export function initCuttingTable(scene, player) {
  sceneRef = scene;
  createStationMesh();
  createUI();

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { /* no audio */ }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isUIOpen) closeUI();
  });
}

// --- 3D Mesh ---

function createStationMesh() {
  if (!sceneRef) return;

  const group = new THREE.Group();
  group.position.copy(CUTTING_TABLE_POS);

  // Wide flat table body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6b5b3a,
    emissive: 0x110e06,
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 1.4), bodyMat);
  body.position.y = 0.36;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Green cutting mat on top
  const matColor = new THREE.MeshStandardMaterial({
    color: 0x2a6640,
    emissive: 0x081a10,
    emissiveIntensity: 0.15,
  });
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 1.3), matColor);
  mat.position.y = 0.74;
  mat.castShadow = true;
  group.add(mat);

  // Guide lines on cutting mat (thin boxes)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x4a9960, emissive: 0x1a4428, emissiveIntensity: 0.3 });
  for (let i = -0.4; i <= 0.4; i += 0.4) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.005, 0.01), lineMat);
    line.position.set(0, 0.765, i);
    group.add(line);
  }
  for (let i = -0.2; i <= 0.2; i += 0.2) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.005, 1.28), lineMat);
    line.position.set(i, 0.765, 0);
    group.add(line);
  }

  // Table legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4a3a22 });
  const legGeo = new THREE.BoxGeometry(0.06, 0.36, 0.06);
  const legPositions = [[-0.22, -0.55], [0.22, -0.55], [-0.22, 0.55], [0.22, 0.55]];
  for (const [ox, oz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(ox, 0.18, oz);
    group.add(leg);
  }

  // Status light
  statusLightMat = new THREE.MeshStandardMaterial({
    color: 0x44ff44,
    emissive: 0x44ff44,
    emissiveIntensity: 0.8,
  });
  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), statusLightMat);
  statusLight.position.set(0.32, 0.55, 0);
  group.add(statusLight);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(10, 8, 236, 48, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('CUTTING TABLE', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
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

// --- Offline Processing ---

function getEffectiveTime(batchProcessed) {
  return batchProcessed >= 3 ? BASE_TIME * 1.5 : BASE_TIME;
}

function processOfflineTime(elapsed) {
  if (!stationState.isRunning && stationState.inputQueue === 0) return;

  let remaining = elapsed;
  let batch = stationState.batchProcessed;

  // Finish current in-progress item
  if (stationState.isRunning && stationState.progress > 0) {
    const effectiveTime = getEffectiveTime(batch);
    const timeLeft = effectiveTime * (1 - stationState.progress);
    if (remaining >= timeLeft) {
      remaining -= timeLeft;
      stationState.outputQueue = Math.min(stationState.outputQueue + OUTPUT_PER_RUN, OUTPUT_MAX);
      stationState.progress = 0;
      stationState.isRunning = false;
      batch++;
    } else {
      stationState.progress += remaining / effectiveTime;
      stationState.batchProcessed = batch;
      return;
    }
  }

  // Process queued items
  while (stationState.inputQueue > 0 && remaining > 0 && stationState.outputQueue + OUTPUT_PER_RUN <= OUTPUT_MAX) {
    const effectiveTime = getEffectiveTime(batch);
    if (remaining >= effectiveTime) {
      remaining -= effectiveTime;
      stationState.inputQueue--;
      stationState.outputQueue = Math.min(stationState.outputQueue + OUTPUT_PER_RUN, OUTPUT_MAX);
      batch++;
    } else {
      stationState.inputQueue--;
      stationState.isRunning = true;
      stationState.progress = remaining / effectiveTime;
      break;
    }
  }

  stationState.batchProcessed = batch;
}

// --- Update (called each frame) ---

export function updateCuttingTable(dt) {
  // Reset batch counter when fully idle
  if (!stationState.isRunning && stationState.inputQueue === 0) {
    stationState.batchProcessed = 0;
  }

  // Start next item
  if (!stationState.isRunning && stationState.inputQueue > 0 &&
      stationState.outputQueue + OUTPUT_PER_RUN <= OUTPUT_MAX) {
    stationState.inputQueue--;
    stationState.isRunning = true;
    stationState.progress = 0;
    playThunk();
  }

  if (stationState.isRunning) {
    const effectiveTime = getEffectiveTime(stationState.batchProcessed);
    stationState.progress += dt / effectiveTime;

    if (stationMesh) {
      stationMesh.position.y = Math.sin(Date.now() * 0.012) * 0.004;
    }

    if (stationState.progress >= 1) {
      stationState.progress = 0;
      stationState.isRunning = false;
      stationState.batchProcessed++;
      stationState.outputQueue = Math.min(stationState.outputQueue + OUTPUT_PER_RUN, OUTPUT_MAX);
      playDing();
      if (stationMesh) stationMesh.position.y = 0;
    }

    updateStatusLight();
  }

  if (isUIOpen) renderUI();
}

// --- UI ---

function createUI() {
  backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.4)',
    zIndex: '190', display: 'none',
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeUI(); });
  document.body.appendChild(backdrop);

  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(100,200,120,0.2)',
    borderRadius: '16px', padding: '0', width: '420px',
    color: '#fff', fontFamily: 'monospace', fontSize: '14px',
    zIndex: '200', display: 'none', pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);
}

export function openCuttingTableUI() {
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
  const hasFabric = hasItem('material', 'fabric_roll');
  const canLoad = hasFabric && stationState.inputQueue < MAX_INPUT;
  const canCollect = stationState.outputQueue > 0;
  const isProcessing = stationState.isRunning;
  const totalQueued = stationState.inputQueue + (isProcessing ? 1 : 0);
  const progressPct = isProcessing ? Math.min(stationState.progress * 100, 100) : 0;
  const isSlow = stationState.batchProcessed >= 3;
  const effectiveTime = isSlow ? BASE_TIME * 1.5 : BASE_TIME;

  let statusText = 'Idle';
  let statusColor = '#4a4';
  if (stationState.outputQueue >= OUTPUT_MAX) {
    statusText = 'Output Full'; statusColor = '#f44';
  } else if (isProcessing) {
    statusText = `Cutting... (${totalQueued} in queue)${isSlow ? ' [slow]' : ''}`;
    statusColor = isSlow ? '#fa8' : '#fc4';
  }

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:18px;font-weight:bold;letter-spacing:0.5px">Cutting Table</span>
        <button id="ct-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:${statusColor};font-size:12px;margin-bottom:14px">${statusText}</div>
    </div>

    <div style="padding:0 24px">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px">
        <!-- Input slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:6px">INPUT</div>
          <div style="
            width:72px;height:72px;
            border:2px ${canLoad ? 'solid rgba(100,200,120,0.4)' : 'dashed rgba(255,255,255,0.15)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${totalQueued > 0 ? `
              <div style="width:22px;height:22px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#7a9cb8,#5a7c98)"></div>
              <span style="font-size:11px;color:#aaa;margin-top:4px">${totalQueued}</span>
            ` : `<span style="font-size:11px;color:#555">Empty</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Fabric Roll</div>
        </div>

        <!-- Arrow + Load button -->
        <div style="text-align:center">
          <div style="font-size:20px;color:#555;margin-bottom:4px">&rarr;</div>
          <div style="font-size:10px;color:#555;margin-bottom:6px">×2</div>
          <button id="ct-load" style="
            padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
            cursor:${canLoad ? 'pointer' : 'default'};
            border:1px solid ${canLoad ? 'rgba(100,200,120,0.4)' : 'rgba(255,255,255,0.1)'};
            background:${canLoad ? 'rgba(100,200,120,0.1)' : 'rgba(255,255,255,0.03)'};
            color:${canLoad ? '#6d6' : '#444'};
          " ${canLoad ? '' : 'disabled'}>Load</button>
        </div>

        <!-- Output slot -->
        <div style="text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:6px">OUTPUT</div>
          <div style="
            width:72px;height:72px;
            border:2px ${canCollect ? 'solid rgba(240,220,120,0.4)' : 'dashed rgba(255,255,255,0.15)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${stationState.outputQueue > 0 ? `
              <div style="width:22px;height:22px;border-radius:1px;background:linear-gradient(135deg,#f5e8c8,#e0d0a8);border:1px dashed rgba(160,120,60,0.5)"></div>
              <span style="font-size:11px;color:#aaa;margin-top:2px">${stationState.outputQueue}/${OUTPUT_MAX}</span>
            ` : `<span style="font-size:11px;color:#555">Empty</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Pattern</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:12px">
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:10px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:${isProcessing ? (isSlow ? '#fa8' : '#6d6') : '#333'};border-radius:4px;transition:width 0.1s linear"></div>
        </div>
        ${isSlow && isProcessing ? `<div style="font-size:10px;color:#fa8;text-align:right;margin-top:2px">efficiency reduced</div>` : ''}
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">
        <button id="ct-load-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canLoad ? 'pointer' : 'default'};
          border:1px solid ${canLoad ? 'rgba(100,200,120,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canLoad ? 'rgba(100,200,120,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canLoad ? '#6d6' : '#444'};
        " ${canLoad ? '' : 'disabled'}>Load All</button>
        <button id="ct-collect" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(240,220,120,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(240,220,120,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#ee8' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect</button>
        <button id="ct-collect-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(240,220,120,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(240,220,120,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#ee8' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect All</button>
      </div>

      <div style="font-size:11px;color:#555;text-align:center;margin-bottom:4px">
        Fabric Roll &rarr; 2&times; Plushie Pattern (${effectiveTime.toFixed(1)}s)
      </div>
    </div>

    <div style="padding:8px 24px 16px;text-align:center">
      <button id="ct-done" style="
        padding:6px 20px;border-radius:6px;font-family:monospace;font-size:13px;
        cursor:pointer;border:1px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.06);color:#888;
      ">Done</button>
    </div>
  `;

  panel.querySelector('#ct-close').addEventListener('click', closeUI);
  panel.querySelector('#ct-done').addEventListener('click', closeUI);

  const loadBtn = panel.querySelector('#ct-load');
  if (loadBtn && canLoad) loadBtn.addEventListener('click', () => loadFabric(1));

  const loadAllBtn = panel.querySelector('#ct-load-all');
  if (loadAllBtn && canLoad) loadAllBtn.addEventListener('click', () => loadAllFabric());

  const collectBtn = panel.querySelector('#ct-collect');
  if (collectBtn && canCollect) collectBtn.addEventListener('click', () => collectPattern(1));

  const collectAllBtn = panel.querySelector('#ct-collect-all');
  if (collectAllBtn && canCollect) collectAllBtn.addEventListener('click', () => collectAllPatterns());
}

// --- Actions ---

function loadFabric(count) {
  for (let i = 0; i < count; i++) {
    if (!hasItem('material', 'fabric_roll')) break;
    if (stationState.inputQueue >= MAX_INPUT) break;
    if (removeItem('material', 'fabric_roll')) {
      stationState.inputQueue++;
      playThunk();
    }
  }
  updateStatusLight();
  renderUI();
}

function loadAllFabric() {
  let loaded = 0;
  while (hasItem('material', 'fabric_roll') && stationState.inputQueue < MAX_INPUT) {
    if (removeItem('material', 'fabric_roll')) {
      stationState.inputQueue++;
      loaded++;
    } else break;
  }
  if (loaded > 0) playThunk();
  updateStatusLight();
  renderUI();
}

function collectPattern(count) {
  let collected = 0;
  for (let i = 0; i < count; i++) {
    if (stationState.outputQueue <= 0) break;
    if (isFull()) break;
    if (addItem('material', 'plushie_pattern')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }
  if (collected > 0) { playDing(); updateStatusLight(); }
  renderUI();
}

function collectAllPatterns() {
  let collected = 0;
  while (stationState.outputQueue > 0 && !isFull()) {
    if (addItem('material', 'plushie_pattern')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }
  if (collected > 0) { playDing(); updateStatusLight(); }
  renderUI();
}

// --- Audio ---

function playThunk() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.18);
  } catch (e) { /* ignore */ }
}

function playDing() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, audioCtx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) { /* ignore */ }
}
