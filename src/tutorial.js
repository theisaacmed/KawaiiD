// Tutorial — scripted first-time experience for new players.
// Walks the player through finding a sticker, meeting Mei, and completing a deal.
// Steps 0-5; skip button available at all times.

import * as THREE from 'three';

// Ruins entrance area (RUINS_Z_START ≈ 28)
const RUINS_WAYPOINT = new THREE.Vector3(0, 0, 34);
// Mei's world position
const MEI_POS = new THREE.Vector3(-10, 0, 15);

const STEP_TEXTS = [
  // Step 0 — intro lore (3s auto-advance)
  "The city has been drained of all color.\nCuteness is banned.",
  // Step 1 — go to ruins
  "Head to the Ruins to the south.\nMaybe you can find something there.",
  // Step 2 — found sticker (triggered by ruins search)
  "You found an old sticker!\nThere might be someone who wants this.",
  // Step 3 — go meet Mei
  "Mei is nearby. Walk up to her and press E.",
  // Step 4 — deal complete
  "Color is returning!\nKeep dealing to restore the city.\n\nHint: press [Tab] to open your phone — NPCs will text you deal offers.",
  // Step 5 — complete (no text shown)
  null,
];

const STEP_DURATION = [3, 0, 3, 0, 5, 0]; // seconds for auto-advance; 0 = wait for event

// Internal state
let tutorialStep = 0;
let tutorialComplete = false;
let stepTimer = 0;
let sceneRef = null;
let waypointMesh = null;

// UI
let overlayEl = null;
let textEl = null;
let skipBtn = null;

// ==============================
// Public API
// ==============================

export function isTutorialComplete() { return tutorialComplete; }

// Returns true while the player needs to complete the first deal with Mei.
export function isTutorialDealStep() { return !tutorialComplete && tutorialStep === 3; }

export function getTutorialState() {
  return { step: tutorialStep, complete: tutorialComplete };
}

export function restoreTutorialState(data) {
  if (!data) return;
  if (data.complete) {
    tutorialComplete = true;
    tutorialStep = 5;
    return;
  }
  // If save exists and tutorial was in progress, just mark complete to avoid
  // re-running confusing mid-session state on reload.
  tutorialComplete = true;
  tutorialStep = 5;
}

// Called from main.js on new game
export function initTutorial(scene, isNewGame) {
  sceneRef = scene;
  createOverlay();
  createWaypointMesh(scene);

  if (isNewGame) {
    tutorialStep = 0;
    tutorialComplete = false;
    showStep(0);
  } else {
    // Hide everything; state already restored via restoreTutorialState
    hideOverlay();
  }
}

// Called every frame from main.js game loop
export function updateTutorial(dt, playerPos, piles) {
  if (tutorialComplete) return;

  stepTimer = Math.max(0, stepTimer - dt);

  // Auto-advance steps that have a duration
  if (stepTimer === 0 && STEP_DURATION[tutorialStep] > 0) {
    // Duration just expired
    if (tutorialStep === 0) {
      advanceStep(1);
      return;
    }
    if (tutorialStep === 2) {
      advanceStep(3);
      return;
    }
    if (tutorialStep === 4) {
      advanceStep(5);
      return;
    }
  }

  // Step 1: watch for player entering ruins (z < -150) AND searching a rubble pile
  if (tutorialStep === 1 && playerPos && playerPos.z < -150) {
    if (piles && piles.some(p => p.searched)) {
      advanceStep(2);
    }
  }
}

// Called from main.js deal callback when a deal completes
export function onTutorialDealComplete() {
  if (tutorialComplete) return;
  if (tutorialStep === 3) {
    advanceStep(4);
  }
}

// ==============================
// Step logic
// ==============================

function advanceStep(to) {
  tutorialStep = to;
  stepTimer = 0;

  if (to >= 5) {
    tutorialComplete = true;
    hideOverlay();
    hideWaypoint();
    return;
  }

  showStep(to);
}

function showStep(step) {
  const text = STEP_TEXTS[step];
  if (!text) return;

  showOverlay(text);
  stepTimer = STEP_DURATION[step];

  // Waypoint management
  if (step === 1) {
    positionWaypoint(RUINS_WAYPOINT);
    showWaypoint();
  } else if (step === 3) {
    positionWaypoint(MEI_POS);
    showWaypoint();
  } else {
    hideWaypoint();
  }
}

// ==============================
// Overlay UI
// ==============================

function createOverlay() {
  overlayEl = document.createElement('div');
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '0', left: '0', right: '0',
    display: 'none',
    zIndex: '300',
    pointerEvents: 'none',
    fontFamily: 'monospace',
  });

  // Backdrop strip at top
  const bg = document.createElement('div');
  Object.assign(bg.style, {
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
    padding: '30px 40px 40px',
    textAlign: 'center',
  });

  textEl = document.createElement('div');
  Object.assign(textEl.style, {
    fontSize: '20px',
    lineHeight: '1.5',
    color: '#f5e6d0',
    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
    whiteSpace: 'pre-line',
    letterSpacing: '0.5px',
  });
  bg.appendChild(textEl);
  overlayEl.appendChild(bg);

  // Skip button — always interactive
  skipBtn = document.createElement('button');
  skipBtn.textContent = 'Skip Tutorial';
  Object.assign(skipBtn.style, {
    position: 'fixed', top: '14px', right: '14px',
    fontFamily: 'monospace', fontSize: '11px',
    background: 'rgba(0,0,0,0.55)',
    color: '#888',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    zIndex: '301',
    display: 'none',
    pointerEvents: 'auto',
  });
  skipBtn.onclick = () => skipTutorial();
  document.body.appendChild(skipBtn);

  document.body.appendChild(overlayEl);
}

function showOverlay(text) {
  if (textEl) textEl.textContent = text;
  if (overlayEl) {
    overlayEl.style.display = 'block';
    overlayEl.style.opacity = '0';
    overlayEl.style.transition = 'opacity 0.6s';
    requestAnimationFrame(() => { overlayEl.style.opacity = '1'; });
  }
  if (skipBtn) skipBtn.style.display = 'block';
}

function hideOverlay() {
  if (overlayEl) overlayEl.style.display = 'none';
  if (skipBtn) skipBtn.style.display = 'none';
}

function skipTutorial() {
  tutorialComplete = true;
  tutorialStep = 5;
  hideOverlay();
  hideWaypoint();
}

// ==============================
// Waypoint mesh — glowing pillar at destination
// ==============================

function createWaypointMesh(scene) {
  const group = new THREE.Group();

  // Vertical pillar
  const pillarMat = new THREE.MeshLambertMaterial({
    color: 0xffee44,
    transparent: true,
    opacity: 0.85,
    emissive: new THREE.Color(0xffcc00),
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), pillarMat);
  pillar.position.y = 1.25;
  group.add(pillar);

  // Diamond top
  const diamondMat = new THREE.MeshLambertMaterial({
    color: 0xffee44,
    transparent: true,
    opacity: 0.9,
  });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), diamondMat);
  diamond.position.y = 2.8;
  group.add(diamond);

  group.visible = false;
  scene.add(group);
  waypointMesh = group;
}

function showWaypoint() {
  if (waypointMesh) waypointMesh.visible = true;
}

function hideWaypoint() {
  if (waypointMesh) waypointMesh.visible = false;
}

function positionWaypoint(pos) {
  if (waypointMesh) waypointMesh.position.set(pos.x, 0, pos.z);
}
