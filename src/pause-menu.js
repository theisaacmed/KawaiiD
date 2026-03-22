// Pause menu — Escape key opens overlay with Resume, Save, Controls, Quit
//
// Time pauses while the menu is open

import { playMenuOpen, playMenuClose, playUIClick } from './audio.js';

let overlay = null;
let controlsOverlay = null;
let isOpen = false;

// Callbacks set by main.js
let onSaveFn = null;
let onQuitFn = null;
let isPausableFn = null; // returns true if no other UI is blocking

export function initPauseMenu(opts) {
  onSaveFn = opts.onSave;
  onQuitFn = opts.onQuit;
  isPausableFn = opts.isPausable;

  createOverlay();

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;

    // Close controls sub-screen first
    if (controlsOverlay) {
      controlsOverlay.remove();
      controlsOverlay = null;
      return;
    }

    if (isOpen) {
      closePauseMenu();
      return;
    }

    // Only open if no other UI is blocking
    if (isPausableFn && !isPausableFn()) return;

    openPauseMenu();
  });
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'pause-menu';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(5,5,15,0.85)',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: '9500',
    fontFamily: 'monospace',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });
  document.body.appendChild(overlay);
}

function openPauseMenu() {
  if (isOpen) return;
  isOpen = true;
  document.exitPointerLock();
  playMenuOpen();
  renderMenu();
  overlay.style.display = 'flex';
}

function closePauseMenu() {
  if (!isOpen) return;
  isOpen = false;
  playMenuClose();
  overlay.style.display = 'none';
}

export function isPauseMenuOpen() {
  return isOpen;
}

function renderMenu() {
  overlay.innerHTML = '';

  // Title
  const title = document.createElement('div');
  Object.assign(title.style, {
    fontSize: '32px', fontWeight: 'bold',
    color: '#fff', letterSpacing: '4px',
    marginBottom: '40px',
    textShadow: '0 0 20px rgba(100,180,255,0.2)',
  });
  title.textContent = 'PAUSED';
  overlay.appendChild(title);

  // Buttons
  const buttons = [
    { text: 'Resume', action: () => closePauseMenu(), primary: true },
    { text: 'Save Game', action: () => { if (onSaveFn) onSaveFn(); showSavedMsg(); } },
    { text: 'Controls', action: () => showControlsScreen() },
    { text: 'Quit to Title', action: () => { closePauseMenu(); if (onQuitFn) onQuitFn(); } },
  ];

  const btnContainer = document.createElement('div');
  Object.assign(btnContainer.style, {
    display: 'flex', flexDirection: 'column',
    gap: '10px', alignItems: 'center',
  });

  for (const b of buttons) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      padding: '12px 40px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '15px',
      fontWeight: 'bold',
      cursor: 'pointer',
      letterSpacing: '1px',
      border: b.primary ? '1px solid rgba(255,107,157,0.4)' : '1px solid rgba(255,255,255,0.15)',
      background: b.primary ? 'rgba(255,107,157,0.12)' : 'rgba(255,255,255,0.06)',
      color: b.primary ? '#ff6b9d' : '#888',
      transition: 'background 0.2s, transform 0.15s',
      minWidth: '220px',
    });
    btn.textContent = b.text;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = b.primary ? 'rgba(255,107,157,0.22)' : 'rgba(255,255,255,0.12)';
      btn.style.transform = 'scale(1.02)';
      playUIClick();
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = b.primary ? 'rgba(255,107,157,0.12)' : 'rgba(255,255,255,0.06)';
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('click', b.action);
    btnContainer.appendChild(btn);
  }

  overlay.appendChild(btnContainer);
}

function showSavedMsg() {
  const msg = document.createElement('div');
  Object.assign(msg.style, {
    position: 'absolute', bottom: '80px',
    fontSize: '14px', color: '#6f6',
    fontFamily: 'monospace',
    transition: 'opacity 0.5s',
  });
  msg.textContent = 'Game saved!';
  overlay.appendChild(msg);
  setTimeout(() => { msg.style.opacity = '0'; }, 1500);
  setTimeout(() => { msg.remove(); }, 2000);
}

function showControlsScreen() {
  controlsOverlay = document.createElement('div');
  Object.assign(controlsOverlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(5,5,15,0.95)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: '9600',
    fontFamily: 'monospace', color: '#fff',
  });

  const hdr = document.createElement('div');
  Object.assign(hdr.style, {
    fontSize: '24px', fontWeight: 'bold',
    marginBottom: '30px', letterSpacing: '3px', color: '#6cf',
  });
  hdr.textContent = 'CONTROLS';
  controlsOverlay.appendChild(hdr);

  const controls = [
    ['WASD', 'Move'],
    ['Mouse', 'Look around'],
    ['E', 'Interact / Search / Talk'],
    ['Tab', 'Open phone'],
    ['Escape', 'Pause menu'],
    ['F5', 'Quick save'],
    ['Click', 'Lock cursor'],
    ['Drag items', 'Deal with NPCs / Load gacha'],
  ];

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '8px 24px',
    maxWidth: '400px',
  });

  for (const [key, desc] of controls) {
    const keyEl = document.createElement('div');
    Object.assign(keyEl.style, {
      textAlign: 'right', color: '#ff6b9d',
      fontSize: '14px', fontWeight: 'bold', padding: '4px 0',
    });
    keyEl.textContent = key;
    grid.appendChild(keyEl);

    const descEl = document.createElement('div');
    Object.assign(descEl.style, {
      color: '#aaa', fontSize: '14px', padding: '4px 0',
    });
    descEl.textContent = desc;
    grid.appendChild(descEl);
  }
  controlsOverlay.appendChild(grid);

  const backBtn = document.createElement('button');
  Object.assign(backBtn.style, {
    marginTop: '40px', padding: '10px 32px',
    borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px',
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#888',
    transition: 'background 0.2s',
  });
  backBtn.textContent = 'Back';
  backBtn.addEventListener('click', () => {
    controlsOverlay.remove();
    controlsOverlay = null;
  });
  backBtn.addEventListener('mouseenter', () => {
    backBtn.style.background = 'rgba(255,255,255,0.12)';
  });
  backBtn.addEventListener('mouseleave', () => {
    backBtn.style.background = 'rgba(255,255,255,0.06)';
  });
  controlsOverlay.appendChild(backBtn);

  document.body.appendChild(controlsOverlay);
}
