// Audio system — all sounds synthesized via Web Audio API, no external files
//
// Ambient drone shifts from cold minor (gray) to warm major (colorful)
// All effects are short synthesized bursts

let ctx = null;
let masterGain = null;
let ambiDrone = null;

// Footstep state
let stepTimer = 0;
const STEP_INTERVAL = 0.42; // seconds between footsteps while walking


// Ambient cricket/wind state
let cricketInterval = null;
let windNode = null;
let windGain = null;

// Track current world color for drone modulation
let currentWorldColor = 0;

// --- Init ---
export function initAudio() {
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.65;
    masterGain.connect(ctx.destination);

    // Resume on user interaction (autoplay policy)
    const resume = () => {
      if (ctx.state === 'suspended') ctx.resume();
    };
    document.addEventListener('click', resume, { once: false });
    document.addEventListener('keydown', resume, { once: false });

    startAmbientDrone();
  } catch (e) {
    console.warn('Audio init failed:', e);
  }
}

function ensureCtx() {
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

// ============================
//  AMBIENT ATMOSPHERE
// ============================
// Ambient melody system — pre-composed melodies with exact frequencies & durations
// Generated from proper music theory: scales, contour shapes, rhythmic variation
// Cold = minor keys (A aeolian, E phrygian, D dorian, A pentatonic minor)
// Warm = major keys (C ionian, G mixolydian, F lydian, C pentatonic major)
// Each melody entry: [frequency_hz, duration_seconds]

let ambNoiseNode = null;
let ambNoiseGain = null;
let ambNoiseLPF = null;
let melodyTimeout = null;
let padTargetColor = 0; // 0 = cold, 1 = warm

// Melody playback state
let melodyKey = 0;
let melodyStep = 0;

// === TIER 0: GRAY (0-0.15) — sparse, desolate, very minimal ===
const GRAY_MELODIES = [
  // emptiness — very low, sparse single notes with long gaps
  [[82.41,3.5],[73.42,2.8],[82.41,3.2],[87.31,2.4],[82.41,3.8]],
  // dust — barely there, low register
  [[110,3.2],[98,2.6],[82.41,3.5],[110,2.9],[98,3.1]],
  // stillness — minimal movement, hollow
  [[73.42,3.8],[82.41,3.1],[73.42,2.9],[65.41,3.5],[73.42,3.2]],
];

// === TIER 1: COLD (0.15-0.35) — melancholy minor, slow and sad ===
const COLD_MELODIES = [
  // lament — A aeolian, sighing descent
  [[164.81,2.6],[220,1.4],[196,1.1],[164.81,2.1],[146.83,1.4],[123.47,0.9],[110,2.6],[123.47,1.6],[130.81,1.9],[146.83,1.6],[164.81,2.4],[164.81,2.9]],
  // circling — A pentatonic minor, obsessive return
  [[164.81,2.9],[196,1.1],[220,1.6],[164.81,2.4],[146.83,1.1],[164.81,2.1],[196,1.4],[146.83,2.8],[130.81,1.1],[164.81,1.9],[196,2.6],[164.81,3.1]],
  // question — E phrygian, unresolved rise
  [[130.81,2.1],[123.47,1.9],[110,1.4],[123.47,1.1],[130.81,2.4],[146.83,2.1],[164.81,1.6],[196,0.9],[164.81,2.6],[220,1.9]],
  // falling thirds — D dorian, melancholy
  [[329.63,1.6],[246.94,2.4],[293.66,1.1],[246.94,2.9],[293.66,1.4],[246.94,2.1],[220,1.1],[246.94,2.4],[293.66,1.6],[246.94,2.1]],
  // lonely peak — A aeolian, climb then fall
  [[130.81,2.6],[146.83,1.4],[164.81,1.1],[196,2.1],[220,1.4],[196,0.9],[164.81,2.6],[130.81,1.6],[123.47,1.9],[110,1.6],[123.47,2.4],[130.81,2.9]],
  // rocking — E phrygian, gentle back-and-forth
  [[123.47,2.1],[130.81,1.9],[123.47,1.4],[130.81,1.1],[123.47,2.4],[146.83,2.1],[110,1.6],[130.81,0.9],[123.47,2.6],[110,1.9],[123.47,2.1],[123.47,2.9]],
];

// === TIER 2: AWAKENING (0.35-0.6) — dorian/mixolydian, hopeful but bittersweet ===
const AWAKENING_MELODIES = [
  // first light — D dorian, tentative hope
  [[196,2.1],[220,1.6],[246.94,1.4],[220,2.4],[261.63,1.6],[246.94,1.1],[220,2.6],[196,1.4],[220,1.9],[246.94,2.1]],
  // stirring — G mixolydian, gentle momentum
  [[196,1.9],[246.94,1.4],[293.66,2.1],[246.94,1.6],[329.63,1.1],[293.66,2.4],[246.94,1.4],[293.66,1.9],[246.94,2.6],[196,1.6]],
  // wonder — C major pentatonic but slow, discovering beauty
  [[261.63,2.4],[293.66,1.6],[329.63,1.9],[261.63,2.1],[392,1.4],[329.63,2.6],[293.66,1.1],[261.63,2.4],[329.63,1.6],[293.66,2.1]],
  // unfolding — F lydian, opening up
  [[174.61,2.6],[220,1.4],[246.94,1.9],[261.63,2.1],[246.94,1.4],[220,2.4],[261.63,1.6],[293.66,1.9],[261.63,2.6],[220,1.4]],
  // resolve — A dorian, determined but gentle
  [[220,2.1],[246.94,1.4],[261.63,1.6],[293.66,2.4],[261.63,1.1],[246.94,2.1],[293.66,1.6],[329.63,1.9],[293.66,2.4],[261.63,1.6]],
];

// === TIER 3: WARM (0.6-0.85) — bright major keys, lively ===
const WARM_MELODIES = [
  // hope — C ionian, ascending phrase
  [[164.81,2.1],[196,1.9],[220,1.4],[196,1.1],[261.63,2.4],[246.94,2.1],[293.66,1.6],[261.63,0.9],[246.94,2.6],[220,1.9],[196,1.4]],
  // dancing — C pentatonic major, playful leaps
  [[196,1.6],[293.66,2.4],[220,1.1],[329.63,2.9],[196,1.4],[293.66,2.1],[261.63,1.1],[392,2.4],[293.66,1.6],[329.63,1.9],[261.63,2.6]],
  // arch — G mixolydian, up and back
  [[246.94,2.6],[293.66,1.4],[329.63,1.1],[392,2.1],[440,1.4],[392,0.9],[329.63,2.6],[293.66,1.6],[246.94,1.9],[293.66,1.6],[246.94,2.4]],
  // call and response — F lydian, conversational
  [[174.61,2.9],[220,1.1],[246.94,1.6],[196,2.4],[174.61,1.1],[164.81,2.1],[196,1.4],[220,2.8],[293.66,1.1],[261.63,1.9],[246.94,2.6],[174.61,3.1]],
  // skipping — C pentatonic major, open feel
  [[196,2.1],[293.66,1.9],[261.63,1.4],[329.63,1.1],[261.63,2.4],[440,2.1],[329.63,1.6],[261.63,0.9],[329.63,2.6],[220,1.9],[196,1.4]],
  // lullaby — C ionian, settling down warmly
  [[261.63,1.6],[392,2.4],[329.63,1.1],[293.66,2.9],[329.63,1.4],[261.63,2.1],[246.94,1.1],[293.66,2.4],[261.63,1.6],[246.94,2.1],[261.63,2.9]],
  // wandering — F lydian, peaceful roaming
  [[196,2.9],[220,1.1],[261.63,1.6],[196,2.4],[261.63,1.1],[293.66,2.1],[246.94,1.4],[220,2.8],[293.66,1.1],[220,1.9],[196,2.6]],
];

// === TIER 4: VIBRANT (0.85-1.0) — celebration, full color, joyful ===
const VIBRANT_MELODIES = [
  // celebration — G mixolydian, big upward leaps
  [[196,2.6],[329.63,1.4],[293.66,1.1],[440,2.1],[329.63,1.4],[392,0.9],[440,2.6],[392,1.6],[293.66,1.9],[329.63,1.6],[293.66,2.4]],
  // jubilant — C major, bright and bouncy
  [[329.63,1.4],[392,1.1],[440,1.6],[523.25,2.1],[440,1.1],[392,1.6],[523.25,1.4],[659.25,1.9],[523.25,1.6],[440,1.1],[392,2.4],[523.25,1.6]],
  // soaring — wide intervals, triumphant
  [[261.63,1.6],[392,1.4],[523.25,1.9],[440,1.1],[659.25,2.1],[523.25,1.4],[440,1.6],[523.25,2.4],[659.25,1.1],[523.25,1.9],[392,1.4],[523.25,2.6]],
  // bloom — F lydian, bright and open with #4
  [[349.23,1.6],[440,1.4],[523.25,1.9],[493.88,1.1],[523.25,2.1],[440,1.6],[349.23,1.4],[440,1.9],[523.25,2.4],[440,1.1],[349.23,2.6]],
  // kaleidoscope — pentatonic major, dancing high
  [[392,1.1],[523.25,1.6],[440,1.4],[659.25,1.9],[523.25,1.1],[587.33,1.6],[523.25,1.4],[440,1.9],[523.25,2.1],[659.25,1.4],[523.25,1.6]],
];

// Color tier configuration: [threshold, melodies, pauseMin, pauseMax, volumeBase, volumeColor, legatoOverlap]
const COLOR_TIERS = [
  { max: 0.15, melodies: GRAY_MELODIES,      pauseMin: 10000, pauseMax: 16000, volBase: 0.012, volColor: 0.004, legato: 0.40 },
  { max: 0.35, melodies: COLD_MELODIES,      pauseMin: 7000,  pauseMax: 12000, volBase: 0.016, volColor: 0.006, legato: 0.50 },
  { max: 0.60, melodies: AWAKENING_MELODIES, pauseMin: 5000,  pauseMax: 9000,  volBase: 0.020, volColor: 0.010, legato: 0.55 },
  { max: 0.85, melodies: WARM_MELODIES,      pauseMin: 4000,  pauseMax: 8000,  volBase: 0.022, volColor: 0.012, legato: 0.58 },
  { max: 1.01, melodies: VIBRANT_MELODIES,   pauseMin: 3000,  pauseMax: 6000,  volBase: 0.025, volColor: 0.014, legato: 0.62 },
];

function getCurrentTier(color) {
  for (let i = 0; i < COLOR_TIERS.length; i++) {
    if (color < COLOR_TIERS[i].max) return COLOR_TIERS[i];
  }
  return COLOR_TIERS[COLOR_TIERS.length - 1];
}

function startAmbientDrone() {
  if (!ctx) return;

  // --- Quiet filtered noise bed ---
  const bufLen = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  ambNoiseNode = ctx.createBufferSource();
  ambNoiseNode.buffer = buf;
  ambNoiseNode.loop = true;

  ambNoiseLPF = ctx.createBiquadFilter();
  ambNoiseLPF.type = 'lowpass';
  ambNoiseLPF.frequency.value = 200;
  ambNoiseLPF.Q.value = 0.5;

  ambNoiseGain = ctx.createGain();
  ambNoiseGain.gain.value = 0.012;

  ambNoiseNode.connect(ambNoiseLPF);
  ambNoiseLPF.connect(ambNoiseGain);
  ambNoiseGain.connect(masterGain);
  ambNoiseNode.start();

  // --- Start the melody system ---
  melodyKey = 0;
  melodyStep = 0;
  scheduleNextNote();

  ambiDrone = { active: true };
}

// Pad voice: plays a single note as a warm, evolving pad sound
// Layers 3 detuned oscillators + vibrato + filter sweep for a lush tone
function playPadVoice(freq, dur, vol, color) {
  const t = ctx.currentTime;
  const totalDur = dur + 2.0; // extra tail for long fade

  // Attack is very slow — no "beep" onset. Release is long and gentle.
  const attack = Math.min(dur * 0.5, 2.0);
  const release = Math.max(dur * 0.5, 1.5);

  // Shared output gain for the whole voice
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0, t);
  voiceGain.gain.linearRampToValueAtTime(vol, t + attack);
  voiceGain.gain.setValueAtTime(vol, t + attack);
  voiceGain.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.8);
  voiceGain.gain.linearRampToValueAtTime(0, t + totalDur);

  // LPF with slow sweep — opens up during the note, closes on release
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.Q.value = 0.5;
  const filterBase = 300 + color * 400;
  const filterPeak = filterBase + 600 + color * 500;
  lpf.frequency.setValueAtTime(filterBase, t);
  lpf.frequency.linearRampToValueAtTime(filterPeak, t + attack * 1.2);
  lpf.frequency.linearRampToValueAtTime(filterBase * 0.8, t + totalDur);

  lpf.connect(voiceGain);
  voiceGain.connect(masterGain);

  // --- Layer 1: fundamental sine (core warmth) ---
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;
  const g1 = ctx.createGain();
  g1.gain.value = 0.5;
  osc1.connect(g1);
  g1.connect(lpf);
  osc1.start(t);
  osc1.stop(t + totalDur + 0.1);

  // --- Layer 2: detuned sine +7 cents (chorus width) ---
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq;
  osc2.detune.value = 7;
  const g2 = ctx.createGain();
  g2.gain.value = 0.3;
  osc2.connect(g2);
  g2.connect(lpf);
  osc2.start(t);
  osc2.stop(t + totalDur + 0.1);

  // --- Layer 3: detuned triangle -8 cents (adds body without buzz) ---
  const osc3 = ctx.createOscillator();
  osc3.type = 'triangle';
  osc3.frequency.value = freq;
  osc3.detune.value = -8;
  const g3 = ctx.createGain();
  g3.gain.value = 0.2;
  osc3.connect(g3);
  g3.connect(lpf);
  osc3.start(t);
  osc3.stop(t + totalDur + 0.1);

  // --- Vibrato LFO — slow pitch wobble for organic feel ---
  const vibrato = ctx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 3.5 + Math.random() * 1.5; // 3.5-5 Hz
  const vibGain = ctx.createGain();
  // Vibrato depth ramps in slowly (not present at note start)
  vibGain.gain.setValueAtTime(0, t);
  vibGain.gain.linearRampToValueAtTime(3, t + attack * 0.8); // ±3 cents
  vibGain.gain.linearRampToValueAtTime(1.5, t + totalDur);
  vibrato.connect(vibGain);
  vibGain.connect(osc1.detune);
  vibGain.connect(osc2.detune);
  vibGain.connect(osc3.detune);
  vibrato.start(t);
  vibrato.stop(t + totalDur + 0.1);

  // --- Sub-octave (quiet, adds depth on lower notes) ---
  if (freq < 250) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq * 0.5;
    const subG = ctx.createGain();
    subG.gain.value = 0.12;
    sub.connect(subG);
    subG.connect(lpf);
    sub.start(t);
    sub.stop(t + totalDur + 0.1);
  }
}

