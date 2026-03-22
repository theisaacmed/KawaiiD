// Phone system — NPC deal requests via text messages, contacts, stats, waypoints
//
// Architecture:
//   - Phone is an HTML overlay toggled with Tab
//   - NPCs send messages on a random timer (45-90s), requesting items at meetup locations
//   - Accepting a message creates a 3D waypoint sprite; player has 3 min to reach it
//   - Walking to the waypoint + pressing E opens the existing deal panel
//   - Stats tab tracks lifetime deals, money, items sold, rank
//   - Contacts tab shows NPC relationship data
//   - Phone state is persisted via save-system.js (getPhoneState / restorePhoneState)

import * as THREE from 'three';
import { getSlots, getMoney } from './inventory.js';
import { getWorldColor } from './color-system.js';
import { isNPCActive, getDayNumber, getGameHour } from './time-system.js';
import { isDistrictUnlocked, DISTRICTS as PHONE_DISTRICTS } from './districts.js';
import { getRelationship, getNPCAffinity, getAffinityIcon, getNPCMood, getDexDailyMessage } from './npc.js';
import { playPhoneBuzz } from './audio.js';
import { renderMap } from './map-renderer.js';
import { showNotification, updateNotifBadge as updateNotifBadgeNew, getNPCColor, getNotificationHistory, markHistoryRead } from './notifications.js';
import { getJP, getRankName, getJPProgress, getNextRank, RANKS } from './jp-system.js';
import { isAshHired, isAshHireUnlocked, hireAsh, fireAsh, isRuinsKidHired, isRuinsKidHireUnlocked, hireRuinsKid, fireRuinsKid, isAnyScavengerHired } from './scavenger-system.js';
import { addActiveDeal, completeDeal as completeActiveDeal, expireDeal as expireActiveDeal, updateDeals, getActiveDealsState, restoreActiveDealsState } from './active-deals-hud.js';

// Deal panel functions — set by main.js to avoid circular dependencies
let isDealOpenFn = () => false;
export function setDealFunctions(isDealOpen) { isDealOpenFn = isDealOpen; }

// Gacha unlock callback — set by main.js
export function setGachaUnlockCallback(fn) { gachaUnlockCallback = fn; }

// --- State ---
let phoneContainer = null;
let isPhoneOpen = false;
let activeTab = 'messages';
let sceneRef = null;
let npcsRef = [];
let playerRef = null;

// Messages
let messages = []; // { id, npcName, itemType, qty, meetupPos, meetupName, text, timestamp, read, accepted, declined, expired }
let nextMsgId = 1;

// Active waypoints (one per NPC max)
const activeWaypoints = []; // { npcName, sprite, pos, timeLeft, messageId }

// Cooldowns — track when each NPC last completed a deal (timestamp)
const npcCooldowns = {}; // { [name]: timestamp }

// Stats
const stats = {
  totalDeals: 0,
  totalEarned: 0,
  stickersSold: 0,
  plushiesSold: 0,
  gachaSold: 0,
  dayNumber: 1,
};

// Gacha unlock tracking
let gachaUnlockSent = false;
let gachaUnlockCallback = null; // set by main.js

// Eastside unlock tracking
let eastsideUnlockSent = false;
let eastsideUnlockCallback = null;
export function setEastsideUnlockCallback(fn) { eastsideUnlockCallback = fn; }

// Message generation timer
let msgTimer = 0;
let msgInterval = randomBetween(45, 90);

// Dex daily message tracking
let dexMsgDay = -1;

function sendDexDailyMsg() {
  const day = getDayNumber();
  if (dexMsgDay === day) return; // already sent today
  // Check if Dex is unlocked and available
  const dex = npcsRef.find(n => n.name === 'Dex');
  if (!dex || !dex.isAvailable) return;
  dexMsgDay = day;
  const hint = getDexDailyMessage(day);
  messages.unshift({
    id: nextMsgId++,
    npcName: 'Dex',
    itemType: '',
    qty: 0,
    meetupPos: [0, 0, 0],
    meetupName: '',
    text: hint,
    timestamp: Date.now(),
    read: false,
    accepted: false,
    declined: false,
    expired: true, // info message, not actionable
  });
  updateNotifBadge();
  playBuzz();
}

// Notification
let notifBadge = null;

// Deal completed hook — set by initPhone, called by dealing.js
let dealCompletedCallback = null;

// --- Helpers ---
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Audio ---
function playBuzz() {
  playPhoneBuzz();
}

