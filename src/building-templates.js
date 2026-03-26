// Building templates — 12 distinct templates built from Three.js primitives
// Each template is a function that returns a THREE.Group with child meshes.
// Templates accept (w, h, d) dimensions and produce geometry relative to (0, 0, 0) base center.
// The main body box is always the first child for material assignment by the color system.

import * as THREE from 'three';

// Base gray materials — cloned per building instance by the generator
const WALL_GRAY = 0x888888;
const ROOF_GRAY = 0x707070;
const DARK_GRAY = 0x6A6A6A;
const WINDOW_GRAY = 0x666666;
const DOOR_GRAY = 0x6A6A6A;

// Helper: create a box mesh with position and optional rotation
function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r, h, color, x, y, z, segments = 8) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, segments),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// ============================================================
// WINDOW GRID HELPER
// Returns array of { mesh, material } for windows on front face
// ============================================================
function makeWindowGrid(w, h, d, winW, winH, floorSpacing, color) {
  const results = [];
  const floors = Math.max(1, Math.floor(h / floorSpacing));
  const perFloor = Math.max(1, Math.floor(w / (winW + 0.5)));
  const startY = floorSpacing * 0.6;

  for (let f = 0; f < floors; f++) {
    const wy = startY + f * floorSpacing;
    if (wy > h - 0.4) continue;
    for (let i = 0; i < perFloor; i++) {
      const wx = -w / 2 + (winW / 2 + 0.3) + i * ((w - winW - 0.6) / Math.max(1, perFloor - 1));
      const mat = new THREE.MeshLambertMaterial({ color });
      const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.04), mat);
      win.position.set(wx, wy, d / 2 + 0.02);
      results.push({ mesh: win, material: mat });
    }
  }
  return results;
}

// Side window helper (x+ face)
function makeSideWindows(w, h, d, floorSpacing, maxFloors, color) {
  const results = [];
  const floors = Math.min(maxFloors, Math.max(1, Math.floor(h / floorSpacing)));
  for (let f = 0; f < floors; f++) {
    const wy = floorSpacing * 0.6 + f * floorSpacing;
    if (wy > h - 0.4) continue;
    const mat = new THREE.MeshLambertMaterial({ color });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.5), mat);
    win.position.set(w / 2 + 0.02, wy, 0);
    results.push({ mesh: win, material: mat });
  }
  return results;
}

// DOOR helper — returns { mesh, material }
function makeDoor(w, h, d, doorW, doorH, color, offsetX) {
  const mat = new THREE.MeshLambertMaterial({ color });
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.04), mat);
  door.position.set(offsetX || 0, doorH / 2, d / 2 + 0.02);
  // Frame
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.15, 0.06, 0.05), frameMat);
  frame.position.set(offsetX || 0, doorH + 0.03, d / 2 + 0.02);
  return { doorMesh: door, doorMaterial: mat, frameMesh: frame };
}

// Rooftop detail helper — 2-3 small boxes (AC units, vents)
function makeRooftopDetail(w, h, d) {
  const meshes = [];
  const count = 2 + (Math.abs(w * 7) % 2); // deterministic 2 or 3
  for (let i = 0; i < count; i++) {
    const bw = 0.4 + (i * 0.2);
    const bh = 0.3 + (i * 0.15);
    const bd = 0.4 + (i * 0.1);
    const m = box(bw, bh, bd, 0x505050,
      (i - 1) * w * 0.25, h + bh / 2, (i - 1) * d * 0.15);
    meshes.push(m);
  }
  return meshes;
}

// ============================================================
// TEMPLATE 1: BASIC HOUSE — box body + pitched roof + door + 2 windows upstairs
// ============================================================
function templateBasicHouse(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Pitched roof (triangular prism via cone4)
  const roofH = h * 0.35;
  const roofR = Math.max(w, d) * 0.58;
  const roofGeo = new THREE.ConeGeometry(roofR, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: ROOF_GRAY }));
  roof.position.set(0, h + roofH / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.8, 1.6, DOOR_GRAY, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // 2 upstairs windows
  const winY = h * 0.65;
  for (const xOff of [-w * 0.25, w * 0.25]) {
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.04), mat);
    win.position.set(xOff, winY, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  // 1 ground floor window
  const gMat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
  const gWin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.04), gMat);
  gWin.position.set(w * 0.3, 1.2, d / 2 + 0.02);
  group.add(gWin);
  windows.push({ mesh: gWin, material: gMat });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 2: TOWNHOUSE — narrow, tall, flat roof with parapet, bay window