// Track which tier we're in so we can detect tier changes mid-phrase
let currentMelodyTier = null;

function scheduleNextNote() {
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    melodyTimeout = setTimeout(() => scheduleNextNote(), 2000);
    return;
  }

  const color = padTargetColor;
  const tier = getCurrentTier(color);

  // If tier changed mid-phrase, finish current phrase then switch
  if (currentMelodyTier !== tier && melodyStep === 0) {
    currentMelodyTier = tier;
  }
  const activeTier = currentMelodyTier || tier;

  const melodies = activeTier.melodies;
  const melody = melodies[melodyKey % melodies.length];
  const [freq, dur] = melody[melodyStep];

  // Phrase shaping: volume swells in the middle of a phrase
  const progress = melody.length > 1 ? melodyStep / (melody.length - 1) : 0.5;
  const phraseShape = 0.5 + 0.5 * Math.sin(progress * Math.PI);
  const vol = (activeTier.volBase + color * activeTier.volColor) * (0.5 + 0.5 * phraseShape);

  // Play this note as a pad voice
  playPadVoice(freq, dur, vol, color);

  // Advance
  melodyStep++;
  if (melodyStep >= melody.length) {
    // Phrase done — pause duration depends on tier (more color = shorter gaps)
    melodyStep = 0;
    melodyKey++;
    currentMelodyTier = null; // allow tier switch at next phrase
    const pause = activeTier.pauseMin + Math.random() * (activeTier.pauseMax - activeTier.pauseMin);
    melodyTimeout = setTimeout(() => scheduleNextNote(), pause);
  } else {
    // Next note overlaps the current — legato amount depends on tier
    const rubato = 1 + (Math.random() - 0.5) * 0.2;
    const spacing = dur * activeTier.legato * rubato * 1000;
    melodyTimeout = setTimeout(() => scheduleNextNote(), spacing);
  }
}