// --- Notification Badge ---
function createNotifBadge() {
  notifBadge = document.createElement('div');
  Object.assign(notifBadge.style, {
    position: 'fixed', top: '16px', right: '16px',
    minWidth: '24px', height: '24px',
    borderRadius: '12px',
    background: '#e55',
    color: '#fff',
    fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold',
    display: 'none',
    alignItems: 'center', justifyContent: 'center',
    padding: '0 6px',
    zIndex: '300',
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(200,50,50,0.5)',
    animation: 'phone-badge-pulse 2s infinite',
  });
  document.body.appendChild(notifBadge);

  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes phone-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
  `;
  document.head.appendChild(style);
}

function updateNotifBadge() {
  const count = messages.filter(m => !m.read && !m.declined && !m.expired).length;
  if (count > 0 && !isPhoneOpen) {
    notifBadge.style.display = 'flex';
    notifBadge.textContent = count;
  } else {
    notifBadge.style.display = 'none';
  }
  // Also update the persistent notification badge from notifications.js
  updateNotifBadgeNew();
}

// --- Waypoint Sprite ---
function createWaypointSprite(pos) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Diamond shape
  ctx.fillStyle = '#ff6b9d';
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(56, 32);
  ctx.lineTo(32, 60);
  ctx.lineTo(8, 32);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner glow
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.lineTo(44, 32);
  ctx.lineTo(32, 48);
  ctx.lineTo(20, 32);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 1.2, 1);
  sprite.position.set(pos[0], 3.5, pos[2]);
  return sprite;
}

// --- Message Generation ---
function generateMessage() {
  // Pick an eligible NPC
  const eligible = npcsRef.filter(npc => {
    // NPCs in locked districts or referral-locked can't message
    if (npc.district !== 'town' && npc.district !== 'ruins' && !isDistrictUnlocked(npc.district)) return false;
    if (!npc.isAvailable) return false;
    // NPCs with no wants (Dove) don't send buy messages
    if (!npc.wants || npc.wants.length === 0) return false;
    if (npc.purchaseCount >= npc.maxPurchases) return false;
    // On cooldown?
    const cd = npcCooldowns[npc.name];
    if (cd && (Date.now() - cd) < randomBetween(120000, 180000)) return false;
    // Already has an active waypoint?
    if (activeWaypoints.find(w => w.npcName === npc.name)) return false;
    // Already has a pending (unread/accepted) message?
    if (messages.find(m => m.npcName === npc.name && !m.declined && !m.expired && !m.accepted)) return false;
    return true;
  });

  if (eligible.length === 0) return;

  const npc = randomFrom(eligible);

  // Weight item type toward high-affinity products
  const itemTypes = ['sticker', 'plushie', 'gacha'];
  const weights = itemTypes.map(type => {
    const aff = getNPCAffinity(npc.name, type);
    if (aff <= -1) return 0.05; // very unlikely to ask for disliked items
    if (aff === 0) return 0.15;
    if (aff === 1) return 0.30;
    return 0.60; // affinity 2
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let itemType = 'sticker';
  for (let i = 0; i < itemTypes.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { itemType = itemTypes[i]; break; }
  }

  const qty = Math.floor(Math.random() * 2) + 1; // 1-2
  const meetup = randomFrom(npc.meetupLocations);

  // Build message text from template
  let text = randomFrom(npc.messageTemplates);
  const itemName = itemType === 'sticker' ? 'stickers' : itemType === 'gacha' ? 'capsules' : 'plushies';
  text = text.replace('{item}', itemName);
  text = text.replace('{qty}', qty.toString());
  text = text.replace('{location}', meetup.name);

  const msg = {
    id: nextMsgId++,
    npcName: npc.name,
    itemType,
    qty,
    meetupPos: meetup.pos,
    meetupName: meetup.name,
    text,
    timestamp: Date.now(),
    read: false,
    accepted: false,
    declined: false,
    expired: false,
  };

  messages.unshift(msg); // newest first
  playBuzz();
  updateNotifBadge();
  showNotification(msg);

  if (isPhoneOpen && activeTab === 'messages') {
    renderMessagesTab();
  }
}

// --- Accept / Decline (exported for notification quick actions) ---
export function acceptMessage(msgId) {
  const msg = messages.find(m => m.id === msgId);
  if (!msg || msg.accepted || msg.declined || msg.expired) return;

  msg.accepted = true;
  msg.read = true;

  // Create waypoint
  const sprite = createWaypointSprite(msg.meetupPos);
  sceneRef.add(sprite);

  activeWaypoints.push({
    npcName: msg.npcName,
    sprite,
    pos: msg.meetupPos,
    timeLeft: Math.max(60, (18 - getGameHour()) * 60), // real seconds until 6 PM game time (1 game hour = 60 real seconds)
    messageId: msg.id,
  });

  addActiveDeal(msg);

  updateNotifBadge();
  if (isPhoneOpen && activeTab === 'messages') renderMessagesTab();
}

export function declineMessage(msgId) {
  const msg = messages.find(m => m.id === msgId);
  if (!msg || msg.accepted || msg.declined || msg.expired) return;

  msg.declined = true;
  msg.read = true;

  updateNotifBadge();
  if (isPhoneOpen && activeTab === 'messages') renderMessagesTab();
}

// --- Waypoint check (called from interaction.js) ---
export function getActiveWaypointNearPlayer(playerPos) {
  for (const wp of activeWaypoints) {
    const dx = wp.pos[0] - playerPos.x;
    const dz = wp.pos[2] - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3) return wp;
  }
  return null;
}

export function completeWaypoint(npcName) {
  const idx = activeWaypoints.findIndex(w => w.npcName === npcName);
  if (idx === -1) return;
  const wp = activeWaypoints[idx];
  sceneRef.remove(wp.sprite);
  wp.sprite.material.dispose();
  wp.sprite.material.map.dispose();
  activeWaypoints.splice(idx, 1);
}

// --- Deal completed hook (called from dealing.js) ---
export function onPhoneDealCompleted(npcName, itemType, price) {
  stats.totalDeals++;
  stats.totalEarned += price;
  if (itemType === 'sticker') stats.stickersSold++;
  else if (itemType === 'plushie') stats.plushiesSold++;
  else if (itemType === 'gacha') stats.gachaSold++;

  npcCooldowns[npcName] = Date.now();

  // Update the message to show it's done
  const msg = messages.find(m => m.npcName === npcName && m.accepted && !m.expired);
  if (msg) msg.expired = true; // Mark as completed

  completeActiveDeal(npcName);

  // Check gacha unlock at 25 deals
  if (stats.totalDeals >= 25 && !gachaUnlockSent) {
    gachaUnlockSent = true;
    // Send mystery message after a short delay
    setTimeout(() => {
      messages.unshift({
        id: nextMsgId++,
        npcName: '???',
        itemType: '',
        qty: 0,
        meetupPos: [0, 0, 0],
        meetupName: '',
        text: 'I heard you\'re the one bringing color back. I left something for you at your apartment. \u2014 K',
        timestamp: Date.now(),
        read: false,
        accepted: false,
        declined: false,
        expired: true, // not actionable
      });
      playBuzz();
      updateNotifBadge();
      showNotification(messages[0]);
      if (isPhoneOpen && activeTab === 'messages') renderMessagesTab();
      // Trigger gacha unlock
      if (gachaUnlockCallback) gachaUnlockCallback();
    }, 2000);
  }

  // District unlock notifications are now handled by the district system
  // The old eastside unlock at 25 deals is replaced by district progression

  // Generate gacha-eager messages from NPCs with gacha addiction
  const npc = npcsRef.find(n => n.name === npcName);
  if (npc && itemType === 'gacha' && npc.gachaPreference !== 'refuses') {
    scheduleGachaEagerMessage(npc);
  }

  if (isPhoneOpen) renderActiveTab();
}

// --- Gacha addiction messages ---
function scheduleGachaEagerMessage(npc) {
  const purchases = npc.gachaPurchases || 0;
  let text;
  if (purchases >= 5) {
    text = "I'll pay extra for capsules. Name your price.";
  } else if (purchases >= 3) {
    text = "PLEASE tell me you have more capsules. I need another one.";
  } else {
    text = "Hey, got any of those mystery capsules?";
  }

  // Send the eager message after a shorter cooldown (30-60s)
  setTimeout(() => {
    messages.unshift({
      id: nextMsgId++,
      npcName: npc.name,
      itemType: 'gacha',
      qty: 1,
      meetupPos: npc.meetupLocations ? npc.meetupLocations[0].pos : [0, 0, 0],
      meetupName: npc.meetupLocations ? npc.meetupLocations[0].name : 'the usual spot',
      text: `${text} Meet me at ${npc.meetupLocations ? npc.meetupLocations[0].name : 'the usual spot'}.`,
      timestamp: Date.now(),
      read: false,
      accepted: false,
      declined: false,
      expired: false,
    });
    playBuzz();
    updateNotifBadge();
    showNotification(messages[0]);
    if (isPhoneOpen && activeTab === 'messages') renderMessagesTab();
  }, randomBetween(30000, 60000));
}

// --- Phone UI ---
function createPhoneUI() {
  // Outer shell — the phone body/bezel
  phoneContainer = document.createElement('div');
  phoneContainer.id = 'phone-container';
  Object.assign(phoneContainer.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '340px', height: '680px',
    background: '#1a1a1a',
    borderRadius: '40px',
    display: 'none',
    flexDirection: 'column',
    fontFamily: 'monospace',
    color: '#fff',
    zIndex: '500',
    overflow: 'hidden',
    boxShadow: '0 20px 80px rgba(0,0,0,0.9), 0 0 0 2px #333, 0 0 0 4px #111, inset 0 0 0 1px rgba(255,255,255,0.04)',
    padding: '12px 8px',
  });

  // Side buttons (volume + power) — purely decorative
  const volUp = document.createElement('div');
  Object.assign(volUp.style, {
    position: 'absolute', left: '-3px', top: '140px',
    width: '3px', height: '30px', background: '#333',
    borderRadius: '2px 0 0 2px',
  });
  phoneContainer.appendChild(volUp);

  const volDown = document.createElement('div');
  Object.assign(volDown.style, {
    position: 'absolute', left: '-3px', top: '180px',
    width: '3px', height: '30px', background: '#333',
    borderRadius: '2px 0 0 2px',
  });
  phoneContainer.appendChild(volDown);

  const power = document.createElement('div');
  Object.assign(power.style, {
    position: 'absolute', right: '-3px', top: '160px',
    width: '3px', height: '40px', background: '#333',
    borderRadius: '0 2px 2px 0',
  });
  phoneContainer.appendChild(power);

  // Inner screen
  const screen = document.createElement('div');
  screen.id = 'phone-screen';
  Object.assign(screen.style, {
    flex: '1',
    background: 'rgba(6,6,14,0.98)',
    borderRadius: '28px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.04)',
  });

  // Status bar (top of screen — like a real phone)
  const statusBar = document.createElement('div');
  Object.assign(statusBar.style, {
    padding: '8px 20px 4px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '11px', color: '#666',
    flexShrink: '0',
  });
  statusBar.innerHTML = `
    <span id="phone-time" style="font-weight:bold;color:#999"></span>
    <div style="display:flex;align-items:center;gap:4px">
      <span style="font-size:9px">4G</span>
      <div style="display:flex;gap:1px;align-items:end">
        <div style="width:3px;height:4px;background:#666;border-radius:0.5px"></div>
        <div style="width:3px;height:6px;background:#666;border-radius:0.5px"></div>
        <div style="width:3px;height:8px;background:#999;border-radius:0.5px"></div>
        <div style="width:3px;height:10px;background:#999;border-radius:0.5px"></div>
      </div>
      <div style="width:20px;height:10px;border:1px solid #666;border-radius:2px;margin-left:4px;position:relative">
        <div style="position:absolute;inset:1px;right:4px;background:#6f6;border-radius:1px"></div>
        <div style="position:absolute;right:-3px;top:2px;width:2px;height:5px;background:#666;border-radius:0 1px 1px 0"></div>
      </div>
    </div>
  `;
  screen.appendChild(statusBar);

  // Notch / dynamic island
  const notch = document.createElement('div');
  Object.assign(notch.style, {
    width: '80px', height: '22px',
    background: '#1a1a1a',
    borderRadius: '0 0 14px 14px',
    margin: '-4px auto 0',
    position: 'relative',
    flexShrink: '0',
  });
  // Camera dot
  const cam = document.createElement('div');
  Object.assign(cam.style, {
    width: '8px', height: '8px',
    background: '#0a0a14',
    borderRadius: '50%',
    position: 'absolute',
    top: '7px', right: '14px',
    border: '1px solid #333',
    boxShadow: 'inset 0 0 2px rgba(50,100,200,0.3)',
  });
  notch.appendChild(cam);
  screen.appendChild(notch);

  // App header
  const header = document.createElement('div');
  Object.assign(header.style, {
    padding: '10px 20px 8px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexShrink: '0',
  });
  header.innerHTML = `
    <span style="font-size:16px;font-weight:bold;color:#6cf;letter-spacing:0.5px">\u{1F4F1} KawaiiPhone</span>
    <div style="display:flex;align-items:center;gap:10px">
      <span id="phone-notif-bell" style="font-size:14px;cursor:pointer;opacity:0.5;transition:opacity 0.15s" title="Notification history">\u{1F514}</span>
      <span style="font-size:10px;color:#444">Tab to close</span>
    </div>
  `;
  // Bell click handler
  setTimeout(() => {
    const bell = document.getElementById('phone-notif-bell');
    if (bell) {
      bell.addEventListener('click', () => {
        renderNotifHistoryTab();
      });
    }
  }, 0);
  screen.appendChild(header);

  // Divider
  const divider = document.createElement('div');
  Object.assign(divider.style, {
    height: '1px', background: 'rgba(255,255,255,0.06)',
    margin: '0 16px',
    flexShrink: '0',
  });
  screen.appendChild(divider);

  // Content area
  const content = document.createElement('div');
  content.id = 'phone-content';
  Object.assign(content.style, {
    flex: '1',
    overflowY: 'auto',
    padding: '8px 0',
    fontSize: '13px',
  });
  content.style.scrollbarWidth = 'thin';
  content.style.scrollbarColor = 'rgba(100,180,255,0.2) transparent';
  screen.appendChild(content);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.id = 'phone-tabs';
  Object.assign(tabBar.style, {
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: '0',
    padding: '0 8px',
  });

  const tabs = ['messages', 'map', 'contacts', 'stats'];
  const tabLabels = ['\u{1F4AC} Messages', '\u{1F5FA}\u{FE0F} Map', '\u{1F464} Contacts', '\u{1F4CA} Stats'];
  for (let i = 0; i < tabs.length; i++) {
    const tab = document.createElement('button');
    tab.dataset.tab = tabs[i];
    Object.assign(tab.style, {
      flex: '1',
      padding: '10px 0',
      background: 'none',
      border: 'none',
      color: tabs[i] === activeTab ? '#6cf' : '#555',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
      borderTop: tabs[i] === activeTab ? '2px solid #6cf' : '2px solid transparent',
      transition: 'color 0.15s',
    });
    tab.textContent = tabLabels[i];
    tab.addEventListener('click', () => switchTab(tabs[i]));
    tabBar.appendChild(tab);
  }
  screen.appendChild(tabBar);

  // Home indicator bar (bottom of screen)
  const homeBar = document.createElement('div');
  Object.assign(homeBar.style, {
    width: '100px', height: '4px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '2px',
    margin: '6px auto 8px',
    flexShrink: '0',
  });
  screen.appendChild(homeBar);

  phoneContainer.appendChild(screen);
  document.body.appendChild(phoneContainer);
}

// Phone landscape mode — 2x wider for map tab
function setPhoneLandscape(landscape) {
  if (!phoneContainer) return;
  const style = phoneContainer.style;
  if (landscape) {
    // 2x size, landscape orientation (wider than tall)
    style.width = '1020px';
    style.height = '680px';
    style.transform = 'translate(-50%, -50%)';
    style.borderRadius = '30px';
    style.padding = '8px 12px';
  } else {
    // Normal portrait
    style.width = '340px';
    style.height = '680px';
    style.transform = 'translate(-50%, -50%)';
    style.borderRadius = '40px';
    style.padding = '12px 8px';
  }
}

function switchTab(tab) {
  // Cleanup previous tab
  if (activeTab === 'map') cleanupMapTab();
  activeTab = tab;

  // Toggle landscape mode for map tab
  setPhoneLandscape(tab === 'map');

  // Restore content padding for non-map tabs
  const content = document.getElementById('phone-content');
  if (content && tab !== 'map') {
    content.style.overflow = '';
    content.style.overflowY = 'auto';
    content.style.padding = '8px 0';
    content.style.position = '';
  }
  // Update tab bar styles
  const tabBtns = document.querySelectorAll('#phone-tabs button');
  tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.color = isActive ? '#6cf' : '#555';
    btn.style.borderTop = isActive ? '2px solid #6cf' : '2px solid transparent';
  });
  renderActiveTab();
}

function renderActiveTab() {
  if (activeTab === 'messages') renderMessagesTab();
  else if (activeTab === 'map') renderMapTab();
  else if (activeTab === 'contacts') renderContactsTab();
  else if (activeTab === 'stats') renderStatsTab();
}

// --- Map Tab ---
let mapCanvas = null;
let mapCtx = null;
let mapZoom = 1;          // 1 = full city fits, >1 = zoomed in
let mapPanX = 0;          // world-space pan offset
let mapPanZ = 0;
let mapDragging = false;
let mapDragStartX = 0;
let mapDragStartZ = 0;
let mapPanStartX = 0;
let mapPanStartZ = 0;
let mapAnimTimer = null;
let mapTooltip = null;

// Track which NPCs the player has dealt with (met)
function getMetNPCNames() {
  const met = new Set();
  for (const msg of messages) {
    if (msg.npcName && msg.npcName !== '???') {
      met.add(msg.npcName);
    }
  }
  return met;
}

function renderMapTab() {
  const content = document.getElementById('phone-content');
  if (!content) return;

  // Stop any previous map animation
  if (mapAnimTimer) {
    clearTimeout(mapAnimTimer);
    mapAnimTimer = null;
  }

  // Map fills the phone content area
  content.innerHTML = '';
  content.style.overflow = 'hidden';
  content.style.padding = '0';
  content.style.position = 'relative';

  // Create canvas if needed
  if (!mapCanvas) {
    mapCanvas = document.createElement('canvas');
    mapCtx = mapCanvas.getContext('2d');
  }

  // Size to fill content area
  const rect = content.getBoundingClientRect();
  const w = Math.floor(rect.width) || 300;
  const h = Math.floor(rect.height) || 480;
  mapCanvas.width = w;
  mapCanvas.height = h;
  Object.assign(mapCanvas.style, {
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: 'grab',
    imageRendering: 'pixelated',
  });
  content.appendChild(mapCanvas);

  // Tooltip element
  if (!mapTooltip) {
    mapTooltip = document.createElement('div');
    Object.assign(mapTooltip.style, {
      position: 'absolute',
      background: 'rgba(10,10,20,0.9)',
      color: '#ccc',
      fontFamily: 'monospace',
      fontSize: '10px',
      padding: '4px 8px',
      borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.1)',
      pointerEvents: 'none',
      display: 'none',
      zIndex: '10',
      maxWidth: '180px',
      whiteSpace: 'nowrap',
    });
  }
  content.appendChild(mapTooltip);

  // Mouse/touch events for pan and zoom
  mapCanvas.addEventListener('mousedown', onMapMouseDown);
  mapCanvas.addEventListener('mousemove', onMapMouseMove);
  mapCanvas.addEventListener('mouseup', onMapMouseUp);
  mapCanvas.addEventListener('mouseleave', onMapMouseUp);
  mapCanvas.addEventListener('wheel', onMapWheel, { passive: false });
  mapCanvas.addEventListener('click', onMapClick);

  // Start rendering loop
  updateMapCanvas();
}

function getMapCamera() {
  if (!playerRef) return { centerX: 0, centerZ: 0, worldRange: 250 };

  // Base world range: at zoom=1, show ~250 units from center (most of the city)
  const baseRange = 250;
  const worldRange = baseRange / mapZoom;

  // If zoomed in enough, center on player + pan offset
  let centerX, centerZ;
  if (mapZoom > 1.2) {
    centerX = playerRef.position.x + mapPanX;
    centerZ = playerRef.position.z + mapPanZ;
  } else {
    // Full city view centered on origin + pan
    centerX = 0 + mapPanX;
    centerZ = 20 + mapPanZ;
  }

  return { centerX, centerZ, worldRange };
}

function updateMapCanvas() {
  if (!mapCanvas || !mapCtx || activeTab !== 'map' || !isPhoneOpen) {
    mapAnimTimer = null;
    return;
  }

  const camera = getMapCamera();
  const player = playerRef ? {
    x: playerRef.position.x,
    z: playerRef.position.z,
    yaw: playerRef.yaw,
  } : { x: 0, z: 0, yaw: 0 };

  const metNPCs = getMetNPCNames();

  renderMap(mapCtx, mapCanvas.width, mapCanvas.height, camera, player, npcsRef, {
    showLabels: true,
    showNPCNames: mapZoom > 0.8,
    showDistrictOverlays: true,
    showLockInfo: true,
    showColorPercent: true,
    showApartment: true,
    activeWaypoints: activeWaypoints,
    metNPCs: metNPCs.size > 0 ? metNPCs : null,
    labelSize: Math.round(9 * Math.min(mapZoom, 2)),
    dotSize: Math.round(3 * Math.min(mapZoom, 2)),
    dirLen: 10,
  });

  // Zoom level indicator
  mapCtx.fillStyle = 'rgba(255,255,255,0.2)';
  mapCtx.font = '9px monospace';
  mapCtx.textAlign = 'right';
  mapCtx.fillText(`${Math.round(mapZoom * 100)}%`, mapCanvas.width - 6, mapCanvas.height - 6);

  // Schedule next update (throttled to ~15fps for efficiency)
  mapAnimTimer = setTimeout(updateMapCanvas, 66);
}

function onMapMouseDown(e) {
  mapDragging = true;
  mapDragStartX = e.clientX;
  mapDragStartZ = e.clientY;
  mapPanStartX = mapPanX;
  mapPanStartZ = mapPanZ;
  mapCanvas.style.cursor = 'grabbing';
}

function onMapMouseMove(e) {
  if (!mapDragging) return;
  const camera = getMapCamera();
  const scaleX = (camera.worldRange * 2) / mapCanvas.width;
  const scaleZ = (camera.worldRange * 2) / mapCanvas.height;
  mapPanX = mapPanStartX - (e.clientX - mapDragStartX) * scaleX;
  mapPanZ = mapPanStartZ - (e.clientY - mapDragStartZ) * scaleZ;
}

function onMapMouseUp() {
  mapDragging = false;
  if (mapCanvas) mapCanvas.style.cursor = 'grab';
}

function onMapWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.85 : 1.18;
  mapZoom = Math.max(0.5, Math.min(6, mapZoom * delta));
}

function onMapClick(e) {
  if (!mapCanvas || !playerRef) return;

  // Convert click position to world coordinates
  const rect = mapCanvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const camera = getMapCamera();

  const halfW = mapCanvas.width / 2;
  const halfH = mapCanvas.height / 2;
  const scaleX = halfW / camera.worldRange;
  const scaleZ = halfH / camera.worldRange;

  const worldX = camera.centerX + (cx - halfW) / scaleX;
  const worldZ = camera.centerZ + (cy - halfH) / scaleZ;

  // Check if clicked near an NPC
  const metNPCs = getMetNPCNames();
  if (npcsRef) {
    for (const npc of npcsRef) {
      if (!npc.group.visible) continue;
      if (metNPCs.size > 0 && !metNPCs.has(npc.name)) continue;
      const dx = npc.worldPos.x - worldX;
      const dz = npc.worldPos.z - worldZ;
      if (Math.sqrt(dx * dx + dz * dz) < 8 / mapZoom) {
        showMapTooltip(e, `${npc.name} — ${getNPCStatus(npc)}`);
        return;
      }
    }
  }

  // Check if clicked on apartment area
  const aptDx = 0 - worldX;
  const aptDz = 20 - worldZ;
  if (Math.sqrt(aptDx * aptDx + aptDz * aptDz) < 10 / mapZoom) {
    showMapTooltip(e, 'Home — sleep, workbench, gacha');
    return;
  }

  // Check if clicked on a locked district
  for (const [key, d] of Object.entries(PHONE_DISTRICTS)) {
    if (d.unlocked) continue;
    const dx = d.center.x - worldX;
    const dz = d.center.z - worldZ;
    if (Math.sqrt(dx * dx + dz * dz) < d.radius) {
      showMapTooltip(e, `${d.name} — Locked (${d.unlockDeals} deals)`);
      return;
    }
  }

  // Hide tooltip if clicking empty area
  if (mapTooltip) mapTooltip.style.display = 'none';
}

function getNPCStatus(npc) {
  if (!npc.isAvailable) return 'Home';
  let mood;
  if (npc.purchaseCount >= npc.maxPurchases) {
    mood = 'Maxed out';
  } else if (npc.isWalking) {
    mood = 'Walking';
  } else if (npc.currentActivity === 'working') {
    mood = 'Working';
  } else if (npc.currentActivity === 'sitting') {
    mood = 'Sitting';
  } else if (npc.currentActivity === 'eating') {
    mood = 'Eating';
  } else if (npc.currentActivity === 'socializing') {
    mood = 'Socializing';
  } else if (npc.currentActivity === 'wandering') {
    mood = 'Wandering';
  } else {
    mood = 'Available';
  }
  const wants = npc.wants.map(w => w === 'sticker' ? 'stickers' : w === 'gacha' ? 'capsules' : 'plushies').join(', ');
  return `${mood}, wants ${wants}`;
}

function showMapTooltip(e, text) {
  if (!mapTooltip) return;
  const content = document.getElementById('phone-content');
  if (!content) return;
  const contentRect = content.getBoundingClientRect();
  mapTooltip.textContent = text;
  mapTooltip.style.display = 'block';
  let left = e.clientX - contentRect.left + 8;
  let top = e.clientY - contentRect.top - 20;
  // Keep within bounds
  if (left + 180 > contentRect.width) left = contentRect.width - 185;
  if (top < 0) top = e.clientY - contentRect.top + 12;
  mapTooltip.style.left = left + 'px';
  mapTooltip.style.top = top + 'px';
  // Auto-hide after 3s
  setTimeout(() => {
    if (mapTooltip) mapTooltip.style.display = 'none';
  }, 3000);
}

function cleanupMapTab() {
  if (mapAnimTimer) {
    clearTimeout(mapAnimTimer);
    mapAnimTimer = null;
  }
}

// --- Messages Tab ---
function renderMessagesTab() {
  const content = document.getElementById('phone-content');
  if (!content) return;

  if (messages.length === 0) {
    content.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#444">
        No messages yet.<br>NPCs will text you when they need something.
      </div>
    `;
    return;
  }

  let html = '';
  for (const msg of messages) {
    const timeAgo = getTimeAgo(msg.timestamp);
    const isNew = !msg.read && !msg.declined && !msg.expired;

    // Status indicator
    let statusHtml = '';
    if (msg.accepted && !msg.expired) {
      const wp = activeWaypoints.find(w => w.messageId === msg.id);
      const timeStr = wp ? formatTime(wp.timeLeft) : '';
      statusHtml = `<div style="color:#6cf;font-size:11px;margin-top:6px">Accepted - ${timeStr} remaining</div>`;
    } else if (msg.declined) {
      statusHtml = `<div style="color:#666;font-size:11px;margin-top:6px">Declined</div>`;
    } else if (msg.expired) {
      // Check if it was completed (deal done) or timed out
      const wasCompleted = msg.accepted;
      if (wasCompleted) {
        statusHtml = `<div style="color:#6f6;font-size:11px;margin-top:6px">Completed</div>`;
      } else {
        statusHtml = `<div style="color:#a55;font-size:11px;margin-top:6px">Expired</div>`;
      }
    }

    // Action buttons
    let actionsHtml = '';
    if (!msg.accepted && !msg.declined && !msg.expired) {
      actionsHtml = `
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="phone-msg-btn phone-accept-btn" data-msg-id="${msg.id}" style="
            flex:1;padding:6px 0;border-radius:6px;border:1px solid #4a7;
            background:rgba(68,170,119,0.15);color:#4a7;font-family:monospace;
            font-size:11px;font-weight:bold;cursor:pointer;
          ">Accept</button>
          <button class="phone-msg-btn phone-decline-btn" data-msg-id="${msg.id}" style="
            flex:1;padding:6px 0;border-radius:6px;border:1px solid #666;
            background:rgba(100,100,100,0.1);color:#666;font-family:monospace;
            font-size:11px;font-weight:bold;cursor:pointer;
          ">Decline</button>
        </div>
      `;
    }

    html += `
      <div data-msg-id="${msg.id}" style="
        padding:10px 16px;margin:0 8px 6px;
        background:${isNew ? 'rgba(100,180,255,0.06)' : 'rgba(255,255,255,0.02)'};
        border-radius:10px;
        border-left:3px solid ${isNew ? '#6cf' : 'rgba(255,255,255,0.05)'};
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:bold;color:${isNew ? '#6cf' : '#aaa'};font-size:13px">${msg.npcName}</span>
          <span style="font-size:10px;color:#555">${timeAgo}</span>
        </div>
        <div style="color:#ccc;font-size:12px;line-height:1.4">${msg.text}</div>
        ${statusHtml}
        ${actionsHtml}
      </div>
    `;
  }

  content.innerHTML = html;

  // Wire up buttons
  content.querySelectorAll('.phone-accept-btn').forEach(btn => {
    btn.addEventListener('click', () => acceptMessage(parseInt(btn.dataset.msgId)));
  });
  content.querySelectorAll('.phone-decline-btn').forEach(btn => {
    btn.addEventListener('click', () => declineMessage(parseInt(btn.dataset.msgId)));
  });

  // Mark visible messages as read
  for (const msg of messages) {
    if (!msg.read && !msg.declined && !msg.expired) {
      msg.read = true;
    }
  }
  updateNotifBadge();
}