// ============================================================
function templateTownhouse(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Flat roof with parapet rim
  const parapetH = 0.3;
  // Front parapet
  group.add(box(w + 0.1, parapetH, 0.15, 0x656565, 0, h + parapetH / 2, d / 2));
  // Back parapet
  group.add(box(w + 0.1, parapetH, 0.15, 0x656565, 0, h + parapetH / 2, -d / 2));
  // Side parapets
  group.add(box(0.15, parapetH, d + 0.1, 0x656565, -w / 2, h + parapetH / 2, 0));
  group.add(box(0.15, parapetH, d + 0.1, 0x656565, w / 2, h + parapetH / 2, 0));

  // Bay window on floor 2 (protruding box)
  const bayY = h * 0.45;
  const bayBox = box(w * 0.4, 1.2, 0.6, 0x686868, 0, bayY, d / 2 + 0.3);
  group.add(bayBox);
  // Bay window glass
  const bayMat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
  const bayWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 0.9, 0.04), bayMat);
  bayWin.position.set(0, bayY, d / 2 + 0.62);
  group.add(bayWin);
  windows.push({ mesh: bayWin, material: bayMat });

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.7, 1.5, DOOR_GRAY, -w * 0.2);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Window grid (narrower building, fewer per floor)
  const wg = makeWindowGrid(w, h, d, 0.45, 0.6, 1.8, WINDOW_GRAY);
  for (const ww of wg) { group.add(ww.mesh); windows.push(ww); }

  // Rooftop detail
  for (const m of makeRooftopDetail(w, h, d)) group.add(m);

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 3: APARTMENT BLOCK — wide, 4 stories, grid of windows, balconies
// ============================================================
function templateApartmentBlock(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Flat roof
  group.add(box(w + 0.2, 0.12, d + 0.2, 0x5E5E5E, 0, h + 0.06, 0));

  // Window grid — residential sized
  const wg = makeWindowGrid(w, h, d, 0.5, 0.7, 1.8, WINDOW_GRAY);
  for (const ww of wg) { group.add(ww.mesh); windows.push(ww); }

  // Side windows
  const sw = makeSideWindows(w, h, d, 1.8, 4, WINDOW_GRAY);
  for (const s of sw) { group.add(s.mesh); windows.push(s); }

  // Balconies on alternating floors (floor 2, 4)
  const floors = Math.floor(h / 1.8);
  for (let f = 1; f < floors; f += 2) {
    const by = 1.8 * 0.6 + f * 1.8;
    if (by > h - 0.5) continue;
    const balcony = box(w * 0.35, 0.08, 0.6, 0x656565, w * 0.2, by, d / 2 + 0.3);
    group.add(balcony);
    // Railing
    const railing = box(w * 0.35, 0.4, 0.04, 0x606060, w * 0.2, by + 0.2, d / 2 + 0.58);
    group.add(railing);
  }

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.8, 1.6, DOOR_GRAY, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Rooftop detail
  for (const m of makeRooftopDetail(w, h, d)) group.add(m);

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 4: COTTAGE — small, squat, very steep pitched roof, single window
// ============================================================
function templateCottage(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Very steep pitched roof
  const roofH = h * 0.6;
  const roofR = Math.max(w, d) * 0.6;
  const roofGeo = new THREE.ConeGeometry(roofR, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: ROOF_GRAY }));
  roof.position.set(0, h + roofH / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Single round-ish window (small square approximation)
  const wMat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), wMat);
  win.position.set(w * 0.25, h * 0.55, d / 2 + 0.02);
  group.add(win);
  windows.push({ mesh: win, material: wMat });

  // Door (slightly smaller)
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.7, 1.4, DOOR_GRAY, -w * 0.15);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Chimney
  group.add(box(0.4, 1.2, 0.4, 0x585858, w * 0.3, h + roofH * 0.3, -d * 0.2));

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 5: SHOP — wider ground floor, large shop window, awning, sign
// ============================================================
function templateShop(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body (slightly wider at base)
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Ground floor extension (wider base)
  const baseExt = box(w + 0.4, h * 0.35, d + 0.2, 0x6C6C6C, 0, h * 0.175, 0);
  group.add(baseExt);

  // Large shop window
  const shopWinMat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
  const shopWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.4, 0.05), shopWinMat);
  shopWin.position.set(w * 0.1, 1.0, d / 2 + 0.12);
  group.add(shopWin);
  windows.push({ mesh: shopWin, material: shopWinMat });

  // Awning (angled thin box)
  const awning = box(w * 0.8, 0.06, 1.2, DARK_GRAY, 0, 2.5, d / 2 + 0.5);
  awning.rotation.x = -0.12;
  group.add(awning);

  // Sign rectangle
  group.add(box(w * 0.6, 0.5, 0.06, 0x606060, 0, 2.8, d / 2 + 0.03));

  // Upper floor windows
  const wg = makeWindowGrid(w, h * 0.5, d, 0.5, 0.6, 1.8, WINDOW_GRAY);
  for (const ww of wg) {
    ww.mesh.position.y += h * 0.4; // shift up to upper floors
    group.add(ww.mesh);
    windows.push(ww);
  }

  // Door (off-center, next to shop window)
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.7, 1.5, DOOR_GRAY, -w * 0.35);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 6: OFFICE — tall, sleek, 5-6 stories, uniform window grid, flat roof
// ============================================================
function templateOffice(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Flat roof with ledge
  group.add(box(w + 0.3, 0.15, d + 0.3, 0x5E5E5E, 0, h + 0.075, 0));

  // Dense window grid — commercial sized
  const wg = makeWindowGrid(w, h, d, 0.8, 1.0, 1.5, WINDOW_GRAY);
  for (const ww of wg) { group.add(ww.mesh); windows.push(ww); }

  // Both side windows
  const swR = makeSideWindows(w, h, d, 1.5, 6, WINDOW_GRAY);
  for (const s of swR) { group.add(s.mesh); windows.push(s); }
  // Left side
  for (let f = 0; f < Math.min(6, Math.floor(h / 1.5)); f++) {
    const wy = 1.5 * 0.6 + f * 1.5;
    if (wy > h - 0.4) continue;
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.5), mat);
    win.position.set(-w / 2 - 0.02, wy, 0);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  // Door (centered, slightly recessed)
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.9, 1.8, DOOR_GRAY, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Rooftop detail
  for (const m of makeRooftopDetail(w, h, d)) group.add(m);

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 7: MARKET STALL — open-sided, 4 poles, flat roof, tables
// ============================================================
function templateMarketStall(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // 4 corner poles
  const poleH = h * 0.8;
  const poleR = 0.08;
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    group.add(cyl(poleR, poleH, 0x787878, px * (w / 2 - 0.2), poleH / 2, pz * (d / 2 - 0.2)));
  }

  // Flat roof plane
  const roof = box(w + 0.3, 0.1, d + 0.3, 0x888888, 0, poleH, 0);
  group.add(roof);

  // Stall tables (2 flat boxes)
  for (let i = 0; i < 2; i++) {
    const tx = -w * 0.25 + i * w * 0.5;
    // Table top
    group.add(box(w * 0.35, 0.06, d * 0.6, 0x656565, tx, 0.8, 0));
    // Table legs
    for (const lz of [-d * 0.2, d * 0.2]) {
      group.add(cyl(0.04, 0.8, 0x606060, tx, 0.4, lz, 4));
    }
  }

  // No door or windows for an open stall — use the body mesh as a tiny invisible base for color tracking
  const body = box(w, 0.05, d, WALL_GRAY, 0, 0.025, 0);
  body.userData.isMainBody = true;
  body.visible = false; // invisible base
  group.add(body);

  return { group, windows, doors, bodyMesh: roof }; // roof gets colored
}

