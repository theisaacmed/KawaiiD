// World — terrain, water, ground, fog, lights
// Buildings and roads are now in buildings.js and roads.js respectively
// This file only handles the terrain plane, water, and atmosphere setup

import * as THREE from 'three';

// Module-level refs for animated ocean and terrain
let oceanMesh = null;
let oceanMesh2 = null;
let terrainMesh = null;

// ========== 2D VALUE NOISE ==========
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) / 2147483647; }
function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy), n10 = hash(ix+1, iy), n01 = hash(ix, iy+1), n11 = hash(ix+1, iy+1);
  return n00*(1-sx)*(1-sy) + n10*sx*(1-sy) + n01*(1-sx)*sy + n11*sx*sy;
}

// ========== TERRAIN HEIGHT ==========
// Returns the world-Y for a given x,z — used by buildings, NPCs, player, and the terrain mesh itself.
export function getTerrainHeight(x, z) {
  return 0;
}

// ========== OCEAN UPDATE ==========
// Called each frame from main.js animate loop.
// worldColor: 0–1 value from color-system
export function updateOcean(time, worldColor = 0) {
  if (oceanMesh) {
    const pos = oceanMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i,
        Math.sin(x * 0.3 + time) * 0.3 +
        Math.sin(y * 0.2 + time * 0.7) * 0.2
      );
    }
    pos.needsUpdate = true;
    oceanMesh.geometry.computeVertexNormals();
    // Lerp color from dull gray-blue to vibrant blue as world gains color
    const t = Math.min(1, worldColor);
    const r = Math.round(0x4a + (0x22 - 0x4a) * t);
    const g = Math.round(0x66 + (0x88 - 0x66) * t);
    const b = Math.round(0x70 + (0xcc - 0x70) * t);
    oceanMesh.material.color.setRGB(r / 255, g / 255, b / 255);
  }
  if (oceanMesh2) {
    const pos2 = oceanMesh2.geometry.attributes.position;
    for (let i = 0; i < pos2.count; i++) {
      const x = pos2.getX(i);
      const y = pos2.getY(i);
      pos2.setZ(i,
        Math.sin(x * 0.25 + time * 1.3 + 0.8) * 0.15 +
        Math.sin(y * 0.35 + time * 0.5 + 1.2) * 0.1
      );
    }
    pos2.needsUpdate = true;
    pos2.geometry?.computeVertexNormals?.();
    oceanMesh2.geometry.computeVertexNormals();
  }
}