function getTimeAgo(timestamp) {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// --- Contacts Tab ---
function renderContactsTab() {
  const content = document.getElementById('phone-content');
  if (!content) return;

  let html = '';
  for (const npc of npcsRef) {
    if (!npc.isAvailable) continue;

    const rel = getRelationship(npc.name);
    const relLevel = Math.floor(rel.level);
    const relNames = ['Stranger', 'Acquaintance', 'Customer', 'Regular', 'Loyal', 'Devoted'];
    const relName = relNames[Math.min(relLevel, 5)];

    // Progress to next level
    const thresholds = [1, 4, 9, 16, 26, Infinity];
    const nextThreshold = thresholds[Math.min(relLevel, 4)];
    const prevThreshold = relLevel > 0 ? thresholds[relLevel - 1] : 0;
    const progress = nextThreshold === Infinity ? 100 :
      Math.round(((rel.totalDeals - prevThreshold) / (nextThreshold - prevThreshold)) * 100);

    // Affinities
    const stickerAff = getNPCAffinity(npc.name, 'sticker');
    const plushieAff = getNPCAffinity(npc.name, 'plushie');
    const gachaAff = getNPCAffinity(npc.name, 'gacha');

    // Mood
    const mood = getNPCMood(npc.name);
    const moodColors = { Eager: '#6cf', Satisfied: '#6f6', Full: '#fa8', Spooked: '#f55' };
    const moodColor = moodColors[mood] || '#888';

    html += `
      <div style="padding:12px 16px;margin:0 8px 6px;background:rgba(255,255,255,0.02);border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:bold;font-size:14px">${npc.name}</span>
          <span style="font-size:11px;color:${moodColor};border:1px solid ${moodColor}33;padding:2px 8px;border-radius:4px">${mood}</span>
        </div>
        <div style="font-size:11px;color:#6cf;margin-bottom:6px">${relName} (Lv${relLevel})</div>
        <div style="background:rgba(255,255,255,0.06);border-radius:3px;height:6px;margin-bottom:8px;overflow:hidden">
          <div style="width:${Math.min(progress, 100)}%;height:100%;background:#6cf;border-radius:3px;transition:width 0.3s"></div>
        </div>
        <div style="font-size:11px;color:#888;line-height:1.8">
          <div style="display:flex;gap:12px;margin-bottom:4px">
            <span title="Sticker affinity">S ${getAffinityIcon(stickerAff)}</span>
            <span title="Plushie affinity">P ${getAffinityIcon(plushieAff)}</span>
            <span title="Gacha affinity">G ${getAffinityIcon(gachaAff)}</span>
          </div>
          <div>Deals: <span style="color:#ccc">${rel.totalDeals}</span> &middot; Spent: <span style="color:#6f6">$${rel.totalSpent}</span></div>
        </div>
        ${npc.name === 'Ash' && isAshHireUnlocked() ? `
        <div style="margin-top:8px">
          ${isAshHired()
            ? `<button class="ash-hire-btn" data-action="fire" style="background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);border-radius:6px;padding:5px 12px;color:#f88;font-family:monospace;font-size:11px;cursor:pointer">Fire Ash ($15/day)</button>`
            : `<button class="ash-hire-btn" data-action="hire" style="background:rgba(100,200,150,0.1);border:1px solid rgba(100,200,150,0.3);border-radius:6px;padding:5px 12px;color:#6f9;font-family:monospace;font-size:11px;cursor:pointer">Hire Ash ($15/day)</button>`
          }
          ${isAshHired() ? '<span style="color:#555;font-size:10px;margin-left:8px">Scavenging 6AM–4PM</span>' : ''}
          ${!isAshHired() && isAnyScavengerHired() ? '<span style="color:#555;font-size:10px;margin-left:8px">Fire current scavenger first</span>' : ''}
        </div>` : ''}
      </div>
    `;
  }

  // Add Ruins Kid hire card if unlocked (standalone NPC, shown at bottom)
  if (isRuinsKidHireUnlocked()) {
    html += `
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:bold;color:#c8b090">Ruins Kid</div>
          <div style="font-size:11px;color:#556">Ruins — scavenger</div>
        </div>
        <div style="font-size:12px;color:#667;margin-bottom:8px">Finds fabric and stuffing in the ruins. $20/day.</div>
        <div>
          ${isRuinsKidHired()
            ? `<button class="rk-hire-btn" data-action="fire" style="background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);border-radius:6px;padding:5px 12px;color:#f88;font-family:monospace;font-size:11px;cursor:pointer">Fire Ruins Kid ($20/day)</button>
               <span style="color:#555;font-size:10px;margin-left:8px">Scavenging 6AM–4PM</span>`
            : `<button class="rk-hire-btn" data-action="hire" style="background:rgba(180,150,100,0.1);border:1px solid rgba(180,150,100,0.3);border-radius:6px;padding:5px 12px;color:#c8a860;font-family:monospace;font-size:11px;cursor:pointer">Hire Ruins Kid ($20/day)</button>
               ${isAnyScavengerHired() ? '<span style="color:#555;font-size:10px;margin-left:8px">Fire current scavenger first</span>' : ''}`
          }
        </div>
      </div>
    `;
  }

  content.innerHTML = html || '<div style="text-align:center;padding:60px 20px;color:#444">No contacts yet.</div>';

  // Attach hire/fire handlers for Ash
  content.querySelectorAll('.ash-hire-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'hire') hireAsh();
      else fireAsh();
      renderContactsTab();
    });
  });

  // Attach hire/fire handlers for Ruins Kid
  content.querySelectorAll('.rk-hire-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'hire') hireRuinsKid();
      else fireRuinsKid();
      renderContactsTab();
    });
  });
}