// ============================================================
// TEMPLATE 8: RESTAURANT — shop-like + outdoor seating area
// ============================================================
function templateRestaurant(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Large front window
  const shopWinMat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
  const shopWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.4, 0.05), shopWinMat);
  shopWin.position.set(0, 1.0, d / 2 + 0.03);
  group.add(shopWin);
  windows.push({ mesh: shopWin, material: shopWinMat });

  // Awning
  const awning = box(w * 0.8, 0.06, 1.5, 0x585858, 0, 2.8, d / 2 + 0.6);
  awning.rotation.x = -0.1;
  awning.castShadow = true;
  group.add(awning);

  // Outdoor seating: 3 small tables
  for (let i = 0; i < 3; i++) {
    const tx = -1.5 + i * 1.5;
    const tz = d / 2 + 2.0;
    // Table top
    group.add(box(0.6, 0.04, 0.6, 0x606060, tx, 0.7, tz));
    // Table leg
    group.add(cyl(0.04, 0.7, 0x606060, tx, 0.35, tz, 4));
    // Stool
    group.add(cyl(0.12, 0.04, 0x5A5A5A, tx + 0.3, 0.45, tz, 6));
  }

  // Upper floor windows
  const wg = makeWindowGrid(w, h * 0.5, d, 0.5, 0.6, 1.8, WINDOW_GRAY);
  for (const ww of wg) {
    ww.mesh.position.y += h * 0.4;
    group.add(ww.mesh);
    windows.push(ww);
  }

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.8, 1.6, DOOR_GRAY, -w * 0.3);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 9: WAREHOUSE — long, low, flat roof, corrugated walls, loading dock
// ============================================================
function templateWarehouse(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Corrugated wall effect (dark horizontal lines on front)
  const lineCount = Math.floor(h / 0.8);
  for (let i = 0; i < lineCount; i++) {
    group.add(box(w + 0.02, 0.04, 0.05, 0x5E5E5E, 0, 0.4 + i * 0.8, d / 2 + 0.03));
  }

  // Loading dock (raised platform at one end)
  const dockW = w * 0.5;
  group.add(box(dockW, 0.5, 2, DARK_GRAY, w * 0.2, 0.25, d / 2 + 1));

  // Rolling door
  group.add(box(w * 0.4, 2.5, 0.05, 0x484848, 0, 1.25, d / 2 + 0.02));

  // Minimal windows — 2 high up
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.04), mat);
    win.position.set(-w * 0.3 + i * w * 0.6, h - 0.5, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 10: FACTORY — wide, smokestack, few windows, functional
// ============================================================
function templateFactory(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Smokestack (tall cylinder)
  const stackH = h * 0.8;
  group.add(cyl(0.5, stackH, 0x505050, w * 0.3, h + stackH / 2, -d * 0.25));

  // Ventilation boxes on roof
  for (let i = 0; i < 3; i++) {
    group.add(box(0.8, 0.6, 0.8, 0x505050, -3 + i * 3, h + 0.3, 0));
  }

  // Big rolling door
  group.add(box(w * 0.45, 3, 0.05, 0x484848, 0, 1.5, d / 2 + 0.02));

  // Few windows (high up only)
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.04), mat);
    win.position.set(-w * 0.3 + i * w * 0.3, h - 0.8, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 11: TOWER BUILDING — very tall, slight setback at top, observation deck
// ============================================================
function templateTower(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Setback near top (narrower upper section)
  const setbackH = h * 0.15;
  const setback = box(w * 0.8, setbackH, d * 0.8, 0x686868, 0, h + setbackH / 2, 0);
  setback.castShadow = true;
  group.add(setback);

  // Observation deck (wider thin box near top)
  const deckY = h * 0.85;
  group.add(box(w + 1.0, 0.12, d + 1.0, 0x5E5E5E, 0, deckY, 0));
  // Railing around observation deck
  group.add(box(w + 1.0, 0.5, 0.06, 0x606060, 0, deckY + 0.25, d / 2 + 0.5));
  group.add(box(w + 1.0, 0.5, 0.06, 0x606060, 0, deckY + 0.25, -d / 2 - 0.5));

  // Dense window grid on all faces
  const wg = makeWindowGrid(w, h, d, 0.6, 0.7, 1.2, 0x4A4A50);
  for (const ww of wg) { group.add(ww.mesh); windows.push(ww); }

  // Back face windows
  const floors = Math.floor(h / 1.2);
  const perFloor = Math.max(3, Math.floor(w / 1.0));
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < perFloor; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), mat);
      const wx = -w / 2 + 0.5 + i * ((w - 1) / Math.max(1, perFloor - 1));
      const wy = 1.0 + f * 1.2;
      if (wy > h - 0.3) continue;
      win.position.set(wx, wy, -d / 2 - 0.02);
      group.add(win);
      windows.push({ mesh: win, material: mat });
    }
  }

  // Side windows
  const sideFloors = Math.min(floors, 8);
  for (let f = 0; f < sideFloors; f++) {
    for (const side of [-1, 1]) {
      const mat = new THREE.MeshLambertMaterial({ color: 0x4A4A50 });
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.6), mat);
      win.position.set(side * (w / 2 + 0.02), 1.0 + f * 1.2, 0);
      group.add(win);
      windows.push({ mesh: win, material: mat });
    }
  }

  // Flat roof AC units
  group.add(box(1.5, 0.8, 1.5, 0x505050, w * 0.2, h + setbackH + 0.4, -d * 0.2));

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 1.0, 2.0, DOOR_GRAY, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 12: CHURCH/CHAPEL — box body, steep pointed roof, bell tower
// ============================================================
function templateChurch(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Steep pointed roof
  const roofH = h * 0.5;
  const roofR = Math.max(w, d) * 0.58;
  const roofGeo = new THREE.ConeGeometry(roofR, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: ROOF_GRAY }));
  roof.position.set(0, h + roofH / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Bell tower (small tall box on one end with pointed top)
  const towerW = w * 0.3;
  const towerH = h * 0.8;
  group.add(box(towerW, towerH, towerW, 0x686868, -w * 0.35, h + towerH / 2, 0));
  // Tower spire
  const spireH = towerH * 0.4;
  const spireGeo = new THREE.ConeGeometry(towerW * 0.6, spireH, 4);
  const spire = new THREE.Mesh(spireGeo, new THREE.MeshLambertMaterial({ color: 0x5A5A5A }));
  spire.position.set(-w * 0.35, h + towerH + spireH / 2, 0);
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  group.add(spire);

  // Tall narrow windows (gothic style)
  for (const xOff of [-w * 0.2, 0, w * 0.2]) {
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.04), mat);
    win.position.set(xOff, h * 0.5, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  // Door (arched approximation — wider door)
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 1.0, 1.8, DOOR_GRAY, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Front step
  group.add(box(1.5, 0.15, 0.5, 0x656565, 0, 0.075, d / 2 + 0.3));

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 13: DUPLEX — two-unit house, shared wall, two doors, mirrored windows
// ============================================================
export function templateDuplex(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Center divider (vertical line on front)
  group.add(box(0.08, h, 0.06, 0x5A5A5A, 0, h / 2, d / 2 + 0.02));

  // Pitched roof
  const roofH = h * 0.3;
  const roofR = Math.max(w, d) * 0.58;
  const roofGeo = new THREE.ConeGeometry(roofR, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: ROOF_GRAY }));
  roof.position.set(0, h + roofH / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Two doors (mirrored)
  for (const side of [-1, 1]) {
    const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.7, 1.5, DOOR_GRAY, side * w * 0.25);
    group.add(doorMesh);
    group.add(frameMesh);
    doors.push({ mesh: doorMesh, material: doorMaterial });
  }

  // Mirrored windows per unit
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.04), mat);
    win.position.set(side * w * 0.35, h * 0.6, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
    // Ground floor window
    const gMat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
    const gWin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), gMat);
    gWin.position.set(side * w * 0.35, 1.1, d / 2 + 0.02);
    group.add(gWin);
    windows.push({ mesh: gWin, material: gMat });
  }

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 14: LOFT — tall narrow, large industrial windows, flat roof, fire escape
// ============================================================
export function templateLoft(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Flat roof with water tank
  group.add(box(w + 0.2, 0.12, d + 0.2, 0x5E5E5E, 0, h + 0.06, 0));
  group.add(cyl(0.5, 1.0, 0x555555, w * 0.3, h + 0.6, -d * 0.25));

  // Large industrial windows (tall, narrow)
  const floors = Math.max(2, Math.floor(h / 2.0));
  for (let f = 0; f < floors; f++) {
    const wy = 1.2 + f * 2.0;
    if (wy > h - 0.5) continue;
    const mat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.5, 0.04), mat);
    win.position.set(0, wy, d / 2 + 0.02);
    group.add(win);
    windows.push({ mesh: win, material: mat });
  }

  // Fire escape on side (zigzag stairs)
  for (let f = 0; f < Math.min(floors, 4); f++) {
    const fy = 1.5 + f * 2.0;
    if (fy > h - 0.5) continue;
    group.add(box(0.8, 0.06, 0.8, 0x4A4A4A, w / 2 + 0.4, fy, 0));
    // Railing
    group.add(box(0.06, 0.6, 0.8, 0x4A4A4A, w / 2 + 0.78, fy + 0.3, 0));
  }

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.9, 1.8, DOOR_GRAY, -w * 0.2);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 15: GALLERY — wide glass front, minimal, flat roof, art-adjacent
// ============================================================
export function templateGallery(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Full glass front (large single pane)
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x4A4A55 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.65, 0.04), glassMat);
  glass.position.set(0, h * 0.4, d / 2 + 0.02);
  group.add(glass);
  windows.push({ mesh: glass, material: glassMat });

  // Flat overhanging roof
  group.add(box(w + 1.5, 0.15, d + 0.8, 0x5C5C5C, 0, h + 0.075, 0.3));

  // Door (glass, centered)
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 1.0, 2.0, 0x555560, 0);
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  // Side window
  const sideMat = new THREE.MeshLambertMaterial({ color: WINDOW_GRAY });
  const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.5, d * 0.5), sideMat);
  sideWin.position.set(w / 2 + 0.02, h * 0.45, 0);
  group.add(sideWin);
  windows.push({ mesh: sideWin, material: sideMat });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE 16: ROWHOUSE — narrow, tall, brick-style horizontal lines, stoop
