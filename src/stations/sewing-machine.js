// Sewing Machine — second station in the plushie pipeline (deliberate bottleneck)
// Input: 1 plushie pattern + 1 thread spool → Output: 1 plushie shell
// Features: two-input slot, queue-based, offline processing, diminishing efficiency

import * as THREE from 'three';
import { hasItem, removeItem, addItem, isFull } from '../inventory.js';
import { SEWING_STATION_POS } from '../apartment.js';

// --- Constants ---
const BASE_TIME = 8;   // seconds per sew (deliberate bottleneck)
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
let needleMesh = null;
let sceneRef = null;
let isUIOpen = false;
let enabled = false;

let backdrop = null;
let panel = null;
let audioCtx = null;

// --- Public API ---

export function isNearSewingMachine(playerPos) {
  if (!stationMesh || !enabled) return false;
  const dx = playerPos.x - SEWING_STATION_POS.x;
  const dz = playerPos.z - SEWING_STATION_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function isSewingMachineOpen() { return isUIOpen; }

export function setStationEnabled(val) {
  enabled = val;
  if (stationMesh) stationMesh.visible = val;
}

export function getSewingMachineSaveData() {
  return { ...stationState, lastUpdateTime: Date.now() };
}

export function restoreSewingMachineState(data) {
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

export function initSewingMachine(scene, player) {
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
  group.position.copy(SEWING_STATION_POS);

  // Machine body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    emissive: 0x080812,
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), bodyMat);
  body.position.y = 0.275;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Base/table surface
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, emissive: 0x0a0a18, emissiveIntensity: 0.15 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.65), baseMat);
  base.position.y = 0.565;
  group.add(base);

  // Arm — vertical part (left side)
  const armMat = new THREE.MeshStandardMaterial({ color: 0x252538, emissive: 0x0a0a18, emissiveIntensity: 0.2 });
  const armVert = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), armMat);
  armVert.position.set(-0.32, 0.86, 0);
  armVert.castShadow = true;
  group.add(armVert);

  // Arm — horizontal part
  const armHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.14), armMat);
  armHoriz.position.set(-0.065, 1.08, 0);
  armHoriz.castShadow = true;
  group.add(armHoriz);

  // Needle (thin, pointing down from arm tip)
  const needleMat = new THREE.MeshStandardMaterial({
    color: 0xccccdd,
    emissive: 0x666688,
    emissiveIntensity: 0.4,
  });
  needleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.025), needleMat);
  needleMesh.position.set(0.19, 0.91, 0);
  group.add(needleMesh);

  // Bobbin/thread spool on arm
  const bobbinMat = new THREE.MeshStandardMaterial({ color: 0xc8a870 });
  const bobbin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), bobbinMat);
  bobbin.rotation.z = Math.PI / 2;
  bobbin.position.set(-0.25, 1.08, 0);
  group.add(bobbin);

  // Work light (small glowing sphere near needle)
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffc0, emissive: 0xffffaa, emissiveIntensity: 0.6 });
  const workLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), lightMat);
  workLight.position.set(0.19, 1.02, 0.1);
  group.add(workLight);

  // Status light
  statusLightMat = new THREE.MeshStandardMaterial({
    color: 0x44ff44,
    emissive: 0x44ff44,
    emissiveIntensity: 0.8,
  });
  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), statusLightMat);
  statusLight.position.set(0, 0.4, 0.31);
  group.add(statusLight);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(10, 8, 236, 48, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('SEWING MACHINE', 128, 32);
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

export function updateSewingMachine(dt) {
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

    // Animate needle bobbing
    if (needleMesh) {
      needleMesh.position.y = 0.91 + Math.sin(Date.now() * 0.025) * 0.06;
    }

    if (stationState.progress >= 1) {
      stationState.progress = 0;
      stationState.isRunning = false;
      stationState.batchProcessed++;
      stationState.outputQueue++;
      playDing();
      if (needleMesh) needleMesh.position.y = 0.91;
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
    border: '1px solid rgba(180,140,220,0.2)',
    borderRadius: '16px', padding: '0', width: '440px',
    color: '#fff', fontFamily: 'monospace', fontSize: '14px',
    zIndex: '200', display: 'none', pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);
}

export function openSewingMachineUI() {
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
  const hasPattern = hasItem('material', 'plushie_pattern');
  const hasThread = hasItem('material', 'thread_spool');
  const canLoad = hasPattern && hasThread && stationState.inputQueue < MAX_INPUT;
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
    statusText = `Sewing... (${totalQueued} in queue)${isSlow ? ' [slow]' : ''}`;
    statusColor = isSlow ? '#fa8' : '#c8f';
  }

  const missingMsg = !hasPattern && !hasThread ? 'Need pattern + thread' :
    !hasPattern ? 'Need plushie pattern' :
    !hasThread ? 'Need thread spool' : '';

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:18px;font-weight:bold;letter-spacing:0.5px">Sewing Machine</span>
        <button id="sm-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:${statusColor};font-size:12px;margin-bottom:14px">${statusText}</div>
    </div>

    <div style="padding:0 24px">
      <!-- Two inputs + arrow + output -->
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px">
        <!-- Input A: Pattern -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">INPUT A</div>
          <div style="
            width:64px;height:64px;
            border:2px ${hasPattern ? 'solid rgba(240,220,120,0.4)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${hasPattern ? `
              <div style="width:20px;height:20px;border-radius:1px;background:linear-gradient(135deg,#f5e8c8,#e0d0a8);border:1px dashed rgba(160,120,60,0.5)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:3px">✓</span>
            ` : `<span style="font-size:10px;color:#555">None</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Pattern</div>
        </div>

        <!-- + sign -->
        <div style="font-size:16px;color:#444;padding-top:10px">+</div>

        <!-- Input B: Thread -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">INPUT B</div>
          <div style="
            width:64px;height:64px;
            border:2px ${hasThread ? 'solid rgba(200,170,120,0.4)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${hasThread ? `
              <div style="width:20px;height:20px;border-radius:3px;background:linear-gradient(180deg,#c8a870 15%,#a07848 20%,#e8c898 25%,#e8c898 75%,#a07848 80%,#c8a870 85%)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:3px">✓</span>
            ` : `<span style="font-size:10px;color:#555">None</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Thread</div>
        </div>

        <!-- Arrow + Load -->
        <div style="text-align:center">
          <div style="font-size:20px;color:#555;margin-bottom:6px">&rarr;</div>
          <button id="sm-load" style="
            padding:5px 10px;border-radius:6px;font-family:monospace;font-size:11px;
            cursor:${canLoad ? 'pointer' : 'default'};
            border:1px solid ${canLoad ? 'rgba(180,140,220,0.4)' : 'rgba(255,255,255,0.1)'};
            background:${canLoad ? 'rgba(180,140,220,0.1)' : 'rgba(255,255,255,0.03)'};
            color:${canLoad ? '#c8a' : '#444'};
          " ${canLoad ? '' : 'disabled'}>Load</button>
        </div>

        <!-- Output slot -->
        <div style="text-align:center">
          <div style="font-size:10px;color:#888;margin-bottom:6px">OUTPUT</div>
          <div style="
            width:64px;height:64px;
            border:2px ${canCollect ? 'solid rgba(255,140,200,0.4)' : 'dashed rgba(255,255,255,0.12)'};
            border-radius:10px;background:rgba(255,255,255,0.04);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
          ">
            ${stationState.outputQueue > 0 ? `
              <div style="width:22px;height:22px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 40% 35%,#ffcce0,#f0a0c0);border:1px solid rgba(220,100,160,0.4)"></div>
              <span style="font-size:10px;color:#aaa;margin-top:2px">${stationState.outputQueue}/${OUTPUT_MAX}</span>
            ` : `<span style="font-size:10px;color:#555">Empty</span>`}
          </div>
          <div style="font-size:10px;color:#555;margin-top:4px">Shell</div>
        </div>
      </div>

      ${missingMsg ? `<div style="font-size:11px;color:#f84;text-align:center;margin-bottom:8px">${missingMsg}</div>` : ''}

      <!-- Queue info -->
      ${totalQueued > 0 ? `<div style="font-size:11px;color:#888;text-align:center;margin-bottom:8px">${totalQueued} pair${totalQueued !== 1 ? 's' : ''} queued</div>` : ''}

      <!-- Progress bar -->
      <div style="margin-bottom:12px">
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:10px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:${isProcessing ? (isSlow ? '#fa8' : '#c8a') : '#333'};border-radius:4px;transition:width 0.1s linear"></div>
        </div>
        ${isSlow && isProcessing ? `<div style="font-size:10px;color:#fa8;text-align:right;margin-top:2px">efficiency reduced</div>` : ''}
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">
        <button id="sm-load-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canLoad ? 'pointer' : 'default'};
          border:1px solid ${canLoad ? 'rgba(180,140,220,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canLoad ? 'rgba(180,140,220,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canLoad ? '#c8a' : '#444'};
        " ${canLoad ? '' : 'disabled'}>Load All</button>
        <button id="sm-collect" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(255,140,200,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(255,140,200,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#f8c' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect</button>
        <button id="sm-collect-all" style="
          padding:6px 14px;border-radius:6px;font-family:monospace;font-size:12px;
          cursor:${canCollect ? 'pointer' : 'default'};
          border:1px solid ${canCollect ? 'rgba(255,140,200,0.3)' : 'rgba(255,255,255,0.1)'};
          background:${canCollect ? 'rgba(255,140,200,0.08)' : 'rgba(255,255,255,0.03)'};
          color:${canCollect ? '#f8c' : '#444'};
        " ${canCollect ? '' : 'disabled'}>Collect All</button>
      </div>

      <div style="font-size:11px;color:#555;text-align:center;margin-bottom:4px">
        Pattern + Thread &rarr; Plushie Shell (${effectiveTime.toFixed(1)}s)
      </div>
    </div>

    <div style="padding:8px 24px 16px;text-align:center">
      <button id="sm-done" style="
        padding:6px 20px;border-radius:6px;font-family:monospace;font-size:13px;
        cursor:pointer;border:1px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.06);color:#888;
      ">Done</button>
    </div>
  `;

  panel.querySelector('#sm-close').addEventListener('click', closeUI);
  panel.querySelector('#sm-done').addEventListener('click', closeUI);

  const loadBtn = panel.querySelector('#sm-load');
  if (loadBtn && canLoad) loadBtn.addEventListener('click', () => loadPair(1));

  const loadAllBtn = panel.querySelector('#sm-load-all');
  if (loadAllBtn && canLoad) loadAllBtn.addEventListener('click', () => loadAllPairs());

  const collectBtn = panel.querySelector('#sm-collect');
  if (collectBtn && canCollect) collectBtn.addEventListener('click', () => collectShell(1));

  const collectAllBtn = panel.querySelector('#sm-collect-all');
  if (collectAllBtn && canCollect) collectAllBtn.addEventListener('click', () => collectAllShells());
}

// --- Actions ---

function loadPair(count) {
  for (let i = 0; i < count; i++) {
    if (!hasItem('material', 'plushie_pattern') || !hasItem('material', 'thread_spool')) break;
    if (stationState.inputQueue >= MAX_INPUT) break;
    if (removeItem('material', 'plushie_pattern') && removeItem('material', 'thread_spool')) {
      stationState.inputQueue++;
      playThunk();
    }
  }
  updateStatusLight();
  renderUI();
}

function loadAllPairs() {
  let loaded = 0;
  while (hasItem('material', 'plushie_pattern') && hasItem('material', 'thread_spool') &&
         stationState.inputQueue < MAX_INPUT) {
    if (removeItem('material', 'plushie_pattern') && removeItem('material', 'thread_spool')) {
      stationState.inputQueue++;
      loaded++;
    } else break;
  }
  if (loaded > 0) playThunk();
  updateStatusLight();
  renderUI();
}

function collectShell(count) {
  let collected = 0;
  for (let i = 0; i < count; i++) {
    if (stationState.outputQueue <= 0) break;
    if (isFull()) break;
    if (addItem('material', 'plushie_shell')) {
      stationState.outputQueue--;
      collected++;
    } else break;
  }
  if (collected > 0) { playDing(); updateStatusLight(); }
  renderUI();
}

function collectAllShells() {
  let collected = 0;
  while (stationState.outputQueue > 0 && !isFull()) {
    if (addItem('material', 'plushie_shell')) {
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
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) { /* ignore */ }
}

function playDing() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(784, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) { /* ignore */ }
}
