// NPC system — creation, behavior, personality, dialogue, schedules
// 28 NPCs across 9 districts with social connections and referral unlocks
// NPCs move between locations throughout the day and go home at night (6 PM–6 AM)
// Probability-based dealing: affinity scores, relationship levels, mood system

import * as THREE from 'three';
import { getGameHour, isNPCActive, getDayNumber } from './time-system.js';
import { getMeiTutorialOverride } from './tutorial.js';
import { isDistrictUnlocked } from './districts.js';
import { getOfficers } from './ace.js';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';
import {
  hasRoutine, getRoutineState, getCurrentScheduleEntry, checkScheduleTransition,
  calculateRoutePath, getActivityYOffset, getWanderTarget,
  freezeForDeal, unfreezeFromDeal, resetRoutinesForNewDay,
  getRoutineSaveData, restoreRoutineState,
} from './npc-routines.js';
import { buildGraph } from './npc-pathfinding.js';
import { buildNPCModel, makeNPCLabel } from './npc-models.js';
import { animateNPCs, updateNPCLabels } from './npc-animation.js';
import { getAllBuildingBlocks } from './buildings.js';

// ========== SOCIAL / REFERRAL STATE ==========
// Tracks which NPCs have been unlocked via referral chains
const referralState = {
  // NPC unlock flags (true = unlocked and available)
  ashUnlocked: false,    // Luna 5 deals
  dexUnlocked: false,    // Luna 8 deals
  mikaUnlocked: false,   // Mei 3 deals + burbs unlocked
  doveUnlocked: false,   // 80+ total deals + all districts
  // Deal counters per NPC (for referral triggers)
  dealCounts: {},
  // Social connection flags
  meiRenCollab: false,       // Mei + Ren both dealt with → bonus sticker spread
  felixZoeClub: false,       // Felix + Zoe both dealt gacha → +30% buy freq
  kenjiZoeDiscovery: false,  // Both dealt 5+ times → discovery event
  harperIntel: false,        // Harper 5+ deals → ACE tips
  quinnHack: false,          // Quinn 5+ deals → patrol route preview
  miraSoftening: false,      // Mira 10+ deals → ACE softens in Uptown
  renCollective: false,      // Ren 10+ deals → art collective
  taroHistory: false,        // Taro 5+ deals → history phone tab
  marineLighthouse: false,   // Marina 10+ deals → lighthouse on
  soraEvent: false,          // Sora 15+ deals → color party
};

export function getReferralState() { return referralState; }
export function restoreReferralState(state) {
  if (!state) return;
  Object.assign(referralState, state);
}

// Check referral unlocks after each deal
export function checkReferrals(npcName, totalDeals) {
  if (!referralState.dealCounts[npcName]) referralState.dealCounts[npcName] = 0;
  referralState.dealCounts[npcName]++;
  const c = referralState.dealCounts;

  // Luna referrals
  if ((c['Luna'] || 0) >= 5 && !referralState.ashUnlocked) {
    referralState.ashUnlocked = true;
    return { type: 'referral', npc: 'Ash', from: 'Luna', message: "Luna mentioned a nervous kid named Ash who's interested. Be gentle with them." };
  }
  if ((c['Luna'] || 0) >= 8 && !referralState.dexUnlocked) {
    referralState.dexUnlocked = true;
    return { type: 'referral', npc: 'Dex', from: 'Luna', message: "Luna put you in touch with Dex. Bulk buyer. All business." };
  }
  // Mei referral for Mika (also needs burbs unlocked)
  if ((c['Mei'] || 0) >= 3 && !referralState.mikaUnlocked && isDistrictUnlocked('burbs')) {
    referralState.mikaUnlocked = true;
    return { type: 'referral', npc: 'Mika', from: 'Mei', message: "Mei told her art student friend Mika about you. She's in the Burbs." };
  }

  // Social connection triggers
  if ((c['Mei'] || 0) >= 3 && (c['Ren'] || 0) >= 3 && !referralState.meiRenCollab) {
    referralState.meiRenCollab = true;
    return { type: 'social', message: "Mei and Ren started collaborating. Stickers are appearing in new places." };
  }
  if ((c['Felix'] || 0) >= 3 && (c['Zoe'] || 0) >= 3 && !referralState.felixZoeClub) {
    referralState.felixZoeClub = true;
    return { type: 'social', message: "Felix and Zoe started a secret collectors club. They're buying more often." };
  }
  if ((c['Harper'] || 0) >= 5 && !referralState.harperIntel) {
    referralState.harperIntel = true;
    return { type: 'social', message: "Harper killed her exposé. She'll tip you off about ACE patrols now." };
  }
  if ((c['Quinn'] || 0) >= 5 && !referralState.quinnHack) {
    referralState.quinnHack = true;
    return { type: 'social', message: "Quinn hacked ACE patrol schedules. Check your map for route previews." };
  }
  if ((c['Ren'] || 0) >= 10 && !referralState.renCollective) {
    referralState.renCollective = true;
    return { type: 'social', message: "Ren started a secret art collective. Cute graffiti is appearing around the city." };
  }
  if ((c['Mira'] || 0) >= 10 && !referralState.miraSoftening) {
    referralState.miraSoftening = true;
    return { type: 'social', message: "Mira's husband found a sticker... and didn't remove it. ACE patrols are lighter in Uptown." };
  }
  if ((c['Taro'] || 0) >= 5 && !referralState.taroHistory) {
    referralState.taroHistory = true;
    return { type: 'social', message: "Taro's stories unlocked the History tab on your phone." };
  }
  if ((c['Marina'] || 0) >= 10 && !referralState.marineLighthouse) {
    referralState.marineLighthouse = true;
    return { type: 'social', message: "Marina turned the lighthouse on. A beacon of color shines across the port." };
  }
  if ((c['Kenji'] || 0) >= 5 && (c['Zoe'] || 0) >= 5 && !referralState.kenjiZoeDiscovery) {
    referralState.kenjiZoeDiscovery = true;
    return { type: 'social', message: "Kenji and Zoe discovered each other's secret. A father and daughter, both rebels." };
  }
  if ((c['Sora'] || 0) >= 15 && !referralState.soraEvent) {
    referralState.soraEvent = true;
    return { type: 'social', message: "Sora's invitations went out. The first color party in the city. Uptown will never be the same." };
  }

  // Dove endgame unlock
  if (totalDeals >= 80 && !referralState.doveUnlocked) {
    // Check all districts unlocked
    const allDistricts = ['downtown','burbs','northtown','industrial','uptown','tower','port','aceHQ'];
    if (allDistricts.every(d => isDistrictUnlocked(d))) {
      referralState.doveUnlocked = true;
      return { type: 'referral', npc: 'Dove', from: 'system', message: "An anonymous note slipped under your door: 'Meet me outside ACE HQ at night. — D'" };
    }
  }

  return null;
}

// Check if an NPC is available (considering referral locks)
function isNPCReferralUnlocked(name) {
  if (name === 'Ash') return referralState.ashUnlocked;
  if (name === 'Dex') return referralState.dexUnlocked;
  if (name === 'Mika') return referralState.mikaUnlocked;
  if (name === 'Dove') return referralState.doveUnlocked;
  return true; // all others unlock with their district
}

// Get color spread modifiers for specific NPCs
export function getNPCColorModifier(npcName, itemType) {
  // Ren spreads stickers to 5 buildings (wider radius)
  if (npcName === 'Ren' && itemType === 'sticker') return { radiusMult: 2.0, increment: 0.18 };
  // Luna spreads 20% wider
  if (npcName === 'Luna') return { radiusMult: 1.2, increment: null };
  // Mei's building gains color 50% faster
  if (npcName === 'Mei') return { radiusMult: 1.0, incrementMult: 1.5 };
  // Nao's café radiates to neighbors
  if (npcName === 'Nao') return { radiusMult: 1.5, increment: null };
  // Sora stockpiles — no color until event
  if (npcName === 'Sora' && !referralState.soraEvent) return { radiusMult: 0, increment: 0 };
  // Kenji — low individual impact
  if (npcName === 'Kenji') return { radiusMult: 0.5, increment: null };
  return null;
}

// ========== RELATIONSHIP & AFFINITY SYSTEM ==========

// Relationship data persists per NPC — keyed by name
const relationships = {};
// { [npcName]: { level, totalDeals, todayDeals, lastDealDay, totalSpent, spooked, spookedUntil, refusedRequests } }

// JP callback — fired when an NPC relationship reaches a new integer level
let onRelLevelUpCb = null;
export function setOnRelLevelUpCallback(fn) { onRelLevelUpCb = fn; }

export function getRelationship(npcName) {
  if (!relationships[npcName]) {
    relationships[npcName] = {
      level: 0,
      totalDeals: 0,
      todayDeals: 0,
      lastDealDay: 0,
      totalSpent: 0,
      spooked: false,
      spookedUntil: 0,
      refusedRequests: 0, // consecutive phone deal refusals
    };
  }
  return relationships[npcName];
}

export function getRelationships() { return relationships; }
export function restoreRelationships(data) {
  if (!data) return;
  Object.assign(relationships, data);
}

// Relationship level thresholds (by total deals)
function calcRelationshipLevel(totalDeals) {
  if (totalDeals >= 26) return 5;
  if (totalDeals >= 16) return 4;
  if (totalDeals >= 9) return 3;
  if (totalDeals >= 4) return 2;
  if (totalDeals >= 1) return 1;
  return 0;
}

// Record a successful deal
export function recordDeal(npcName, price) {
  const rel = getRelationship(npcName);
  const prevLevel = Math.floor(rel.level);
  rel.totalDeals++;
  rel.totalSpent += price;
  rel.lastDealDay = getDayNumber();
  rel.todayDeals++;
  rel.refusedRequests = 0; // reset on successful deal
  rel.level = calcRelationshipLevel(rel.totalDeals);
  // Fire JP callback if relationship reached a new integer level
  if (onRelLevelUpCb && Math.floor(rel.level) > prevLevel) {
    onRelLevelUpCb(npcName, Math.floor(rel.level));
  }
}

// Record a phone deal refusal
export function recordPhoneRefusal(npcName) {
  const rel = getRelationship(npcName);
  rel.refusedRequests++;
  if (rel.refusedRequests >= 3) {
    // -0.5 levels for 3 consecutive refusals
    rel.level = Math.max(0, rel.level - 0.5);
    rel.refusedRequests = 0;
  }
}

// Record NPC getting busted by ACE (devastating trust loss)
export function recordNPCBusted(npcName) {
  const rel = getRelationship(npcName);
  rel.level = Math.max(0, rel.level - 1);
  rel.spooked = true;
  rel.spookedUntil = Date.now() + 120000; // spooked for 2 minutes
}

// Reset daily deal counts (called when day changes)
export function resetDailyDeals() {
  const today = getDayNumber();
  for (const name in relationships) {
    if (relationships[name].lastDealDay !== today) {
      relationships[name].todayDeals = 0;
    }
  }
}

// Get NPC mood string
export function getNPCMood(npcName) {
  const rel = getRelationship(npcName);
  const today = getDayNumber();
  if (rel.lastDealDay !== today) rel.todayDeals = 0;

  // Check if spooked
  if (rel.spooked && Date.now() < rel.spookedUntil) return 'Spooked';

  // Check nearby ACE
  // (lightweight — done in mood display, not acceptance calc)

  if (rel.todayDeals === 0) return 'Eager';
  if (rel.todayDeals <= 2) return 'Satisfied';
  return 'Full';
}

// ========== ACCEPTANCE PROBABILITY ==========

function getNearestOfficerDist(npcWorldPos) {
  const officers = getOfficers();
  let minDist = Infinity;
  for (const o of officers) {
    const dx = o.group.position.x - npcWorldPos.x;
    const dz = o.group.position.z - npcWorldPos.z;
    minDist = Math.min(minDist, Math.sqrt(dx * dx + dz * dz));
  }
  return minDist;
}

function getAreaColorAmount(npcWorldPos) {
  const buildings = getBuildingColors();
  let totalColor = 0;
  let count = 0;
  for (const b of buildings) {
    const dx = b.x - npcWorldPos.x;
    const dz = b.z - npcWorldPos.z;
    if (Math.sqrt(dx * dx + dz * dz) <= 20) {
      totalColor += b.colorAmount;
      count++;
    }
  }
  return count > 0 ? totalColor / count : 0;
}