// Call every frame with world color (0-1)
export function updateAmbientDrone(worldColor) {
  currentWorldColor = worldColor;
  padTargetColor = worldColor;
  if (!ambNoiseLPF) return;

  const t = Math.min(worldColor, 1);
  // Noise bed: very present when gray, fades as color grows, almost gone when vibrant
  // LPF opens up slightly with color — less muffled, more airy
  ambNoiseLPF.frequency.value = 150 + t * 450;
  if (ambNoiseGain) {
    // Gray: loud hiss (0.015), vibrant: barely there (0.003)
    ambNoiseGain.gain.value = 0.015 - t * 0.012;
  }
}

// ============================
//  FOOTSTEPS
// ============================

export function updateFootsteps(dt, isMoving) {
  if (!isMoving) {
    stepTimer = STEP_INTERVAL * 0.8; // almost ready for next step when resuming
    return;
  }
  stepTimer += dt;
  if (stepTimer >= STEP_INTERVAL) {
    stepTimer -= STEP_INTERVAL;
    playFootstep();
  }
}

function playFootstep() {
  if (!ensureCtx()) return;

  // Soft tap — filtered noise burst
  const bufSize = ctx.sampleRate * 0.06;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800 + Math.random() * 400;

  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + 0.06);
}

// ============================
//  SEARCHING RUBBLE
// ============================

