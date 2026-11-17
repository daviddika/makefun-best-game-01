// Lumen Drift — entrypoint for make.fun best-game-01 (Node 22, stdlib only).
//
// What this program does, and nothing else: it hands the game in. It copies
// the static game in game/ and the screenshots in screenshots/ from this
// repository into the output directory, then writes dossier.json there using
// the vendored make.fun library (vendor/makefun-game.ts). The judge reads
// that dossier; the grader runs this program twice and expects identical
// bytes both times, so there is no timestamp, no randomness and no network
// anywhere in here.
//
// Run it locally to check the entry before submitting:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.
// Serve the game itself with: node serve.ts  (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this competition, kept here so a too-big entry fails
// loudly at build time instead of silently at grading time.
const DOSSIER_TEXT_MAX_BYTES = 163840;
const SHOT_LIMIT = 4;
const SHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

function fail(message) {
  throw new Error(`lumen-drift main.ts: ${message}`);
}

function checkGameTree(dir, seen) {
  // Walk game/ once: count entries, add up bytes, refuse absurd paths.
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    seen.count += 1;
    if (seen.count > GAME_MAX_FILES) fail(`game/ holds more than ${GAME_MAX_FILES} files`);
    if (info.isDirectory()) {
      checkGameTree(path, seen);
    } else if (info.isFile()) {
      seen.bytes += info.size;
      if (seen.bytes > GAME_MAX_BYTES) fail(`game/ is larger than ${GAME_MAX_BYTES} bytes`);
      const rel = path.slice(repoRoot.length);
      if (Buffer.byteLength(rel, 'utf8') > GAME_PATH_MAX_BYTES) fail(`path too long under game/: ${rel}`);
    } else {
      fail(`game/ holds a non-file, non-directory entry: ${path}`);
    }
  }
  return seen;
}

function checkShots(dir) {
  if (!existsSync(dir)) fail('screenshots/ is missing — the entry needs 3 or 4 screenshots');
  const names = readdirSync(dir).filter((name) => !name.startsWith('.')).sort();
  if (names.length < 3 || names.length > SHOT_LIMIT) {
    fail(`screenshots/ holds ${names.length} images, need 3 or 4`);
  }
  for (const name of names) {
    const size = statSync(join(dir, name)).size;
    if (size > SHOT_MAX_BYTES) fail(`screenshot ${name} is ${size} bytes, over ${SHOT_MAX_BYTES}`);
  }
  return names;
}

function handIn() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  checkGameTree(gameDir, { count: 0, bytes: 0 });
  const shotNames = checkShots(shotsDir);

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
    screenshots: { max: SHOT_LIMIT, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: GAME_PATH_MAX_BYTES,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  // A short, deterministic summary on stdout; the grader ignores it, but a
  // human running this by hand can see at a glance that the entry is whole.
  console.log(`Lumen Drift handed in to ${outputDir}`);
  console.log(`  game/index.html + ${readdirSync(gameDir).length} top-level game entries`);
  console.log(`  screenshots: ${shotNames.join(', ')}`);
  console.log(`  dossier.json: ${Buffer.byteLength(dossier, 'utf8')} bytes`);
}

handIn();
