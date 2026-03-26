// NPC model builder — distinct geometry for each of the 28 NPCs
// Each NPC is built from Three.js primitives with named children for animation.
// Body parts are named for procedural animation: torso, head, leftArm, rightArm,
// leftLegPivot, rightLegPivot, hair, accessory, eyeLeft, eyeRight, smile

import * as THREE from 'three';

// ============================================================
// APPEARANCE DATA TABLE — one entry per NPC
// personalityColor: vibrant full-saturation color
// accessoryGrayColor: muted personality color used in gray world
// ============================================================
export const NPC_APPEARANCE = {
  // === TOWN ===
  Mei: {
    heightScale: 0.92, widthScale: 0.90,
    skinTone: 0xEAC9A0, hairStyle: 'long', hairColor: 0x3D2B1F,
    accessory: 'beret', accessoryColor: 0xF4A0B0, accessoryGrayColor: 0x8A7A7E,
    personalityColor: 0xF4A0B0,
  },
  Hiro: {
    heightScale: 1.10, widthScale: 1.15,
    skinTone: 0xC8A882, hairStyle: 'short', hairColor: 0x1A1A1A,
    accessory: 'hardhat', accessoryColor: 0xE8D050, accessoryGrayColor: 0x8A8A78,
    personalityColor: 0xE8D050,
  },
  Luna: {
    heightScale: 1.00, widthScale: 0.95,
    skinTone: 0xDDBB99, hairStyle: 'long', hairColor: 0x7A3A20,
    accessory: 'scarf', accessoryColor: 0x40C8B8, accessoryGrayColor: 0x788A85,
    personalityColor: 0x40C8B8,
  },
  Ash: {
    heightScale: 0.90, widthScale: 0.85,
    skinTone: 0xF0D8B8, hairStyle: 'short', hairColor: 0xD4B870,
    accessory: 'backpack', accessoryColor: 0x909090, accessoryGrayColor: 0x787878,
    personalityColor: 0xA8C8F0,
  },
  Dex: {
    heightScale: 1.08, widthScale: 0.85,
    skinTone: 0xC0A080, hairStyle: 'short', hairColor: 0x1A1A2A,
    accessory: 'sunglasses', accessoryColor: 0x181818, accessoryGrayColor: 0x303030,
    personalityColor: 0x8888DD,
  },
  // === TOWN EXTRAS ===
  Rin: {
    heightScale: 0.76, widthScale: 0.73,
    skinTone: 0xF0D8B8, hairStyle: 'spiky', hairColor: 0x4A3A20,
    accessory: 'backpack', accessoryColor: 0xE06030, accessoryGrayColor: 0x787060,
    personalityColor: 0xE08040, headScale: 1.14,
  },
  Fumio: {
    heightScale: 0.92, widthScale: 1.00,
    skinTone: 0xC0A888, hairStyle: 'bald', hairColor: 0xB0B0A8,
    accessory: 'glasses', accessoryColor: 0x888888, accessoryGrayColor: 0x686868,
    personalityColor: 0xA09878, hunch: true,
  },
  Hana: {
    heightScale: 0.96, widthScale: 0.93,
    skinTone: 0xE8C8A0, hairStyle: 'ponytail', hairColor: 0x6A3A20,
    accessory: 'scarf', accessoryColor: 0xC87050, accessoryGrayColor: 0x887068,
    personalityColor: 0xD08860,
  },
  // === DOWNTOWN ===
  Ren: {
    heightScale: 0.95, widthScale: 0.92,
    skinTone: 0xDDAA88, hairStyle: 'spiky', hairColor: 0xC83020,
    accessory: 'beanie', accessoryColor: 0xE86820, accessoryGrayColor: 0x8A7050,
    personalityColor: 0xE86820,
  },
  Nao: {
    heightScale: 1.02, widthScale: 1.00,
    skinTone: 0xE8C8A0, hairStyle: 'short', hairColor: 0x1A1A1A,
    accessory: 'apron', accessoryColor: 0xF0F0E8, accessoryGrayColor: 0xC0C0B8,
    personalityColor: 0xF0C070,
  },
  Felix: {
    heightScale: 0.90, widthScale: 0.88,
    skinTone: 0xE0CCAA, hairStyle: 'short', hairColor: 0x6A4A20,
    accessory: 'glasses', accessoryColor: 0x888888, accessoryGrayColor: 0x686868,
    personalityColor: 0x88C888,
  },
  Harper: {
    heightScale: 1.00, widthScale: 0.93,
    skinTone: 0xE8C0A0, hairStyle: 'ponytail', hairColor: 0xB83020,
    accessory: 'badge', accessoryColor: 0xD8D0A0, accessoryGrayColor: 0x888878,
    personalityColor: 0xE85050,
  },
  Marco: {
    heightScale: 1.05, widthScale: 1.20,
    skinTone: 0xC8A880, hairStyle: 'short', hairColor: 0x888880,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x888888,
    personalityColor: 0xA0C0A0,
  },
  // === BURBS ===
  Mika: {
    heightScale: 0.88, widthScale: 0.85,
    skinTone: 0xF0D0B0, hairStyle: 'spiky', hairColor: 0x5050C0,
    accessory: 'none', accessoryColor: 0x8080C8, accessoryGrayColor: 0x787888,
    personalityColor: 0x8080C8,
  },
  Zoe: {
    heightScale: 0.78, widthScale: 0.75,
    skinTone: 0xF5DDB0, hairStyle: 'pigtails', hairColor: 0xD4C060,
    accessory: 'none', accessoryColor: 0xF0A040, accessoryGrayColor: 0x888878,
    personalityColor: 0xF0A040, headScale: 1.15,
  },
  Tomas: {
    heightScale: 0.96, widthScale: 1.05,
    skinTone: 0xC0A888, hairStyle: 'short', hairColor: 0xA0A0A0,
    accessory: 'none', accessoryColor: 0x909090, accessoryGrayColor: 0x808080,
    personalityColor: 0xC0B890, hunch: true,
  },
  Sara: {
    heightScale: 1.00, widthScale: 0.95,
    skinTone: 0xE0C090, hairStyle: 'ponytail', hairColor: 0x8A5020,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x787878,
    personalityColor: 0xD08060,
  },
  // === NORTHTOWN ===
  Jin: {
    heightScale: 1.02, widthScale: 0.98,
    skinTone: 0xD8B888, hairStyle: 'short', hairColor: 0x1A1A1A,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x787878,
    personalityColor: 0x60A8D0,
  },
  Yuna: {
    heightScale: 0.93, widthScale: 0.88,
    skinTone: 0xE8C8A0, hairStyle: 'long', hairColor: 0x1A1A1A,
    accessory: 'flower', accessoryColor: 0xF080C0, accessoryGrayColor: 0x88787E,
    personalityColor: 0xF080C0,
  },
  Kai: {
    heightScale: 1.12, widthScale: 1.15,
    skinTone: 0xB8906A, hairStyle: 'bald', hairColor: 0x1A1A1A,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x787878,
    personalityColor: 0x70B870,
  },
  // === INDUSTRIAL ===
  Taro: {
    heightScale: 0.97, widthScale: 1.05,
    skinTone: 0xB8906A, hairStyle: 'bald', hairColor: 0x888880,
    accessory: 'none', accessoryColor: 0x909090, accessoryGrayColor: 0x808080,
    personalityColor: 0xB0A070, hunch: true,
  },
  Vex: {
    heightScale: 1.00, widthScale: 0.90,
    skinTone: 0xC8A880, hairStyle: 'spiky', hairColor: 0x6030A8,
    accessory: 'none', accessoryColor: 0x9030C0, accessoryGrayColor: 0x787888,
    personalityColor: 0x9030C0,
  },
  Polly: {
    heightScale: 0.88, widthScale: 0.90,
    skinTone: 0xF0D0C0, hairStyle: 'pigtails', hairColor: 0xE870A0,
    accessory: 'none', accessoryColor: 0xF870B0, accessoryGrayColor: 0x88787E,
    personalityColor: 0xF870B0,
  },
  // === UPTOWN ===
  Sora: {
    heightScale: 1.10, widthScale: 1.00,
    skinTone: 0xE8C8A8, hairStyle: 'long', hairColor: 0xA830B8,
    accessory: 'none', accessoryColor: 0xC040D0, accessoryGrayColor: 0x887888,
    personalityColor: 0xC040D0,
  },
  Kenji: {
    heightScale: 1.08, widthScale: 1.08,
    skinTone: 0xC8A880, hairStyle: 'short', hairColor: 0xB0B0B0,
    accessory: 'none', accessoryColor: 0xA0A0B8, accessoryGrayColor: 0x808090,
    personalityColor: 0xA0A0D0,
  },
  Mira: {
    heightScale: 1.02, widthScale: 0.93,
    skinTone: 0xE0C090, hairStyle: 'long', hairColor: 0x1A1A1A,
    accessory: 'scarf', accessoryColor: 0xD04060, accessoryGrayColor: 0x887878,
    personalityColor: 0xD04060,
  },
  // === TOWER ===
  Quinn: {
    heightScale: 0.98, widthScale: 0.90,
    skinTone: 0xD0B890, hairStyle: 'short', hairColor: 0x1A1A2A,
    accessory: 'hood', accessoryColor: 0x404060, accessoryGrayColor: 0x545460,
    personalityColor: 0x4060C0,
  },
  Dante: {
    heightScale: 1.08, widthScale: 1.05,
    skinTone: 0xB88860, hairStyle: 'short', hairColor: 0x1A1A1A,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x787878,
    personalityColor: 0x707090,
  },
  // === PORT ===
  Gus: {
    heightScale: 1.00, widthScale: 1.10,
    skinTone: 0xA87850, hairStyle: 'short', hairColor: 0x888880,
    accessory: 'cap', accessoryColor: 0x4060A0, accessoryGrayColor: 0x606070,
    personalityColor: 0x4080C0,
  },
  Marina: {
    heightScale: 0.98, widthScale: 0.97,
    skinTone: 0xB8906A, hairStyle: 'ponytail', hairColor: 0x4A3020,
    accessory: 'none', accessoryColor: 0x888888, accessoryGrayColor: 0x787878,
    personalityColor: 0x40A0B0,
  },
  // === ACE HQ ===
  Dove: {
    heightScale: 1.04, widthScale: 1.00,
    skinTone: 0xD8B888, hairStyle: 'short', hairColor: 0x2A2A2A,
    accessory: 'badge', accessoryColor: 0xD0D0E0, accessoryGrayColor: 0x808090,
    personalityColor: 0x8090D0,
  },
  // === SPECIAL — near spawn ===
  Rina: {
    heightScale: 0.95, widthScale: 0.90,
    skinTone: 0xC8A070, hairStyle: 'long', hairColor: 0x0A0A0A,
    accessory: 'camera', accessoryColor: 0x303030, accessoryGrayColor: 0x505050,
    personalityColor: 0xE06888,
  },
  // === REBUILDER CREW — appear at ruins after 100% color ===
  Rebuilder1: {
    heightScale: 1.08, widthScale: 1.10,
    skinTone: 0xC8A882, hairStyle: 'short', hairColor: 0x3A2A1A,
    accessory: 'hardhat', accessoryColor: 0xE8D050, accessoryGrayColor: 0x8A8A78,
    personalityColor: 0xE8D050,
  },
  Rebuilder2: {
    heightScale: 1.02, widthScale: 1.05,
    skinTone: 0xDDBB99, hairStyle: 'short', hairColor: 0x1A1A1A,
    accessory: 'hardhat', accessoryColor: 0xF08030, accessoryGrayColor: 0x8A7A68,
    personalityColor: 0xF08030,
  },
  Rebuilder3: {
    heightScale: 0.96, widthScale: 0.98,
    skinTone: 0xE8C8A0, hairStyle: 'spiky', hairColor: 0x4A3020,
    accessory: 'hardhat', accessoryColor: 0xE8D050, accessoryGrayColor: 0x8A8A78,
    personalityColor: 0xE8D050,
  },
  Rebuilder4: {
    heightScale: 1.05, widthScale: 1.12,
    skinTone: 0xA87850, hairStyle: 'short', hairColor: 0x888880,
    accessory: 'hardhat', accessoryColor: 0xF08030, accessoryGrayColor: 0x8A7A68,
    personalityColor: 0xF08030,
  },
};

