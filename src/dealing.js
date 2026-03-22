// Dealing system — drag-to-deal negotiation with NPC personalities

import { removeFromSlot, addMoney } from './inventory.js';
import { flashMoney, showFloatingMoney, onItemDrop, isDragging } from './hud.js';
import { generateOffer, npcLine, BASE_VALUES, willAcceptGacha, rollAcceptance, generateDealOffer, getNPCAffinity, getAffinityIcon, getAffinityRejectLine, getAffinityAcceptLine, recordDeal, checkAffinityGrowth, getRelationship, freezeForDeal, unfreezeFromDeal, checkDealAvailability } from './npc.js';
import { spreadColor } from './color-system.js';
import { triggerReveal } from './gacha.js';
import { playDealComplete } from './audio.js';
import { getGameHour } from './time-system.js';

// Callbacks — set by main.js to avoid circular dependencies
let onDealCallback = null;
export function setOnDealCallback(fn) { onDealCallback = fn; }

let onPhoneDealCallback = null;
export function setOnPhoneDealCallback(fn) { onPhoneDealCallback = fn; }

let panel = null;
let backdrop = null;
let activeNPC = null;
let isOpen = false;

// Negotiation state
let phase = 'greeting'; // greeting | considering | negotiating | done
let offeredItem = null;    // { slotIndex, type }
let currentOffer = 0;
let maxNPCPrice = 0; // ceiling for this deal
let counterRound = 0;
const MAX_COUNTER_ROUNDS = 2;
let sessionRejections = 0; // rejections in this deal session

export function initDealing() {
  // Backdrop (click outside to close)
  backdrop = document.createElement('div');
  backdrop.id = 'deal-backdrop';
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.4)',
    zIndex: '190',
    display: 'none',
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && !isDragging()) closePanel();
  });
  document.body.appendChild(backdrop);

  // Main panel
  panel = document.createElement('div');
  panel.id = 'deal-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(12,12,22,0.94)',
    border: '1px solid rgba(120,180,255,0.2)',
    borderRadius: '16px',
    padding: '0',
    width: '460px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    zIndex: '200',
    display: 'none',
    pointerEvents: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    overflow: 'hidden',
  });
  document.body.appendChild(panel);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isOpen) closePanel();
  });

  // Register drag-drop callback from HUD
  onItemDrop(handleItemDrop);
}

export function openDealPanel(npc, skipAvailabilityCheck) {
  // Check if NPC is willing to deal at this location/time
  if (!skipAvailabilityCheck) {
    const avail = checkDealAvailability(npc.name, getGameHour());
    if (!avail.canDeal) {
      // Show refusal as a toast instead of opening the panel
      if (locationRefuseCallback) {
        locationRefuseCallback(avail.refuseLine);
      }
      return;
    }
  }

  activeNPC = npc;
  isOpen = true;
  phase = 'greeting';
  offeredItem = null;
  currentOffer = 0;
  maxNPCPrice = 0;
  counterRound = 0;
  sessionRejections = 0;

  // Freeze NPC movement while dealing
  freezeForDeal(npc.name);

  document.exitPointerLock();
  backdrop.style.display = 'block';
  panel.style.display = 'block';
  renderGreeting();
}

// Location-based refusal callback (set by interaction.js)
let locationRefuseCallback = null;
export function setLocationRefuseCallback(fn) { locationRefuseCallback = fn; }

export function closePanel() {
  if (!isOpen) return;
  // Unfreeze NPC movement
  if (activeNPC) unfreezeFromDeal(activeNPC.name);
  isOpen = false;
  activeNPC = null;
  phase = 'greeting';
  offeredItem = null;
  backdrop.style.display = 'none';
  panel.style.display = 'none';
}

export function isDealOpen() {
  return isOpen;
}

