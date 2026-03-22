// HUD — bottom inventory bar, money counter, rank/JP display, search prompt, progress bar

import { getSlots, getMaxSlots, onInventoryChange, onMoneyChange, onMaxSlotsChange } from './inventory.js';
import { isOverGachaInput, handleGachaDrop, updateGachaDropHighlight, isGachaUIOpen } from './gacha.js';
import { getMaterialIconStyle, getMaterialGhostStyle } from './materials.js';
import { getJP, getRankName, getJPProgress, getNextRank, setOnJPChangeCallback } from './jp-system.js';

let moneyEl, moneyFlashTimeout;
let promptEl, progressBarOuter, progressBarInner;
let rankHudEl;
let invBar, slotEls = [];
let dragState = null; // { slotIndex, type, ghostEl }

// Callbacks for dealing system to hook into drag events
let onDropCallback = null;
export function onItemDrop(fn) { onDropCallback = fn; }

export function createHUD() {
  // Money display — top-left
  moneyEl = document.createElement('div');
  Object.assign(moneyEl.style, {
    position: 'fixed', top: '16px', left: '16px',
    background: 'rgba(0,0,0,0.5)', color: '#6f6',
    fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold',
    padding: '8px 14px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '100',
    transition: 'transform 0.15s ease, text-shadow 0.15s ease',
  });
  moneyEl.textContent = '$0';
  document.body.appendChild(moneyEl);

  onMoneyChange((money) => {
    moneyEl.textContent = `$${money}`;
  });

  // Rank / JP display — top-left, beside money
  rankHudEl = document.createElement('div');
  Object.assign(rankHudEl.style, {
    position: 'fixed', top: '16px', left: '130px',
    background: 'rgba(0,0,0,0.5)',
    fontFamily: 'monospace', fontSize: '12px',
    padding: '6px 12px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '100',
    minWidth: '160px',
  });
  document.body.appendChild(rankHudEl);

  function updateRankHUD() {
    const name = getRankName();
    const jp = getJP();
    const progress = getJPProgress();
    const next = getNextRank();
    const nextJP = next ? next.jp : jp;
    rankHudEl.innerHTML = `
      <div style="color:#6cf;font-weight:bold;font-size:11px;letter-spacing:0.5px">${name}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
        <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
          <div style="width:${Math.round(progress * 100)}%;height:100%;background:#6cf;border-radius:2px;transition:width 0.4s ease"></div>
        </div>
        <div style="font-size:10px;color:#556;white-space:nowrap">${jp}${next ? ' / ' + nextJP : ''} JP</div>
      </div>
    `;
  }

  setOnJPChangeCallback(updateRankHUD);
  updateRankHUD();

  // Bottom inventory bar
  invBar = document.createElement('div');
  invBar.id = 'inv-bar';
  Object.assign(invBar.style, {
    position: 'fixed', bottom: '16px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', gap: '6px',
    background: 'rgba(10,10,20,0.7)',
    padding: '8px 12px', borderRadius: '12px',
    zIndex: '210',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
  });

  const maxSlots = getMaxSlots();
  for (let i = 0; i < maxSlots; i++) {
    const slot = document.createElement('div');
    slot.dataset.slotIndex = i;
    Object.assign(slot.style, {
      width: '56px', height: '56px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      cursor: 'default',
      transition: 'border-color 0.15s, background 0.15s',
      userSelect: 'none',
    });
    invBar.appendChild(slot);
    slotEls.push(slot);
  }
  document.body.appendChild(invBar);

  // Listen for inventory changes
  onInventoryChange(() => renderSlots());
  renderSlots();

  // Listen for max-slots expansion (e.g., Dealer rank → 10 slots)
  onMaxSlotsChange((newMax) => {
    const current = slotEls.length;
    for (let i = current; i < newMax; i++) {
      const slot = document.createElement('div');
      slot.dataset.slotIndex = i;
      Object.assign(slot.style, {
        width: '56px', height: '56px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        cursor: 'default',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      });
      invBar.appendChild(slot);
      slotEls.push(slot);
    }
    renderSlots();
  });

  // Drag listeners on document (work even when pointer lock is off)
  document.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // Search prompt — bottom-center, above inventory bar
  promptEl = document.createElement('div');
  Object.assign(promptEl.style, {
    position: 'fixed', bottom: '100px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    fontFamily: 'monospace', fontSize: '16px',
    padding: '8px 18px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '100',
    opacity: '0',
    transition: 'opacity 0.2s ease',
  });
  document.body.appendChild(promptEl);

  // Progress bar
  progressBarOuter = document.createElement('div');
  Object.assign(progressBarOuter.style, {
    position: 'fixed', bottom: '130px', left: '50%',
    transform: 'translateX(-50%)', width: '200px', height: '12px',
    background: 'rgba(0,0,0,0.5)', borderRadius: '6px',
    overflow: 'hidden', pointerEvents: 'none', zIndex: '100',
    display: 'none',
  });
  progressBarInner = document.createElement('div');
  Object.assign(progressBarInner.style, {
    width: '0%', height: '100%',
    background: '#6cf', borderRadius: '6px',
    transition: 'none',
  });
  progressBarOuter.appendChild(progressBarInner);
  document.body.appendChild(progressBarOuter);

  // "Inventory full" toast
  createFullToast();
}

// --- Inventory full toast ---
let fullToast, fullToastTimeout;
function createFullToast() {
  fullToast = document.createElement('div');
  Object.assign(fullToast.style, {
    position: 'fixed', bottom: '90px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(200,60,60,0.85)', color: '#fff',
    fontFamily: 'monospace', fontSize: '14px',
    padding: '6px 16px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '160',
    display: 'none',
    transition: 'opacity 0.3s',
  });
  fullToast.textContent = 'Inventory full!';
  document.body.appendChild(fullToast);
}

export function showInventoryFull() {
  fullToast.style.display = 'block';
  fullToast.style.opacity = '1';
  clearTimeout(fullToastTimeout);
  fullToastTimeout = setTimeout(() => {
    fullToast.style.opacity = '0';
    setTimeout(() => { fullToast.style.display = 'none'; }, 300);
  }, 1500);
}

// --- Render inventory slots ---
function renderSlots() {
  const slots = getSlots();
  const maxSlots = getMaxSlots();

  for (let i = 0; i < maxSlots; i++) {
    const el = slotEls[i];
    el.innerHTML = '';

    if (i < slots.length) {
      const s = slots[i];
      el.style.cursor = 'grab';

      // Material slots get dotted border and tinted background
      if (s.type === 'material') {
        el.style.borderColor = 'rgba(180,180,180,0.4)';
        el.style.borderStyle = 'dotted';
        el.style.background = 'rgba(200,220,255,0.06)';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.2)';
        el.style.borderStyle = 'solid';
        el.style.background = 'rgba(255,255,255,0.04)';
      }

      // Item icon
      const icon = document.createElement('div');
      if (s.type === 'material') {
        Object.assign(icon.style, getMaterialIconStyle(s.subtype));
      } else if (s.type === 'sticker') {
        const isFresh = s.subtype === 'fresh';
        Object.assign(icon.style, {
          width: '28px', height: '28px',
          borderRadius: '4px',
          background: isFresh
            ? 'linear-gradient(135deg, #ff90f0, #d080ff)'
            : 'linear-gradient(135deg, #a86cb8, #7040a0)',
          boxShadow: isFresh
            ? '0 0 12px rgba(255,140,255,0.5)'
            : '0 0 6px rgba(140,80,200,0.25)',
        });
        // Quality badge
        const badge = document.createElement('span');
        Object.assign(badge.style, {
          position: 'absolute', top: '1px', left: '3px',
          fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold',
          color: isFresh ? '#f0c0ff' : '#9090aa',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          lineHeight: '1', pointerEvents: 'none',
        });
        badge.textContent = isFresh ? '★' : '○';
        el.appendChild(badge);
      } else if (s.type === 'plushie') {
        const isHandmade = s.subtype === 'handmade';
        Object.assign(icon.style, {
          width: '28px', height: '28px',
          borderRadius: '50%',
          background: isHandmade
            ? 'linear-gradient(135deg, #7bc8e8, #6b9fff)'
            : 'linear-gradient(135deg, #5a8898, #4a6878)',
          boxShadow: isHandmade
            ? '0 0 10px rgba(100,180,255,0.4)'
            : '0 0 6px rgba(80,130,170,0.2)',
        });
        // Quality badge
        const badge = document.createElement('span');
        Object.assign(badge.style, {
          position: 'absolute', top: '1px', left: '3px',
          fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold',
          color: isHandmade ? '#a0d8ff' : '#8090a0',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          lineHeight: '1', pointerEvents: 'none',
        });
        badge.textContent = isHandmade ? '★' : '○';
        el.appendChild(badge);
      } else if (s.type === 'gacha') {
        Object.assign(icon.style, {
          width: '28px', height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ffb4d8, #b8a0ff, #7bc8e8, #fac775)',
          boxShadow: '0 0 10px rgba(255,180,220,0.4)',
        });
      } else {
        Object.assign(icon.style, {
          width: '28px', height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7bc8e8, #6b9fff)',
          boxShadow: '0 0 8px rgba(100,180,255,0.3)',
        });
      }
      el.appendChild(icon);

      // Stack count
      if (s.count > 1) {
        const count = document.createElement('span');
        Object.assign(count.style, {
          position: 'absolute', bottom: '2px', right: '4px',
          fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold',
          color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
        });
        count.textContent = s.count;
        el.appendChild(count);
      }
    } else {
      el.style.borderColor = 'rgba(255,255,255,0.06)';
      el.style.borderStyle = 'solid';
      el.style.background = 'rgba(255,255,255,0.04)';
      el.style.cursor = 'default';
    }
  }
}

// --- Drag and drop ---
function onDragStart(e) {
  if (e.button !== 0) return;
  const slotEl = e.target.closest('[data-slot-index]');
  if (!slotEl) return;

  const idx = parseInt(slotEl.dataset.slotIndex);
  const slots = getSlots();
  if (idx >= slots.length) return;

  const slot = slots[idx];
  e.preventDefault();

  // Create ghost element
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'fixed',
    width: '40px', height: '40px',
    pointerEvents: 'none',
    zIndex: '500',
    opacity: '0.9',
    transition: 'none',
  });

  if (slot.type === 'material') {
    Object.assign(ghost.style, getMaterialGhostStyle(slot.subtype));
  } else if (slot.type === 'sticker') {
    const isFresh = slot.subtype === 'fresh';
    Object.assign(ghost.style, {
      borderRadius: '4px',
      background: isFresh
        ? 'linear-gradient(135deg, #ff90f0, #d080ff)'
        : 'linear-gradient(135deg, #a86cb8, #7040a0)',
      boxShadow: isFresh
        ? '0 0 16px rgba(255,140,255,0.6)'
        : '0 0 12px rgba(140,80,200,0.4)',
    });
  } else if (slot.type === 'plushie') {
    const isHandmade = slot.subtype === 'handmade';
    Object.assign(ghost.style, {
      borderRadius: '50%',
      background: isHandmade
        ? 'linear-gradient(135deg, #7bc8e8, #6b9fff)'
        : 'linear-gradient(135deg, #5a8898, #4a6878)',
      boxShadow: isHandmade
        ? '0 0 16px rgba(100,180,255,0.5)'
        : '0 0 10px rgba(80,130,170,0.3)',
    });
  } else if (slot.type === 'gacha') {
    Object.assign(ghost.style, {
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffb4d8, #b8a0ff, #7bc8e8, #fac775)',
      boxShadow: '0 0 16px rgba(255,180,220,0.5)',
    });
  } else {
    Object.assign(ghost.style, {
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #7bc8e8, #6b9fff)',
      boxShadow: '0 0 16px rgba(100,180,255,0.5)',
    });
  }

  ghost.style.left = (e.clientX - 20) + 'px';
  ghost.style.top = (e.clientY - 20) + 'px';
  document.body.appendChild(ghost);

  dragState = { slotIndex: idx, type: slot.type, subtype: slot.subtype, ghostEl: ghost };

  // Dim the source slot
  slotEls[idx].style.opacity = '0.4';
}

