// Enhanced ruins detail — additional debris and atmospheric elements
// Main ruins landmarks are now in ruins.js. This adds extra environmental variety.

import * as THREE from 'three';

const RUINS_Z_START = -150;

function createBrokenFences(scene) {
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x4A4A40 });
  const pieces = [
    { x: -40, z: -155, w: 1.5, h: 0.6, tilt: 0.3 },
    { x: -20, z: -165, w: 2, h: 0.8, tilt: -0.4 },
    { x: 30, z: -160, w: 1.8, h: 0.5, tilt: 0.5 },
    { x: 60, z: -170, w: 1.2, h: 0.7, tilt: -0.2 },
    { x: -70, z: -180, w: 1.5, h: 0.4, tilt: 0.6 },
    { x: 50, z: -190, w: 2, h: 0.5, tilt: -0.3 },
    { x: -55, z: -200, w: 1.8, h: 0.6, tilt: 0.4 },
    { x: 80, z: -175, w: 1.5, h: 0.5, tilt: -0.5 },
  ];

  for (const p of pieces) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 0.08), fenceMat);
    fence.position.set(p.x, p.h * 0.3, p.z);
    fence.rotation.z = p.tilt;
    fence.rotation.y = Math.random() * 0.3;
    fence.castShadow = true;
    scene.add(fence);
  }
}

function createRuinedFurniture(scene) {
  const rustMat = new THREE.MeshLambertMaterial({ color: 0x5A4A3A });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  // Rusted bench
  const benchGroup = new THREE.Group();
  benchGroup.position.set(-30, 0, -170);
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), rustMat);
  benchSeat.position.set(0, 0.35, 0);
  benchSeat.rotation.z = 0.15;
  benchGroup.add(benchSeat);
  const benchLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.4), rustMat);
  benchLeg.position.set(0.45, 0.2, 0);
  benchGroup.add(benchLeg);
  scene.add(benchGroup);

  // Cracked fountain
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(40, 0, -185);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.4, 12), stoneMat);
  basin.position.y = 0.2;
  fountainGroup.add(basin);
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8), stoneMat);
  stump.position.y = 0.6;
  fountainGroup.add(stump);
  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 8), stoneMat);
  fallen.position.set(0.8, 0.2, 0.3);
  fallen.rotation.z = Math.PI / 2;
  fallen.rotation.x = 0.3;
  fountainGroup.add(fallen);
  scene.add(fountainGroup);

  // Fallen street lamp
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-15, 0, -195);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6), rustMat);
  pole.position.set(0, 0.15, 0);
  pole.rotation.z = Math.PI / 2 - 0.1;
  lampGroup.add(pole);
  const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshLambertMaterial({ color: 0x444444 }));
  lampHead.position.set(1.7, 0.2, 0);
  lampGroup.add(lampHead);
  scene.add(lampGroup);
}

export function createRuinsDetail(scene) {
  createBrokenFences(scene);
  createRuinedFurniture(scene);
}
