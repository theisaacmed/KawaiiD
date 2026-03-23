// Ruins zone — expanded area in the far south with 20+ rubble piles
// Includes landmark ruins: collapsed school, destroyed "Kawaii Corner", playground, clock tower

import * as THREE from 'three';
import { isNight } from './time-system.js';

const RUINS_Z_START = -150;  // where ruins begin (gradual transition)
const RUINS_Z_END = -240;    // how far ruins extend
const RUINS_X_MIN = -100;
const RUINS_X_MAX = 100;

// 20 rubble pile positions spread across the large ruins area
const PILE_POSITIONS = [
  // Near entrance (easier to find)
  { x: -18, z: -96 },
  { x: 6, z: -93 },
  { x: 24, z: -97.2 },
  { x: -36, z: -94.8 },
  // Middle ruins
  { x: -12, z: -105 },
  { x: 9, z: -106.8 },
  { x: 30, z: -103.2 },
  { x: -30, z: -108 },
  { x: 42, z: -105.6 },
  { x: -48, z: -102 },
  // Deep ruins
  { x: -6, z: -117 },
  { x: 18, z: -118.8 },
  { x: -27, z: -120 },
  { x: 36, z: -115.2 },
  { x: -42, z: -117 },
  // Far ruins (most dangerous, highest reward feel)
  { x: 0, z: -129 },
  { x: -21, z: -132 },
  { x: 24, z: -130.8 },
  { x: -48, z: -127.2 },
  { x: 45, z: -135 },
];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function createRubblePile(scene, px, pz, index) {
  const group = new THREE.Group();
  group.position.set(px, 0, pz);

  const rand = seededRandom(index * 7 + 13);
  const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x505050 });

  const count = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const w = 0.5 + rand() * 2.5;
    const h = 0.3 + rand() * 1.8;
    const d = 0.5 + rand() * 2.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      rand() > 0.5 ? rubbleMat : darkMat
    );
    mesh.position.set(
      (rand() - 0.5) * 4,
      h * 0.3 + rand() * 0.6,
      (rand() - 0.5) * 4,
    );
    mesh.rotation.set(
      (rand() - 0.5) * 0.6,
      rand() * Math.PI,
      (rand() - 0.5) * 0.5,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Larger slab pieces
  for (let i = 0; i < 2; i++) {
    const slabW = 2 + rand() * 3;
    const slabH = 0.2 + rand() * 0.3;
    const slabD = 1.5 + rand() * 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(slabW, slabH, slabD),
      darkMat
    );
    mesh.position.set(
      (rand() - 0.5) * 3,
      slabH / 2 + rand() * 0.4,
      (rand() - 0.5) * 3,
    );
    mesh.rotation.set(
      (rand() - 0.5) * 0.4,
      rand() * Math.PI,
      (rand() - 0.5) * 0.35,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Glowing interaction point
  const glowGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.7 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 1.6, 0);
  group.add(glow);

  const light = new THREE.PointLight(0x66ccff, 0.6, 6);
  light.position.copy(glow.position);
  group.add(light);

  scene.add(group);

  return {
    group,
    glow,
    light,
    worldPos: new THREE.Vector3(px, 0, pz),
    searched: false,
  };
}

function createBoundaryTransition(scene) {
  // Gradual transition — broken fence/rubble marking the edge
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });

  // Broken wall segments across the transition line
  const segments = [
    { x: -80, w: 12, h: 1.2, tilt: 0.05 },
    { x: -50, w: 8, h: 0.8, tilt: -0.1 },
    { x: -25, w: 10, h: 1.0, tilt: 0.08 },
    { x: 5, w: 8, h: 0.6, tilt: -0.15 },
    { x: 30, w: 10, h: 1.1, tilt: 0.03 },
    { x: 55, w: 8, h: 0.9, tilt: -0.08 },
    { x: 80, w: 12, h: 0.7, tilt: 0.12 },
  ];

  for (const seg of segments) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(seg.w, seg.h, 0.5),
      wallMat
    );
    mesh.position.set(seg.x, seg.h / 2, RUINS_Z_START);
    mesh.rotation.z = seg.tilt;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Fence posts
  for (let x = RUINS_X_MIN; x <= RUINS_X_MAX; x += 5) {
    const h = 0.8 + Math.random() * 0.8;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, h, 0.15),
      postMat
    );
    mesh.position.set(x, h / 2, RUINS_Z_START);
    mesh.rotation.z = (Math.random() - 0.5) * 0.3;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // Scattered debris near boundary
  for (let i = 0; i < 20; i++) {
    const w = 0.3 + Math.random() * 0.8;
    const h = 0.15 + Math.random() * 0.3;
    const d = 0.3 + Math.random() * 0.7;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      wallMat
    );
    mesh.position.set(
      RUINS_X_MIN + Math.random() * (RUINS_X_MAX - RUINS_X_MIN),
      h / 2,
      RUINS_Z_START + (Math.random() - 0.5) * 6,
    );
    mesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    mesh.castShadow = true;
    scene.add(mesh);
  }
}