// ============================================================
export function templateRowhouse(w, h, d) {
  const group = new THREE.Group();
  const windows = [];
  const doors = [];

  // Main body
  const body = box(w, h, d, WALL_GRAY, 0, h / 2, 0);
  body.userData.isMainBody = true;
  group.add(body);

  // Horizontal brick lines
  const lineCount = Math.floor(h / 0.5);
  for (let i = 0; i < lineCount; i++) {
    group.add(box(w + 0.02, 0.02, 0.05, 0x6E6E6E, 0, 0.25 + i * 0.5, d / 2 + 0.03));
  }

  // Flat roof with parapet
  group.add(box(w + 0.1, 0.25, 0.1, 0x656565, 0, h + 0.125, d / 2));

  // Stoop (small raised entry)
  group.add(box(w * 0.5, 0.3, 0.8, 0x656565, 0, 0.15, d / 2 + 0.4));

  // Window grid
  const wg = makeWindowGrid(w, h, d, 0.45, 0.65, 1.6, WINDOW_GRAY);
  for (const ww of wg) { group.add(ww.mesh); windows.push(ww); }

  // Door
  const { doorMesh, doorMaterial, frameMesh } = makeDoor(w, h, d, 0.7, 1.5, DOOR_GRAY, 0);
  doorMesh.position.z = d / 2 + 0.42;
  frameMesh.position.z = d / 2 + 0.42;
  group.add(doorMesh);
  group.add(frameMesh);
  doors.push({ mesh: doorMesh, material: doorMaterial });

  return { group, windows, doors, bodyMesh: body };
}

// ============================================================
// TEMPLATE REGISTRY
// ============================================================
export const TEMPLATES = {
  basicHouse: templateBasicHouse,
  townhouse: templateTownhouse,
  apartmentBlock: templateApartmentBlock,
  cottage: templateCottage,
  shop: templateShop,
  office: templateOffice,
  marketStall: templateMarketStall,
  restaurant: templateRestaurant,
  warehouse: templateWarehouse,
  factory: templateFactory,
  tower: templateTower,
  church: templateChurch,
  duplex: templateDuplex,
  loft: templateLoft,
  gallery: templateGallery,
  rowhouse: templateRowhouse,
};

// Template categories for district weighting
export const TEMPLATE_CATEGORIES = {
  residential: ['basicHouse', 'townhouse', 'apartmentBlock', 'cottage', 'duplex', 'rowhouse'],
  commercial: ['shop', 'office', 'restaurant', 'marketStall', 'gallery', 'loft'],
  industrial: ['warehouse', 'factory'],
  unique: ['tower', 'church', 'gallery'],
};
