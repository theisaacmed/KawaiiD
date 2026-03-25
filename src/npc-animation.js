// NPC procedural animation — walk cycle, idle breathing, activity poses,
// blinking, head tracking, player awareness, kawaii bounce
// Drives the named body parts created by npc-models.js

import { getRelationship } from './npc.js';

// ============================================================
// WALK CYCLE CONSTANTS
// ============================================================
const LEG_SWING = 0.45;
const ARM_SWING = 0.30;
const BODY_BOB = 0.045;   // bouncier than before (was 0.030)
const CYCLE_SPEED = 4.0;

// Idle breathing
const BREATH_SCALE = 0.008;
const BREATH_SPEED = 0.65;

// Player awareness radii
const HEAD_TRACK_DIST = 8;
const WAVE_ENTER_DIST = 6;
const WAVE_EXIT_DIST = 10;

// ============================================================
// PER-NPC ANIMATION STATE
// ============================================================

function getAnimState(npc) {
  if (!npc._animState) {
    npc._animState = {
      walkPhase: 0,
      breathPhase: 0,
      isMoving: false,
      prevX: 0,
      prevZ: 0,
      moveDist: 0,

      // Blinking
      blinkTimer: 2 + Math.random() * 4,
      blinkPhase: 0,

      // Per-NPC offset for desync
      idOffset: Math.random() * 100,

      // Walk start/stop bounce
      wasWalking: false,
      bouncePhase: 0,
      startBounce: 0,

      // Player awareness
      playerWasNear: false,
      waveTimer: 0,
      headTrackY: 0,     // smoothed head tracking yaw
      headTrackX: 0,     // smoothed head tracking pitch

      // Activity pose lerp
      activityLerpArms: 0,
      activityLerpLegs: 0,
      activityLerpTorso: 0,
      activityLerpHead: 0,
      socializeGestureTimer: 0,
      eatBobPhase: 0,
    };
  }
  return npc._animState;
}

// ============================================================
// BLINKING — called every frame for all visible NPCs
// ============================================================

function updateBlink(parts, s, dt) {
  if (!parts.eyeL || !parts.eyeR) return;

  s.blinkTimer -= dt;
  if (s.blinkTimer <= 0) {
    s.blinkPhase = 0.15;
    s.blinkTimer = 2.5 + Math.random() * 4;
  }

  if (s.blinkPhase > 0) {
    s.blinkPhase -= dt;
    // Squeeze eyes shut at midpoint of blink
    const t = s.blinkPhase / 0.15;
    const squish = t < 0.5 ? (1.0 - t * 2 * 0.9) : (0.1 + (t - 0.5) * 2 * 0.9);
    parts.eyeL.scale.y = squish;
    parts.eyeR.scale.y = squish;
  } else {
    // Restore to base (relLevel eye scale applied elsewhere)
    parts.eyeL.scale.y = parts.eyeL.scale.x;
    parts.eyeR.scale.y = parts.eyeR.scale.x;
  }
}

// ============================================================
// WALK CYCLE — bouncier with hip sway + head nod
// ============================================================

function updateWalkCycle(parts, s, dt, speed) {
  if (!parts || !parts.leftLegPivot) return;

  const spd = speed || 1.8;
  const cycleSpeed = spd * CYCLE_SPEED * dt;
  s.walkPhase += cycleSpeed;

  const phase = s.walkPhase;
  const speedFactor = Math.min(1, spd / 1.8);
  const ampScale = speedFactor * 0.7 + 0.3; // min 30% amplitude

  const legSwing = Math.sin(phase) * LEG_SWING * ampScale;
  const armSwing = Math.sin(phase) * ARM_SWING * ampScale;

  // Legs alternate
  parts.leftLegPivot.rotation.x = legSwing;
  parts.rightLegPivot.rotation.x = -legSwing;

  // Arms swing opposite to legs
  parts.leftArmPivot.rotation.x = -armSwing;
  parts.rightArmPivot.rotation.x = armSwing;

  // Slight forearm bend at back of swing for natural feel
  if (parts.leftArmMesh) {
    parts.leftArmMesh.rotation.x = Math.max(0, Math.sin(phase) * 0.2);
  }
  if (parts.rightArmMesh) {
    parts.rightArmMesh.rotation.x = Math.max(0, -Math.sin(phase) * 0.2);
  }

  // Bouncier body bob
  const bob = Math.abs(Math.sin(phase * 2)) * BODY_BOB * ampScale;
  parts.torso.position.y = parts.baseTorsoY + bob;
  parts.head.position.y = parts.baseHeadY + bob;

  // Hip sway
  parts.torso.rotation.z = Math.sin(phase) * 0.03 * ampScale;

  // Gentle head nod with steps
  parts.head.rotation.x = Math.sin(phase * 2) * 0.015 * ampScale;
}