// --- Handle item dropped into deal zone ---
function handleItemDrop(slotIndex, itemType, itemSubtype) {
  if (!isOpen || !activeNPC || phase !== 'greeting') return false;
  if (activeNPC.purchaseCount >= activeNPC.maxPurchases) return false;

  // After 3 rejections in a session, NPC refuses all items
  if (sessionRejections >= 3) {
    renderSessionMaxReject();
    return false;
  }

  // Show "considering..." phase with 0.5s pause
  offeredItem = { slotIndex, type: itemType, subtype: itemSubtype };
  phase = 'considering';
  renderConsidering(itemType);

  setTimeout(() => {
    if (phase !== 'considering' || !isOpen || !activeNPC) return;

    // Roll acceptance probability
    const result = rollAcceptance(activeNPC, itemType, sessionRejections);

    if (!result.accepted) {
      // Rejection
      sessionRejections++;
      phase = 'greeting';
      offeredItem = null;
      renderAffinityReject(result.affinity, itemType);
      return;
    }

    // Accepted — move to negotiation
    const deal = generateDealOffer(activeNPC, itemType, offeredItem.subtype);
    currentOffer = deal.offer;
    maxNPCPrice = deal.maxPrice;
    counterRound = 0;
    phase = 'negotiating';
    renderOffer(result.affinity);
  }, 500);

  return true; // consume the drag (item is being considered)
}

// ============================
//  RENDER FUNCTIONS
// ============================

function renderGreeting() {
  const npc = activeNPC;
  const atLimit = npc.purchaseCount >= npc.maxPurchases;
  const rel = getRelationship(npc.name);
  const relLevel = Math.floor(rel.level);
  const relNames = ['Stranger', 'Acquaintance', 'Customer', 'Regular', 'Loyal', 'Devoted'];
  const relName = relNames[Math.min(relLevel, 5)];

  // Affinity display
  const stickerAff = getAffinityIcon(getNPCAffinity(npc.name, 'sticker'));
  const plushieAff = getAffinityIcon(getNPCAffinity(npc.name, 'plushie'));
  const gachaAff = getAffinityIcon(getNPCAffinity(npc.name, 'gacha'));

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:20px;font-weight:bold;letter-spacing:0.5px">${npc.name}</span>
        <button id="deal-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:#aaa;font-size:12px;margin-bottom:6px">${relName} (Lv${relLevel}) &middot; ${npc.maxPurchases - npc.purchaseCount} deals left</div>
      <div style="color:#666;font-size:11px;margin-bottom:14px">
        <span title="Sticker">S${stickerAff}</span>
        <span title="Plushie" style="margin-left:8px">P${plushieAff}</span>
        <span title="Gacha" style="margin-left:8px">G${gachaAff}</span>
      </div>
    </div>

    <div style="padding:0 24px">
      ${renderDialogueBubble(atLimit ? npc.limitLine : npcLine(npc, 'greetings'))}
    </div>

    ${atLimit ? '' : renderDropZone()}

    <div style="padding:12px 24px 16px;text-align:center">
      <button id="deal-done-btn" style="${smallBtnStyle()}">${atLimit ? 'Goodbye' : 'Done'}</button>
    </div>
  `;

  panel.querySelector('#deal-close').addEventListener('click', closePanel);
  panel.querySelector('#deal-done-btn').addEventListener('click', closePanel);
}

let rejectTimeout = null;

function renderConsidering(itemType) {
  const npc = activeNPC;
  const itemLabel = itemType === 'gacha' ? 'gacha capsule' : itemType;
  const affinity = getNPCAffinity(npc.name, itemType);
  const affinityIcon = getAffinityIcon(affinity);

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:20px;font-weight:bold;letter-spacing:0.5px">${npc.name}</span>
        <button id="deal-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
    </div>
    <div style="padding:0 24px">
      <div style="text-align:center;padding:30px 0">
        <div style="font-size:14px;color:#888;margin-bottom:12px">Offered: ${itemLabel} <span style="font-size:16px" title="Affinity">${affinityIcon}</span></div>
        <div style="font-size:16px;color:#6cf;animation:pulse-consider 1s infinite">Considering...</div>
      </div>
    </div>
    <style>
      @keyframes pulse-consider {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    </style>
  `;
  panel.querySelector('#deal-close').addEventListener('click', () => {
    offeredItem = null;
    phase = 'greeting';
    closePanel();
  });
}