// ============================================================
// MATERIAL HELPERS
// ============================================================

function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cyl(radiusTop, radiusBottom, h, color, x, y, z, segs = 8) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segs),
    mat(color)
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function sphere(r, color, x, y, z, wSegs = 10, hSegs = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, wSegs, hSegs), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ============================================================
// HAIR BUILDERS
// Returns a THREE.Group with the hair geometry
// ============================================================

function buildHair(style, hairColor, headRadius, widthScale) {
  const g = new THREE.Group();
  const c = hairColor;

  switch (style) {
    case 'short': {
      // Slightly larger hemisphere on top of head
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.015, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat(c)
      );
      cap.rotation.x = 0;
      cap.position.set(0, 0, 0);
      cap.castShadow = true;
      g.add(cap);
      break;
    }
    case 'long': {
      // Hemisphere on top + box hanging down the back
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.015, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
        mat(c)
      );
      top.castShadow = true;
      g.add(top);
      // Hanging back
      const back = box(headRadius * 0.9, headRadius * 1.5, headRadius * 0.25, c,
        0, -headRadius * 0.6, -headRadius * 0.7);
      g.add(back);
      break;
    }
    case 'ponytail': {
      // Cap + sphere at the back + thin cylinder tail
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.015, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat(c)
      );
      top.castShadow = true;
      g.add(top);
      const holder = sphere(0.06, c, 0, -headRadius * 0.5, -headRadius * 0.85);
      g.add(holder);
      const tail = cyl(0.04, 0.03, 0.3, c, 0, -headRadius * 0.5 - 0.15, -headRadius * 1.0);
      tail.rotation.x = 0.3;
      g.add(tail);
      break;
    }
    case 'spiky': {
      // 4 small cones pointing upward
      const coneCount = 4;
      for (let i = 0; i < coneCount; i++) {
        const angle = (i / coneCount) * Math.PI * 2;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, 0.22, 6),
          mat(c)
        );
        cone.position.set(
          Math.cos(angle) * headRadius * 0.5,
          headRadius * 0.75,
          Math.sin(angle) * headRadius * 0.4
        );
        cone.rotation.z = Math.cos(angle) * 0.5;
        cone.rotation.x = -Math.sin(angle) * 0.3;
        cone.castShadow = true;
        g.add(cone);
      }
      // Also a small base cap
      const base = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.01, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
        mat(c)
      );
      g.add(base);
      break;
    }
    case 'pigtails': {
      // Center cap + two small spheres on sides + short tails
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.01, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mat(c)
      );
      top.castShadow = true;
      g.add(top);
      for (const side of [-1, 1]) {
        const holder = sphere(0.07, c, side * headRadius * 0.95, headRadius * 0.2, 0);
        g.add(holder);
        const tail = cyl(0.04, 0.03, 0.2, c, side * headRadius * 1.15, headRadius * 0.0, 0);
        g.add(tail);
      }
      break;
    }
    case 'bald': {
      // No hair, just bare head — nothing added
      break;
    }
    default: {
      // fallback to short
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius + 0.015, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat(c)
      );
      cap.castShadow = true;
      g.add(cap);
    }
  }

  return g;
}

