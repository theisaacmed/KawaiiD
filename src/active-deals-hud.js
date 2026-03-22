// Active Deals HUD — left-side panel showing accepted phone deals
//
// Architecture:
//   - Each accepted deal is a card: NPC name (colored), item, location, time remaining
//   - Cards stack vertically on the left, below the money/rank display (~top:80px)
//   - Completing a deal fades the card green then removes it
//   - Expiring a deal fades to red then removes it
//   - Abandon (X button) dismisses immediately
//   - Max 4 visible at once, scrollable if more

import { getNPCColor } from './notifications.js';

// --- State ---
let activeDeals = []; // { id, npcName, itemType, qty, meetupName, messageId, timeLeft, el }
let nextDealId = 1;
let panelEl = null;

// --- Init ---
export function initActiveDealsHUD() {
  panelEl = document.createElement('div');
  panelEl.id = 'active-deals-panel';
  Object.assign(panelEl.style, {
    position: 'fixed',
    top: '80px',
    left: '16px',
    width: '210px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '340px',
    overflowY: 'auto',
    overflowX: 'hidden',
    zIndex: '150',
    pointerEvents: 'none',
    scrollbarWidth: 'none', // Firefox
  });
  // Hide webkit scrollbar
  const style = document.createElement('style');
  style.textContent = '#active-deals-panel::-webkit-scrollbar { display: none; }';
  document.head.appendChild(style);
  document.body.appendChild(panelEl);
}

// --- Add a deal card when player accepts a message ---
export function addActiveDeal(msg) {
  if (!panelEl) return;
  // Don't add duplicates
  if (activeDeals.find(d => d.messageId === msg.id)) return;

  const deal = {
    id: nextDealId++,
    npcName: msg.npcName,
    itemType: msg.itemType || 'item',
    qty: msg.qty || 1,
    meetupName: msg.meetupName || 'unknown location',
    messageId: msg.id,
    timeLeft: 180, // 3 minutes, same as waypoint
    el: null,
  };

  activeDeals.push(deal);
  deal.el = buildCard(deal);
  panelEl.appendChild(deal.el);

  // Animate in
  deal.el.style.opacity = '0';
  deal.el.style.transform = 'translateX(-20px)';
  requestAnimationFrame(() => {
    deal.el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    deal.el.style.opacity = '1';
    deal.el.style.transform = 'translateX(0)';
  });
}

// --- Build card DOM ---
function buildCard(deal) {
  const npcColor = getNPCColor(deal.npcName);
  const itemLabel = itemDisplayName(deal.itemType, deal.qty);

  const card = document.createElement('div');
  card.dataset.dealId = deal.id;
  Object.assign(card.style, {
    background: 'rgba(0,0,0,0.62)',
    borderRadius: '8px',
    borderLeft: `3px solid ${npcColor}`,
    padding: '8px 10px',
    fontFamily: 'monospace',
    color: '#ccc',
    fontSize: '11px',
    lineHeight: '1.5',
    position: 'relative',
    pointerEvents: 'auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    flexShrink: '0',
  });

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-weight:bold;color:${npcColor};font-size:12px">${deal.npcName}</span>
      <button class="deal-dismiss-btn" data-deal-id="${deal.id}" style="
        background:none;border:none;color:#555;font-size:14px;cursor:pointer;
        padding:0 0 0 6px;line-height:1;font-family:monospace;
        transition:color 0.15s;
      " title="Abandon deal">✕</button>
    </div>
    <div style="color:#aaa">📦 ${itemLabel}</div>
    <div style="color:#aaa">📍 ${deal.meetupName}</div>
    <div class="deal-timer" data-deal-id="${deal.id}" style="color:#6cf;margin-top:3px">⏱ ${formatTime(deal.timeLeft)}</div>
  `;

  card.querySelector('.deal-dismiss-btn').addEventListener('mouseenter', e => {
    e.target.style.color = '#e55';
  });
  card.querySelector('.deal-dismiss-btn').addEventListener('mouseleave', e => {
    e.target.style.color = '#555';
  });
  card.querySelector('.deal-dismiss-btn').addEventListener('click', () => {
    abandonDeal(deal.id);
  });

  return card;
}

function itemDisplayName(itemType, qty) {
  const name = itemType === 'sticker' ? 'sticker' :
               itemType === 'plushie' ? 'plushie' :
               itemType === 'gacha' ? 'capsule' : itemType || 'item';
  const plural = qty !== 1 ? `${name}s` : name;
  return `${qty}x ${plural}`;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

// --- Abandon deal (X button) ---
function abandonDeal(dealId) {
  const deal = activeDeals.find(d => d.id === dealId);
  if (!deal) return;
  removeCard(deal, null);
}

// --- Complete deal (trade happened) ---
export function completeDeal(npcName) {
  const deal = activeDeals.find(d => d.npcName === npcName);
  if (!deal || !deal.el) return;
  removeCard(deal, 'complete');
}

// --- Expire deal (time ran out) ---
export function expireDeal(messageId) {
  const deal = activeDeals.find(d => d.messageId === messageId);
  if (!deal || !deal.el) return;
  removeCard(deal, 'expire');
}

// --- Remove with animation ---
function removeCard(deal, reason) {
  const el = deal.el;
  if (!el) return;

  // Remove from state immediately so it won't be double-removed
  activeDeals = activeDeals.filter(d => d.id !== deal.id);

  if (reason === 'complete') {
    el.style.transition = 'background 0.4s ease, opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s';
    el.style.background = 'rgba(40,120,60,0.7)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20px)';
      setTimeout(() => el.remove(), 500);
    }, 400);
  } else if (reason === 'expire') {
    el.style.transition = 'background 0.4s ease, opacity 0.5s ease 0.8s, transform 0.5s ease 0.8s';
    el.style.background = 'rgba(140,30,30,0.7)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20px)';
      setTimeout(() => el.remove(), 500);
    }, 800);
  } else {
    // Immediate fade
    el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    setTimeout(() => el.remove(), 250);
  }
}

// --- Update (called each frame from phone.js updatePhone) ---
export function updateDeals(dt) {
  for (const deal of activeDeals) {
    deal.timeLeft -= dt;

    // Update timer display
    const timerEl = panelEl
      ? panelEl.querySelector(`.deal-timer[data-deal-id="${deal.id}"]`)
      : null;
    if (timerEl) {
      timerEl.textContent = `⏱ ${formatTime(deal.timeLeft)}`;
      // Warn when < 30s
      timerEl.style.color = deal.timeLeft < 30 ? '#f84' : '#6cf';
    }
  }
}

// --- Save/Load ---
export function getActiveDealsState() {
  return activeDeals.map(d => ({
    id: d.id,
    npcName: d.npcName,
    itemType: d.itemType,
    qty: d.qty,
    meetupName: d.meetupName,
    messageId: d.messageId,
    timeLeft: d.timeLeft,
  }));
}

export function restoreActiveDealsState(data) {
  if (!data || !Array.isArray(data)) return;
  if (!panelEl) return;

  for (const saved of data) {
    if (saved.timeLeft <= 0) continue; // already expired
    const deal = {
      id: saved.id,
      npcName: saved.npcName,
      itemType: saved.itemType,
      qty: saved.qty,
      meetupName: saved.meetupName,
      messageId: saved.messageId,
      timeLeft: saved.timeLeft,
      el: null,
    };
    // Keep ID continuity
    if (saved.id >= nextDealId) nextDealId = saved.id + 1;
    activeDeals.push(deal);
    deal.el = buildCard(deal);
    panelEl.appendChild(deal.el);
  }
}
