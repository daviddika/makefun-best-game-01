// Lumen Drift — random.js
// One job: a small seeded random-number generator. The live game seeds itself
// from the clock; the screenshot scenes seed it from a fixed number, so the
// same shot renders the same layout every time it is taken.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  // mulberry32: tiny, fast, deterministic, good enough for spawn placement.
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