// ============================================================
// IDLE BREATHING — with weight shift + head look-around
// ============================================================

function updateIdleBreathing(parts, s, dt) {
  if (!parts || !parts.torso) return;

  s.breathPhase += BREATH_SPEED * dt;
  const bp = s.breathPhase;

  // Gently rest limbs back toward neutral
  parts.leftLegPivot.rotation.x *= 0.90;
  parts.rightLegPivot.rotation.x *= 0.90;
  parts.leftArmPivot.rotation.x *= 0.90;
  parts.rightArmPivot.rotation.x *= 0.90;
  parts.leftArmPivot.rotation.z = 0;
  parts.rightArmPivot.rotation.z = 0;

  // Reset arm mesh bend
  if (parts.leftArmMesh) parts.leftArmMesh.rotation.x *= 0.9;
  if (parts.rightArmMesh) parts.rightArmMesh.rotation.x *= 0.9;

  // Breathing scale
  const breathScale = 1.0 + Math.sin(bp * Math.PI * 2) * BREATH_SCALE;
  parts.torso.scale.y = breathScale;

  // Return torso and head Y to base
  parts.torso.position.y += (parts.baseTorsoY - parts.torso.position.y) * Math.min(1, dt * 6);
  parts.head.position.y += (parts.baseHeadY - parts.head.position.y) * Math.min(1, dt * 6);

  // Weight shift — subtle side-to-side lean
  parts.torso.rotation.z = Math.sin(bp * 0.4) * 0.03;
  parts.head.rotation.z = Math.sin(bp * 0.35) * 0.02;

  // Head look-around (layered sin waves, desynchronized per NPC)
  const off = s.idOffset;
  parts.head.rotation.y = Math.sin(bp * 0.5 + off) * 0.12 + Math.sin(bp * 0.17 + off * 2) * 0.06;
  parts.head.rotation.x = Math.sin(bp * 0.3 + off * 1.5) * 0.04;
}

// ============================================================
// ACTIVITY POSES — distinct body language per activity
// ============================================================

const ACTIVITY_POSES = {
  sitting: {
    leftLeg: -1.4, rightLeg: -1.4,
    leftArm: -0.8, rightArm: -0.8,
    torsoX: 0.05, headX: 0,
  },
  eating: {
    leftLeg: -1.4, rightLeg: -1.4,
    leftArm: -0.8, rightArm: -1.2,
    torsoX: 0.05, headX: -0.05,
  },
  working: {
    leftLeg: 0, rightLeg: 0,
    leftArm: -0.5, rightArm: -0.5,
    torsoX: 0.1, headX: 0.05,
  },
  sleeping: {
    leftLeg: 0, rightLeg: 0,
    leftArm: 0.1, rightArm: 0.1,
    torsoX: 0.35, headX: 0.4,
  },
};

