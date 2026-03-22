// Progression system — milestone messages and victory condition
//
// Tracks total deals and world color percentage
// Shows dramatic text overlays at key milestones
// Detects victory (100% color) and triggers ending sequence

import { playProgressionChime, playVictorySwell } from './audio.js';

// Milestones — each triggers once
const DEAL_MILESTONES = [
  { deals: 1,  msg: 'The first spark of color in a gray world.' },
  { deals: 10, msg: 'Word is spreading. People are starting to smile.' },
  { deals: 20, msg: "You need help. You can't do this alone anymore." },
  { deals: 25, msg: 'A whole new district needs your help.' },
  { deals: 35, msg: 'Time to make things... extra cute.' },
  { deals: 50, msg: "ACE can't stop what's already begun." },
];

const COLOR_MILESTONES = [
  { pct: 0.50, msg: "Look at what you've built. The city remembers what it used to be." },
  { pct: 0.90, msg: 'They banned cuteness. You brought it back.' },
  { pct: 1.00, msg: 'The gray is gone. The city is alive again. You did this.' },
];

// State
const triggeredDeals = new Set();
const triggeredColors = new Set();
let victoryTriggered = false;
let messageQueue = [];
let showingMessage = false;
let overlayEl = null;

// Callbacks
let onVictoryFn = null;

export function initProgression() {
  createOverlay();
}

export function setVictoryCallback(fn) {
  onVictoryFn = fn;
}

function createOverlay() {
  overlayEl = document.createElement('div');
  overlayEl.id = 'progression-overlay';
  Object.assign(overlayEl.style, {
    position: 'fixed', inset: '0',
    display: 'none',
    alignItems: 'center', justifyContent: 'center',
    zIndex: '8000',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.4)',
    opacity: '0',
    transition: 'opacity 0.6s ease',
  });
  document.body.appendChild(overlayEl);
}

// Check deal count milestones
export function checkDealMilestone(totalDeals) {
  for (const m of DEAL_MILESTONES) {
    if (totalDeals >= m.deals && !triggeredDeals.has(m.deals)) {
      triggeredDeals.add(m.deals);
      queueMessage(m.msg);
    }
  }
}

// Check world color milestones + victory
export function checkColorMilestone(worldColor) {
  for (const m of COLOR_MILESTONES) {
    if (worldColor >= m.pct && !triggeredColors.has(m.pct)) {
      triggeredColors.add(m.pct);
      queueMessage(m.msg);
    }
  }

  // Victory check: all buildings >= 0.9 average
  if (worldColor >= 0.95 && !victoryTriggered) {
    victoryTriggered = true;
    // Queue victory message after any pending color milestone
    setTimeout(() => triggerVictory(), 4000);
  }
}

export function isVictoryTriggered() {
  return victoryTriggered;
}

function queueMessage(msg) {
  messageQueue.push(msg);
  if (!showingMessage) showNextMessage();
}

function showNextMessage() {
  if (messageQueue.length === 0) {
    showingMessage = false;
    return;
  }

  showingMessage = true;
  const msg = messageQueue.shift();

  playProgressionChime();

  overlayEl.innerHTML = '';
  const textEl = document.createElement('div');
  Object.assign(textEl.style, {
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#fff',
    textAlign: 'center',
    maxWidth: '600px',
    lineHeight: '1.6',
    letterSpacing: '1px',
    textShadow: '0 0 30px rgba(255,180,220,0.4)',
    padding: '0 40px',
    opacity: '0',
    transform: 'translateY(10px)',
    transition: 'opacity 0.8s ease, transform 0.8s ease',
  });
  textEl.textContent = msg;
  overlayEl.appendChild(textEl);

  overlayEl.style.display = 'flex';
  overlayEl.style.opacity = '1';

  requestAnimationFrame(() => {
    textEl.style.opacity = '1';
    textEl.style.transform = 'translateY(0)';
  });

  // Hold for 3.5 seconds, then fade out
  setTimeout(() => {
    textEl.style.opacity = '0';
    textEl.style.transform = 'translateY(-10px)';
    overlayEl.style.opacity = '0';
    setTimeout(() => {
      overlayEl.style.display = 'none';
      showNextMessage();
    }, 800);
  }, 3500);
}

function triggerVictory() {
  playVictorySwell();

  // Grand victory overlay
  const victoryEl = document.createElement('div');
  Object.assign(victoryEl.style, {
    position: 'fixed', inset: '0',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: '8500',
    background: 'rgba(0,0,0,0)',
    transition: 'background 2s ease',
    fontFamily: 'monospace',
    pointerEvents: 'none',
  });

  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, {
    fontSize: '48px', fontWeight: 'bold',
    color: '#fff', letterSpacing: '6px',
    textShadow: '0 0 40px rgba(255,180,220,0.5), 0 0 80px rgba(100,200,255,0.3)',
    opacity: '0',
    transform: 'scale(0.9)',
    transition: 'opacity 2s ease, transform 2s ease',
    textTransform: 'uppercase',
  });
  titleEl.textContent = 'Kawaii Dealer';
  victoryEl.appendChild(titleEl);

  const thankEl = document.createElement('div');
  Object.assign(thankEl.style, {
    fontSize: '16px', color: '#aab',
    marginTop: '16px', letterSpacing: '2px',
    opacity: '0',
    transition: 'opacity 2s ease 1s',
  });
  thankEl.textContent = 'Thank you for playing';
  victoryEl.appendChild(thankEl);

  const continueEl = document.createElement('div');
  Object.assign(continueEl.style, {
    fontSize: '12px', color: '#556',
    marginTop: '40px',
    opacity: '0',
    transition: 'opacity 1s ease 4s',
  });
  continueEl.textContent = 'You can keep playing in sandbox mode.';
  victoryEl.appendChild(continueEl);

  document.body.appendChild(victoryEl);

  // Animate in
  requestAnimationFrame(() => {
    victoryEl.style.background = 'rgba(0,0,0,0.5)';
    titleEl.style.opacity = '1';
    titleEl.style.transform = 'scale(1)';
    thankEl.style.opacity = '1';
    continueEl.style.opacity = '1';
  });

  // Fade out after 8 seconds
  setTimeout(() => {
    victoryEl.style.opacity = '0';
    victoryEl.style.transition = 'opacity 2s ease';
    setTimeout(() => victoryEl.remove(), 2000);
  }, 8000);

  if (onVictoryFn) onVictoryFn();
}

// Show a rank-up narrative message via the existing overlay system
export function showRankMessage(msg) {
  queueMessage(msg);
}

// --- Save / Restore ---
export function getProgressionState() {
  return {
    triggeredDeals: [...triggeredDeals],
    triggeredColors: [...triggeredColors],
    victoryTriggered,
  };
}

export function restoreProgressionState(data) {
  if (!data) return;
  if (data.triggeredDeals) data.triggeredDeals.forEach(d => triggeredDeals.add(d));
  if (data.triggeredColors) data.triggeredColors.forEach(c => triggeredColors.add(c));
  if (data.victoryTriggered) victoryTriggered = true;
}