// Calculate acceptance chance for an offered item
export function calcAcceptanceChance(npc, itemType, sessionRejections) {
  const affinity = getNPCAffinity(npc.name, itemType);
  const rel = getRelationship(npc.name);
  const today = getDayNumber();
  if (rel.lastDealDay !== today) rel.todayDeals = 0;

  // Base chance by affinity
  let chance;
  if (affinity <= -1) chance = 0.15;
  else if (affinity === 0) chance = 0.45;
  else if (affinity === 1) chance = 0.75;
  else chance = 0.95; // affinity 2

  // Relationship bonus: +10% per level
  chance += rel.level * 0.10;

  // Eager bonus: +10% if no deals today
  if (rel.todayDeals === 0) chance += 0.10;

  // Area color bonus: +5% if colorful
  const areaColor = getAreaColorAmount(npc.worldPos);
  if (areaColor > 0.5) chance += 0.05;

  // ACE proximity penalty: -10% if officer within 30 units
  const officerDist = getNearestOfficerDist(npc.worldPos);
  if (officerDist < 30) chance -= 0.10;

  // Items bought today penalty: -5% per item
  chance -= rel.todayDeals * 0.05;

  // Spooked penalty: -15%
  if (rel.spooked && Date.now() < rel.spookedUntil) chance -= 0.15;

  // Session rejection penalty: -10% per rejection in this session
  chance -= (sessionRejections || 0) * 0.10;

  // Clamp
  return Math.max(0.05, Math.min(0.98, chance));
}

// Roll for acceptance
export function rollAcceptance(npc, itemType, sessionRejections) {
  const chance = calcAcceptanceChance(npc, itemType, sessionRejections);
  const roll = Math.random();
  return { accepted: roll < chance, chance, affinity: getNPCAffinity(npc.name, itemType) };
}

// ========== PRICE CALCULATION ==========

export function calcDealPrice(npc, itemType, itemSubtype) {
  const affinity = getNPCAffinity(npc.name, itemType);
  const rel = getRelationship(npc.name);

  // Base price — quality tier determines value
  // old sticker: $8-10, fresh sticker: $12-15
  // old plushie: $15-20, handmade plushie: $25-35
  let basePrice;
  if (itemType === 'sticker') {
    basePrice = itemSubtype === 'fresh' ? 13 : 9;
  } else if (itemType === 'plushie') {
    basePrice = itemSubtype === 'handmade' ? 30 : 17;
  } else basePrice = 22; // gacha

  // Affinity multiplier
  let affinityMult;
  if (affinity <= -1) affinityMult = 0.5;
  else if (affinity === 0) affinityMult = 0.8;
  else if (affinity === 1) affinityMult = 1.0;
  else affinityMult = 1.3; // affinity 2

  // Relationship multiplier
  const relMult = 1.0 + rel.level * 0.05;

  // Randomness: 0.85 to 1.15
  const randMult = 0.85 + Math.random() * 0.30;

  // Calculate price
  let price = basePrice * affinityMult * relMult * randMult;

  // TODO: Trait bonuses would go here if decoration bench is active

  price = Math.round(price);
  return Math.max(1, price);
}

// Generate NPC opening offer (60-80% of calculated price)
export function generateDealOffer(npc, itemType, itemSubtype) {
  const fullPrice = calcDealPrice(npc, itemType, itemSubtype);
  const offerFraction = 0.60 + Math.random() * 0.20;
  return { offer: Math.max(1, Math.round(fullPrice * offerFraction)), maxPrice: Math.round(fullPrice * 1.10) };
}

// ========== AFFINITY DATA ==========

// Default affinities per NPC (sticker, plushie, gacha)
const NPC_AFFINITIES = {
  // Town (5)
  Mei:     { sticker: 2, plushie: 1, gacha: 1 },
  Hiro:    { sticker: 0, plushie: 2, gacha: -1 },
  Luna:    { sticker: 1, plushie: 1, gacha: 1 },
  Ash:     { sticker: 1, plushie: 1, gacha: 0 },
  Dex:     { sticker: 1, plushie: 1, gacha: 0 },
  // Downtown (5)
  Ren:     { sticker: 2, plushie: -1, gacha: 0 },
  Nao:     { sticker: 1, plushie: 1, gacha: 0 },
  Felix:   { sticker: 0, plushie: 1, gacha: 2 },
  Harper:  { sticker: 1, plushie: -1, gacha: 0 },
  Marco:   { sticker: 1, plushie: 1, gacha: 0 },
  // Burbs (4)
  Mika:    { sticker: 2, plushie: 0, gacha: 0 },
  Zoe:     { sticker: -1, plushie: 0, gacha: 2 },
  Tomas:   { sticker: 1, plushie: 2, gacha: 0 },
  Sara:    { sticker: 0, plushie: 2, gacha: 1 },
  // Northtown (3)
  Jin:     { sticker: -1, plushie: 2, gacha: 1 },
  Yuna:    { sticker: 2, plushie: 0, gacha: 0 },
  Kai:     { sticker: 0, plushie: 0, gacha: -1 },
  // Industrial (3)
  Taro:    { sticker: 0, plushie: 2, gacha: 1 },
  Vex:     { sticker: 2, plushie: -1, gacha: -1 },
  Polly:   { sticker: 0, plushie: 2, gacha: 0 },
  // Uptown (3)
  Sora:    { sticker: 1, plushie: 1, gacha: 2 },
  Kenji:   { sticker: 1, plushie: 1, gacha: -1 },
  Mira:    { sticker: 0, plushie: 1, gacha: 2 },
  // Tower (2)
  Quinn:   { sticker: 1, plushie: 0, gacha: 2 },
  Dante:   { sticker: 1, plushie: 1, gacha: 0 },
  // Port (2)
  Gus:     { sticker: 0, plushie: 1, gacha: 1 },
  Marina:  { sticker: 1, plushie: 1, gacha: 1 },
  // ACE HQ (1)
  Dove:    { sticker: 0, plushie: 0, gacha: 0 },
};

// Dynamic affinity changes
const affinityOverrides = {};

export function getNPCAffinity(npcName, itemType) {
  const key = itemType === 'gacha' ? 'gacha' : itemType;
  // Check overrides first
  if (affinityOverrides[npcName] && affinityOverrides[npcName][key] !== undefined) {
    return affinityOverrides[npcName][key];
  }
  const base = NPC_AFFINITIES[npcName];
  if (!base) return 0;
  return base[key] !== undefined ? base[key] : 0;
}

export function setAffinityOverride(npcName, itemType, value) {
  if (!affinityOverrides[npcName]) affinityOverrides[npcName] = {};
  affinityOverrides[npcName][itemType] = value;
}

export function getAffinityOverrides() { return affinityOverrides; }
export function restoreAffinityOverrides(data) {
  if (!data) return;
  Object.assign(affinityOverrides, data);
}

// Check Ash's plushie affinity growth (grows to 2 after 5 deals)
export function checkAffinityGrowth(npcName) {
  if (npcName === 'Ash') {
    const rel = getRelationship(npcName);
    if (rel.totalDeals >= 5 && getNPCAffinity('Ash', 'plushie') < 2) {
      setAffinityOverride('Ash', 'plushie', 2);
    }
  }
}

// Get affinity icon for display
export function getAffinityIcon(affinity) {
  if (affinity >= 2) return '\u2764\uFE0F'; // heart
  if (affinity === 1) return '\uD83D\uDC4D'; // thumbs up
  if (affinity === 0) return '\u2014'; // dash
  return '\uD83D\uDC4E'; // thumbs down
}

// Get rejection dialogue based on affinity
export function getAffinityRejectLine(affinity) {
  if (affinity <= -1) {
    return randomFrom(["Nah, that's not really my thing.", "I'm good, thanks.", "Not interested."]);
  } else if (affinity === 0) {
    return randomFrom(["Hmm... not today.", "Maybe next time.", "I'll pass for now."]);
  } else if (affinity === 1) {
    return randomFrom(["I want to but I can't right now.", "Too risky today, ACE was just here.", "Not the right moment."]);
  } else {
    return randomFrom(["Ugh, I literally JUST bought one. Tomorrow!", "I just got one, can't right now!", "Maybe later, I went overboard already."]);
  }
}

// Get acceptance dialogue based on affinity
export function getAffinityAcceptLine(affinity) {
  if (affinity <= -1) {
    return randomFrom(["I guess I'll take it. Don't tell anyone.", "Fine. But this stays between us."]);
  } else if (affinity === 0) {
    return randomFrom(["Sure, why not.", "I'll take it.", "Alright, let's do this."]);
  } else if (affinity === 1) {
    return randomFrom(["Oh nice, I've been wanting one of these.", "Sweet, I'll take it!", "Yeah, I'm into that."]);
  } else {
    return randomFrom(["YES. Give it to me. Name your price.", "I NEED this. Take my money.", "FINALLY! I've been waiting for this!"]);
  }
}