function updateActivityPose(parts, s, dt, activity) {
  if (!parts || !parts.torso) return;

  s.breathPhase += BREATH_SPEED * dt;
  const bp = s.breathPhase;
  const lerpRate = Math.min(1, dt * 4);

  const pose = ACTIVITY_POSES[activity];

  if (activity === 'socializing') {
    // More animated idle — wider head turns, occasional arm gestures
    updateIdleBreathing(parts, s, dt);
    // Override head rotation with wider amplitude
    const off = s.idOffset;
    parts.head.rotation.y = Math.sin(bp * 0.5 + off) * 0.25 + Math.sin(bp * 0.17 + off * 2) * 0.1;

    // Occasional arm gesture
    s.socializeGestureTimer -= dt;
    if (s.socializeGestureTimer <= 0) {
      s.socializeGestureTimer = 4 + Math.random() * 5;
    }
    if (s.socializeGestureTimer < 0.6) {
      parts.rightArmPivot.rotation.x = -1.5 * (s.socializeGestureTimer / 0.6);
      parts.rightArmPivot.rotation.z = Math.sin(s.socializeGestureTimer * 12) * 0.2;
    }
    return;
  }

  if (!pose) {
    // Unknown activity — fallback to idle
    updateIdleBreathing(parts, s, dt);
    return;
  }

  // Lerp limbs toward target pose
  parts.leftLegPivot.rotation.x += (pose.leftLeg - parts.leftLegPivot.rotation.x) * lerpRate;
  parts.rightLegPivot.rotation.x += (pose.rightLeg - parts.rightLegPivot.rotation.x) * lerpRate;
  parts.leftArmPivot.rotation.x += (pose.leftArm - parts.leftArmPivot.rotation.x) * lerpRate;
  parts.rightArmPivot.rotation.x += (pose.rightArm - parts.rightArmPivot.rotation.x) * lerpRate;
  parts.leftArmPivot.rotation.z = 0;
  parts.rightArmPivot.rotation.z = 0;

  // Torso and head
  parts.torso.rotation.x += (pose.torsoX - parts.torso.rotation.x) * lerpRate;
  parts.head.rotation.x += (pose.headX - parts.head.rotation.x) * lerpRate;
  parts.torso.rotation.z *= 0.9;
  parts.head.rotation.z *= 0.9;
  parts.head.rotation.y *= 0.9;

  // Return positions to base
  parts.torso.position.y += (parts.baseTorsoY - parts.torso.position.y) * Math.min(1, dt * 6);
  parts.head.position.y += (parts.baseHeadY - parts.head.position.y) * Math.min(1, dt * 6);

  // Subtle breathing in all poses
  const breathScale = 1.0 + Math.sin(bp * Math.PI * 2) * BREATH_SCALE * 0.5;
  parts.torso.scale.y = breathScale;

  // Sleeping: close eyes
  if (activity === 'sleeping') {
    if (parts.eyeL) parts.eyeL.scale.y = 0.05;
    if (parts.eyeR) parts.eyeR.scale.y = 0.05;
  }

  // Eating: arm bob
  if (activity === 'eating') {
    s.eatBobPhase += dt * 2.5;
    parts.rightArmPivot.rotation.x = -1.2 + Math.sin(s.eatBobPhase) * 0.15;
    parts.rightArmPivot.rotation.z = 0.3;
  }
}

// ============================================================
// KAWAII BOUNCE — on walk start/stop transitions
// ============================================================

function updateBounce(parts, s, dt) {
  // Settle bounce (walk → idle)
  if (s.bouncePhase > 0) {
    s.bouncePhase -= dt;
    const t = s.bouncePhase / 0.4;
    const bounce = Math.sin((1 - t) * Math.PI * 3) * 0.04 * t;
    parts.torso.position.y += bounce;
    parts.head.position.y += bounce;
  }

  // Start pop (idle → walk)
  if (s.startBounce > 0) {
    s.startBounce -= dt;
    const t = s.startBounce / 0.2;
    const pop = Math.sin(t * Math.PI) * 0.03;
    parts.torso.position.y += pop;
    parts.head.position.y += pop;
  }
}

// ============================================================
// HEAD TRACKING — NPCs look toward the player when nearby
// ============================================================

function updateHeadTracking(parts, s, npc, playerPos, dt) {
  if (!playerPos || !parts.head) return;

  const dx = playerPos.x - npc.worldPos.x;
  const dz = playerPos.z - npc.worldPos.z;
  const distSq = dx * dx + dz * dz;

  const relLevel = getRelLevel(npc);

  // Only track player if they're close enough and rel >= 1
  if (distSq < HEAD_TRACK_DIST * HEAD_TRACK_DIST && relLevel >= 1) {
    // Angle from NPC to player in world space
    const worldAngle = Math.atan2(dx, dz);
    // Convert to NPC local space (subtract body rotation)
    let localAngle = worldAngle - npc.group.rotation.y;
    // Normalize to [-PI, PI]
    while (localAngle > Math.PI) localAngle -= Math.PI * 2;
    while (localAngle < -Math.PI) localAngle += Math.PI * 2;

    // Clamp to ±0.6 rad (~34 degrees) so no owl-neck
    const targetY = Math.max(-0.6, Math.min(0.6, localAngle));

    // Vertical look: slight pitch based on height difference
    const dy = 1.5 - npc.worldPos.y; // approximate eye height
    const dist = Math.sqrt(distSq);
    const targetX = Math.max(-0.2, Math.min(0.2, Math.atan2(dy, dist) * 0.3));

    // Smooth toward target
    s.headTrackY += (targetY - s.headTrackY) * Math.min(1, dt * 4);
    s.headTrackX += (targetX - s.headTrackX) * Math.min(1, dt * 4);

    parts.head.rotation.y = s.headTrackY;
    parts.head.rotation.x += s.headTrackX;
  } else {
    // Decay tracking when player is far
    s.headTrackY *= 0.95;
    s.headTrackX *= 0.95;
  }
}

