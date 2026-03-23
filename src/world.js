// World — terrain, water, ground, fog, lights
// Buildings and roads are now in buildings.js and roads.js respectively
// This file only handles the terrain plane, water, and atmosphere setup

import * as THREE from 'three';

export function createWorld(scene) {
  // Fog and background — oppressive gray atmosphere
  scene.fog = new THREE.Fog(0xa0a0a0, 40, 210);
  scene.background = new THREE.Color(0xa0a0a0);

  // ========== MAIN GROUND PLANE ==========
  // 500x500 unit city area
  const groundGeo = new THREE.PlaneGeometry(360, 360);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x787872 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ========== RUINS GROUND (darker, rougher) ==========
  // South area (Z < -150) has cracked darker ground
  const ruinsGroundGeo = new THREE.PlaneGeometry(180, 72);
  const ruinsGroundMat = new THREE.MeshLambertMaterial({ color: 0x606058 });
  const ruinsGround = new THREE.Mesh(ruinsGroundGeo, ruinsGroundMat);
  ruinsGround.rotation.x = -Math.PI / 2;
  ruinsGround.position.set(0, 0.002, -120);
  ruinsGround.receiveShadow = true;
  scene.add(ruinsGround);

  // ========== TOWER DISTRICT ELEVATION ==========
  // Slight elevation for Tower district area
  const towerElevGeo = new THREE.PlaneGeometry(72, 60);
  const towerElevMat = new THREE.MeshLambertMaterial({ color: 0x7A7A74 });
  const towerElev = new THREE.Mesh(towerElevGeo, towerElevMat);
  towerElev.rotation.x = -Math.PI / 2;
  towerElev.position.set(-84, 0.15, 72);
  towerElev.receiveShadow = true;
  scene.add(towerElev);

  // ========== WATER PLANE (northern coast) ==========
  // Water at Z > 220, extends north
  const waterGeo = new THREE.PlaneGeometry(800, 400);
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x5A7A8A,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.5, 252);
  scene.add(water);

  // Secondary water strip closer to shore for depth effect
  const shoreWaterGeo = new THREE.PlaneGeometry(360, 24);
  const shoreWaterMat = new THREE.MeshLambertMaterial({
    color: 0x6A8A98,
    transparent: true,
    opacity: 0.7,
  });
  const shoreWater = new THREE.Mesh(shoreWaterGeo, shoreWaterMat);
  shoreWater.rotation.x = -Math.PI / 2;
  shoreWater.position.set(0, -0.3, 138);
  scene.add(shoreWater);

  // ========== SUBTLE TERRAIN VARIATION ==========
  // Small raised patches to break up the flat feel
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
  const ambient = new THREE.AmbientLight(0x808080, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xc0c0c0, 0.8);
  sun.position.set(50, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  return { ground, groundMat };
}