// ========== NPC DATA — 28 NPCs across 9 districts ==========
const NPC_DATA = [
  // ===================== TOWN (5 NPCs — starting area) =====================
  {
    name: 'Mei',
    position: new THREE.Vector3(-6, 0, 9),
    wants: ['sticker', 'gacha'],
    gachaPreference: 'loves',
    personality: 'generous',
    offerRange: [0.70, 0.90],
    counterThreshold: 0.10,
    meetFactor: 0.75,
    greetings: [
      "Every sticker is a tiny rebellion.",
      "Hey! I've been looking for some stickers!",
      "I used to draw things like this for a living.",
    ],
    wantText: "I'm looking for: Stickers",
    acceptLines: [
      "Oh this is so cute! Here, take the money!",
      "Yay! I love it!",
    ],
    rejectLines: [
      "Hmm, that's not really what I'm after...",
      "It's cute but not what I need right now.",
    ],
    counterAcceptLines: [
      "Oh sure, that sounds fair to me!",
      "Okay okay, you got a deal!",
    ],
    counterRejectLines: [
      "Hmm, that's a bit much... but okay, here's my best offer.",
    ],
    finalOfferLines: [
      "That's the most I can do, sorry!",
    ],
    partingLines: [
      "Come back when you have more!",
      "See you later! Bring more cute stuff!",
    ],
    dealDoneLines: [
      "Nice doing business!",
      "You're my favorite dealer!",
    ],
    limitLine: "That's enough for now, come back later!",
    streetRefuseLines: [
      "Not right now, sorry!",
      "Maybe later?",
    ],
    messageTemplates: [
      "Hey, I heard you might have {item}? I need {qty}. Can you meet me at {location}? \u{1F495}",
      "Hiii! Do you have any {item}? Meet me at {location}! \u{1F31F}",
      "Looking for {item}! Got {qty}? I'll be at {location} \u{1F60A}",
    ],
    meetupLocations: [
      { name: 'the fountain', pos: [0, 0, 20] },
      { name: 'the north alley', pos: [-20, 0, 10] },
      { name: 'behind the shops', pos: [-30, 0, 35] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(-9, 0, 19.2) },
      { start: 10, end: 14, pos: new THREE.Vector3(-7.2, 0, 4.8) },
      { start: 14, end: 18, pos: new THREE.Vector3(-6, 0, 9) },
    ],
    homePos: new THREE.Vector3(-6, 0, 9),
    district: 'town',
  },
  {
    name: 'Hiro',
    position: new THREE.Vector3(15, 0, 18),
    wants: ['plushie'],
    gachaPreference: 'refuses',
    personality: 'tough',
    offerRange: [0.50, 0.65],
    counterThreshold: 0.05,
    meetFactor: 0.30,
    greetings: [
      "Don't make a big deal out of this.",
      "Make it quick. Got anything worthwhile?",
      "It's not for me. It's... for someone.",
    ],
    wantText: "I'm looking for: Plushies",
    acceptLines: [
      "Fine. That'll do.",
      "Acceptable. Hand it over.",
    ],
    rejectLines: [
      "I don't want that. Don't waste my time.",
      "Not interested. Got plushies or not?",
      "Gacha? That's a ripoff. I want the real thing.",
    ],
    counterAcceptLines: [
      "...Fine. But don't push your luck.",
      "Tch. Deal.",
    ],
    counterRejectLines: [
      "I know what these are worth, don't try to rip me off.",
    ],
    finalOfferLines: [
      "Take it or leave it. I'm not going higher.",
    ],
    partingLines: [
      "Don't come back empty-handed.",
      "Next time, bring better stuff.",
    ],
    dealDoneLines: [
      "Pleasure doing business.",
      "That'll work.",
    ],
    limitLine: "I've got enough. Scram.",
    streetRefuseLines: [
      "Not now. Beat it.",
      "Come back when I call you.",
    ],
    messageTemplates: [
      "Got any {item}? I'll be at {location} until later. Don't be late.",
      "Need {qty} {item}. {location}. You know the drill.",
    ],
    meetupLocations: [
      { name: 'the south alley', pos: [25, 0, 35] },
      { name: 'the east road', pos: [35, 0, 12] },
      { name: 'behind the tall building', pos: [20, 0, -8] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(15, 0, 21) },
      { start: 10, end: 14, pos: new THREE.Vector3(21, 0, 7.2) },
      { start: 14, end: 18, pos: new THREE.Vector3(15, 0, 18) },
    ],
    homePos: new THREE.Vector3(15, 0, 18),
    district: 'town',
  },
  {
    name: 'Luna',
    position: new THREE.Vector3(3, 0, 13.2),
    wants: ['sticker', 'plushie', 'gacha'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.75, 0.85],
    counterThreshold: 0.15,
    meetFactor: 0.50,
    greetings: [
      "Cuteness is self-care, and I will die on that hill.",
      "Hi! Let's find a good deal for both of us.",
      "I know someone who'd love this.",
    ],
    wantText: "I'll take anything cute",
    acceptLines: [
      "Sweet, that works for me!",
      "Deal! I'm happy with that.",
    ],
    rejectLines: [
      "Hmm, not really my thing. Got anything else?",
    ],
    counterAcceptLines: [
      "Let's find a price we're both happy with... yeah, that works!",
      "Fair enough, deal!",
    ],
    counterRejectLines: [
      "Let's meet in the middle on this one.",
    ],
    finalOfferLines: [
      "This is the best I can do. Take it or leave it.",
    ],
    partingLines: [
      "See you around!",
      "Come back anytime!",
    ],
    dealDoneLines: [
      "Nice doing business!",
      "Good trade!",
    ],
    limitLine: "That's enough for now. Come back later!",
    streetRefuseLines: [
      "Not right now, check back later.",
      "Maybe another time!",
    ],
    messageTemplates: [
      "Looking for anything cute today. Meet at {location}? Name your price \u{2728}",
      "Hey! Got any {item}? I'll be at {location}. Let's make a deal!",
      "Need {qty} {item} if you've got them. {location} works for me!",
    ],
    meetupLocations: [
      { name: 'the fountain', pos: [0, 0, 20] },
      { name: 'the west square', pos: [-22, 0, 12] },
      { name: 'the crossroads', pos: [0, 0, 38] },
    ],
    schedule: [
      { start: 6, end: 17, pos: new THREE.Vector3(3, 0, 13.2) },
      { start: 17, end: 18, pos: new THREE.Vector3(3, 0, 13.2) },
    ],
    homePos: new THREE.Vector3(3, 0, 13.2),
    district: 'town',
  },
  {
    name: 'Ash',
    position: new THREE.Vector3(-10.8, 0, 15),
    wants: ['sticker', 'plushie'],
    gachaPreference: 'curious',
    personality: 'generous',
    offerRange: [0.65, 0.80],
    counterThreshold: 0.12,
    meetFactor: 0.65,
    requiresReferral: true, // Luna 5 deals
    greetings: [
      "Is... is anyone watching?",
      "Um, hi. I heard you have things... nice things?",
      "I've never held something this soft before.",
    ],
    wantText: "I'd like stickers or plushies...",
    acceptLines: [
      "Oh wow, really? This is mine? Thank you!",
      "It's so cute... I love it!",
    ],
    rejectLines: [
      "Oh, that's not really what I was looking for...",
      "Maybe something else? Sorry...",
    ],
    counterAcceptLines: [
      "Y-yeah, that works for me!",
      "Okay! Deal!",
    ],
    counterRejectLines: [
      "That's a bit much for me... how about a little less?",
    ],
    finalOfferLines: [
      "This is all I've got, sorry...",
    ],
    partingLines: [
      "Thanks! I'll come back for more!",
      "See you soon! This is exciting!",
    ],
    dealDoneLines: [
      "My first one! This is amazing!",
      "I can't believe I actually did this!",
    ],
    limitLine: "I should probably stop for today... thanks though!",
    streetRefuseLines: [
      "Oh, not right now... I'm nervous...",
      "Maybe later? I need to work up the courage...",
    ],
    messageTemplates: [
      "Hey, um, do you have any {item}? I'll be at {location}... if that's okay?",
      "Could we meet at {location}? I'm looking for {item}...",
    ],
    meetupLocations: [
      { name: 'the quiet corner', pos: [-20, 0, 10] },
      { name: 'behind the shops', pos: [-12, 0, 8] },
      { name: 'the west alley', pos: [-35, 0, 35] },
    ],
    schedule: [
      { start: 6, end: 11, pos: new THREE.Vector3(-12, 0, 6) },
      { start: 11, end: 15, pos: new THREE.Vector3(-7.2, 0, 4.8) },
      { start: 15, end: 18, pos: new THREE.Vector3(-10.8, 0, 15) },
    ],
    homePos: new THREE.Vector3(-10.8, 0, 15),
    district: 'town',
  },
  {
    name: 'Dex',
    position: new THREE.Vector3(18, 0, 6),
    wants: ['sticker', 'plushie', 'gacha'],
    gachaPreference: 'loves',
    personality: 'tough',
    offerRange: [0.45, 0.55],
    counterThreshold: 0.05,
    meetFactor: 0.25,
    maxPurchases: 5,
    requiresReferral: true, // Luna 8 deals
    greetings: [
      "I'll take four. Here's the money. We're done.",
      "No small talk. Show me what you have.",
      "Don't ask where these are going.",
    ],
    wantText: "I buy everything. Bulk rates.",
    acceptLines: [
      "Done. Next.",
      "Works for me. Got more?",
    ],
    rejectLines: [
      "Nah. Something else.",
    ],
    counterAcceptLines: [
      "Fine, fine. Deal.",
      "Whatever, just hand it over.",
    ],
    counterRejectLines: [
      "You're dreaming. My price or nothing.",
    ],
    finalOfferLines: [
      "Take it or I walk. Simple.",
    ],
    partingLines: [
      "Same time tomorrow.",
      "Good. Keep the supply coming.",
    ],
    dealDoneLines: [
      "Quick and clean. I like it.",
      "Efficient. Let's keep going.",
    ],
    limitLine: "That's enough for today. Same time tomorrow.",
    streetRefuseLines: [
      "Not here. Too exposed.",
      "Later. I'll text you.",
    ],
    messageTemplates: [
      "Got {item}? Bring {qty} to {location}. Quick deal, no hassle.",
      "Need {item} in bulk. {location}. Don't be late.",
    ],
    meetupLocations: [
      { name: 'the east road', pos: [38, 0, 12] },
      { name: 'near the crossroads', pos: [30, 0, -10] },
      { name: 'the south block', pos: [25, 0, 38] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(22.8, 0, 7.2) },
      { start: 10, end: 14, pos: new THREE.Vector3(18, 0, -6) },
      { start: 14, end: 18, pos: new THREE.Vector3(18, 0, 6) },
    ],
    homePos: new THREE.Vector3(18, 0, 6),
    district: 'town',
  },

  // ===================== DOWNTOWN (5 NPCs — unlocks at 15 deals) =====================
  {
    name: 'Ren',
    position: new THREE.Vector3(-9, 0, 57),
    wants: ['sticker'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.55, 0.70],
    counterThreshold: 0.12,
    meetFactor: 0.50,
    maxPurchases: 5,
    greetings: [
      "Every sticker on a wall is a middle finger to ACE.",
      "They can't gray out what people feel.",
      "Art isn't a crime. Selling me stickers might be though.",
    ],
    wantText: "Stickers. As many as you've got.",
    acceptLines: [
      "Perfect. These are going up tonight.",
      "The city walls are my canvas.",
    ],
    rejectLines: [
      "I work with stickers. That's not a sticker.",
      "Nah, I need flat art. Stickers only.",
    ],
    counterAcceptLines: [
      "Fair enough. Art has its price.",
      "Deal. Every wall deserves color.",
    ],
    counterRejectLines: [
      "I buy in bulk, so I need bulk prices.",
    ],
    finalOfferLines: [
      "Art doesn't pay well. This is what I've got.",
    ],
    partingLines: [
      "Keep the stickers coming. The city needs them.",
      "I'll cover every wall in this district.",
    ],
    dealDoneLines: [
      "Another wall gets some color tonight.",
      "This whole district will be covered by next week.",
    ],
    limitLine: "That's enough for one session. Gotta go put these up.",
    streetRefuseLines: [
      "I'm mid-paste. Come back later.",
      "Not now, I'm scouting walls.",
    ],
    plainLines: [
      "This is a bit plain... but stickers are stickers.",
    ],
    messageTemplates: [
      "Need {item} for a project. {location}. Bring as many as you can.",
      "Big wall, big plans. Got {qty} {item}? Meet at {location}.",
    ],
    meetupLocations: [
      { name: 'the market alley', pos: [-8, 0, 130] },
      { name: 'behind the clock tower', pos: [12, 0, 112] },
      { name: 'the south wall', pos: [5, 0, 90] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(-9, 0, 55.2) },
      { start: 10, end: 15, pos: new THREE.Vector3(4.8, 0, 64.8) },
      { start: 15, end: 18, pos: new THREE.Vector3(-9, 0, 57) },
    ],
    homePos: new THREE.Vector3(-9, 0, 57),
    district: 'downtown',
  },
  {
    name: 'Nao',
    position: new THREE.Vector3(3, 0, 52.8),
    wants: ['sticker', 'plushie'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.75, 0.90],
    counterThreshold: 0.12,
    meetFactor: 0.55,
    greetings: [
      "Put it behind the counter where ACE won't look.",
      "A customer almost smiled today. Almost.",
      "Welcome to the café. Got anything to brighten this place?",
    ],
    wantText: "Anything to make my café less depressing.",
    acceptLines: [
      "This is going right on the counter.",
      "People are coming back. They say the café feels... different.",
    ],
    rejectLines: [
      "Hmm, not quite what the café needs.",
    ],
    counterAcceptLines: [
      "Fair price for a bit of joy. Deal.",
    ],
    counterRejectLines: [
      "My café budget is tight. Can you go lower?",
    ],
    finalOfferLines: [
      "This is what coffee money gets you.",
    ],
    partingLines: [
      "Come by the café anytime.",
      "Bring more next time. The counter looks bare.",
    ],
    dealDoneLines: [
      "The café just got a little brighter.",
      "Perfect. Behind the espresso machine it goes.",
    ],
    limitLine: "That's enough decorating for today.",
    streetRefuseLines: [
      "I'm on a coffee run. Later.",
      "The café keeps me busy. Another time.",
    ],
    messageTemplates: [
      "Need something for the café. {item}? Meet at {location}.",
      "Got {qty} {item}? The café needs brightening. {location}.",
    ],
    meetupLocations: [
      { name: 'the café back door', pos: [8, 0, 90] },
      { name: 'the market square', pos: [-5, 0, 132] },
      { name: 'near the clock tower', pos: [8, 0, 105] },
    ],
    schedule: [
      { start: 6, end: 18, pos: new THREE.Vector3(3, 0, 52.8) },
    ],
    homePos: new THREE.Vector3(3, 0, 52.8),
    district: 'downtown',
  },
  {
    name: 'Felix',
    position: new THREE.Vector3(22.8, 0, 67.2),
    wants: ['gacha', 'plushie'],
    gachaPreference: 'loves',
    personality: 'generous',
    offerRange: [0.80, 0.95],
    counterThreshold: 0.15,
    meetFactor: 0.70,
    greetings: [
      "DO YOU HAVE CAPSULES?",
      "I need to complete the set. NEED.",
      "I organized them by size. Then by color. Then by size again.",
    ],
    wantText: "Gacha capsules! And plushies!",
    acceptLines: [
      "Another one for the collection! YES!",
      "This is going on shelf B, section 3.",
    ],
    rejectLines: [
      "I only collect capsules and plushies.",
    ],
    counterAcceptLines: [
      "For a capsule? Take my money. ALL of it.",
      "Deal! I need to know what's inside!",
    ],
    counterRejectLines: [
      "Even I have limits... barely.",
    ],
    finalOfferLines: [
      "That's my collection budget for the week!",
    ],
    partingLines: [
      "Bring more capsules! I NEED the complete set!",
    ],
    dealDoneLines: [
      "My collection grows! This is the best day!",
      "I wrote a catalog entry for this one already.",
    ],
    limitLine: "I should stop... but it's so hard...",
    streetRefuseLines: [
      "I'm reorganizing my collection. Later.",
    ],
    messageTemplates: [
      "CAPSULES! Do you have {item}?? Meet at {location} PLEASE!",
      "I NEED {qty} {item}! {location}! My collection depends on it!",
    ],
    meetupLocations: [
      { name: 'the office alley', pos: [40, 0, 115] },
      { name: 'behind the shops', pos: [32, 0, 95] },
      { name: 'the east block', pos: [52, 0, 110] },
    ],
    schedule: [
      { start: 6, end: 14, pos: new THREE.Vector3(22.8, 0, 67.2) },
      { start: 14, end: 18, pos: new THREE.Vector3(25.2, 0, 64.8) },
    ],
    homePos: new THREE.Vector3(22.8, 0, 67.2),
    district: 'downtown',
  },
  {
    name: 'Harper',
    position: new THREE.Vector3(-12, 0, 66),
    wants: ['sticker'],
    gachaPreference: 'curious',
    personality: 'tough',
    offerRange: [0.50, 0.65],
    counterThreshold: 0.08,
    meetFactor: 0.35,
    greetings: [
      "I'm not buying. I'm... investigating.",
      "Okay ONE sticker. For research purposes only.",
      "Why should I pay that much for a sticker?",
    ],
    wantText: "Stickers... for research.",
    acceptLines: [
      "This is purely for my article. Purely.",
      "Fine. For... documentation purposes.",
    ],
    rejectLines: [
      "I'm only interested in stickers right now.",
    ],
    counterAcceptLines: [
      "I suppose that's fair for... evidence.",
    ],
    counterRejectLines: [
      "A journalist doesn't overpay for sources.",
    ],
    finalOfferLines: [
      "My newspaper salary only goes so far.",
    ],
    partingLines: [
      "This never happened. Got it?",
      "I killed the exposé. Your secret's safe.",
    ],
    dealDoneLines: [
      "For the record, this is research.",
      "I can't do that to people who just want to feel something.",
    ],
    limitLine: "That's enough 'research' for today.",
    streetRefuseLines: [
      "I'm working on a story. Not now.",
      "No comment.",
    ],
    messageTemplates: [
      "I have questions about {item}. Meet at {location}. Off the record.",
      "Need to see {qty} {item} for my... research. {location}.",
    ],
    meetupLocations: [
      { name: 'the newspaper office', pos: [-22, 0, 108] },
      { name: 'the café', pos: [5, 0, 90] },
      { name: 'the quiet bench', pos: [-10, 0, 130] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(-15, 0, 66) },
      { start: 12, end: 16, pos: new THREE.Vector3(3, 0, 57) },
      { start: 16, end: 18, pos: new THREE.Vector3(-12, 0, 66) },
    ],
    homePos: new THREE.Vector3(-12, 0, 66),
    district: 'downtown',
  },
  {
    name: 'Marco',
    position: new THREE.Vector3(27, 0, 52.8),
    wants: ['sticker', 'plushie'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.65, 0.78],
    counterThreshold: 0.10,
    meetFactor: 0.50,
    greetings: [
      "In the old days, my plates were beautiful. Now? Gray mush on gray clay.",
      "Bella! Come in, come in! What have you got?",
      "My restaurant needs life. You have life?",
    ],
    wantText: "Stickers for takeout bags, plushies for the entrance.",
    acceptLines: [
      "Bella! This sticker goes on every takeout bag!",
      "People will know there's still beauty in this city.",
    ],
    rejectLines: [
      "Hmm, my restaurant needs stickers or plushies...",
    ],
    counterAcceptLines: [
      "For beauty? Of course! Deal!",
    ],
    counterRejectLines: [
      "*gasps dramatically* That price! Madonna!",
    ],
    finalOfferLines: [
      "This is what a chef can afford. Take it with love.",
    ],
    partingLines: [
      "Come by the restaurant! I'll make you something special.",
    ],
    dealDoneLines: [
      "The takeout bags will be beautiful!",
      "My customers will love this.",
    ],
    limitLine: "That's enough for the restaurant this week.",
    streetRefuseLines: [
      "I'm between services. Come during hours!",
    ],
    messageTemplates: [
      "Ciao! Need {item} for the restaurant. {location}?",
      "Got {qty} {item}? Meet me at {location}. I'll bring espresso!",
    ],
    meetupLocations: [
      { name: 'the restaurant back', pos: [48, 0, 90] },
      { name: 'the market', pos: [-5, 0, 132] },
      { name: 'the south entrance', pos: [45, 0, 85] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(27, 0, 54) },
      { start: 10, end: 18, pos: new THREE.Vector3(27, 0, 52.8) },
    ],
    homePos: new THREE.Vector3(27, 0, 52.8),
    district: 'downtown',
  },

  // ===================== BURBS (4 NPCs — unlocks at 20 deals) =====================
  {
    name: 'Mika',
    position: new THREE.Vector3(84, 0, -9),
    wants: ['sticker'],
    gachaPreference: 'curious',
    personality: 'generous',
    offerRange: [0.55, 0.70],
    counterThreshold: 0.12,
    meetFactor: 0.70,
    requiresReferral: true, // Mei 3 deals + burbs
    greetings: [
      "Mei told me about you! Can I really see them?",
      "Stickers stickers stickers! Please tell me you have some!",
      "I'm going to design my own someday.",
    ],
    wantText: "I need stickers for art!",
    acceptLines: [
      "Perfect for my collage! Thanks!",
      "I put one on my sketchbook and I can't stop smiling.",
    ],
    rejectLines: [
      "I really only need stickers right now...",
    ],
    counterAcceptLines: [
      "Sure! Art supplies are worth it!",
    ],
    counterRejectLines: [
      "I'm on a student budget... can you go lower?",
    ],
    finalOfferLines: [
      "This is literally all my allowance...",
    ],
    partingLines: [
      "I'll need more soon! My art eats stickers!",
    ],
    dealDoneLines: [
      "These are going to look amazing!",
      "My mural is going to be SO cool!",
    ],
    limitLine: "I've used up my budget for today!",
    streetRefuseLines: [
      "Oh, not right now, I'm sketching!",
    ],
    plainLines: [
      "No decorations? That's okay, I'll add my own flair!",
    ],
    messageTemplates: [
      "Need {item} for my art project! Meet at {location}? Pretty please!",
      "Art emergency! Need {item} ASAP! {location}!",
    ],
    meetupLocations: [
      { name: 'the park bench', pos: [125, 0, 5] },
      { name: 'near the playground', pos: [130, 0, -18] },
      { name: 'the quiet street', pos: [155, 0, -38] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(75, 0, 3) },
      { start: 10, end: 15, pos: new THREE.Vector3(93, 0, -12) },
      { start: 15, end: 18, pos: new THREE.Vector3(84, 0, -9) },
    ],
    homePos: new THREE.Vector3(84, 0, -9),
    district: 'burbs',
  },
  {
    name: 'Zoe',
    position: new THREE.Vector3(94.8, 0, -12),
    wants: ['gacha'],
    gachaPreference: 'loves',
    personality: 'fair',
    offerRange: [0.65, 0.80],
    counterThreshold: 0.10,
    meetFactor: 0.50,
    nightOnly: false,
    afterHour: 15, // only available after 3PM (school)
    greetings: [
      "OMG do you have capsules?? PLEASE say yes!",
      "Gacha gacha gacha! I NEED one!",
      "WHAT'S INSIDE??",
    ],
    wantText: "CAPSULES! I need capsules!",
    acceptLines: [
      "YESSS! Gimme gimme gimme!",
      "Another one for the collection! LETS GO!",
    ],
    rejectLines: [
      "Ugh, I only want capsules...",
      "That's cute but it's not a capsule...",
    ],
    counterAcceptLines: [
      "Fine fine fine, just give me the capsule!",
    ],
    counterRejectLines: [
      "I'm saving my allowance for MORE capsules, not higher prices!",
    ],
    finalOfferLines: [
      "That's all my capsule fund! Please!",
    ],
    partingLines: [
      "Get more capsules!! I'll buy ALL of them!",
    ],
    dealDoneLines: [
      "ANOTHER ONE! I can't stop!",
      "I wonder what's inside... THE SUSPENSE!",
    ],
    limitLine: "Mom said I have to stop buying capsules today...",
    streetRefuseLines: [
      "Do you have capsules? No? Then go away!",
    ],
    plainLines: [
      "No decorations on the capsule? Whatever, OPEN IT!",
    ],
    messageTemplates: [
      "CAPSULES! Do you have {item}?? Meet at {location} PLEASE!",
      "I NEED {qty} {item}! {location}! HURRY!",
    ],
    meetupLocations: [
      { name: 'the park', pos: [125, 0, 5] },
      { name: 'behind the houses', pos: [160, 0, -35] },
      { name: 'the north street', pos: [140, 0, 2] },
    ],
    schedule: [
      { start: 15, end: 18, pos: new THREE.Vector3(94.8, 0, -12) },
    ],
    homePos: new THREE.Vector3(94.8, 0, -12),
    district: 'burbs',
  },
  {
    name: 'Tomas',
    position: new THREE.Vector3(73.2, 0, -10.8),
    wants: ['plushie', 'sticker'],
    gachaPreference: 'curious',
    personality: 'generous',
    offerRange: [0.80, 0.95],
    counterThreshold: 0.18,
    meetFactor: 0.80,
    greetings: [
      "We used to have a reading corner with stuffed animals. The children loved it.",
      "Hello there. Do you have anything to warm an old heart?",
      "You're doing something important. Don't let them stop you.",
    ],
    wantText: "Plushies and stickers... they remind me of the old classroom.",
    acceptLines: [
      "Wonderful. Reminds me of the old days...",
      "I keep these in a box under my bed. Sometimes I just open it and look.",
    ],
    rejectLines: [
      "That's nice, but I'm after plushies or stickers.",
    ],
    counterAcceptLines: [
      "Of course, that's a fair price for something this lovely.",
    ],
    counterRejectLines: [
      "Oh my, that's a bit steep for a retired teacher...",
    ],
    finalOfferLines: [
      "I'm on a pension, dear. This is my best.",
    ],
    partingLines: [
      "Thank you, young one. Come visit again.",
    ],
    dealDoneLines: [
      "Reminds me of the old days... thank you.",
      "You've made an old man very happy.",
    ],
    limitLine: "That's enough shopping for these old bones today.",
    streetRefuseLines: [
      "Not right now, dear. I'm resting.",
    ],
    messageTemplates: [
      "Hello dear, would you bring {qty} {item} to {location}? I'll pay well.",
      "Could you visit {location}? I'm looking for {item}.",
    ],
    meetupLocations: [
      { name: 'the park bench', pos: [125, 0, 5] },
      { name: 'the quiet street', pos: [130, 0, -25] },
      { name: 'near the playground', pos: [125, 0, -10] },
    ],
    schedule: [
      { start: 6, end: 11, pos: new THREE.Vector3(75, 0, -6) },
      { start: 11, end: 16, pos: new THREE.Vector3(78, 0, 3) },
      { start: 16, end: 18, pos: new THREE.Vector3(73.2, 0, -10.8) },
    ],
    homePos: new THREE.Vector3(73.2, 0, -10.8),
    district: 'burbs',
  },
  {
    name: 'Sara',
    position: new THREE.Vector3(105, 0, -25.2),
    wants: ['plushie', 'sticker', 'gacha'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.75, 0.90],
    counterThreshold: 0.12,
    meetFactor: 0.55,
    greetings: [
      "She's never hugged a stuffed animal. Four years old and she's never hugged one.",
      "Please tell me you have plushies. Please.",
      "She calls it her 'secret friend.'",
    ],
    wantText: "Plushies for my daughter. Anything cute.",
    acceptLines: [
      "She's going to love this. Thank you so much.",
      "She sleeps with it every night.",
    ],
    rejectLines: [
      "I need something for my little girl...",
    ],
    counterAcceptLines: [
      "For her? Of course. Deal.",
    ],
    counterRejectLines: [
      "I'm spending my grocery money on this... please, lower?",
    ],
    finalOfferLines: [
      "This is everything I have this week.",
    ],
    partingLines: [
      "Thank you. You don't know what this means.",
    ],
    dealDoneLines: [
      "She drew a picture today. With COLOR.",
      "You're giving my daughter a childhood.",
    ],
    limitLine: "I should save some money for groceries...",
    streetRefuseLines: [
      "Not in front of the neighbors, please.",
      "My daughter's watching. Later.",
    ],
    messageTemplates: [
      "Do you have {item}? My daughter would love it. Meet at {location}?",
      "Need {qty} {item} for my little girl. {location}. Please.",
    ],
    meetupLocations: [
      { name: 'the quiet backyard', pos: [178, 0, -45] },
      { name: 'the park', pos: [125, 0, 5] },
      { name: 'behind the nice house', pos: [180, 0, -30] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(93, 0, -22.8) },
      { start: 10, end: 15, pos: new THREE.Vector3(75, 0, 3) },
      { start: 15, end: 18, pos: new THREE.Vector3(105, 0, -25.2) },
    ],
    homePos: new THREE.Vector3(105, 0, -25.2),
    district: 'burbs',
  },

  // ===================== NORTHTOWN (3 NPCs — unlocks at 25 deals) =====================
  {
    name: 'Jin',
    position: new THREE.Vector3(78, 0, 91.2),
    wants: ['plushie', 'gacha'],
    gachaPreference: 'curious',
    personality: 'tough',
    offerRange: [0.70, 0.90],
    counterThreshold: 0.08,
    meetFactor: 0.35,
    picky: true,
    greetings: [
      "Is this the best you have? I don't collect mediocre.",
      "I collect plushies. If it's quality, I'll pay well.",
      "Acceptable. I suppose this will do.",
    ],
    wantText: "I only collect premium plushies and capsules.",
    acceptLines: [
      "Acceptable quality. I'll take it.",
      "This will fit nicely in my collection.",
    ],
    rejectLines: [
      "I don't collect that. Plushies or capsules only.",
      "What is this? I said quality items.",
    ],
    counterAcceptLines: [
      "...Fine. For a piece of this quality.",
    ],
    counterRejectLines: [
      "You overvalue your stock. My offer stands.",
    ],
    finalOfferLines: [
      "Final price. I don't negotiate twice.",
    ],
    partingLines: [
      "Bring better stock next time.",
    ],
    dealDoneLines: [
      "A fine addition to my collection.",
      "I have a room. A whole room. Do you want to see it? ...No. No one can see it.",
    ],
    limitLine: "My shelves are full for today.",
    streetRefuseLines: [
      "Appointment only.",
    ],
    plainLines: [
      "This is a bit plain... but the craftsmanship is acceptable.",
    ],
    messageTemplates: [
      "I'm looking for premium {item}. Meet at {location}. Don't bring junk.",
      "Bring your best {item} to {location}. I pay well for quality.",
    ],
    meetupLocations: [
      { name: 'the chapel square', pos: [130, 0, 138] },
      { name: 'the north walk', pos: [140, 0, 155] },
      { name: 'the quiet corner', pos: [108, 0, 148] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(70.8, 0, 81) },
      { start: 10, end: 14, pos: new THREE.Vector3(3, 0, 54) },  // visits Nao's café
      { start: 14, end: 18, pos: new THREE.Vector3(78, 0, 91.2) },
    ],
    homePos: new THREE.Vector3(78, 0, 91.2),
    district: 'northtown',
  },
  {
    name: 'Yuna',
    position: new THREE.Vector3(93, 0, 99),
    wants: ['sticker'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.68, 0.82],
    counterThreshold: 0.12,
    meetFactor: 0.50,
    greetings: [
      "Color is just light that learned to stay.",
      "I have one orchid in the back. Purple. Sometimes I just stare at it and cry.",
      "You're like a pollinator. Spreading beauty from place to place.",
    ],
    wantText: "Stickers. Anything colorful.",
    acceptLines: [
      "Beautiful. I'll hide it in the bouquets.",
      "Color finds a way.",
    ],
    rejectLines: [
      "I need something colorful... stickers, please.",
    ],
    counterAcceptLines: [
      "For beauty? A fair price.",
    ],
    counterRejectLines: [
      "My flower shop doesn't pay much...",
    ],
    finalOfferLines: [
      "This is what the florist life affords.",
    ],
    partingLines: [
      "Come see the orchid sometime.",
    ],
    dealDoneLines: [
      "Another petal of color in this gray city.",
    ],
    limitLine: "I should save some for the greenhouse.",
    streetRefuseLines: [
      "I'm tending the plants. Later.",
    ],
    messageTemplates: [
      "I need {item} for the shop. Meet at {location}?",
      "Got {qty} {item}? The flowers need company. {location}.",
    ],
    meetupLocations: [
      { name: 'the flower shop', pos: [155, 0, 168] },
      { name: 'the coastal walk', pos: [140, 0, 175] },
      { name: 'near the chapel', pos: [130, 0, 138] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(93, 0, 99) },
      { start: 12, end: 13, pos: new THREE.Vector3(93, 0, 102) },
      { start: 13, end: 18, pos: new THREE.Vector3(93, 0, 99) },
    ],
    homePos: new THREE.Vector3(93, 0, 99),
    district: 'northtown',
  },
  {
    name: 'Kai',
    position: new THREE.Vector3(66, 0, 103.2),
    wants: ['sticker', 'plushie'],
    gachaPreference: 'refuses',
    personality: 'tough',
    offerRange: [0.55, 0.70],
    counterThreshold: 0.06,
    meetFactor: 0.30,
    greetings: [
      "Something for the boat.",
      "Fish don't care about the law.",
      "Yeah?",
    ],
    wantText: "Stickers or small plushies.",
    acceptLines: [
      "Thanks.",
      "This'll do.",
    ],
    rejectLines: [
      "Not that.",
    ],
    counterAcceptLines: [
      "Fine.",
    ],
    counterRejectLines: [
      "Nah.",
    ],
    finalOfferLines: [
      "Take it or leave it.",
    ],
    partingLines: [
      ".",
    ],
    dealDoneLines: [
      "Thanks.",
    ],
    limitLine: "That's enough.",
    streetRefuseLines: [
      "Busy.",
    ],
    messageTemplates: [
      "Got {item}? {location}.",
      "Need {qty} {item}. {location}. Quick.",
    ],
    meetupLocations: [
      { name: 'the dock', pos: [110, 0, 175] },
      { name: 'the coast path', pos: [125, 0, 172] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(66, 0, 105) },
      { start: 12, end: 16, pos: new THREE.Vector3(60, 0, 90) },
      { start: 16, end: 18, pos: new THREE.Vector3(66, 0, 103.2) },
    ],
    homePos: new THREE.Vector3(66, 0, 103.2),
    district: 'northtown',
  },

  // ===================== INDUSTRIAL (3 NPCs — unlocks at 30 deals) =====================
  {
    name: 'Taro',
    position: new THREE.Vector3(-3, 0, -52.8),
    wants: ['plushie', 'gacha'],
    gachaPreference: 'loves',
    personality: 'generous',
    offerRange: [0.80, 0.95],
    counterThreshold: 0.15,
    meetFactor: 0.80,
    greetings: [
      "This factory used to make teddy bears. I made 10,000 of them. Then ACE came.",
      "Ah, young one. Come, come. Show me what you've brought today.",
      "The machines are still in the basement. Still work, probably.",
    ],
    wantText: "Plushies and capsules... they remind me of the old days.",
    acceptLines: [
      "Wonderful. Reminds me of the old days...",
      "Ah, this takes me back. Beautiful.",
    ],
    rejectLines: [
      "That's nice, but I'm after plushies or capsules.",
    ],
    counterAcceptLines: [
      "Of course, that's a fair price for something this lovely.",
    ],
    counterRejectLines: [
      "Perhaps we can find a gentler price?",
    ],
    finalOfferLines: [
      "I'm on a pension, dear. This is my best.",
    ],
    partingLines: [
      "Thank you, young one. Come visit again.",
    ],
    dealDoneLines: [
      "Reminds me of the old days... thank you.",
      "You've made an old man very happy.",
    ],
    limitLine: "That's enough shopping for these old bones today.",
    streetRefuseLines: [
      "Not right now, dear. I'm on shift.",
    ],
    plainLines: [
      "No frills? That's okay. Beauty is in simplicity.",
    ],
    messageTemplates: [
      "Hello dear, would you bring {qty} {item} to {location}?",
      "An old man would like some {item}. Meet me at {location}?",
    ],
    meetupLocations: [
      { name: 'the factory break room', pos: [-5, 0, -85] },
      { name: 'the loading dock', pos: [15, 0, -88] },
      { name: 'the south warehouse', pos: [-15, 0, -110] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(-3, 0, -51) },
      { start: 12, end: 15, pos: new THREE.Vector3(-9, 0, -66) },
      { start: 15, end: 18, pos: new THREE.Vector3(-3, 0, -52.8) },
    ],
    homePos: new THREE.Vector3(-3, 0, -52.8),
    district: 'industrial',
  },
  {
    name: 'Vex',
    position: new THREE.Vector3(21, 0, -52.8),
    wants: ['sticker'],
    gachaPreference: 'refuses',
    personality: 'fair',
    offerRange: [0.50, 0.65],
    counterThreshold: 0.10,
    meetFactor: 0.45,
    maxPurchases: 5,
    greetings: [
      "ACE can eat my entire—",
      "I don't even LIKE plushies. I just like that they HATE plushies.",
      "I stuck thirty stickers on the ACE poster last night. Best night of my life.",
    ],
    wantText: "Stickers. For the cause.",
    acceptLines: [
      "These are going on every ACE sign in the district.",
      "Revolution in sticker form. Love it.",
    ],
    rejectLines: [
      "I need stickers. For... strategic placement.",
    ],
    counterAcceptLines: [
      "Yeah alright, whatever. GIVE ME THE STICKERS.",
    ],
    counterRejectLines: [
      "The revolution doesn't have a big budget.",
    ],
    finalOfferLines: [
      "I spend all my money on the cause. This is it.",
    ],
    partingLines: [
      "The walls of this city will be COVERED.",
    ],
    dealDoneLines: [
      "Tonight, every ACE poster gets a makeover.",
      "Freedom comes in sticker form.",
    ],
    limitLine: "That's enough ammo for tonight's operation.",
    streetRefuseLines: [
      "Not now, planning something big.",
    ],
    messageTemplates: [
      "Need {item} for an operation. {location}. Come alone.",
      "Got {qty} {item}? {location}. The revolution needs you.",
    ],
    meetupLocations: [
      { name: 'the loading dock', pos: [35, 0, -90] },
      { name: 'behind the warehouse', pos: [55, 0, -85] },
      { name: 'the south fence', pos: [10, 0, -130] },
    ],
    schedule: [
      { start: 6, end: 14, pos: new THREE.Vector3(21, 0, -54) },
      { start: 14, end: 18, pos: new THREE.Vector3(33, 0, -64.8) },
    ],
    homePos: new THREE.Vector3(21, 0, -52.8),
    district: 'industrial',
  },
  {
    name: 'Polly',
    position: new THREE.Vector3(-3, 0, -67.2),
    wants: ['plushie'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.70, 0.82],
    counterThreshold: 0.10,
    meetFactor: 0.50,
    greetings: [
      "...",
      "I found something in the machine. A glass eye. From a bear. I carry it everywhere.",
      "Do you have... plushies?",
    ],
    wantText: "Plushies. Please.",
    acceptLines: [
      "...*takes it silently, eyes glistening*",
      "I have a whole family now. On my shelf. I named them all.",
    ],
    rejectLines: [
      "I only need plushies...",
    ],
    counterAcceptLines: [
      "*nods quickly, hands over money*",
    ],
    counterRejectLines: [
      "Factory wages... can you go lower?",
    ],
    finalOfferLines: [
      "This is my lunch money for the week.",
    ],
    partingLines: [
      "*hurries away before anyone sees*",
    ],
    dealDoneLines: [
      "Thank you. You don't know what this means.",
    ],
    limitLine: "I should get back to the line...",
    streetRefuseLines: [
      "Not during shift. Lunch break only.",
    ],
    messageTemplates: [
      "Do you have {item}? Meet at {location} during lunch?",
      "I need {qty} {item}. {location}. Please be discreet.",
    ],
    meetupLocations: [
      { name: 'the break room', pos: [-5, 0, -108] },
      { name: 'behind the factory', pos: [-10, 0, -115] },
    ],
    schedule: [
      { start: 6, end: 11, pos: new THREE.Vector3(-3, 0, -57) },
      { start: 11, end: 13, pos: new THREE.Vector3(-3, 0, -67.2) },
      { start: 13, end: 18, pos: new THREE.Vector3(-3, 0, -57) },
    ],
    homePos: new THREE.Vector3(-3, 0, -67.2),
    district: 'industrial',
  },

  // ===================== UPTOWN (3 NPCs — unlocks at 35 deals) =====================
  {
    name: 'Sora',
    position: new THREE.Vector3(103.2, 0, 45),
    wants: ['sticker', 'plushie', 'gacha'],
    gachaPreference: 'loves',
    personality: 'generous',
    offerRange: [0.85, 1.00],
    counterThreshold: 0.15,
    meetFactor: 0.70,
    maxPurchases: 5,
    greetings: [
      "Darling, I'm planning something spectacular.",
      "I need forty stickers, twelve plushies, and as many capsules as you can carry.",
      "Something ACE will NEVER forget.",
    ],
    wantText: "EVERYTHING. I'm stockpiling for the event.",
    acceptLines: [
      "Perfect! Into the vault it goes!",
      "The event is going to be MAGNIFICENT.",
    ],
    rejectLines: [
      "Darling, I'll take literally anything cute.",
    ],
    counterAcceptLines: [
      "Money is no object. Time is. Deal.",
    ],
    counterRejectLines: [
      "Even I have a budget, darling. Barely.",
    ],
    finalOfferLines: [
      "This is what the event fund allows.",
    ],
    partingLines: [
      "Keep bringing supplies. The event draws near.",
    ],
    dealDoneLines: [
      "The collection grows. The event WILL happen.",
      "Darling, you're making history.",
    ],
    limitLine: "The storage unit is full. Come back tomorrow.",
    streetRefuseLines: [
      "Not in public, darling. I have a reputation.",
    ],
    messageTemplates: [
      "Darling! I need {item}! {location}, posthaste!",
      "The event requires {qty} {item}. {location}. Don't keep me waiting.",
    ],
    meetupLocations: [
      { name: 'behind the hotel', pos: [185, 0, 60] },
      { name: 'the rooftop garden area', pos: [172, 0, 78] },
      { name: 'the uptown alley', pos: [158, 0, 80] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(100.8, 0, 33) },
      { start: 12, end: 16, pos: new THREE.Vector3(94.8, 0, 46.8) },
      { start: 16, end: 18, pos: new THREE.Vector3(103.2, 0, 45) },
    ],
    homePos: new THREE.Vector3(103.2, 0, 45),
    district: 'uptown',
  },
  {
    name: 'Kenji',
    position: new THREE.Vector3(100.8, 0, 33),
    wants: ['sticker', 'plushie'],
    gachaPreference: 'refuses',
    personality: 'fair',
    offerRange: [0.80, 0.95],
    counterThreshold: 0.12,
    meetFactor: 0.55,
    greetings: [
      "I need something for my desk. Something... non-standard.",
      "If anyone finds out about this, I will deny everything.",
      "Consider the premium a... confidentiality fee.",
    ],
    wantText: "Small items only. Discretion is key.",
    acceptLines: [
      "This goes in the drawer. No one will know.",
      "I moved the sticker from inside my drawer to the outside. It's the bravest thing I've ever done.",
    ],
    rejectLines: [
      "Too large. I need something I can hide.",
    ],
    counterAcceptLines: [
      "The premium covers discretion. Deal.",
    ],
    counterRejectLines: [
      "I'll pay well, but not that well.",
    ],
    finalOfferLines: [
      "This is generous. Don't push it.",
    ],
    partingLines: [
      "This conversation never happened.",
    ],
    dealDoneLines: [
      "Excellent. My office is slightly less soul-crushing.",
    ],
    limitLine: "One item is risky enough for today.",
    streetRefuseLines: [
      "Not here. I could be recognized.",
    ],
    messageTemplates: [
      "Need {item}. {location}. Lunch hour only. Be discreet.",
      "Confidential request: {qty} {item}. {location}.",
    ],
    meetupLocations: [
      { name: 'the parking garage', pos: [165, 0, 52] },
      { name: 'behind the hotel', pos: [185, 0, 60] },
    ],
    schedule: [
      { start: 6, end: 11, pos: new THREE.Vector3(100.8, 0, 34.8) },
      { start: 11, end: 13, pos: new THREE.Vector3(100.8, 0, 33) },
      { start: 13, end: 18, pos: new THREE.Vector3(100.8, 0, 34.8) },
    ],
    homePos: new THREE.Vector3(100.8, 0, 33),
    district: 'uptown',
  },
  {
    name: 'Mira',
    position: new THREE.Vector3(117, 0, 33),
    wants: ['plushie', 'gacha'],
    gachaPreference: 'loves',
    personality: 'generous',
    offerRange: [0.85, 1.00],
    counterThreshold: 0.15,
    meetFactor: 0.70,
    greetings: [
      "My husband would arrest you. And then arrest me.",
      "I hide them where he'll never look — behind the ironing board.",
      "The thrill of this is... intoxicating.",
    ],
    wantText: "Plushies and capsules. The more forbidden, the better.",
    acceptLines: [
      "Into the closet it goes. Behind the winter coats.",
      "He found one. A sticker on the fridge. He stared at it... and didn't remove it.",
    ],
    rejectLines: [
      "I need plushies or capsules...",
    ],
    counterAcceptLines: [
      "Money isn't the issue. Discovery is. Deal.",
    ],
    counterRejectLines: [
      "Even unlimited money has limits, apparently.",
    ],
    finalOfferLines: [
      "This is already more than I should spend.",
    ],
    partingLines: [
      "*whispers* Thank you. Same time next week?",
    ],
    dealDoneLines: [
      "The thrill! I feel alive!",
      "My secret collection grows.",
    ],
    limitLine: "I need to get home before he does.",
    streetRefuseLines: [
      "*whispers* Not here. Too dangerous.",
    ],
    messageTemplates: [
      "Need {item}. Meet at {location}. Come alone. Delete this message.",
      "Urgent: {qty} {item}. {location} at dusk.",
    ],
    meetupLocations: [
      { name: 'under the awning', pos: [198, 0, 58] },
      { name: 'the garden path', pos: [200, 0, 75] },
    ],
    schedule: [
      { start: 6, end: 10, pos: new THREE.Vector3(112.8, 0, 46.8) },
      { start: 10, end: 15, pos: new THREE.Vector3(117, 0, 34.8) },
      { start: 15, end: 18, pos: new THREE.Vector3(117, 0, 33) },
    ],
    homePos: new THREE.Vector3(117, 0, 33),
    district: 'uptown',
  },

  // ===================== TOWER (2 NPCs — unlocks at 40 deals) =====================
  {
    name: 'Quinn',
    position: new THREE.Vector3(-81, 0, 78),
    wants: ['gacha', 'sticker'],
    gachaPreference: 'loves',
    personality: 'fair',
    offerRange: [0.70, 0.85],
    counterThreshold: 0.10,
    meetFactor: 0.50,
    nightOnly: true,
    greetings: [
      "The expected value of a gacha capsule given the probability distribution is...",
      "Sorry. I mean. It's nice. I want it.",
      "I wrote a program to catalog my collection.",
    ],
    wantText: "Gacha capsules and stickers for my monitors.",
    acceptLines: [
      "Optimal transaction. Adding to database.",
      "The algorithm approves this purchase.",
    ],
    rejectLines: [
      "Not in my collection parameters.",
    ],
    counterAcceptLines: [
      "Fair market value confirmed. Deal.",
    ],
    counterRejectLines: [
      "My spreadsheet says that's above market rate.",
    ],
    finalOfferLines: [
      "This is the calculated maximum.",
    ],
    partingLines: [
      "*closes door immediately*",
    ],
    dealDoneLines: [
      "Collection.add(item). Saved.",
      "Running catalog update...",
    ],
    limitLine: "Storage capacity reached. Defragmenting.",
    streetRefuseLines: [
      "It's daytime. I don't do daytime.",
    ],
    messageTemplates: [
      "Request: {item} x{qty}. Location: {location}. Time: after dark.",
      "Need {item}. Coordinates: {location}. Night only.",
    ],
    meetupLocations: [
      { name: 'the tower lobby', pos: [-135, 0, 128] },
      { name: 'the service alley', pos: [-135, 0, 133] },
    ],
    schedule: [
      // Quinn only available at night — empty day schedule
    ],
    homePos: new THREE.Vector3(-81, 0, 78),
    district: 'tower',
  },
  {
    name: 'Dante',
    position: new THREE.Vector3(-91.2, 0, 60),
    wants: ['plushie', 'sticker'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.75, 0.88],
    counterThreshold: 0.12,
    meetFactor: 0.55,
    greetings: [
      "Floor 12 break room. Behind the coffee machine. Nobody will look there.",
      "That's seven floors with hidden plushies. Only twenty-three to go.",
      "Someone found the one on Floor 8. They took a photo and emailed it to the whole building.",
    ],
    wantText: "Plushies and stickers for the building.",
    acceptLines: [
      "Floor 15 just got its first plushie.",
      "Nobody reported it. That's progress.",
    ],
    rejectLines: [
      "I need something I can hide in the building.",
    ],
    counterAcceptLines: [
      "For the building? Worth every penny.",
    ],
    counterRejectLines: [
      "Building manager salary, you know?",
    ],
    finalOfferLines: [
      "This is what maintenance budget allows.",
    ],
    partingLines: [
      "I'll text you which floor needs one next.",
    ],
    dealDoneLines: [
      "Another floor brightened. The towers are coming alive.",
    ],
    limitLine: "That's enough for this round of floors.",
    streetRefuseLines: [
      "I'm doing rounds. Come to the lobby.",
    ],
    messageTemplates: [
      "Floor {qty} needs {item}. Meet at {location}.",
      "Got {item}? {location}. I'm on my rounds.",
    ],
    meetupLocations: [
      { name: 'the tower lobby', pos: [-155, 0, 102] },
      { name: 'the service entrance', pos: [-148, 0, 98] },
      { name: 'between the towers', pos: [-152, 0, 105] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(-93, 0, 61.2) },
      { start: 12, end: 15, pos: new THREE.Vector3(-84, 0, 84) },
      { start: 15, end: 18, pos: new THREE.Vector3(-91.2, 0, 60) },
    ],
    homePos: new THREE.Vector3(-91.2, 0, 60),
    district: 'tower',
  },

  // ===================== PORT (2 NPCs — unlocks at 50 deals) =====================
  {
    name: 'Gus',
    position: new THREE.Vector3(-33, 0, 118.8),
    wants: ['plushie', 'gacha'],
    gachaPreference: 'curious',
    personality: 'tough',
    offerRange: [0.60, 0.75],
    counterThreshold: 0.08,
    meetFactor: 0.35,
    greetings: [
      "I've watched them dump ten thousand teddy bears into the sea.",
      "The containers that come in... some of them still have cute stuff.",
      "You ever seen a teddy bear sink? It doesn't. It floats. For miles.",
    ],
    wantText: "Plushies and capsules. For the old days.",
    acceptLines: [
      "Good. These won't end up in the ocean.",
    ],
    rejectLines: [
      "I want plushies or capsules.",
    ],
    counterAcceptLines: [
      "Fair enough. Deal.",
    ],
    counterRejectLines: [
      "Dock boss knows what things are worth.",
    ],
    finalOfferLines: [
      "Take it or leave it.",
    ],
    partingLines: [
      "The sea remembers. So do I.",
    ],
    dealDoneLines: [
      "One less that ends up floating.",
    ],
    limitLine: "That's enough for today.",
    streetRefuseLines: [
      "I'm working the docks. Later.",
    ],
    messageTemplates: [
      "Got {item}? {location}. Before the shift changes.",
      "Need {qty} {item}. {location}. Make it quick.",
    ],
    meetupLocations: [
      { name: 'the main dock', pos: [-75, 0, 198] },
      { name: 'the container yard', pos: [-100, 0, 200] },
      { name: 'the harbor office', pos: [-55, 0, 200] },
    ],
    schedule: [
      { start: 6, end: 14, pos: new THREE.Vector3(-48, 0, 118.8) },
      { start: 14, end: 18, pos: new THREE.Vector3(-33, 0, 120) },
    ],
    homePos: new THREE.Vector3(-33, 0, 118.8),
    district: 'port',
  },
  {
    name: 'Marina',
    position: new THREE.Vector3(-57, 0, 135),
    wants: ['sticker', 'plushie', 'gacha'],
    gachaPreference: 'curious',
    personality: 'fair',
    offerRange: [0.60, 0.75],
    counterThreshold: 0.12,
    meetFactor: 0.55,
    greetings: [
      "I'll put this one by the window. So it can see the sea.",
      "The lighthouse used to guide people home. Now it just stands here. Like me.",
      "You came all the way out here? For me?",
    ],
    wantText: "Anything. Anything at all.",
    acceptLines: [
      "It has a home now. By the window.",
      "Thank you. You don't know how quiet it gets.",
    ],
    rejectLines: [
      "I'll take anything cute...",
    ],
    counterAcceptLines: [
      "Whatever you think is fair.",
    ],
    counterRejectLines: [
      "Lighthouse keeper salary...",
    ],
    finalOfferLines: [
      "This is all I have. Is it enough?",
    ],
    partingLines: [
      "Come back sometime. Please.",
    ],
    dealDoneLines: [
      "I turned the light on last night. Just for a minute. Just to remember.",
    ],
    limitLine: "That's enough for now. Thank you.",
    streetRefuseLines: [
      "I'm watching the sea. Later.",
    ],
    messageTemplates: [
      "Would you visit {location}? I'm looking for {item}...",
      "It's lonely here. Bring {qty} {item}? {location}.",
    ],
    meetupLocations: [
      { name: 'the lighthouse', pos: [-95, 0, 228] },
      { name: 'the dock path', pos: [-85, 0, 212] },
    ],
    schedule: [
      { start: 6, end: 12, pos: new THREE.Vector3(-57, 0, 135) },
      { start: 12, end: 13, pos: new THREE.Vector3(-48, 0, 126) },
      { start: 13, end: 18, pos: new THREE.Vector3(-57, 0, 135) },
    ],
    homePos: new THREE.Vector3(-57, 0, 135),
    district: 'port',
  },

  // ===================== ACE HQ (1 NPC — endgame unlock) =====================
  {
    name: 'Dove',
    position: new THREE.Vector3(-75, 0, -30),
    wants: [],   // Dove GIVES you items, doesn't buy
    gachaPreference: 'refuses',
    personality: 'generous',
    offerRange: [1.0, 1.0],
    counterThreshold: 1.0,
    meetFactor: 1.0,
    requiresReferral: true, // 80+ deals + all districts
    nightOnly: true,
    greetings: [
      "I've cataloged 47,000 confiscated items. I've 'lost' about 200 of them.",
      "They have a room where they shred plushies. I can hear it from my desk.",
      "Take these. Get them to people. I don't want money. I want them to be loved.",
    ],
    wantText: "I don't need anything from you. Take these instead.",
    acceptLines: [
      "Get them to people who need them.",
    ],
    rejectLines: [
      "I'm giving, not buying.",
    ],
    counterAcceptLines: [
      "No payment needed. Just distribute them.",
    ],
    counterRejectLines: [
      "I said no money. Just take them.",
    ],
    finalOfferLines: [
      "Please. Just take them.",
    ],
    partingLines: [
      "I'm risking everything. But it's worth it.",
      "Be careful out there.",
    ],
    dealDoneLines: [
      "Every item you distribute is one ACE didn't destroy.",
    ],
    limitLine: "That's all I could smuggle out today.",
    streetRefuseLines: [
      "Not now. Someone's watching.",
    ],
    messageTemplates: [
      "I have a package. {location}. After dark. Delete this.",
      "Pickup available. {location}. Night only. — D",
    ],
    meetupLocations: [
      { name: 'outside ACE HQ', pos: [-130, 0, -45] },
      { name: 'the west fence', pos: [-165, 0, -70] },
    ],
    schedule: [
      // Dove only available at night — empty day schedule
    ],
    homePos: new THREE.Vector3(-75, 0, -30),
    district: 'aceHQ',
  },
];

