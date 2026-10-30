import { GROUND_Y, VIEW_H, VIEW_W, type PlatformKind, type Theme } from './levels';

export interface Palette {
  sky: [string, string, string];
  moon: string;
  far: string;
  mid: string;
  near: string;
  grassTop: string;
  grass: string;
  earth: [string, string];
  water: [string, string];
  firefly: string[];
  rays: string;
}

export const PALETTES: Record<Theme, Palette> = {
  canopy: {
    sky: ['#0b2530', '#1f5a56', '#e9a46a'],
    moon: '#fff1c9',
    far: '#2c5f5a',
    mid: '#173f3b',
    near: '#0c2724',
    grassTop: '#8be07a',
    grass: '#3f9e58',
    earth: ['#5a3a26', '#2a1a12'],
    water: ['#1d5f6a', '#0b2730'],
    firefly: ['#fff3a8', '#c8ff9e', '#ffd27a'],
    rays: 'rgba(255, 214, 150, 0.07)',
  },
  ruins: {
    sky: ['#100d2b', '#2d2a63', '#8a76c2'],
    moon: '#f4f0ff',
    far: '#3a3572',
    mid: '#24214e',
    near: '#141231',
    grassTop: '#7fdcb6',
    grass: '#2f8a72',
    earth: ['#4a3d5e', '#1d1729'],
    water: ['#2e3f80', '#11163a'],
    firefly: ['#c9d6ff', '#a8fff0', '#ffd6f5'],
    rays: 'rgba(200, 190, 255, 0.06)',
  },
  lagoon: {
    sky: ['#0a0d29', '#232a66', '#d0729c'],
    moon: '#ffe8f2',
    far: '#3b336f',
    mid: '#221e4c',
    near: '#120f2e',
    grassTop: '#8ff0c4',
    grass: '#3aa585',
    earth: ['#4b3350', '#1c1222'],
    water: ['#2b5a9a', '#0e1840'],
    firefly: ['#ffd1ec', '#fff3a8', '#a8e9ff'],
    rays: 'rgba(255, 190, 220, 0.07)',
  },
};

export function makeCanvas(w: number, h: number, scale: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * scale));
  c.height = Math.max(1, Math.ceil(h * scale));
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  return { canvas: c, ctx: g };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = s;
  const h = s * 0.9;
  const top = y - h * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, top + h * 0.3);
  ctx.bezierCurveTo(x, top, x - w / 2, top, x - w / 2, top + h * 0.3);
  ctx.bezierCurveTo(x - w / 2, top + h * 0.6, x, top + h * 0.78, x, top + h);
  ctx.bezierCurveTo(x, top + h * 0.78, x + w / 2, top + h * 0.6, x + w / 2, top + h * 0.3);
  ctx.bezierCurveTo(x + w / 2, top, x, top, x, top + h * 0.3);
  ctx.closePath();
}

const glowCache = new Map<string, HTMLCanvasElement>();
export function glow(color: string) {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + '88');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return c;
}

export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// ---------- Static background layers ----------

export interface ThemeArt {
  sky: HTMLCanvasElement;
  layers: { canvas: HTMLCanvasElement; width: number; factor: number; y: number; h: number }[];
  vignette: HTMLCanvasElement;
  stars: { x: number; y: number; r: number; p: number }[];
}

const TILE = 1920;

function periodic(x: number, terms: [number, number, number][]) {
  let v = 0;
  for (const [k, a, ph] of terms) v += a * Math.sin((Math.PI * 2 * k * x) / TILE + ph);
  return v;
}

function drawHills(ctx: CanvasRenderingContext2D, color: string, base: number, terms: [number, number, number][], h: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= TILE; x += 8) ctx.lineTo(x, base + periodic(x, terms));
  ctx.lineTo(TILE, h);
  ctx.closePath();
  ctx.fill();
}

function wrapDraw(fn: (ox: number) => void) {
  fn(0);
  fn(-TILE);
  fn(TILE);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, height: number, size: number, rand: () => number) {
  const top = groundY - height;
  ctx.fillRect(x - size * 0.08, top + size * 0.3, size * 0.16, height);
  const blobs = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 0.45, top + Math.sin(a) * size * 0.28, size * (0.38 + rand() * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, top, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, groundY: number, height: number, lean: number) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x + lean * 0.3, groundY - height * 0.6, x + lean, groundY - height);
  ctx.stroke();
  const tx = x + lean;
  const ty = groundY - height;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (i % 2 ? 0.15 : -0.1);
    const len = 70 + (i % 3) * 14;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + 34;
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.6 - 12, ex, ey);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.45 + 6, tx, ty);
    ctx.fill();
  }
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, w: number, broken: boolean) {
  ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillRect(x - w / 2 - 6, groundY - h - 10, w + 12, 12);
  if (!broken) ctx.fillRect(x - w / 2 - 10, groundY - h - 22, w + 20, 12);
}

