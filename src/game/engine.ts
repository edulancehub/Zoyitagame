import {
  PALETTES, buildGroundSegment, buildThemeArt, drawFlower, drawGlow, drawHeartItem, drawMushroom,
  drawPlatform, drawPlayer, drawShrine, drawThorns, heartPath, type ThemeArt,
} from './art';
import { GROUND_Y, LEVELS, VIEW_H, VIEW_W, type LevelDef, type PlatformDef, type Theme } from './levels';
import type { SoundName } from './audio';

const STEP = 1000 / 60;
const G_UP = 0.55;
const G_DOWN = 0.78;
const MAX_FALL = 13;
const JUMP_V = -12.5;
const SPRING_V = -19;
const MAX_RUN = 4.8;
const JUMP_CUT = -4.5;

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface Stats {
  hearts: number;
  totalHearts: number;
  flowers: number;
  totalFlowers: number;
}

export interface EngineEvents {
  onStats: (s: Stats) => void;
  onLevelComplete: (s: Stats) => void;
  onToast: (msg: string) => void;
  onSound: (s: SoundName) => void;
}

type Mode = 'attract' | 'play' | 'frozen';

interface Plat {
  def: PlatformDef;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  w: number;
}

interface Rect { x: number; y: number; w: number; h: number; }

interface Item { x: number; y: number; kind: 'heart' | 'flower'; taken: boolean; phase: number; }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; decay: number; size: number; color: string;
  kind: 'spark' | 'dust' | 'petal' | 'heart';
  rot: number; g: number;
}