// Base values for negotiation (old/scavenged tier — manufactured items worth more)
export const BASE_VALUES = {
  sticker: 9,       // old sticker; fresh sticker base is 13
  plushie: 17,      // old plushie; handmade plushie base is 30
  gacha: 24,        // base; actual per-capsule value randomized in 18-30 range
};

const TALK_RADIUS = 3;
const ROTATE_SPEED = 2;

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createNPCs(scene) {
  const npcs = [];

  for (const data of NPC_DATA) {
    // Build distinct NPC model from primitives
    const { group, parts, bodyMat, accessoryMat, headMat, hairMat } = buildNPCModel(data.name);
    group.position.copy(data.position);

    // Name label — floating sprite above head
    const { sprite: labelSprite } = makeNPCLabel(data.name);
    labelSprite.position.y = 2.1;
    group.add(labelSprite);

    // Deal-available indicator ("!")
    const indicatorCanvas = document.createElement('canvas');
    indicatorCanvas.width = 64; indicatorCanvas.height = 64;
    const ictx = indicatorCanvas.getContext('2d');
    ictx.font = 'bold 52px monospace';
    ictx.textAlign = 'center';
    ictx.textBaseline = 'middle';
    ictx.fillStyle = '#FFDD44';
    ictx.fillText('!', 32, 32);
    const indicatorTex = new THREE.CanvasTexture(indicatorCanvas);
    indicatorTex.minFilter = THREE.LinearFilter;
    const indicatorSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: indicatorTex, depthTest: false })
    );
    indicatorSprite.scale.set(0.35, 0.35, 1);
    indicatorSprite.position.set(0.8, 2.15, 0);
    indicatorSprite.visible = false;
    group.add(indicatorSprite);

    scene.add(group);

    // Determine initial visibility
    const districtLocked = data.district !== 'town' && data.district !== 'ruins' && !isDistrictUnlocked(data.district);
    const referralLocked = data.requiresReferral && !isNPCReferralUnlocked(data.name);
    const isLocked = districtLocked || referralLocked;

    if (isLocked) {
      group.visible = false;
    }

    npcs.push({
      group,
      name: data.name,
      wants: data.wants,
      personality: data.personality,
      offerRange: data.offerRange,
      counterThreshold: data.counterThreshold,
      meetFactor: data.meetFactor,
      greetings: data.greetings,
      wantText: data.wantText,
      acceptLines: data.acceptLines,
      rejectLines: data.rejectLines,
      counterAcceptLines: data.counterAcceptLines,
      counterRejectLines: data.counterRejectLines,
      finalOfferLines: data.finalOfferLines,
      partingLines: data.partingLines,
      dealDoneLines: data.dealDoneLines,
      limitLine: data.limitLine,
      streetRefuseLines: data.streetRefuseLines,
      messageTemplates: data.messageTemplates,
      meetupLocations: data.meetupLocations,
      gachaPreference: data.gachaPreference || 'refuses',
      picky: data.picky || false,
      plainLines: data.plainLines || [],
      district: data.district || 'town',
      worldPos: data.position.clone(),
      purchaseCount: 0,
      maxPurchases: data.maxPurchases || 3,
      gachaPurchases: 0,
      requiresReferral: data.requiresReferral || false,
      nightOnly: data.nightOnly || false,
      afterHour: data.afterHour || 0,
      // Schedule & movement
      schedule: data.schedule || [],
      homePos: data.homePos || data.position.clone(),
      targetPos: data.position.clone(),
      isAvailable: !isLocked,
      walkSpeed: 1.8,
      // Routine state
      isWalking: false,
      currentActivity: 'idle',
      // New model references
      parts,
      bodyMat,
      accessoryMat,
      headMat,
      hairMat,
      labelSprite,
      dealIndicator: indicatorSprite,
    });
  }

  return npcs;
}

