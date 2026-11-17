// Lumen Drift — main.js
// One job: wire the modules together and run the frame loop. It owns the
// canvas sizing, the phase transitions driven by input, the fixed-step
// update, and the ?shot= screenshot hook. Game rules live in world.js.

import { CONFIG } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { World, PHASE } from './world.js';
import { applyShotScene, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const sound = new SoundEngine();
const input = new Input(canvas);
const renderer = new Renderer(canvas);
const world = new World(window.innerWidth, window.innerHeight, sound);

let shotMode = false;
let lastStatus = '';

function resize() {
  world.resize(window.innerWidth, window.innerHeight);
  renderer.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

input.onFirstGesture = () => sound.ensure();

function setStatus(text) {
  if (text !== lastStatus) {
    lastStatus = text;
    statusLine.textContent = text;
  }
}

function describePhase() {
  if (world.phase === PHASE.TITLE) return 'Lumen Drift title screen. Press Enter to begin.';
  if (world.phase === PHASE.PLAYING) return `Wave ${world.wave}. Score ${world.score}. ${world.lives} hulls.`;
  if (world.phase === PHASE.PAUSED) return 'Paused.';
  if (world.phase === PHASE.WON) return `Victory! Final score ${world.score}.`;
  if (world.phase === PHASE.LOST) return `Game over. Final score ${world.score}.`;
  return 'Lumen Drift.';
}

// --- Screenshot hook: ?shot=start|play|win|end freezes a staged scene. ---
const { shot, seed } = shotFromUrl(window.location.href);
if (shot) {
  shotMode = true;
  world.reset(seed);
  applyShotScene(world, shot);
}

// --- Input-driven phase transitions (menus, pause, restart, mute). ---
function handlePhaseInput() {
  if (input.wasPressed('KeyM')) {
    sound.ensure();
    const muted = sound.toggleMute();
    world.announce(muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
  if (world.phase === PHASE.TITLE) {
    if (input.wasPressed('Enter', 'Space') || input.clicked) {
      sound.ensure();
      world.startGame();
    }
    return;
  }
  if (world.phase === PHASE.WON || world.phase === PHASE.LOST) {
    if (input.wasPressed('KeyR', 'Enter', 'Space') || input.clicked) {
      sound.ensure();
      world.startGame();
    }
    return;
  }
  if (world.phase === PHASE.PLAYING) {
    if (input.wasPressed('KeyP', 'Escape')) {
      world.phase = PHASE.PAUSED;
      world.announce('Paused');
    }
    if (input.wasPressed('KeyR')) world.startGame();
    return;
  }
  if (world.phase === PHASE.PAUSED) {
    if (input.wasPressed('KeyP', 'Escape', 'Enter')) world.phase = PHASE.PLAYING;
    if (input.wasPressed('KeyR')) world.startGame();
  }
}

// --- Main loop: fixed-dt updates, one render per animation frame. ---
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - lastTime) / 1000;
  lastTime = now;
  if (elapsed > 0.25) elapsed = 0.25; // tab was in the background; don't spiral.

  handlePhaseInput();
  if (!shotMode) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      world.update(STEP, input);
      accumulator -= STEP;
    }
  } else {
    // A staged shot still twinkles and drifts a little, but never advances
    // the game: the screenshot must show exactly the staged state.
    world.time += elapsed;
    for (const star of world.stars) star.twinkle += elapsed;
    world.updateParticles(elapsed);
  }
  renderer.draw(world);
  setStatus(describePhase());
  input.endFrame();
}

requestAnimationFrame(frame);

// Expose a tiny handle for headless play-tests: window.__lumen = { world }.
window.__lumen = { world, PHASE, CONFIG };
