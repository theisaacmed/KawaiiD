// Notification system — toast popups, persistent badge, sounds, quick actions, history
//
// Toast notifications slide in from bottom-right when messages arrive.
// Quick-action buttons on deal request toasts let the player accept/decline without opening the phone.
// Notification history accessible from the phone's bell icon.
// Notifications are suppressed during title screen, sleep, ACE chase, and rank-up overlays.

import { playNotificationChime, playACEWarningBuzz } from './audio.js';

// --- NPC Signature Colors ---
const NPC_COLORS = {
  Mei:     '#ED93B1',
  Hiro:    '#378ADD',
  Luna:    '#5DCAA5',
  Ash:     '#AFA9EC',
  Dex:     '#888780',
  Ren:     '#D85A30',
  Nao:     '#FAC775',
  Felix:   '#97C459',
  Harper:  '#B4B2A9',
  Marco:   '#EF9F27',
  Kit:     '#85B7EB',
  Quinn:   '#C97B9F',
  Suki:    '#D4A76A',
  Dove:    '#E0D8C8',
  Juno:    '#9BCFCF',
  Blaze:   '#E86745',
  Ivy:     '#7EBF6E',
  Lux:     '#F0D264',
  Wren:    '#A68BBF',
  Sage:    '#8DAF80',
  Pixel:   '#5EC4E8',
  Rue:     '#CF6B6B',
  Cleo:    '#C9A0DC',
  Milo:    '#8DA4BF',
  Faye:    '#E8A0B8',
  Zen:     '#7A9E8F',
  Rook:    '#8888A0',
  Nova:    '#D4827A',
};

// --- State ---
const MAX_VISIBLE_TOASTS = 3;
const TOAST_DURATION = 4000;      // ms visible
const TOAST_ANIM_IN = 300;        // ms slide-in
const TOAST_ANIM_OUT = 300;       // ms slide-out

let toastContainer = null;
let activeToasts = [];             // { el, timeout, msg }
let notificationHistory = [];      // last 20 notifications
const MAX_HISTORY = 20;

// Queued notifications (shown after blocking events end)
let notifQueue = [];

// Blocking state checkers — set by main.js
let isBlockedFn = () => false;

// Callbacks for quick actions — set by phone.js
let quickAcceptFn = null;
let quickDeclineFn = null;
let openPhoneToMsgFn = null;

// Badge
let badgeEl = null;
let phoneIconEl = null;
let badgeShakeTimeout = null;

// Unread tracking
let unreadCountFn = () => 0;

// --- Init ---
export function initNotifications() {
  createToastContainer();
  createPersistentBadge();
  injectStyles();
}

export function setNotifBlockedCheck(fn) { isBlockedFn = fn; }
export function setQuickAcceptFn(fn) { quickAcceptFn = fn; }
export function setQuickDeclineFn(fn) { quickDeclineFn = fn; }
export function setOpenPhoneToMsgFn(fn) { openPhoneToMsgFn = fn; }
export function setUnreadCountFn(fn) { unreadCountFn = fn; }