// Generate an opening offer for an item type (new probability-based system)
export function generateOffer(npc, itemType) {
  const { offer } = generateDealOffer(npc, itemType);

  // Felix/Zoe collector club bonus: +15% offer
  if (referralState.felixZoeClub && (npc.name === 'Felix' || npc.name === 'Zoe')) {
    return Math.round(offer * 1.15);
  }

  return offer;
}

// Get the maximum price NPC will pay for this deal
export function getMaxPrice(npc, itemType) {
  const { maxPrice } = generateDealOffer(npc, itemType);
  return maxPrice;
}

// Legacy: willAcceptGacha — now just checks affinity (acceptance is probability-based)
export function willAcceptGacha(npc) {
  const affinity = getNPCAffinity(npc.name, 'gacha');
  return affinity >= 0; // only outright refuse if dislike
}

// Get a random dialogue line
export function npcLine(npc, category) {
  const lines = npc[category];
  if (!lines || lines.length === 0) return '';
  return randomFrom(lines);
}

// makeTextSprite removed — replaced by makeNPCLabel in npc-models.js

export function getNearestNPC(npcs, playerPos) {
  let best = null;
  let bestDist = TALK_RADIUS;
  const px = playerPos.x;
  const pz = playerPos.z;

  for (const npc of npcs) {
    if (!npc.isAvailable) continue;
    const dx = npc.worldPos.x - px;
    const dz = npc.worldPos.z - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = npc;
    }
  }
  return best;
}