export function playSearchScrape() {
  if (!ensureCtx()) return;

  // Scraping/shuffling — filtered noise with envelope
  const dur = 0.3;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    // Gritty noise with tremolo
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * (0.5 + 0.5 * Math.sin(t * 60));
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 2;

  const gain = ctx.createGain();
  gain.gain.value = 0.1;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + dur);
}

// ============================
//  ITEM FOUND CHIME
// ============================

export function playItemFound(type) {
  if (!ensureCtx()) return;

  // Different pitches: sticker=high, plushie=mid, ingredient=low
  let freq;
  if (type === 'sticker') freq = 880;
  else if (type === 'plushie') freq = 587;
  else freq = 392;

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.15);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc2.start();
  osc.stop(ctx.currentTime + 0.4);
  osc2.stop(ctx.currentTime + 0.4);
}

// ============================
//  PHONE BUZZ
// ============================

export function playPhoneBuzz() {
  if (!ensureCtx()) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);

  // Second buzz after short gap
  setTimeout(() => {
    if (!ensureCtx()) return;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(150, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.1);
  }, 150);
}

// ============================
//  NOTIFICATION CHIME — ba-ding
// ============================

export function playNotificationChime() {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;

  // First tone — 800Hz sine, 80ms
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 800;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.1, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc1.connect(g1);
  g1.connect(masterGain);
  osc1.start(t);
  osc1.stop(t + 0.08);

  // Second tone — 1000Hz sine, 80ms, after 120ms gap
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 1000;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.1, t + 0.12);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc2.connect(g2);
  g2.connect(masterGain);
  osc2.start(t + 0.12);
  osc2.stop(t + 0.2);
}

