// Apartment interior — player's studio/workshop with station placement spots
// The apartment building at (12, 14) becomes a walkable interior with stations

import * as THREE from 'three';

let apartmentGroup = null;
let sceneRef = null;

// Apartment interior bounds (inside the building at x=12, z=14, 7x7)
// Interior is slightly smaller than the building shell
const APARTMENT_CENTER = new THREE.Vector3(12, 0, 14);
const INTERIOR_W = 5.5;
const INTERIOR_D = 5.5;

// Station placement positions (world coords)
// Bed is already at (14, 0, 12) — south-east corner
// Print station: against the north wall, west side
export const PRINT_STATION_POS = new THREE.Vector3(10.0, 0, 16.5);
// Future station spots:
export const SEWING_STATION_POS = new THREE.Vector3(14.0, 0, 16.5);  // north wall, east side
export const STUFFING_STATION_POS = new THREE.Vector3(10.0, 0, 11.5); // south wall, west side
// Gacha machine already at (14, 0, 12) — south-east corner

export function createApartment(scene) {
  sceneRef = scene;
  apartmentGroup = new THREE.Group();

  // Floor mat / rug to mark the workshop area
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(INTERIOR_W, INTERIOR_D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(APARTMENT_CENTER.x, 0.02, APARTMENT_CENTER.z);
  floor.receiveShadow = true;
  apartmentGroup.add(floor);

  // Small work table in the center (gives the studio feel)
  const tableMat = new THREE.MeshLambertMaterial({ color: 0x6b5b3a });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), tableMat);
  tableTop.position.set(12, 0.65, 14);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  apartmentGroup.add(tableTop);

  // Table legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a2a });
  const legGeo = new THREE.BoxGeometry(0.06, 0.65, 0.06);
  const offsets = [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]];
  for (const [ox, oz] of offsets) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(12 + ox, 0.325, 14 + oz);
    apartmentGroup.add(leg);
  }

  // Ambient light inside apartment (warm workshop glow)
  const warmLight = new THREE.PointLight(0xffe8c0, 0.4, 8);
  warmLight.position.set(12, 3, 14);
  apartmentGroup.add(warmLight);

  scene.add(apartmentGroup);
}

export function getApartmentGroup() {
  return apartmentGroup;
}
