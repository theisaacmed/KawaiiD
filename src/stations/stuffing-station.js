// Stuffing Station — final station in the plushie pipeline
// Input: 1 plushie shell + 1 stuffing → Output: 1 handmade plushie (finished product)
// Features: two-input slot, queue-based, offline processing, diminishing efficiency

import * as THREE from 'three';
import { hasItem, removeItem, addItem, isFull } from '../inventory.js';
import { STUFFING_STATION_POS } from '../apartment.js';

// --- Constants ---
const BASE_TIME = 4;   // seconds per stuff
const OUTPUT_MAX = 5;
const MAX_INPUT = 8;
const INTERACT_RADIUS = 2.5;

// --- State ---
let stationState = {
  isRunning: false,
  inputQueue: 0,
  outputQueue: 0,
  progress: 0,
  batchProcessed: 0,
};

let stationMesh = null;
let statusLightMat = null;
let hopperMesh = null;
let sceneRef = null;
let isUIOpen = false;
let enabled = false;

let backdrop = null;
let panel = null;
let audioCtx = null;

// --- Public API ---

export function isNearStuffingStation(playerPos) {
  if (!stationMesh || !enabled) return false;
  const dx = playerPos.x - STUFFING_STATION_POS.x;
  const dz = playerPos.z - STUFFING_STATION_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function isStuffingStationOpen() { return isUIOpen; }

export function setStationEnabled(val) {
  enabled = val;
  if (stationMesh) stationMesh.visible = val;
}

export function getStuffingStationSaveData() {
  return { ...stationState, lastUpdateTime: Date.now() };
}

export function restoreStuffingStationState(data) {
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

export function initStuffingStation(scene, player) {
  sceneRef = scene;
  createStationMesh();
  if (stationMesh) stationMesh.visible = false; // hidden until purchased
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
  group.position.copy(STUFFING_STATION_POS);

  // Base platform
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a5a,
    emissive: 0x100a14,
    emissiveIntensity: 0.2,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.75), baseMat);
  base.position.y = 0.325;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Work surface (top)
  const surfMat = new THREE.MeshStandardMaterial({ color: 0x5a4a6a, emissive: 0x14101a, emissiveIntensity: 0.15 });
  const surface = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.8), surfMat);
  surface.position.y = 0.67;
  group.add(surface);

  // Hopper body (tall box on left side, funnel shape approximated)
  const hopperMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a4a,
    emissive: 0x0e0812,
    emissiveIntensity: 0.2,
  });
  hopperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.38), hopperMat);
  hopperMesh.position.set(-0.3, 0.97, 0);
  hopperMesh.castShadow = true;
  group.add(hopperMesh);

  // Hopper opening (wider top)
  const hopperTopMat = new THREE.MeshStandardMaterial({ color: 0x2a1a3a });
  const hopperTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), hopperTopMat);
  hopperTop.position.set(-0.3, 1.24, 0);
  group.add(hopperTop);

  // Fluffy stuffing visible in hopper (white puff)
  const stuffMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    emissive: 0x888888,
    emissiveIntensity: 0.05,
  });
  const stuffPuff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), stuffMat);
  stuffPuff.position.set(-0.3, 1.23, 0);
  group.add(stuffPuff);

  // Nozzle/spout at bottom of hopper
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x6a5a7a });
  const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), nozzleMat);
  nozzle.position.set(-0.3, 0.7, 0);
  group.add(nozzle);

  // Work area (right side of surface — where plushie gets stuffed)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x887799, emissive: 0x221122, emissiveIntensity: 0.15 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.6), padMat);
  pad.position.set(0.25, 0.69, 0);
  group.add(pad);

  // Status light
  statusLightMat = new THREE.MeshStandardMaterial({
    color: 0x44ff44,
    emissive: 0x44ff44,
    emissiveIntensity: 0.8,
  });
  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), statusLightMat);
  statusLight.position.set(0, 0.5, 0.38);
  group.add(statusLight);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(10, 8, 236, 48, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('STUFFING STATION', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 1.55;
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

  if (stationState.isRunning && stationState.progress > 0) {
    const effectiveTime = getEffectiveTime(batch);
    const timeLeft = effectiveTime * (1 - stationState.progress);
    if (remaining >= timeLeft) {
      remaining -= timeLeft;
      if (stationState.outputQueue < OUTPUT_MAX) stationState.outputQueue++;
      stationState.progress = 0;
      stationState.isRunning = false;
      batch++;
    } else {
      stationState.progress += remaining / effectiveTime;
      stationState.batchProcessed = batch;
      return;
    }
  }

  while (stationState.inputQueue > 0 && remaining > 0 && stationState.outputQueue < OUTPUT_MAX) {
    const effectiveTime = getEffectiveTime(batch);
    if (remaining >= effectiveTime) {
      remaining -= effectiveTime;
      stationState.inputQueue--;
      stationState.outputQueue++;
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

// --- Update ---

export function updateStuffingStation(dt) {
  if (!stationState.isRunning && stationState.inputQueue === 0) {
    stationState.batchProcessed = 0;
  }

  if (!stationState.isRunning && stationState.inputQueue > 0 && stationState.outputQueue < OUTPUT_MAX) {
    stationState.inputQueue--;
    stationState.isRunning = true;
    stationState.progress = 0;
    playThunk();
  }

  if (stationState.isRunning) {
    const effectiveTime = getEffectiveTime(stationState.batchProcessed);
    stationState.progress += dt / effectiveTime;

    // Animate hopper wobble
    if (hopperMesh) {
      hopperMesh.rotation.z = Math.sin(Date.now() * 0.018) * 0.03;
    }

    if (stationState.progress >= 1) {
      stationState.progress = 0;
      stationState.isRunning = false;
      stationState.batchProcessed++;
      stationState.outputQueue++;
      playDing();
      if (hopperMesh) hopperMesh.rotation.z = 0;
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
    border: '1px solid rgba(200,140,255,0.2)',
    borderRadius: '16px', padding: '0', width: '440px',
    color: '#fff', fontFamily: 'monospace', fontSize: '14px',
    zIndex: '200', display: 'none', pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);
}

export function openStuffingStationUI() {
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
  const hasShell = hasItem('material', 'plushie_shell');
  const hasStuffing = hasItem('material', 'stuffing');
  const canLoad = hasShell && hasStuffing && stationState.inputQueue < MAX_INPUT;
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
    statusText = `Stuffing... (${totalQueued} in queue)${isSlow ? ' [slow]' : ''}`;
    statusColor = isSlow ? '#fa8' : '#c8f';
  }

  const missingMsg = !hasShell && !hasStuffing ? 'Need shell + stuffing' :
    !hasShell ? 'Need plushie shell' :
    !hasStuffing ? 'Need stuffing' : '';

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:18px;font-weight:bold;letter-spacing:0.5px">Stuffing Station</span>
        <button id="ss-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:${statusColor};font-size:12px;margin-bottom:14px">${statusText}</div>
    </div>

    <div style="padding:0 24px">
      <!-- Two inputs + arrow + output -->
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px">
        <!-- Input A: Shell -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">INPUT A</div>
          <div style="
            width:64px;height:64px;
            border:2px ${hasShell ? 'solid rgba(255,140,200,0.4)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${hasShell ? `
              <div style="width:22px;height:22px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 40% 35%,#ffcce0,#f0a0c0);border:1px solid rgba(220,100,160,0.4)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:3px">✓</span>
            ` : `<span style="font-size:10px;color:#555">None</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Shell</div>
        </div>

        <!-- + sign -->
        <div style="font-size:16px;color:#444;padding-top:10px">+</div>

        <!-- Input B: Stuffing -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">INPUT B</div>
          <div style="
            width:64px;height:64px;
            border:2px ${hasStuffing ? 'solid rgba(240,240,255,0.4)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${hasStuffing ? `
              <div style="width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ffffff,#e8e8e8);box-shadow:0 0 8px rgba(255,255,255,0.3)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:3px">✓</span>
            ` : `<span style="font-size:10px;color:#555">None</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Stuffing</div>
        </div>

        <!-- Arrow + Load -->
        <div style="text-align:center">
          <div style="font-size:20px;color:#555;margin-bottom:6px">&rarr;</div>
          <button id="ss-load" style="
            padding:5px 10px;border-radius:6px;font-family:monospace;font-size:11px;
            cursor:${canLoad ? 'pointer' : 'default'};
            border:1px solid ${canLoad ? 'rgba(200,140,255,0.4)' : 'rgba(255,255,255,0.1)'};
            background:${canLoad ? 'rgba(200,140,255,0.1)' : 'rgba(255,255,255,0.03)'};
            color:${canLoad ? '#c8f' : '#444'};
          " ${canLoad ? '' : 'disabled'}>Load</button>
        </div>

        <!-- Output slot -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">OUTPUT</div>
          <div style="
            width:64px;height:64px;
            border:2px ${canCollect ? 'solid rgba(180,100,255,0.5)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${stationState.outputQueue > 0 ? `
              <div style="width:28px;height:28px;border-radius:4px;background:linear-gradient(135deg,#f0a0e8,#c87aff);box-shadow:0 0 10px rgba(220,120,255,0.5)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:2px">${stationState.outputQueue}/${OUTPUT_MAX}</span>
            ` : `<span style="font-size:10px;color:#555">Empty</span>`}
          </div>
          <div style="font-size:10px;color:#dd88ff;margin-top:4px">Plushie!</div>
        </div>
      </div>

      ${missingMsg ? `<div style="font-size:11px;color:#f84;text-align:center;margin-bottom:8px">${missingMsg}</div>` : ''}

      ${totalQueued > 0 ? `<div style="font-size:11px;color:#888;text-align:center;margin-bottom:8px">${totalQueued} set${totalQueued !== 1 ? 's' : ''} queued</div>` : ''}

      <!-- Progress bar -->
      <div style="margin-bottom:12px">
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:10px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:${isProcessing ? (isSlow ? '#fa8' : '#c8f') : '#333'};border-radius:4px;transition:width 0.1s linear"></div>
        </div>
        ${isSlow && isProcessing ? `<div style="font-size:10px;color:#fa8;text-align:right;margin-top:2px">efficiency reduced</div>` : ''}
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">
        <button id="ss-load-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canLoad ? 'pointer' : 'default'};
          border:1px solid ${canLoad ? 'rgba(200,140,255,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canLoad ? 'rgba(200,140,255,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canLoad ? '#c8f' : '#444'};
        " ${canLoad ? '' : 'disabled'}>Load All</button>
        <button id="ss-collect" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(180,100,255,0.4)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(180,100,255,0.1)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#dd88ff' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect</button>
        <button id="ss-collect-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(180,100,255,0.4)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(180,100,255,0.1)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#dd88ff' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect All</button>
      </div>

      <div style="font-size:11px;color:#555;text-align:center;margin-bottom:4px">
        Shell + Stuffing &rarr; Handmade Plushie (${effectiveTime.toFixed(1)}s)
      </div>
    </div>

    <div style="padding:8px 24px 16px;text-align:center">
      <button id="ss-done" style="
        padding:6px 20px;border-radius:6px;font-family:monospace;font-size:13px;
        cursor:pointer;border:1px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.06);color:#888;
      ">Done</button>
    </div>
  `;

  panel.querySelector('#ss-close').addEventListener('click', closeUI);
  panel.querySelector('#ss-done').addEventListener('click', closeUI);

  const loadBtn = panel.querySelector('#ss-load');
  if (loadBtn && canLoad) loadBtn.addEventListener('click', () => loadPair(1));

  const loadAllBtn = panel.querySelector('#ss-load-all');
  if (loadAllBtn && canLoad) loadAllBtn.addEventListener('click', () => loadAllPairs());

  const collectBtn = panel.querySelector('#ss-collect');
  if (collectBtn && canCollect) collectBtn.addEventListener('click', () => collectPlushie(1));

  const collectAllBtn = panel.querySelector('#ss-collect-all');
  if (collectAllBtn && canCollect) collectAllBtn.addEventListener('click', () => collectAllPlushies());
}

// --- Actions ---

function loadPair(count) {
  for (let i = 0; i < count; i++) {
    if (!hasItem('material', 'plushie_shell') || !hasItem('material', 'stuffing')) break;
    if (stationState.inputQueue >= MAX_INPUT) break;
    if (removeItem('material', 'plushie_shell') && removeItem('material', 'stuffing')) {
      stationState.inputQueue++;
      playThunk();
    }
  }
  updateStatusLight();
  renderUI();
}

function loadAllPairs() {
  let loaded = 0;
  while (hasItem('material', 'plushie_shell') && hasItem('material', 'stuffing') &&
         stationState.inputQueue < MAX_INPUT) {
    if (removeItem('material', 'plushie_shell') && removeItem('material', 'stuffing')) {
      stationState.inputQueue++;
      loaded++;
    } else break;
  }
  if (loaded > 0) playThunk();
  updateStatusLight();
  renderUI();
}

function collectPlushie(count) {
  let collected = 0;
  for (let i = 0; i < count; i++) {
    if (stationState.outputQueue <= 0) break;
    if (isFull()) break;
    if (addItem('plushie', 'handmade')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }
  if (collected > 0) { playDing(); updateStatusLight(); }
  renderUI();
}

function collectAllPlushies() {
  let collected = 0;
  while (stationState.outputQueue > 0 && !isFull()) {
    if (addItem('plushie', 'handmade')) {
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
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) { /* ignore */ }
}

function playDing() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Two-note chime for finishing a plushie
    const times = [[1047, 0], [1319, 0.1]];
    for (const [freq, delay] of times) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.5);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + 0.5);
    }
  } catch (e) { /* ignore */ }
}
