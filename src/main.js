import * as THREE from 'three';
import { Player } from './player.js';
import { createWorld, updateOcean } from './world.js';
import { createRuins, updateRuinsGlow } from './ruins.js';
import { createRoads, updateRoads } from './roads.js';
import { createBuildings, getFountainData, showDistrictBuildings } from './buildings.js';
import { createDistricts, checkDistrictUnlocks, checkDistrictUnlocksByRank, restoreDistrictState, getDistrictState, isDistrictUnlocked } from './districts.js';
import { createWorldDetail, updateWorldDetail } from './world-detail.js';
import { createRuinsDetail } from './ruins-detail.js';
import { initParticles, updateParticles, setFountainPosition, spawnSearchDust } from './particles.js';
import { initEnvironment, updateEnvironment } from './environment.js';
import { createHUD, flashMoney, showFloatingMoney } from './hud.js';
import { initActiveDealsHUD } from './active-deals-hud.js';
import { initInteraction, updateInteraction } from './interaction.js';
import { createNPCs, updateNPCs, resetNPCPurchases, enableDistrictNPCs, enableNPCByName, checkReferrals, getNPCColorModifier, getNPCAffinity, resetDailyDeals, initPathfinding, resetRoutinesForNewDay, getRelationships, getRelationship, setOnRelLevelUpCallback, getReferralState } from './npc.js';
import { initDealing, isDealOpen, setOnDealCallback, setOnPhoneDealCallback } from './dealing.js';
import { initPhone, updatePhone, setDealFunctions, onPhoneDealCompleted, isPhoneVisible, setGachaUnlockCallback, getPhoneStats, acceptMessage, declineMessage, openPhoneToMessage, getUnreadCount } from './phone.js';
import { createACEOfficers, initACE, updateACE, getOfficers, setOnCaughtCallback, setOnEscapeCallback, isAnyOfficerWithinRange } from './ace.js';
import { initColorSystem, updateColorSystem, spreadColorBonus, addBuildings, getWorldColor, setNPCColorModifierFn, setNPCsForColorSystem, setOnBuildingThresholdCallback, syncBuildingThresholds } from './color-system.js';
import { initLighting, updateLighting } from './lighting.js';
import {
  updateTime, setGameHour, setDayNumber, getDayNumber,
  registerPausePredicate, setSleepCallback, isSleepingNow, isNight,
} from './time-system.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { restoreInventory, addMoney, setMaxSlots } from './inventory.js';
import { hasSave, loadSave, clearSave, applySave, initSaveSystem, triggerSave } from './save-system.js';
import { initGacha, setRevealCallbacks, unlockGacha, isGachaUIOpen } from './gacha.js';
import { showTitleScreen } from './title-screen.js';
import { initPauseMenu, isPauseMenuOpen } from './pause-menu.js';
import { initProgression, setVictoryCallback, checkDealMilestone, checkColorMilestone, getProgressionState, restoreProgressionState, showRankMessage } from './progression.js';
import { spawnPropsIfNeeded, restoreAllProps } from './named-buildings.js';
import { addJP, setOnRankUpCallback, getCurrentRankIndex, restoreJPState } from './jp-system.js';
import {
  initAudio, updateAmbientDrone, updateFootsteps,
  startNightSounds, stopNightSounds,
} from './audio.js';
import { initAdmin } from './admin.js';
import { createKit, updateKit, resetKitStock, resetYunaInkStock, isShopOpen } from './shop.js';
import { createApartment } from './apartment.js';
import { initStationShop, isStationShopOpen, restoreStationShopState, applyRestoredPurchases } from './station-shop.js';
import { initSmuggling, updateSmuggling, isSmuggleUIOpen } from './smuggling.js';
import { initScavenger, updateScavenger, onNewDayScavenger } from './scavenger-system.js';
import { initStoryEvents, setStoryCallbacks, syncStoryEffects, onStoryTrigger, updateStoryEvents } from './story-events.js';
import { initWorkshop, updateWorkshop, isWorkshopStorageOpen } from './workshop.js';
import { initTutorial, updateTutorial, onTutorialDealComplete } from './tutorial.js';
import { initPrintStation, updatePrintStation, isPrintStationOpen } from './stations/print-station.js';
import { initCuttingTable, updateCuttingTable, isCuttingTableOpen } from './stations/cutting-table.js';
import { initSewingMachine, updateSewingMachine, isSewingMachineOpen } from './stations/sewing-machine.js';
import { initStuffingStation, updateStuffingStation, isStuffingStationOpen } from './stations/stuffing-station.js';
import {
  initNotifications, setNotifBlockedCheck, setQuickAcceptFn, setQuickDeclineFn,
  setOpenPhoneToMsgFn, setUnreadCountFn, flushNotifQueue,
} from './notifications.js';
import { initMultiplayer, updateMultiplayer, sendDealComplete, isMultiplayerActive } from './multiplayer.js';
import { showHUDBadge, removeHUDBadge } from './multiplayer-ui.js';

