// NPC routine system — daily schedules, activity states, deal availability by location
//
// Each Town NPC has a detailed daily routine with specific locations and activities.
// NPCs walk between locations along roads via the pathfinding system.
// Deal availability depends on NPC location and activity.

import { findPath, applySidewalkOffset, buildGraph } from './npc-pathfinding.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { isDistrictUnlocked } from './districts.js';

// ========== TOWN NPC SCHEDULES ==========
// time: hour (float), location: {x, z}, activity: string, dealOk: bool
// dealRefuseLine: what NPC says if you try to deal at wrong time/place

const ROUTINES = {
  Mei: [
    { time: 6.0,  x: 40,  z: 25,  activity: 'sleeping', dealOk: false },
    { time: 7.0,  x: -25, z: 15,  activity: 'working', dealOk: false, dealRefuseLine: "I'm at work... maybe at lunch?" },
    { time: 12.0, x: 5,   z: 28,  activity: 'sitting', dealOk: true },  // park bench near fountain
    { time: 13.0, x: -25, z: 15,  activity: 'working', dealOk: false, dealRefuseLine: "Not at the shop. Find me at lunch." },
    { time: 17.0, x: -15, z: 95,  activity: 'socializing', dealOk: true, requiresDistrict: 'downtown' }, // Ren's place
    { time: 17.0, x: 40,  z: 25,  activity: 'walking', dealOk: false, altIfLocked: true }, // go home if downtown locked
    { time: 20.0, x: 40,  z: 25,  activity: 'sleeping', dealOk: false },
  ],

  Hiro: [
    { time: 6.0,  x: 25,  z: -5,  activity: 'sleeping', dealOk: false },
    { time: 6.5,  x: 50,  z: -10, activity: 'working', dealOk: false, dealRefuseLine: "Not here. Meet me at the alley at noon." },
    { time: 12.0, x: -20, z: 8,   activity: 'eating', dealOk: true },   // alley behind market
    { time: 13.0, x: 50,  z: -10, activity: 'working', dealOk: false, dealRefuseLine: "I said not here. Noon at the alley." },
    { time: 17.0, x: 45,  z: 88,  activity: 'eating', dealOk: true, requiresDistrict: 'downtown' }, // Marco's restaurant
    { time: 17.0, x: 25,  z: -5,  activity: 'walking', dealOk: false, altIfLocked: true },
    { time: 19.0, x: 25,  z: -5,  activity: 'sleeping', dealOk: false },
  ],

  Luna: [
    { time: 7.0,  x: -8,  z: 22,  activity: 'sleeping', dealOk: false },
    { time: 8.0,  x: -15, z: 35,  activity: 'working', dealOk: true },  // wellness center
    { time: 10.0, x: 2,   z: 22,  activity: 'socializing', dealOk: true }, // fountain / town square
    { time: 12.0, x: 5,   z: 88,  activity: 'eating', dealOk: true, requiresDistrict: 'downtown' }, // Nao's café
    { time: 12.0, x: 2,   z: 22,  activity: 'socializing', dealOk: true, altIfLocked: true },
    { time: 14.0, x: 2,   z: 22,  activity: 'socializing', dealOk: true }, // back to fountain
    { time: 17.0, x: -8,  z: 22,  activity: 'walking', dealOk: true },
    { time: 18.0, x: -8,  z: 22,  activity: 'sleeping', dealOk: false },
  ],

  Ash: [
    { time: 8.0,  x: 35,  z: 38,  activity: 'sleeping', dealOk: false },
    { time: 9.0,  x: -35, z: 15,  activity: 'working', dealOk: false, dealRefuseLine: "N-not here... too many people..." }, // library
    { time: 12.0, x: -22, z: 5,   activity: 'sitting', dealOk: true },  // secluded bench
    { time: 13.0, x: -35, z: 15,  activity: 'working', dealOk: false, dealRefuseLine: "I c-can't do this at the library..." },
    { time: 16.0, x: 0,   z: 0,   activity: 'wandering', dealOk: false, dealRefuseLine: "I'm too nervous out in the open..." },
    { time: 19.0, x: 35,  z: 38,  activity: 'sleeping', dealOk: false },
  ],

  // Dex is special — random daily location
  Dex: null, // handled by getDexRoutine()
};