// Get the scheduled position for an NPC at a given hour
function getScheduledPos(npc, hour) {
  for (const slot of npc.schedule) {
    if (hour >= slot.start && hour < slot.end) {
      return slot.pos;
    }
  }
  return npc.homePos;
}

// NPC walk speed: 40% of player speed (player ~4.5, NPC ~1.8)
const ROUTINE_WALK_SPEED = 1.8;
// Player avoidance
const PLAYER_AVOID_DIST = 1.5;
const PLAYER_AVOID_STRENGTH = 1.2;
const NPC_RADIUS = 0.4;

function npcInsideBuilding(x, z) {
  const bldgs = getAllBuildingBlocks();
  for (const b of bldgs) {
    if (x >= b.x - b.w / 2 - NPC_RADIUS && x <= b.x + b.w / 2 + NPC_RADIUS &&
        z >= b.z - b.d / 2 - NPC_RADIUS && z <= b.z + b.d / 2 + NPC_RADIUS) return true;
  }
  return false;
}

export function updateNPCs(npcs, playerPos, dt) {
  const hour = getGameHour();
  const active = isNPCActive();

  for (const npc of npcs) {
    // NPCs in locked districts stay hidden
    if (npc.district !== 'town' && npc.district !== 'ruins' && !isDistrictUnlocked(npc.district)) {
      npc.isAvailable = false;
      npc.group.visible = false;
      continue;
    }

    // Referral-locked NPCs stay hidden
    if (npc.requiresReferral && !isNPCReferralUnlocked(npc.name)) {
      npc.isAvailable = false;
      npc.group.visible = false;
      continue;
    }

    // Night-only NPCs (Quinn, Dove) are only available at night
    if (npc.nightOnly) {
      if (active) {
        npc.isAvailable = false;
        npc.group.visible = false;
        continue;
      } else {
        npc.isAvailable = true;
        npc.targetPos.copy(npc.homePos);
        npc.group.visible = true;
      }
    } else {
      // After-hour restriction (Zoe: only after 3PM)
      if (npc.afterHour > 0 && hour < npc.afterHour && active) {
        npc.isAvailable = false;
        npc.group.visible = false;
        continue;
      }

      npc.isAvailable = active;

      if (!active) {
        npc.targetPos.copy(npc.homePos);
        const distToHome = npc.worldPos.distanceTo(npc.homePos);
        if (distToHome < 0.5) {
          npc.group.visible = false;
        }
      } else {
        npc.group.visible = true;
      }
    }

    // ===== TUTORIAL OVERRIDE: keep Mei near ruins during steps 2-3 =====
    if (npc.name === 'Mei') {
      const tutorialPos = getMeiTutorialOverride();
      if (tutorialPos) {
        npc.worldPos.copy(tutorialPos);
        npc.targetPos.copy(tutorialPos);
        npc.group.position.copy(tutorialPos);
        npc.isWalking = false;
        npc.group.visible = true;
        npc.isAvailable = true;
        continue;
      }
    }

    // ===== ROUTINE-BASED MOVEMENT =====
    if (active && hasRoutine(npc.name)) {
      updateNPCRoutine(npc, playerPos, hour, dt);
    } else if (active) {
      // Non-routine NPCs: use old schedule system
      npc.targetPos.copy(getScheduledPos(npc, hour));
      walkTowardTarget(npc, playerPos, dt);
    } else {
      // Night: walk home
      walkTowardTarget(npc, playerPos, dt);
    }
  }

  // Procedural animation (walk cycle + idle breathing)
  animateNPCs(npcs, dt);

  // Label visibility (hide beyond 15 units)
  updateNPCLabels(npcs, playerPos, null);
}