// --- District unlock helpers ---
function performDistrictUnlocks(totalDeals, scene, npcs) {
  const unlocked = checkDistrictUnlocks(totalDeals);
  for (const key of unlocked) {
    showDistrictBuildings(key, scene);
    enableDistrictNPCs(npcs, key);
  }
  return unlocked;
}

function performRankUnlocks(rankIndex, scene, npcs) {
  const unlocked = checkDistrictUnlocksByRank(rankIndex);
  for (const key of unlocked) {
    showDistrictBuildings(key, scene);
    enableDistrictNPCs(npcs, key);
  }
  return unlocked;
}

// --- Crosshair ---
function createCrosshair() {
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed',
    top: '50%', left: '50%',
    width: '4px', height: '4px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.5)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: '90',
    transition: 'background 0.15s, width 0.15s, height 0.15s',
  });
  document.body.appendChild(dot);
  return dot;
}

// --- Fog Particles (legacy) ---
function createFogParticles(scene) {
  const count = 80;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = Math.random() * 4 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xcccccc, size: 0.6,
    transparent: true, opacity: 0.15,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, positions: geo.attributes.position };
}

function updateFogParticles(fogData, dt, playerPos) {
  const pos = fogData.positions;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + Math.sin(i * 0.3) * dt * 0.3);
    pos.setZ(i, pos.getZ(i) + Math.cos(i * 0.7) * dt * 0.2);
    pos.setY(i, pos.getY(i) + Math.sin(i * 0.5 + Date.now() * 0.0003) * dt * 0.1);
    const dx = pos.getX(i) - playerPos.x;
    const dz = pos.getZ(i) - playerPos.z;
    if (Math.abs(dx) > 80) pos.setX(i, playerPos.x + (Math.random() - 0.5) * 120);
    if (Math.abs(dz) > 80) pos.setZ(i, playerPos.z + (Math.random() - 0.5) * 120);
  }
  pos.needsUpdate = true;
}

// --- NPC bobbing ---
function updateNPCBobbing(npcs, elapsed) {
  for (const npc of npcs) {
    if (npc.group) {
      npc.group.position.y = Math.sin(elapsed * 1.5 + npc.group.position.x * 0.5) * 0.03;
    }
  }
}