// --- Stats Tab ---
function renderStatsTab() {
  const content = document.getElementById('phone-content');
  if (!content) return;

  const worldColor = Math.round(getWorldColor() * 100);
  const rankName = getRankName();
  const jp = getJP();
  const progress = getJPProgress();
  const nextRank = getNextRank();
  stats.dayNumber = getDayNumber(); // always sync with time system

  // Build rank ladder rows
  const rankRows = RANKS.map(r => {
    const isCurrent = r.name === rankName;
    const isPast = jp >= r.jp && r.name !== rankName;
    const color = isCurrent ? '#6cf' : isPast ? '#446' : '#333';
    const weight = isCurrent ? 'bold' : 'normal';
    return `<div style="color:${color};font-weight:${weight}">${isCurrent ? '▶ ' : '  '}${r.name} <span style="color:#333">(${r.jp} JP)</span></div>`;
  }).join('');

  content.innerHTML = `
    <div style="padding:16px">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Your Rank</div>
        <div style="font-size:20px;font-weight:bold;color:#6cf">${rankName}</div>
        <div style="margin-top:6px;font-size:22px;font-weight:bold;color:#fff">${jp} <span style="font-size:13px;color:#556">JP</span></div>
        ${nextRank ? `
        <div style="margin-top:6px;display:flex;align-items:center;gap:8px;justify-content:center">
          <div style="width:120px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
            <div style="width:${Math.round(progress * 100)}%;height:100%;background:#6cf;border-radius:3px"></div>
          </div>
          <div style="font-size:10px;color:#446">${nextRank.jp - jp} JP to ${nextRank.name}</div>
        </div>` : '<div style="font-size:10px;color:#6cf;margin-top:4px">Max Rank Achieved</div>'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${statCard('Total Deals', stats.totalDeals, '#6cf')}
        ${statCard('Money Earned', '$' + stats.totalEarned, '#6f6')}
        ${statCard('Stickers Sold', stats.stickersSold, '#e87bda')}
        ${statCard('Plushies Sold', stats.plushiesSold, '#7bc8e8')}
      </div>
      ${stats.gachaSold > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${statCard('Capsules Sold', stats.gachaSold, '#ffb4d8')}
        ${statCard('', '', 'transparent')}
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${statCard('Day', stats.dayNumber, '#fa8')}
        ${statCard('World Color', worldColor + '%', '#6f6')}
      </div>

      <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
        <div style="font-size:11px;color:#555;margin-bottom:8px;letter-spacing:1px">RANK LADDER</div>
        <div style="font-size:10px;line-height:1.8;font-family:monospace">${rankRows}</div>
      </div>
    </div>
  `;
}