function drawTemple(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, steps: number) {
  const stepH = 26;
  for (let i = 0; i < steps; i++) {
    const sw = w - i * (w / (steps + 1));
    ctx.fillRect(x - sw / 2, groundY - (i + 1) * stepH, sw, stepH + 1);
  }
  const topW = w / (steps + 1);
  ctx.fillRect(x - topW / 2, groundY - steps * stepH - 30, topW, 30);
}

export function buildThemeArt(theme: Theme, scale: number): ThemeArt {
  const pal = PALETTES[theme];
  const rand = rng(theme.length * 977 + 13);

  const sky = makeCanvas(VIEW_W, VIEW_H, scale);
  {
    const g = sky.ctx;
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.sky[0]);
    grad.addColorStop(0.55, pal.sky[1]);
    grad.addColorStop(1, pal.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  const stars = Array.from({ length: theme === 'canopy' ? 40 : 110 }, () => ({
    x: rand() * VIEW_W,
    y: rand() * VIEW_H * 0.55,
    r: 0.5 + rand() * 1.3,
    p: rand() * Math.PI * 2,
  }));

  // Far layer: soft hills / mountains / ruins
  const farH = 340;
  const far = makeCanvas(TILE, farH, scale);
  {
    const g = far.ctx;
    drawHills(g, pal.far, 170, [[2, 40, 0.3], [5, 18, 1.2], [9, 8, 2.1]], farH);
    g.fillStyle = pal.far;
    if (theme === 'ruins') {
      wrapDraw(ox => {
        drawTemple(g, 420 + ox, 200, 280, 5);
        drawTemple(g, 1340 + ox, 195, 220, 4);
      });
    } else {
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * TILE + rand() * 40;
        const base = 170 + periodic(x, [[2, 40, 0.3], [5, 18, 1.2], [9, 8, 2.1]]) + 10;
        wrapDraw(ox => drawTree(g, x + ox, base, 40 + rand() * 30, 34 + rand() * 18, rand));
      }
    }
  }

  // Mid layer: trees / pillars
  const midH = 380;
  const mid = makeCanvas(TILE, midH, scale);
  {
    const g = mid.ctx;
    drawHills(g, pal.mid, 290, [[3, 22, 2.0], [7, 10, 0.4]], midH);
    g.fillStyle = pal.mid;
    g.strokeStyle = pal.mid;
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * TILE + rand() * 60;
      const base = 300;
      const kind = theme === 'ruins' && i % 3 === 0 ? 'pillar' : theme === 'lagoon' && i % 2 === 0 ? 'palm' : 'tree';
      wrapDraw(ox => {
        if (kind === 'pillar') drawPillar(g, x + ox, base, 120 + rand() * 80, 30, rand() > 0.5);
        else if (kind === 'palm') drawPalm(g, x + ox, base, 150 + rand() * 60, (rand() - 0.5) * 80);
        else drawTree(g, x + ox, base, 120 + rand() * 90, 60 + rand() * 30, rand);
      });
    }
  }

  // Near layer: big foliage
  const nearH = 300;
  const near = makeCanvas(TILE, nearH, scale);
  {
    const g = near.ctx;
    drawHills(g, pal.near, 240, [[4, 16, 1.0], [11, 6, 0.2]], nearH);
    g.fillStyle = pal.near;
    g.strokeStyle = pal.near;
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * TILE + rand() * 80;
      wrapDraw(ox => {
        if (theme === 'lagoon' || i % 3 === 0) drawPalm(g, x + ox, 250, 140 + rand() * 50, (rand() - 0.5) * 100);
        else drawTree(g, x + ox, 250, 130 + rand() * 60, 80 + rand() * 30, rand);
      });
    }
    // ferns
    for (let i = 0; i < 40; i++) {
      const x = rand() * TILE;
      const s = 20 + rand() * 30;
      wrapDraw(ox => {
        g.beginPath();
        g.ellipse(x + ox, 250, s, s * 0.45, -0.4 + rand() * 0.8, 0, Math.PI * 2);
        g.fill();
      });
    }
  }

  const vignette = makeCanvas(VIEW_W, VIEW_H, 1);
  {
    const g = vignette.ctx;
    const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.45, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.5, VIEW_W * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  return {
    sky: sky.canvas,
    stars,
    vignette: vignette.canvas,
    layers: [
      { canvas: far.canvas, width: TILE, factor: 0.12, y: VIEW_H - farH - 40, h: farH },
      { canvas: mid.canvas, width: TILE, factor: 0.3, y: VIEW_H - midH + 10, h: midH },
      { canvas: near.canvas, width: TILE, factor: 0.55, y: VIEW_H - nearH + 60, h: nearH },
    ],
  };
}

