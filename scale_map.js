// scale_map.js — complete map scale 0.6 for remaining src files
// Run: node scale_map.js
'use strict';
const fs = require('fs');
const path = require('path');

function r(n) { return Math.round(parseFloat(n) * 0.6 * 10) / 10; }

// Scale x and z in: new THREE.Vector3(x, y, z)
// y may be numeric or an identifier like PLAYER_HEIGHT
function transformV3(c) {
  return c.replace(
    /new THREE\.Vector3\((-?\d+(?:\.\d+)?),\s*([^,)]+?),\s*(-?\d+(?:\.\d+)?)\)/g,
    (_, x, y, z) => `new THREE.Vector3(${r(x)}, ${y.trim()}, ${r(z)})`
  );
}

// Scale x and z in plain coord objects: { x: N, z: M } or { x: N, z: M, w:…, d:…, h:… }
// Only replaces x: and z: values, leaves w/d/h alone
function transformXZInObj(c) {
  // Matches { x: NUM, z: NUM } — ruins pile positions
  c = c.replace(
    /\{\s*(x:\s*)(-?\d+(?:\.\d+)?)(,\s*z:\s*)(-?\d+(?:\.\d+)?)\s*\}/g,
    (_, xk, xv, zk, zv) => `{ ${xk}${r(xv)}${zk}${r(zv)} }`
  );
  // Matches { x: NUM, z: NUM, w: ..., d: ..., h: ... } — ace.js building boxes
  c = c.replace(
    /\{\s*(x:\s*)(-?\d+(?:\.\d+)?)(,\s*z:\s*)(-?\d+(?:\.\d+)?)(,\s*w:[\s\S]*?)\}/g,
    (_, xk, xv, zk, zv, rest) => `{ ${xk}${r(xv)}${zk}${r(zv)}${rest}}`
  );
  return c;
}

const src = path.join(__dirname, 'src');
const edit = (name, fn) => {
  const file = path.join(src, name);
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
  console.log('✓', name);
};

// 1. player.js
edit('player.js', c => transformV3(c));

// 2. tutorial.js
edit('tutorial.js', c => transformV3(c));

// 3. ruins.js
edit('ruins.js', c => transformXZInObj(transformV3(c)));

// 4. ace.js
edit('ace.js', c => transformXZInObj(transformV3(c)));

// 5. npc.js
edit('npc.js', c => transformV3(c));

// 6. npc-routines.js — no hardcoded positions found; skip
// (no-op, file untouched)

// 7. interaction.js
edit('interaction.js', c => transformV3(c));

// 8. smuggling.js
edit('smuggling.js', c => transformV3(c));

// 9. world.js — scale PlaneGeometry sizes
edit('world.js', c => {
  // Named sizes first to avoid double-scaling
  c = c.replace('PlaneGeometry(600, 600)', 'PlaneGeometry(360, 360)');
  c = c.replace('PlaneGeometry(300, 120)', 'PlaneGeometry(180, 72)');
  c = c.replace('PlaneGeometry(120, 100)', 'PlaneGeometry(72, 60)');
  // Any remaining PlaneGeometry(W, H) with numbers
  c = c.replace(
    /new THREE\.PlaneGeometry\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\)/g,
    (_, w, h) => `new THREE.PlaneGeometry(${r(w)}, ${r(h)})`
  );
  return c;
});

// 10. audio.js — reduce night sounds volume by 10x
edit('audio.js', c => {
  // Cricket chirp peak gain 0.015 → 0.0015
  c = c.replace('setValueAtTime(0.015,', 'setValueAtTime(0.0015,');
  // Wind ramp target 0.04 → 0.004
  c = c.replace('linearRampToValueAtTime(0.04,', 'linearRampToValueAtTime(0.004,');
  return c;
});

console.log('\nAll done.');
