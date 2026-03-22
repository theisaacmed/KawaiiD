// Admin / Debug panel — toggle with F2
// Provides testing controls: teleport, give items/money, time, ACE, color, progression

import { addItem, addMoney, getMoney, getSlots, clearInventory, deductMoney } from './inventory.js';
import { getGameHour, setGameHour, getDayNumber, setDayNumber, isNight, getTimePeriod } from './time-system.js';
import { getOfficers } from './ace.js';
import { getWorldColor, spreadColor, getBuildingColors } from './color-system.js';
import { getPhoneStats } from './phone.js';
import { unlockGacha, isGachaUnlocked } from './gacha.js';
import { getUnlockedDistricts, DISTRICTS } from './districts.js';
import { triggerSave } from './save-system.js';
import { checkDealMilestone, checkColorMilestone } from './progression.js';

let panel = null;
let visible = false;
let playerRef = null;
let npcsRef = null;
let performEastsideUnlockFn = null;

// God mode — ACE officers ignore you
let godMode = false;
export function isGodMode() { return godMode; }

// Noclip — fly through walls
let noclip = false;
export function isNoclip() { return noclip; }

// Speed multiplier
let speedMult = 1;
export function getSpeedMult() { return speedMult; }

export function initAdmin(player, npcs, eastsideUnlockFn) {
  playerRef = player;
  npcsRef = npcs;
  performEastsideUnlockFn = eastsideUnlockFn;

  // Expose god mode check on window for ACE detection bypass
  window.__adminGodMode = () => godMode;

  createPanel();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      togglePanel();
    }
  });
}

function togglePanel() {
  visible = !visible;
  panel.style.display = visible ? 'block' : 'none';
  if (visible) refreshStats();
}

function createPanel() {
  panel = document.createElement('div');
  panel.id = 'admin-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    width: '320px',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'rgba(0, 0, 0, 0.85)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #0f0',
    zIndex: '9999',
    display: 'none',
    pointerEvents: 'auto',
    userSelect: 'none',
  });

  // Custom scrollbar
  const style = document.createElement('style');
  style.textContent = `
    #admin-panel::-webkit-scrollbar { width: 6px; }
    #admin-panel::-webkit-scrollbar-track { background: rgba(0,255,0,0.05); }
    #admin-panel::-webkit-scrollbar-thumb { background: #0f0; border-radius: 3px; }
    #admin-panel button {
      background: #111; color: #0f0; border: 1px solid #0f0;
      padding: 4px 8px; margin: 2px; cursor: pointer; font-family: monospace;
      font-size: 11px; border-radius: 3px; transition: background 0.15s;
    }
    #admin-panel button:hover { background: #0f0; color: #000; }
    #admin-panel .section { margin-bottom: 10px; border-bottom: 1px solid #0a0; padding-bottom: 8px; }
    #admin-panel .section-title { font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #0ff; }
    #admin-panel .stat-line { color: #aaa; margin: 1px 0; }
    #admin-panel .stat-value { color: #0f0; }
    #admin-panel input[type="number"], #admin-panel input[type="range"] {
      background: #111; color: #0f0; border: 1px solid #0f0;
      padding: 2px 4px; font-family: monospace; font-size: 11px;
      width: 60px; border-radius: 3px;
    }
    #admin-panel .toggle-on { background: #0f0 !important; color: #000 !important; }
  `;
  document.head.appendChild(style);

  panel.innerHTML = buildHTML();
  document.body.appendChild(panel);

  // Wire up buttons after DOM insertion
  wireEvents();
}