function statCard(label, value, color) {
  return `
    <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${label}</div>
      <div style="font-size:18px;font-weight:bold;color:${color}">${value}</div>
    </div>
  `;
}

// --- Notification History Panel ---
function renderNotifHistoryTab() {
  const content = document.getElementById('phone-content');
  if (!content) return;

  const history = getNotificationHistory();
  markHistoryRead();

  if (history.length === 0) {
    content.innerHTML = `
      <div style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span id="notif-history-back" style="cursor:pointer;font-size:16px;color:#6cf">\u2190</span>
          <span style="font-size:14px;font-weight:bold;color:#ccc">\u{1F514} Notifications</span>
        </div>
        <div style="text-align:center;padding:40px 20px;color:#444">No notifications yet.</div>
      </div>
    `;
    content.querySelector('#notif-history-back').addEventListener('click', () => renderActiveTab());
    return;
  }

  let html = `
    <div style="padding:12px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span id="notif-history-back" style="cursor:pointer;font-size:16px;color:#6cf">\u2190</span>
        <span style="font-size:14px;font-weight:bold;color:#ccc">\u{1F514} Notifications</span>
      </div>
  `;

  for (const n of history) {
    const timeStr = getTimeAgo(n.timestamp);
    const color = getNPCColor(n.npcName);
    const dimmed = n.read ? 'opacity:0.5;' : '';
    const typeIcon = n.type === 'deal_request' ? '\u{1F4E6}' :
                     n.type === 'ace_warning' ? '\u26A0\uFE0F' :
                     n.type === 'dealer_report' ? '\u{1F4B0}' : '\u{1F4AC}';

    html += `
      <div style="
        padding:8px 10px;margin-bottom:4px;
        background:rgba(255,255,255,0.02);border-radius:6px;
        border-left:2px solid ${color};
        ${dimmed}
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
          <span style="font-size:12px;font-weight:bold;color:#ccc">${typeIcon} ${n.npcName}</span>
          <span style="font-size:9px;color:#555">${timeStr}</span>
        </div>
        <div style="font-size:11px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.preview}</div>
      </div>
    `;
  }

  html += '</div>';
  content.innerHTML = html;
  content.querySelector('#notif-history-back').addEventListener('click', () => renderActiveTab());
}

