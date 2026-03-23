// Inventory state — slot-based inventory with 8-slot cap, money tracking
// Supports products (sticker, plushie, gacha) and materials (sticker_paper, fabric_roll, etc.)

import { MATERIALS } from './materials.js';

let MAX_SLOTS = 8;

// Max stack sizes per item type
const MAX_STACK = {
  sticker: Infinity,
  plushie: Infinity,
  gacha: 3,
};

// Build material stack limits from materials.js
for (const [key, mat] of Object.entries(MATERIALS)) {
  MAX_STACK['material_' + key] = mat.stackMax;
}

const state = {
  slots: [],   // Array of { type, count, subtype?, contains? }
  money: 0,
  listeners: [],
  moneyListeners: [],
};

function notify() {
  for (const fn of state.listeners) fn(state.slots);
}

function getStackKey(type, subtype) {
  if (type === 'material' && subtype) return 'material_' + subtype;
  return type;
}

function slotsMatch(slot, type, subtype) {
  if (slot.type !== type) return false;
  if (type === 'material') return slot.subtype === subtype;
  // Sticker and plushie subtypes stack separately (old vs fresh/handmade)
  if (type === 'sticker') return (slot.subtype || null) === (subtype || null);
  if (type === 'plushie') return (slot.subtype || null) === (subtype || null);
  return true;
}

// Add an item — stacks onto existing slot or fills first empty
// Returns true if added, false if inventory full
// For gacha: addItem('gacha', 'plushie') — second arg is contained item
// For materials: addItem('material', 'sticker_paper') — second arg is subtype
// For sticker/plushie: addItem('sticker', 'fresh') / addItem('plushie', 'old') — second arg is quality subtype
export function addItem(type, subtypeOrContains) {
  const isMaterial = type === 'material';
  const isSticker = type === 'sticker';
  const isPlushie = type === 'plushie';
  const subtype = (isMaterial || isSticker || isPlushie) ? subtypeOrContains : undefined;
  const contains = (!isMaterial && !isSticker && !isPlushie && type === 'gacha') ? subtypeOrContains : undefined;
  const stackKey = getStackKey(type, subtype);
  const maxStack = MAX_STACK[stackKey] || Infinity;

  // Try to stack onto an existing slot of the same type (within stack limit)
  for (const slot of state.slots) {
    if (slotsMatch(slot, type, subtype) && slot.count < maxStack) {
      slot.count++;
      notify();
      return true;
    }
  }
  // Try to create a new slot
  if (state.slots.length < MAX_SLOTS) {
    const newSlot = { type, count: 1 };
    if ((isMaterial || isSticker || isPlushie) && subtype) newSlot.subtype = subtype;
    if (type === 'gacha' && contains) newSlot.contains = contains;
    state.slots.push(newSlot);
    notify();
    return true;
  }
  return false; // inventory full
}

// Add multiple materials at once. Returns count actually added.
export function addMaterials(subtype, count) {
  let added = 0;
  for (let i = 0; i < count; i++) {
    if (addItem('material', subtype)) added++;
    else break;
  }
  return added;
}

// Remove one item of a type. Returns true if removed.
export function removeItem(type, subtype) {
  for (let i = 0; i < state.slots.length; i++) {
    if (slotsMatch(state.slots[i], type, subtype)) {
      state.slots[i].count--;
      if (state.slots[i].count <= 0) {
        state.slots.splice(i, 1);
      }
      notify();
      return true;
    }
  }
  return false;
}

// Remove one item from a specific slot index. Returns { type, subtype?, contains? } or null.
export function removeFromSlot(index) {
  if (index < 0 || index >= state.slots.length) return null;
  const slot = state.slots[index];
  const result = { type: slot.type };
  if (slot.subtype) result.subtype = slot.subtype;
  if (slot.contains) result.contains = slot.contains;
  slot.count--;
  if (slot.count <= 0) {
    state.slots.splice(index, 1);
  }
  notify();
  return result;
}

export function addMoney(amount) {
  state.money += amount;
  for (const fn of state.moneyListeners) fn(state.money);
}

export function getMoney() {
  return state.money;
}

// Returns array of slot objects (read-only snapshot)
export function getSlots() {
  return state.slots.map(s => {
    const copy = { type: s.type, count: s.count };
    if (s.subtype) copy.subtype = s.subtype;
    if (s.contains) copy.contains = s.contains;
    return copy;
  });
}

// Legacy compat — returns counts
export function getInventory() {
  let stickers = 0, plushies = 0;
  for (const s of state.slots) {
    if (s.type === 'sticker') stickers += s.count;
    else if (s.type === 'plushie') plushies += s.count;
  }
  return { stickers, plushies };
}

export function hasItem(type, subtype) {
  return state.slots.some(s => slotsMatch(s, type, subtype) && s.count > 0);
}

export function isFull() {
  return state.slots.length >= MAX_SLOTS;
}

// Returns how many more items of (type, subtype) can be added to current inventory
export function roomFor(type, subtype) {
  const stackKey = getStackKey(type, subtype);
  const maxStack = MAX_STACK[stackKey] || Infinity;
  let room = 0;
  for (const slot of state.slots) {
    if (slotsMatch(slot, type, subtype)) room += maxStack - slot.count;
  }
  const emptySlots = MAX_SLOTS - state.slots.length;
  room += emptySlots * maxStack;
  return room;
}

export function onInventoryChange(fn) {
  state.listeners.push(fn);
}

export function onMoneyChange(fn) {
  state.moneyListeners.push(fn);
}

export function getMaxSlots() {
  return MAX_SLOTS;
}

// Expand the max slot count (one-way — can't shrink below current items)
const maxSlotsListeners = [];
export function onMaxSlotsChange(fn) { maxSlotsListeners.push(fn); }

export function setMaxSlots(n) {
  if (n <= MAX_SLOTS) return;
  MAX_SLOTS = n;
  for (const fn of maxSlotsListeners) fn(MAX_SLOTS);
  notify();
}

// Clear all inventory slots (used by ACE confiscation)
export function clearInventory() {
  state.slots.length = 0;
  notify();
}

// Returns true if any plushie of any quality subtype exists
export function hasAnyPlushie() {
  return state.slots.some(s => s.type === 'plushie' && s.count > 0);
}

// Remove one plushie of any quality subtype (prefers old, then handmade, then no-subtype for saves)
export function removeAnyPlushie() {
  for (const subtype of ['old', 'handmade', undefined]) {
    const idx = state.slots.findIndex(s => s.type === 'plushie' &&
      (slot => (slot.subtype || null) === (subtype || null))(s) && s.count > 0);
    if (idx !== -1) {
      state.slots[idx].count--;
      if (state.slots[idx].count <= 0) state.slots.splice(idx, 1);
      notify();
      return true;
    }
  }
  return false;
}

// Deduct money (floor at 0)
export function deductMoney(amount) {
  state.money = Math.max(0, state.money - amount);
  for (const fn of state.moneyListeners) fn(state.money);
}

// Restore full inventory state from save data
export function restoreInventory(slots, money) {
  state.slots.length = 0;
  for (const s of slots) {
    const slot = { type: s.itemType, count: s.count };
    if (s.subtype) slot.subtype = s.subtype;
    if (s.contains) slot.contains = s.contains;
    state.slots.push(slot);
  }
  state.money = money;
  notify();
  for (const fn of state.moneyListeners) fn(state.money);
}