function buildHTML() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:14px;font-weight:bold;color:#ff0;">ADMIN PANEL</span>
      <span style="color:#555;font-size:10px;">[F2] toggle</span>
    </div>

    <!-- STATS -->
    <div class="section" id="adm-stats">
      <div class="section-title">LIVE STATS</div>
      <div id="adm-stats-body"></div>
    </div>

    <!-- TOGGLES -->
    <div class="section">
      <div class="section-title">TOGGLES</div>
      <button id="adm-god">God Mode: OFF</button>
      <button id="adm-noclip">Noclip: OFF</button>
      <button id="adm-speed1">1x</button>
      <button id="adm-speed2">2x</button>
      <button id="adm-speed3">5x</button>
    </div>

    <!-- INVENTORY -->
    <div class="section">
      <div class="section-title">INVENTORY</div>
      <button id="adm-sticker">+ Sticker</button>
      <button id="adm-plushie">+ Plushie</button>
      <button id="adm-gacha-s">+ Gacha(S)</button>
      <button id="adm-gacha-p">+ Gacha(P)</button>
      <button id="adm-clear-inv">Clear Inv</button>
      <br>
      <button id="adm-money100">+$100</button>
      <button id="adm-money500">+$500</button>
      <button id="adm-money1k">+$1000</button>
      <button id="adm-set-money0">Set $0</button>
    </div>

    <!-- TIME -->
    <div class="section">
      <div class="section-title">TIME</div>
      <button id="adm-dawn">Dawn (6AM)</button>
      <button id="adm-noon">Noon</button>
      <button id="adm-dusk">Dusk (6PM)</button>
      <button id="adm-night">Night (10PM)</button>
      <br>
      <label>Hour: <input type="number" id="adm-hour" min="0" max="23" step="0.5" value="6"></label>
      <button id="adm-set-hour">Set</button>
      <br>
      <label>Day: <input type="number" id="adm-day" min="1" max="999" value="1"></label>
      <button id="adm-set-day">Set</button>
    </div>

    <!-- TELEPORT -->
    <div class="section">
      <div class="section-title">TELEPORT</div>
      <button id="adm-tp-spawn">Spawn</button>
      <button id="adm-tp-ruins">Ruins</button>
      <button id="adm-tp-downtown">Downtown</button>
      <button id="adm-tp-industrial">Industrial</button>
      <button id="adm-tp-gacha">Gacha Machine</button>
      <button id="adm-tp-bed">Bed</button>
      <div style="margin-top:4px;" id="adm-tp-npcs"></div>
    </div>

    <!-- WORLD -->
    <div class="section">
      <div class="section-title">WORLD</div>
      <button id="adm-color25">Color 25%</button>
      <button id="adm-color50">Color 50%</button>
      <button id="adm-color100">Color 100%</button>
      <button id="adm-unlock-gacha">Unlock Gacha</button>
      <button id="adm-unlock-east">Unlock Eastside</button>
    </div>

    <!-- ACE -->
    <div class="section">
      <div class="section-title">ACE OFFICERS</div>
      <div id="adm-ace-info"></div>
      <button id="adm-tp-away-ace">TP Officers Away</button>
    </div>

    <!-- SAVE -->
    <div class="section">
      <div class="section-title">SAVE</div>
      <button id="adm-force-save">Force Save</button>
    </div>
  `;
}

function wireEvents() {
  // Toggles
  btn('adm-god', () => {
    godMode = !godMode;
    const el = document.getElementById('adm-god');
    el.textContent = `God Mode: ${godMode ? 'ON' : 'OFF'}`;
    el.classList.toggle('toggle-on', godMode);
  });

  btn('adm-noclip', () => {
    noclip = !noclip;
    const el = document.getElementById('adm-noclip');
    el.textContent = `Noclip: ${noclip ? 'ON' : 'OFF'}`;
    el.classList.toggle('toggle-on', noclip);
  });

  btn('adm-speed1', () => { speedMult = 1; refreshStats(); });
  btn('adm-speed2', () => { speedMult = 2; refreshStats(); });
  btn('adm-speed3', () => { speedMult = 5; refreshStats(); });

  // Inventory
  btn('adm-sticker', () => { addItem('sticker'); refreshStats(); });
  btn('adm-plushie', () => { addItem('plushie'); refreshStats(); });
  btn('adm-gacha-s', () => { addItem('gacha', 'sticker'); refreshStats(); });
  btn('adm-gacha-p', () => { addItem('gacha', 'plushie'); refreshStats(); });
  btn('adm-clear-inv', () => { clearInventory(); refreshStats(); });
  btn('adm-money100', () => { addMoney(100); refreshStats(); });
  btn('adm-money500', () => { addMoney(500); refreshStats(); });
  btn('adm-money1k', () => { addMoney(1000); refreshStats(); });
  btn('adm-set-money0', () => { deductMoney(getMoney()); refreshStats(); });

  // Time
  btn('adm-dawn', () => { setGameHour(6); refreshStats(); });
  btn('adm-noon', () => { setGameHour(12); refreshStats(); });
  btn('adm-dusk', () => { setGameHour(18); refreshStats(); });
  btn('adm-night', () => { setGameHour(22); refreshStats(); });
  btn('adm-set-hour', () => {
    const v = parseFloat(document.getElementById('adm-hour').value);
    if (!isNaN(v)) { setGameHour(v); refreshStats(); }
  });
  btn('adm-set-day', () => {
    const v = parseInt(document.getElementById('adm-day').value);
    if (!isNaN(v) && v > 0) { setDayNumber(v); refreshStats(); }
  });

  // Teleport - fixed locations (new city map)
  btn('adm-tp-spawn', () => tp(0, 1.7, 20));
  btn('adm-tp-ruins', () => tp(0, 1.7, -170));
  btn('adm-tp-downtown', () => tp(20, 1.7, 120));
  btn('adm-tp-industrial', () => tp(20, 1.7, -100));
  btn('adm-tp-gacha', () => tp(14, 1.7, 12));
  btn('adm-tp-bed', () => tp(14, 1.7, 12));

  // Teleport to NPCs
  if (npcsRef) {
    const container = document.getElementById('adm-tp-npcs');
    for (const npc of npcsRef) {
      const b = document.createElement('button');
      b.textContent = `TP: ${npc.name}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        tp(npc.position.x + 2, 1.7, npc.position.z + 2);
      });
      container.appendChild(b);
    }
  }

  // World
  btn('adm-color25', () => colorAll(0.25));
  btn('adm-color50', () => colorAll(0.5));
  btn('adm-color100', () => colorAll(1.0));
  btn('adm-unlock-gacha', () => {
    unlockGacha();
    refreshStats();
  });
  btn('adm-unlock-east', () => {
    if (performEastsideUnlockFn) {
      performEastsideUnlockFn();
    }
    refreshStats();
  });

  // ACE
  btn('adm-tp-away-ace', () => {
    const officers = getOfficers();
    for (const o of officers) {
      if (o.group) {
        o.group.position.set(-80, 0, -80);
      }
    }
  });

  // Save
  btn('adm-force-save', () => triggerSave('Admin save'));

  // Auto-refresh stats
  setInterval(() => { if (visible) refreshStats(); }, 500);
}

