// Multiplayer UI — lobby screen and in-game status indicator
//
// Lobby: Create Room / Join Room
// HUD: small green "Connected" badge with room code and disconnect button

import { createRoom, joinRoom, getRoomCode, isMultiplayerActive, disconnectMultiplayer } from './multiplayer.js';

let hudBadge = null;
let statusText = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOverlay() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(5,5,15,0.92)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: '10000',
    fontFamily: 'monospace',
  });
  return el;
}

function makeBtn(text, primary) {
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '12px 40px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    letterSpacing: '2px',
    border: primary ? '1px solid rgba(68,255,68,0.5)' : '1px solid rgba(255,255,255,0.15)',
    background: primary ? 'rgba(68,255,68,0.12)' : 'rgba(255,255,255,0.06)',
    color: primary ? '#44ff44' : '#888',
    transition: 'background 0.2s, transform 0.15s',
    minWidth: '220px',
    textTransform: 'uppercase',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = primary ? 'rgba(68,255,68,0.22)' : 'rgba(255,255,255,0.12)';
    btn.style.transform = 'scale(1.03)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = primary ? 'rgba(68,255,68,0.12)' : 'rgba(255,255,255,0.06)';
    btn.style.transform = 'scale(1)';
  });
  btn.textContent = text;
  return btn;
}

function makeHeader(text) {
  const h = document.createElement('div');
  Object.assign(h.style, {
    fontSize: '28px', fontWeight: 'bold',
    color: '#44ff44', letterSpacing: '4px',
    marginBottom: '32px',
    textShadow: '0 0 20px rgba(68,255,68,0.3)',
  });
  h.textContent = text;
  return h;
}

// ─── Lobby Screen ────────────────────────────────────────────────────────────

