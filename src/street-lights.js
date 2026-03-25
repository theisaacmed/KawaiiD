// Street Lights — atmospheric lights across all districts with staggered dusk activation
// Each light flickers on individually at dusk (5:15 PM – 5:45 PM) in a cascading sequence
// In gray zones they stay dark or flicker weakly; in colorful zones, warm pools of light
// Separate from lighting.js street lamps — these are distributed decorative lights

import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { getGameHour } from './time-system.js';
import { getBuildingColors } from './color-system.js';

const GRAY = new THREE.Color(0x808080);
const WARM_COLOR = new THREE.Color(0xFAC775);
const COLD_COLOR = new THREE.Color(0x99AABB);
const _c = new THREE.Color();

// Stagger window: lights turn on between these hours
const STAGGER_START = 17.25; // 5:15 PM
const STAGGER_END = 17.75;   // 5:45 PM — 30 min window
const OFF_HOUR = 6.25;        // 6:15 AM

// ============ LIGHT POSITIONS ============
// Spread across all districts for atmospheric coverage

const LIGHT_DEFS = [
  // Town (dense coverage)
  { x: -12, z: 0 },   { x: -3, z: -5 },
  { x: 8, z: 2 },     { x: -8, z: 10 },
  { x: 5, z: 12 },    { x: 14, z: 8 },
  { x: -15, z: 15 },  { x: 0, z: 18 },
  { x: 10, z: 20 },   { x: -6, z: 22 },
  // Downtown
  { x: -5, z: 48 },   { x: 8, z: 55 },
  { x: 20, z: 60 },   { x: -10, z: 65 },
  { x: 15, z: 70 },   { x: 30, z: 65 },
  // Burbs
  { x: 72, z: -12 },  { x: 82, z: 0 },
  { x: 90, z: -8 },   { x: 78, z: 10 },
  // Northtown
  { x: 65, z: 85 },   { x: 80, z: 90 },
  { x: 90, z: 82 },
  // Industrial
  { x: -60, z: 55 },  { x: -50, z: 65 },
  { x: -70, z: 60 },
  // Uptown
  { x: 88, z: 30 },   { x: 95, z: 40 },
  { x: 100, z: 35 },
  // Tower
  { x: 45, z: 50 },   { x: 52, z: 58 },
  // Port
  { x: 80, z: 120 },  { x: 90, z: 115 },
];

const lights = [];

// ============ BUILD LIGHT POLE ============

function createLightPole(scene, x, z, staggerOffset) {
  const group = new THREE.Group();
  const terrainY = getTerrainHeight(x, z);
  group.position.set(x, terrainY, z);

  // Thin pole
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.0, 5), poleMat);
  pole.position.y = 1.5;
  pole.castShadow = true;
  group.add(pole);

  // Curved arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), poleMat);
  arm.position.set(0.22, 3.0, 0);
  arm.rotation.z = 0.15; // slight angle
  group.add(arm);

  // Lamp housing
  const housingMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), housingMat);
  housing.position.set(0.42, 2.92, 0);
  group.add(housing);

  // Bulb glow mesh
  const bulbMat = new THREE.MeshBasicMaterial({
    color: 0xFAC775,
    transparent: true,
    opacity: 0,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), bulbMat);
  bulb.position.set(0.42, 2.86, 0);
  group.add(bulb);

  // Ground light cone (soft glow on ground)
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xFAC775,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 12),
    coneMat,
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0.3, 0.02, 0);
  group.add(cone);

  scene.add(group);

  return {
    group,
    bulbMat,
    coneMat,
    x, z,
    staggerOffset, // 0–1, when in the stagger window this light turns on
    state: 'off',  // off | flickering | on
    flickerTimer: 0,
    flickerCount: 0,
    targetIntensity: 0,
    currentIntensity: 0,
    localColor: 0,
  };
}

// ============ CREATE ============