// --- Open / Close ---
export function openPhone() {
  if (isDealOpenFn()) return; // don't open phone during deal
  isPhoneOpen = true;
  phoneContainer.style.display = 'flex';
  document.exitPointerLock();
  renderActiveTab();
  updateNotifBadge();
}

export function closePhone() {
  if (activeTab === 'map') {
    cleanupMapTab();
    setPhoneLandscape(false);
  }
  isPhoneOpen = false;
  phoneContainer.style.display = 'none';
  updateNotifBadge();
}

export function togglePhone() {
  if (isPhoneOpen) closePhone();
  else openPhone();
}

export function isPhoneVisible() {
  return isPhoneOpen;
}

// --- Save/Load ---
export function getPhoneState() {
  return {
    messages: messages.map(m => ({
      id: m.id,
      npcName: m.npcName,
      itemType: m.itemType,
      qty: m.qty,
      meetupPos: m.meetupPos,
      meetupName: m.meetupName,
      text: m.text,
      timestamp: m.timestamp,
      read: m.read,
      accepted: m.accepted,
      declined: m.declined,
      expired: m.expired,
    })),
    nextMsgId,
    stats: { ...stats },
    npcCooldowns: { ...npcCooldowns },
    gachaUnlockSent,
    eastsideUnlockSent,
    dexMsgDay,
    activeDeals: getActiveDealsState(),
    // Don't save active waypoints — they expire on reload
  };
}