function renderAffinityReject(affinity, itemType) {
  // Show rejection message, then return to greeting for next offer attempt
  const npc = activeNPC;
  const rejectLine = getAffinityRejectLine(affinity);

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:20px;font-weight:bold;letter-spacing:0.5px">${npc.name}</span>
        <button id="deal-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
      <div style="color:#aaa;font-size:12px;margin-bottom:14px">${sessionRejections}/3 rejections this session</div>
    </div>
    <div style="padding:0 24px">
      ${renderDialogueBubble(rejectLine)}
      <div style="color:#fa8;font-size:12px;text-align:center;margin:8px 0">Not interested in this item right now</div>
    </div>
    ${sessionRejections < 3 ? renderDropZone() : ''}
    <div style="padding:12px 24px 16px;text-align:center">
      <button id="deal-done-btn" style="${smallBtnStyle()}">${sessionRejections >= 3 ? 'Leave' : 'Try something else'}</button>
    </div>
  `;

  panel.querySelector('#deal-close').addEventListener('click', closePanel);
  panel.querySelector('#deal-done-btn').addEventListener('click', () => {
    if (sessionRejections >= 3) closePanel();
    // else they stay — can drag another item
  });
}

function renderSessionMaxReject() {
  const npc = activeNPC;
  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="font-size:20px;font-weight:bold;margin-bottom:8px">${npc.name}</div>
    </div>
    <div style="padding:0 24px 20px">
      ${renderDialogueBubble("Look, I'm not buying anything right now. Come back later.")}
      <div style="text-align:center;margin-top:16px;color:#a55;font-size:14px">
        ${npc.name} isn't interested in dealing right now.
      </div>
      <div style="text-align:center;margin-top:16px">
        <button id="session-max-close" style="${smallBtnStyle()}">Leave</button>
      </div>
    </div>
  `;
  panel.querySelector('#session-max-close').addEventListener('click', closePanel);
}

function renderReject(itemType) {
  // Legacy — now uses affinity-based rejection
  renderAffinityReject(getNPCAffinity(activeNPC.name, itemType), itemType);
}

function renderOffer(affinity) {
  const npc = activeNPC;
  const isFreshSticker = offeredItem.type === 'sticker' && offeredItem.subtype === 'fresh';
  const itemLabel = offeredItem.type === 'gacha' ? 'gacha capsule' :
    (offeredItem.type === 'sticker' ? (isFreshSticker ? 'fresh sticker' : 'old sticker') : 'plushie');
  const aff = affinity !== undefined ? affinity : getNPCAffinity(npc.name, offeredItem.type);
  const affinityIcon = getAffinityIcon(aff);
  const acceptLine = getAffinityAcceptLine(aff);

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:20px;font-weight:bold">${npc.name}</span>
        <button id="deal-close" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1">&times;</button>
      </div>
    </div>

    <div style="padding:0 24px">
      ${renderDialogueBubble(acceptLine)}

      <div style="text-align:center;margin:16px 0">
        <div style="font-size:13px;color:#888;margin-bottom:6px">Offering 1 ${itemLabel} <span style="font-size:16px" title="Affinity: ${aff}">${affinityIcon}</span></div>
        <div style="font-size:32px;font-weight:bold;color:#6f6;text-shadow:0 0 12px rgba(100,255,100,0.3)">$${currentOffer}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">Max: $${maxNPCPrice}</div>
      </div>

      <div id="deal-actions" style="display:flex;gap:10px;justify-content:center;margin:16px 0 8px">
        <button id="deal-accept" style="${actionBtnStyle('#4a7')}">Accept</button>
        <button id="deal-counter" style="${actionBtnStyle('#68c')}">Counter</button>
        <button id="deal-refuse" style="${actionBtnStyle('#a55')}">Refuse</button>
      </div>

      <div id="deal-msg" style="min-height:20px;text-align:center;font-size:13px;margin-bottom:8px"></div>
    </div>

    <div style="padding:0 24px 16px"></div>
  `;

  panel.querySelector('#deal-close').addEventListener('click', () => {
    cancelOffer();
    closePanel();
  });
  panel.querySelector('#deal-accept').addEventListener('click', acceptDeal);
  panel.querySelector('#deal-counter').addEventListener('click', showCounterUI);
  panel.querySelector('#deal-refuse').addEventListener('click', cancelOffer);
}

function showCounterUI() {
  const actionsEl = document.getElementById('deal-actions');
  if (!actionsEl) return;

  const maxCounter = Math.round(maxNPCPrice * 1.2); // allow counter above max (they'll refuse)
  let counterVal = Math.min(currentOffer + Math.round(maxNPCPrice * 0.10), maxCounter);

  actionsEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%">
      <div style="display:flex;align-items:center;gap:12px">
        <button id="counter-minus" style="${counterBtnStyle()}">-</button>
        <span id="counter-value" style="font-size:24px;font-weight:bold;color:#6cf;min-width:60px;text-align:center">$${counterVal}</span>
        <button id="counter-plus" style="${counterBtnStyle()}">+</button>
      </div>
      <div style="display:flex;gap:8px">
        <button id="counter-submit" style="${actionBtnStyle('#68c')}">Offer $${counterVal}</button>
        <button id="counter-cancel" style="${actionBtnStyle('#666')}">Cancel</button>
      </div>
    </div>
  `;

  const valEl = actionsEl.querySelector('#counter-value');
  const submitBtn = actionsEl.querySelector('#counter-submit');

  actionsEl.querySelector('#counter-minus').addEventListener('click', () => {
    counterVal = Math.max(currentOffer, counterVal - 1);
    valEl.textContent = `$${counterVal}`;
    submitBtn.textContent = `Offer $${counterVal}`;
  });

  actionsEl.querySelector('#counter-plus').addEventListener('click', () => {
    counterVal = Math.min(maxCounter, counterVal + 1);
    valEl.textContent = `$${counterVal}`;
    submitBtn.textContent = `Offer $${counterVal}`;
  });

  submitBtn.addEventListener('click', () => submitCounter(counterVal));
  actionsEl.querySelector('#counter-cancel').addEventListener('click', () => renderOffer());
}

