import { useState, useEffect, useRef, useCallback } from 'react';

// Game constants
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 4.5;
const CANVAS_W = 800;
const CANVAS_H = 530;

// Types
interface Vec2 { x: number; y: number; }

interface Collectible {
  x: number; y: number;
  collected: boolean;
  type: 'flower' | 'gem' | 'star';
  phase: number;
}

interface Platform {
  x: number; y: number;
  width: number; height: number;
  type: 'log' | 'leaf' | 'stone' | 'moss';
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; color: string;
  size: number; type: 'spark' | 'leaf' | 'firefly';
}

interface BgTree {
  x: number; y: number;
  height: number; width: number;
  layer: number; // 0=far, 1=mid, 2=near
  type: number;
}

interface Vine {
  x: number; y: number;
  length: number; sway: number;
}

interface Firefly {
  x: number; y: number;
  phase: number; speed: number;
  radius: number;
}

type GameState = 'menu' | 'playing' | 'levelComplete' | 'finale';

// Character state
interface CharState {
  x: number; y: number;
  vx: number; vy: number;
  onGround: boolean;
  facing: number; // 1=right, -1=left
  walkFrame: number;
  jumpSquash: number;
}

// Level data - Jungle themed with proper spacing
const levels = [
  {
    name: "🌿 The Jungle Path",
    message: "Collect the golden flowers to show your love...",
    bg: { sky1: '#0a2e1a', sky2: '#1a4a2e', sky3: '#0d3320' },
    platforms: [
      { x: 0, y: 480, width: 800, height: 50, type: 'moss' as const },
      { x: 100, y: 400, width: 120, height: 20, type: 'log' as const },
      { x: 260, y: 350, width: 120, height: 20, type: 'leaf' as const },
      { x: 420, y: 300, width: 120, height: 20, type: 'log' as const },
      { x: 580, y: 350, width: 120, height: 20, type: 'stone' as const },
      { x: 350, y: 220, width: 140, height: 20, type: 'leaf' as const },
      { x: 150, y: 250, width: 100, height: 20, type: 'stone' as const },
    ],
    collectibles: [
      { x: 160, y: 365, type: 'flower' as const },
      { x: 320, y: 315, type: 'flower' as const },
      { x: 480, y: 265, type: 'flower' as const },
      { x: 640, y: 315, type: 'gem' as const },
      { x: 420, y: 185, type: 'star' as const },
      { x: 200, y: 215, type: 'flower' as const },
    ],
    playerStart: { x: 50, y: 430 },
  },
  {
    name: "🌺 Ancient Ruins",
    message: "Your love grows deeper in this sacred place...",
    bg: { sky1: '#1a0a2e', sky2: '#2d1a4a', sky3: '#1a0d33' },
    platforms: [
      { x: 0, y: 480, width: 200, height: 50, type: 'stone' as const },
      { x: 240, y: 420, width: 120, height: 20, type: 'moss' as const },
      { x: 400, y: 370, width: 120, height: 20, type: 'stone' as const },
      { x: 560, y: 420, width: 120, height: 20, type: 'log' as const },
      { x: 680, y: 360, width: 120, height: 20, type: 'moss' as const },
      { x: 520, y: 280, width: 120, height: 20, type: 'leaf' as const },
      { x: 340, y: 230, width: 120, height: 20, type: 'stone' as const },
      { x: 140, y: 280, width: 120, height: 20, type: 'log' as const },
      { x: 140, y: 180, width: 120, height: 20, type: 'moss' as const },
      { x: 360, y: 130, width: 140, height: 20, type: 'stone' as const },
    ],
    collectibles: [
      { x: 300, y: 385, type: 'flower' as const },
      { x: 460, y: 335, type: 'flower' as const },
      { x: 620, y: 385, type: 'flower' as const },
      { x: 740, y: 325, type: 'gem' as const },
      { x: 580, y: 245, type: 'flower' as const },
      { x: 400, y: 195, type: 'star' as const },
      { x: 200, y: 245, type: 'flower' as const },
      { x: 200, y: 145, type: 'gem' as const },
      { x: 430, y: 95, type: 'star' as const },
    ],
    playerStart: { x: 50, y: 430 },
  },
  {
    name: "🌟 The Heart of the Jungle",
    message: "Every step brings us closer to forever...",
    bg: { sky1: '#0a1e2e', sky2: '#1a3a4a', sky3: '#0d2533' },
    platforms: [
      { x: 0, y: 480, width: 160, height: 50, type: 'moss' as const },
      { x: 180, y: 420, width: 100, height: 20, type: 'leaf' as const },
      { x: 320, y: 370, width: 100, height: 20, type: 'log' as const },
      { x: 460, y: 420, width: 100, height: 20, type: 'leaf' as const },
      { x: 600, y: 360, width: 100, height: 20, type: 'stone' as const },
      { x: 700, y: 300, width: 100, height: 20, type: 'moss' as const },
      { x: 540, y: 250, width: 100, height: 20, type: 'leaf' as const },
      { x: 380, y: 200, width: 100, height: 20, type: 'log' as const },
      { x: 220, y: 250, width: 100, height: 20, type: 'stone' as const },
      { x: 80, y: 300, width: 100, height: 20, type: 'leaf' as const },
      { x: 80, y: 190, width: 110, height: 20, type: 'moss' as const },
      { x: 260, y: 140, width: 120, height: 20, type: 'stone' as const },
      { x: 460, y: 140, width: 120, height: 20, type: 'stone' as const },
      { x: 350, y: 70, width: 120, height: 20, type: 'moss' as const },
    ],
    collectibles: [
      { x: 230, y: 385, type: 'flower' as const },
      { x: 370, y: 335, type: 'flower' as const },
      { x: 510, y: 385, type: 'flower' as const },
      { x: 650, y: 325, type: 'gem' as const },
      { x: 750, y: 265, type: 'flower' as const },
      { x: 590, y: 215, type: 'flower' as const },
      { x: 430, y: 165, type: 'star' as const },
      { x: 270, y: 215, type: 'flower' as const },
      { x: 130, y: 265, type: 'gem' as const },
      { x: 135, y: 155, type: 'flower' as const },
      { x: 320, y: 105, type: 'star' as const },
      { x: 520, y: 105, type: 'star' as const },
      { x: 410, y: 35, type: 'star' as const },
    ],
    playerStart: { x: 50, y: 430 },
  },
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [showMessage, setShowMessage] = useState('');

  // Game refs
  const charRef = useRef<CharState>({
    x: 60, y: 430, vx: 0, vy: 0,
    onGround: false, facing: 1, walkFrame: 0, jumpSquash: 0,
  });
  const collectiblesRef = useRef<Collectible[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bgTreesRef = useRef<BgTree[]>([]);
  const vinesRef = useRef<Vine[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ left: false, right: false, jump: false });
  const animRef = useRef<number>(0);
  const collectedCountRef = useRef(0);
  const totalCollectiblesRef = useRef(0);
  const timeRef = useRef(0);

  // Generate background elements
  const generateBackground = useCallback((levelIdx: number) => {
    const trees: BgTree[] = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = layer === 0 ? 8 : layer === 1 ? 6 : 4;
      for (let i = 0; i < count; i++) {
        trees.push({
          x: (i / count) * CANVAS_W + Math.random() * 80 - 40,
          y: CANVAS_H,
          height: 200 + Math.random() * 200 + layer * 50,
          width: 40 + Math.random() * 30 + layer * 10,
          layer,
          type: Math.floor(Math.random() * 3),
        });
      }
    }
    bgTreesRef.current = trees;

    const vines: Vine[] = [];
    for (let i = 0; i < 12; i++) {
      vines.push({
        x: Math.random() * CANVAS_W,
        y: 0,
        length: 60 + Math.random() * 120,
        sway: Math.random() * Math.PI * 2,
      });
    }
    vinesRef.current = vines;

    const fireflies: Firefly[] = [];
    for (let i = 0; i < 25; i++) {
      fireflies.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
        radius: 2 + Math.random() * 3,
      });
    }
    firefliesRef.current = fireflies;
  }, []);

  // Load level
  const loadLevel = useCallback((idx: number) => {
    const level = levels[idx];
    charRef.current = {
      x: level.playerStart.x, y: level.playerStart.y,
      vx: 0, vy: 0, onGround: false, facing: 1, walkFrame: 0, jumpSquash: 0,
    };
    collectiblesRef.current = level.collectibles.map(c => ({
      ...c, collected: false, phase: Math.random() * Math.PI * 2,
    }));
    particlesRef.current = [];
    collectedCountRef.current = 0;
    totalCollectiblesRef.current = level.collectibles.length;
    generateBackground(idx);
    setShowMessage(level.message);
    setTimeout(() => setShowMessage(''), 3500);
  }, [generateBackground]);

  const startGame = () => {
    setCurrentLevel(0);
    loadLevel(0);
    setGameState('playing');
  };

  const nextLevel = () => {
    if (currentLevel < levels.length - 1) {
      const next = currentLevel + 1;
      setCurrentLevel(next);
      loadLevel(next);
      setGameState('playing');
    } else {
      setGameState('finale');
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, type: 'spark' | 'leaf' | 'firefly' = 'spark') => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 1,
        color,
        size: Math.random() * 5 + 2,
        type,
      });
    }
  };

  // ===== DRAWING FUNCTIONS =====

  const drawJungleBg = (ctx: CanvasRenderingContext2D, time: number, levelIdx: number) => {
    const level = levels[levelIdx];
    const { sky1, sky2, sky3 } = level.bg;

    // Sky gradient with more depth
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, sky1);
    grad.addColorStop(0.4, sky2);
    grad.addColorStop(0.8, sky3);
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Atmospheric fog layers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, CANVAS_H * 0.3, CANVAS_W, CANVAS_H * 0.2);

    // Moon/sun glow
    const moonX = 650;
    const moonY = 80;
    const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 100);
    moonGrad.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    moonGrad.addColorStop(0.5, 'rgba(255, 255, 150, 0.1)');
    moonGrad.addColorStop(1, 'rgba(255, 255, 100, 0)');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(moonX - 100, moonY - 100, 200, 200);

    // Moon
    ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, Math.max(0.1, 25), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sky1;
    ctx.beginPath();
    ctx.arc(moonX + 8, moonY - 5, Math.max(0.1, 20), 0, Math.PI * 2);
    ctx.fill();

    // Background trees (far layer)
    bgTreesRef.current
      .filter(t => t.layer === 0)
      .forEach(tree => {
        const alpha = 0.3;
        ctx.fillStyle = `rgba(10, 60, 30, ${alpha})`;
        // Trunk
        ctx.fillRect(tree.x - 5, tree.y - tree.height * 0.6, 10, tree.height * 0.6);
        // Canopy
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - tree.height * 0.6, Math.max(0.1, tree.width * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.x - 15, tree.y - tree.height * 0.5, Math.max(0.1, tree.width * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.x + 15, tree.y - tree.height * 0.5, Math.max(0.1, tree.width * 0.6), 0, Math.PI * 2);
        ctx.fill();
      });

    // Mid layer trees
    bgTreesRef.current
      .filter(t => t.layer === 1)
      .forEach(tree => {
        const alpha = 0.5;
        ctx.fillStyle = `rgba(15, 80, 40, ${alpha})`;
        ctx.fillRect(tree.x - 7, tree.y - tree.height * 0.5, 14, tree.height * 0.5);
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - tree.height * 0.55, Math.max(0.1, tree.width * 0.9), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.x - 20, tree.y - tree.height * 0.4, Math.max(0.1, tree.width * 0.7), 0, Math.PI * 2);
        ctx.fill();
      });

    // Vines
    vinesRef.current.forEach(vine => {
      vine.sway += 0.02;
      const swayX = Math.sin(vine.sway) * 8;
      ctx.strokeStyle = 'rgba(30, 120, 50, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vine.x, vine.y);
      ctx.quadraticCurveTo(vine.x + swayX, vine.y + vine.length * 0.5, vine.x + swayX * 0.5, vine.y + vine.length);
      ctx.stroke();
      // Leaf at end
      ctx.fillStyle = 'rgba(40, 150, 60, 0.7)';
      ctx.beginPath();
      ctx.ellipse(vine.x + swayX * 0.5, vine.y + vine.length, Math.max(0.1, 5), Math.max(0.1, 8), swayX * 0.05, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fireflies
    firefliesRef.current.forEach(ff => {
      ff.phase += ff.speed;
      ff.x += Math.sin(ff.phase * 1.3) * 0.3;
      ff.y += Math.cos(ff.phase) * 0.2;
      if (ff.x < 0) ff.x = CANVAS_W;
      if (ff.x > CANVAS_W) ff.x = 0;
      if (ff.y < 0) ff.y = CANVAS_H;
      if (ff.y > CANVAS_H) ff.y = 0;

      const brightness = 0.3 + Math.sin(ff.phase * 3) * 0.3;
      ctx.save();
      ctx.shadowColor = `rgba(200, 255, 100, ${brightness})`;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(200, 255, 100, ${brightness})`;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, Math.max(0.1, ff.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  const drawPlatform = (ctx: CanvasRenderingContext2D, plat: Platform, time: number) => {
    const { x, y, width, height, type } = plat;

    ctx.save();
    
    // Add subtle shadow under platform
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 3, width / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    switch (type) {
      case 'log': {
        // Wooden log with better gradient
        const logGrad = ctx.createLinearGradient(x, y, x, y + height);
        logGrad.addColorStop(0, '#A0724A');
        logGrad.addColorStop(0.2, '#8B5E3C');
        logGrad.addColorStop(0.5, '#6B3E26');
        logGrad.addColorStop(0.8, '#5A3420');
        logGrad.addColorStop(1, '#4A2A18');
        ctx.fillStyle = logGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fill();
        
        // Wood grain with better detail
        ctx.strokeStyle = 'rgba(90, 50, 20, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          const waveOffset = Math.sin(i * 1.5) * 2;
          ctx.moveTo(x + 8, y + 3 + i * 4 + waveOffset);
          ctx.quadraticCurveTo(x + width / 2, y + 3 + i * 4 - waveOffset, x + width - 8, y + 3 + i * 4 + waveOffset);
          ctx.stroke();
        }
        
        // Highlight on top
        ctx.fillStyle = 'rgba(255, 200, 150, 0.2)';
        ctx.beginPath();
        ctx.roundRect(x + 5, y + 2, width - 10, 3, 2);
        ctx.fill();
        
        // Moss on top with better detail
        ctx.fillStyle = '#3d9a5e';
        for (let i = 0; i < width; i += 6) {
          const mh = Math.max(0.1, 4 + Math.sin(i * 0.3 + time * 0.02) * 2);
          ctx.beginPath();
          ctx.arc(x + i, y, mh, Math.PI, 0);
          ctx.fill();
        }
        
        // Moss highlight
        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        for (let i = 0; i < width; i += 12) {
          ctx.beginPath();
          ctx.arc(x + i, y - 1, 2, Math.PI, 0);
          ctx.fill();
        }
        break;
      }
      case 'leaf': {
        // Giant leaf platform with better gradient
        const leafGrad = ctx.createRadialGradient(
          x + width / 2, y + height / 2, 0,
          x + width / 2, y + height / 2, width / 2
        );
        leafGrad.addColorStop(0, '#5CD89A');
        leafGrad.addColorStop(0.5, '#3CB371');
        leafGrad.addColorStop(1, '#228B22');
        ctx.fillStyle = leafGrad;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, Math.max(0.1, width / 2), Math.max(0.1, height), 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Leaf veins with better detail
        ctx.strokeStyle = 'rgba(0, 80, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + height / 2);
        ctx.lineTo(x + width - 10, y + height / 2);
        ctx.stroke();
        
        // Side veins
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const vx = x + 20 + i * (width - 40) / 5;
          ctx.beginPath();
          ctx.moveTo(vx, y + height / 2);
          ctx.lineTo(vx + 5, y + height - 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(vx, y + height / 2);
          ctx.lineTo(vx + 5, y + 2);
          ctx.stroke();
        }
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x + width / 3, y + height / 3, width / 4, height / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowColor = '#5CD89A';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(92, 216, 154, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, Math.max(0.1, width / 2), Math.max(0.1, height), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'stone': {
        // Ancient stone with better gradient
        const stoneGrad = ctx.createLinearGradient(x, y, x, y + height);
        stoneGrad.addColorStop(0, '#8a8a8a');
        stoneGrad.addColorStop(0.3, '#6a6a6a');
        stoneGrad.addColorStop(0.7, '#4a4a4a');
        stoneGrad.addColorStop(1, '#3a3a3a');
        ctx.fillStyle = stoneGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 6);
        ctx.fill();
        
        // Stone texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = 0; i < 5; i++) {
          const tx = x + 10 + i * (width - 20) / 5;
          const ty = y + 5 + Math.sin(i * 2) * 3;
          ctx.beginPath();
          ctx.arc(tx, ty, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Cracks with better detail
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + width * 0.3, y);
        ctx.lineTo(x + width * 0.32, y + height * 0.5);
        ctx.lineTo(x + width * 0.35, y + height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + width * 0.7, y);
        ctx.lineTo(x + width * 0.68, y + height * 0.6);
        ctx.lineTo(x + width * 0.65, y + height);
        ctx.stroke();
        
        // Highlight on top
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 2, width - 6, 3, 2);
        ctx.fill();
        
        // Glowing runes with better effect
        const runeGlow = 0.4 + Math.sin(time * 0.05) * 0.3;
        ctx.save();
        ctx.shadowColor = `rgba(100, 255, 150, ${runeGlow})`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(100, 255, 150, ${runeGlow})`;
        ctx.font = 'bold 10px serif';
        ctx.fillText('✦', x + width * 0.5 - 5, y + height - 4);
        ctx.restore();
        break;
      }
      case 'moss': {
        // Mossy ground with better gradient
        const mossGrad = ctx.createLinearGradient(x, y, x, y + height);
        mossGrad.addColorStop(0, '#3d8b5f');
        mossGrad.addColorStop(0.1, '#2d6b3f');
        mossGrad.addColorStop(0.4, '#1a4a2e');
        mossGrad.addColorStop(1, '#0d2e1a');
        ctx.fillStyle = mossGrad;
        ctx.fillRect(x, y, width, height);
        
        // Grass on top with better detail
        ctx.fillStyle = '#5CBF70';
        for (let i = 0; i < width; i += 4) {
          const gh = 5 + Math.sin(i * 0.5 + time * 0.03) * 3;
          ctx.beginPath();
          ctx.moveTo(x + i, y);
          ctx.lineTo(x + i + 1.5, y - gh);
          ctx.lineTo(x + i + 3, y);
          ctx.fill();
        }
        
        // Grass highlight
        ctx.fillStyle = 'rgba(150, 255, 150, 0.3)';
        for (let i = 0; i < width; i += 8) {
          const gh = 3 + Math.sin(i * 0.5 + time * 0.03 + 1) * 2;
          ctx.beginPath();
          ctx.moveTo(x + i, y);
          ctx.lineTo(x + i + 1, y - gh);
          ctx.lineTo(x + i + 2, y);
          ctx.fill();
        }
        
        // Moss texture
        ctx.fillStyle = 'rgba(50, 150, 80, 0.2)';
        for (let i = 0; i < 8; i++) {
          const mx = x + 10 + i * (width - 20) / 8;
          const my = y + 10 + Math.sin(i * 1.5) * 5;
          ctx.beginPath();
          ctx.arc(mx, my, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  };

  const drawCharacter = (ctx: CanvasRenderingContext2D, char: CharState, time: number) => {
    const { x, y, facing, walkFrame, onGround, jumpSquash } = char;
    const bounce = onGround ? Math.sin(walkFrame * 0.3) * 2 : 0;
    const squash = 1 + jumpSquash * 0.2;
    const stretch = 1 - jumpSquash * 0.1;

    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.scale(facing, 1);
    ctx.scale(stretch, squash);

    // Shadow with better gradient
    const shadowGrad = ctx.createRadialGradient(0, 18, 0, 0, 18, 14);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 18, Math.max(0.1, 14), Math.max(0.1, 4), 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (cute round creature - like a little jungle spirit)
    const bodyGrad = ctx.createRadialGradient(-4, -6, 0, 0, 0, 20);
    bodyGrad.addColorStop(0, '#90FF30');
    bodyGrad.addColorStop(0.4, '#7CFC00');
    bodyGrad.addColorStop(0.8, '#32CD32');
    bodyGrad.addColorStop(1, '#228B22');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 16), Math.max(0.1, 18), 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body outline
    ctx.strokeStyle = 'rgba(0, 80, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 16), Math.max(0.1, 18), 0, 0, Math.PI * 2);
    ctx.stroke();

    // Belly with better gradient
    const bellyGrad = ctx.createRadialGradient(0, 4, 0, 0, 4, 11);
    bellyGrad.addColorStop(0, '#B0FF90');
    bellyGrad.addColorStop(1, '#90EE90');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, Math.max(0.1, 10), Math.max(0.1, 11), 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears/leaves on head with better design
    ctx.fillStyle = '#2E8B2E';
    // Left ear
    ctx.beginPath();
    ctx.ellipse(-10, -16, Math.max(0.1, 5), Math.max(0.1, 8), -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.ellipse(10, -16, Math.max(0.1, 5), Math.max(0.1, 8), 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Ear highlights
    ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-10, -18, Math.max(0.1, 3), Math.max(0.1, 4), -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -18, Math.max(0.1, 3), Math.max(0.1, 4), 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Leaf on head with better design
    ctx.fillStyle = '#4CD89A';
    ctx.beginPath();
    ctx.ellipse(0, -20, Math.max(0.1, 4), Math.max(0.1, 7), Math.sin(time * 0.05) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Leaf vein
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -26);
    ctx.stroke();
    
    // Leaf highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(-1, -22, Math.max(0.1, 2), Math.max(0.1, 3), Math.sin(time * 0.05) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes with better design
    const eyeY = -4;
    
    // Eye whites with gradient
    const eyeGrad = ctx.createRadialGradient(-6, eyeY, 0, -6, eyeY, 6);
    eyeGrad.addColorStop(0, '#FFFFFF');
    eyeGrad.addColorStop(1, '#F0F0F0');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.ellipse(-6, eyeY, Math.max(0.1, 5), Math.max(0.1, 6), 0, 0, Math.PI * 2);
    ctx.fill();
    
    const eyeGrad2 = ctx.createRadialGradient(6, eyeY, 0, 6, eyeY, 6);
    eyeGrad2.addColorStop(0, '#FFFFFF');
    eyeGrad2.addColorStop(1, '#F0F0F0');
    ctx.fillStyle = eyeGrad2;
    ctx.beginPath();
    ctx.ellipse(6, eyeY, Math.max(0.1, 5), Math.max(0.1, 6), 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye outlines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(-6, eyeY, Math.max(0.1, 5), Math.max(0.1, 6), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, eyeY, Math.max(0.1, 5), Math.max(0.1, 6), 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Pupils with gradient
    const pupilOffset = onGround ? 0 : -1;
    const pupilGrad = ctx.createRadialGradient(-5, eyeY + pupilOffset, 0, -5, eyeY + pupilOffset, 3);
    pupilGrad.addColorStop(0, '#2a2a2a');
    pupilGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = pupilGrad;
    ctx.beginPath();
    ctx.arc(-5, eyeY + pupilOffset, Math.max(0.1, 3), 0, Math.PI * 2);
    ctx.fill();
    
    const pupilGrad2 = ctx.createRadialGradient(7, eyeY + pupilOffset, 0, 7, eyeY + pupilOffset, 3);
    pupilGrad2.addColorStop(0, '#2a2a2a');
    pupilGrad2.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = pupilGrad2;
    ctx.beginPath();
    ctx.arc(7, eyeY + pupilOffset, Math.max(0.1, 3), 0, Math.PI * 2);
    ctx.fill();
    
    // Eye shine with better detail
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4, eyeY - 2 + pupilOffset, Math.max(0.1, 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, eyeY - 2 + pupilOffset, Math.max(0.1, 2), 0, Math.PI * 2);
    ctx.fill();
    
    // Secondary shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(-6, eyeY + 1 + pupilOffset, Math.max(0.1, 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, eyeY + 1 + pupilOffset, Math.max(0.1, 1), 0, Math.PI * 2);
    ctx.fill();

    // Mouth with better design
    ctx.strokeStyle = '#1a4a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!onGround) {
      // Excited mouth when jumping
      ctx.arc(1, 6, 4, 0, Math.PI);
    } else {
      // Happy smile
      ctx.arc(1, 5, 4, 0.1, Math.PI - 0.1);
    }
    ctx.stroke();

    // Blush with better gradient
    const blushGrad = ctx.createRadialGradient(-10, 3, 0, -10, 3, 4);
    blushGrad.addColorStop(0, 'rgba(255, 150, 150, 0.5)');
    blushGrad.addColorStop(1, 'rgba(255, 150, 150, 0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(-10, 3, Math.max(0.1, 4), Math.max(0.1, 3), 0, 0, Math.PI * 2);
    ctx.fill();
    
    const blushGrad2 = ctx.createRadialGradient(12, 3, 0, 12, 3, 4);
    blushGrad2.addColorStop(0, 'rgba(255, 150, 150, 0.5)');
    blushGrad2.addColorStop(1, 'rgba(255, 150, 150, 0)');
    ctx.fillStyle = blushGrad2;
    ctx.beginPath();
    ctx.ellipse(12, 3, Math.max(0.1, 4), Math.max(0.1, 3), 0, 0, Math.PI * 2);
    ctx.fill();

    // Feet with better design
    const legAnim = onGround ? Math.sin(walkFrame * 0.4) * 3 : 0;
    const feetGrad = ctx.createLinearGradient(0, 13, 0, 19);
    feetGrad.addColorStop(0, '#2E8B2E');
    feetGrad.addColorStop(1, '#1a6b1a');
    ctx.fillStyle = feetGrad;
    ctx.beginPath();
    ctx.ellipse(-6, 16 + legAnim, Math.max(0.1, 5), Math.max(0.1, 3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 16 - legAnim, Math.max(0.1, 5), Math.max(0.1, 3), 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Feet highlights
    ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-6, 15 + legAnim, Math.max(0.1, 3), Math.max(0.1, 1.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 15 - legAnim, Math.max(0.1, 3), Math.max(0.1, 1.5), 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow aura with better effect
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(time * 0.05) * 0.08;
    const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    auraGrad.addColorStop(0, 'rgba(124, 252, 0, 0.4)');
    auraGrad.addColorStop(0.5, 'rgba(124, 252, 0, 0.2)');
    auraGrad.addColorStop(1, 'rgba(124, 252, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 20), Math.max(0.1, 22), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawCollectible = (ctx: CanvasRenderingContext2D, c: Collectible, time: number) => {
    if (c.collected) return;
    c.phase += 0.04;
    const floatY = Math.sin(c.phase) * 5;
    const scale = 1 + Math.sin(c.phase * 2) * 0.1;

    ctx.save();
    ctx.translate(c.x, c.y + floatY);
    ctx.scale(scale, scale);

    switch (c.type) {
      case 'flower': {
        // Golden tropical flower with better design
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 18;
        
        // Outer petals with gradient
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 0.02;
          const petalGrad = ctx.createRadialGradient(
            Math.cos(angle) * 8, Math.sin(angle) * 8, 0,
            Math.cos(angle) * 8, Math.sin(angle) * 8, 5
          );
          petalGrad.addColorStop(0, '#FFE44D');
          petalGrad.addColorStop(1, '#FFD700');
          ctx.fillStyle = petalGrad;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(angle) * 8, Math.sin(angle) * 8,
            Math.max(0.1, 5), Math.max(0.1, 3), angle, 0, Math.PI * 2
          );
          ctx.fill();
        }
        
        // Inner petals
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 0.02 + Math.PI / 6;
          ctx.fillStyle = '#FFC700';
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(angle) * 5, Math.sin(angle) * 5,
            Math.max(0.1, 3), Math.max(0.1, 2), angle, 0, Math.PI * 2
          );
          ctx.fill();
        }
        
        // Center with gradient
        const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
        centerGrad.addColorStop(0, '#FFAA00');
        centerGrad.addColorStop(1, '#FF8C00');
        ctx.fillStyle = centerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, 5), 0, Math.PI * 2);
        ctx.fill();
        
        // Center highlight
        ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(-1, -1, Math.max(0.1, 2), 0, Math.PI * 2);
        ctx.fill();
        
        // Sparkle with better effect
        const sparkleAlpha = 0.5 + Math.sin(c.phase * 3) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 200, ${sparkleAlpha})`;
        ctx.beginPath();
        ctx.arc(-3, -3, Math.max(0.1, 2), 0, Math.PI * 2);
        ctx.fill();
        
        // Secondary sparkle
        ctx.fillStyle = `rgba(255, 255, 150, ${sparkleAlpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(4, -2, Math.max(0.1, 1.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'gem': {
        // Emerald gem with better design
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 15;
        
        // Main gem body with gradient
        const gemGrad = ctx.createLinearGradient(0, -10, 0, 10);
        gemGrad.addColorStop(0, '#00FF88');
        gemGrad.addColorStop(0.5, '#00CC66');
        gemGrad.addColorStop(1, '#009944');
        ctx.fillStyle = gemGrad;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(8, -3);
        ctx.lineTo(8, 5);
        ctx.lineTo(0, 10);
        ctx.lineTo(-8, 5);
        ctx.lineTo(-8, -3);
        ctx.closePath();
        ctx.fill();
        
        // Gem outline
        ctx.strokeStyle = 'rgba(0, 100, 50, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Top highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(5, -3);
        ctx.lineTo(0, 0);
        ctx.lineTo(-5, -3);
        ctx.closePath();
        ctx.fill();
        
        // Side highlights
        ctx.fillStyle = 'rgba(200, 255, 220, 0.3)';
        ctx.beginPath();
        ctx.moveTo(6, -2);
        ctx.lineTo(7, 3);
        ctx.lineTo(4, 4);
        ctx.lineTo(3, -1);
        ctx.closePath();
        ctx.fill();
        
        // Sparkle
        const gemSparkle = 0.4 + Math.sin(c.phase * 2) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${gemSparkle})`;
        ctx.beginPath();
        ctx.arc(-2, -4, Math.max(0.1, 1.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'star': {
        // Glowing star with better design
        ctx.shadowColor = '#FF69B4';
        ctx.shadowBlur = 18;
        
        // Star body with gradient
        const starGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
        starGrad.addColorStop(0, '#FFB6C1');
        starGrad.addColorStop(0.5, '#FF69B4');
        starGrad.addColorStop(1, '#FF1493');
        ctx.fillStyle = starGrad;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const innerAngle = angle + Math.PI / 5;
          ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
          ctx.lineTo(Math.cos(innerAngle) * 4, Math.sin(innerAngle) * 4);
        }
        ctx.closePath();
        ctx.fill();
        
        // Star outline
        ctx.strokeStyle = 'rgba(200, 0, 100, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Inner glow with gradient
        const innerGlowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 4);
        innerGlowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        innerGlowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = innerGlowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, 4), 0, Math.PI * 2);
        ctx.fill();
        
        // Sparkle points
        const starSparkle = 0.5 + Math.sin(c.phase * 3) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${starSparkle})`;
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * 7, Math.sin(angle) * 7, Math.max(0.1, 1), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, time: number) => {
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'leaf') {
        p.vx += Math.sin(time * 0.05 + p.y * 0.01) * 0.05;
        p.vy += 0.02;
      } else {
        p.vy += 0.1;
      }
      p.life -= 0.02;

      if (p.life <= 0) return false;

      ctx.globalAlpha = p.life;
      if (p.type === 'leaf') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(time * 0.05 + p.vx);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(0.1, p.size), Math.max(0.1, p.size * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'firefly') {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    ctx.globalAlpha = 1;
  };

  const drawHUD = (ctx: CanvasRenderingContext2D, levelIdx: number) => {
    const level = levels[levelIdx];
    const collected = collectedCountRef.current;
    const total = totalCollectiblesRef.current;
    const progress = total > 0 ? collected / total : 0;

    // HUD background with better gradient
    const hudGrad = ctx.createLinearGradient(250, 8, 250, 43);
    hudGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    hudGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = hudGrad;
    ctx.beginPath();
    ctx.roundRect(250, 8, 300, 35, 18);
    ctx.fill();
    
    // HUD border with glow
    ctx.strokeStyle = 'rgba(100, 255, 150, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(100, 255, 150, 0.5)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.roundRect(250, 8, 300, 35, 18);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Progress bar background
    const barX = 290;
    const barY = 16;
    const barW = 200;
    const barH = 18;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 10);
    ctx.fill();
    
    // Progress bar border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 10);
    ctx.stroke();

    // Progress bar fill with better gradient
    if (progress > 0) {
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY + barH);
      barGrad.addColorStop(0, '#FFE44D');
      barGrad.addColorStop(0.5, '#FFD700');
      barGrad.addColorStop(1, '#FF8C00');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(0, barW * progress), barH, 10);
      ctx.fill();
      
      // Progress bar highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, Math.max(0, barW * progress - 4), barH / 3, 5);
      ctx.fill();
      
      // Progress bar glow
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(0, barW * progress), barH, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Flower icon with better design
    const iconGrad = ctx.createRadialGradient(268, barY + barH / 2, 0, 268, barY + barH / 2, 7);
    iconGrad.addColorStop(0, '#FFE44D');
    iconGrad.addColorStop(1, '#FFD700');
    ctx.fillStyle = iconGrad;
    ctx.beginPath();
    ctx.arc(268, barY + barH / 2, Math.max(0.1, 7), 0, Math.PI * 2);
    ctx.fill();
    
    const iconCenterGrad = ctx.createRadialGradient(268, barY + barH / 2, 0, 268, barY + barH / 2, 4);
    iconCenterGrad.addColorStop(0, '#FFAA00');
    iconCenterGrad.addColorStop(1, '#FF8C00');
    ctx.fillStyle = iconCenterGrad;
    ctx.beginPath();
    ctx.arc(268, barY + barH / 2, Math.max(0.1, 4), 0, Math.PI * 2);
    ctx.fill();

    // Text with better styling
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${collected}/${total}`, barX + barW / 2, barY + 14);
    ctx.shadowBlur = 0;

    // Level name with better styling
    ctx.fillStyle = 'rgba(200, 255, 200, 0.9)';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(level.name, 400, 60);
    ctx.shadowBlur = 0;
  };

  // ===== GAME LOOP =====
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      timeRef.current++;
      const time = timeRef.current;
      const level = levels[currentLevel];
      const char = charRef.current;
      const keys = keysRef.current;
      const touch = touchRef.current;

      // Input
      let moveX = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || touch.left) moveX = -MOVE_SPEED;
      if (keys.has('ArrowRight') || keys.has('d') || touch.right) moveX = MOVE_SPEED;
      if ((keys.has('ArrowUp') || keys.has('w') || keys.has(' ') || touch.jump) && char.onGround) {
        char.vy = JUMP_FORCE;
        char.onGround = false;
        char.jumpSquash = 1;
        spawnParticles(char.x, char.y + 15, '#4CAF50', 5, 'leaf');
      }

      // Physics
      char.vx = moveX;
      char.vy += GRAVITY;
      char.x += char.vx;
      char.y += char.vy;

      if (moveX !== 0) {
        char.facing = moveX > 0 ? 1 : -1;
        char.walkFrame++;
      }

      // Squash & stretch recovery
      char.jumpSquash *= 0.9;

      // Platform collision
      char.onGround = false;
      for (const plat of level.platforms) {
        const charBottom = char.y + 18;
        const charLeft = char.x - 12;
        const charRight = char.x + 12;

        if (
          charRight > plat.x && charLeft < plat.x + plat.width &&
          charBottom > plat.y && charBottom < plat.y + plat.height + 12 &&
          char.vy >= 0
        ) {
          char.y = plat.y - 18;
          char.vy = 0;
          char.onGround = true;
          if (char.jumpSquash > 0.1) {
            char.jumpSquash = -0.5;
            spawnParticles(char.x, char.y + 18, '#2d8a4e', 3, 'leaf');
          }
        }
      }

      // Boundaries
      if (char.x < 15) char.x = 15;
      if (char.x > CANVAS_W - 15) char.x = CANVAS_W - 15;
      if (char.y > CANVAS_H + 50) {
        char.x = level.playerStart.x;
        char.y = level.playerStart.y;
        char.vx = 0;
        char.vy = 0;
      }

      // Collectible collision
      collectiblesRef.current.forEach((c, i) => {
        if (!c.collected) {
          const dx = char.x - c.x;
          const dy = char.y - c.y;
          if (Math.sqrt(dx * dx + dy * dy) < 25) {
            collectiblesRef.current[i].collected = true;
            collectedCountRef.current++;
            const colors = ['#FFD700', '#00FF88', '#FF69B4'];
            const typeIdx = c.type === 'flower' ? 0 : c.type === 'gem' ? 1 : 2;
            spawnParticles(c.x, c.y, colors[typeIdx], 12, 'spark');
            spawnParticles(c.x, c.y, '#7CFC00', 5, 'firefly');
          }
        }
      });

      // Check complete
      if (collectedCountRef.current >= totalCollectiblesRef.current && totalCollectiblesRef.current > 0) {
        spawnParticles(char.x, char.y, '#FFD700', 25, 'spark');
        spawnParticles(char.x, char.y, '#FF69B4', 15, 'firefly');
        setGameState('levelComplete');
      }

      // Ambient leaf particles
      if (time % 60 === 0) {
        particlesRef.current.push({
          x: Math.random() * CANVAS_W,
          y: -10,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 1 + 0.5,
          life: 1,
          color: ['#4CAF50', '#228B22', '#3CB371'][Math.floor(Math.random() * 3)],
          size: 4 + Math.random() * 4,
          type: 'leaf',
        });
      }

      // ===== RENDER =====
      // Background
      drawJungleBg(ctx, time, currentLevel);

      // Near layer trees
      bgTreesRef.current
        .filter(t => t.layer === 2)
        .forEach(tree => {
          ctx.fillStyle = 'rgba(20, 100, 50, 0.6)';
          ctx.fillRect(tree.x - 8, tree.y - tree.height * 0.4, 16, tree.height * 0.4);
          ctx.beginPath();
          ctx.arc(tree.x, tree.y - tree.height * 0.45, Math.max(0.1, tree.width), 0, Math.PI * 2);
          ctx.fill();
        });

      // Platforms
      level.platforms.forEach(plat => drawPlatform(ctx, plat, time));

      // Collectibles
      collectiblesRef.current.forEach(c => drawCollectible(ctx, c, time));

      // Character
      drawCharacter(ctx, char, time);

      // Particles
      drawParticles(ctx, time);

      // Foreground grass
      ctx.fillStyle = '#1a4a2e';
      for (let i = 0; i < CANVAS_W; i += 6) {
        const gh = 5 + Math.sin(i * 0.3 + time * 0.02) * 3;
        ctx.beginPath();
        ctx.moveTo(i, CANVAS_H);
        ctx.lineTo(i + 3, CANVAS_H - gh);
        ctx.lineTo(i + 6, CANVAS_H);
        ctx.fill();
      }

      // HUD
      drawHUD(ctx, currentLevel);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, currentLevel]);

  // ===== MENU =====
  useEffect(() => {
    if (gameState !== 'menu') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    generateBackground(0);
    let time = 0;
    let menuParticles: Particle[] = [];

    const loop = () => {
      time++;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#0a2e1a');
      grad.addColorStop(0.5, '#1a4a2e');
      grad.addColorStop(1, '#0d3320');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Draw jungle bg
      drawJungleBg(ctx, time, 0);

      // Floating particles
      if (time % 15 === 0) {
        menuParticles.push({
          x: Math.random() * CANVAS_W,
          y: CANVAS_H + 10,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -Math.random() * 2 - 0.5,
          life: 1,
          color: ['#FFD700', '#FF69B4', '#7CFC00', '#00FF88'][Math.floor(Math.random() * 4)],
          size: 3 + Math.random() * 5,
          type: 'firefly',
        });
      }

      menuParticles = menuParticles.filter(p => {
        p.x += p.vx + Math.sin(time * 0.02 + p.y * 0.01) * 0.3;
        p.y += p.vy;
        p.life -= 0.005;
        
        if (p.life <= 0) return false;
        
        ctx.globalAlpha = p.life * 0.7;
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      });
      ctx.globalAlpha = 1;

      // Title card background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(200, 100, 400, 350, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 255, 150, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(200, 100, 400, 350, 20);
      ctx.stroke();

      // Character preview
      const previewChar: CharState = {
        x: 400, y: 180, vx: 0, vy: 0,
        onGround: true, facing: 1, walkFrame: time, jumpSquash: 0,
      };
      drawCharacter(ctx, previewChar, time);

      // Title
      ctx.save();
      ctx.shadowColor = '#7CFC00';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 32px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('For zoyita', 400, 250);
      ctx.restore();

      ctx.fillStyle = '#90EE90';
      ctx.font = '16px Arial';
      ctx.fillText('A Jungle Adventure of Love 💚', 400, 280);

      // Decorative flowers
      for (let i = 0; i < 5; i++) {
        const fx = 250 + i * 75;
        const fy = 300 + Math.sin(time * 0.03 + i) * 5;
        ctx.fillStyle = '#FFD700';
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * Math.PI * 2 + time * 0.02;
          ctx.beginPath();
          ctx.ellipse(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, Math.max(0.1, 4), Math.max(0.1, 2), a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(fx, fy, Math.max(0.1, 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // Play button
      const btnPulse = 1 + Math.sin(time * 0.06) * 0.03;
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
      const btnGrad = ctx.createLinearGradient(300, 340, 300, 390);
      btnGrad.addColorStop(0, '#FFD700');
      btnGrad.addColorStop(1, '#FF8C00');
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(300, 340, 200 * btnPulse, 50, 25);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#1a0a00';
      ctx.font = `bold ${18 * btnPulse}px Arial`;
      ctx.fillText('▶  START ADVENTURE', 400, 372);

      // Instructions
      ctx.fillStyle = 'rgba(200, 255, 200, 0.6)';
      ctx.font = '12px Arial';
      ctx.fillText('Arrow Keys / WASD to move • Space to jump', 400, 420);
      ctx.fillText('Collect all flowers & gems to complete each level!', 400, 440);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, generateBackground]);

  // ===== FINALE =====
  useEffect(() => {
    if (gameState !== 'finale') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    generateBackground(0);
    let time = 0;
    let finaleParticles: Particle[] = [];

    const loop = () => {
      time++;

      // Background - magical jungle night
      const grad = ctx.createRadialGradient(400, 265, 0, 400, 265, 500);
      grad.addColorStop(0, '#1a3a2e');
      grad.addColorStop(0.5, '#0d2e1a');
      grad.addColorStop(1, '#050f0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Jungle bg
      drawJungleBg(ctx, time, 0);

      // Extra fireflies for finale
      if (time % 3 === 0) {
        finaleParticles.push({
          x: Math.random() * CANVAS_W,
          y: CANVAS_H,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 3 - 1,
          life: 1,
          color: ['#FFD700', '#FF69B4', '#7CFC00', '#00FF88', '#FF1493'][Math.floor(Math.random() * 5)],
          size: 3 + Math.random() * 6,
          type: 'firefly',
        });
      }

      // Draw particles
      finaleParticles = finaleParticles.filter(p => {
        p.x += p.vx + Math.sin(time * 0.02 + p.y * 0.01) * 0.5;
        p.y += p.vy;
        p.vy *= 0.99;
        p.life -= 0.005;
        
        if (p.life <= 0) return false;
        
        ctx.globalAlpha = p.life * 0.8;
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      });
      ctx.globalAlpha = 1;

      // Big glowing heart in center
      const heartBeat = 1 + Math.sin(time * 0.06) * 0.08;
      const heartSize = 90 * heartBeat;

      // Heart glow
      ctx.save();
      const heartGrad = ctx.createRadialGradient(400, 180, 0, 400, 180, Math.max(0.1, heartSize * 1.5));
      heartGrad.addColorStop(0, 'rgba(255, 20, 100, 0.3)');
      heartGrad.addColorStop(1, 'rgba(255, 20, 100, 0)');
      ctx.fillStyle = heartGrad;
      ctx.beginPath();
      ctx.arc(400, 180, Math.max(0.1, heartSize * 1.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw heart shape
      ctx.save();
      ctx.translate(400, 180);
      ctx.scale(heartBeat, heartBeat);
      ctx.shadowColor = '#FF1493';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#FF1493';
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.bezierCurveTo(-5, 0, -40, -10, -40, -30);
      ctx.bezierCurveTo(-40, -55, -10, -60, 0, -40);
      ctx.bezierCurveTo(10, -60, 40, -55, 40, -30);
      ctx.bezierCurveTo(40, -10, 5, 0, 0, 20);
      ctx.fill();
      // Inner highlight
      ctx.fillStyle = 'rgba(255, 150, 200, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-3, 0, -25, -5, -25, -20);
      ctx.bezierCurveTo(-25, -35, -5, -40, 0, -28);
      ctx.bezierCurveTo(5, -40, 25, -35, 25, -20);
      ctx.bezierCurveTo(25, -5, 3, 0, 0, 10);
      ctx.fill();
      ctx.restore();

      // Orbiting mini hearts
      for (let i = 0; i < 8; i++) {
        const angle = (time * 0.02 + i * Math.PI / 4);
        const radius = 130 + Math.sin(time * 0.03 + i) * 15;
        const hx = 400 + Math.cos(angle) * radius;
        const hy = 180 + Math.sin(angle) * radius * 0.4;
        const hs = Math.max(0.1, 8 + Math.sin(time * 0.05 + i) * 3);
        ctx.globalAlpha = 0.6 + Math.sin(time * 0.05 + i) * 0.3;
        ctx.fillStyle = ['#FF69B4', '#FFD700', '#FF1493', '#7CFC00'][i % 4];
        ctx.beginPath();
        ctx.arc(hx, hy, hs, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Text animations
      const fadeIn1 = Math.min(1, time / 50);
      ctx.globalAlpha = fadeIn1;
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 42px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('I love u', 400, 310);
      ctx.restore();

      const fadeIn2 = Math.min(1, Math.max(0, (time - 30) / 50));
      ctx.globalAlpha = fadeIn2;
      ctx.save();
      ctx.shadowColor = '#FF69B4';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#FF69B4';
      ctx.font = 'bold 58px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('zoyita', 400, 380);
      ctx.restore();

      const fadeIn3 = Math.min(1, Math.max(0, (time - 60) / 50));
      ctx.globalAlpha = fadeIn3;
      ctx.fillStyle = '#90EE90';
      ctx.font = '18px Georgia, serif';
      ctx.fillText('You make my heart bloom 💚', 400, 430);

      const fadeIn4 = Math.min(1, Math.max(0, (time - 90) / 50));
      ctx.globalAlpha = fadeIn4;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.font = '14px Georgia, serif';
      ctx.fillText('Every moment with you is an adventure', 400, 465);

      const fadeIn5 = Math.min(1, Math.max(0, (time - 120) / 50));
      ctx.globalAlpha = fadeIn5;
      ctx.fillStyle = 'rgba(255, 105, 180, 0.6)';
      ctx.font = '13px Georgia, serif';
      ctx.fillText('Forever & Always ∞', 400, 495);

      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, generateBackground]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-[#050f0a] overflow-hidden select-none p-2">
      <div className="relative w-full max-w-[800px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-2xl shadow-2xl shadow-green-500/20 w-full h-auto border border-green-500/20"
          style={{ maxHeight: '65vh' }}
          onClick={() => {
            if (gameState === 'menu') startGame();
            if (gameState === 'levelComplete') nextLevel();
          }}
        />

        {/* Level Complete Overlay */}
        {gameState === 'levelComplete' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-2xl backdrop-blur-sm">
            <div className="text-center p-8 bg-black/40 rounded-3xl border border-green-500/30">
              <p className="text-5xl mb-3">🌟</p>
              <h2 className="text-3xl font-bold text-green-300 mb-2">Level Complete!</h2>
              <p className="text-green-200/80 mb-5 text-sm">
                {currentLevel < levels.length - 1
                  ? 'The jungle reveals more of its beauty...'
                  : 'You\'ve gathered all the love in the jungle!'}
              </p>
              <button
                onClick={nextLevel}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-110 shadow-lg shadow-green-500/40"
              >
                {currentLevel < levels.length - 1 ? '🌿 Next Level' : '✨ See the Finale ✨'}
              </button>
            </div>
          </div>
        )}

        {/* Message popup */}
        {showMessage && gameState === 'playing' && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-green-900/80 backdrop-blur-sm text-green-100 px-5 py-2 rounded-full text-sm font-medium animate-pulse border border-green-500/30">
            {showMessage}
          </div>
        )}
      </div>

      {/* Touch Controls */}
      {gameState === 'playing' && (
        <div className="flex gap-3 mt-3">
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-green-500 to-green-800 text-white text-xl sm:text-2xl font-bold active:from-green-400 active:to-green-600 shadow-lg shadow-green-500/40 border border-green-400/30 flex items-center justify-center"
            onTouchStart={(e) => { e.preventDefault(); touchRef.current.left = true; }}
            onTouchEnd={() => { touchRef.current.left = false; }}
            onMouseDown={() => { touchRef.current.left = true; }}
            onMouseUp={() => { touchRef.current.left = false; }}
            onMouseLeave={() => { touchRef.current.left = false; }}
          >
            ◀
          </button>
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-green-500 to-green-800 text-white text-xl sm:text-2xl font-bold active:from-green-400 active:to-green-600 shadow-lg shadow-green-500/40 border border-green-400/30 flex items-center justify-center"
            onTouchStart={(e) => { e.preventDefault(); touchRef.current.jump = true; }}
            onTouchEnd={() => { touchRef.current.jump = false; }}
            onMouseDown={() => { touchRef.current.jump = true; }}
            onMouseUp={() => { touchRef.current.jump = false; }}
            onMouseLeave={() => { touchRef.current.jump = false; }}
          >
            ▲
          </button>
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-green-500 to-green-800 text-white text-xl sm:text-2xl font-bold active:from-green-400 active:to-green-600 shadow-lg shadow-green-500/40 border border-green-400/30 flex items-center justify-center"
            onTouchStart={(e) => { e.preventDefault(); touchRef.current.right = true; }}
            onTouchEnd={() => { touchRef.current.right = false; }}
            onMouseDown={() => { touchRef.current.right = true; }}
            onMouseUp={() => { touchRef.current.right = false; }}
            onMouseLeave={() => { touchRef.current.right = false; }}
          >
            ▶
          </button>
        </div>
      )}

      {/* Finale restart */}
      {gameState === 'finale' && (
        <button
          onClick={() => setGameState('menu')}
          className="mt-4 px-6 py-2 bg-green-700/60 hover:bg-green-600/80 text-green-100 rounded-full text-sm transition-all border border-green-500/30"
        >
          🌿 Play Again
        </button>
      )}
    </div>
  );
}

export default App;