// --- Boot game ---
async function boot() {
  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();

  // Build the world (terrain, water, lights)
  const { ground, groundMat } = createWorld(scene);

  // Build roads
  createRoads(scene);

  // Build buildings (all districts)
  const { buildings, windowMats, doorMats } = createBuildings(scene);

  // Build district barriers
  createDistricts(scene);

  // Build street furniture (benches, cars, etc)
  createWorldDetail(scene);

  // Build the ruins zone
  const { piles, RUINS_Z_START } = createRuins(scene);

  // Enhanced ruins detail
  createRuinsDetail(scene);

  // Title screen with 3D background
  const choice = await showTitleScreen(() => hasSave(), () => clearSave(), renderer, scene);
  const savedData = choice === 'continue' ? loadSave() : null;

  // Camera (far plane increased for larger world)
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  // Init audio system
  initAudio();

  // Player controller
  const player = new Player(camera, renderer.domElement);

  // NPCs & pathfinding
  initPathfinding();
  const npcs = createNPCs(scene);

  // Lighting system
  initLighting(scene);

  // Register time pause predicates
  registerPausePredicate(() => isPhoneVisible());
  registerPausePredicate(() => isDealOpen());
  registerPausePredicate(() => isGachaUIOpen());
  registerPausePredicate(() => isPauseMenuOpen());
  registerPausePredicate(() => isShopOpen());
  registerPausePredicate(() => isPrintStationOpen());
  registerPausePredicate(() => isCuttingTableOpen());
  registerPausePredicate(() => isSewingMachineOpen());
  registerPausePredicate(() => isStuffingStationOpen());
  registerPausePredicate(() => isStationShopOpen());
  registerPausePredicate(() => isSmuggleUIOpen());
  registerPausePredicate(() => isWorkshopStorageOpen());

  // Kit supplier NPC
  createKit(scene);
  initSmuggling(scene);

  // Scavenger hire system
  initScavenger(scene, npcs);

  // Story events
  initStoryEvents(scene);
  setStoryCallbacks(addJP, getRelationship);

  // Apartment interior (workshop)
  createApartment(scene);

  // Station shop (purchase counter in apartment)
  initStationShop(scene);

  // Print station (first manufacturing station)
  initPrintStation(scene, player);

  // Plushie workshop stations
  initCuttingTable(scene, player);
  initSewingMachine(scene, player);
  initStuffingStation(scene, player);

  // Workshop property (Industrial district second production location)
  initWorkshop(scene, player);

  // ACE patrol officers
  createACEOfficers(scene);
  initACE(player);

  // Multiplayer
  initMultiplayer(scene, {
    onRoomCreated: () => {},
    onJoined: () => { showHUDBadge(); },
    onGuestJoined: () => { showHUDBadge(); },
    onPeerDisconnected: () => { removeHUDBadge(); },
    onDealComplete: (msg) => {
      if (msg.buildingColors && Array.isArray(msg.buildingColors)) {
        for (const { index, colorAmount } of msg.buildingColors) {
          spreadColorBonus({ x: 0, z: 0 }, colorAmount);
        }
      }
    },
  });

  // HUD
  createHUD();

  // Crosshair
  const crosshair = createCrosshair();

  // Fog particles (legacy ambient)
  const fogData = createFogParticles(scene);

  // Dealing system
  initDealing();

  // Color restoration system
  initColorSystem(scene, buildings, ground, windowMats, doorMats);
  setNPCColorModifierFn(getNPCColorModifier);
  setNPCsForColorSystem(npcs, getRelationships);

  // Particle system
  initParticles(scene, player);
  const fountainData = getFountainData();
  if (fountainData) {
    setFountainPosition(fountainData.x || 0, fountainData.z || 0);
  }

  // Environment storytelling
  initEnvironment(scene, npcs);

  // Minimap
  initMinimap(player, npcs);

  // Phone system
  initActiveDealsHUD();
  initPhone(scene, npcs, player);
  setDealFunctions(isDealOpen);

  // Notification system
  initNotifications();
  setNotifBlockedCheck(() => {
    // Block during: ACE chase, sleeping, progression overlay, deal panel, shop
    if (isSleepingNow()) return true;
    // Check if any ACE officer is in CHASE state
    const officers = getOfficers();
    if (officers.some(o => o.state === 'CHASE')) return true;
    // Check progression overlay
    const overlay = document.getElementById('progression-overlay');
    if (overlay && overlay.style.display !== 'none' && overlay.style.opacity !== '0') return true;
    return false;
  });
  setQuickAcceptFn((msgId) => {
    acceptMessage(msgId);
    return true;
  });
  setQuickDeclineFn((msgId) => {
    declineMessage(msgId);
  });
  setOpenPhoneToMsgFn((msgId) => {
    openPhoneToMessage(msgId);
  });
  setUnreadCountFn(() => getUnreadCount());

  // Gacha system
  initGacha(scene);
  setRevealCallbacks(
    (amount) => {
      addMoney(amount);
      flashMoney(amount);
      showFloatingMoney(amount);
    },
    (npcPos, bonusAmount) => {
      if (npcPos) spreadColorBonus(npcPos, bonusAmount);
    }
  );
  setGachaUnlockCallback(() => unlockGacha());

  // Progression system
  initProgression();
  setVictoryCallback(() => {
    triggerSave('Victory!');
  });

  // Interaction system
  initInteraction(player, piles, RUINS_Z_START, npcs, scene);

  // Sleep callback — new day reset
  setSleepCallback(() => {
    for (const pile of piles) {
      pile.searched = false;
      pile.glow.visible = true;
      pile.light.visible = true;
    }
    resetNPCPurchases(npcs);
    resetDailyDeals();
    resetRoutinesForNewDay();
    resetKitStock();
    resetYunaInkStock();
    onNewDayScavenger();
    triggerSave('New day!');
  });

  // --- Restore saved state ---
  if (savedData) {
    if (savedData.inventory) {
      restoreInventory(savedData.inventory.slots || [], savedData.inventory.money || 0);
    }
    applySave(savedData, player, npcs, piles);
    if (savedData.gameHour !== undefined) setGameHour(savedData.gameHour);
    if (savedData.dayNumber !== undefined) setDayNumber(savedData.dayNumber);
    // Restore district unlock state
    if (savedData.districts) {
      restoreDistrictState(savedData.districts);
      // Show buildings for all unlocked districts
      for (const key of Object.keys(savedData.districts)) {
        if (savedData.districts[key]) showDistrictBuildings(key, scene);
      }
    }
    // Legacy eastside support
    if (savedData.eastsideUnlocked) {
      // Map old eastside unlock to new downtown unlock
      checkDistrictUnlocks(15);
    }
    if (savedData.progression) {
      restoreProgressionState(savedData.progression);
    }
    // After restoring referral state (done inside applySave), re-enable NPCs
    // that have been unlocked via referrals and whose district is also unlocked
    if (savedData.referrals) {
      for (const npc of npcs) {
        if (npc.requiresReferral) {
          const districtOk = npc.district === 'town' || npc.district === 'ruins' || isDistrictUnlocked(npc.district);
          if (districtOk) {
            enableNPCByName(npcs, npc.name);
          }
        }
      }
    }
    // Enable district NPCs for all unlocked districts
    if (savedData.districts) {
      for (const key of Object.keys(savedData.districts)) {
        if (savedData.districts[key]) enableDistrictNPCs(npcs, key);
      }
    }
    // After building colors are restored, pre-mark crossed thresholds so JP isn't re-awarded
    syncBuildingThresholds();
    // Restore named building props for existing relationship levels
    restoreAllProps(scene, getRelationships());
    // Restore inventory expansion from JP rank (Dealer rank = index 2 → 10 slots)
    if (getCurrentRankIndex() >= 2) setMaxSlots(10);
    // Restore station purchases (enables/shows purchased station meshes)
    if (savedData.stationShop) restoreStationShopState(savedData.stationShop);
    applyRestoredPurchases();
    // Sync story event visual effects after state restored in applySave
    syncStoryEffects(getReferralState());
    // Workshop restore is handled in save-system.js applySave (via restoreWorkshopState)
  } else {
    // New game — apply any already-restored purchases (none, but future-proof)
    applyRestoredPurchases();
  }

  // Tutorial — init after state is restored so new vs continue is known
  initTutorial(scene, !savedData);

  // Init save system
  initSaveSystem(player, npcs, piles, getOfficers());

  // Pause menu
  initPauseMenu({
    onSave: () => triggerSave('Game saved!'),
    onQuit: () => { window.location.reload(); },
    isPausable: () => !isDealOpen() && !isPhoneVisible() && !isGachaUIOpen() && !isSleepingNow() && !isPrintStationOpen(),
  });

  // Admin / debug panel
  initAdmin(player, npcs, () => {
    // Debug: unlock all districts
    checkDistrictUnlocks(999);
  });

  // Helper: process referral results from deal
  function handleDealReferrals(npcName, totalDeals) {
    const result = checkReferrals(npcName, totalDeals);
    if (result) {
      if (result.type === 'referral' && result.npc) {
        // Enable the newly referred NPC
        enableNPCByName(npcs, result.npc);
      }
      // Fire story events if social flags were set this deal
      onStoryTrigger(result, getReferralState());
    }
  }

  // --- JP callbacks ---

  // Rank-up: show narrative, unlock districts, expand inventory
  setOnRankUpCallback((rankIndex, rank) => {
    showRankMessage(rank.msg);
    performRankUnlocks(rankIndex, scene, npcs);
    // Dealer (rank index 2) → expand inventory to 10 slots
    if (rankIndex === 2) setMaxSlots(10);
  });

  // Color threshold crossing → +2 JP
  setOnBuildingThresholdCallback((amount) => addJP(amount));

  // Relationship milestone → +15 JP + spawn building props
  setOnRelLevelUpCallback((npcName, level) => {
    addJP(15);
    spawnPropsIfNeeded(scene, npcName, level);
  });

  // ACE escape → +20 JP
  setOnEscapeCallback(() => addJP(20));

  // --- Wire save triggers ---
  setOnDealCallback((npcName, itemType, price) => {
    onTutorialDealComplete();
    triggerSave('Saving...');
    const stats = getPhoneStats();
    checkDealMilestone(stats.totalDeals);
    // Check legacy deal-count district unlocks
    performDistrictUnlocks(stats.totalDeals, scene, npcs);
    // Check referral/social unlocks
    if (npcName) handleDealReferrals(npcName, stats.totalDeals);
    // JP: base deal award
    addJP(10);
    // JP: love-affinity bonus
    if (npcName && itemType && getNPCAffinity(npcName, itemType) >= 2) addJP(5);
    // JP: risky deal bonus (officer within 30 units)
    if (isAnyOfficerWithinRange(30)) addJP(10);
    // Notify co-op partner
    if (isMultiplayerActive()) {
      sendDealComplete({ npcName, itemType });
    }
  });
  setOnCaughtCallback(() => {
    addJP(-15);
    triggerSave('Saving...');
  });
  setOnPhoneDealCallback((npcName, itemType, price) => {
    onPhoneDealCompleted(npcName, itemType, price);
    const stats = getPhoneStats();
    checkDealMilestone(stats.totalDeals);
    performDistrictUnlocks(stats.totalDeals, scene, npcs);
    // Check referral/social unlocks
    if (npcName) handleDealReferrals(npcName, stats.totalDeals);
    // JP awards for phone deals
    addJP(10);
    if (npcName && itemType && getNPCAffinity(npcName, itemType) >= 2) addJP(5);
    if (isAnyOfficerWithinRange(30)) addJP(10);
  });

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Night sound tracking
  let wasNight = false;

  // Render loop
  const clock = new THREE.Clock();
  let elapsed = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    updateTime(dt);
    player.update(dt);
    updateNPCs(npcs, player.position, dt);
    // DEV MODE: ACE disabled
    // updateACE(dt);
    updateKit();
    updateSmuggling();
    updateStoryEvents(dt);
    updateWorkshop();
    updateTutorial(dt, player.position, piles);
    updateScavenger(dt);
    updatePrintStation(dt);
    updateCuttingTable(dt);
    updateSewingMachine(dt);
    updateStuffingStation(dt);
    updateRuinsGlow(piles, elapsed);
    updatePhone(dt);
    updateInteraction(dt);
    updateColorSystem(dt);
    updateLighting(dt);
    updateMinimap();
    updateRoads(dt);
    updateWorldDetail(dt);

    // Particle systems
    updateParticles(dt, elapsed);

    // Environment storytelling
    updateEnvironment(dt);

    // Audio
    const worldColor = getWorldColor();
    updateOcean(elapsed, worldColor);
    updateAmbientDrone(worldColor);
    const isMoving = player.keys.forward || player.keys.back || player.keys.left || player.keys.right;
    updateFootsteps(dt, isMoving && player.locked);

    // Night sounds
    const nightNow = isNight();
    if (nightNow && !wasNight) startNightSounds();
    if (!nightNow && wasNight) stopNightSounds();
    wasNight = nightNow;

    // Fog particles
    updateFogParticles(fogData, dt, player.position);

    // NPC bobbing
    updateNPCBobbing(npcs, elapsed);

    // Color milestones
    if (Math.floor(elapsed * 10) % 6 === 0) {
      checkColorMilestone(worldColor);
    }

    // Multiplayer sync
    updateMultiplayer(camera.position, camera.rotation.y);

    // Flush queued notifications when blocking events end
    flushNotifQueue();

    renderer.render(scene, camera);
  }
  animate();
}

boot();
