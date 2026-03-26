// GLTF model overrides for named buildings.
// Falls back to primitive meshes if any model file is missing.

import { placeModel, storeOriginalColors } from './model-loader.js';
import { getTerrainHeight } from './world.js';

// Map building IDs (userData.namedId) → Kenney model config
// Files go in public/models/
const BUILDING_MODELS = {
  'mei_apartment':      { model: 'models/building-type-a.glb',      scale: 2.5, rotY: 0 },
  'luna_townhouse':     { model: 'models/building-type-b.glb',      scale: 2.5, rotY: 0 },
  'kit_shop':           { model: 'models/building-a.glb',           scale: 2.5, rotY: 0 },
  'player_apartment':   { model: 'models/building-type-c.glb',      scale: 2.5, rotY: 0 },
  'nao_cafe':           { model: 'models/building-b.glb',           scale: 2.5, rotY: 0 },
  'marco_restaurant':   { model: 'models/building-c.glb',           scale: 2.5, rotY: 0 },
  'clock_tower':        { model: 'models/building-skyscraper-a.glb', scale: 2,  rotY: 0 },
  'harper_office':      { model: 'models/building-d.glb',           scale: 2.5, rotY: 0 },
  'playground':         { model: 'models/tree-large.glb',           scale: 3,   rotY: 0 },
  'tomas_cottage':      { model: 'models/building-type-d.glb',      scale: 2.5, rotY: 0 },
  'the_school':         { model: 'models/building-e.glb',           scale: 3,   rotY: 0 },
  'taro_factory':       { model: 'models/building-f.glb',           scale: 3,   rotY: 0 },
  'workshop_property':  { model: 'models/building-g.glb',           scale: 3,   rotY: 0 },
  'vex_squat':          { model: 'models/building-type-e.glb',      scale: 2,   rotY: 0 },
  'yuna_flower_shop':   { model: 'models/building-h.glb',           scale: 2.5, rotY: 0 },
  'chapel':             { model: 'models/building-type-f.glb',      scale: 3,   rotY: 0 },
  'kai_shack':          { model: 'models/building-type-g.glb',      scale: 2,   rotY: 0 },
  'sora_building':      { model: 'models/building-skyscraper-b.glb', scale: 2.5, rotY: 0 },
  'kenji_office':       { model: 'models/building-skyscraper-c.glb', scale: 2.5, rotY: 0 },
  'the_hotel':          { model: 'models/building-skyscraper-d.glb', scale: 3,  rotY: 0 },
  'dante_tower':        { model: 'models/building-skyscraper-e.glb', scale: 3,  rotY: 0 },
  'quinn_apartment':    { model: 'models/building-i.glb',           scale: 2.5, rotY: 0 },
  'gus_dock_office':    { model: 'models/building-j.glb',           scale: 2,   rotY: 0 },
  'marina_lighthouse':  { model: 'models/building-type-h.glb',      scale: 3,   rotY: 0 },
  'shipping_yard':      { model: 'models/building-k.glb',           scale: 3,   rotY: 0 },
  'fountain_square':    { model: 'models/planter.glb',              scale: 3,   rotY: 0 },
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
