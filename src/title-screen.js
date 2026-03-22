// Title screen — full-screen overlay with 3D background camera pan
//
// Shows "KAWAII DEALER" title, subtitle, and New/Continue/Controls buttons
// Background: renders the 3D scene with a slowly panning camera

import * as THREE from 'three';
import { playUIClick } from './audio.js';
import { showMultiplayerLobby } from './multiplayer-ui.js';

export function showTitleScreen(hasSaveFn, clearSaveFn, renderer, scene) {
  return new Promise((resolve) => {
    // --- 3D Background Camera Pan ---
    let bgCamera = null;
    let bgAnimId = null;
    let bgTime = 0;

    if (renderer && scene) {
      bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
      bgCamera.position.set(-15, 8, -10);

      const renderBg = () => {
        bgAnimId = requestAnimationFrame(renderBg);
        bgTime += 0.003;
        // Slow circular pan
        bgCamera.position.x = Math.cos(bgTime) * 25;
        bgCamera.position.z = Math.sin(bgTime) * 25;
        bgCamera.position.y = 6 + Math.sin(bgTime * 0.5) * 2;
        bgCamera.lookAt(0, 2, 0);
        renderer.render(scene, bgCamera);
      };
      renderBg();
    }

    function cleanup() {
      if (bgAnimId) cancelAnimationFrame(bgAnimId);
      bgCamera = null;
    }

    // --- Overlay ---
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: renderer ? 'rgba(5,5,15,0.75)' : '#0a0a14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: '9999',
      fontFamily: 'monospace',
      opacity: '1',
      transition: 'opacity 0.8s ease',
    });

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '56px', fontWeight: 'bold',
      color: '#fff', letterSpacing: '6px',
      marginBottom: '12px',
      textShadow: '0 0 40px rgba(100,180,255,0.3), 0 0 80px rgba(255,107,157,0.15)',
      textTransform: 'uppercase',
    });
    title.textContent = 'Kawaii Dealer';
    overlay.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, {
      fontSize: '14px', color: '#778',
      marginBottom: '50px',
      letterSpacing: '1px',
      maxWidth: '400px',
      textAlign: 'center',
      lineHeight: '1.6',
    });
    subtitle.textContent = 'In a world where cuteness is banned, you are the resistance.';
    overlay.appendChild(subtitle);

    // Button container
    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
      display: 'flex', flexDirection: 'column',
      gap: '12px', alignItems: 'center',
    });

    function makeBtn(text, primary) {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        padding: '14px 48px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        letterSpacing: '2px',
        border: primary ? '1px solid rgba(255,107,157,0.5)' : '1px solid rgba(255,255,255,0.15)',
        background: primary ? 'rgba(255,107,157,0.12)' : 'rgba(255,255,255,0.06)',
        color: primary ? '#ff6b9d' : '#888',
        transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
        minWidth: '220px',
        textTransform: 'uppercase',
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = primary ? 'rgba(255,107,157,0.22)' : 'rgba(255,255,255,0.12)';
        btn.style.transform = 'scale(1.03)';
        playUIClick();
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = primary ? 'rgba(255,107,157,0.12)' : 'rgba(255,255,255,0.06)';
        btn.style.transform = 'scale(1)';
      });
      btn.textContent = text;
      return btn;
    }

    const saveExists = hasSaveFn();

    // Fade out helper
    function fadeAndResolve(choice) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        cleanup();
        overlay.remove();
        if (controlsOverlay) controlsOverlay.remove();
        resolve(choice);
      }, 800);
    }

    if (saveExists) {
      const continueBtn = makeBtn('Continue', true);
      continueBtn.addEventListener('click', () => fadeAndResolve('continue'));
      btnContainer.appendChild(continueBtn);
    }

    const newBtn = makeBtn('New Game', !saveExists);
    newBtn.addEventListener('click', () => {
      if (saveExists) clearSaveFn();
      fadeAndResolve('new');
    });
    btnContainer.appendChild(newBtn);

    const controlsBtn = makeBtn('Controls', false);
    controlsBtn.addEventListener('click', () => showControls());
    btnContainer.appendChild(controlsBtn);

    const multiBtn = makeBtn('Multiplayer', false);
    multiBtn.addEventListener('click', () => showMultiplayerLobby(() => {}));
    btnContainer.appendChild(multiBtn);

    overlay.appendChild(btnContainer);

    // Version / credits
    const credit = document.createElement('div');
    Object.assign(credit.style, {
      position: 'absolute', bottom: '20px',
      fontSize: '10px', color: '#333',
      letterSpacing: '1px',
    });
    credit.textContent = 'v1.0';
    overlay.appendChild(credit);

    document.body.appendChild(overlay);

    // --- Controls Screen ---
    let controlsOverlay = null;

    function showControls() {
      controlsOverlay = document.createElement('div');
      Object.assign(controlsOverlay.style, {
        position: 'fixed', inset: '0',
        background: 'rgba(5,5,15,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: '10000',
        fontFamily: 'monospace',
        color: '#fff',
      });

      const controlsTitle = document.createElement('div');
      Object.assign(controlsTitle.style, {
        fontSize: '28px', fontWeight: 'bold',
        marginBottom: '30px', letterSpacing: '3px',
        color: '#6cf',
      });
      controlsTitle.textContent = 'CONTROLS';
      controlsOverlay.appendChild(controlsTitle);

      const controls = [
        ['WASD', 'Move'],
        ['Mouse', 'Look around'],
        ['E', 'Interact / Search / Talk'],
        ['Tab', 'Open phone'],
        ['Escape', 'Pause menu'],
        ['F5', 'Quick save'],
        ['Click', 'Lock cursor'],
        ['Drag items', 'Deal with NPCs / Load gacha'],
      ];

      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: '8px 24px',
        maxWidth: '400px',
      });

      for (const [key, desc] of controls) {
        const keyEl = document.createElement('div');
        Object.assign(keyEl.style, {
          textAlign: 'right', color: '#ff6b9d',
          fontSize: '14px', fontWeight: 'bold',
          padding: '4px 0',
        });
        keyEl.textContent = key;
        grid.appendChild(keyEl);

        const descEl = document.createElement('div');
        Object.assign(descEl.style, {
          color: '#aaa', fontSize: '14px',
          padding: '4px 0',
        });
        descEl.textContent = desc;
        grid.appendChild(descEl);
      }

      controlsOverlay.appendChild(grid);

      const backBtn = makeBtn('Back', false);
      backBtn.style.marginTop = '40px';
      backBtn.addEventListener('click', () => {
        controlsOverlay.remove();
        controlsOverlay = null;
      });
      controlsOverlay.appendChild(backBtn);

      document.body.appendChild(controlsOverlay);
    }
  });
}
