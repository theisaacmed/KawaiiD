// Lighting system — dynamic sun, sky color by time of day, street lamps
// Works alongside color-system.js: color-system sets daytime base, this applies time-of-day modulation

import * as THREE from 'three';
import { getDaylightFactor, getTimePeriod, getGameHour, getDayNumber, isNight } from './time-system.js';

// --- Constants ---
// Dawn colors (6–8 AM): warm orange sunrise
const DAWN_SUN_COLOR = new THREE.Color(0xFFD080);
const DAWN_SKY = new THREE.Color(0xB0B8C8);
const DAWN_FOG = new THREE.Color(0xA8B0C0);
const DAWN_AMBIENT = 0.75;
const DAWN_SUN_INTENSITY = 0.8;

// Daytime (8 AM – 4 PM): bright, neutral (handled by color-system)
// We just leave color-system values as-is at daylightFactor=1.0

// Dusk colors (4–6 PM): warm orange/pink sunset
const DUSK_SUN_COLOR = new THREE.Color(0xFF7040);
const DUSK_SKY = new THREE.Color(0xD07050);
const DUSK_FOG = new THREE.Color(0xB07060);
const DUSK_AMBIENT = 0.5;
const DUSK_SUN_INTENSITY = 0.6;

// Night colors (6 PM – 6 AM): dark blue
const NIGHT_FOG = new THREE.Color(0x0a0a18);
const NIGHT_SKY = new THREE.Color(0x060610);
const NIGHT_FOG_NEAR = 8;
const NIGHT_FOG_FAR = 40;
const NIGHT_AMBIENT = 0.25;
const NIGHT_SUN_INTENSITY = 0.12;
const NIGHT_SUN_COLOR = new THREE.Color(0x3344aa); // blue moonlight

// Sun angle (low at dawn/dusk, high at noon)
const SUN_ORBIT_RADIUS = 40;

// --- Street lamp definitions ---
// Warm yellow for colorful areas, cold white for gray areas
const STREET_LAMP_POSITIONS = [
  { x: -15, z: -15, warm: true },
  { x: -5,  z: -12, warm: false },
  { x: 8,   z: -12, warm: false },
  { x: 15,  z: -5,  warm: true },
  { x: -12, z: 2,   warm: false },
  { x: 5,   z: 0,   warm: false },
  { x: -10, z: 14,  warm: true },
  { x: 5,   z: 15,  warm: true },
  { x: 15,  z: 12,  warm: false },
  { x: -18, z: 8,   warm: true },
];

const LAMP_ON_HOUR = 17.5;   // 5:30 PM
const LAMP_OFF_HOUR = 6.5;   // 6:30 AM

// --- State ---
let sceneRef = null;
let sunRef = null;
let ambientRef = null;
let clockEl = null;
const streetLamps = []; // { group, light, bulbMesh }

// Temp color
const _c = new THREE.Color();
const _c2 = new THREE.Color();

// --- Init ---
export function initLighting(scene) {
  sceneRef = scene;

  // Find existing lights
  scene.traverse((obj) => {
    if (obj.isAmbientLight) ambientRef = obj;
    if (obj.isDirectionalLight) sunRef = obj;
  });

  // Create street lamps
  for (const def of STREET_LAMP_POSITIONS) {
    createStreetLamp(scene, def.x, def.z, def.warm);
  }

  // Clock HUD element (top center)
  clockEl = document.createElement('div');
  Object.assign(clockEl.style, {
    position: 'fixed', top: '16px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.55)', color: '#ddc',
    fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold',
    padding: '6px 14px', borderRadius: '6px',
    pointerEvents: 'none', zIndex: '100',
    letterSpacing: '1px',
    textAlign: 'center',
    minWidth: '160px',
  });
  document.body.appendChild(clockEl);
}

// --- Street lamp creation ---
function createStreetLamp(scene, x, z, warm) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Pole
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6), poleMat);
  pole.position.y = 1.75;
  pole.castShadow = true;
  group.add(pole);

  // Lamp head (horizontal arm + bulb housing)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), poleMat);
  arm.position.set(0.3, 3.5, 0);
  group.add(arm);

  const housingMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), housingMat);
  housing.position.set(0.55, 3.42, 0);
  group.add(housing);

  // Bulb (visible glow when on)
  const bulbColor = warm ? 0xFAC775 : 0xCCD8E0;
  const bulbMat = new THREE.MeshBasicMaterial({ color: bulbColor, transparent: true, opacity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bulbMat);
  bulb.position.set(0.55, 3.34, 0);
  group.add(bulb);

  // Point light (starts off)
  const lightColor = warm ? 0xFAC775 : 0xCCD8E0;
  const light = new THREE.PointLight(lightColor, 0, 12, 2);
  light.position.set(0.55, 3.3, 0);
  group.add(light);

  scene.add(group);
  streetLamps.push({ group, light, bulbMesh: bulb, bulbMat, warm });
}

// --- Per-frame update ---
export function updateLighting(dt) {
  if (!sceneRef) return;

  const df = getDaylightFactor();
  const period = getTimePeriod();
  const hour = getGameHour();

  // Update sun position based on time (arc across sky)
  updateSunPosition(hour);

  // Apply lighting based on time period
  applyTimeLighting(df, period);

  // Update street lamps
  updateStreetLamps(hour);

  // Update clock display
  updateClockDisplay();
}

