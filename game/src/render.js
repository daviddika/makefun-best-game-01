// Lumen Drift — render.js
// One job: everything the player sees. The nebula background, the lantern
// moth, the enemies, the bullets, the pickups, the HUD and every menu screen.
// It reads the world and draws it; it never changes game state.

import { CONFIG } from './config.js';
import { PHASE } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(width, height) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(world) {
    const ctx = this.ctx;
    const w = world.width;
    const h = world.height;
    ctx.save();
    if (world.shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    this.drawBackground(ctx, world, w, h);
    this.drawPickups(ctx, world);
    this.drawEnemies(ctx, world);
    this.drawBullets(ctx, world);
    if (world.player.alive) this.drawPlayer(ctx, world);
    this.drawParticles(ctx, world);
    ctx.restore();

    if (world.flash > 0) {
      ctx.fillStyle = `rgba(190, 240, 255, ${Math.min(0.55, world.flash)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (world.phase === PHASE.PLAYING || world.phase === PHASE.WAVE_CLEAR || world.phase === PHASE.PAUSED) {
      this.drawHud(ctx, world, w, h);
    }
    if (world.phase === PHASE.TITLE) this.drawTitle(ctx, world, w, h);
    if (world.phase === PHASE.PAUSED) this.drawPaused(ctx, world, w, h);
    if (world.phase === PHASE.WON) this.drawEnd(ctx, world, w, h, true);
    if (world.phase === PHASE.LOST) this.drawEnd(ctx, world, w, h, false);
  }

  drawBackground(ctx, world, w, h) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, CONFIG.colors.backgroundTop);
    gradient.addColorStop(1, CONFIG.colors.backgroundBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Three slow-drifting nebula blobs, drawn from the world clock.
    const blobs = [
      { x: w * 0.22 + Math.sin(world.time * 0.05) * 40, y: h * 0.28, r: Math.max(w, h) * 0.34, color: CONFIG.colors.nebulaA },
      { x: w * 0.78 + Math.cos(world.time * 0.04) * 40, y: h * 0.62, r: Math.max(w, h) * 0.30, color: CONFIG.colors.nebulaB },
      { x: w * 0.55, y: h * 0.85 + Math.sin(world.time * 0.06) * 24, r: Math.max(w, h) * 0.26, color: CONFIG.colors.nebulaC },
    ];
    for (const blob of blobs) {
      const glow = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      glow.addColorStop(0, blob.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    }

    for (const star of world.stars) {
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(star.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e8e6ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx, world) {
    const p = world.player;
    const flicker = 0.75 + Math.sin(world.time * 9) * 0.25;
    const blink = p.invulnerable > 0 && Math.floor(world.time * 12) % 2 === 0;

    // Warm lantern glow around the moth.
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 90);
    glow.addColorStop(0, `rgba(255, 209, 102, ${0.34 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 90, p.y - 90, 180, 180);

    if (world.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(76, 201, 240, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 14 + Math.sin(world.time * 6) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = blink ? 0.35 : 1;
    // Body: a lantern-moth — tapered hull, glowing core, two wings.
    ctx.fillStyle = CONFIG.colors.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.quadraticCurveTo(6, -11, -12, -7);
    ctx.quadraticCurveTo(-18, 0, -12, 7);
    ctx.quadraticCurveTo(6, 11, 20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Wings flap gently with the clock.
    const flap = Math.sin(world.time * 14) * 4;
    ctx.fillStyle = 'rgba(255, 233, 168, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-16, -22 - flap, -24, -10 - flap);
    ctx.quadraticCurveTo(-14, -4, -2, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.quadraticCurveTo(-16, 22 + flap, -24, 10 + flap);
    ctx.quadraticCurveTo(-14, 4, -2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawEnemies(ctx, world) {
    for (const e of world.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      // Soft halo so enemies read at a glance against the nebula.
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(e.angle);
      const flash = e.hitFlash > 0;
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 2;
      if (e.type === 'chaser') {
        // Spiked void shard.
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          const r = i % 2 === 0 ? e.radius : e.radius * 0.55;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'spinner') {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(e.radius, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(-e.radius * 0.7, e.radius * 0.7);
        ctx.moveTo(0, 0);
        ctx.lineTo(-e.radius * 0.7, -e.radius * 0.7);
        ctx.stroke();
      } else if (e.type === 'splitter') {
        roundRect(ctx, -e.radius, -e.radius, e.radius * 2, e.radius * 2, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(-e.radius * 0.5, 0);
        ctx.lineTo(e.radius * 0.5, 0);
        ctx.stroke();
      } else if (e.type === 'spark' || e.type === 'shard') {
        ctx.beginPath();
        ctx.moveTo(e.radius, 0);
        ctx.lineTo(0, e.radius * 0.5);
        ctx.lineTo(-e.radius, 0);
        ctx.lineTo(0, -e.radius * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'queen') {
        // The Void Queen: a crowned ring with a dark heart.
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#1a0b2e';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff5d8f';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.16 + Math.sin(world.time * 5) * 3, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * e.radius * 0.9, Math.sin(a) * e.radius * 0.9);
          ctx.lineTo(Math.cos(a + 0.18) * e.radius * 1.3, Math.sin(a + 0.18) * e.radius * 1.3);
          ctx.lineTo(Math.cos(a - 0.18) * e.radius * 1.3, Math.sin(a - 0.18) * e.radius * 1.3);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      if (e.type === 'queen') {
        // Boss health bar pinned to the top of the screen.
        const barW = Math.min(520, world.width * 0.5);
        const barX = (world.width - barW) / 2;
        const barY = 46;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(ctx, barX, barY, barW, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#e0aaff';
        const frac = Math.max(0, e.hp / e.maxHp);
        roundRect(ctx, barX, barY, barW * frac, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VOID QUEEN', world.width / 2, barY - 8);
      }
    }
  }

  drawBullets(ctx, world) {
    for (const b of world.bullets) {
      ctx.fillStyle = CONFIG.colors.bullet;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const b of world.enemyBullets) {
      ctx.fillStyle = CONFIG.colors.enemyBullet;
      ctx.shadowColor = '#ff5d8f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  drawPickups(ctx, world) {
    for (const pk of world.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      const blink = pk.life < 2.5 && Math.floor(world.time * 8) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'star') {
        ctx.fillStyle = CONFIG.colors.star;
        ctx.shadowColor = '#f4e285';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 11 : 4.5;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === 'heart') {
        ctx.fillStyle = '#ff5d73';
        ctx.font = '20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', 0, 1);
      } else if (pk.kind === 'bomb') {
        ctx.fillStyle = '#b8f2ff';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b0620';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', 0, 1);
      } else if (pk.kind === 'shield') {
        ctx.strokeStyle = '#4cc9f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4cc9f0';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 1);
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  drawParticles(ctx, world) {
    for (const part of world.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.maxLife);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, world, w, h) {
    const pad = 18;
    ctx.textBaseline = 'alphabetic';
    // Score, top left, big enough to read at a glance.
    ctx.textAlign = 'left';
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(world.score).padStart(6, '0'), pad, 42);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, pad, 62);
    if (world.combo > 1) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`COMBO ×${world.combo.toFixed(1)}`, pad, 88);
    }

    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`WAVE ${Math.max(1, world.wave)} / ${CONFIG.waves.total}`, w / 2, 34);
    const progress = world.enemies.length + world.spawnQueue;
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(progress > 0 ? `${progress} voidborn left` : 'clear!', w / 2, 52);

    // Lives (hulls) and bombs, top right.
    ctx.textAlign = 'right';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = '#ff5d73';
    ctx.fillText('♥'.repeat(Math.max(0, world.lives)), w - pad, 40);
    ctx.fillStyle = '#b8f2ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`✦ NOVA ×${world.bombs}`, w - pad, 64);
    if (world.shieldTimer > 0) {
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText(`SHIELD ${Math.ceil(world.shieldTimer)}s`, w - pad, 86);
    }

    // Wave-clear countdown, centre.
    if (world.phase === PHASE.WAVE_CLEAR) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(`Next wave in ${Math.ceil(world.waveTimer)}…`, w / 2, h / 2 - 40);
    }

    // Transient announcement banner, just under the top bar.
    if (world.messageTimer > 0 && world.message) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, world.messageTimer);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(world.message, w / 2, 92);
      ctx.globalAlpha = 1;
    }

    // Bottom hint line.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(184, 179, 217, 0.75)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD move · Mouse aim · Click / Space fire · E nova bomb · P pause · M mute', w / 2, h - 14);
  }

  panel(ctx, w, h, panelW, panelH) {
    const x = (w - panelW) / 2;
    const y = (h - panelH) / 2;
    ctx.fillStyle = 'rgba(8, 4, 24, 0.78)';
    roundRect(ctx, x, y, panelW, panelH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, panelW, panelH, 18);
    ctx.stroke();
    return { x, y };
  }

  drawTitle(ctx, world, w, h) {
    ctx.fillStyle = 'rgba(5, 2, 16, 0.45)';
    ctx.fillRect(0, 0, w, h);
    const panelW = Math.min(680, w - 48);
    const panelH = Math.min(520, h - 60);
    const { x, y } = this.panel(ctx, w, h, panelW, panelH);
    const cx = w / 2;
    let line = y + 78;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(CONFIG.text.title, cx, line);
    line += 34;
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.font = 'italic 17px system-ui, sans-serif';
    ctx.fillText(CONFIG.text.subtitle, cx, line);
    line += 52;
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.font = '15px system-ui, sans-serif';
    this.wrapText(ctx, CONFIG.text.goal, cx, line, panelW - 90, 22);
    line += 66;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 14px system-ui, sans-serif';
    for (const control of CONFIG.text.controls) {
      ctx.fillText(control, cx, line);
      line += 22;
    }
    line += 18;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('— CLICK or press ENTER to begin —', cx, line);
    line += 34;
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Best score: ${world.best}   ·   10 waves   ·   3 hulls   ·   1 lantern`, cx, line);
    void x;
  }

  drawPaused(ctx, world, w, h) {
    ctx.fillStyle = 'rgba(5, 2, 16, 0.6)';
    ctx.fillRect(0, 0, w, h);
    const { x, y } = this.panel(ctx, w, h, 420, 210);
    void x;
    void y;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 28);
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press P to resume · R to restart · M to mute', w / 2, h / 2 + 14);
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Score ${world.score} · Wave ${world.wave} · ${world.lives} hulls left`, w / 2, h / 2 + 44);
  }

  drawEnd(ctx, world, w, h, won) {
    ctx.fillStyle = won ? 'rgba(8, 20, 8, 0.55)' : 'rgba(20, 4, 12, 0.6)';
    ctx.fillRect(0, 0, w, h);
    const panelW = Math.min(640, w - 48);
    const panelH = 380;
    this.panel(ctx, w, h, panelW, panelH);
    const cx = w / 2;
    const top = (h - panelH) / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd166' : '#ff5d73';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(won ? CONFIG.text.winTitle : CONFIG.text.loseTitle, cx, top + 74);
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.font = '16px system-ui, sans-serif';
    this.wrapText(ctx, won ? CONFIG.text.winBody : CONFIG.text.loseBody, cx, top + 116, panelW - 90, 24);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`FINAL SCORE  ${world.score}`, cx, top + 196);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.fillText(`Wave reached: ${world.wave} / ${CONFIG.waves.total}    Voidborn shattered: ${world.kills}`, cx, top + 228);
    ctx.fillStyle = world.score >= world.best && world.score > 0 ? '#ffd166' : CONFIG.colors.hudDim;
    ctx.fillText(world.score >= world.best && world.score > 0 ? '★ NEW BEST SCORE ★' : `Best score: ${world.best}`, cx, top + 256);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('Press R or ENTER to fly again', cx, top + 312);
  }

  wrapText(ctx, text, cx, startY, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    lines.forEach((lineText, i) => {
      ctx.fillText(lineText, cx, startY + i * lineHeight);
    });
    return lines.length;
  }
}
