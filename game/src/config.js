// Lumen Drift — config.js
// One job: every tunable number, colour and piece of text in one place, so
// balancing the game never means hunting through the update or draw code.

export const CONFIG = {
  // Arena is the full browser window; the playfield is clamped to it.
  world: { margin: 26 },
  player: {
    radius: 16,
    accel: 2600,
    maxSpeed: 340,
    drag: 0.86,
    fireInterval: 0.16,
    bulletSpeed: 720,
    maxLives: 3,
    invulnerableSeconds: 2.0,
    bombStart: 1,
  },
  // Waves: the game is won by clearing wave 10 (the Void Queen).
  waves: {
    total: 10,
    betweenSeconds: 3.0,
    // base enemy count grows with the wave; the boss wave adds the Queen.
    countForWave: (wave) => 5 + wave * 2,
  },
  enemies: {
    // chaser: drifts toward the player. spinner: orbits and fires. splitter:
    // breaks into two sparks when destroyed. shard: fast, fragile, worth more.
    chaser: { radius: 15, speed: 95, hp: 1, score: 100, color: '#ff5d73' },
    spinner: { radius: 17, speed: 62, hp: 2, score: 200, color: '#c77dff', fireInterval: 2.4 },
    splitter: { radius: 22, speed: 55, hp: 3, score: 250, color: '#ff9e5e' },
    spark: { radius: 9, speed: 170, hp: 1, score: 50, color: '#ffb703' },
    shard: { radius: 11, speed: 210, hp: 1, score: 150, color: '#4cc9f0' },
    queen: { radius: 54, speed: 48, hp: 60, score: 5000, color: '#e0aaff' },
  },
  pickups: {
    starValue: 25,          // score per starlight mote collected
    heartChance: 0.06,      // chance an enemy drops a life
    bombChance: 0.10,       // chance an enemy drops a nova bomb
    shieldSeconds: 6,       // shield pickup duration
  },
  scoring: {
    comboWindowSeconds: 3.0, // kills inside the window raise the multiplier
    comboStep: 0.5,
    comboMax: 5,
    waveClearBonus: 250,
  },
  // Palette: deep indigo nebula, warm lantern gold for the player.
  colors: {
    backgroundTop: '#0b0620',
    backgroundBottom: '#160a33',
    nebulaA: 'rgba(124, 77, 255, 0.16)',
    nebulaB: 'rgba(76, 201, 240, 0.12)',
    nebulaC: 'rgba(255, 157, 94, 0.10)',
    player: '#ffd166',
    playerGlow: '#ffe9a8',
    bullet: '#fff3b0',
    enemyBullet: '#ff5d8f',
    star: '#f4e285',
    hud: '#f8f7ff',
    hudDim: '#b8b3d9',
    danger: '#ff5d73',
  },
  text: {
    title: 'LUMEN DRIFT',
    subtitle: 'a lantern-moth harvest in the void',
    goal:
      'Harvest starlight, survive 10 waves and shatter the Void Queen. ' +
      'Three hulls. One lantern. No way back but through.',
    controls: [
      'MOVE  —  WASD or Arrow keys',
      'AIM  —  Mouse',
      'FIRE  —  Hold Left Click or Space',
      'NOVA BOMB  —  E or Right Click (clears the screen)',
      'PAUSE  —  P      MUTE  —  M      RESTART  —  R',
    ],
    winTitle: 'THE VOID IS LIT',
    winBody: 'The Void Queen is shattered. Ten waves survived, and the nebula glows again.',
    loseTitle: 'THE LANTERN GOES DARK',
    loseBody: 'The drift claims another light. The stars are still out there — try again.',
  },
};

export const STORAGE_KEY = 'lumen-drift-best';