// ---------- World pieces ----------

export function buildGroundSegment(theme: Theme, w: number, scale: number, seed: number) {
  const pal = PALETTES[theme];
  const h = VIEW_H - GROUND_Y + 20;
  const pad = 10;
  const { canvas, ctx } = makeCanvas(w + pad * 2, h + pad, scale);
  const rand = rng(seed);
  ctx.translate(pad, pad);

  const earth = ctx.createLinearGradient(0, 0, 0, h);
  earth.addColorStop(0, pal.earth[0]);
  earth.addColorStop(1, pal.earth[1]);
  ctx.fillStyle = earth;
  rrect(ctx, 0, 0, w, h + 20, 14);
  ctx.fill();

  // pebbles
  for (let i = 0; i < w / 18; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(8 + rand() * (w - 16), 22 + rand() * (h - 20), 3 + rand() * 6, 2 + rand() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // grass lip
  ctx.fillStyle = pal.grass;
  rrect(ctx, -2, -4, w + 4, 16, 8);
  ctx.fill();
  ctx.fillStyle = pal.grassTop;
  rrect(ctx, -2, -6, w + 4, 8, 4);
  ctx.fill();
  // drips
  ctx.fillStyle = pal.grass;
  for (let x = 6; x < w - 6; x += 14 + rand() * 18) {
    const dh = 6 + rand() * 10;
    ctx.beginPath();
    ctx.ellipse(x, 10, 5, dh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // blades
  ctx.strokeStyle = pal.grassTop;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let x = 3; x < w - 3; x += 5 + rand() * 6) {
    const bh = 4 + rand() * 8;
    ctx.beginPath();
    ctx.moveTo(x, -4);
    ctx.lineTo(x + (rand() - 0.5) * 5, -4 - bh);
    ctx.stroke();
  }
  return { canvas, pad, w: w + pad * 2, h: h + pad };
}

export function drawPlatform(ctx: CanvasRenderingContext2D, kind: PlatformKind, x: number, y: number, w: number, theme: Theme) {
  const pal = PALETTES[theme];
  const h = 18;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rrect(ctx, x + 4, y + 8, w - 4, h, 8);
  ctx.fill();

  if (kind === 'wood') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#c98a52');
    g.addColorStop(1, '#7a4a28');
    ctx.fillStyle = g;
    rrect(ctx, x, y, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,35,15,0.55)';
    ctx.lineWidth = 1.5;
    for (let px = x + 22; px < x + w - 8; px += 24) {
      ctx.beginPath();
      ctx.moveTo(px, y + 3);
      ctx.lineTo(px, y + h - 3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,230,190,0.35)';
    rrect(ctx, x + 4, y + 2, w - 8, 4, 2);
    ctx.fill();
    // rope ties
    ctx.fillStyle = '#e8d3a2';
    ctx.fillRect(x + 8, y - 1, 4, h + 2);
    ctx.fillRect(x + w - 12, y - 1, 4, h + 2);
  } else if (kind === 'stone') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#9aa3c4');
    g.addColorStop(1, '#545a7a');
    ctx.fillStyle = g;
    rrect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,60,0.35)';
    ctx.lineWidth = 1.5;
    for (let px = x + 30; px < x + w - 10; px += 34) {
      ctx.beginPath();
      ctx.moveTo(px, y + 2);
      ctx.lineTo(px - 4, y + h - 2);
      ctx.stroke();
    }
    ctx.fillStyle = pal.grass;
    rrect(ctx, x - 1, y - 3, w + 2, 7, 4);
    ctx.fill();
    ctx.fillStyle = pal.grassTop;
    for (let px = x + 6; px < x + w - 6; px += 16) {
      ctx.beginPath();
      ctx.ellipse(px, y + 4, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#7fe08a');
    g.addColorStop(1, '#2f8f4e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.2, y - 6, x + w * 0.5, y);
    ctx.quadraticCurveTo(x + w * 0.85, y - 6, x + w + 8, y + h * 0.4);
    ctx.quadraticCurveTo(x + w * 0.6, y + h + 6, x + w * 0.4, y + h);
    ctx.quadraticCurveTo(x + w * 0.1, y + h + 4, x - 6, y + h * 0.45);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,210,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.45);
    ctx.lineTo(x + w, y + h * 0.4);
    ctx.stroke();
    for (let px = x + 14; px < x + w - 8; px += 16) {
      ctx.beginPath();
      ctx.moveTo(px, y + h * 0.44);
      ctx.lineTo(px + 8, y + 2);
      ctx.moveTo(px, y + h * 0.44);
      ctx.lineTo(px + 8, y + h - 2);
      ctx.stroke();
    }
  }
}

export function drawThorns(ctx: CanvasRenderingContext2D, x: number, w: number, t: number) {
  const base = GROUND_Y - 4;
  ctx.fillStyle = '#3a1f3f';
  ctx.beginPath();
  ctx.moveTo(x, base);
  const n = Math.max(3, Math.floor(w / 12));
  for (let i = 0; i <= n; i++) {
    const px = x + (i / n) * w;
    const tip = i % 2 === 0 ? 14 : 22;
    ctx.lineTo(px - w / n / 2, base);
    ctx.lineTo(px, base - tip);
  }
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i <= n; i += 2) {
    const px = x + (i / n) * w;
    drawGlow(ctx, '#ff5f9e', px, base - 14, 6, 0.6 + Math.sin(t * 0.08 + i) * 0.3);
  }
}

export function drawMushroom(ctx: CanvasRenderingContext2D, x: number, compress: number) {
  const base = GROUND_Y - 2;
  const squish = 1 - compress * 0.35;
  ctx.fillStyle = '#f3e3c8';
  rrect(ctx, x + 12, base - 18 * squish, 14, 18 * squish, 5);
  ctx.fill();
  const capY = base - 18 * squish;
  const cw = 26 * (1 + compress * 0.2);
  const g = ctx.createLinearGradient(0, capY - 18, 0, capY);
  g.addColorStop(0, '#ff8ac2');
  g.addColorStop(1, '#d9407e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + 19, capY, cw, 16 * squish, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [dx, dy, r] of [[-12, -6, 3.5], [0, -11, 4], [11, -5, 3]] as const) {
    ctx.beginPath();
    ctx.arc(x + 19 + dx, capY + dy * squish, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawGlow(ctx, '#ff8ac2', x + 19, capY - 6, 30, 0.25);
}

export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.04) * 0.25);
  drawGlow(ctx, '#ffd36e', 0, 0, 22, 0.45);
  ctx.fillStyle = '#ffd36e';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 3.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHeartItem(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const pulse = 1 + Math.sin(t * 0.1) * 0.08;
  drawGlow(ctx, '#ff4f93', x, y, 34 * pulse, 0.7);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, '#ff9ac4');
  g.addColorStop(1, '#e8336f');
  ctx.fillStyle = g;
  heartPath(ctx, 0, 0, 26);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-6, -5, 3.5, 2.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawShrine(ctx: CanvasRenderingContext2D, cx: number, open: boolean, t: number) {
  const base = GROUND_Y;
  const w = 120;
  const h = 150;
  if (open) {
    const beam = ctx.createLinearGradient(0, base - 520, 0, base);
    beam.addColorStop(0, 'rgba(255,170,210,0)');
    beam.addColorStop(1, 'rgba(255,170,210,0.35)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - 34, base - 520, 68, 520);
  }
  // pillars
  const sg = ctx.createLinearGradient(0, base - h, 0, base);
  sg.addColorStop(0, '#b7b9d6');
  sg.addColorStop(1, '#5d6083');
  ctx.fillStyle = sg;
  rrect(ctx, cx - w / 2, base - h + 20, 24, h - 20, 4);
  ctx.fill();
  rrect(ctx, cx + w / 2 - 24, base - h + 20, 24, h - 20, 4);
  ctx.fill();
  // arch
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 8, base - h + 28);
  ctx.quadraticCurveTo(cx, base - h - 40, cx + w / 2 + 8, base - h + 28);
  ctx.lineTo(cx + w / 2 + 8, base - h + 44);
  ctx.quadraticCurveTo(cx, base - h - 20, cx - w / 2 - 8, base - h + 44);
  ctx.closePath();
  ctx.fill();
  // vines
  ctx.strokeStyle = '#3f9e58';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + 4, base - h + 30);
  ctx.bezierCurveTo(cx - w / 2 + 20, base - h + 70, cx - w / 2 - 6, base - h + 100, cx - w / 2 + 12, base - 20);
  ctx.moveTo(cx + w / 2 - 4, base - h + 30);
  ctx.bezierCurveTo(cx + w / 2 - 22, base - h + 60, cx + w / 2 + 4, base - h + 110, cx + w / 2 - 14, base - 30);
  ctx.stroke();
  ctx.fillStyle = '#6fd07a';
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(cx + side * (w / 2 - 8), base - h + 40 + i * 18, 5, 3, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // heart seal
  const hy = base - h + 50 + Math.sin(t * 0.05) * 4;
  if (open) {
    drawGlow(ctx, '#ff6fa8', cx, hy, 80, 0.9);
    ctx.fillStyle = '#ff7fb2';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
  }
  heartPath(ctx, cx, hy, 34);
  ctx.fill();
  if (!open) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    heartPath(ctx, cx, hy, 34);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // steps
  ctx.fillStyle = '#6d7096';
  rrect(ctx, cx - w / 2 - 14, base - 10, w + 28, 12, 4);
  ctx.fill();
}

export interface PlayerLook {
  x: number;
  y: number;
  w: number;
  h: number;
  facing: number;
  squash: number;
  walk: number;
  onGround: boolean;
  vy: number;
  blink: number;
  flash: number;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerLook, t: number) {
  if (p.flash > 0 && Math.floor(p.flash / 4) % 2 === 0) return;
  const cx = p.x + p.w / 2;
  const by = p.y + p.h;
  const moving = Math.abs(p.walk) > 0;
  const bob = p.onGround && moving ? Math.abs(Math.sin(p.walk * 0.3)) * 2 : Math.sin(t * 0.06) * 0.8;

  // shadow
  if (p.onGround) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, by + 1, 14, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGlow(ctx, '#b7ff9a', cx, by - 16, 40, 0.25);

  ctx.save();
  ctx.translate(cx, by);
  const sx = 1 + p.squash * 0.25;
  const sy = 1 - p.squash * 0.25;
  ctx.scale(sx * p.facing, sy);
  ctx.translate(0, -bob);

  // feet
  const step = p.onGround && moving ? Math.sin(p.walk * 0.3) * 4 : 0;
  ctx.fillStyle = '#2f8a4a';
  ctx.beginPath();
  ctx.ellipse(-6 + step, -2, 5.5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(6 - step, -2, 5.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  const bg = ctx.createRadialGradient(-5, -24, 3, 0, -16, 20);
  bg.addColorStop(0, '#c4f7a6');
  bg.addColorStop(0.6, '#6fd26a');
  bg.addColorStop(1, '#3a9f52');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, -16, 16, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // belly
  ctx.fillStyle = 'rgba(255,255,230,0.55)';
  ctx.beginPath();
  ctx.ellipse(2, -10, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // sprout
  const sway = Math.sin(t * 0.08) * 0.25 - p.vy * 0.03;
  ctx.save();
  ctx.translate(0, -30);
  ctx.rotate(sway);
  ctx.strokeStyle = '#3a9f52';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -7);
  ctx.stroke();
  ctx.fillStyle = '#8be07a';
  ctx.beginPath();
  ctx.ellipse(-5, -9, 6, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff7fb2';
  heartPath(ctx, 5, -10, 9);
  ctx.fill();
  ctx.restore();

  // eyes
  const blinking = p.blink < 6;
  ctx.fillStyle = '#1c2a22';
  if (blinking) {
    ctx.fillRect(1, -20, 6, 1.6);
    ctx.fillRect(9, -20, 5, 1.6);
  } else {
    ctx.beginPath();
    ctx.ellipse(4, -19, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(11.5, -19, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(5, -20.5, 1.2, 0, Math.PI * 2);
    ctx.arc(12.3, -20.5, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,160,0.55)';
  ctx.beginPath();
  ctx.ellipse(-1, -13, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(14, -13, 2.5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // mouth
  ctx.strokeStyle = '#1c2a22';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (!p.onGround) ctx.ellipse(8, -12, 1.8, 2.2, 0, 0, Math.PI * 2);
  else ctx.arc(8, -14, 2.6, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}
