// Lumen Drift — world.js
// One job: the game's state and its rules. Spawning, movement, collisions,
// waves, the boss, pickups, combos and win/lose live here; drawing lives in
// render.js and sound lives in audio.js. The world knows nothing about the DOM.

import { CONFIG } from './config.js';
import { clamp, distance, makeRng, pick, range } from './random.js';

export const PHASE = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WAVE_CLEAR: 'waveclear',
  WON: 'won',
  LOST: 'lost',
};

const ENEMY_TYPES = ['chaser', 'spinner', 'splitter', 'shard'];

export class World {
  constructor(width, height, sound) {
    this.width = width;
    this.height = height;
    this.sound = sound;
    this.rng = makeRng((Date.now() % 2147483647) || 1);
    this.reset();
  }

  reset(seed = null) {
    if (seed !== null && seed !== undefined) this.rng = makeRng(seed);
    this.phase = PHASE.TITLE;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('lumen-drift-best') || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.wave = 0;
    this.lives = CONFIG.player.maxLives;
    this.bombs = CONFIG.player.bombStart;
    this.combo = 1;
    this.comboTimer = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.time = 0;
    this.waveTimer = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.boss = null;
    this.player = this.freshPlayer();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.stars = this.makeStarfield();
    this.message = '';
    this.messageTimer = 0;
    this.shieldTimer = 0;
    this.fireTimer = 0;
    this.shake = 0;
    this.flash = 0;
  }

  freshPlayer() {
    return {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: CONFIG.player.radius,
      invulnerable: 0,
      alive: true,
    };
  }

  makeStarfield() {
    const stars = [];
    for (let i = 0; i < 130; i += 1) {
      stars.push({
        x: this.rng() * this.width,
        y: this.rng() * this.height,
        size: range(this.rng, 0.6, 2.4),
        twinkle: range(this.rng, 0, Math.PI * 2),
        speed: range(this.rng, 0.2, 0.9),
      });
    }
    return stars;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.player.x = clamp(this.player.x, 30, width - 30);
    this.player.y = clamp(this.player.y, 30, height - 30);
    this.stars = this.makeStarfield();
  }

  startGame() {
    this.reset();
    this.phase = PHASE.PLAYING;
    this.beginWave(1);
    this.announce('Wave 1 — harvest the light!');
  }

  announce(text) {
    this.message = text;
    this.messageTimer = 2.6;
  }

  beginWave(wave) {
    this.wave = wave;
    this.spawnQueue = CONFIG.waves.countForWave(wave);
    this.spawnTimer = 0.4;
    this.boss = null;
    if (wave === CONFIG.waves.total) {
      this.spawnQueen();
    }
    this.announce(wave === CONFIG.waves.total
      ? 'FINAL WAVE — the Void Queen wakes!'
      : `Wave ${wave} of ${CONFIG.waves.total}`);
  }

  spawnQueen() {
    const queen = this.makeEnemy('queen', this.width / 2, -80);
    queen.y = 110;
    this.boss = queen;
  }