// --- CSS Keyframes ---
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes notif-badge-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    @keyframes notif-badge-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-2px); }
      40% { transform: translateX(2px); }
      60% { transform: translateX(-2px); }
      80% { transform: translateX(2px); }
    }
  `;
  document.head.appendChild(style);
}

// --- Toast Container ---
function createToastContainer() {
  toastContainer = document.createElement('div');
  Object.assign(toastContainer.style, {
    position: 'fixed',
    bottom: '90px',
    right: '16px',
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: '8px',
    zIndex: '250',
    pointerEvents: 'none',
  });
  document.body.appendChild(toastContainer);
}

// --- Persistent Badge ---
function createPersistentBadge() {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    bottom: '90px',
    right: '16px',
    display: 'none',
    alignItems: 'center',
    gap: '6px',
    zIndex: '250',
    pointerEvents: 'none',
  });

  // Phone icon
  phoneIconEl = document.createElement('div');
  Object.assign(phoneIconEl.style, {
    width: '18px',
    height: '26px',
    borderRadius: '4px',
    border: '2px solid rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.05)',
    position: 'relative',
  });
  // Screen line
  const screenLine = document.createElement('div');
  Object.assign(screenLine.style, {
    position: 'absolute', bottom: '3px', left: '50%',
    transform: 'translateX(-50%)',
    width: '8px', height: '1px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '1px',
  });
  phoneIconEl.appendChild(screenLine);

  // Badge circle
  badgeEl = document.createElement('div');
  Object.assign(badgeEl.style, {
    minWidth: '20px', height: '20px',
    borderRadius: '10px',
    background: '#E24B4A',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    animation: 'notif-badge-pulse 1.5s infinite',
    boxShadow: '0 2px 8px rgba(226,75,74,0.5)',
  });

  wrap.appendChild(phoneIconEl);
  wrap.appendChild(badgeEl);
  document.body.appendChild(wrap);

  // Store reference to wrapper
  badgeEl._wrapper = wrap;
}

// --- Update badge visibility (call when unread count changes) ---
export function updateNotifBadge() {
  const count = unreadCountFn();
  const wrap = badgeEl._wrapper;
  if (count > 0) {
    wrap.style.display = 'flex';
    badgeEl.textContent = count;
  } else {
    wrap.style.display = 'none';
  }
}

function shakeBadge() {
  clearTimeout(badgeShakeTimeout);
  badgeEl.style.animation = 'notif-badge-shake 0.3s ease';
  badgeShakeTimeout = setTimeout(() => {
    badgeEl.style.animation = 'notif-badge-pulse 1.5s infinite';
  }, 300);
}

// --- Product icon helper ---
function getProductIcon(itemType) {
  if (itemType === 'sticker') return '\u2B50';   // star
  if (itemType === 'plushie') return '\uD83E\uDDF8'; // teddy bear
  if (itemType === 'gacha') return '\uD83C\uDFB0';   // slot machine / capsule
  return '';
}

// --- Notification Types ---
// type: 'deal_request' | 'general' | 'ace_warning' | 'dealer_report'
function getNotifType(msg) {
  // ACE warning NPCs
  if (msg.npcName === 'Harper' || msg.npcName === 'Quinn') {
    if (msg.text && (msg.text.toLowerCase().includes('ace') || msg.text.toLowerCase().includes('patrol') || msg.text.toLowerCase().includes('officer'))) {
      return 'ace_warning';
    }
  }
  // Deal request: has itemType and not expired/system
  if (msg.itemType && msg.itemType !== '' && !msg.expired) {
    return 'deal_request';
  }
  return 'general';
}

// --- Create & Show Toast ---
export function showNotification(msg) {
  // Accept plain strings: "[Name] text" or just "text"
  if (typeof msg === 'string') {
    const match = msg.match(/^\[([^\]]+)\]\s*(.*)$/);
    msg = match
      ? { npcName: match[1], text: match[2] }
      : { npcName: '', text: msg };
  }
  // Check if blocked (chase, sleep, title, rank-up)
  if (isBlockedFn()) {
    notifQueue.push(msg);
    return;
  }

  const type = getNotifType(msg);

  // Play sound
  if (type === 'ace_warning') {
    playACEWarningBuzz();
  } else {
    playNotificationChime();
  }

  // Add to history
  addToHistory(msg, type);

  // Determine border color
  let borderColor = NPC_COLORS[msg.npcName] || '#666';
  if (type === 'ace_warning') borderColor = '#E24B4A';
  if (type === 'dealer_report') borderColor = '#4a7';

  // Build toast content
  const toast = document.createElement('div');
  toast.style.pointerEvents = 'auto';
  Object.assign(toast.style, {
    width: '280px',
    minHeight: '50px',
    background: 'rgba(26,26,26,0.88)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: '10px',
    borderLeft: `3px solid ${borderColor}`,
    padding: '10px 12px',
    fontFamily: 'monospace',
    color: '#fff',
    cursor: 'pointer',
    transform: 'translateY(80px)',
    opacity: '0',
    transition: `transform ${TOAST_ANIM_IN}ms ease-out, opacity ${TOAST_ANIM_IN}ms ease-out`,
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });

  // Top row: name + icon
  const topRow = document.createElement('div');
  Object.assign(topRow.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  });

  const nameEl = document.createElement('span');
  Object.assign(nameEl.style, {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#eee',
  });
  nameEl.textContent = type === 'ace_warning' ? `\u26A0 ${msg.npcName}` : msg.npcName;

  const iconEl = document.createElement('span');
  iconEl.style.fontSize = '16px';
  if (type === 'deal_request') {
    iconEl.textContent = getProductIcon(msg.itemType);
  }

  topRow.appendChild(nameEl);
  topRow.appendChild(iconEl);
  toast.appendChild(topRow);

  // Preview text
  const previewEl = document.createElement('div');
  Object.assign(previewEl.style, {
    fontSize: '12px',
    color: '#aaa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '250px',
  });

  if (type === 'deal_request') {
    const itemName = msg.itemType === 'sticker' ? 'stickers' :
                     msg.itemType === 'gacha' ? 'capsules' : 'plushies';
    previewEl.textContent = `Looking for ${itemName}`;
  } else {
    const text = msg.text || '';
    previewEl.textContent = text.length > 40 ? text.substring(0, 40) + '...' : text;
  }
  toast.appendChild(previewEl);

  // Quick action buttons for deal requests
  if (type === 'deal_request') {
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '6px',
      marginTop: '6px',
    });

    const acceptBtn = document.createElement('button');
    Object.assign(acceptBtn.style, {
      flex: '1',
      padding: '4px 0',
      borderRadius: '5px',
      border: '1px solid #4a7',
      background: 'rgba(68,170,119,0.2)',
      color: '#4a7',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
    });
    acceptBtn.textContent = 'On my way';
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (quickAcceptFn) {
        const result = quickAcceptFn(msg.id);
        if (result) {
          showConfirmation(`Deal accepted \u2014 meet ${msg.npcName} at ${msg.meetupName}`);
        }
      }
      dismissToast(toast);
    });

    const declineBtn = document.createElement('button');
    Object.assign(declineBtn.style, {
      flex: '1',
      padding: '4px 0',
      borderRadius: '5px',
      border: '1px solid #555',
      background: 'rgba(100,100,100,0.15)',
      color: '#777',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
    });
    declineBtn.textContent = "Can't right now";
    declineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (quickDeclineFn) quickDeclineFn(msg.id);
      dismissToast(toast);
    });

    btnRow.appendChild(acceptBtn);
    btnRow.appendChild(declineBtn);
    toast.appendChild(btnRow);
  }

  // Click toast to open phone to message
  toast.addEventListener('click', () => {
    if (openPhoneToMsgFn) openPhoneToMsgFn(msg.id);
    dismissToast(toast);
  });

  // Add to container
  toastContainer.appendChild(toast);

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  // Track active toast
  const toastObj = {
    el: toast,
    timeout: setTimeout(() => dismissToast(toast), TOAST_DURATION),
    msg,
  };
  activeToasts.push(toastObj);

  // Shake the badge for deal requests
  if (type === 'deal_request') {
    shakeBadge();
  }

  // Enforce max visible toasts — dismiss oldest
  while (activeToasts.length > MAX_VISIBLE_TOASTS) {
    const oldest = activeToasts.shift();
    clearTimeout(oldest.timeout);
    removeToastEl(oldest.el);
  }

  // Update badge
  updateNotifBadge();
}

// --- Dismiss toast with animation ---
function dismissToast(el) {
  // Find and remove from active list
  const idx = activeToasts.findIndex(t => t.el === el);
  if (idx !== -1) {
    clearTimeout(activeToasts[idx].timeout);
    activeToasts.splice(idx, 1);
  }
  removeToastEl(el);
}

function removeToastEl(el) {
  el.style.transform = 'translateY(80px)';
  el.style.opacity = '0';
  el.style.transition = `transform ${TOAST_ANIM_OUT}ms ease-in, opacity ${TOAST_ANIM_OUT}ms ease-in`;
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, TOAST_ANIM_OUT);
}

// --- Confirmation flash ---
function showConfirmation(text) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '60px',
    right: '16px',
    background: 'rgba(68,170,119,0.85)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '8px 14px',
    borderRadius: '6px',
    zIndex: '260',
    pointerEvents: 'none',
    opacity: '1',
    transition: 'opacity 0.3s',
  });
  el.textContent = text;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

// --- Notification History ---
function addToHistory(msg, type) {
  notificationHistory.unshift({
    timestamp: Date.now(),
    npcName: msg.npcName,
    type,
    preview: type === 'deal_request'
      ? `Looking for ${msg.itemType === 'sticker' ? 'stickers' : msg.itemType === 'gacha' ? 'capsules' : 'plushies'}`
      : (msg.text || '').substring(0, 50),
    read: false,
    msgId: msg.id,
  });

  // Trim to max
  if (notificationHistory.length > MAX_HISTORY) {
    notificationHistory.length = MAX_HISTORY;
  }
}

export function getNotificationHistory() {
  return notificationHistory;
}

export function markHistoryRead() {
  for (const h of notificationHistory) h.read = true;
}

// --- Queue flush (call when blocking event ends) ---
export function flushNotifQueue() {
  while (notifQueue.length > 0 && !isBlockedFn()) {
    const msg = notifQueue.shift();
    showNotification(msg);
  }
}

// --- Save/Load ---
export function getNotifState() {
  return {
    history: notificationHistory.slice(0, MAX_HISTORY),
  };
}

export function restoreNotifState(data) {
  if (!data) return;
  if (data.history) {
    notificationHistory = data.history;
  }
}

// --- NPC color lookup (for phone UI) ---
export function getNPCColor(name) {
  return NPC_COLORS[name] || '#666';
}