function refreshStats() {
  const body = document.getElementById('adm-stats-body');
  if (!body || !playerRef) return;

  const p = playerRef.position;
  const slots = getSlots();
  const money = getMoney();
  const hour = getGameHour();
  const day = getDayNumber();
  const period = getTimePeriod();
  const worldCol = (getWorldColor() * 100).toFixed(1);
  const officers = getOfficers();
  const stats = getPhoneStats();
  const gachaOn = isGachaUnlocked();
  const eastOn = getUnlockedDistricts().length > 2; // more than town+ruins

  const items = slots.map(s => {
    if (s.type === 'gacha') return `gacha(${s.contains})x${s.count}`;
    return `${s.type}x${s.count}`;
  }).join(', ') || 'empty';

  const aceInfo = officers.map((o, i) =>
    `#${i}: ${o.state || '?'}`
  ).join(' | ');

  body.innerHTML = `
    <div class="stat-line">Pos: <span class="stat-value">${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}</span></div>
    <div class="stat-line">Time: <span class="stat-value">${formatHour(hour)} (${period}) Day ${day}</span></div>
    <div class="stat-line">Money: <span class="stat-value">$${money}</span></div>
    <div class="stat-line">Items: <span class="stat-value">${items}</span></div>
    <div class="stat-line">World Color: <span class="stat-value">${worldCol}%</span></div>
    <div class="stat-line">Deals: <span class="stat-value">${stats.totalDeals}</span> | Earned: <span class="stat-value">$${stats.totalEarned}</span></div>
    <div class="stat-line">Gacha: <span class="stat-value">${gachaOn ? 'UNLOCKED' : 'locked'}</span> | Eastside: <span class="stat-value">${eastOn ? 'UNLOCKED' : 'locked'}</span></div>
    <div class="stat-line">ACE: <span class="stat-value">${aceInfo}</span></div>
    <div class="stat-line">Speed: <span class="stat-value">${speedMult}x</span> | God: <span class="stat-value">${godMode ? 'ON' : 'off'}</span> | Noclip: <span class="stat-value">${noclip ? 'ON' : 'off'}</span></div>
  `;

  // Update ACE section too
  const aceEl = document.getElementById('adm-ace-info');
  if (aceEl) {
    aceEl.innerHTML = officers.map((o, i) => {
      const pos = o.group ? o.group.position : { x: 0, z: 0 };
      return `<div class="stat-line">#${i}: <span class="stat-value">${o.state || '?'}</span> at (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)})</div>`;
    }).join('');
  }
}

function tp(x, y, z) {
  if (!playerRef) return;
  playerRef.position.set(x, y, z);
  playerRef.velocity.set(0, 0, 0);
}

function colorAll(target) {
  const buildings = getBuildingColors();
  // Spread color to each building repeatedly to reach target
  for (const b of buildings) {
    const needed = target - (b.colorAmount || 0);
    if (needed > 0) {
      // Spread multiple times to get close to target
      const pos = b.mesh ? b.mesh.position : b.position;
      if (pos) {
        for (let i = 0; i < Math.ceil(needed * 10); i++) {
          spreadColor(pos, true);
        }
      }
    }
  }
  const wc = getWorldColor();
  checkColorMilestone(wc);
  refreshStats();
}

function formatHour(h) {
  const hr = Math.floor(h);
  const min = Math.floor((h - hr) * 60);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function btn(id, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handler();
    });
  }
}