export function createWorld(scene) {
  // Fog and background — oppressive gray atmosphere
  scene.fog = new THREE.Fog(0xa0a0a0, 40, 210);
  scene.background = new THREE.Color(0xa0a0a0);

  // ========== HEIGHTMAPPED TERRAIN ==========
  const terrainGeo = new THREE.PlaneGeometry(360, 360, 120, 120);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    tPos.setY(i, getTerrainHeight(tPos.getX(i), tPos.getZ(i)));
  }
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshLambertMaterial({ color: 0x787872 });
  terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // ========== RUINS GROUND (scorched overlay) ==========
  // Dark plane slightly above terrain center to tint the ruins zone
  const ruinsGroundGeo = new THREE.PlaneGeometry(180, 80);
  const ruinsGroundMat = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const ruinsGround = new THREE.Mesh(ruinsGroundGeo, ruinsGroundMat);
  ruinsGround.rotation.x = -Math.PI / 2;
  ruinsGround.position.set(0, getTerrainHeight(0, -120) + 0.05, -120);
  ruinsGround.receiveShadow = true;
  scene.add(ruinsGround);

  // Scattered rubble at ruins edges — small boxes and wedges
  const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x484848 });
  const rubblePositions = [
    { x: -55, z: -80,  w: 3.5, h: 0.8, d: 2.5 },
    { x: -42, z: -90,  w: 2.0, h: 1.2, d: 1.5 },
    { x: -35, z: -155, w: 4.0, h: 0.6, d: 3.0 },
    { x: -22, z: -165, w: 1.5, h: 1.5, d: 1.8 },
    { x:  28, z: -78,  w: 3.0, h: 0.7, d: 2.0 },
    { x:  48, z: -88,  w: 2.5, h: 1.0, d: 3.5 },
    { x:  55, z: -145, w: 1.8, h: 1.3, d: 2.2 },
    { x:  18, z: -162, w: 3.2, h: 0.5, d: 2.8 },
    { x: -15, z: -92,  w: 2.8, h: 0.9, d: 2.0 },
    { x:  35, z: -118, w: 2.0, h: 1.1, d: 1.5 },
    { x: -48, z: -130, w: 1.5, h: 0.7, d: 3.0 },
    { x:  12, z: -78,  w: 4.5, h: 0.4, d: 1.8 },
  ];
  for (const r of rubblePositions) {
    const rg = new THREE.BoxGeometry(r.w, r.h, r.d);
    const rm = new THREE.Mesh(rg, rubbleMat);
    // Slightly tilt each piece
    rm.rotation.y = (r.x * 0.31 + r.z * 0.17) % (Math.PI * 2);
    rm.rotation.z = (r.x * 0.07) % 0.3;
    rm.position.set(r.x, getTerrainHeight(r.x, r.z) + r.h / 2, r.z);
    rm.receiveShadow = true;
    rm.castShadow = true;
    scene.add(rm);
  }

  // ========== TOWER DISTRICT ELEVATION ==========
  const towerElevGeo = new THREE.PlaneGeometry(72, 60);
  const towerElevMat = new THREE.MeshLambertMaterial({ color: 0x7A7A74 });
  const towerElev = new THREE.Mesh(towerElevGeo, towerElevMat);
  towerElev.rotation.x = -Math.PI / 2;
  towerElev.position.set(-84, 0.15, 72);
  towerElev.receiveShadow = true;
  scene.add(towerElev);

  // ========== PORT DOCKS ==========
  // Port center: x=-48, z=120, radius 30
  // Flat platform at y=-0.5 near the waterfront
  const dockPlatGeo = new THREE.PlaneGeometry(36, 18);
  const dockPlatMat = new THREE.MeshLambertMaterial({ color: 0x706858 });
  const dockPlat = new THREE.Mesh(dockPlatGeo, dockPlatMat);
  dockPlat.rotation.x = -Math.PI / 2;
  dockPlat.position.set(-48, -0.45, 130);
  dockPlat.receiveShadow = true;
  scene.add(dockPlat);

  // Wooden dock planks extending northward over the water
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x5A4025 });
  for (let i = 0; i < 5; i++) {
    const px = -62 + i * 7;
    const plankGeo = new THREE.BoxGeometry(1.4, 0.18, 18);
    const plank = new THREE.Mesh(plankGeo, plankMat);
    plank.position.set(px, -0.35, 146);
    plank.castShadow = true;
    plank.receiveShadow = true;
    scene.add(plank);
    // Dock posts under each plank
    const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.5, 5);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3A2818 });
    for (const pz of [138, 152]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, -1.4, pz);
      scene.add(post);
    }
  }

  // ========== ANIMATED OCEAN (northern coast) ==========
  // Main ocean — large, segmented for vertex wave displacement
  const oceanGeo = new THREE.PlaneGeometry(300, 200, 64, 64);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x4a6670,
    transparent: true,
    opacity: 0.85,
    roughness: 0.4,
    metalness: 0.1,
  });
  oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(0, -0.5, 252);
  scene.add(oceanMesh);

  // Second wave layer — smaller, detail chop
  const ocean2Geo = new THREE.PlaneGeometry(300, 60, 48, 24);
  const ocean2Mat = new THREE.MeshStandardMaterial({
    color: 0x5a7480,
    transparent: true,
    opacity: 0.7,
    roughness: 0.6,
  });
  oceanMesh2 = new THREE.Mesh(ocean2Geo, ocean2Mat);
  oceanMesh2.rotation.x = -Math.PI / 2;
  oceanMesh2.position.set(0, -0.25, 155);
  scene.add(oceanMesh2);

  // ========== BURBS PARK ==========
  // Park near Burbs center (90, -12), radius 42
  const parkGeo = new THREE.PlaneGeometry(22, 18);
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x626858 });
  const park = new THREE.Mesh(parkGeo, parkMat);
  park.rotation.x = -Math.PI / 2;
  park.position.set(88, 0.02, -28);
  park.receiveShadow = true;
  scene.add(park);

  // Park trees — cylinder trunk + sphere canopy
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4A3828 });
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x445040 });
  const treePositions = [
    { x: 80,  z: -22 }, { x: 86,  z: -18 }, { x: 93,  z: -20 },
    { x: 98,  z: -30 }, { x: 82,  z: -35 }, { x: 90,  z: -38 },
    { x: 96,  z: -24 },
  ];
  for (const tp of treePositions) {
    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 2.0, 6),
      trunkMat
    );
    const treeBase = getTerrainHeight(tp.x, tp.z);
    trunk.position.set(tp.x, treeBase + 1.0, tp.z);
    trunk.castShadow = true;
    scene.add(trunk);
    // Canopy
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 6),
      canopyMat.clone()
    );
    canopy.position.set(tp.x, treeBase + 2.8, tp.z);
    canopy.castShadow = true;
    scene.add(canopy);
  }

  // ========== SUBTLE TERRAIN VARIATION ==========
  const patchMat = new THREE.MeshLambertMaterial({ color: 0x797973 });
  const terrainPatches = [
    { x: -36, z: 18, w: 30, d: 25 },
    { x: 48, z: -18, w: 25, d: 30 },
    { x: -60, z: -30, w: 20, d: 20 },
    { x: 30, z: 60, w: 35, d: 25 },
    { x: -18, z: 90, w: 25, d: 30 },
    { x: 72, z: 48, w: 20, d: 25 },
  ];
  for (const p of terrainPatches) {
    const geo = new THREE.PlaneGeometry(p.w, p.d);
    const mesh = new THREE.Mesh(geo, patchMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.1 + Math.random() * 0.2, p.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ========== LIGHTS ==========
  const ambient = new THREE.AmbientLight(0x808080, 0.9);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xc0c0c0, 1.0);
  sun.position.set(30, 60, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  scene.add(sun);

  return { ground: terrainMesh, groundMat: terrainMat };
}