export function showMultiplayerLobby(onClose) {
  const overlay = makeOverlay();

  overlay.appendChild(makeHeader('MULTIPLAYER'));

  // Sub-label
  const sub = document.createElement('div');
  Object.assign(sub.style, { color: '#556', fontSize: '13px', marginBottom: '40px', letterSpacing: '1px' });
  sub.textContent = '2-player co-op — playtest mode';
  overlay.appendChild(sub);

  // Buttons
  const btnGroup = document.createElement('div');
  Object.assign(btnGroup.style, { display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' });

  const createBtn = makeBtn('Create Room', true);
  const joinBtn = makeBtn('Join Room', false);
  const backBtn = makeBtn('Back', false);

  btnGroup.appendChild(createBtn);
  btnGroup.appendChild(joinBtn);
  btnGroup.appendChild(backBtn);
  overlay.appendChild(btnGroup);

  // Status area (shows code or waiting message)
  const statusArea = document.createElement('div');
  Object.assign(statusArea.style, {
    marginTop: '36px',
    textAlign: 'center',
    minHeight: '80px',
  });
  overlay.appendChild(statusArea);

  document.body.appendChild(overlay);

  // ── Create Room flow ──
  createBtn.addEventListener('click', () => {
    statusArea.innerHTML = '';
    const waiting = document.createElement('div');
    Object.assign(waiting.style, { color: '#aaa', fontSize: '13px', marginBottom: '12px' });
    waiting.textContent = 'Connecting to server...';
    statusArea.appendChild(waiting);

    createRoom();

    // Listen for room_created via the callback set in initMultiplayerUI
    const checkInterval = setInterval(() => {
      const code = getRoomCode();
      if (code) {
        clearInterval(checkInterval);
        statusArea.innerHTML = '';

        const label = document.createElement('div');
        Object.assign(label.style, { color: '#666', fontSize: '13px', marginBottom: '8px', letterSpacing: '1px' });
        label.textContent = 'SHARE THIS CODE:';
        statusArea.appendChild(label);

        const codeEl = document.createElement('div');
        Object.assign(codeEl.style, {
          fontSize: '52px', fontWeight: 'bold',
          color: '#44ff44', letterSpacing: '12px',
          textShadow: '0 0 30px rgba(68,255,68,0.5)',
          marginBottom: '12px',
        });
        codeEl.textContent = code;
        statusArea.appendChild(codeEl);

        const waitMsg = document.createElement('div');
        Object.assign(waitMsg.style, { color: '#555', fontSize: '12px', letterSpacing: '1px' });
        waitMsg.textContent = 'Waiting for guest to join...';
        statusArea.appendChild(waitMsg);

        // Watch for guest joining
        const guestCheck = setInterval(() => {
          if (isMultiplayerActive()) {
            clearInterval(guestCheck);
            waitMsg.style.color = '#44ff44';
            waitMsg.textContent = 'Guest connected!';
            setTimeout(() => {
              overlay.remove();
              showHUDBadge();
              if (onClose) onClose();
            }, 1000);
          }
        }, 200);
      }
    }, 200);
  });

  // ── Join Room flow ──
  joinBtn.addEventListener('click', () => {
    statusArea.innerHTML = '';

    const label = document.createElement('div');
    Object.assign(label.style, { color: '#888', fontSize: '13px', marginBottom: '10px' });
    label.textContent = 'Enter 4-character room code:';
    statusArea.appendChild(label);

    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' });

    const input = document.createElement('input');
    Object.assign(input.style, {
      padding: '10px 16px',
      borderRadius: '6px',
      fontFamily: 'monospace',
      fontSize: '22px',
      fontWeight: 'bold',
      letterSpacing: '6px',
      border: '1px solid rgba(68,255,68,0.3)',
      background: 'rgba(68,255,68,0.06)',
      color: '#44ff44',
      textTransform: 'uppercase',
      width: '120px',
      textAlign: 'center',
    });
    input.maxLength = 4;
    input.placeholder = 'XXXX';

    const connectBtn = makeBtn('Connect', true);
    connectBtn.style.padding = '10px 24px';
    connectBtn.style.minWidth = 'auto';

    inputRow.appendChild(input);
    inputRow.appendChild(connectBtn);
    statusArea.appendChild(inputRow);

    const errMsg = document.createElement('div');
    Object.assign(errMsg.style, { color: '#f66', fontSize: '12px', marginTop: '10px' });
    statusArea.appendChild(errMsg);

    connectBtn.addEventListener('click', () => {
      const code = input.value.trim().toUpperCase();
      if (code.length !== 4) {
        errMsg.textContent = 'Code must be 4 characters.';
        return;
      }
      errMsg.textContent = '';
      connectBtn.textContent = 'Connecting...';
      connectBtn.disabled = true;

      joinRoom(code);

      // Poll for connection
      const joinCheck = setInterval(() => {
        if (isMultiplayerActive()) {
          clearInterval(joinCheck);
          overlay.remove();
          showHUDBadge();
          if (onClose) onClose();
        }
      }, 200);

      // Timeout after 6 seconds
      setTimeout(() => {
        clearInterval(joinCheck);
        if (!isMultiplayerActive()) {
          errMsg.textContent = 'Could not connect. Check code and try again.';
          connectBtn.textContent = 'Connect';
          connectBtn.disabled = false;
        }
      }, 6000);
    });

    input.focus();
  });

  backBtn.addEventListener('click', () => {
    overlay.remove();
    disconnectMultiplayer();
    if (onClose) onClose();
  });
}

// ─── HUD Badge ───────────────────────────────────────────────────────────────

export function showHUDBadge() {
  if (hudBadge) return;

  hudBadge = document.createElement('div');
  Object.assign(hudBadge.style, {
    position: 'fixed',
    top: '12px', right: '12px',
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(5,5,15,0.75)',
    border: '1px solid rgba(68,255,68,0.3)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: '500',
    backdropFilter: 'blur(4px)',
  });

  // Green dot
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: '#44ff44',
    boxShadow: '0 0 6px rgba(68,255,68,0.8)',
    flexShrink: '0',
  });

  statusText = document.createElement('div');
  Object.assign(statusText.style, { color: '#44ff44' });
  const code = getRoomCode();
  statusText.textContent = `CO-OP  ${code || ''}`;

  const sep = document.createElement('div');
  Object.assign(sep.style, { color: '#333', margin: '0 4px' });
  sep.textContent = '|';

  const discBtn = document.createElement('button');
  Object.assign(discBtn.style, {
    background: 'none', border: 'none',
    color: '#555', fontSize: '11px',
    fontFamily: 'monospace', cursor: 'pointer',
    padding: '0',
    letterSpacing: '1px',
  });
  discBtn.textContent = 'LEAVE';
  discBtn.addEventListener('mouseenter', () => { discBtn.style.color = '#f66'; });
  discBtn.addEventListener('mouseleave', () => { discBtn.style.color = '#555'; });
  discBtn.addEventListener('click', () => {
    disconnectMultiplayer();
    removeHUDBadge();
  });

  hudBadge.appendChild(dot);
  hudBadge.appendChild(statusText);
  hudBadge.appendChild(sep);
  hudBadge.appendChild(discBtn);
  document.body.appendChild(hudBadge);
}

export function removeHUDBadge() {
  if (hudBadge) {
    hudBadge.remove();
    hudBadge = null;
    statusText = null;
  }
}