// Dex picks a random location each day
const DEX_SPOTS = [
  { x: -30, z: 35, hint: "Behind the tall building on the west side today." },
  { x: 38,  z: -8, hint: "East road, near the edge. Don't be late." },
  { x: -20, z: -5, hint: "South of the fountain. You know the spot." },
  { x: 25,  z: 40, hint: "North end of town. Back alley." },
  { x: -40, z: 20, hint: "West street. I'll be in the shadows." },
];

// Cache Dex's daily spot
let dexDay = -1;
let dexSpot = null;

function getDexSpotForDay(dayNumber) {
  if (dexDay === dayNumber) return dexSpot;
  dexDay = dayNumber;
  // Deterministic random based on day number
  const idx = dayNumber % DEX_SPOTS.length;
  dexSpot = DEX_SPOTS[idx];
  return dexSpot;
}

export function getDexRoutine(dayNumber) {
  const spot = getDexSpotForDay(dayNumber);
  return [
    { time: 0,    x: 30,      z: 10,     activity: 'sleeping', dealOk: false },
    { time: 10.0, x: spot.x,  z: spot.z, activity: 'working', dealOk: true },
    { time: 16.0, x: 30,      z: 10,     activity: 'sleeping', dealOk: false },
  ];
}

export function getDexDailyMessage(dayNumber) {
  const spot = getDexSpotForDay(dayNumber);
  return spot.hint;
}

// ========== ROUTINE STATE PER NPC ==========

// Runtime state: { currentEntryIndex, path, pathIndex, pauseTimer, activity }
const routineStates = {};

export function getRoutineState(npcName) {
  if (!routineStates[npcName]) {
    routineStates[npcName] = {
      currentEntryIndex: 0,
      path: null,          // array of { x, z } waypoints
      pathIndex: 0,        // current waypoint index
      pauseTimer: 0,       // random pause countdown
      nextPauseIn: randomBetween(8, 20), // seconds until next random pause
      activity: 'sleeping',
      atDestination: false,
      wanderTarget: null,  // for 'wandering' activity
      wanderTimer: 0,
      dealFrozen: false,   // true when player initiated a deal (NPC stops walking)
    };
  }
  return routineStates[npcName];
}

// ========== SCHEDULE RESOLUTION ==========

/**
 * Get the current schedule entry for an NPC at the given hour.
 * Handles the alt-if-locked logic for downtown-dependent entries.
 */
export function getCurrentScheduleEntry(npcName, hour) {
  let schedule;
  if (npcName === 'Dex') {
    schedule = getDexRoutine(getDayNumber());
  } else {
    schedule = ROUTINES[npcName];
  }
  if (!schedule) return null;

  // Find the latest entry whose time <= hour
  let best = null;
  let skipAlt = false;

  for (let i = schedule.length - 1; i >= 0; i--) {
    const entry = schedule[i];
    if (entry.time > hour) continue;

    // If this entry requires a district and it's locked, skip to altIfLocked
    if (entry.requiresDistrict && !isDistrictUnlocked(entry.requiresDistrict)) {
      continue;
    }

    // If this is an alt entry and we already found the primary, skip
    if (entry.altIfLocked && !skipAlt) {
      // This is the fallback — use it only if we haven't found a primary
      if (!best) {
        best = entry;
      }
      continue;
    }

    best = entry;
    break;
  }

  return best || schedule[0];
}

/**
 * Check if a schedule transition happened (NPC needs to start walking to new location).
 * Returns the new entry if a transition occurred, null otherwise.
 */
