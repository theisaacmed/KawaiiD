import * as THREE from 'three';

const WS_URL = 'ws://localhost:3001';

let ws = null;
let isHost = false;
let roomCode = null;
let connected = false;
let remotePlayer = null; // THREE.Group
let remotePosition = new THREE.Vector3();
let remoteRotation = 0;
let lastSendTime = 0;

// Callbacks
let onRoomCreated = null;
let onJoined = null;
let onGuestJoined = null;
let onPeerDisconnected = null;
let onDealComplete = null;

export function initMultiplayer(scene, callbacks = {}) {
  onRoomCreated = callbacks.onRoomCreated || null;
  onJoined = callbacks.onJoined || null;
  onGuestJoined = callbacks.onGuestJoined || null;
  onPeerDisconnected = callbacks.onPeerDisconnected || null;
  onDealComplete = callbacks.onDealComplete || null;

  // Create remote player mesh (bright green capsule + sphere head)
  remotePlayer = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x44ff44 })
  );
  body.position.y = 0;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x44ff44 })
  );
  head.position.y = 0.85;

  // Small nametag above head
  remotePlayer.add(body, head);
  remotePlayer.visible = false;
  scene.add(remotePlayer);
}

function openSocket(onOpen) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  ws = new WebSocket(WS_URL);
  ws.onopen = onOpen;
  ws.onmessage = handleMessage;
  ws.onerror = (e) => console.warn('[MP] WebSocket error:', e);
  ws.onclose = () => {
    if (connected) {
      connected = false;
      if (remotePlayer) remotePlayer.visible = false;
      if (onPeerDisconnected) onPeerDisconnected();
    }
  };
}

export function createRoom() {
  openSocket(() => {
    ws.send(JSON.stringify({ type: 'create_room' }));
  });
}

export function joinRoom(code) {
  openSocket(() => {
    ws.send(JSON.stringify({ type: 'join_room', code: code.toUpperCase() }));
  });
}

function handleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    return;
  }

  switch (msg.type) {
    case 'room_created':
      roomCode = msg.code;
      isHost = true;
      // Don't set connected yet — wait for guest
      if (onRoomCreated) onRoomCreated(msg.code);
      break;

    case 'joined':
      roomCode = msg.code;
      isHost = false;
      connected = true;
      if (onJoined) onJoined(msg.code);
      break;

    case 'guest_joined':
      connected = true;
      if (onGuestJoined) onGuestJoined();
      break;

    case 'player_move':
      if (remotePlayer) {
        remotePosition.set(msg.x, msg.y, msg.z);
        remoteRotation = msg.ry;
        remotePlayer.visible = true;
      }
      break;

    case 'deal_complete':
      if (onDealComplete) onDealComplete(msg);
      break;

    case 'peer_disconnected':
      connected = false;
      roomCode = null;
      if (remotePlayer) remotePlayer.visible = false;
      if (onPeerDisconnected) onPeerDisconnected();
      break;

    case 'error':
      console.warn('[MP] Server error:', msg.msg);
      if (onPeerDisconnected) onPeerDisconnected(msg.msg);
      break;
  }
}

export function updateMultiplayer(playerPosition, playerRotationY) {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) return;

  // Throttle position sends to ~10 fps
  const now = performance.now();
  if (now - lastSendTime > 100) {
    ws.send(JSON.stringify({
      type: 'player_move',
      x: playerPosition.x,
      y: playerPosition.y,
      z: playerPosition.z,
      ry: playerRotationY,
    }));
    lastSendTime = now;
  }

  // Smooth interpolation of remote player
  if (remotePlayer && remotePlayer.visible) {
    remotePlayer.position.lerp(remotePosition, 0.15);
    remotePlayer.rotation.y = remoteRotation;
  }
}

export function sendDealComplete(data) {
  if (connected && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'deal_complete', ...data }));
  }
}

export function isMultiplayerActive() {
  return connected;
}

export function getRoomCode() {
  return roomCode;
}

export function disconnectMultiplayer() {
  connected = false;
  roomCode = null;
  if (remotePlayer) remotePlayer.visible = false;
  if (ws) {
    ws.close();
    ws = null;
  }
}