// ============================================================
// ACCESSORY BUILDERS
// Returns { group, material } — material is the one to update for color
// ============================================================

function buildAccessory(type, color, headRadius) {
  const g = new THREE.Group();
  let mainMat = null;

  switch (type) {
    case 'beret': {
      // Flattened sphere on top of head, tilted slightly
      mainMat = mat(color);
      const beret = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
        mainMat
      );
      beret.position.set(headRadius * 0.15, headRadius * 0.5, 0);
      beret.rotation.z = -0.2;
      beret.castShadow = true;
      g.add(beret);
      // Beret brim
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius * 1.15, headRadius * 1.05, 0.04, 16),
        mat(0x4A4A4A)
      );
      brim.position.set(0, headRadius * 0.25, 0);
      g.add(brim);
      break;
    }
    case 'hardhat': {
      mainMat = mat(color);
      // Dome
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mainMat
      );
      dome.position.y = headRadius * 0.15;
      dome.castShadow = true;
      g.add(dome);
      // Brim
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius * 1.4, headRadius * 1.35, 0.06, 16),
        mainMat
      );
      brim.position.y = headRadius * 0.02;
      g.add(brim);
      break;
    }
    case 'scarf': {
      // Thin box draped around neck
      mainMat = mat(color);
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12),
        mainMat
      );
      wrap.castShadow = true;
      g.add(wrap);
      // Hanging end
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.08), mainMat);
      end.position.set(0.08, -0.22, 0.18);
      g.add(end);
      break;
    }
    case 'backpack': {
      // Small box on the back
      mainMat = mat(color);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.15), mainMat);
      pack.position.set(0, 0, -0.32);
      pack.castShadow = true;
      g.add(pack);
      // Straps
      const strapMat = mat(0x606060);
      for (const sx of [-0.1, 0.1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), strapMat);
        strap.position.set(sx, 0, -0.18);
        g.add(strap);
      }
      break;
    }
    case 'sunglasses': {
      mainMat = mat(color);
      // Two lens boxes across the face
      for (const sx of [-0.085, 0.085]) {
        const lens = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.06, 0.03),
          mainMat
        );
        lens.position.set(sx, 0, headRadius * 0.95);
        g.add(lens);
      }
      // Bridge
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.015, 0.015),
        mainMat
      );
      bridge.position.set(0, 0, headRadius * 0.92);
      g.add(bridge);
      break;
    }
    case 'beanie': {
      mainMat = mat(color);
      // Rounded cylinder/cap
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius * 1.0, headRadius * 1.05, headRadius * 0.8, 12),
        mainMat
      );
      cap.position.y = headRadius * 0.55;
      cap.castShadow = true;
      g.add(cap);
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.0, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mainMat
      );
      top.position.y = headRadius * 0.55 + headRadius * 0.4;
      top.castShadow = true;
      g.add(top);
      // Pompom
      const pom = sphere(0.06, 0xFFFFFF, 0, headRadius * 0.55 + headRadius * 0.85, 0);
      g.add(pom);
      break;
    }
    case 'apron': {
      // Thin flat box on front of torso — positioned in world space relative to torso
      mainMat = mat(color);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.03), mainMat);
      apron.position.set(0, 0, 0.32);
      apron.castShadow = true;
      g.add(apron);
      // Apron tie at top
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), mainMat);
      tie.position.set(0, 0.28, 0.3);
      g.add(tie);
      break;
    }
    case 'glasses': {
      // Two thin torus rings (wire glasses) facing forward
      mainMat = mat(color);
      for (const sx of [-0.08, 0.08]) {
        const frame = new THREE.Mesh(
          new THREE.TorusGeometry(0.058, 0.012, 6, 12),
          mainMat
        );
        frame.position.set(sx, 0, headRadius * 0.9);
        frame.rotation.x = Math.PI / 2;
        g.add(frame);
      }
      // Bridge
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.015, 0.015),
        mainMat
      );
      bridge.position.set(0, 0, headRadius * 0.88);
      g.add(bridge);
      break;
    }
    case 'badge': {
      // Tiny flat rectangle on the chest
      mainMat = mat(color);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.025), mainMat);
      badge.position.set(0.15, 0.1, 0.32);
      g.add(badge);
      // Small clip
      const clip = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.05, 0.02),
        mat(0x888888)
      );
      clip.position.set(0.15, 0.19, 0.32);
      g.add(clip);
      break;
    }
    case 'hood': {
      // Half-sphere behind and over the head
      mainMat = mat(color);
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
        mainMat
      );
      hood.rotation.x = 0.5;
      hood.position.set(0, headRadius * 0.1, -headRadius * 0.15);
      hood.castShadow = true;
      g.add(hood);
      break;
    }
    case 'flower': {
      // Small petals and center on side of head
      mainMat = mat(color);
      const petalCount = 5;
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 6),
          mainMat
        );
        petal.position.set(
          headRadius * 0.9 + Math.cos(angle) * 0.07,
          headRadius * 0.4,
          Math.sin(angle) * 0.07
        );
        g.add(petal);
      }
      const center = sphere(0.045, 0xFFE060, headRadius * 0.9, headRadius * 0.4, 0);
      g.add(center);
      break;
    }
    case 'camera': {
      // Small camera hanging around neck
      mainMat = mat(color);
      // Strap (thin cylinder ring around neck)
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), mainMat);
      strap.position.set(0.12, -0.15, 0.18);
      g.add(strap);
      const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), mainMat);
      strap2.position.set(-0.12, -0.15, 0.18);
      g.add(strap2);
      // Camera body
      const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), mainMat);
      camBody.position.set(0, -0.34, 0.22);
      camBody.castShadow = true;
      g.add(camBody);
      // Lens
      const lensMat = mat(0x222222);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.34, 0.28);
      g.add(lens);
      break;
    }
    case 'cap': {
      // Sailor-style flat cap
      mainMat = mat(color);
      const capBody = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius * 1.05, headRadius * 1.05, headRadius * 0.4, 12),
        mainMat
      );
      capBody.position.y = headRadius * 0.4;
      capBody.castShadow = true;
      g.add(capBody);
      const capTop = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mainMat
      );
      capTop.position.y = headRadius * 0.4 + headRadius * 0.52;
      g.add(capTop);
      // Brim in front
      const brim = new THREE.Mesh(
        new THREE.BoxGeometry(headRadius * 2.4, 0.05, headRadius * 0.7),
        mainMat
      );
      brim.position.set(0, headRadius * 0.25, headRadius * 1.05);
      g.add(brim);
      break;
    }
    default:
      break;
  }

  return { group: g, material: mainMat };
}