export function checkScheduleTransition(npcName, hour, currentEntryIndex) {
  let schedule;
  if (npcName === 'Dex') {
    schedule = getDexRoutine(getDayNumber());
  } else {
    schedule = ROUTINES[npcName];
  }
  if (!schedule) return null;

  // Build filtered schedule (respecting district locks)
  const filtered = [];
  const seen = new Set();
  for (const entry of schedule) {
    if (entry.requiresDistrict && !isDistrictUnlocked(entry.requiresDistrict)) continue;
    if (entry.altIfLocked) {
      // Only use alt if the primary at same time was skipped
      const primaryAtSameTime = schedule.find(e =>
        e.time === entry.time && e !== entry && !e.altIfLocked
      );
      if (primaryAtSameTime && (!primaryAtSameTime.requiresDistrict || isDistrictUnlocked(primaryAtSameTime.requiresDistrict))) {
        continue; // Primary is available, skip alt
      }
    }
    // Dedupe by time
    if (!seen.has(entry.time)) {
      filtered.push(entry);
      seen.add(entry.time);
    }
  }

  // Find the entry index for current hour
  let targetIndex = 0;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (hour >= filtered[i].time) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex !== currentEntryIndex && targetIndex < filtered.length) {
    return { entry: filtered[targetIndex], index: targetIndex };
  }
  return null;
}

// ========== PATH MANAGEMENT ==========

/**
 * Calculate a new path for an NPC from their current position to a destination.
 */
export function calculateRoutePath(fromX, fromZ, toX, toZ) {
  buildGraph();
  const rawPath = findPath(fromX, fromZ, toX, toZ);
  return applySidewalkOffset(rawPath);
}

// ========== ACTIVITY STATE BEHAVIORS ==========

/**
 * Get the Y-position offset for an activity (e.g., sitting lowers the NPC).
 */
export function getActivityYOffset(activity) {
  if (activity === 'sitting') return -0.5;
  return 0;
}

/**
 * Generate a random nearby wander point for the 'wandering' activity.
 */
export function getWanderTarget(centerX, centerZ) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 5 + Math.random() * 15;
  return {
    x: centerX + Math.cos(angle) * dist,
    z: centerZ + Math.sin(angle) * dist,
  };
}

// ========== DEAL AVAILABILITY ==========

/**
 * Check if an NPC is willing to deal at their current location/activity.
 * Returns { canDeal: bool, refuseLine: string|null }
 */
export function checkDealAvailability(npcName, hour) {
  const entry = getCurrentScheduleEntry(npcName, hour);
  if (!entry) return { canDeal: true, refuseLine: null };

  if (entry.dealOk) {
    return { canDeal: true, refuseLine: null };
  }

  return {
    canDeal: false,
    refuseLine: entry.dealRefuseLine || "Not right now.",
  };
}

/**
 * Check if this NPC has a routine defined (Town NPCs only for now).
 */
export function hasRoutine(npcName) {
  return npcName === 'Dex' || ROUTINES[npcName] != null;
}

// ========== DEAL FREEZE ==========

/**
 * Freeze an NPC's movement (player initiated a deal).
 */
export function freezeForDeal(npcName) {
  const state = getRoutineState(npcName);
  state.dealFrozen = true;
}

/**
 * Unfreeze an NPC's movement (deal ended).
 */
export function unfreezeFromDeal(npcName) {
  const state = getRoutineState(npcName);
  state.dealFrozen = false;
}

// ========== SAVE / RESTORE ==========

export function getRoutineSaveData() {
  const data = {};
  for (const [name, state] of Object.entries(routineStates)) {
    data[name] = {
      currentEntryIndex: state.currentEntryIndex,
      activity: state.activity,
      atDestination: state.atDestination,
    };
  }
  return data;
}

export function restoreRoutineState(data) {
  if (!data) return;
  for (const [name, saved] of Object.entries(data)) {
    const state = getRoutineState(name);
    state.currentEntryIndex = saved.currentEntryIndex || 0;
    state.activity = saved.activity || 'sleeping';
    state.atDestination = saved.atDestination || false;
    // Path will be recalculated on next update
    state.path = null;
    state.pathIndex = 0;
  }
}

/**
 * Reset all routine states for a new day.
 */
export function resetRoutinesForNewDay() {
  for (const state of Object.values(routineStates)) {
    state.currentEntryIndex = 0;
    state.path = null;
    state.pathIndex = 0;
    state.activity = 'sleeping';
    state.atDestination = false;
    state.pauseTimer = 0;
    state.wanderTarget = null;
    state.dealFrozen = false;
  }
}

// ========== HELPERS ==========

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
