// Street Musicians / Buskers — 2 NPCs that appear and play music when color returns
// Placed against building walls, facing the street
// Continuous looping melodies with proper Web Audio spatial panning
// Volume and filter based on distance — hear them from far, clear up close

import * as THREE from 'three';
import { getBuildingColors } from './color-system.js';
import { getTerrainHeight } from './world.js';
import { getGameHour } from './time-system.js';

const GRAY = new THREE.Color(0x808080);
const _c = new THREE.Color();

// Shared audio context
let ctx = null;
let masterOut = null;

function ensureAudio() {
  if (ctx && ctx.state !== 'closed') return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterOut = ctx.createGain();
    masterOut.gain.value = 0.35;
    masterOut.connect(ctx.destination);
    return true;
  } catch (e) {
    return false;
  }
}

// ============ COMPOSED MELODIES ============
// Each melody is an array of { freq, dur } — looped continuously
// Guitar: warm folk-style fingerpicking in G major
const GUITAR_MELODY = [
  // Phrase 1 — gentle ascending
  { freq: 196.00, dur: 0.6 },  // G3
  { freq: 246.94, dur: 0.4 },  // B3
  { freq: 293.66, dur: 0.5 },  // D4
  { freq: 329.63, dur: 0.7 },  // E4
  { freq: 293.66, dur: 0.4 },  // D4
  { freq: 246.94, dur: 0.6 },  // B3
  // Phrase 2 — descending with feeling
  { freq: 261.63, dur: 0.5 },  // C4
  { freq: 246.94, dur: 0.4 },  // B3
  { freq: 220.00, dur: 0.7 },  // A3
  { freq: 196.00, dur: 0.9 },  // G3
  // Phrase 3 — variation
  { freq: 246.94, dur: 0.5 },  // B3
  { freq: 329.63, dur: 0.6 },  // E4
  { freq: 392.00, dur: 0.8 },  // G4
  { freq: 329.63, dur: 0.5 },  // E4
  { freq: 293.66, dur: 0.6 },  // D4
  { freq: 246.94, dur: 0.4 },  // B3
  { freq: 220.00, dur: 0.6 },  // A3
  { freq: 196.00, dur: 1.2 },  // G3 — held
  // Brief pause (rest)
  { freq: 0, dur: 0.8 },
  // Phrase 4 — high melody
  { freq: 392.00, dur: 0.5 },  // G4
  { freq: 440.00, dur: 0.4 },  // A4
  { freq: 392.00, dur: 0.5 },  // G4
  { freq: 329.63, dur: 0.6 },  // E4
  { freq: 293.66, dur: 0.5 },  // D4
  { freq: 261.63, dur: 0.7 },  // C4
  { freq: 246.94, dur: 0.5 },  // B3
  { freq: 196.00, dur: 1.0 },  // G3 — resolve
  { freq: 0, dur: 1.2 },       // rest before loop
];

// Flute: dreamy pentatonic in C major
const FLUTE_MELODY = [
  { freq: 523.25, dur: 0.8 },  // C5
  { freq: 587.33, dur: 0.5 },  // D5
  { freq: 659.25, dur: 0.7 },  // E5
  { freq: 523.25, dur: 0.4 },  // C5
  { freq: 0, dur: 0.3 },       // breath
  { freq: 659.25, dur: 0.6 },  // E5
  { freq: 783.99, dur: 0.9 },  // G5
  { freq: 659.25, dur: 0.5 },  // E5
  { freq: 587.33, dur: 0.7 },  // D5
  { freq: 523.25, dur: 1.0 },  // C5 — held
  { freq: 0, dur: 0.5 },       // breath
  // Phrase 2
  { freq: 783.99, dur: 0.6 },  // G5
  { freq: 880.00, dur: 0.5 },  // A5
  { freq: 783.99, dur: 0.4 },  // G5
  { freq: 659.25, dur: 0.7 },  // E5
  { freq: 587.33, dur: 0.6 },  // D5
  { freq: 523.25, dur: 0.8 },  // C5
  { freq: 0, dur: 0.4 },       // breath
  // Phrase 3 — descending
  { freq: 880.00, dur: 0.7 },  // A5
  { freq: 783.99, dur: 0.5 },  // G5
  { freq: 659.25, dur: 0.6 },  // E5
  { freq: 587.33, dur: 0.5 },  // D5
  { freq: 523.25, dur: 1.2 },  // C5 — resolve
  { freq: 0, dur: 1.5 },       // long breath before loop
];