// ============================================================
// WAVE GESTURE — triggered when player approaches
// ============================================================

function updateWave(parts, s, npc, playerPos, dt) {
  if (!playerPos || !parts.rightArmPivot) return;

  const dx = playerPos.x - npc.worldPos.x;
  const dz = playerPos.z - npc.worldPos.z;
  const distSq = dx * dx + dz * dz;

  const relLevel = getRelLevel(npc);

  // Detect approach
  const isNear = distSq < WAVE_ENTER_DIST * WAVE_ENTER_DIST;
  const isFar = distSq > WAVE_EXIT_DIST * WAVE_EXIT_DIST;

  if (isNear && !s.playerWasNear && relLevel >= 1) {
    // Player just entered wave range
    s.waveTimer = relLevel >= 5 ? 1.0 : 0.8;  // longer wave for best friends
    s.playerWasNear = true;

    // Excited bounce for high relationship
    if (relLevel >= 3) {
      s.bouncePhase = 0.4;
    }
  }
  if (isFar) {
    s.playerWasNear = false;
  }

  // Execute wave animation
  if (s.waveTimer > 0) {
    s.waveTimer -= dt;
    const t = s.waveTimer;

    if (relLevel >= 5) {
      // Both arms wave for best friends
      parts.rightArmPivot.rotation.x = -2.2;
      parts.rightArmPivot.rotation.z = Math.sin(t * 16) * 0.3;
      parts.leftArmPivot.rotation.x = -2.2;
      parts.leftArmPivot.rotation.z = -Math.sin(t * 16) * 0.3;
    } else {
      // Single arm wave
      parts.rightArmPivot.rotation.x = -2.2;
      parts.rightArmPivot.rotation.z = Math.sin(t * 16) * 0.3;
    }
  }
}

// ============================================================
// HELPER — get relationship level for NPC
// ============================================================

function getRelLevel(npc) {
  try {
    const rel = getRelationship(npc.name);
    return rel ? Math.floor(rel.level) : 0;
  } catch {
    return 0;
  }
}

// ============================================================
// MAIN ANIMATION LOOP — call from npc.js updateNPCs()
// Now accepts playerPos for head tracking and wave
// ============================================================

export function animateNPCs(npcs, dt, playerPos) {
  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    if (!npc.parts) continue;

    const s = getAnimState(npc);
    const parts = npc.parts;
    const activity = npc.currentActivity;

    // --- Detect walk state transitions for bounce ---
    if (npc.isWalking && !s.wasWalking) {
      s.startBounce = 0.2; // walk start pop
    }
    if (!npc.isWalking && s.wasWalking) {
      s.bouncePhase = 0.4; // settle bounce
    }
    s.wasWalking = npc.isWalking;

    // --- Main animation branch ---
    if (npc.isWalking) {
      updateWalkCycle(parts, s, dt, npc.walkSpeed || 1.8);
    } else if (activity && activity !== 'idle' && activity !== 'wandering' && ACTIVITY_POSES[activity] || activity === 'socializing') {
      updateActivityPose(parts, s, dt, activity);
    } else {
      updateIdleBreathing(parts, s, dt);
    }

    // --- Always-on effects ---
    // Blinking (skip during sleep — eyes are closed)
    if (activity !== 'sleeping') {
      updateBlink(parts, s, dt);
    }

    // Kawaii bounce
    updateBounce(parts, s, dt);

    // Player awareness (head tracking + wave)
    if (playerPos) {
      updateHeadTracking(parts, s, npc, playerPos, dt);
      updateWave(parts, s, npc, playerPos, dt);
    }
  }
}

// ============================================================
// LABEL VISIBILITY — hide labels beyond 15 units from player
// ============================================================

export function updateNPCLabels(npcs, playerPos, dealAvailableCheck) {
  const LABEL_DIST = 15;
  const LABEL_DIST_SQ = LABEL_DIST * LABEL_DIST;

  for (const npc of npcs) {
    if (!npc.labelSprite) continue;

    const dx = npc.worldPos.x - playerPos.x;
    const dz = npc.worldPos.z - playerPos.z;
    const distSq = dx * dx + dz * dz;

    npc.labelSprite.visible = (distSq < LABEL_DIST_SQ) && npc.group.visible;

    // Show "!" indicator if a deal is available
    if (npc.dealIndicator) {
      const hasDeal = dealAvailableCheck ? dealAvailableCheck(npc) : false;
      npc.dealIndicator.visible = hasDeal && npc.labelSprite.visible;
    }
  }
}
