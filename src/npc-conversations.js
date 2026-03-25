// NPC Pair Conversations — when two NPCs are near each other,
// they face each other and show speech bubble particles
// Adds social life to the city without complex dialogue AI

import * as THREE from 'three';
import { getGameHour } from './time-system.js';

const CONVO_RANGE = 5;          // how close NPCs must be to start a conversation
const CONVO_MIN_DURATION = 6;   // minimum seconds a conversation lasts
const CONVO_MAX_DURATION = 15;  // maximum seconds
const CONVO_COOLDOWN = 30;      // seconds before same pair can converse again
const CHECK_INTERVAL = 2;       // seconds between scanning for new conversations
const BUBBLE_RISE_SPEED = 0.6;
const BUBBLE_MAX_Y = 1.2;       // above NPC head

const _v = new THREE.Vector3();
const GRAY = new THREE.Color(0x808080);

// Active conversations: { npcA, npcB, timer, duration, bubbleA, bubbleB }
const activeConvos = [];

// Cooldown map: `${nameA}-${nameB}` => timestamp when cooldown expires
const cooldowns = {};

// Speech bubble pool
const bubblePool = [];
let sceneRef = null;

function createBubble() {
  const group = new THREE.Group();

  // Bubble background (rounded box approximation)
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0,
  });
  const bg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.05), bgMat);
  group.add(bg);

  // Dot particles inside bubble (simulates "..." talking)
  const dotGeo = new THREE.BufferGeometry();
  const dotPos = new Float32Array(3 * 3); // 3 dots
  dotPos[0] = -0.08; dotPos[1] = 0; dotPos[2] = 0.03;
  dotPos[3] = 0;     dotPos[4] = 0; dotPos[5] = 0.03;
  dotPos[6] = 0.08;  dotPos[7] = 0; dotPos[8] = 0.03;
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));

  const dotMat = new THREE.PointsMaterial({
    color: 0x666666,
    size: 0.06,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dots = new THREE.Points(dotGeo, dotMat);
  group.add(dots);

  // Small triangle pointer at bottom
  const triGeo = new THREE.BufferGeometry();
  const triVerts = new Float32Array([
    -0.04, -0.1, 0.025,
     0.04, -0.1, 0.025,
     0,    -0.18, 0.025,
  ]);
  triGeo.setAttribute('position', new THREE.BufferAttribute(triVerts, 3));
  const triMat = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const tri = new THREE.Mesh(triGeo, triMat);
  group.add(tri);

  group.visible = false;

  return { group, bgMat, dotMat, triMat, phase: Math.random() * Math.PI * 2 };
}

function getBubble() {
  // Try to reuse a hidden bubble
  for (const b of bubblePool) {
    if (!b.group.visible) return b;
  }
  // Create new if needed
  const b = createBubble();
  if (sceneRef) sceneRef.add(b.group);
  bubblePool.push(b);
  return b;
}

function showBubble(bubble, npc) {
  bubble.group.visible = true;
  bubble.group.position.set(0, 1.7, 0);
  // Attach to NPC group
  npc.group.add(bubble.group);
}

function hideBubble(bubble) {
  if (bubble.group.parent) {
    bubble.group.parent.remove(bubble.group);
    sceneRef.add(bubble.group); // return to scene root
  }
  bubble.group.visible = false;
  bubble.bgMat.opacity = 0;
  bubble.dotMat.opacity = 0;
  bubble.triMat.opacity = 0;
}

function getPairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// ============ MAIN EXPORTS ============

let checkTimer = 0;
let npcsRef = null;

export function initConversations(scene, npcs) {
  sceneRef = scene;
  npcsRef = npcs;

  // Pre-create a small pool
  for (let i = 0; i < 8; i++) {
    const b = createBubble();
    scene.add(b.group);
    bubblePool.push(b);
  }
}

export function updateConversations(dt, elapsed) {
  if (!npcsRef) return;

  const hour = getGameHour();
  const isDaytime = hour >= 6.5 && hour < 17.5;

  // Update existing conversations
  for (let i = activeConvos.length - 1; i >= 0; i--) {
    const convo = activeConvos[i];
    convo.timer += dt;

    // Update bubble animation
    updateBubbleAnim(convo.bubbleA, dt, elapsed, convo.timer, convo.duration, true);
    updateBubbleAnim(convo.bubbleB, dt, elapsed, convo.timer, convo.duration, false);

    // Make NPCs face each other
    faceEachOther(convo.npcA, convo.npcB, dt);

    // End conversation
    if (convo.timer >= convo.duration || !convo.npcA.group.visible || !convo.npcB.group.visible) {
      hideBubble(convo.bubbleA);
      hideBubble(convo.bubbleB);
      const key = getPairKey(convo.npcA.name, convo.npcB.name);
      cooldowns[key] = elapsed + CONVO_COOLDOWN;
      convo.npcA._inConvo = false;
      convo.npcB._inConvo = false;
      activeConvos.splice(i, 1);
    }
  }

  if (!isDaytime) return;

  // Scan for new conversations periodically
  checkTimer += dt;
  if (checkTimer < CHECK_INTERVAL) return;
  checkTimer = 0;

  // Find NPC pairs that are close and visible
  for (let a = 0; a < npcsRef.length; a++) {
    const npcA = npcsRef[a];
    if (!npcA.group.visible || !npcA.isAvailable || npcA._inConvo) continue;

    for (let b = a + 1; b < npcsRef.length; b++) {
      const npcB = npcsRef[b];
      if (!npcB.group.visible || !npcB.isAvailable || npcB._inConvo) continue;

      // Check distance
      const dx = npcA.worldPos.x - npcB.worldPos.x;
      const dz = npcA.worldPos.z - npcB.worldPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > CONVO_RANGE) continue;

      // Check cooldown
      const key = getPairKey(npcA.name, npcB.name);
      if (cooldowns[key] && elapsed < cooldowns[key]) continue;

      // 30% chance per check to start a convo (not every close pair talks all the time)
      if (Math.random() > 0.3) continue;

      // Start conversation
      const bubbleA = getBubble();
      const bubbleB = getBubble();
      showBubble(bubbleA, npcA);
      showBubble(bubbleB, npcB);

      npcA._inConvo = true;
      npcB._inConvo = true;

      activeConvos.push({
        npcA,
        npcB,
        timer: 0,
        duration: CONVO_MIN_DURATION + Math.random() * (CONVO_MAX_DURATION - CONVO_MIN_DURATION),
        bubbleA,
        bubbleB,
      });

      break; // one new convo per scan per NPC
    }
  }
}