// ============================================================
// REBUILDER TOOL BUILDERS — shovel, pickaxe, hammer, saw
// Returns a THREE.Group to attach to an arm pivot
// ============================================================

export function buildTool(toolType) {
  const g = new THREE.Group();
  const woodMat = mat(0x8B5A2B);
  const metalMat = mat(0xA0A0A0);

  switch (toolType) {
    case 'shovel': {
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), woodMat);
      handle.position.y = -0.35;
      handle.castShadow = true;
      g.add(handle);
      // Blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), metalMat);
      blade.position.set(0, -0.72, 0.02);
      blade.rotation.x = -0.15;
      blade.castShadow = true;
      g.add(blade);
      break;
    }
    case 'pickaxe': {
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6), woodMat);
      handle.position.y = -0.32;
      handle.castShadow = true;
      g.add(handle);
      // Head — horizontal bar
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 0.04), metalMat);
      head.position.set(0, -0.66, 0);
      head.castShadow = true;
      g.add(head);
      // Pick point
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), metalMat);
      point.rotation.z = Math.PI / 2;
      point.position.set(0.20, -0.66, 0);
      g.add(point);
      break;
    }
    case 'hammer': {
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), woodMat);
      handle.position.y = -0.25;
      handle.castShadow = true;
      g.add(handle);
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.06), metalMat);
      head.position.set(0, -0.52, 0);
      head.castShadow = true;
      g.add(head);
      break;
    }
    case 'saw': {
      // Handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.03), woodMat);
      handle.position.y = -0.12;
      handle.castShadow = true;
      g.add(handle);
      // Blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.40, 0.12), metalMat);
      blade.position.set(0, -0.38, 0);
      blade.castShadow = true;
      g.add(blade);
      break;
    }
  }

  return g;
}

