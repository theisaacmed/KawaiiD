// NPC procedural animation — walk cycle, idle breathing, sitting
// Drives the named body parts created by npc-models.js

// Walk cycle constants
const LEG_SWING = 0.45;   // max rotation (radians) for each leg
const ARM_SWING = 0.30;   // max rotation for each arm
const BODY_BOB = 0.030;   // vertical torso bob amplitude (units)
const CYCLE_SPEED = 4.0;  // walk cycle speed multiplier (radians per unit of movement)

// Idle breathing constants
const BREATH_SCALE = 0.008;   // ±0.8% torso Y scale
const BREATH_SPEED = 0.65;    // cycles per second (3-second period at 0.33)

// ============================================================
// Per-NPC animation state — stored on the npc object itself
// as npc._animState to avoid a separate map
// ============================================================

function getAnimState(npc) {
  if (!npc._animState) {
    npc._animState = {
      walkPhase: 0,       // current phase in the walk cycle (radians)
      breathPhase: 0,     // idle breathing phase
      isMoving: false,
      prevX: 0,
      prevZ: 0,
      moveDist: 0,        // accumulated movement distance for cycle timing
    };
  }
  return npc._animState;
}

// ============================================================
// UPDATE WALK CYCLE
// Call this every frame when npc.isWalking is true.
// parts = npc.parts (from buildNPCModel)
// dt = delta time in seconds
// ============================================================

export function updateWalkCycle(parts, animState, dt, speed) {
  if (!parts || !parts.leftLegPivot) return;

  // Advance phase based on movement speed
  const cycleSpeed = (speed || 1.8) * CYCLE_SPEED * dt;
  animState.walkPhase += cycleSpeed;

  const phase = animState.walkPhase;
  const legSwing = Math.sin(phase) * LEG_SWING;
  const armSwing = Math.sin(phase) * ARM_SWING;

  // Legs alternate
  parts.leftLegPivot.rotation.x = legSwing;
  parts.rightLegPivot.rotation.x = -legSwing;

  // Arms swing opposite to legs
  parts.leftArmPivot.rotation.x = -armSwing;
  parts.rightArmPivot.rotation.x = armSwing;

  // Torso bobs up (using abs of sin at double frequency for smooth double-dip)
  const bob = Math.abs(Math.sin(phase * 2)) * BODY_BOB;
  parts.torso.position.y = parts.baseTorsoY + bob;
  parts.head.position.y = parts.baseHeadY + bob;
}

// ============================================================
// UPDATE IDLE BREATHING
// Call this when npc.isWalking is false.
// ============================================================

export function updateIdleBreathing(parts, animState, dt) {
  if (!parts || !parts.torso) return;

  animState.breathPhase += BREATH_SPEED * dt;

  // Gently rest legs and arms back toward neutral
  parts.leftLegPivot.rotation.x *= 0.90;
  parts.rightLegPivot.rotation.x *= 0.90;
  parts.leftArmPivot.rotation.x *= 0.90;
  parts.rightArmPivot.rotation.x *= 0.90;

  // Subtle torso scale to simulate breathing
  const breathScale = 1.0 + Math.sin(animState.breathPhase * Math.PI * 2) * BREATH_SCALE;
  parts.torso.scale.y = breathScale;

  // Return torso and head Y to base
  parts.torso.position.y += (parts.baseTorsoY - parts.torso.position.y) * Math.min(1, dt * 6);
  parts.head.position.y += (parts.baseHeadY - parts.head.position.y) * Math.min(1, dt * 6);
}

// ============================================================
// UPDATE ALL NPCs — call from main animation loop
// npcs: array of npc objects (from createNPCs)
// dt: delta time in seconds
// ============================================================

export function animateNPCs(npcs, dt) {
  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    if (!npc.parts) continue;   // guard: only NPCs rebuilt with new model have parts

    const state = getAnimState(npc);

    if (npc.isWalking) {
      updateWalkCycle(npc.parts, state, dt, npc.walkSpeed || 1.8);
    } else {
      updateIdleBreathing(npc.parts, state, dt);
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