function updateNPCRoutine(npc, playerPos, hour, dt) {
  const rs = getRoutineState(npc.name);

  // Don't move if frozen for a deal
  if (rs.dealFrozen) {
    // Face the player while dealing
    facePlayer(npc, playerPos, dt);
    return;
  }

  // Check for schedule transition
  const transition = checkScheduleTransition(npc.name, hour, rs.currentEntryIndex);
  if (transition) {
    rs.currentEntryIndex = transition.index;
    rs.activity = transition.entry.activity;
    rs.atDestination = false;
    npc.currentActivity = transition.entry.activity;

    // Calculate path to new destination
    rs.path = calculateRoutePath(
      npc.worldPos.x, npc.worldPos.z,
      transition.entry.x, transition.entry.z
    );
    rs.pathIndex = 0;
    rs.pauseTimer = 0;
    rs.wanderTarget = null;
  }

  // Initialize on first frame if no path set
  if (!rs.path && !rs.atDestination) {
    const entry = getCurrentScheduleEntry(npc.name, hour);
    if (entry) {
      rs.activity = entry.activity;
      npc.currentActivity = entry.activity;
      const dx = entry.x - npc.worldPos.x;
      const dz = entry.z - npc.worldPos.z;
      if (dx * dx + dz * dz > 1) {
        rs.path = calculateRoutePath(npc.worldPos.x, npc.worldPos.z, entry.x, entry.z);
        rs.pathIndex = 0;
      } else {
        rs.atDestination = true;
      }
    }
  }

  // Walking along path
  if (rs.path && rs.pathIndex < rs.path.length) {
    npc.isWalking = true;

    // Random micro-pause (look around, adjust something)
    if (rs.pauseTimer > 0) {
      rs.pauseTimer -= dt;
      // Slowly look around during pause
      npc.group.rotation.y += 0.3 * dt;
      return;
    }

    rs.nextPauseIn -= dt;
    if (rs.nextPauseIn <= 0) {
      rs.pauseTimer = 2 + Math.random(); // 2-3 seconds
      rs.nextPauseIn = 8 + Math.random() * 12; // 8-20 seconds until next
      return;
    }

    const wp = rs.path[rs.pathIndex];
    let dx = wp.x - npc.worldPos.x;
    let dz = wp.z - npc.worldPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.5) {
      // Reached waypoint, advance
      rs.pathIndex++;
      if (rs.pathIndex >= rs.path.length) {
        // Arrived at destination
        rs.path = null;
        rs.atDestination = true;
        npc.isWalking = false;
      }
      return;
    }

    // Walk toward waypoint
    const step = ROUTINE_WALK_SPEED * dt;
    const moveX = (dx / dist) * step;
    const moveZ = (dz / dist) * step;

    // Player avoidance — gentle sideways nudge
    const pdx = playerPos.x - npc.worldPos.x;
    const pdz = playerPos.z - npc.worldPos.z;
    const pDist = Math.sqrt(pdx * pdx + pdz * pdz);
    let avoidX = 0, avoidZ = 0;
    if (pDist < PLAYER_AVOID_DIST && pDist > 0.1) {
      const pushStrength = (1 - pDist / PLAYER_AVOID_DIST) * PLAYER_AVOID_STRENGTH * dt;
      avoidX = -(pdx / pDist) * pushStrength;
      avoidZ = -(pdz / pDist) * pushStrength;
    }

    // Apply move with building collision — sliding response
    const cx = npc.worldPos.x;
    const cz = npc.worldPos.z;
    const fullX = cx + moveX + avoidX;
    const fullZ = cz + moveZ + avoidZ;

    if (!npcInsideBuilding(fullX, fullZ)) {
      npc.worldPos.x = fullX;
      npc.worldPos.z = fullZ;
    } else {
      // Try path move without avoidance nudge
      const pathX = cx + moveX;
      const pathZ = cz + moveZ;
      if (!npcInsideBuilding(pathX, pathZ)) {
        npc.worldPos.x = pathX;
        npc.worldPos.z = pathZ;
      } else {
        // Slide along one axis
        if (!npcInsideBuilding(pathX, cz)) {
          npc.worldPos.x = pathX;
        } else if (!npcInsideBuilding(cx, pathZ)) {
          npc.worldPos.z = pathZ;
        }
        // else: fully blocked — stay put this frame
      }
    }
    npc.worldPos.y = 0; // stay on ground
    npc.group.position.copy(npc.worldPos);

    // Smooth rotation toward movement direction
    const walkAngle = Math.atan2(dx, dz);
    smoothRotate(npc, walkAngle, dt);
  } else if (rs.atDestination) {
    // At destination — perform activity behavior
    npc.isWalking = false;
    updateActivityBehavior(npc, rs, playerPos, dt);
  }
}