function submitCounter(counterPrice) {
  const npc = activeNPC;
  if (!npc || !offeredItem) return;

  const msgEl = document.getElementById('deal-msg');

  // Accept if counter is within max NPC price
  if (counterPrice <= maxNPCPrice) {
    currentOffer = counterPrice;
    if (msgEl) {
      msgEl.style.color = '#6f6';
      msgEl.textContent = npcLine(npc, 'counterAcceptLines');
    }
    setTimeout(() => { if (phase === 'negotiating') acceptDeal(); }, 800);
    return;
  }

  // Between max and 150% of max — NPC meets halfway
  if (counterPrice <= maxNPCPrice * 1.5) {
    const halfway = Math.round((counterPrice + maxNPCPrice) / 2);
    currentOffer = Math.min(halfway, maxNPCPrice);
    if (msgEl) {
      msgEl.style.color = '#fa8';
      msgEl.textContent = npcLine(npc, 'counterRejectLines') + ` How about $${currentOffer}?`;
    }
    // Auto-accept the halfway price after a moment
    setTimeout(() => { if (phase === 'negotiating') acceptDeal(); }, 1200);
    return;
  }

  // Way over — NPC walks away
  if (msgEl) {
    msgEl.style.color = '#f66';
    msgEl.textContent = npcLine(npc, 'finalOfferLines');
  }
  npc.purchaseCount = npc.maxPurchases;
  setTimeout(() => {
    if (phase === 'negotiating') renderWalkAway();
  }, 1000);
}