export function restorePhoneState(data) {
  if (!data) return;
  if (data.messages) {
    messages = data.messages;
    // Mark any accepted-but-not-expired as expired (waypoints don't persist)
    for (const m of messages) {
      if (m.accepted && !m.expired) {
        m.expired = true;
      }
    }
  }
  if (data.nextMsgId) nextMsgId = data.nextMsgId;
  if (data.stats) Object.assign(stats, data.stats);
  if (data.npcCooldowns) Object.assign(npcCooldowns, data.npcCooldowns);
  if (data.gachaUnlockSent) gachaUnlockSent = true;
  if (data.eastsideUnlockSent) eastsideUnlockSent = true;
  if (data.dexMsgDay !== undefined) dexMsgDay = data.dexMsgDay;
  if (data.activeDeals) restoreActiveDealsState(data.activeDeals);
  updateNotifBadge();
}

// --- Public getters ---
export function getPhoneStats() {
  return stats;
}

export function getUnreadCount() {
  return messages.filter(m => !m.read && !m.declined && !m.expired).length;
}

// Open the phone directly to a specific message
export function openPhoneToMessage(msgId) {
  if (isDealOpenFn()) return;
  activeTab = 'messages';
  isPhoneOpen = true;
  phoneContainer.style.display = 'flex';
  document.exitPointerLock();
  renderMessagesTab();
  updateNotifBadge();
  // Scroll to the message if possible
  setTimeout(() => {
    const content = document.getElementById('phone-content');
    if (content) {
      const msgEls = content.querySelectorAll('[data-msg-id]');
      for (const el of msgEls) {
        if (el.dataset.msgId === String(msgId)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    }
  }, 50);
}

// --- Init ---
export function initPhone(scene, npcs, player) {
  sceneRef = scene;
  npcsRef = npcs;
  playerRef = player;

  createPhoneUI();
  createNotifBadge();

  // Tab key to toggle phone
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (isDealOpenFn()) return;
      togglePhone();
    }
  });
}

