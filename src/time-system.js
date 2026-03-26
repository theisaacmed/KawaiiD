// Time system — central game clock, day tracking, time pausing, sleeping
//
// 1 real minute = 1 in-game hour → 12 real minutes = full playable day (6AM–6PM)
// Day starts at 6:00 AM, night falls at 6:00 PM
// Time pauses when phone is open or during deal negotiations

import { playSleepFadeOut, playDawnBirds } from './audio.js';

// --- Constants ---
const TIME_SCALE = 1 / 60; // game hours per real second (1 hour per 60 seconds)
const DAY_START_HOUR = 6;   // 6:00 AM
const NIGHT_START_HOUR = 18; // 6:00 PM

// --- State ---
let gameHour = 9.0;   // current hour (0–24 float)
let dayNumber = 1;
let paused = false;

// Sleeping
let isSleeping = false;
let sleepCallback = null;   // called when sleep completes (for new-day logic)
let sleepOverlay = null;
let sleepTitleCard = null;

// Pause predicates — functions that return true when time should pause
const pausePredicates = [];

export function registerPausePredicate(fn) {
  pausePredicates.push(fn);
}

// --- Queries ---
export function getGameHour() { return gameHour; }
export function getDayNumber() { return dayNumber; }
export function isPaused() { return paused; }

export function isNight() {
  return gameHour >= NIGHT_START_HOUR || gameHour < DAY_START_HOUR;
}

// Daylight factor: 1.0 = full day, 0.0 = full night, with transitions
export function getDaylightFactor() {
  // Dawn: 5:30 AM – 8:00 AM  (gradual brightening)
  // Dusk: 4:00 PM – 6:00 PM  (gradual dimming)
  if (gameHour >= 8 && gameHour < 16) return 1.0;
  if (gameHour >= 18 || gameHour < 5.5) return 0.0;

  // Dawn transition 5:30 – 8:00
  if (gameHour >= 5.5 && gameHour < 8) {
    return (gameHour - 5.5) / 2.5;
  }
  // Dusk transition 16:00 – 18:00
  if (gameHour >= 16 && gameHour < 18) {
    return 1.0 - (gameHour - 16) / 2.0;
  }
  return 1.0;
}

// Time-of-day period (for lighting color selection)
export function getTimePeriod() {
  if (gameHour >= 6 && gameHour < 8) return 'dawn';
  if (gameHour >= 8 && gameHour < 16) return 'day';
  if (gameHour >= 16 && gameHour < 18) return 'dusk';
  return 'night';
}

// Is an NPC active? (6 AM – 6 PM)
export function isNPCActive() {
  return gameHour >= DAY_START_HOUR && gameHour < NIGHT_START_HOUR;
}

// --- Setters ---
export function setGameHour(h) { gameHour = ((h % 24) + 24) % 24; }
export function setDayNumber(d) { dayNumber = d; }

// --- Update (called each frame) ---
export function updateTime(dt) {
  // Check pause predicates
  paused = false;
  for (const pred of pausePredicates) {
    if (pred()) { paused = true; break; }
  }

  if (paused || isSleeping) return;

  gameHour += TIME_SCALE * dt;

  // Handle day rollover
  if (gameHour >= 24) {
    gameHour -= 24;
    dayNumber++;
  }
}

// --- Sleeping ---
export function setSleepCallback(fn) { sleepCallback = fn; }

export function canSleep() {
  // Can only sleep — don't need to be night, but let's allow anytime near bed
  return !isSleeping;
}

export function startSleep() {
  if (isSleeping) return;
  isSleeping = true;

  // Create sleep overlay
  sleepOverlay = document.createElement('div');
  Object.assign(sleepOverlay.style, {
    position: 'fixed', inset: '0',
    background: '#000', opacity: '0',
    transition: 'opacity 0.8s',
    zIndex: '9000',
    pointerEvents: 'none',
  });
  document.body.appendChild(sleepOverlay);

  // Fade to black
  playSleepFadeOut();
  requestAnimationFrame(() => { sleepOverlay.style.opacity = '1'; });

  // After fade, advance time and show title card
  setTimeout(() => {
    // Advance to next morning
    dayNumber++;
    gameHour = DAY_START_HOUR;

    // Run new-day callback (respawn piles, reset NPC counts, auto-save)
    if (sleepCallback) sleepCallback();

    playDawnBirds();

    // Show day title card
    showDayCard(() => {
      // Fade back in
      sleepOverlay.style.opacity = '0';
      setTimeout(() => {
        sleepOverlay.remove();
        sleepOverlay = null;
        isSleeping = false;
      }, 800);
    });
  }, 1000);
}

function showDayCard(onDone) {
  sleepTitleCard = document.createElement('div');
  Object.assign(sleepTitleCard.style, {
    position: 'fixed', inset: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    zIndex: '9001',
    pointerEvents: 'none',
  });

  const dayText = document.createElement('div');
  Object.assign(dayText.style, {
    fontSize: '42px', fontWeight: 'bold',
    fontFamily: 'monospace', color: '#fff',
    letterSpacing: '4px',
    textShadow: '0 0 30px rgba(100,200,255,0.4)',
    opacity: '0',
    transition: 'opacity 0.5s',
  });
  dayText.textContent = `Day ${dayNumber}`;
  sleepTitleCard.appendChild(dayText);

  const subText = document.createElement('div');
  Object.assign(subText.style, {
    fontSize: '14px', color: '#667',
    fontFamily: 'monospace',
    marginTop: '8px',
    opacity: '0',
    transition: 'opacity 0.5s',
  });
  subText.textContent = 'A new day begins...';
  sleepTitleCard.appendChild(subText);

  document.body.appendChild(sleepTitleCard);

  // Animate in
  requestAnimationFrame(() => {
    dayText.style.opacity = '1';
    subText.style.opacity = '1';
  });

  // Hold, then fade out and call onDone
  setTimeout(() => {
    dayText.style.opacity = '0';
    subText.style.opacity = '0';
    setTimeout(() => {
      sleepTitleCard.remove();
      sleepTitleCard = null;
      if (onDone) onDone();
    }, 600);
  }, 1800);
}

export function isSleepingNow() { return isSleeping; }