// --- Sun position ---
function updateSunPosition(hour) {
  if (!sunRef) return;

  // Sun travels in an arc from east (6AM) to west (6PM)
  // At 6AM: low east. At noon: high overhead. At 6PM: low west.
  // Night: below horizon (doesn't matter much, just keep dim)
  const dayProgress = (hour - 6) / 12; // 0 at 6AM, 1 at 6PM
  const angle = dayProgress * Math.PI; // 0 to PI

  if (hour >= 6 && hour < 18) {
    sunRef.position.set(
      Math.cos(angle) * SUN_ORBIT_RADIUS,
      Math.sin(angle) * SUN_ORBIT_RADIUS,
      20
    );
  } else {
    // Night — moon position
    sunRef.position.set(-20, 15, -10);
  }
}

// --- Apply time-of-day lighting ---
function applyTimeLighting(df, period) {
  if (df >= 1.0) return; // full day — color-system handles it

  const nightFactor = 1.0 - df;

  if (period === 'dawn') {
    // Blend between night and dawn colors
    const dawnProgress = df; // 0 at 5:30AM, 1 at 8AM

    // Sky: night -> dawn orange -> day (color-system will handle final day)
    _c.copy(NIGHT_SKY).lerp(DAWN_SKY, dawnProgress);
    sceneRef.background.copy(_c);

    // Fog
    _c.copy(NIGHT_FOG).lerp(DAWN_FOG, dawnProgress);
    sceneRef.fog.color.copy(_c);

    // Sun color
    if (sunRef) {
      _c.copy(NIGHT_SUN_COLOR).lerp(DAWN_SUN_COLOR, dawnProgress);
      sunRef.color.copy(_c);
      sunRef.intensity = NIGHT_SUN_INTENSITY + (DAWN_SUN_INTENSITY - NIGHT_SUN_INTENSITY) * dawnProgress;
    }

    // Ambient
    if (ambientRef) {
      ambientRef.intensity = NIGHT_AMBIENT + (DAWN_AMBIENT - NIGHT_AMBIENT) * dawnProgress;
    }

    // Fog distances
    sceneRef.fog.near = NIGHT_FOG_NEAR + (20 - NIGHT_FOG_NEAR) * dawnProgress;
    sceneRef.fog.far = NIGHT_FOG_FAR + (80 - NIGHT_FOG_FAR) * dawnProgress;

  } else if (period === 'dusk') {
    // Blend from day (color-system values) toward dusk/night
    const duskProgress = nightFactor; // 0 at 4PM, 1 at 6PM

    // Blend current (color-system) sky toward dusk
    _c.copy(sceneRef.background);
    _c.lerp(DUSK_SKY, duskProgress);
    _c2.copy(_c).lerp(NIGHT_SKY, Math.max(0, (duskProgress - 0.7) / 0.3));
    sceneRef.background.copy(duskProgress > 0.7 ? _c2 : _c);

    // Fog
    _c.copy(sceneRef.fog.color);
    _c.lerp(DUSK_FOG, duskProgress);
    _c2.copy(_c).lerp(NIGHT_FOG, Math.max(0, (duskProgress - 0.7) / 0.3));
    sceneRef.fog.color.copy(duskProgress > 0.7 ? _c2 : _c);

    // Sun
    if (sunRef) {
      _c.copy(sunRef.color).lerp(DUSK_SUN_COLOR, duskProgress);
      sunRef.color.copy(_c);
      sunRef.intensity = sunRef.intensity * (1 - duskProgress) + DUSK_SUN_INTENSITY * duskProgress;
    }

    // Ambient
    if (ambientRef) {
      ambientRef.intensity = ambientRef.intensity * (1 - duskProgress) + DUSK_AMBIENT * duskProgress;
    }

    // Fog distances
    const baseFar = sceneRef.fog.far;
    sceneRef.fog.near = sceneRef.fog.near * (1 - duskProgress) + NIGHT_FOG_NEAR * duskProgress;
    sceneRef.fog.far = baseFar * (1 - duskProgress) + NIGHT_FOG_FAR * duskProgress;

  } else if (period === 'night') {
    // Full night
    sceneRef.fog.color.copy(NIGHT_FOG);
    sceneRef.background.copy(NIGHT_SKY);
    sceneRef.fog.near = NIGHT_FOG_NEAR;
    sceneRef.fog.far = NIGHT_FOG_FAR;

    if (sunRef) {
      sunRef.color.copy(NIGHT_SUN_COLOR);
      sunRef.intensity = NIGHT_SUN_INTENSITY;
    }
    if (ambientRef) {
      ambientRef.intensity = NIGHT_AMBIENT;
    }
  }
}

// --- Street lamps ---
function updateStreetLamps(hour) {
  const lampsOn = hour >= LAMP_ON_HOUR || hour < LAMP_OFF_HOUR;

  for (const lamp of streetLamps) {
    if (lampsOn) {
      // Gentle flicker
      const flicker = 0.9 + Math.random() * 0.1;
      lamp.light.intensity = 1.2 * flicker;
      lamp.bulbMat.opacity = 0.85;
    } else {
      lamp.light.intensity = 0;
      lamp.bulbMat.opacity = 0;
    }
  }
}

// --- Clock display ---
function updateClockDisplay() {
  if (!clockEl) return;
  const hour = getGameHour();
  const day = getDayNumber();
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

  const icon = isNight() ? '\u{1F319}' : '\u2600\uFE0F';
  clockEl.textContent = `Day ${day} \u2014 ${h12}:${m.toString().padStart(2, '0')} ${ampm} ${icon}`;

  // Tint based on time
  if (isNight()) {
    clockEl.style.color = '#88aadd';
  } else {
    clockEl.style.color = '#ddc';
  }
}