// ============ MUSICIAN DEFINITIONS ============
// Placed against building walls facing the street

const MUSICIAN_DEFS = [
  {
    // Guitar busker — outside building front face in Town
    // Building at x:6.6 z:21.6 w:7 d:7 → front wall at z = 21.6+3.5 = 25.1
    x: 5.0, z: 25.6, facingAngle: Math.PI, // facing -Z (toward street)
    district: 'town',
    bodyColor: 0xCC7744,
    hatColor: 0x664422,
    instrumentType: 'guitar',
    melody: GUITAR_MELODY,
  },
  {
    // Flute player — near player spawn in town
    x: 9.0, z: 13.0, facingAngle: -Math.PI / 2, // facing west toward street
    district: 'town',
    bodyColor: 0x5577AA,
    hatColor: 0x334466,
    instrumentType: 'flute',
    melody: FLUTE_MELODY,
  },
];

const musicians = [];

// ============ BUILD MUSICIAN MODEL ============

function buildMusicianModel(def) {
  const group = new THREE.Group();
  const y = getTerrainHeight(def.x, def.z);
  group.position.set(def.x, y, def.z);
  group.rotation.y = def.facingAngle;

  // Body
  const bodyMat = new THREE.MeshLambertMaterial({ color: GRAY.getHex() });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  // Head
  const headMat = new THREE.MeshLambertMaterial({ color: 0xFFDDBB });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), headMat);
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);

  // Hat / beret
  const hatMat = new THREE.MeshLambertMaterial({ color: GRAY.getHex() });
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.35), hatMat);
  hat.position.y = 1.5;
  group.add(hat);

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const lx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.2), legMat);
    leg.position.set(lx, 0.2, 0);
    group.add(leg);
  }

  // Arms
  const armMat = new THREE.MeshLambertMaterial({ color: GRAY.getHex() });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.15), armMat);
  armL.position.set(-0.32, 0.7, 0.05);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.15), armMat);
  armR.position.set(0.32, 0.7, 0.1);
  armR.rotation.x = -0.3; // reaching toward instrument
  group.add(armR);

  // Instrument
  let inst;
  if (def.instrumentType === 'guitar') {
    // Guitar body + neck
    const guitarBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.35, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x8B5E3C }),
    );
    guitarBody.position.set(0.15, 0.65, 0.2);
    guitarBody.rotation.z = -0.2;
    group.add(guitarBody);

    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.4, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x6B4226 }),
    );
    neck.position.set(0.22, 1.0, 0.2);
    neck.rotation.z = -0.2;
    group.add(neck);
    inst = guitarBody;
  } else {
    // Flute — horizontal tube held at mouth level
    const flute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6),
      new THREE.MeshLambertMaterial({ color: 0x889999 }),
    );
    flute.rotation.z = Math.PI / 2;
    flute.position.set(0.25, 1.15, 0.18);
    group.add(flute);
    inst = flute;
  }

  // Tip jar / hat on ground in front
  const jarMat = new THREE.MeshLambertMaterial({ color: 0x776655 });
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.08, 8), jarMat);
  jar.position.set(0, 0.04, 0.5);
  group.add(jar);

  // Small rug / mat underneath
  const rugMat = new THREE.MeshLambertMaterial({ color: 0x665544 });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.01, 0.7), rugMat);
  rug.position.set(0, 0.005, 0.15);
  group.add(rug);

  // Music note particles (floating above head)
  const noteGeo = new THREE.BufferGeometry();
  const noteCount = 8;
  const notePos = new Float32Array(noteCount * 3);
  for (let i = 0; i < noteCount; i++) {
    notePos[i * 3] = (Math.random() - 0.5) * 1.2;
    notePos[i * 3 + 1] = 1.7 + Math.random() * 1.0;
    notePos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
  }
  noteGeo.setAttribute('position', new THREE.BufferAttribute(notePos, 3));
  const noteMat = new THREE.PointsMaterial({
    color: 0xFFDD88,
    size: 0.14,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const notePoints = new THREE.Points(noteGeo, noteMat);
  group.add(notePoints);

  group.visible = false;

  return {
    group, bodyMat, hatMat, armMat, armL, armR,
    notePoints, noteMat,
    notePositions: noteGeo.attributes.position,
    noteCount,
    instrument: inst,
  };
}

// ============ SPATIAL AUDIO ENGINE ============
// Each musician gets a persistent gain + filter node.
// Distance controls gain and LPF cutoff — far away = quiet & muffled, close = clear.

function createMusicianAudio() {
  if (!ensureAudio()) return null;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 400;
  lpf.Q.value = 0.7;

  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

  if (pan) {
    gain.connect(lpf);
    lpf.connect(pan);
    pan.connect(masterOut);
  } else {
    gain.connect(lpf);
    lpf.connect(masterOut);
  }

  return { gain, lpf, pan };
}

function updateSpatialAudio(audio, mx, mz, px, pz) {
  if (!audio || !ctx) return 0;

  const dx = mx - px;
  const dz = mz - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Volume: inverse distance, max at 2 units, silent at 35
  let vol;
  if (dist > 35) vol = 0;
  else if (dist < 2) vol = 1;
  else vol = 1 - (dist - 2) / 33;

  // Squared falloff for more realistic feel
  vol = vol * vol;

  // Smoothly ramp gain
  const t = ctx.currentTime;
  audio.gain.gain.cancelScheduledValues(t);
  audio.gain.gain.setTargetAtTime(vol * 0.28, t, 0.1);

  // LPF: close = bright (2000 Hz), far = muffled (300 Hz)
  const cutoff = 300 + vol * 1700;
  audio.lpf.frequency.setTargetAtTime(cutoff, t, 0.1);

  // Stereo pan based on relative X position
  if (audio.pan) {
    const panVal = Math.max(-1, Math.min(1, dx / 15));
    audio.pan.pan.setTargetAtTime(panVal, t, 0.1);
  }

  return vol;
}

// Play a single note on a musician's audio chain
function playNote(audio, freq, dur, type, instrumentType) {
  if (!ctx || !audio || freq === 0) return;
  const t = ctx.currentTime;

  if (instrumentType === 'guitar') {
    // Plucked string: triangle wave + fast decay
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 6;

    // Second detuned osc for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.003;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(0.6, t + 0.008); // sharp attack
    noteGain.gain.exponentialRampToValueAtTime(0.15, t + dur * 0.3);
    noteGain.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.2);

    osc.connect(noteGain);
    osc2.connect(noteGain);
    noteGain.connect(audio.gain);

    osc.start(t);
    osc.stop(t + dur + 0.3);
    osc2.start(t);
    osc2.stop(t + dur + 0.3);
  } else {
    // Flute: sine with vibrato, gentle attack
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5 + Math.random();
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Breathy noise layer
    const bufLen = Math.ceil(ctx.sampleRate * (dur + 0.3));
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) noiseData[i] = (Math.random() - 0.5) * 0.15;
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuf;
    const noiseLPF = ctx.createBiquadFilter();
    noiseLPF.type = 'bandpass';
    noiseLPF.frequency.value = freq * 2;
    noiseLPF.Q.value = 2;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(0.45, t + 0.06); // gentle attack
    noteGain.gain.setValueAtTime(0.45, t + dur * 0.7);
    noteGain.gain.linearRampToValueAtTime(0, t + dur + 0.15);

    osc.connect(noteGain);
    noiseNode.connect(noiseLPF);
    noiseLPF.connect(noteGain);
    noteGain.connect(audio.gain);

    osc.start(t);
    osc.stop(t + dur + 0.2);
    lfo.start(t);
    lfo.stop(t + dur + 0.2);
    noiseNode.start(t);
    noiseNode.stop(t + dur + 0.2);
  }
}