// ============================================================
// MAIN MODEL BUILDER
// Returns {
//   group,          root THREE.Group
//   parts,          named body part references for animation
//   bodyMat,        clothing material (updated by color system)
//   accessoryMat,   accessory material (updated by color system)
//   headMat,        head/skin material
//   hairMat,        hair material
// }
// ============================================================

export function buildNPCModel(npcName) {
  const app = NPC_APPEARANCE[npcName] || NPC_APPEARANCE.Mei;
  const hs = app.heightScale || 1.0;
  const ws = app.widthScale || 1.0;
  const headR = 0.20 * (app.headScale || 1.0);

  const group = new THREE.Group();

  // --- CLOTHING MATERIAL (gray world default) ---
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x787878 });
  const skinMat = new THREE.MeshLambertMaterial({ color: app.skinTone });
  const hairMat = new THREE.MeshLambertMaterial({ color: app.hairColor });
  const pantsColor = 0x5A5A5A; // slightly darker than shirt
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
  const shoeColor = 0x3A3A3A;
  const shoesMat = new THREE.MeshLambertMaterial({ color: shoeColor });

  // --- TORSO (pivot at 0,0,0 → sits at worldPos) ---
  // Tapered cylinder: wider at shoulders (top), narrower at waist (bottom)
  const torsoH = 0.80 * hs;
  const torsoR_top = 0.30 * ws;
  const torsoR_bot = 0.22 * ws;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoR_top, torsoR_bot, torsoH, 8),
    bodyMat
  );
  torso.position.y = 0.68 * hs;  // center of torso
  torso.castShadow = true;
  group.add(torso);

  // --- HEAD (on top of torso) ---
  const headY = (0.68 + torsoH * 0.5 + 0.06 + headR) * hs;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(headR, 14, 10),
    skinMat
  );
  head.position.y = headY;
  head.castShadow = true;
  group.add(head);

  // --- NECK ---
  const neck = cyl(0.08 * ws, 0.08 * ws, 0.1 * hs, skinMat.color.getHex(),
    0, headY - headR - 0.05 * hs, 0, 6);
  neck.material = skinMat;
  group.add(neck);

  // --- EYES (parented to head so they follow head rotation) ---
  // Positions are in head-local space (head center = origin)
  const eyeLocalY = headR * 0.1;
  const eyeForward = headR * 0.88;
  const eyeSide = headR * 0.38;
  const eyeL = sphere(0.035, 0x1A1A1A, -eyeSide, eyeLocalY, eyeForward);
  const eyeR = sphere(0.035, 0x1A1A1A, eyeSide, eyeLocalY, eyeForward);
  head.add(eyeL);
  head.add(eyeR);

  // Eye highlights (tiny white sphere)
  const highlightL = sphere(0.014, 0xFFFFFF, -eyeSide + 0.012, eyeLocalY + 0.018, eyeForward + 0.015);
  const highlightR = sphere(0.014, 0xFFFFFF,  eyeSide + 0.012, eyeLocalY + 0.018, eyeForward + 0.015);
  head.add(highlightL);
  head.add(highlightR);

  // --- SMILE (hidden by default, shown at relationship 3+) ---
  const smileMat = new THREE.MeshLambertMaterial({ color: 0x331111 });
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.013, 6, 10, Math.PI),
    smileMat
  );
  smile.position.set(0, eyeLocalY - headR * 0.3, eyeForward - 0.01);
  smile.rotation.z = Math.PI;
  smile.rotation.x = 0.15;
  smile.visible = false;
  head.add(smile);

  // --- BLUSH MARKS (hidden, shown at max relationship) ---
  const blushMat = new THREE.MeshLambertMaterial({ color: 0xF0A0A0, transparent: true, opacity: 0.6 });
  const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), blushMat);
  blushL.position.set(-eyeSide - 0.04, eyeLocalY - 0.04, eyeForward - 0.01);
  blushL.rotation.y = -0.25;
  blushL.visible = false;
  head.add(blushL);

  const blushR = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), blushMat);
  blushR.position.set(eyeSide + 0.04, eyeLocalY - 0.04, eyeForward - 0.01);
  blushR.rotation.y = 0.25;
  blushR.visible = false;
  head.add(blushR);

  // --- HAIR (parented to head) ---
  const hairGroup = buildHair(app.hairStyle, app.hairColor, headR, ws);
  // Hair position is relative to head center (0,0,0)
  hairGroup.traverse(c => { if (c.isMesh) c.material = hairMat; });
  head.add(hairGroup);

  // --- ACCESSORY ---
  let accessoryMat = null;
  let accessoryGroup = null;
  const headAccessories = ['beret', 'hardhat', 'beanie', 'cap', 'hood', 'flower', 'sunglasses', 'glasses'];
  if (app.accessory && app.accessory !== 'none') {
    const { group: accGroup, material: accMat } = buildAccessory(app.accessory, app.accessoryGrayColor, headR);
    accessoryMat = accMat;
    accessoryGroup = accGroup;

    // Head-level accessories are parented to head (follow rotation)
    if (headAccessories.includes(app.accessory)) {
      // Position relative to head center (0,0,0)
      head.add(accGroup);
    } else if (app.accessory === 'scarf') {
      accGroup.position.y = headY - headR - 0.05 * hs; // neck level
      group.add(accGroup);
    } else if (['apron', 'badge'].includes(app.accessory)) {
      accGroup.position.y = torso.position.y;
      group.add(accGroup);
    } else if (app.accessory === 'backpack') {
      accGroup.position.y = torso.position.y;
      group.add(accGroup);
    } else {
      group.add(accGroup);
    }
  }

  // --- ARM PIVOTS (at shoulder) ---
  const shoulderY = torso.position.y + torsoH * 0.42;
  const shoulderX = (torsoR_top + 0.04) * ws;

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-shoulderX, shoulderY, 0);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(shoulderX, shoulderY, 0);
  group.add(rightArmPivot);

  const armH = 0.38 * hs;
  const armR = 0.055 * ws;

  const leftArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armR, armR * 0.85, armH, 6),
    skinMat
  );
  leftArmMesh.position.y = -armH * 0.5;
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);

  const rightArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armR, armR * 0.85, armH, 6),
    skinMat
  );
  rightArmMesh.position.y = -armH * 0.5;
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  // Hands
  const handR = 0.07 * ws;
  const leftHand = sphere(handR, app.skinTone, 0, -armH - handR * 0.5, 0);
  leftHand.material = skinMat;
  leftArmPivot.add(leftHand);
  const rightHand = sphere(handR, app.skinTone, 0, -armH - handR * 0.5, 0);
  rightHand.material = skinMat;
  rightArmPivot.add(rightHand);

  // --- LEG PIVOTS (at hip) ---
  const hipY = torso.position.y - torsoH * 0.48;
  const legSep = 0.11 * ws;
  const legH = 0.48 * hs;
  const legR = 0.075 * ws;

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-legSep, hipY, 0);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(legSep, hipY, 0);
  group.add(rightLegPivot);

  const leftLegMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legR, legR * 0.85, legH, 6),
    pantsMat
  );
  leftLegMesh.position.y = -legH * 0.5;
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  const rightLegMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legR, legR * 0.85, legH, 6),
    pantsMat
  );
  rightLegMesh.position.y = -legH * 0.5;
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  // Feet
  const footW = 0.16 * ws;
  const footH = 0.10;
  const footD = 0.24;
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(footW, footH, footD), shoesMat);
  leftFoot.position.set(0, -legH - footH * 0.5, footD * 0.1);
  leftFoot.castShadow = true;
  leftLegPivot.add(leftFoot);

  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(footW, footH, footD), shoesMat);
  rightFoot.position.set(0, -legH - footH * 0.5, footD * 0.1);
  rightFoot.castShadow = true;
  rightLegPivot.add(rightFoot);

  // --- HUNCH for old NPCs (Tomas, Taro, Fumio) ---
  if (app.hunch) {
    torso.rotation.x = 0.18;
    // Shift head forward — eyes, hair, accessories follow automatically (parented to head)
    head.position.z += 0.08;
    neck.position.z += 0.04;
  }

  // --- GROUND SHADOW DISC (subtle grounding circle) ---
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.3 * ws, 8),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.01;
  group.add(shadowDisc);

  // --- STORE PART REFERENCES for animation ---
  const parts = {
    torso,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmMesh,
    rightArmMesh,
    leftLegMesh,
    rightLegMesh,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
    smile,
    blushL,
    blushR,
    eyeL,
    eyeR,
    hairGroup,
    baseShoulderY: shoulderY,
    baseTorsoY: torso.position.y,
    baseHeadY: headY,
  };

  return { group, parts, bodyMat, accessoryMat, headMat: skinMat, hairMat };
}