// ============================
//  ACE WARNING BUZZ — urgent double-buzz
// ============================

export function playACEWarningBuzz() {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;

  // Low buzz 1
  const osc1 = ctx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.value = 120;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.08, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc1.connect(g1);
  g1.connect(masterGain);
  osc1.start(t);
  osc1.stop(t + 0.1);

  // Low buzz 2
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 120;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.08, t + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc2.connect(g2);
  g2.connect(masterGain);
  osc2.start(t + 0.15);
  osc2.stop(t + 0.25);
}

// ============================
//  DEAL COMPLETE — CHA-CHING
// ============================

export function playDealComplete() {
  if (!ensureCtx()) return;

  // Cash register cha-ching
  const t = ctx.currentTime;

  // Metallic ring
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(1200, t);
  osc1.frequency.exponentialRampToValueAtTime(2400, t + 0.05);

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.12, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(t);
  osc1.stop(t + 0.3);

  // Warm chord
  const chordFreqs = [523.25, 659.25, 783.99]; // C5, E5, G5
  for (const freq of chordFreqs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + 0.08);
    osc.stop(t + 0.6);
  }
}

// ============================
//  GACHA SOUNDS
// ============================

export function playGachaMachineRumble() {
  if (!ensureCtx()) return;

  // Mechanical rumble — low frequency modulated noise
  const dur = 2.0;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / ctx.sampleRate;
    // Rumble with clicking
    data[i] = (Math.random() * 2 - 1) * 0.5 *
      (0.3 + 0.7 * Math.abs(Math.sin(t * 12))) *
      (1 - Math.pow(t / dur, 2));
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  const gain = ctx.createGain();
  gain.gain.value = 0.12;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + dur);
}

export function playGachaRevealDrumroll() {
  if (!ensureCtx()) return;

  // Building drumroll — accelerating noise bursts
  const t = ctx.currentTime;
  for (let i = 0; i < 20; i++) {
    const delay = i * (0.08 - i * 0.003); // accelerating
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200 + i * 30;
    gain.gain.setValueAtTime(0.04 + i * 0.004, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + delay);
    osc.stop(t + delay + 0.05);
  }
}

