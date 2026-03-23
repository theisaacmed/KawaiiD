// GLTF model overrides for named buildings.
// Falls back to primitive meshes if any model file is missing.

import { placeModel, storeOriginalColors } from './model-loader.js';
import { getTerrainHeight } from './world.js';

// Map building IDs (userData.namedId) → Kenney model config
// Files go in public/models/ — see public/models/README.md
const BUILDING_MODELS = {
  'mei_apartment':      { model: 'models/building-small-a.glb', scale: 2,   rotY: 0 },
  'luna_townhouse':     { model: 'models/building-small-b.glb', scale: 2,   rotY: 0 },
  'kit_shop':           { model: 'models/shop-a.glb',           scale: 2,   rotY: 0 },
  'nao_cafe':           { model: 'models/shop-b.glb',           scale: 2,   rotY: 0 },
  'marco_restaurant':   { model: 'models/restaurant-a.glb',     scale: 2,   rotY: 0 },
  'harper_office':      { model: 'models/office-a.glb',         scale: 2,   rotY: 0 },
  'tomas_cottage':      { model: 'models/house-a.glb',          scale: 1.8, rotY: 0 },
  'yuna_shop':          { model: 'models/shop-c.glb',           scale: 2,   rotY: 0 },
  'kai_shack':          { model: 'models/cabin-a.glb',          scale: 1.5, rotY: 0 },
  'taro_factory':       { model: 'models/warehouse-a.glb',      scale: 3,   rotY: 0 },
  'workshop_property':  { model: 'models/warehouse-b.glb',      scale: 3,   rotY: 0 },
  'sora_building':      { model: 'models/building-tall-a.glb',  scale: 2.5, rotY: 0 },
  'kenji_office':       { model: 'models/office-b.glb',         scale: 2.5, rotY: 0 },
  'dante_tower':        { model: 'models/skyscraper-a.glb',     scale: 3,   rotY: 0 },
  'quinn_apt':          { model: 'models/building-tall-b.glb',  scale: 3,   rotY: 0 },
  'gus_office':         { model: 'models/warehouse-c.glb',      scale: 2,   rotY: 0 },
  'shipping_yard':      { model: 'models/warehouse-d.glb',      scale: 2.5, rotY: 0 },
  'the_school':         { model: 'models/office-c.glb',         scale: 2.5, rotY: 0 },
};

// namedId → loaded THREE.Group
const loadedModels = new Map();

/**
 * Called once after createBuildings().
 * buildings: array of THREE.Mesh from createBuildings (each may have userData.namedId).
 */
export async function loadBuildingModels(scene, buildings) {
  for (const mesh of buildings) {
    const namedId = mesh.userData.namedId;
    if (!namedId) continue;

    const config = BUILDING_MODELS[namedId];
    if (!config) continue;

    try {
      const y = getTerrainHeight(mesh.position.x, mesh.position.z);
      const model = await placeModel(
        scene,
        config.model,
        { x: mesh.position.x, y, z: mesh.position.z },
        config.scale,
        config.rotY
      );
      storeOriginalColors(model);
      model.userData.namedId = namedId;
      loadedModels.set(namedId, model);

      // Hide the primitive mesh — the GLTF model takes its place
      mesh.visible = false;
    } catch (e) {
      // Missing file or load error — keep the primitive as fallback
      console.warn(`[building-models] No model for ${namedId}: ${e.message}`);
    }
  }
}

export function getLoadedModel(namedId) {
  return loadedModels.get(namedId) || null;
}

export function getAllLoadedModels() {
  return Array.from(loadedModels.values());
}