function renderWalkAway() {
  const npc = activeNPC;
  if (!npc) return;

  phase = 'done';
  offeredItem = null;

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="font-size:20px;font-weight:bold;margin-bottom:8px">${npc.name}</div>
    </div>
    <div style="padding:0 24px 20px">
      ${renderDialogueBubble(npcLine(npc, 'partingLines'))}
      <div style="text-align:center;margin-top:16px;color:#a55;font-size:14px">
        ${npc.name} won't deal with you again right now.
      </div>
      <div style="text-align:center;margin-top:16px">
        <button id="walkaway-close" style="${smallBtnStyle()}">Leave</button>
      </div>
    </div>
  `;

  panel.querySelector('#walkaway-close').addEventListener('click', closePanel);
}

function acceptDeal() {
  if (!offeredItem || !activeNPC) return;

  const price = currentOffer;
  const itemType = offeredItem.type;
  const isGacha = itemType === 'gacha';
  const isSticker = itemType === 'sticker';

  // removeFromSlot now returns { type, contains? } for gacha items
  const removed = removeFromSlot(offeredItem.slotIndex);
  const gachaContains = isGacha && removed ? removed.contains : null;

  addMoney(price);
  activeNPC.purchaseCount++;

  // Track gacha purchases for addiction
  if (isGacha) activeNPC.gachaPurchases++;

  // Record deal for relationship tracking
  recordDeal(activeNPC.name, price);
  checkAffinityGrowth(activeNPC.name);

  flashMoney(price);
  showFloatingMoney(price);
  playDealComplete();

  // Spread color to nearby buildings (gacha treated as sticker-level spread)
  if (!isGacha) {
    spreadColor(activeNPC.worldPos, isSticker, activeNPC.name, itemType);
  } else {
    // Gacha color spread happens during reveal
    spreadColor(activeNPC.worldPos, gachaContains === 'sticker', activeNPC.name, 'gacha');
  }

  // Save after deal (pass NPC name for referral checks)
  if (onDealCallback) onDealCallback(activeNPC.name, itemType, price);

  // Notify phone system
  if (onPhoneDealCallback) onPhoneDealCallback(activeNPC.name, itemType, price);

  // Show deal-done message, then return to greeting for next deal
  const npc = activeNPC;
  const npcWorldPos = npc.worldPos ? npc.worldPos.clone() : null;
  phase = 'done';

  panel.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="font-size:20px;font-weight:bold;margin-bottom:8px">${npc.name}</div>
    </div>
    <div style="padding:0 24px 24px">
      ${renderDialogueBubble(npcLine(npc, 'dealDoneLines'))}
      <div style="text-align:center;margin-top:16px;font-size:24px;font-weight:bold;color:#6f6">+$${price}</div>
    </div>
  `;

  const savedOffer = offeredItem;
  offeredItem = null;

  // For gacha deals, trigger the reveal animation after a short delay
  if (isGacha && gachaContains) {
    setTimeout(() => {
      closePanel();
      triggerReveal(gachaContains, npc.name, npcWorldPos);
    }, 1000);
  } else {
    // Return to greeting after a moment
    setTimeout(() => {
      if (!isOpen || !activeNPC) return;
      phase = 'greeting';
      renderGreeting();
    }, 1200);
  }
}

function cancelOffer() {
  // Item returns to inventory (it was never removed)
  offeredItem = null;
  counterRound = 0;
  maxNPCPrice = 0;
  phase = 'greeting';

  if (isOpen && activeNPC) {
    renderGreeting();
  }
}

// ============================
//  UI HELPERS
// ============================

function renderDialogueBubble(text) {
  return `
    <div style="
      background:rgba(255,255,255,0.06);
      border-left:3px solid rgba(100,180,255,0.4);
      border-radius:0 8px 8px 0;
      padding:10px 14px;
      font-size:14px;
      color:#ddd;
      line-height:1.4;
      margin:8px 0;
    ">"${text}"</div>
  `;
}

function renderDropZone() {
  return `
    <div style="padding:0 24px;margin:8px 0">
      <div id="deal-drop-zone" style="
        border:2px dashed rgba(255,255,255,0.2);
        border-radius:12px;
        background:rgba(255,255,255,0.03);
        height:80px;
        display:flex;
        align-items:center;
        justify-content:center;
        transition:border-color 0.2s, background 0.2s;
      ">
        <span id="deal-drop-text" style="color:#555;font-size:14px;transition:color 0.2s">Drag item here</span>
      </div>
    </div>
  `;
}

function actionBtnStyle(color) {
  return `
    padding:8px 16px;
    border-radius:6px;
    font-family:monospace;
    font-size:13px;
    cursor:pointer;
    border:1px solid ${color};
    background:${color}22;
    color:${color};
    transition:background 0.15s;
  `;
}

function smallBtnStyle() {
  return `
    padding:6px 20px;
    border-radius:6px;
    font-family:monospace;
    font-size:13px;
    cursor:pointer;
    border:1px solid rgba(255,255,255,0.15);
    background:rgba(255,255,255,0.06);
    color:#888;
  `;
}

function counterBtnStyle() {
  return `
    width:32px;height:32px;
    border-radius:6px;
    border:1px solid rgba(100,200,255,0.3);
    background:rgba(100,200,255,0.1);
    color:#6cf;
    font-size:18px;font-weight:bold;
    cursor:pointer;
    font-family:monospace;
  `;
}