// --- Update (called each frame) ---
export function updatePhone(dt) {
  if (!npcsRef || npcsRef.length === 0) return;

  // Update active deals HUD timers
  updateDeals(dt);

  // Message generation timer — only during NPC active hours (6 AM – 6 PM)
  if (isNPCActive()) {
    msgTimer += dt;
    if (msgTimer >= msgInterval) {
      msgTimer = 0;
      // Longer interval if inventory is empty
      const hasItems = getSlots().length > 0;
      msgInterval = hasItems ? randomBetween(45, 90) : randomBetween(90, 180);
      generateMessage();
    }

    // Dex daily location message — send once per day around 10 AM
    sendDexDailyMsg();
  }

  // Update waypoint timers
  for (let i = activeWaypoints.length - 1; i >= 0; i--) {
    const wp = activeWaypoints[i];
    wp.timeLeft -= dt;

    // Bob the sprite up and down
    wp.sprite.position.y = 3.5 + Math.sin(Date.now() * 0.003) * 0.3;

    if (wp.timeLeft <= 0) {
      // Expired — remove waypoint and send timeout message
      sceneRef.remove(wp.sprite);
      wp.sprite.material.dispose();
      wp.sprite.material.map.dispose();

      // Mark original message as expired
      const msg = messages.find(m => m.id === wp.messageId);
      if (msg) msg.expired = true;

      expireActiveDeal(wp.messageId);

      // Add timeout message
      const npc = npcsRef.find(n => n.name === wp.npcName);
      messages.unshift({
        id: nextMsgId++,
        npcName: wp.npcName,
        itemType: '',
        qty: 0,
        meetupPos: [0, 0, 0],
        meetupName: '',
        text: 'Waited too long. Maybe next time.',
        timestamp: Date.now(),
        read: false,
        accepted: false,
        declined: false,
        expired: true, // system message, not actionable
      });

      activeWaypoints.splice(i, 1);
      playBuzz();
      updateNotifBadge();
      showNotification(messages[0]);
      if (isPhoneOpen && activeTab === 'messages') renderMessagesTab();
    }
  }

  // Refresh timers on messages tab if open
  if (isPhoneOpen && activeTab === 'messages' && activeWaypoints.length > 0) {
    // Update timer displays without full re-render (find elements)
    // For simplicity, re-render every 5 seconds
    if (Math.floor(Date.now() / 5000) !== Math.floor((Date.now() - dt * 1000) / 5000)) {
      renderMessagesTab();
    }
  }
}