// ============================================================
// NPC COLOR UPDATE
// Called when nearby building colorAmount or relationship changes.
// colorAmount: 0–1 (average colorAmount of buildings within ~15u)
// relLevel: 0–5
// ============================================================

export function updateNPCColor(npcRef, colorAmount, relLevel) {
  if (!npcRef || !npcRef.bodyMat) return;

  const app = NPC_APPEARANCE[npcRef.name] || NPC_APPEARANCE.Mei;
  const blendT = Math.min(1.0, (colorAmount * 0.6 + (relLevel / 5) * 0.4));

  // Body mat: gray (#787878) → personality color
  const grayColor = new THREE.Color(0x787878);
  const fullColor = new THREE.Color(app.personalityColor);
  const bodyBlended = grayColor.clone().lerp(fullColor, blendT * 0.65);
  npcRef.bodyMat.color.copy(bodyBlended);

  // Accessory mat: muted gray color → vibrant personality color
  if (npcRef.accessoryMat) {
    const mutedColor = new THREE.Color(app.accessoryGrayColor);
    const vibrColor = new THREE.Color(app.accessoryColor);
    const accBlended = mutedColor.clone().lerp(vibrColor, blendT);
    npcRef.accessoryMat.color.copy(accBlended);
  }

  // Hair mat: stays hair color but gains saturation
  if (npcRef.hairMat) {
    const dullHair = new THREE.Color(app.hairColor);
    // At max relationship, hair becomes slightly more vivid
    if (blendT > 0.5 && app.hairStyle === 'spiky') {
      // Spiky-haired NPCs (Ren, Vex, Mika, Polly) get vivid hair at high relationship
      const vividHair = new THREE.Color(app.hairColor);
      vividHair.multiplyScalar(1.0 + (blendT - 0.5) * 0.6);
      npcRef.hairMat.color.copy(vividHair);
    } else {
      npcRef.hairMat.color.copy(dullHair);
    }
  }

  // Face expressions: show smile at relLevel >= 3, blush at relLevel >= 5
  if (npcRef.parts) {
    const { smile, blushL, blushR, eyeL, eyeR } = npcRef.parts;
    if (smile) smile.visible = (relLevel >= 3);
    if (blushL) blushL.visible = (relLevel >= 5);
    if (blushR) blushR.visible = (relLevel >= 5);

    // Scale eyes slightly larger as relationship grows
    const eyeScale = 1.0 + Math.min(0.45, relLevel * 0.09);
    if (eyeL) eyeL.scale.setScalar(eyeScale);
    if (eyeR) eyeR.scale.setScalar(eyeScale);
  }
}

// ============================================================
// MAKE LABEL SPRITE (moved from npc.js for coloring control)
// ============================================================

export function makeNPCLabel(name, personalityColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(name);
  const pw = metrics.width + 24;
  const ph = 42;
  const px = (256 - pw) / 2;
  const py = (64 - ph) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 10);
  ctx.fill();

  // Color the text slightly with personality color (muted in gray world)
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(name, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.0, 0.5, 1);

  return { sprite, material: spriteMat, texture: tex };
}

// ============================================================
// EXPORT APPEARANCE DATA for other modules
// ============================================================
