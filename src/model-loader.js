import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const modelCache = new Map();

// Load a model, cache the original, return a cloned instance
export function loadModel(path) {
  if (modelCache.has(path)) {
    return Promise.resolve(modelCache.get(path).clone());
  }
  return new Promise((resolve, reject) => {
    loader.load(path, (gltf) => {
      const model = gltf.scene;
      modelCache.set(path, model);
      resolve(model.clone());
    }, undefined, reject);
  });
}

// Load a model, desaturate it, place it in the scene
export function placeModel(scene, path, position, scale = 1, rotationY = 0) {
  return loadModel(path).then(model => {
    model.position.set(position.x, position.y, position.z);
    model.scale.set(scale, scale, scale);
    model.rotation.y = rotationY;

    // Desaturate all materials for the gray world effect
    model.traverse(child => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const cloned = mats.map(m => {
          const mat = m.clone();
          if (mat.color) {
            const c = mat.color;
            const gray = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
            mat.color.setRGB(gray, gray, gray);
            child.userData.originalColor = c.clone();
          }
          return mat;
        });
        child.material = Array.isArray(child.material) ? cloned : cloned[0];
      }
    });

    scene.add(model);
    return model;
  });
}

// Store original pre-desaturation colors so color-system can restore them
export function storeOriginalColors(model) {
  model.traverse(child => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (mat.color && !child.userData.originalColor) {
          child.userData.originalColor = mat.color.clone();
        }
      });
    }
  });
}