function onDragMove(e) {
  if (!dragState) return;
  dragState.ghostEl.style.left = (e.clientX - 20) + 'px';
  dragState.ghostEl.style.top = (e.clientY - 20) + 'px';

  // Check if hovering over deal drop zone
  const dropZone = document.getElementById('deal-drop-zone');
  if (dropZone) {
    const rect = dropZone.getBoundingClientRect();
    const over = e.clientX >= rect.left && e.clientX <= rect.right &&
                 e.clientY >= rect.top && e.clientY <= rect.bottom;
    dropZone.style.borderColor = over ? 'rgba(100,255,150,0.7)' : 'rgba(255,255,255,0.2)';
    dropZone.style.background = over ? 'rgba(100,255,150,0.08)' : 'rgba(255,255,255,0.03)';
  }

  // Check if hovering over gacha input zone
  if (isGachaUIOpen()) {
    updateGachaDropHighlight(e.clientX, e.clientY);
  }
}

function onDragEnd(e) {
  if (!dragState) return;

  // Restore source slot opacity
  const idx = dragState.slotIndex;
  if (idx < slotEls.length) slotEls[idx].style.opacity = '1';

  let handled = false;

  // Check if dropped on gacha input zone
  if (isGachaUIOpen() && isOverGachaInput(e.clientX, e.clientY)) {
    handled = handleGachaDrop(dragState.slotIndex, dragState.type);
  }

  // Check if dropped on deal zone
  if (!handled) {
    const dropZone = document.getElementById('deal-drop-zone');
    if (dropZone) {
      const rect = dropZone.getBoundingClientRect();
      const over = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (over && onDropCallback) {
        handled = onDropCallback(dragState.slotIndex, dragState.type, dragState.subtype);
      }
      // Reset drop zone style
      dropZone.style.borderColor = 'rgba(255,255,255,0.2)';
      dropZone.style.background = 'rgba(255,255,255,0.03)';
    }
  }

  // Remove ghost
  dragState.ghostEl.remove();
  dragState = null;
}