// ============ CREATE / UPDATE ============

export function createMusicians(scene) {
  for (const def of MUSICIAN_DEFS) {
    const model = buildMusicianModel(def);
    scene.add(model.group);

    musicians.push({
      ...model,
      def,
      localColor: 0,
      audio: null, // created on first activation
      melodyIndex: 0,
      noteTimer: 0,
      bobPhase: Math.random() * Math.PI * 2,
      active: false,
    });
  }
}

let colorTimer = 0;
let playerPos = null;

export function updateMusicians(dt, elapsed, pPos) {
  playerPos = pPos;
  const hour = getGameHour();
  const isDaytime = hour >= 7 && hour < 17.5;

  // Refresh local color every 3 seconds
  colorTimer += dt;
  if (colorTimer >= 3) {
    colorTimer = 0;
    refreshMusicianColors();
  }

  for (const m of musicians) {
    const shouldBeActive = isDaytime && m.localColor > 0.4;

    if (shouldBeActive && !m.active) {
      m.active = true;
      m.group.visible = true;
      // Create audio chain on first activation
      if (!m.audio) m.audio = createMusicianAudio();
    } else if (!shouldBeActive && m.active) {
      m.active = false;
      m.group.visible = false;
      // Silence
      if (m.audio && ctx) {
        m.audio.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
    }

    if (!m.active) continue;

    // Update spatial audio based on player distance
    let audibleVol = 0;
    if (playerPos && m.audio) {
      audibleVol = updateSpatialAudio(m.audio, m.def.x, m.def.z, playerPos.x, playerPos.z);
    }

    // Color the body + hat
    _c.copy(GRAY).lerp(new THREE.Color(m.def.bodyColor), m.localColor);
    m.bodyMat.color.copy(_c);
    m.armMat.color.copy(_c);
    _c.copy(GRAY).lerp(new THREE.Color(m.def.hatColor), m.localColor);
    m.hatMat.color.copy(_c);

    // Body bob / sway while playing
    const sway = Math.sin(elapsed * 1.8 + m.bobPhase);
    m.group.children[0].rotation.z = sway * 0.04; // body rock
    // Right arm strumming / fingering motion
    m.armR.rotation.x = -0.3 + Math.sin(elapsed * 3.5 + m.bobPhase) * 0.15;
    // Head gentle nod
    m.group.children[1].rotation.x = Math.sin(elapsed * 0.9 + m.bobPhase) * 0.04;

    // Music note particles
    const noteOpacity = Math.min(0.8, (m.localColor - 0.4) * 2.5) * Math.min(1, audibleVol * 3);
    m.noteMat.opacity = noteOpacity;
    m.noteMat.color.setHex(m.localColor > 0.7 ? 0xFFDD88 : 0xBBBBAA);
    for (let i = 0; i < m.noteCount; i++) {
      let ny = m.notePositions.getY(i);
      ny += dt * 0.35;
      if (ny > 3.0) {
        ny = 1.7;
        m.notePositions.setX(i, (Math.random() - 0.5) * 1.2);
        m.notePositions.setZ(i, (Math.random() - 0.5) * 0.8);
      }
      m.notePositions.setY(i, ny);
    }
    m.notePositions.needsUpdate = true;

    // === Play melody notes continuously ===
    if (m.audio && ctx && ctx.state === 'running' && audibleVol > 0.01) {
      m.noteTimer -= dt;
      if (m.noteTimer <= 0) {
        const note = m.def.melody[m.melodyIndex];
        m.melodyIndex = (m.melodyIndex + 1) % m.def.melody.length;

        if (note.freq > 0) {
          playNote(m.audio, note.freq, note.dur, 'note', m.def.instrumentType);
        }
        m.noteTimer = note.dur;
      }
    }
  }
}

function refreshMusicianColors() {
  const buildings = getBuildingColors();
  for (const m of musicians) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - m.def.x;
      const dz = b.z - m.def.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    m.localColor = weight > 0 ? total / weight : 0;
  }
}