function createRuinsLandmarks(scene) {
  const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x585858 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0x626262 });

  // ===== COLLAPSED SCHOOL (flat wide rubble with playground frame — bent metal bars) =====
  const schoolGroup = new THREE.Group();
  schoolGroup.position.set(-40, 0, -185);
  // Main building (flattened)
  const schoolBody = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 10), rubbleMat);
  schoolBody.position.y = 0.8;
  schoolBody.rotation.x = 0.15;
  schoolBody.rotation.z = -0.08;
  schoolBody.castShadow = true;
  schoolGroup.add(schoolBody);
  // Roof fragment on ground
  const schoolRoof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 6), darkMat);
  schoolRoof.position.set(2, 0.5, 6);
  schoolRoof.rotation.x = -0.5;
  schoolGroup.add(schoolRoof);
  // Bent playground frame (metal bars sticking out of rubble)
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
  // Swing A-frame bars (bent)
  const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), metalMat);
  bar1.position.set(8, 1.2, -2);
  bar1.rotation.z = 0.5;
  bar1.rotation.x = 0.2;
  bar1.castShadow = true;
  schoolGroup.add(bar1);
  const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), metalMat);
  bar2.position.set(9, 1.0, -1);
  bar2.rotation.z = -0.4;
  bar2.rotation.x = -0.15;
  bar2.castShadow = true;
  schoolGroup.add(bar2);
  // Crossbar (twisted)
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 6), metalMat);
  crossbar.position.set(8.5, 2.5, -1.5);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.rotation.z = 0.3;
  schoolGroup.add(crossbar);
  // Bent slide piece sticking up
  const slideBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 2.5), metalMat);
  slideBar.position.set(6, 1.5, 1);
  slideBar.rotation.x = -0.6;
  slideBar.rotation.z = 0.3;
  schoolGroup.add(slideBar);
  // Debris
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + Math.random() * 1.5, 0.2 + Math.random() * 0.5, 0.5 + Math.random() * 1),
      Math.random() > 0.5 ? rubbleMat : darkMat
    );
    d.position.set((Math.random() - 0.5) * 16, Math.random() * 0.5, (Math.random() - 0.5) * 14);
    d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    d.castShadow = true;
    schoolGroup.add(d);
  }
  scene.add(schoolGroup);

  // ===== KAWAII CORNER (partially standing, cracked sign — tutorial landmark) =====
  const kcGroup = new THREE.Group();
  kcGroup.position.set(20, 0, -200);
  // Two standing wall sections at different heights
  const wallA = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 0.5), lightMat);
  wallA.position.set(-1, 2, 2.5);
  wallA.rotation.z = 0.03;
  wallA.castShadow = true;
  kcGroup.add(wallA);
  const wallB = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 0.5), rubbleMat);
  wallB.position.set(2.5, 1.25, 2.5);
  wallB.rotation.z = -0.05;
  wallB.castShadow = true;
  kcGroup.add(wallB);
  // Side wall (partially collapsed)
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 5), rubbleMat);
  sideWall.position.set(-3.2, 1.2, 0);
  sideWall.rotation.x = 0.1;
  sideWall.castShadow = true;
  kcGroup.add(sideWall);
  // Floor rubble
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 5), darkMat);
  floor.position.set(0, 0.08, 0);
  kcGroup.add(floor);
  // Cracked sign (faded but recognizable)
  const signMat = new THREE.MeshBasicMaterial({ color: 0x998877, transparent: true, opacity: 0.6 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 0.08), signMat);
  sign.position.set(0, 4.2, 2.55);
  sign.rotation.z = -0.08;
  kcGroup.add(sign);
  // Pink text backing (faded — "Kawaii Corner")
  const textMat = new THREE.MeshBasicMaterial({ color: 0xCC88AA, transparent: true, opacity: 0.35 });
  const textBg = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.09), textMat);
  textBg.position.set(0, 4.2, 2.57);
  textBg.rotation.z = -0.08;
  kcGroup.add(textBg);
  // Crack line across sign
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
  const crack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.03, 0.1), crackMat);
  crack.position.set(0.3, 4.15, 2.6);
  crack.rotation.z = 0.15;
  kcGroup.add(crack);
  // Scattered toy-like debris
  for (let i = 0; i < 10; i++) {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 + Math.random() * 0.8, 0.2 + Math.random() * 0.4, 0.3 + Math.random() * 0.6),
      Math.random() > 0.5 ? rubbleMat : darkMat
    );
    d.position.set((Math.random() - 0.5) * 9, Math.random() * 0.4, (Math.random() - 0.5) * 8);
    d.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);
    d.castShadow = true;
    kcGroup.add(d);
  }
  scene.add(kcGroup);

  // ===== DESTROYED FOUNTAIN (broken version of Town fountain — dry, cracked) =====
  const dfGroup = new THREE.Group();
  dfGroup.position.set(0, 0, -190);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
  // Cracked base (two halves separated)
  const baseHalf1 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 16, 1, false, 0, Math.PI), stoneMat);
  baseHalf1.position.set(-0.3, 0.25, 0);
  baseHalf1.rotation.y = 0.1;
  baseHalf1.castShadow = true;
  dfGroup.add(baseHalf1);
  const baseHalf2 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 16, 1, false, Math.PI, Math.PI), stoneMat);
  baseHalf2.position.set(0.4, 0.2, 0.2);
  baseHalf2.rotation.y = -0.05;
  baseHalf2.rotation.z = 0.1;
  baseHalf2.castShadow = true;
  dfGroup.add(baseHalf2);
  // Broken column stump
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), stoneMat);
  stump.position.y = 0.7;
  stump.castShadow = true;
  dfGroup.add(stump);
  // Fallen column piece on ground nearby
  const fallenCol = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.0, 8), stoneMat);
  fallenCol.position.set(2, 0.15, 1);
  fallenCol.rotation.z = Math.PI / 2;
  fallenCol.rotation.y = 0.3;
  dfGroup.add(fallenCol);
  // Broken bowl piece
  const bowlFrag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5), stoneMat);
  bowlFrag.position.set(-1.5, 0.15, -0.5);
  bowlFrag.rotation.set(0.4, 0.2, 0.1);
  dfGroup.add(bowlFrag);
  // Dry cracked ground (different shade)
  const dryMat = new THREE.MeshLambertMaterial({ color: 0x525252 });
  const dryGround = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.03, 16), dryMat);
  dryGround.position.y = 0.015;
  dryGround.receiveShadow = true;
  dfGroup.add(dryGround);
  // Cracks in ground (thin dark lines)
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2, 0.02, 0.04), darkMat);
    cl.position.set((Math.random() - 0.5) * 4, 0.04, (Math.random() - 0.5) * 4);
    cl.rotation.y = Math.random() * Math.PI;
    dfGroup.add(cl);
  }
  scene.add(dfGroup);

  // ===== TOPPLED CLOCK TOWER (matches Downtown's standing one) =====
  const ctGroup = new THREE.Group();
  ctGroup.position.set(-10, 0, -220);
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x5A5A5A });
  // Fallen tower body (horizontal)
  const towerBody = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 10), towerMat);
  towerBody.position.set(0, 1.5, 0);
  towerBody.rotation.x = Math.PI / 2 - 0.1;
  towerBody.castShadow = true;
  ctGroup.add(towerBody);
  // Broken pointed top (cone on its side)
  const topCone = new THREE.Mesh(new THREE.ConeGeometry(2, 2, 4), towerMat);
  topCone.position.set(0, 0.8, -7);
  topCone.rotation.x = Math.PI / 2;
  topCone.rotation.z = Math.PI / 4;
  topCone.castShadow = true;
  ctGroup.add(topCone);
  // Broken clock face on ground
  const clockMat = new THREE.MeshBasicMaterial({ color: 0xBBBBBB, transparent: true, opacity: 0.5 });
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 12), clockMat);
  clockFace.position.set(1.5, 0.2, -5);
  clockFace.rotation.x = Math.PI / 2;
  clockFace.rotation.z = 0.4;
  ctGroup.add(clockFace);
  // Debris around
  for (let i = 0; i < 8; i++) {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + Math.random(), 0.2 + Math.random() * 0.4, 0.5 + Math.random()),
      Math.random() > 0.5 ? towerMat : darkMat
    );
    d.position.set((Math.random() - 0.5) * 10, Math.random() * 0.3, (Math.random() - 0.5) * 14);
    d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    d.castShadow = true;
    ctGroup.add(d);
  }
  scene.add(ctGroup);

  // ===== ROW OF COLLAPSED HOUSES (residential street line) =====
  const houseRowZ = -205;
  for (let i = 0; i < 6; i++) {
    const hx = -50 + i * 12;
    const hGroup = new THREE.Group();
    hGroup.position.set(hx, 0, houseRowZ);

    // Each house: partial wall + rubble
    const wallH = 1 + Math.random() * 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5, wallH, 0.4), rubbleMat);
    wall.position.set(0, wallH / 2, 2);
    wall.rotation.z = (Math.random() - 0.5) * 0.15;
    wall.castShadow = true;
    hGroup.add(wall);

    // Side wall fragment
    if (Math.random() > 0.4) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH * 0.7, 3), darkMat);
      sw.position.set(2.3, wallH * 0.3, 0.5);
      sw.rotation.x = (Math.random() - 0.5) * 0.2;
      sw.castShadow = true;
      hGroup.add(sw);
    }

    // Rubble pile in front
    for (let j = 0; j < 5; j++) {
      const r = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 + Math.random() * 1.5, 0.2 + Math.random() * 0.6, 0.5 + Math.random()),
        Math.random() > 0.5 ? rubbleMat : darkMat
      );
      r.position.set((Math.random() - 0.5) * 5, Math.random() * 0.4, (Math.random() - 0.5) * 4);
      r.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.2);
      r.castShadow = true;
      hGroup.add(r);
    }

    scene.add(hGroup);
  }

  // ===== ADDITIONAL COLLAPSED BUILDINGS =====
  const collapsedPositions = [
    { x: -70, z: -170, w: 5, d: 4, h: 4, tiltX: 0.3, tiltZ: -0.1 },
    { x: 80, z: -180, w: 4, d: 5, h: 3, tiltX: -0.5, tiltZ: 0.1 },
    { x: -55, z: -210, w: 6, d: 4, h: 5, tiltX: 0.2, tiltZ: 0.15 },
    { x: 50, z: -210, w: 4, d: 4, h: 3.5, tiltX: -0.4, tiltZ: -0.2 },
    { x: -25, z: -235, w: 5, d: 5, h: 4, tiltX: 0.3, tiltZ: 0 },
    { x: 35, z: -230, w: 6, d: 4, h: 3, tiltX: -0.6, tiltZ: 0.1 },
    { x: -85, z: -195, w: 4, d: 4, h: 3.5, tiltX: 0.2, tiltZ: -0.15 },
    { x: 90, z: -200, w: 5, d: 3, h: 4, tiltX: -0.3, tiltZ: 0.2 },
  ];
  for (const c of collapsedPositions) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(c.w, c.h, c.d),
      rubbleMat
    );
    body.position.set(c.x, c.h * 0.3, c.z);
    body.rotation.x = c.tiltX;
    body.rotation.z = c.tiltZ;
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 + Math.random() * 1.2, 0.15 + Math.random() * 0.4, 0.5 + Math.random()),
        darkMat
      );
      d.position.set(
        c.x + (Math.random() - 0.5) * (c.w + 3),
        Math.random() * 0.3,
        c.z + (Math.random() - 0.5) * (c.d + 3)
      );
      d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      d.castShadow = true;
      scene.add(d);
    }
  }

  // Debris mounds scattered throughout
  const moundPositions = [
    { x: -9, z: -99 }, { x: 27, z: -102 }, { x: -36, z: -114 },
    { x: 42, z: -117 }, { x: -18, z: -129 }, { x: 33, z: -135 },
    { x: -54, z: -108 }, { x: 51, z: -129 },
    // Additional mounds for more density
    { x: 15, z: -99 }, { x: -27, z: -105 }, { x: 36, z: -126 },
    { x: -45, z: -135 },
  ];
  for (const mp of moundPositions) {
    for (let i = 0; i < 6; i++) {
      const s = 0.2 + Math.random() * 0.6;
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * 0.6, s * 0.8),
        Math.random() > 0.5 ? rubbleMat : darkMat
      );
      piece.position.set(
        mp.x + (Math.random() - 0.5) * 3,
        s * 0.2 + Math.random() * 0.3,
        mp.z + (Math.random() - 0.5) * 3
      );
      piece.rotation.set(Math.random(), Math.random(), Math.random());
      piece.castShadow = true;
      scene.add(piece);
    }
  }

  // Broken road fragments in ruins
  const brokenRoadMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  for (let i = 0; i < 25; i++) {
    const frag = new THREE.Mesh(
      new THREE.BoxGeometry(1 + Math.random() * 3, 0.04, 0.8 + Math.random() * 2),
      brokenRoadMat
    );
    frag.position.set(
      (Math.random() - 0.5) * 180,
      0.01,
      -155 - Math.random() * 80
    );
    frag.rotation.y = (Math.random() - 0.5) * 0.4;
    scene.add(frag);
  }
}