function updateBubbleAnim(bubble, dt, elapsed, timer, duration, isLeft) {
  // Fade in / out
  const fadeIn = Math.min(1, timer / 0.5);
  const fadeOut = Math.min(1, (duration - timer) / 0.5);
  const opacity = Math.min(fadeIn, fadeOut) * 0.85;

  bubble.bgMat.opacity = opacity;
  bubble.triMat.opacity = opacity;

  // Dots animate in alternation — one NPC "talks" at a time
  const talkCycle = Math.floor(elapsed * 0.5) % 2;
  const isTalking = isLeft ? talkCycle === 0 : talkCycle === 1;

  if (isTalking) {
    // Dots pulse
    const pulse = Math.sin(elapsed * 6 + bubble.phase);
    bubble.dotMat.opacity = opacity * (0.5 + pulse * 0.3);
    bubble.dotMat.size = 0.05 + Math.abs(pulse) * 0.03;
  } else {
    bubble.dotMat.opacity = opacity * 0.15;
    bubble.dotMat.size = 0.04;
  }

  // Gentle float
  bubble.group.position.y = 1.7 + Math.sin(elapsed * 1.2 + bubble.phase) * 0.04;
}

function faceEachOther(npcA, npcB, dt) {
  // Smoothly rotate NPCs to face each other
  const ax = npcA.worldPos.x;
  const az = npcA.worldPos.z;
  const bx = npcB.worldPos.x;
  const bz = npcB.worldPos.z;

  const angleAtoB = Math.atan2(bx - ax, bz - az);
  const angleBtoA = Math.atan2(ax - bx, az - bz);

  // Smooth rotation (lerp toward target)
  const lerpSpeed = dt * 3;
  npcA.group.rotation.y += shortAngleDist(npcA.group.rotation.y, angleAtoB) * lerpSpeed;
  npcB.group.rotation.y += shortAngleDist(npcB.group.rotation.y, angleBtoA) * lerpSpeed;
}

function shortAngleDist(from, to) {
  const diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  return diff < -Math.PI ? diff + Math.PI * 2 : diff;
}