export function isDragging() {
  return dragState !== null;
}

// --- Money flash ---
export function flashMoney(amount) {
  moneyEl.style.transform = 'scale(1.3)';
  moneyEl.style.textShadow = '0 0 12px #6f6';

  clearTimeout(moneyFlashTimeout);
  moneyFlashTimeout = setTimeout(() => {
    moneyEl.style.transform = 'scale(1)';
    moneyEl.style.textShadow = 'none';
  }, 350);
}

// --- Floating +$X text ---
export function showFloatingMoney(amount) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    top: '45%', left: '50%',
    transform: 'translate(-50%, 0)',
    color: '#6f6', fontSize: '28px', fontWeight: 'bold',
    fontFamily: 'monospace',
    pointerEvents: 'none', zIndex: '300',
    textShadow: '0 0 12px rgba(100,255,100,0.5)',
    transition: 'top 0.8s ease-out, opacity 0.8s ease-out',
    opacity: '1',
  });
  el.textContent = `+$${amount}`;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.top = '35%';
    el.style.opacity = '0';
  });

  setTimeout(() => el.remove(), 900);
}

// --- Prompt and progress bar ---
export function showPrompt(text) {
  promptEl.textContent = text;
  promptEl.style.display = 'block';
  requestAnimationFrame(() => { promptEl.style.opacity = '1'; });
}

export function hidePrompt() {
  promptEl.style.opacity = '0';
  // Keep display block so transition works, hide after transition
}

export function showProgress(fraction) {
  progressBarOuter.style.display = 'block';
  progressBarInner.style.width = `${Math.min(fraction * 100, 100)}%`;
}

export function hideProgress() {
  progressBarOuter.style.display = 'none';
  progressBarInner.style.width = '0%';
}