export function createStreetLights(scene) {
  // Sort by position to create a wave-like activation pattern (south to north)
  const sorted = [...LIGHT_DEFS].sort((a, b) => a.z - b.z);

  for (let i = 0; i < sorted.length; i++) {
    const def = sorted[i];
    // Stagger offset: 0–1 based on sort order + small random jitter
    const baseOffset = i / sorted.length;
    const jitter = (Math.random() - 0.5) * 0.15;
    const staggerOffset = Math.max(0, Math.min(1, baseOffset + jitter));

    lights.push(createLightPole(scene, def.x, def.z, staggerOffset));
  }
}

// ============ UPDATE ============

let colorTimer = 0;

export function updateStreetLights(dt, elapsed) {
  const hour = getGameHour();

  // Refresh local color every 3 seconds
  colorTimer += dt;
  if (colorTimer >= 3) {
    colorTimer = 0;
    refreshLightColors();
  }

  for (const light of lights) {
    // Determine target state based on time
    const shouldBeOn = hour >= STAGGER_END || hour < OFF_HOUR;
    const inStaggerWindow = hour >= STAGGER_START && hour < STAGGER_END;

    if (inStaggerWindow) {
      // During stagger window: check if this light's turn has come
      const windowProgress = (hour - STAGGER_START) / (STAGGER_END - STAGGER_START);
      if (windowProgress >= light.staggerOffset && light.state === 'off') {
        // Start flickering on!
        light.state = 'flickering';
        light.flickerTimer = 0;
        light.flickerCount = 0;
      }
    } else if (shouldBeOn && light.state === 'off') {
      // Past stagger window, force on
      light.state = 'on';
      light.currentIntensity = 1;
    } else if (!shouldBeOn && hour >= OFF_HOUR && hour < STAGGER_START) {
      // Daytime: turn off
      if (light.state !== 'off') {
        light.state = 'off';
        light.currentIntensity = 0;
      }
    }

    // Process states
    if (light.state === 'flickering') {
      light.flickerTimer += dt;

      // Flicker pattern: rapid on/off 3-5 times over ~1.5 seconds, then stay on
      const flickerPeriod = 0.15 + Math.random() * 0.1;
      if (light.flickerTimer >= flickerPeriod) {
        light.flickerTimer = 0;
        light.flickerCount++;
        // Alternate on/off
        light.currentIntensity = light.flickerCount % 2 === 0 ? 0 : (0.3 + Math.random() * 0.5);
      }

      // After enough flickers, settle into "on"
      if (light.flickerCount >= 4 + Math.floor(Math.random() * 4)) {
        light.state = 'on';
        light.currentIntensity = 1;
      }
    }

    if (light.state === 'on') {
      // Gentle flicker when on
      light.currentIntensity = 0.85 + Math.sin(elapsed * 3 + light.x * 0.5) * 0.08 + Math.random() * 0.07;
    }

    // In gray zones: dimmer, colder light
    const colorInfluence = light.localColor;
    const maxBrightness = colorInfluence > 0.3 ? 1.0 : 0.3 + colorInfluence;

    const finalIntensity = light.currentIntensity * maxBrightness;

    // Apply to materials
    light.bulbMat.opacity = finalIntensity * 0.9;
    light.coneMat.opacity = finalIntensity * 0.12;

    // Color: warm in colorful areas, cold in gray
    _c.copy(COLD_COLOR).lerp(WARM_COLOR, colorInfluence);
    light.bulbMat.color.copy(_c);
    light.coneMat.color.copy(_c);
  }
}

function refreshLightColors() {
  const buildings = getBuildingColors();
  for (const light of lights) {
    let total = 0, weight = 0;
    for (const b of buildings) {
      const dx = b.x - light.x;
      const dz = b.z - light.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 30) {
        const w = 1 - dist / 30;
        total += b.displayAmount * w;
        weight += w;
      }
    }
    light.localColor = weight > 0 ? total / weight : 0;
  }
}