  makeEnemy(type, x, y) {
    const spec = CONFIG.enemies[type];
    const enemy = {
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hp: spec.hp,
      maxHp: spec.hp,
      speed: spec.speed * range(this.rng, 0.9, 1.15),
      score: spec.score,
      color: spec.color,
      angle: this.rng() * Math.PI * 2,
      orbitAngle: this.rng() * Math.PI * 2,
      fireTimer: range(this.rng, 1, 2.5),
      hitFlash: 0,
      seed: this.rng(),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnFromQueue() {
    const wave = this.wave;
    const type = wave >= 8
      ? pick(this.rng, ['chaser', 'spinner', 'splitter', 'shard', 'shard'])
      : wave >= 4
        ? pick(this.rng, ENEMY_TYPES)
        : pick(this.rng, ['chaser', 'chaser', 'shard', 'spinner']);
    const edge = Math.floor(this.rng() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = range(this.rng, 40, this.width - 40); y = -30; }
    else if (edge === 1) { x = range(this.rng, 40, this.width - 40); y = this.height + 30; }
    else if (edge === 2) { x = -30; y = range(this.rng, 40, this.height - 40); }
    else { x = this.width + 30; y = range(this.rng, 40, this.height - 40); }
    this.makeEnemy(type, x, y);
  }

  dropPickup(x, y, forcedKind = null) {
    const roll = this.rng();
    let kind = forcedKind;
    if (!kind) {
      if (roll < CONFIG.pickups.heartChance) kind = 'heart';
      else if (roll < CONFIG.pickups.heartChance + CONFIG.pickups.bombChance) kind = 'bomb';
      else if (roll < 0.32) kind = 'shield';
      else kind = 'star';
    }
    this.pickups.push({
      kind, x, y,
      vx: range(this.rng, -30, 30),
      vy: range(this.rng, 20, 70),
      radius: kind === 'star' ? 8 : 13,
      bob: this.rng() * Math.PI * 2,
      life: 9,
    });
  }

  burst(x, y, color, count, speed = 220) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng() * Math.PI * 2;
      const magnitude = range(this.rng, speed * 0.2, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude,
        life: range(this.rng, 0.3, 0.8),
        maxLife: 0.8,
        size: range(this.rng, 1.5, 4),
        color,
      });
    }
  }

  fireBullet() {
    const p = this.player;
    const angle = p.angle;
    this.bullets.push({
      x: p.x + Math.cos(angle) * (p.radius + 8),
      y: p.y + Math.sin(angle) * (p.radius + 8),
      vx: Math.cos(angle) * CONFIG.player.bulletSpeed + p.vx * 0.4,
      vy: Math.sin(angle) * CONFIG.player.bulletSpeed + p.vy * 0.4,
      radius: 5,
      life: 1.2,
    });
    this.shotsFired += 1;
    this.sound.shoot();
  }

  useBomb() {
    if (this.phase !== PHASE.PLAYING || this.bombs <= 0) return;
    this.bombs -= 1;
    this.flash = 0.5;
    this.shake = 14;
    this.sound.bomb();
    this.burst(this.player.x, this.player.y, '#b8f2ff', 60, 520);
    // A nova clears every small enemy and wounds the boss.
    for (const enemy of [...this.enemies]) {
      if (enemy.type === 'queen') {
        this.damageEnemy(enemy, 12);
      } else {
        this.killEnemy(enemy, false);
      }
    }
    this.enemyBullets.length = 0;
    this.announce('NOVA! The field burns clean.');
  }

  damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    enemy.hitFlash = 0.12;
    if (enemy.hp <= 0) this.killEnemy(enemy, true);
    else this.sound.enemyHit();
  }

  killEnemy(enemy, scored) {
    const index = this.enemies.indexOf(enemy);
    if (index === -1) return;
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.burst(enemy.x, enemy.y, enemy.color, enemy.type === 'queen' ? 90 : 22, 300);
    this.sound.explosion();
    this.shake = Math.max(this.shake, enemy.type === 'queen' ? 16 : 5);
    if (scored) {
      this.comboTimer = CONFIG.scoring.comboWindowSeconds;
      const gained = Math.round(enemy.score * this.combo);
      this.score += gained;
      this.combo = Math.min(CONFIG.scoring.comboMax, this.combo + CONFIG.scoring.comboStep);
    }
    // Splitters break apart; the Queen and the rest drop loot.
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const spark = this.makeEnemy('spark', enemy.x + range(this.rng, -14, 14), enemy.y + range(this.rng, -14, 14));
        spark.vx = range(this.rng, -140, 140);
        spark.vy = range(this.rng, -140, 140);
      }
    } else if (enemy.type === 'queen') {
      this.boss = null;
      for (let i = 0; i < 5; i += 1) this.dropPickup(enemy.x + range(this.rng, -60, 60), enemy.y + range(this.rng, -40, 40), 'star');
    } else {
      this.dropPickup(enemy.x, enemy.y);
    }
    if (enemy.type === 'queen' && this.phase === PHASE.PLAYING) {
      this.winGame();
    }
  }

  hurtPlayer() {
    const p = this.player;
    if (p.invulnerable > 0 || this.shieldTimer > 0 || this.phase !== PHASE.PLAYING) return;
    this.lives -= 1;
    p.invulnerable = CONFIG.player.invulnerableSeconds;
    this.shake = 12;
    this.flash = 0.35;
    this.combo = 1;
    this.comboTimer = 0;
    this.burst(p.x, p.y, '#ffd166', 30, 320);
    this.sound.hurt();
    if (this.lives <= 0) {
      this.loseGame();
    } else {
      this.announce(this.lives === 1 ? 'Last hull! Fly careful.' : `${this.lives} hulls left.`);
    }
  }

  winGame() {
    if (this.phase === PHASE.WON || this.phase === PHASE.LOST) return;
    this.phase = PHASE.WON;
    this.score += CONFIG.scoring.waveClearBonus * 4;
    this.saveBest();
    this.sound.win();
    this.burst(this.player.x, this.player.y, '#ffd166', 80, 420);
  }

  loseGame() {
    if (this.phase === PHASE.WON || this.phase === PHASE.LOST) return;
    this.phase = PHASE.LOST;
    this.player.alive = false;
    this.burst(this.player.x, this.player.y, '#ffd166', 70, 380);
    this.saveBest();
    this.sound.lose();
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('lumen-drift-best', String(this.best));
      } catch {
        // Private browsing: the best score simply does not persist.
      }
    }
  }

  update(dt, input) {
    this.time += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    for (const star of this.stars) {
      star.twinkle += dt * star.speed;
      star.y += dt * 6 * star.speed;
      if (star.y > this.height + 2) {
        star.y = -2;
        star.x = this.rng() * this.width;
      }
    }
    this.updateParticles(dt);
    if (this.phase === PHASE.PLAYING || this.phase === PHASE.WAVE_CLEAR) {
      this.updatePlaying(dt, input);
    } else if (this.phase === PHASE.TITLE) {
      // The title screen drifts: a few chasers wander behind the menu.
      if (this.enemies.length < 5 && this.rng() < dt * 0.5) {
        this.makeEnemy(pick(this.rng, ['chaser', 'shard']), range(this.rng, 40, this.width - 40), -30);
      }
      this.updateEnemies(dt, true);
    }
    for (const enemy of this.enemies) if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const part = this.particles[i];
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 0.96;
      part.vy *= 0.96;
      if (part.life <= 0) this.particles.splice(i, 1);
    }
  }

  updatePlaying(dt, input) {
    const p = this.player;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    // --- Movement: WASD / arrows, with smooth acceleration and drag. ---
    let mx = 0;
    let my = 0;
    if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.held('KeyD', 'ArrowRight')) mx += 1;
    if (input.held('KeyW', 'ArrowUp')) my -= 1;
    if (input.held('KeyS', 'ArrowDown')) my += 1;
    if (mx !== 0 || my !== 0) {
      const length = Math.hypot(mx, my);
      p.vx += (mx / length) * CONFIG.player.accel * dt;
      p.vy += (my / length) * CONFIG.player.accel * dt;
    }
    p.vx *= Math.pow(CONFIG.player.drag, dt * 60);
    p.vy *= Math.pow(CONFIG.player.drag, dt * 60);
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > CONFIG.player.maxSpeed) {
      p.vx = (p.vx / speed) * CONFIG.player.maxSpeed;
      p.vy = (p.vy / speed) * CONFIG.player.maxSpeed;
    }
    p.x = clamp(p.x + p.vx * dt, 24, this.width - 24);
    p.y = clamp(p.y + p.vy * dt, 24, this.height - 24);
    p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);

    // --- Firing: hold mouse or Space. ---
    this.fireTimer -= dt;
    if ((input.mouseDown || input.held('Space')) && this.fireTimer <= 0 && this.phase === PHASE.PLAYING) {
      this.fireBullet();
      this.fireTimer = CONFIG.player.fireInterval;
    }
    if (input.wasPressed('KeyE') || input.rightClicked) this.useBomb();

    // --- Spawning and wave flow. ---
    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnFromQueue();
        this.spawnQueue -= 1;
        this.spawnTimer = Math.max(0.35, 1.1 - this.wave * 0.06);
      }
    } else if (this.enemies.length === 0 && this.phase === PHASE.PLAYING) {
      if (this.wave >= CONFIG.waves.total) {
        // The Queen is gone and nothing is left: winGame already fired.
        if (!this.boss) this.winGame();
      } else {
        this.score += CONFIG.scoring.waveClearBonus;
        this.phase = PHASE.WAVE_CLEAR;
        this.waveTimer = CONFIG.waves.betweenSeconds;
        this.sound.waveClear();
        this.announce(`Wave ${this.wave} clear!  +${CONFIG.scoring.waveClearBonus} bonus`);
      }
    }
    if (this.phase === PHASE.WAVE_CLEAR) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.phase = PHASE.PLAYING;
        this.beginWave(this.wave + 1);
      }
    }

    this.updateEnemies(dt, false);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.collide();
  }

  updateEnemies(dt, drifting) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (drifting) {
        e.y += e.speed * 0.4 * dt;
        e.angle += dt;
        if (e.y > this.height + 40) this.enemies.splice(i, 1);
        continue;
      }
      const d = distance(e.x, e.y, p.x, p.y);
      const angleToPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.type === 'chaser' || e.type === 'spark' || e.type === 'shard') {
        e.vx += Math.cos(angleToPlayer) * e.speed * 2.2 * dt;
        e.vy += Math.sin(angleToPlayer) * e.speed * 2.2 * dt;
        const es = Math.hypot(e.vx, e.vy);
        const cap = e.speed * (e.type === 'shard' ? 1.5 : 1.1);
        if (es > cap) { e.vx = (e.vx / es) * cap; e.vy = (e.vy / es) * cap; }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.type === 'spinner') {
        e.orbitAngle += dt * 0.9;
        const targetX = p.x + Math.cos(e.orbitAngle) * 190;
        const targetY = p.y + Math.sin(e.orbitAngle) * 190;
        e.x += (targetX - e.x) * dt * 1.4;
        e.y += (targetY - e.y) * dt * 1.4;
        e.angle += dt * 3;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < 560) {
          e.fireTimer = CONFIG.enemies.spinner.fireInterval;
          this.enemyBullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(angleToPlayer) * 260,
            vy: Math.sin(angleToPlayer) * 260,
            radius: 6, life: 3,
          });
          this.sound.tone({ frequency: 300, endFrequency: 140, duration: 0.12, type: 'square', volume: 0.08 });
        }
      } else if (e.type === 'splitter') {
        e.x += Math.cos(angleToPlayer) * e.speed * dt;
        e.y += Math.sin(angleToPlayer) * e.speed * dt;
        e.angle += dt * 1.5;
      } else if (e.type === 'queen') {
        // The Void Queen strafes across the top and fires fans of shots.
        const targetX = this.width / 2 + Math.sin(this.time * 0.5) * (this.width / 2 - 140);
        e.x += (targetX - e.x) * dt * 0.8;
        e.y = 110 + Math.sin(this.time * 0.9) * 26;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 1.5;
          for (let k = -2; k <= 2; k += 1) {
            const a = angleToPlayer + k * 0.22;
            this.enemyBullets.push({
              x: e.x, y: e.y + e.radius * 0.6,
              vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
              radius: 7, life: 4,
            });
          }
          this.sound.tone({ frequency: 180, endFrequency: 90, duration: 0.2, type: 'sawtooth', volume: 0.1 });
        }
        if (e.hp < e.maxHp * 0.5 && this.rng() < dt * 0.8) {
          this.makeEnemy('spark', e.x + range(this.rng, -40, 40), e.y + 40);
        }
      }
      // Enemies that wander off the far side wrap back in.
      if (e.x < -70) e.x = this.width + 60;
      if (e.x > this.width + 70) e.x = -60;
      if (e.y < -70 && e.type !== 'queen') e.y = this.height + 60;
      if (e.y > this.height + 70) e.y = -60;
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) {
        this.bullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const e = this.enemies[j];
        if (distance(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
          this.bullets.splice(i, 1);
          this.burst(b.x, b.y, '#fff3b0', 5, 140);
          this.damageEnemy(e, 1);
          break;
        }
      }
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.bob += dt * 3;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 0.96;
      pk.vy *= 0.96;
      if (pk.x < 16 || pk.x > this.width - 16) pk.vx *= -1;
      if (pk.y < 16 || pk.y > this.height - 16) pk.vy *= -1;
      if (pk.life <= 0) this.pickups.splice(i, 1);
    }
  }

  collide() {
    const p = this.player;
    if (!p.alive) return;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pk = this.pickups[i];
      if (distance(p.x, p.y, pk.x, pk.y) < p.radius + pk.radius + 6) {
        this.pickups.splice(i, 1);
        this.applyPickup(pk);
      }
    }
    for (const e of [...this.enemies]) {
      if (distance(p.x, p.y, e.x, e.y) < p.radius + e.radius - 4) {
        if (this.shieldTimer > 0) {
          this.damageEnemy(e, 2);
          this.burst(e.x, e.y, '#4cc9f0', 12, 240);
        } else {
          this.hurtPlayer();
          // A hit knocks the enemy back so one touch is not two hits.
          e.vx = -e.vx * 1.5;
          e.vy = -e.vy * 1.5;
          e.x += e.vx * 0.05;
          e.y += e.vy * 0.05;
          if (this.phase !== PHASE.PLAYING) return;
        }
      }
    }
    if (this.shieldTimer <= 0 && p.invulnerable <= 0) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
        const b = this.enemyBullets[i];
        if (distance(p.x, p.y, b.x, b.y) < p.radius + b.radius - 2) {
          this.enemyBullets.splice(i, 1);
          this.hurtPlayer();
          break;
        }
      }
    }
  }

  applyPickup(pk) {
    if (pk.kind === 'star') {
      this.score += CONFIG.pickups.starValue;
      this.sound.pickup();
      this.burst(pk.x, pk.y, '#f4e285', 8, 160);
    } else if (pk.kind === 'heart') {
      this.lives = Math.min(CONFIG.player.maxLives + 2, this.lives + 1);
      this.announce('+1 hull!');
      this.sound.waveClear();
    } else if (pk.kind === 'bomb') {
      this.bombs += 1;
      this.announce('+1 nova bomb!');
      this.sound.pickup();
    } else if (pk.kind === 'shield') {
      this.shieldTimer = CONFIG.pickups.shieldSeconds;
      this.announce(`Shield up — ${CONFIG.pickups.shieldSeconds}s!`);
      this.sound.pickup();
    }
  }
}
