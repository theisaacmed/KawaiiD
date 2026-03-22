// Joy Points (JP) system — rank progression
//
// JP earned from: deals, color spread, relationship milestones, ACE escapes
// JP lost on: capture (floored at current rank threshold — can't de-rank)
// 8 ranks gating district/feature unlocks

// Rank definitions — index 0..7
export const RANKS = [
  { index: 0, name: 'Gray Nobody',    jp: 0,    msg: "You're nobody yet. But that changes today." },
  { index: 1, name: 'Peddler',        jp: 50,   msg: "Word is getting around. People know your name now." },
  { index: 2, name: 'Dealer',         jp: 150,  msg: "Downtown opened up. Real territory. Ten slots." },
  { index: 3, name: 'Supplier',       jp: 300,  msg: "The Burbs. Bigger houses, softer hearts, better prices." },
  { index: 4, name: 'Smuggler',       jp: 500,  msg: "They can't contain what's already everywhere." },
  { index: 5, name: 'Distributor',    jp: 800,  msg: "Uptown. They pretend to hate it. They don't." },
  { index: 6, name: 'Kingpin',        jp: 1200, msg: "The Tower. The Port. This city is yours." },
  { index: 7, name: 'Kawaii Kingpin', jp: 2000, msg: "ACE HQ itself. The end begins here. It begins with joy." },
];

let currentJP = 0;
let currentRankIndex = 0;

// Callbacks
let onRankUpCb = null;
let onJPChangeCb = null;

export function setOnRankUpCallback(fn) { onRankUpCb = fn; }
export function setOnJPChangeCallback(fn) { onJPChangeCb = fn; }

export function getJP() { return currentJP; }
export function getCurrentRankIndex() { return currentRankIndex; }
export function getCurrentRank() { return RANKS[currentRankIndex]; }
export function getRankName() { return RANKS[currentRankIndex].name; }

export function getNextRank() {
  return currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;
}

// Returns 0..1 progress toward next rank (1.0 at max rank)
export function getJPProgress() {
  const current = RANKS[currentRankIndex].jp;
  const next = getNextRank();
  if (!next) return 1.0;
  return Math.min(1.0, (currentJP - current) / (next.jp - current));
}

// Add (positive) or deduct (negative) JP.
// Deductions are floored at the current rank's JP threshold so player can't de-rank.
export function addJP(amount) {
  if (amount === 0) return;

  if (amount < 0) {
    const floor = RANKS[currentRankIndex].jp;
    currentJP = Math.max(floor, currentJP + amount);
  } else {
    currentJP += amount;

    // Check for rank-ups (can chain through multiple ranks in one call)
    while (currentRankIndex < RANKS.length - 1 && currentJP >= RANKS[currentRankIndex + 1].jp) {
      currentRankIndex++;
      if (onRankUpCb) onRankUpCb(currentRankIndex, RANKS[currentRankIndex]);
    }
  }

  if (onJPChangeCb) onJPChangeCb(currentJP);
}

// --- Save / Restore ---
export function getJPState() {
  return { jp: currentJP, rankIndex: currentRankIndex };
}

export function restoreJPState(data) {
  if (!data) return;
  if (data.jp !== undefined) currentJP = data.jp;

  // Derive rank index from JP (source of truth) to handle any inconsistency
  currentRankIndex = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (currentJP >= RANKS[i].jp) {
      currentRankIndex = i;
      break;
    }
  }

  if (onJPChangeCb) onJPChangeCb(currentJP);
}
