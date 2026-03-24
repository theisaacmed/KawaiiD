import * as THREE from 'three';

let debugMode = false;
let selectedBuilding = null;
let infoPanel = null;
let debugLabel = null;

export function initDebugPlacer(buildings, camera, scene) {
  infoPanel = document.createElement('div');
  infoPanel.style.cssText = 'position:fixed;top:60px;left:16px;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:13px;padding:12px;border-radius:6px;display:none;z-index:9999;min-width:250px;';
  document.body.appendChild(infoPanel);

  debugLabel = document.createElement('div');
  debugLabel.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,0,0,0.8);color:#fff;font-family:Arial;font-size:16px;font-weight:bold;padding:6px 20px;border-radius:4px;display:none;z-index:9999;';
  debugLabel.textContent = 'DEBUG MODE (T to exit)';
  document.body.appendChild(debugLabel);

  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      e.stopPropagation();
      e.preventDefault();
      debugMode = !debugMode;
      debugLabel.style.display = debugMode ? 'block' : 'none';
      infoPanel.style.display = debugMode && selectedBuilding ? 'block' : 'none';
      if (debugMode) document.exitPointerLock();
      return;
    }
    if (!debugMode) return;

    if (selectedBuilding) {
      const step = e.shiftKey ? 0.5 : 2;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); selectedBuilding.position.x -= step; }
      if (e.key === 'ArrowRight') { e.preventDefault(); selectedBuilding.position.x += step; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); selectedBuilding.position.z -= step; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); selectedBuilding.position.z += step; }
      if (e.key === 'r' || e.key === 'R') selectedBuilding.rotation.y += Math.PI / 2;
      if (e.key === 'c' || e.key === 'C') {
        const data = JSON.stringify({
          name: selectedBuilding.userData.namedId || selectedBuilding.name || 'unknown',
          x: Math.round(selectedBuilding.position.x * 10) / 10,
          z: Math.round(selectedBuilding.position.z * 10) / 10,
          rotationY: Math.round(selectedBuilding.rotation.y * 100) / 100,
        });
        navigator.clipboard.writeText(data);
        console.log('Copied:', data);
      }
      updateInfoPanel();
    }

    if (e.key === '`') {
      const allData = buildings
        .filter(b => b.userData?.namedId)
        .map(b => ({
          name: b.userData.namedId,
          x: Math.round(b.position.x * 10) / 10,
          z: Math.round(b.position.z * 10) / 10,
          rotationY: Math.round(b.rotation.y * 100) / 100,
        }));
      console.log(JSON.stringify(allData, null, 2));
    }
  }, true); // capture phase — fires before player handler

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', (e) => {
    if (!debugMode) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = [];
    buildings.forEach(b => b.traverse(child => { if (child.isMesh) allMeshes.push(child); }));

    const intersects = raycaster.intersectObjects(allMeshes);
    if (intersects.length > 0) {
      const hitChild = intersects[0].object;
      const building = buildings.find(b => {
        let found = false;
        b.traverse(c => { if (c === hitChild) found = true; });
        return found;
      });
      if (building) {
        selectedBuilding = building;
        updateInfoPanel();
        infoPanel.style.display = 'block';
      }
    }
  });
}

function updateInfoPanel() {
  if (!selectedBuilding || !infoPanel) return;
  const p = selectedBuilding.position;
  const name = selectedBuilding.userData.namedId || selectedBuilding.name || 'Unknown';
  infoPanel.innerHTML = `
    <b>${name}</b><br>
    X: ${p.x.toFixed(1)}<br>
    Z: ${p.z.toFixed(1)}<br>
    Y: ${p.y.toFixed(1)}<br>
    Rot: ${(selectedBuilding.rotation.y * 180 / Math.PI).toFixed(0)}°<br>
    <br>
    <span style="color:#888">Arrow keys: move (Shift=fine)<br>
    R: rotate 90° | C: copy JSON<br>
    \`: dump all named positions</span>
  `;
}

export function isDebugMode() { return debugMode; }