// Crumbling wall/fence structures around the outer edges of the ruins
function createOuterRuinsBoundary(scene) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });

  // East edge walls
  for (let z = -160; z > -240; z -= 15) {
    const h = 0.8 + Math.random() * 1.5;
    const w = 4 + Math.random() * 6;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, w), wallMat);
    wall.position.set(RUINS_X_MAX - 5 + Math.random() * 5, h / 2, z);
    wall.rotation.y = (Math.random() - 0.5) * 0.2;
    wall.rotation.z = (Math.random() - 0.5) * 0.15;
    wall.castShadow = true;
    scene.add(wall);
  }

  // West edge walls
  for (let z = -160; z > -240; z -= 15) {
    const h = 0.6 + Math.random() * 1.2;
    const w = 3 + Math.random() * 5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, w), wallMat);
    wall.position.set(RUINS_X_MIN + 5 - Math.random() * 5, h / 2, z);
    wall.rotation.y = (Math.random() - 0.5) * 0.2;
    wall.rotation.z = (Math.random() - 0.5) * 0.2;
    wall.castShadow = true;
    scene.add(wall);
  }

  // South edge walls (far boundary)
  for (let x = RUINS_X_MIN; x < RUINS_X_MAX; x += 12) {
    const h = 0.5 + Math.random() * 1.0;
    const w = 5 + Math.random() * 6;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), darkMat);
    wall.position.set(x + Math.random() * 5, h / 2, RUINS_Z_END + 5);
    wall.rotation.z = (Math.random() - 0.5) * 0.2;
    wall.castShadow = true;
    scene.add(wall);
  }

  // Broken fence posts along edges
  for (let i = 0; i < 20; i++) {
    const side = Math.random() > 0.5 ? RUINS_X_MAX : RUINS_X_MIN;
    const h = 0.5 + Math.random() * 0.8;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), darkMat);
    post.position.set(
      side + (Math.random() - 0.5) * 8,
      h / 2,
      -155 - Math.random() * 85
    );
    post.rotation.z = (Math.random() - 0.5) * 0.4;
    post.castShadow = true;
    scene.add(post);
  }
}

