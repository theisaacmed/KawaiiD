// Story Events — three one-time narrative events
//
// 1. Marina's Lighthouse (10 deals): PointLight on lighthouse, text overlay, stays on
// 2. Sora's Color Party (15 deals): +0.5 colorAmount to buildings within 40u, particle burst, screen flash
// 3. Kenji/Zoe Reveal (5+ deals both): text overlay, +2 relationship levels both, +50 JP
//
// Flags in referralState (npc.js) are authoritative for "did this trigger".
// This module tracks whether visual effects have been applied (separate from trigger state).

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { isOrderInTransit } from './smuggling.js';

// Marina's lighthouse position (from named-buildings.js)
const LIGHTHOUSE_POS = new THREE.Vector3(-95, 0, 225);
const SORA_POS = new THREE.Vector3(172, 0, 75); // Sora's building center

// --- State ---
const applied = {
  lighthouse: false,
  soraParty: false,
  kenjiZoe: false,
};

let lighthouseLight = null;
let sceneRef = null;
let lighthouseBlinkTimer = 0;
let lighthouseBlinkOn = true;

// Callbacks injected from main.js
let addJPFn = null;
let getRelationshipFn = null;

// --- Init ---
export function initStoryEvents(scene) {
  sceneRef = scene;

  // Lighthouse PointLight — starts off, enabled when Marina event fires
  lighthouseLight = new THREE.PointLight(0x9FE1CB, 0, 0); // zero intensity until triggered
  lighthouseLight.position.set(LIGHTHOUSE_POS.x, 12, LIGHTHOUSE_POS.z); // top of lighthouse tower
  scene.add(lighthouseLight);
}

export function setStoryCallbacks(addJP, getRelationship) {
  addJPFn = addJP;
  getRelationshipFn = getRelationship;
}

// --- Sync persistent state on load ---
// Called after referralState is restored; applies visual effects without text overlays
export function syncStoryEffects(referralState) {
  if (!referralState) return;

  if (referralState.marineLighthouse && !applied.lighthouse) {
    enableLighthouse();
    applied.lighthouse = true;
  }
  if (referralState.kenjiZoeDiscovery && !applied.kenjiZoe) {
    applied.kenjiZoe = true; // effects already applied in the session they fired
  }
  if (referralState.soraEvent && !applied.soraParty) {
    applied.soraParty = true;
  }
}

// --- Called when a social/referral event fires during gameplay ---
export function onStoryTrigger(result, referralState) {
  if (!result || !referralState) return;

  if (referralState.marineLighthouse && !applied.lighthouse) {
    applied.lighthouse = true;
    enableLighthouse();
    showStoryOverlay(
      "Marina's Lighthouse",
      "A beam of seafoam light sweeps across the port.\nThe lighthouse has been dark for years.\nNot anymore.",
      '#9FE1CB'
    );
  }

  if (referralState.soraEvent && !applied.soraParty) {
    applied.soraParty = true;
    fireSoraParty();
  }

  if (referralState.kenjiZoeDiscovery && !applied.kenjiZoe) {
    applied.kenjiZoe = true;
    fireKenjiZoeReveal();
  }
}

// --- Marina: Lighthouse on ---
function enableLighthouse() {
  if (!lighthouseLight) return;
  lighthouseLight.intensity = 2;
  lighthouseLight.distance = 100;
  lighthouseLight.color.set(0x9FE1CB);
  lighthouseBlinkOn = true;
  lighthouseBlinkTimer = 0;
}

// --- Sora: Color Party ---
function fireSoraParty() {
  // Spread +0.5 colorAmount to buildings within 40 units of Sora's building
  const buildings = getBuildingColors();
  let affected = 0;
  for (const b of buildings) {
    const dx = (b.x || 0) - SORA_POS.x;
    const dz = (b.z || 0) - SORA_POS.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 40) {
      b.colorAmount = Math.min(1.0, (b.colorAmount || 0) + 0.5);
      affected++;
    }
  }

  // Screen flash
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(250,199,117,0.35)',
    pointerEvents: 'none',
    zIndex: '500',
    transition: 'opacity 0.8s',
  });
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 900);
  }, 200);

  // Particle burst in scene near Sora's building
  if (sceneRef) spawnParticleBurst(SORA_POS, 0xFAC775);

  showStoryOverlay(
    "Sora's Color Party",
    "Invitations went out.\nThe rooftop blazes gold.\nUptown has never seen anything like this.",
    '#FAC775'
  );
}

