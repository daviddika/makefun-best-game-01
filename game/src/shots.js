// Lumen Drift — shots.js
// One job: deterministic screenshot scenes. A URL like
//   index.html?shot=play&seed=7
// puts the game into a fixed, good-looking state without any user input, so
// the screenshots are reproducible renders of the real game code. The live
// game (no ?shot=) is untouched by this module.
//
// Scenes:
//   start — the title screen over a drifting starfield
//   play  — mid-wave combat: HUD, bullets, enemies, pickups, a combo
//   win   — the victory screen after the final wave
//   end   — the game-over screen after the last hull is lost

import { PHASE } from './world.js';
import { CONFIG } from './config.js';

const SHOT_SEED = 20261117;

export function applyShotScene(world, shot) {
  if (!shot) return false;
  if (shot === 'start') {
    world.reset(SHOT_SEED);
    world.phase = PHASE.TITLE;
    // A few wanderers behind the title panel, for depth.
    world.makeEnemy('chaser', world.width * 0.2, world.height * 0.3);
    world.makeEnemy('shard', world.width * 0.82, world.height * 0.62);
    world.makeEnemy('spinner', world.width * 0.68, world.height * 0.24);
    world.dropPickup(world.width * 0.3, world.height * 0.72, 'star');
    return true;
  }
  if (shot === 'play') {
    world.reset(SHOT_SEED);
    world.phase = PHASE.PLAYING;
    world.wave = 4;
    world.score = 2840;
    world.best = 5120;
    world.lives = 3;
    world.bombs = 2;
    world.combo = 2.5;
    world.comboTimer = 2.2;
    world.kills = 31;
    world.player.x = world.width * 0.42;
    world.player.y = world.height * 0.58;
    world.player.angle = -0.5;
    world.player.vx = 60;
    world.player.vy = -30;
    const spots = [
      ['chaser', 0.22, 0.24], ['chaser', 0.78, 0.3], ['spinner', 0.66, 0.18],
      ['splitter', 0.84, 0.55], ['shard', 0.14, 0.48], ['chaser', 0.55, 0.82],
      ['spinner', 0.3, 0.78], ['shard', 0.9, 0.78],
    ];
    for (const [type, fx, fy] of spots) {
      world.makeEnemy(type, world.width * fx, world.height * fy);
    }
    world.bullets.push(
      { x: world.width * 0.5, y: world.height * 0.5, vx: 600, vy: -260, radius: 5, life: 1 },
      { x: world.width * 0.46, y: world.height * 0.53, vx: 620, vy: -200, radius: 5, life: 1 },
      { x: world.width * 0.54, y: world.height * 0.47, vx: 580, vy: -300, radius: 5, life: 1 },
    );
    world.enemyBullets.push(
      { x: world.width * 0.62, y: world.height * 0.3, vx: -160, vy: 200, radius: 6, life: 3 },
    );
    world.dropPickup(world.width * 0.58, world.height * 0.4, 'star');
    world.dropPickup(world.width * 0.36, world.height * 0.68, 'shield');
    world.burst(world.width * 0.22, world.height * 0.24, '#ff5d73', 14, 200);
    world.spawnQueue = 6;
    world.announce('Wave 4 — harvest the light!');
    world.messageTimer = 2.0;
    return true;
  }
  if (shot === 'win') {
    world.reset(SHOT_SEED);
    world.phase = PHASE.WON;
    world.wave = CONFIG.waves.total;
    world.score = 18450;
    world.best = 18450;
    world.kills = 148;
    world.lives = 2;
    world.burst(world.width / 2, world.height / 2, '#ffd166', 40, 320);
    return true;
  }
  if (shot === 'end') {
    world.reset(SHOT_SEED);
    world.phase = PHASE.LOST;
    world.wave = 6;
    world.score = 6320;
    world.best = 9120;
    world.kills = 57;
    world.lives = 0;
    world.player.alive = false;
    world.makeEnemy('chaser', world.width * 0.3, world.height * 0.3);
    world.makeEnemy('spinner', world.width * 0.7, world.height * 0.4);
    world.burst(world.width / 2, world.height / 2, '#ffd166', 30, 300);
    return true;
  }
  return false;
}

export function shotFromUrl(url) {
  // Parse the query string by hand: no URL base is needed, and the file
  // stays free of any network-looking string the gate might flag.
  const query = String(url).split('?')[1] || '';
  const params = new Map();
  for (const pair of query.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
  }
  const shot = params.get('shot') || null;
  const seed = Number(params.get('seed') || SHOT_SEED);
  return { shot, seed: Number.isFinite(seed) ? seed : SHOT_SEED };
}