function updateActivityBehavior(npc, rs, playerPos, dt) {
  const terrainY = getTerrainHeight(npc.group.position.x, npc.group.position.z);
  const yOffset = getActivityYOffset(rs.activity);
  npc.group.position.y = terrainY + yOffset;

  switch (rs.activity) {
    case 'working':
      // Face away from the road (toward nearest building wall)
      // Just stand still, slight idle sway
      npc.group.position.y = terrainY;
      break;

    case 'sitting':
      // Lower Y position
      npc.group.position.y = terrainY - 0.5;
      // Face player if nearby
      facePlayer(npc, playerPos, dt);
      break;

    case 'socializing':
      // Slowly turn to look around, or face player if nearby
      const pdist = playerDistance(npc, playerPos);
      if (pdist < TALK_RADIUS * 3) {
        facePlayer(npc, playerPos, dt);
      } else {
        npc.group.rotation.y += 0.15 * dt;
      }
      break;

    case 'eating':
      npc.group.position.y = terrainY;
      facePlayer(npc, playerPos, dt);
      break;

    case 'wandering':
      // Walk between random nearby points slowly
      npc.group.position.y = 0;
      if (!rs.wanderTarget) {
        rs.wanderTarget = getWanderTarget(npc.worldPos.x, npc.worldPos.z);
        rs.wanderTimer = 3 + Math.random() * 5; // pause before wandering
      }

      if (rs.wanderTimer > 0) {
        rs.wanderTimer -= dt;
        facePlayer(npc, playerPos, dt);
        return;
      }

      const wdx = rs.wanderTarget.x - npc.worldPos.x;
      const wdz = rs.wanderTarget.z - npc.worldPos.z;
      const wdist = Math.sqrt(wdx * wdx + wdz * wdz);

      if (wdist < 1) {
        // Pick new wander target
        rs.wanderTarget = getWanderTarget(npc.worldPos.x, npc.worldPos.z);
        rs.wanderTimer = 3 + Math.random() * 5;
        return;
      }

      // Walk slowly toward wander target (50% of normal walk speed)
      const wstep = ROUTINE_WALK_SPEED * 0.5 * dt;
      npc.worldPos.x += (wdx / wdist) * wstep;
      npc.worldPos.z += (wdz / wdist) * wstep;
      npc.group.position.set(npc.worldPos.x, getTerrainHeight(npc.worldPos.x, npc.worldPos.z), npc.worldPos.z);
      smoothRotate(npc, Math.atan2(wdx, wdz), dt);
      npc.isWalking = true;
      break;

    default:
      // sleeping / idle — face player if nearby
      npc.group.position.y = 0;
      facePlayer(npc, playerPos, dt);
      break;
  }
}

// Walk directly toward targetPos (old system for non-routine NPCs)
function walkTowardTarget(npc, playerPos, dt) {
  const dx = npc.targetPos.x - npc.worldPos.x;
  const dz = npc.targetPos.z - npc.worldPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 0.3) {
    const step = npc.walkSpeed * dt;
    if (step >= dist) {
      npc.worldPos.copy(npc.targetPos);
    } else {
      npc.worldPos.x += (dx / dist) * step;
      npc.worldPos.z += (dz / dist) * step;
    }
    npc.group.position.copy(npc.worldPos);
    smoothRotate(npc, Math.atan2(dx, dz), dt);
    npc.isWalking = true;
  } else {
    npc.isWalking = false;
    facePlayer(npc, playerPos, dt);
  }
}

function smoothRotate(npc, targetAngle, dt) {
  let diff = targetAngle - npc.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const rotStep = ROTATE_SPEED * dt;
  if (Math.abs(diff) < rotStep) npc.group.rotation.y = targetAngle;
  else npc.group.rotation.y += Math.sign(diff) * rotStep;
}

function facePlayer(npc, playerPos, dt) {
  const pdx = playerPos.x - npc.worldPos.x;
  const pdz = playerPos.z - npc.worldPos.z;
  const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
  if (pdist < TALK_RADIUS * 2.5) {
    smoothRotate(npc, Math.atan2(pdx, pdz), dt);
  }
}

function playerDistance(npc, playerPos) {
  const dx = playerPos.x - npc.worldPos.x;
  const dz = playerPos.z - npc.worldPos.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function resetNPCPurchases(npcs) {
  for (const npc of npcs) {
    npc.purchaseCount = 0;
  }
}

// Make NPCs in a specific district visible and available (called when district unlocks)
export function enableDistrictNPCs(npcs, districtKey) {
  for (const npc of npcs) {
    if (npc.district === districtKey) {
      // Still respect referral locks
      if (npc.requiresReferral && !isNPCReferralUnlocked(npc.name)) continue;
      npc.group.visible = true;
      npc.isAvailable = true;
    }
  }
}

// Enable a specific NPC by name (for referral unlocks)
export function enableNPCByName(npcs, name) {
  for (const npc of npcs) {
    if (npc.name === name) {
      // Only if district is also unlocked
      if (npc.district === 'town' || npc.district === 'ruins' || isDistrictUnlocked(npc.district)) {
        npc.group.visible = true;
        npc.isAvailable = true;
      }
      break;
    }
  }
}

// Re-export routine functions for external use
export {
  freezeForDeal, unfreezeFromDeal, resetRoutinesForNewDay,
  getRoutineSaveData, restoreRoutineState,
  checkDealAvailability, getDexDailyMessage,
} from './npc-routines.js';

// Initialize the pathfinding graph (called once at startup)
export function initPathfinding() {
  buildGraph();
}
