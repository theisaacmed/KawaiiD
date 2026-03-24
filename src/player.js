import * as THREE from 'three';
import { getBarrierBoxes } from './districts.js';
import { isNoclip, getSpeedMult } from './admin.js';
import { getAllBuildingBlocks } from './buildings.js';
import { getTerrainHeight } from './world.js';

const PLAYER_HEIGHT = 1.7;
const WALK_SPEED = 5;
const MOUSE_SENSITIVITY = 0.002;
const GRAVITY = 20;
const PLAYER_RADIUS = 0.4;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // State
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.position = new THREE.Vector3(8, PLAYER_HEIGHT, 11); // Spawn outside apartment door facing fountain
    this.yaw = 0;
    this.pitch = 0;
    this.isOnGround = true;
    this.locked = false;

    // Input
    this.keys = { forward: false, back: false, left: false, right: false };
    this._pointerLockFramesToSkip = 0;

    // Use YXZ rotation order to avoid gimbal issues with FPS camera
    this.camera.rotation.order = 'YXZ';

    // Place camera at spawn
    this.camera.position.copy(this.position);

    this._initPointerLock();
    this._initKeyboard();
  }

  _initPointerLock() {
    this.domElement.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        this.domElement.requestPointerLock().catch(() => {});
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.domElement;
      if (this.locked) {
        // Skip first few mousemove events after lock — browsers fire a spike
        this._pointerLockFramesToSkip = 3;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;

      // Skip initial spike events after pointer lock activates
      if (this._pointerLockFramesToSkip > 0) {
        this._pointerLockFramesToSkip--;
        return;
      }

      // Clamp per-event deltas to reject anomalous spikes
      const dx = Math.max(-100, Math.min(100, e.movementX));
      const dy = Math.max(-100, Math.min(100, e.movementY));

      this.yaw -= dx * MOUSE_SENSITIVITY;
      this.pitch -= dy * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

  _initKeyboard() {
    const onKey = (e, pressed) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = pressed; break;
        case 'KeyS': this.keys.back = pressed; break;
        case 'KeyA': this.keys.left = pressed; break;
        case 'KeyD': this.keys.right = pressed; break;
      }
    };
    document.addEventListener('keydown', (e) => onKey(e, true));
    document.addEventListener('keyup', (e) => onKey(e, false));
  }

  update(dt) {
    const nc = isNoclip();
    const spd = WALK_SPEED * getSpeedMult();

    // Apply gravity (skip in noclip)
    if (!nc && !this.isOnGround) {
      this.velocity.y -= GRAVITY * dt;
    }

    // Movement direction from keys
    this.direction.set(0, 0, 0);
    if (this.keys.forward) this.direction.z -= 1;
    if (this.keys.back) this.direction.z += 1;
    if (this.keys.left) this.direction.x -= 1;
    if (this.keys.right) this.direction.x += 1;
    this.direction.normalize();

    // Rotate movement direction by camera yaw
    const yaw = this.yaw;
    const moveX = this.direction.x * Math.cos(yaw) + this.direction.z * Math.sin(yaw);
    const moveZ = -this.direction.x * Math.sin(yaw) + this.direction.z * Math.cos(yaw);

    this.velocity.x = moveX * spd;
    this.velocity.z = moveZ * spd;

    // Noclip: fly in look direction, no collisions
    if (nc) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const move = new THREE.Vector3();
      if (this.keys.forward) move.add(forward);
      if (this.keys.back) move.sub(forward);
      if (this.keys.right) move.add(right);
      if (this.keys.left) move.sub(right);
      move.normalize().multiplyScalar(spd * dt);
      this.position.add(move);
      this.velocity.set(0, 0, 0);
      this.camera.position.copy(this.position);
      return;
    }

    // Apply velocity
    const newX = this.position.x + this.velocity.x * dt;
    const newZ = this.position.z + this.velocity.z * dt;

    // Check district barrier collisions
    const barriers = getBarrierBoxes();
    for (const barrier of barriers) {
      const bMinX = barrier.x - barrier.w / 2 - PLAYER_RADIUS;
      const bMaxX = barrier.x + barrier.w / 2 + PLAYER_RADIUS;
      const bMinZ = barrier.z - barrier.d / 2 - PLAYER_RADIUS;
      const bMaxZ = barrier.z + barrier.d / 2 + PLAYER_RADIUS;
      const insideX = newX >= bMinX && newX <= bMaxX;
      const insideZ = newZ >= bMinZ && newZ <= bMaxZ;
      if (insideX && insideZ) {
        const oldInsideX = this.position.x >= bMinX && this.position.x <= bMaxX;
        const oldInsideZ = this.position.z >= bMinZ && this.position.z <= bMaxZ;
        if (!oldInsideX) this.velocity.x = 0;
        if (!oldInsideZ) this.velocity.z = 0;
      }
    }

    // Check building collisions (sliding AABB — same as barrier logic)
    const bldgs = getAllBuildingBlocks();
    const candX = this.position.x + this.velocity.x * dt;
    const candZ = this.position.z + this.velocity.z * dt;
    for (const b of bldgs) {
      const minX = b.x - b.w / 2 - PLAYER_RADIUS;
      const maxX = b.x + b.w / 2 + PLAYER_RADIUS;
      const minZ = b.z - b.d / 2 - PLAYER_RADIUS;
      const maxZ = b.z + b.d / 2 + PLAYER_RADIUS;
      const inX = candX >= minX && candX <= maxX;
      const inZ = candZ >= minZ && candZ <= maxZ;
      if (inX && inZ) {
        const wasInX = this.position.x >= minX && this.position.x <= maxX;
        const wasInZ = this.position.z >= minZ && this.position.z <= maxZ;
        if (!wasInX) this.velocity.x = 0;
        if (!wasInZ) this.velocity.z = 0;
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground collision — follow terrain height
    const groundY = getTerrainHeight(this.position.x, this.position.z) + PLAYER_HEIGHT;
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.isOnGround = true;
    } else {
      this.isOnGround = false;
    }

    // Update camera position and rotation every frame
    this.camera.position.copy(this.position);
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
  }
}