export function playGachaRevealCymbal() {
  if (!ensureCtx()) return;

  // Cymbal crash — high frequency noise with long decay
  const dur = 1.5;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.value = 0.15;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + dur);

  // Impact tone
  const osc = ctx.createOscillator();
  const impGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 800;
  impGain.gain.setValueAtTime(0.1, ctx.currentTime);
  impGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(impGain);
  impGain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}


// ============================
//  COLOR SPREAD SHIMMER
// ============================

export function playColorSpread() {
  if (!ensureCtx()) return;

  // Soft shimmer — rising harmonics
  const t = ctx.currentTime;
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freqs[i];
    const delay = i * 0.06;
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.04, t + delay + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + delay);
    osc.stop(t + delay + 0.5);
  }
}

// ============================
//  NIGHT SOUNDS — CRICKETS & WIND
// ============================

export function startNightSounds() {
  if (!ensureCtx()) return;
  if (cricketInterval) return; // already playing

  // Wind — filtered noise
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  windNode = ctx.createBufferSource();
  windNode.buffer = buf;
  windNode.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.5;

  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windGain.gain.linearRampToValueAtTime(0.004, ctx.currentTime + 2);

  windNode.connect(filter);
  filter.connect(windGain);
  windGain.connect(masterGain);
  windNode.start();

  // Crickets — periodic chirps
  cricketInterval = setInterval(() => {
    if (!ensureCtx()) return;
    playCricketChirp();
  }, 800 + Math.random() * 1200);
}

function playCricketChirp() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const chirps = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chirps; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 4000 + Math.random() * 2000;
    const d = i * 0.06;
    gain.gain.setValueAtTime(0.0015, t + d);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.04);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + d);
    osc.stop(t + d + 0.04);
  }
}

export function stopNightSounds() {
  if (cricketInterval) {
    clearInterval(cricketInterval);
    cricketInterval = null;
  }
  if (windGain) {
    windGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    setTimeout(() => {
      try { if (windNode) windNode.stop(); } catch (e) {}
      windNode = null;
      windGain = null;
    }, 2000);
  }
}

// ============================
//  SLEEP SOUNDS
// ============================

export function playSleepFadeOut() {
  if (!ensureCtx()) return;
  // Fade master to silence
  masterGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.8);
}

export function playDawnBirds() {
  if (!ensureCtx()) return;
  // Restore master
  masterGain.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 1.0);

  // Bird chirps
  const t = ctx.currentTime + 0.3;
  for (let i = 0; i < 5; i++) {
    const delay = i * 0.3 + Math.random() * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 1800 + Math.random() * 1200;
    osc.frequency.setValueAtTime(baseFreq, t + delay);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, t + delay + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, t + delay + 0.15);
    gain.gain.setValueAtTime(0.05, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + delay);
    osc.stop(t + delay + 0.2);
  }
}

// ============================
//  PROGRESSION / VICTORY
// ============================

export function playProgressionChime() {
  if (!ensureCtx()) return;

  // Ascending chord — dramatic
  const t = ctx.currentTime;
  const notes = [261.6, 329.6, 392, 523.25]; // C4, E4, G4, C5
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = notes[i];
    const d = i * 0.12;
    gain.gain.setValueAtTime(0.08, t + d);
    gain.gain.linearRampToValueAtTime(0.06, t + d + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d + 1.0);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + d);
    osc.stop(t + d + 1.0);
  }
}

export function playVictorySwell() {
  if (!ensureCtx()) return;

  // Grand swell — full major chord building up
  const t = ctx.currentTime;
  const chord = [261.6, 329.6, 392, 523.25, 659.25, 783.99]; // C major across octaves
  for (let i = 0; i < chord.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i < 3 ? 'sine' : 'triangle';
    osc.frequency.value = chord[i];
    const d = i * 0.15;
    gain.gain.setValueAtTime(0, t + d);
    gain.gain.linearRampToValueAtTime(0.07, t + d + 0.5);
    gain.gain.linearRampToValueAtTime(0.05, t + d + 3.0);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d + 5.0);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t + d);
    osc.stop(t + d + 5.0);
  }

  // Shimmer sparkles
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      if (!ensureCtx()) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1000 + Math.random() * 3000;
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }, i * 400);
  }
}

// ============================
//  UI SOUNDS
// ============================

export function playUIClick() {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 600;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

export function playMenuOpen() {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.15);
}

export function playMenuClose() {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.12);
}
