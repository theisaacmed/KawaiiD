import * as THREE from 'three';

let debugMode = false;
let selectedBuilding = null;
let infoPanel = null;
let debugLabel = null;
let buildingsRef = null;
let cameraRef = null;

export function initDebugPlacer(buildings, camera, scene) {
  buildingsRef = buildings;
  cameraRef = camera;

  infoPanel = document.createElement('div');
  infoPanel.style.cssText = 'position:fixed;top:60px;left:16px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:13px;padding:12px;border-radius:6px;display:none;z-index:9999;min-width:250px;';
  document.body.appendChild(infoPanel);

  debugLabel = document.createElement('div');
  debugLabel.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,0,0,0.85);color:#fff;font-family:Arial;font-size:16px;font-weight:bold;padding:6px 20px;border-radius:4px;display:none;z-index:9999;';
  debugLabel.textContent = 'DEBUG MODE (T to exit)';
  document.body.appendChild(debugLabel);

  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      if (!debugMode && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      debugMode = !debugMode;
      debugLabel.style.display = debugMode ? 'block' : 'none';
      infoPanel.style.display = debugMode && selectedBuilding ? 'block' : 'none';
      if (debugMode) { document.exitPointerLock(); }
      return;
    }
    if (!debugMode || !selectedBuilding) return;

    const step = e.shiftKey ? 0.5 : 2;
    const mesh = selectedBuilding;
    if (e.key === 'ArrowLeft') { mesh.position.x -= step; e.preventDefault(); }
    if (e.key === 'ArrowRight') { mesh.position.x += step; e.preventDefault(); }
    if (e.key === 'ArrowUp') { mesh.position.z -= step; e.preventDefault(); }
    if (e.key === 'ArrowDown') { mesh.position.z += step; e.preventDefault(); }
    if (e.key === 'r' || e.key === 'R') mesh.rotation.y += Math.PI / 2;
    if (e.key === 'c' || e.key === 'C') {
      const data = JSON.stringify({
        name: mesh.userData.namedId || mesh.name || 'unknown',
        x: Math.round(mesh.position.x * 10) / 10,
        z: Math.round(mesh.position.z * 10) / 10,
        rotationY: Math.round(mesh.rotation.y * 100) / 100
      });
      navigator.clipboard.writeText(data).catch(() => {});
      console.log('Copied:', data);
    }
    if (e.key === 'd' || e.key === 'D') {
      const allData = buildingsRef.filter(b => b.userData && b.userData.namedId).map(b => ({
        name: b.userData.namedId,
        x: Math.round(b.position.x * 10) / 10,
        z: Math.round(b.position.z * 10) / 10,
        rotationY: Math.round(b.rotation.y * 100) / 100
      }));
      console.log('ALL BUILDINGS:\n' + JSON.stringify(allData, null, 2));
    }
    updateInfoPanel();
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', (e) => {
    if (!debugMode) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, cameraRef);

    const allMeshes = [];
    buildingsRef.forEach(b => {
      if (b.isMesh) allMeshes.push(b);
      else if (b.isGroup || b.isObject3D) b.traverse(child => { if (child.isMesh) allMeshes.push(child); });
    });

    const intersects = raycaster.intersectObjects(allMeshes);
    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      // Walk up to find the building root (direct child of scene or the building group)
      const building = buildingsRef.find(b => {
        if (b === hitObj) return true;
        let found = false;
        if (b.traverse) b.traverse(c => { if (c === hitObj) found = true; });
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
  const name = selectedBuilding.userData?.namedId || selectedBuilding.name || 'Unknown';
  infoPanel.innerHTML = `<b>${name}</b><br>X: ${p.x.toFixed(1)}<br>Z: ${p.z.toFixed(1)}<br>Y: ${p.y.toFixed(1)}<br>Rot: ${(selectedBuilding.rotation.y * 180 / Math.PI).toFixed(0)}°<br><br><span style="color:#888">Arrows: move (Shift=fine)<br>R: rotate | C: copy JSON<br>D: dump all positions</span>`;
}

export function isDebugMode() { return debugMode; }