// --- Kenji/Zoe: Father and Daughter reveal ---
function fireKenjiZoeReveal() {
  // +2 relationship levels each
  if (getRelationshipFn) {
    const kenji = getRelationshipFn('Kenji');
    const zoe = getRelationshipFn('Zoe');
    if (kenji) kenji.level = Math.min(5, (kenji.level || 0) + 2);
    if (zoe) zoe.level = Math.min(5, (zoe.level || 0) + 2);
  }

  // +50 JP
  if (addJPFn) addJPFn(50);

  showStoryOverlay(
    "A Father and Daughter",
    "Kenji's rebellion. Zoe's secret.\nTwo rebels on opposite sides of the city,\nboth loyal to something the world forgot to love.",
    '#AFA9EC'
  );
}

// --- Particle burst helper ---
function spawnParticleBurst(origin, color) {
  const count = 60;
  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    velocities.push({
      x: Math.cos(angle) * speed,
      y: 0.5 + Math.random() * 2,
      z: Math.sin(angle) * speed,
    });
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = 1.5;
    positions[i * 3 + 2] = origin.z;
  }

  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  geo.setAttribute('position', attr);
  const mat = new THREE.PointsMaterial({
    color, size: 0.4, transparent: true, opacity: 0.9,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  sceneRef.add(points);

  let t = 0;
  function tick() {
    t += 0.016;
    if (t > 2.5) {
      sceneRef.remove(points);
      geo.dispose();
      mat.dispose();
      return;
    }
    for (let i = 0; i < count; i++) {
      const v = velocities[i];
      positions[i * 3] += v.x * 0.016;
      positions[i * 3 + 1] += v.y * 0.016 - 0.02;
      positions[i * 3 + 2] += v.z * 0.016;
    }
    attr.needsUpdate = true;
    mat.opacity = Math.max(0, 0.9 - t * 0.5);
    requestAnimationFrame(tick);
  }
  tick();
}

// --- Story text overlay ---
function showStoryOverlay(title, body, accentColor) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)',
    zIndex: '600',
    opacity: '0',
    transition: 'opacity 0.6s',
    pointerEvents: 'auto',
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    background: 'rgba(8,10,20,0.97)',
    border: `1px solid ${accentColor}44`,
    borderRadius: '18px',
    padding: '36px 44px',
    maxWidth: '460px',
    textAlign: 'center',
    fontFamily: 'monospace',
    color: '#fff',
    boxShadow: `0 0 60px ${accentColor}33`,
  });

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: '20px',
    fontWeight: 'bold',
    color: accentColor,
    marginBottom: '16px',
    letterSpacing: '0.05em',
  });

  const bodyEl = document.createElement('div');
  bodyEl.innerHTML = body.replace(/\n/g, '<br>');
  Object.assign(bodyEl.style, {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: '1.9',
    marginBottom: '24px',
  });

  const btn = document.createElement('button');
  btn.textContent = 'Continue';
  Object.assign(btn.style, {
    background: `${accentColor}22`,
    border: `1px solid ${accentColor}55`,
    borderRadius: '8px',
    color: accentColor,
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '9px 28px',
    cursor: 'pointer',
  });

  card.appendChild(titleEl);
  card.appendChild(bodyEl);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function dismiss() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 700);
  }

  btn.addEventListener('click', dismiss);
  document.addEventListener('keydown', function onKey(e) {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
      document.removeEventListener('keydown', onKey);
      dismiss();
    }
  }, { once: false });

  // Auto-dismiss after 12 seconds if not clicked
  setTimeout(dismiss, 12000);
}

// --- Per-frame update ---
// Drives lighthouse blink when a Gus shipment is in transit.
// Steady light otherwise (when lighthouse is enabled).
const BLINK_PERIOD_TRANSIT = 1.4;  // blink cycle in seconds during transit
const BLINK_ON_FRAC = 0.45;        // fraction of period the light is on

export function updateStoryEvents(dt) {
  if (!applied.lighthouse || !lighthouseLight) return;

  if (isOrderInTransit()) {
    // Blinking mode while order is in transit
    lighthouseBlinkTimer += dt;
    if (lighthouseBlinkTimer >= BLINK_PERIOD_TRANSIT) {
      lighthouseBlinkTimer -= BLINK_PERIOD_TRANSIT;
    }
    const blinkOn = lighthouseBlinkTimer / BLINK_PERIOD_TRANSIT < BLINK_ON_FRAC;
    lighthouseLight.intensity = blinkOn ? 2 : 0;
  } else {
    // Steady glow when no order in transit
    lighthouseLight.intensity = 2;
  }
}

// --- Save / Load ---
export function getStoryEventsSaveData() {
  return { ...applied };
}

export function restoreStoryEvents(data) {
  if (!data) return;
  Object.assign(applied, data);
}