interface Firefly { x: number; y: number; phase: number; speed: number; color: string; depth: number; }

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: EngineEvents;
  input: Input = { left: false, right: false, jump: false };

  private mode: Mode = 'attract';
  private levelIndex = 0;
  private level: LevelDef = LEVELS[0];
  private art = new Map<Theme, ThemeArt>();
  private artScale = 1;
  private grounds: { rect: Rect; img: HTMLCanvasElement; pad: number; w: number; h: number }[] = [];
  private plats: Plat[] = [];
  private items: Item[] = [];
  private springs: { x: number; compress: number }[] = [];
  private particles: Particle[] = [];
  private fireflies: Firefly[] = [];
  private goalOpen = false;
  private camX = 0;
  private time = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private toastCooldown = 0;
  private stats: Stats = { hearts: 0, totalHearts: 0, flowers: 0, totalFlowers: 0 };
  private safe = { x: 80, y: GROUND_Y - 30 };

  private p = {
    x: 80, y: GROUND_Y - 30, w: 24, h: 30, vx: 0, vy: 0,
    onGround: false, plat: null as Plat | null, coyote: 0, buffer: 0, jumpHeld: false,
    springBoost: false, facing: 1, squash: 0, walk: 0, blink: 200, flash: 0,
  };

  private cssW = VIEW_W;
  private cssH = VIEW_H;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.events = events;
    this.loadLevel(0, 'attract');
  }

  start() {
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(100, now - this.last);
      this.last = now;
      this.acc += dt;
      while (this.acc >= STEP) {
        this.tick();
        this.acc -= STEP;
      }
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  resize(cssW: number, cssH: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    const scale = Math.min(2.5, Math.max(1, (cssW / VIEW_W) * this.dpr));
    if (Math.abs(scale - this.artScale) > 0.15) {
      this.artScale = scale;
      this.art.clear();
      this.buildGrounds();
    }
  }

  get currentLevel() {
    return this.levelIndex;
  }

  debugTeleport(x: number, y = GROUND_Y - 30) {
    Object.assign(this.p, { x, y, vx: 0, vy: 0 });
    this.camX = Math.max(0, Math.min(this.level.width - VIEW_W, x - VIEW_W / 2));
  }

  debugCollectAll() {
    for (const it of this.items) if (it.kind === 'heart') { it.x = this.p.x + 12; it.y = this.p.y + 15; }
  }

  setMode(mode: Mode) {
    this.mode = mode;
  }

  loadLevel(index: number, mode: Mode = 'play') {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.mode = mode;
    const L = this.level;
    this.plats = L.platforms.map(def => ({ def, x: def.x, y: def.y, prevX: def.x, prevY: def.y, w: def.w }));
    this.items = [
      ...L.hearts.map(([x, y]) => ({ x, y, kind: 'heart' as const, taken: false, phase: Math.random() * 6 })),
      ...L.flowers.map(([x, y]) => ({ x, y, kind: 'flower' as const, taken: false, phase: Math.random() * 6 })),
    ];
    this.springs = L.springs.map(x => ({ x, compress: 0 }));
    this.particles = [];
    this.goalOpen = false;
    this.buildGrounds();
    const pal = PALETTES[L.theme];
    this.fireflies = Array.from({ length: 34 }, () => ({
      x: Math.random() * VIEW_W,
      y: 40 + Math.random() * (VIEW_H - 80),
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02,
      color: pal.firefly[Math.floor(Math.random() * pal.firefly.length)],
      depth: 0.3 + Math.random() * 0.9,
    }));
    const p = this.p;
    Object.assign(p, {
      x: L.spawn, y: GROUND_Y - p.h, vx: 0, vy: 0, onGround: true, plat: null, coyote: 0, buffer: 0,
      jumpHeld: true, springBoost: false, facing: 1, squash: 0, walk: 0, flash: 0,
    });
    this.safe = { x: L.spawn, y: GROUND_Y - p.h };
    this.camX = 0;
    this.stats = { hearts: 0, totalHearts: L.hearts.length, flowers: 0, totalFlowers: L.flowers.length };
    this.events.onStats({ ...this.stats });
  }

  private buildGrounds() {
    const L = this.level;
    this.grounds = L.ground.map(([x0, x1], i) => {
      const seg = buildGroundSegment(L.theme, x1 - x0, this.artScale, i * 31 + this.levelIndex * 7 + 1);
      return { rect: { x: x0, y: GROUND_Y, w: x1 - x0, h: 200 }, img: seg.canvas, pad: seg.pad, w: seg.w, h: seg.h };
    });
  }

  private themeArt() {
    let a = this.art.get(this.level.theme);
    if (!a) {
      a = buildThemeArt(this.level.theme, this.artScale);
      this.art.set(this.level.theme, a);
    }
    return a;
  }

  // ---------- Simulation ----------

  private tick() {
    this.time++;
    const t = this.time;
    for (const pl of this.plats) {
      pl.prevX = pl.x;
      pl.prevY = pl.y;
      const m = pl.def.move;
      if (m) {
        const k = (1 - Math.cos((Math.PI * 2 * t) / m.period)) / 2;
        pl.x = pl.def.x + m.dx * k;
        pl.y = pl.def.y + m.dy * k;
      }
    }

    if (this.mode === 'play') this.updatePlayer();
    else if (this.mode === 'attract') {
      const span = Math.min(this.level.width - VIEW_W, 1400);
      this.camX = ((1 - Math.cos(t * 0.0012)) / 2) * span;
    }

    for (const s of this.springs) s.compress *= 0.85;
    if (this.toastCooldown > 0) this.toastCooldown--;
    if (this.p.flash > 0) this.p.flash--;
    if (--this.p.blink < 0) this.p.blink = 160 + Math.random() * 160;

    // ambient falling leaves
    if (t % 40 === 0) {
      const pal = PALETTES[this.level.theme];
      this.particles.push({
        x: this.camX + Math.random() * VIEW_W, y: -10, vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 0.6,
        life: 1, decay: 0.002, size: 4 + Math.random() * 3, color: pal.grassTop, kind: 'petal', rot: Math.random() * 6, g: 0,
      });
    }

    this.particles = this.particles.filter(pt => {
      pt.vy += pt.g;
      if (pt.kind === 'petal') pt.vx += Math.sin(t * 0.03 + pt.y * 0.02) * 0.02;
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.rot += 0.05;
      pt.life -= pt.decay;
      return pt.life > 0 && pt.y < VIEW_H + 40;
    });
  }

  private updatePlayer() {
    const p = this.p;
    const inp = this.input;
    const L = this.level;
    const wasGround = p.onGround;
    const landingVy = p.vy;

    if (p.plat) {
      p.x += p.plat.x - p.plat.prevX;
      p.y += p.plat.y - p.plat.prevY;
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      p.vx += dir * (p.onGround ? 0.7 : 0.45);
      p.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, p.vx));
      p.facing = dir;
    } else {
      p.vx *= p.onGround ? 0.7 : 0.93;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }
    p.walk = p.onGround && Math.abs(p.vx) > 0.4 ? p.walk + Math.abs(p.vx) * 0.35 : 0;

    if (inp.jump && !p.jumpHeld) p.buffer = 8;
    p.jumpHeld = inp.jump;
    if (p.buffer > 0) p.buffer--;
    if (p.onGround) p.coyote = 7;
    else if (p.coyote > 0) p.coyote--;

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      p.plat = null;
      p.squash = -0.6;
      this.dust(p.x + p.w / 2, p.y + p.h, 6);
      this.events.onSound('jump');
    }

    if (p.springBoost && p.vy >= 0) p.springBoost = false;
    if (!inp.jump && !p.springBoost && p.vy < JUMP_CUT) p.vy = JUMP_CUT;

    p.vy = Math.min(MAX_FALL, p.vy + (p.vy < 0 ? G_UP : G_DOWN));

    // horizontal
    p.x += p.vx;
    for (const g of this.grounds) {
      if (overlap(p, g.rect)) {
        if (p.x + p.w / 2 < g.rect.x + g.rect.w / 2) p.x = g.rect.x - p.w;
        else p.x = g.rect.x + g.rect.w;
        p.vx = 0;
      }
    }
    p.x = Math.max(0, Math.min(L.width - p.w, p.x));

    // vertical
    const prevBottom = p.y + p.h;
    p.y += p.vy;
    p.onGround = false;
    p.plat = null;
    let onSolid: Rect | null = null;
    for (const g of this.grounds) {
      if (overlap(p, g.rect)) {
        if (p.vy > 0) {
          p.y = g.rect.y - p.h;
          p.vy = 0;
          p.onGround = true;
          onSolid = g.rect;
        } else if (p.vy < 0) {
          p.y = g.rect.y + g.rect.h;
          p.vy = 0;
        }
      }
    }
    if (p.vy >= 0) {
      for (const pl of this.plats) {
        const bottom = p.y + p.h;
        if (p.x + p.w > pl.x + 3 && p.x < pl.x + pl.w - 3 && prevBottom <= pl.y + 1 && bottom >= pl.y) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.plat = pl;
        }
      }
    }

    if (p.onGround && !wasGround) {
      if (landingVy > 5) {
        p.squash = Math.min(0.7, landingVy / 18);
        this.dust(p.x + p.w / 2, p.y + p.h, 5);
        this.events.onSound('land');
      }
    }
    p.squash *= 0.82;

    // safe respawn point
    if (onSolid) {
      const nearEdge = p.x < onSolid.x + 40 || p.x + p.w > onSolid.x + onSolid.w - 40;
      const nearThorn = L.thorns.some(th => p.x + p.w > th.x - 50 && p.x < th.x + th.w + 50);
      const nearSpring = this.springs.some(s => Math.abs(p.x - s.x) < 60);
      if (!nearEdge && !nearThorn && !nearSpring) this.safe = { x: p.x, y: p.y };
    }

    const hit = { x: p.x + 4, y: p.y + 6, w: p.w - 8, h: p.h - 6 };

    // springs
    for (const s of this.springs) {
      const sr = { x: s.x + 4, y: GROUND_Y - 20, w: 30, h: 20 };
      if (p.vy >= 0 && overlap(hit, sr)) {
        p.vy = SPRING_V;
        p.springBoost = true;
        p.onGround = false;
        p.plat = null;
        p.squash = -0.8;
        s.compress = 1;
        this.burst(s.x + 19, GROUND_Y - 24, '#ff8ac2', 12, 'spark');
        this.events.onSound('spring');
      }
    }

    // thorns
    if (p.flash === 0) {
      for (const th of L.thorns) {
        if (overlap(hit, { x: th.x + 4, y: GROUND_Y - 16, w: th.w - 8, h: 16 })) {
          this.respawn();
          break;
        }
      }
    }

    if (p.y > VIEW_H + 80) this.respawn();

    // items
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = it.x - cx;
      const dy = it.y - cy;
      if (dx * dx + dy * dy < 28 * 28) {
        it.taken = true;
        if (it.kind === 'heart') {
          this.stats.hearts++;
          this.burst(it.x, it.y, '#ff6fa8', 16, 'heart');
          this.burst(it.x, it.y, '#ffd1e6', 14, 'spark');
          this.events.onSound('heart');
          if (this.stats.hearts === this.stats.totalHearts) {
            this.goalOpen = true;
            this.events.onToast('The shrine is open! Head to the end ✨');
            setTimeout(() => this.events.onSound('open'), 350);
          } else {
            const left = this.stats.totalHearts - this.stats.hearts;
            this.events.onToast(`${left} more heart${left > 1 ? 's' : ''} to go`);
          }
        } else {
          this.stats.flowers++;
          this.burst(it.x, it.y, '#ffd36e', 12, 'spark');
          this.events.onSound('flower');
        }
        this.events.onStats({ ...this.stats });
      }
    }

    // goal
    if (Math.abs(cx - L.goal) < 40 && p.onGround) {
      if (this.goalOpen) {
        this.mode = 'frozen';
        p.vx = 0;
        for (let i = 0; i < 4; i++) {
          setTimeout(() => this.burst(L.goal, GROUND_Y - 100, i % 2 ? '#ffd36e' : '#ff6fa8', 20, i % 2 ? 'spark' : 'heart'), i * 180);
        }
        this.events.onSound('win');
        setTimeout(() => this.events.onLevelComplete({ ...this.stats }), 1100);
      } else if (this.toastCooldown === 0) {
        const left = this.stats.totalHearts - this.stats.hearts;
        this.events.onToast(`The shrine is sealed. Find ${left} more heart${left > 1 ? 's' : ''} 💗`);
        this.toastCooldown = 180;
      }
    }

    // camera
    const target = p.x + p.w / 2 - VIEW_W / 2 + p.facing * 70;
    this.camX += (target - this.camX) * 0.09;
    this.camX = Math.max(0, Math.min(L.width - VIEW_W, this.camX));
  }

  private respawn() {
    const p = this.p;
    this.events.onSound('hurt');
    this.burst(p.x + p.w / 2, Math.min(p.y, VIEW_H - 20), '#ffffff', 10, 'spark');
    p.x = this.safe.x;
    p.y = this.safe.y;
    p.vx = 0;
    p.vy = 0;
    p.flash = 70;
    p.plat = null;
  }

  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y: y - 2, vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 1.2,
        life: 1, decay: 0.04, size: 3 + Math.random() * 3, color: 'rgba(230,240,220,0.7)', kind: 'dust', rot: 0, g: 0.02,
      });
    }
  }

  private burst(x: number, y: number, color: string, n: number, kind: Particle['kind']) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        life: 1, decay: 0.018 + Math.random() * 0.012, size: kind === 'heart' ? 8 + Math.random() * 6 : 2 + Math.random() * 3,
        color, kind, rot: (Math.random() - 0.5) * 0.6, g: 0.08,
      });
    }
  }

  // ---------- Rendering ----------

  private render() {
    const ctx = this.ctx;
    const k = (this.cssW / VIEW_W) * this.dpr;
    ctx.setTransform(k, 0, 0, (this.cssH / VIEW_H) * this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const art = this.themeArt();
    const pal = PALETTES[this.level.theme];
    const t = this.time;
    const cam = this.camX;

    ctx.drawImage(art.sky, 0, 0, VIEW_W, VIEW_H);

    for (const s of art.stars) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 0.03 + s.p) * 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc((((s.x - cam * 0.02) % VIEW_W) + VIEW_W) % VIEW_W, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon
    const mx = 780 - cam * 0.03;
    const my = 92;
    drawGlow(ctx, pal.moon, mx, my, 140, 0.35);
    ctx.fillStyle = pal.moon;
    ctx.beginPath();
    ctx.arc(mx, my, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.arc(mx - 9, my - 6, 7, 0, Math.PI * 2);
    ctx.arc(mx + 10, my + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    // light rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pal.rays;
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 290 - cam * 0.08) % (VIEW_W + 300) + VIEW_W + 300) % (VIEW_W + 300) - 150;
      ctx.globalAlpha = 0.7 + Math.sin(t * 0.01 + i) * 0.3;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 70, 0);
      ctx.lineTo(rx + 260, VIEW_H);
      ctx.lineTo(rx + 120, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    for (const layer of art.layers) {
      const off = -((cam * layer.factor) % layer.width);
      for (let x = off; x < VIEW_W; x += layer.width) {
        ctx.drawImage(layer.canvas, x, layer.y, layer.width, layer.h);
      }
    }

    // mist
    const mist = ctx.createLinearGradient(0, VIEW_H - 200, 0, VIEW_H);
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(1, 'rgba(200,230,255,0.08)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, VIEW_H - 200, VIEW_W, 200);

    // ---- world ----
    ctx.save();
    ctx.translate(-Math.round(cam * 2) / 2, 0);

    // water in the pits
    const wg = ctx.createLinearGradient(0, GROUND_Y + 30, 0, VIEW_H);
    wg.addColorStop(0, pal.water[0]);
    wg.addColorStop(1, pal.water[1]);
    ctx.fillStyle = wg;
    ctx.fillRect(cam - 10, GROUND_Y + 34, VIEW_W + 20, VIEW_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      const y = GROUND_Y + 40 + row * 12;
      for (let x = Math.floor(cam / 20) * 20 - 20; x < cam + VIEW_W + 20; x += 20) {
        const yy = y + Math.sin(x * 0.05 + t * 0.05 + row) * 2;
        if (x === Math.floor(cam / 20) * 20 - 20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    for (const g of this.grounds) {
      if (g.rect.x + g.rect.w < cam - 20 || g.rect.x > cam + VIEW_W + 20) continue;
      ctx.drawImage(g.img, g.rect.x - g.pad, g.rect.y - g.pad, g.w, g.h);
    }

    drawShrine(ctx, this.level.goal, this.goalOpen, t);

    for (const th of this.level.thorns) drawThorns(ctx, th.x, th.w, t);
    for (const s of this.springs) drawMushroom(ctx, s.x, s.compress);
    for (const pl of this.plats) {
      if (pl.x + pl.w < cam - 20 || pl.x > cam + VIEW_W + 20) continue;
      drawPlatform(ctx, pl.def.kind, pl.x, pl.y, pl.w, this.level.theme);
    }

    for (const it of this.items) {
      if (it.taken || it.x < cam - 40 || it.x > cam + VIEW_W + 40) continue;
      const bob = Math.sin(t * 0.06 + it.phase) * 4;
      if (it.kind === 'heart') drawHeartItem(ctx, it.x, it.y + bob, t + it.phase * 10);
      else drawFlower(ctx, it.x, it.y + bob, t + it.phase * 10);
    }

    if (this.mode !== 'attract') drawPlayer(ctx, this.p, t);

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life));
      ctx.fillStyle = pt.color;
      if (pt.kind === 'heart') {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        heartPath(ctx, 0, 0, pt.size * pt.life + 2);
        ctx.fill();
        ctx.restore();
      } else if (pt.kind === 'petal') {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, pt.size, pt.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (pt.kind === 'dust') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1.6 - pt.life), 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawGlow(ctx, pt.color, pt.x, pt.y, pt.size * 3, ctx.globalAlpha);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // fireflies (screen space with parallax)
    for (const f of this.fireflies) {
      f.phase += f.speed;
      const fx = ((f.x + Math.sin(f.phase * 1.3) * 20 - cam * f.depth * 0.3) % VIEW_W + VIEW_W) % VIEW_W;
      const fy = f.y + Math.cos(f.phase) * 14;
      const a = 0.35 + Math.sin(f.phase * 3) * 0.35;
      drawGlow(ctx, f.color, fx, fy, 6 + f.depth * 6, Math.max(0, a));
    }

    ctx.drawImage(art.vignette, 0, 0, VIEW_W, VIEW_H);
  }
}