// Empty wasteland beyond the ruins — flat gray-brown ground with fog
function createWasteland(scene) {
  // Large flat plane extending south and east/west beyond ruins
  const wastelandMat = new THREE.MeshLambertMaterial({ color: 0x555048 }); // gray-brown
  const wasteland = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), wastelandMat);
  wasteland.rotation.x = -Math.PI / 2;
  wasteland.position.set(0, -0.02, RUINS_Z_END - 80);
  wasteland.receiveShadow = true;
  scene.add(wasteland);

  // Sparse scattered debris at the edges
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x4E4E4E });
  for (let i = 0; i < 15; i++) {
    const s = 0.3 + Math.random() * 0.8;
    const debris = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.3, s), debrisMat);
    debris.position.set(
      (Math.random() - 0.5) * 300,
      s * 0.1,
      RUINS_Z_END - 10 - Math.random() * 60
    );
    debris.rotation.y = Math.random() * Math.PI;
    scene.add(debris);
  }
}

export function createRuins(scene) {
  createBoundaryTransition(scene);
  createRuinsLandmarks(scene);
  createOuterRuinsBoundary(scene);
  createWasteland(scene);

  const piles = PILE_POSITIONS.map((pos, i) => createRubblePile(scene, pos.x, pos.z, i));

  return { piles, RUINS_Z_START };
}

// Pulse animation for glow spheres
export function updateRuinsGlow(piles, time) {
  const nightBoost = isNight() ? 1.6 : 1.0;
  for (const pile of piles) {
    if (pile.searched) continue;
    const pulse = 0.4 + 0.35 * Math.sin(time * 3 + pile.worldPos.x);
    pile.glow.material.opacity = Math.min(1, pulse * nightBoost);
    pile.light.intensity = (0.3 + 0.4 * pulse) * nightBoost;
    pile.glow.scale.setScalar((0.9 + 0.2 * Math.sin(time * 3 + pile.worldPos.z)) * (isNight() ? 1.3 : 1.0));
  }
}

export { RUINS_Z_START as RUINS_BOUNDARY };
