import { useState, useEffect, useRef, useCallback } from 'react';

// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const HEART_SIZE = 30;
const PLAYER_SIZE = 35;

// Types
interface Position {
  x: number;
  y: number;
}

interface Heart {
  x: number;
  y: number;
  collected: boolean;
  pulsePhase: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  speed: number;
}

type GameState = 'menu' | 'playing' | 'levelComplete' | 'finale';

// Level data
const levels = [
  {
    name: "The Beginning",
    message: "Collect all the hearts to show your love...",
    platforms: [
      { x: 0, y: 500, width: 800, height: 30, color: '#ff6b9d' },
      { x: 100, y: 400, width: 150, height: 20, color: '#c44569' },
      { x: 350, y: 320, width: 150, height: 20, color: '#c44569' },
      { x: 550, y: 240, width: 150, height: 20, color: '#c44569' },
      { x: 200, y: 180, width: 200, height: 20, color: '#ff6b9d' },
    ],
    hearts: [
      { x: 160, y: 360 },
      { x: 410, y: 280 },
      { x: 610, y: 200 },
      { x: 290, y: 140 },
    ],
    playerStart: { x: 50, y: 450 },
  },
  {
    name: "Growing Love",
    message: "Your love grows stronger with each heart...",
    platforms: [
      { x: 0, y: 500, width: 200, height: 30, color: '#ff6b9d' },
      { x: 250, y: 450, width: 120, height: 20, color: '#c44569' },
      { x: 420, y: 380, width: 120, height: 20, color: '#c44569' },
      { x: 250, y: 310, width: 120, height: 20, color: '#c44569' },
      { x: 50, y: 250, width: 120, height: 20, color: '#c44569' },
      { x: 250, y: 180, width: 120, height: 20, color: '#c44569' },
      { x: 450, y: 120, width: 200, height: 20, color: '#ff6b9d' },
      { x: 600, y: 500, width: 200, height: 30, color: '#ff6b9d' },
    ],
    hearts: [
      { x: 290, y: 410 },
      { x: 460, y: 340 },
      { x: 290, y: 270 },
      { x: 90, y: 210 },
      { x: 290, y: 140 },
      { x: 530, y: 80 },
    ],
    playerStart: { x: 50, y: 450 },
  },
  {
    name: "Forever Yours",
    message: "Every heart brings us closer together...",
    platforms: [
      { x: 0, y: 500, width: 150, height: 30, color: '#ff6b9d' },
      { x: 180, y: 440, width: 100, height: 20, color: '#c44569' },
      { x: 320, y: 380, width: 100, height: 20, color: '#c44569' },
      { x: 480, y: 440, width: 100, height: 20, color: '#c44569' },
      { x: 620, y: 380, width: 100, height: 20, color: '#c44569' },
      { x: 480, y: 300, width: 100, height: 20, color: '#c44569' },
      { x: 300, y: 240, width: 100, height: 20, color: '#c44569' },
      { x: 120, y: 300, width: 100, height: 20, color: '#c44569' },
      { x: 120, y: 180, width: 100, height: 20, color: '#c44569' },
      { x: 300, y: 120, width: 200, height: 20, color: '#ff6b9d' },
    ],
    hearts: [
      { x: 210, y: 400 },
      { x: 350, y: 340 },
      { x: 510, y: 400 },
      { x: 650, y: 340 },
      { x: 510, y: 260 },
      { x: 330, y: 200 },
      { x: 150, y: 260 },
      { x: 150, y: 140 },
      { x: 380, y: 80 },
    ],
    playerStart: { x: 50, y: 450 },
  },
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [heartsCollected, setHeartsCollected] = useState(0);
  const [totalHearts, setTotalHearts] = useState(0);
  const [showMessage, setShowMessage] = useState('');
  const [finalePhase, setFinalePhase] = useState(0);

  // Game refs for animation loop
  const playerRef = useRef<Position>({ x: 50, y: 450 });
  const velocityRef = useRef<Position>({ x: 0, y: 0 });
  const heartsRef = useRef<Heart[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const onGroundRef = useRef(false);
  const animFrameRef = useRef<number>(0);
  const touchRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({ left: false, right: false, jump: false });

  // Initialize stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 530,
        size: Math.random() * 2 + 1,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
      });
    }
    starsRef.current = stars;
  }, []);

  // Load level
  const loadLevel = useCallback((levelIndex: number) => {
    const level = levels[levelIndex];
    playerRef.current = { ...level.playerStart };
    velocityRef.current = { x: 0, y: 0 };
    heartsRef.current = level.hearts.map(h => ({
      ...h,
      collected: false,
      pulsePhase: Math.random() * Math.PI * 2,
    }));
    particlesRef.current = [];
    setHeartsCollected(0);
    setTotalHearts(level.hearts.length);
    setShowMessage(level.message);
    setTimeout(() => setShowMessage(''), 3000);
  }, []);

  // Start game
  const startGame = () => {
    setCurrentLevel(0);
    loadLevel(0);
    setGameState('playing');
  };

  // Next level
  const nextLevel = () => {
    if (currentLevel < levels.length - 1) {
      const next = currentLevel + 1;
      setCurrentLevel(next);
      loadLevel(next);
      setGameState('playing');
    } else {
      setGameState('finale');
      setFinalePhase(0);
    }
  };

  // Spawn particles
  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        life: 1,
        maxLife: 1,
        color,
        size: Math.random() * 6 + 2,
      });
    }
  };

  // Draw heart shape
  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, glow: boolean = false) => {
    ctx.save();
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    // left curve
    ctx.bezierCurveTo(
      x, y, x - size / 2, y, x - size / 2, y + topCurveHeight
    );
    ctx.bezierCurveTo(
      x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 1.3, x, y + size
    );
    // right curve
    ctx.bezierCurveTo(
      x, y + (size + topCurveHeight) / 1.3, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight
    );
    ctx.bezierCurveTo(
      x + size / 2, y, x, y, x, y + topCurveHeight
    );
    ctx.fill();
    ctx.restore();
  };

  // Draw player character (cute heart character)
  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
    const bounce = Math.sin(time * 0.1) * 2;
    // Body glow
    ctx.save();
    ctx.shadowColor = '#ff1493';
    ctx.shadowBlur = 20;
    drawHeart(ctx, x, y + bounce - PLAYER_SIZE / 2, PLAYER_SIZE, '#ff1493', true);
    ctx.restore();
    // Face
    ctx.fillStyle = '#fff';
    // Eyes
    ctx.beginPath();
    ctx.arc(x - 6, y + bounce - 2, 3, 0, Math.PI * 2);
    ctx.arc(x + 6, y + bounce - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + bounce + 4, 5, 0, Math.PI);
    ctx.stroke();
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const gameLoop = () => {
      time++;
      const level = levels[currentLevel];
      const player = playerRef.current;
      const velocity = velocityRef.current;
      const keys = keysRef.current;
      const touch = touchRef.current;

      // Input
      let moveX = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || touch.left) moveX = -MOVE_SPEED;
      if (keys.has('ArrowRight') || keys.has('d') || touch.right) moveX = MOVE_SPEED;
      if ((keys.has('ArrowUp') || keys.has('w') || keys.has(' ') || touch.jump) && onGroundRef.current) {
        velocity.y = JUMP_FORCE;
        onGroundRef.current = false;
      }

      // Physics
      velocity.x = moveX;
      velocity.y += GRAVITY;
      player.x += velocity.x;
      player.y += velocity.y;

      // Platform collision
      onGroundRef.current = false;
      for (const plat of level.platforms) {
        if (
          player.x + PLAYER_SIZE / 2 > plat.x &&
          player.x - PLAYER_SIZE / 2 < plat.x + plat.width &&
          player.y + PLAYER_SIZE / 2 > plat.y &&
          player.y + PLAYER_SIZE / 2 < plat.y + plat.height + 10 &&
          velocity.y >= 0
        ) {
          player.y = plat.y - PLAYER_SIZE / 2;
          velocity.y = 0;
          onGroundRef.current = true;
        }
      }

      // Boundaries
      if (player.x < PLAYER_SIZE / 2) player.x = PLAYER_SIZE / 2;
      if (player.x > 800 - PLAYER_SIZE / 2) player.x = 800 - PLAYER_SIZE / 2;
      if (player.y > 600) {
        player.x = level.playerStart.x;
        player.y = level.playerStart.y;
        velocity.x = 0;
        velocity.y = 0;
      }

      // Heart collection
      let collected = 0;
      heartsRef.current.forEach((heart, i) => {
        if (!heart.collected) {
          heart.pulsePhase += 0.05;
          const dx = player.x - heart.x;
          const dy = player.y - heart.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PLAYER_SIZE) {
            heartsRef.current[i].collected = true;
            collected++;
            spawnParticles(heart.x, heart.y, '#ff69b4', 15);
          }
        }
        if (heartsRef.current[i].collected) collected++;
      });

      const totalCollected = heartsRef.current.filter(h => h.collected).length;
      setHeartsCollected(totalCollected);

      // Check level complete
      if (totalCollected === heartsRef.current.length && heartsRef.current.length > 0) {
        spawnParticles(player.x, player.y, '#ffd700', 30);
        setGameState('levelComplete');
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.02;
        return p.life > 0;
      });

      // === RENDER ===
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 530);
      gradient.addColorStop(0, '#0a0015');
      gradient.addColorStop(0.5, '#1a0030');
      gradient.addColorStop(1, '#2d0050');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 530);

      // Stars
      starsRef.current.forEach(star => {
        star.twinkle += star.speed;
        const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Platforms
      level.platforms.forEach(plat => {
        const platGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.height);
        platGrad.addColorStop(0, plat.color);
        platGrad.addColorStop(1, '#8b0040');
        ctx.fillStyle = platGrad;
        ctx.beginPath();
        ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 5);
        ctx.fill();
        // Platform glow
        ctx.shadowColor = plat.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = plat.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Hearts
      heartsRef.current.forEach(heart => {
        if (!heart.collected) {
          const pulse = 1 + Math.sin(heart.pulsePhase) * 0.15;
          const size = HEART_SIZE * pulse;
          drawHeart(ctx, heart.x, heart.y - size / 2, size, '#ff4081', true);
          // Sparkle
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(heart.pulsePhase * 2) * 0.5})`;
          ctx.beginPath();
          ctx.arc(heart.x - 5, heart.y - 5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Player
      drawPlayer(ctx, player.x, player.y, time);

      // Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // UI - Love meter
      const meterWidth = 200;
      const meterHeight = 20;
      const meterX = 300;
      const meterY = 15;
      const progress = heartsRef.current.length > 0 ? totalCollected / heartsRef.current.length : 0;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(meterX, meterY, meterWidth, meterHeight, 10);
      ctx.fill();

      const meterGrad = ctx.createLinearGradient(meterX, meterY, meterX + meterWidth * progress, meterY);
      meterGrad.addColorStop(0, '#ff1493');
      meterGrad.addColorStop(1, '#ff69b4');
      ctx.fillStyle = meterGrad;
      ctx.beginPath();
      ctx.roundRect(meterX, meterY, meterWidth * progress, meterHeight, 10);
      ctx.fill();

      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(meterX, meterY, meterWidth, meterHeight, 10);
      ctx.stroke();

      // Heart icon in meter
      drawHeart(ctx, meterX - 15, meterY - 2, 20, '#ff1493', true);

      // Level name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${level.name} - ${totalCollected}/${heartsRef.current.length} 💕`, 400, 55);

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState, currentLevel]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Finale animation
  useEffect(() => {
    if (gameState !== 'finale') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let finaleParticles: Particle[] = [];

    const finaleLoop = () => {
      time++;

      // Background
      const gradient = ctx.createRadialGradient(400, 265, 0, 400, 265, 400);
      gradient.addColorStop(0, '#2d0050');
      gradient.addColorStop(0.5, '#1a0030');
      gradient.addColorStop(1, '#0a0015');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 530);

      // Stars
      starsRef.current.forEach(star => {
        star.twinkle += star.speed;
        const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Spawn celebration particles
      if (time % 5 === 0) {
        finaleParticles.push({
          x: Math.random() * 800,
          y: 530,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 5 - 3,
          life: 1,
          maxLife: 1,
          color: ['#ff1493', '#ff69b4', '#ffd700', '#ff4081', '#ff6b9d'][Math.floor(Math.random() * 5)],
          size: Math.random() * 8 + 3,
        });
      }

      // Update & draw particles
      finaleParticles = finaleParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life -= 0.008;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        return p.life > 0;
      });
      ctx.globalAlpha = 1;

      // Big heart in center
      const heartScale = 1 + Math.sin(time * 0.05) * 0.1;
      const heartSize = 120 * heartScale;
      ctx.save();
      ctx.shadowColor = '#ff1493';
      ctx.shadowBlur = 40;
      drawHeart(ctx, 400, 160, heartSize, '#ff1493', true);
      ctx.restore();

      // Inner heart
      drawHeart(ctx, 400, 170, heartSize * 0.6, '#ff69b4', false);

      // Text animations
      const fadeIn = Math.min(1, time / 60);
      ctx.globalAlpha = fadeIn;

      // "I Love You" text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff1493';
      ctx.shadowBlur = 20;
      ctx.fillText('I Love You', 400, 340);

      // "Zoeyta" text
      const nameFade = Math.min(1, Math.max(0, (time - 40) / 60));
      ctx.globalAlpha = nameFade;
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillStyle = '#ff69b4';
      ctx.shadowColor = '#ff1493';
      ctx.shadowBlur = 30;
      ctx.fillText('Zoeyta', 400, 420);
      ctx.shadowBlur = 0;

      // Subtitle
      const subFade = Math.min(1, Math.max(0, (time - 80) / 60));
      ctx.globalAlpha = subFade;
      ctx.font = '20px Arial';
      ctx.fillStyle = '#ffb6c1';
      ctx.fillText('You are my everything 💕', 400, 470);

      // Extra message
      const extraFade = Math.min(1, Math.max(0, (time - 120) / 60));
      ctx.globalAlpha = extraFade;
      ctx.font = '16px Georgia, serif';
      ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
      ctx.fillText('Every moment with you is a treasure', 400, 505);

      // Floating hearts around
      for (let i = 0; i < 8; i++) {
        const angle = (time * 0.02 + i * Math.PI / 4);
        const radius = 180 + Math.sin(time * 0.03 + i) * 20;
        const hx = 400 + Math.cos(angle) * radius;
        const hy = 280 + Math.sin(angle) * radius * 0.5;
        const hSize = 15 + Math.sin(time * 0.05 + i) * 5;
        drawHeart(ctx, hx, hy, hSize, `rgba(255, 105, 180, ${0.5 + Math.sin(time * 0.05 + i) * 0.3})`, false);
      }

      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(finaleLoop);
    };

    animFrameRef.current = requestAnimationFrame(finaleLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState, finalePhase]);

  // Menu animation
  useEffect(() => {
    if (gameState !== 'menu') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let menuParticles: Particle[] = [];

    const menuLoop = () => {
      time++;

      // Background
      const gradient = ctx.createRadialGradient(400, 265, 0, 400, 265, 400);
      gradient.addColorStop(0, '#1a0030');
      gradient.addColorStop(1, '#0a0015');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 530);

      // Stars
      starsRef.current.forEach(star => {
        star.twinkle += star.speed;
        const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Floating hearts background
      if (time % 20 === 0) {
        menuParticles.push({
          x: Math.random() * 800,
          y: 550,
          vx: (Math.random() - 0.5) * 1,
          vy: -Math.random() * 2 - 1,
          life: 1,
          maxLife: 1,
          color: ['#ff1493', '#ff69b4', '#ff4081'][Math.floor(Math.random() * 3)],
          size: Math.random() * 10 + 5,
        });
      }

      menuParticles = menuParticles.filter(p => {
        p.x += p.vx + Math.sin(time * 0.02 + p.y * 0.01) * 0.5;
        p.y += p.vy;
        p.life -= 0.005;
        ctx.globalAlpha = p.life * 0.6;
        drawHeart(ctx, p.x, p.y, p.size, p.color, false);
        return p.life > 0 && p.y > -20;
      });
      ctx.globalAlpha = 1;

      // Title heart
      const pulse = 1 + Math.sin(time * 0.05) * 0.08;
      ctx.save();
      ctx.shadowColor = '#ff1493';
      ctx.shadowBlur = 30;
      drawHeart(ctx, 400, 120, 80 * pulse, '#ff1493', true);
      ctx.restore();

      // Title text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 15;
      ctx.fillText('A Love Game', 400, 260);
      ctx.shadowBlur = 0;

      ctx.font = '18px Arial';
      ctx.fillStyle = '#ffb6c1';
      ctx.fillText('For Someone Special', 400, 295);

      // Play button area
      const btnPulse = 1 + Math.sin(time * 0.08) * 0.05;
      ctx.save();
      ctx.shadowColor = '#ff1493';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ff1493';
      ctx.beginPath();
      ctx.roundRect(300, 350, 200, 60, 30);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${20 * btnPulse}px Arial`;
      ctx.fillText('▶ PLAY', 400, 388);

      // Instructions
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255, 182, 193, 0.7)';
      ctx.fillText('Use Arrow Keys / WASD to move & jump', 400, 450);
      ctx.fillText('Collect all hearts to advance!', 400, 475);
      ctx.fillText('📱 Touch controls available on mobile', 400, 500);

      animFrameRef.current = requestAnimationFrame(menuLoop);
    };

    animFrameRef.current = requestAnimationFrame(menuLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0015] to-[#1a0030] overflow-hidden select-none p-2">
      {/* Canvas */}
      <div className="relative w-full max-w-[800px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={530}
          className="rounded-2xl shadow-2xl shadow-pink-500/30 w-full h-auto border border-pink-500/20"
          style={{ maxHeight: '65vh' }}
          onClick={() => {
            if (gameState === 'menu') startGame();
            if (gameState === 'levelComplete') nextLevel();
          }}
        />

        {/* Level Complete Overlay */}
        {gameState === 'levelComplete' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl backdrop-blur-sm">
            <div className="text-center animate-bounce">
              <p className="text-5xl mb-4">💖</p>
              <h2 className="text-3xl font-bold text-pink-400 mb-2">Level Complete!</h2>
              <p className="text-pink-200 mb-6">
                {currentLevel < levels.length - 1
                  ? 'Your love grows stronger...'
                  : 'You\'ve collected all the love!'}
              </p>
              <button
                onClick={nextLevel}
                className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-110 shadow-lg shadow-pink-500/50"
              >
                {currentLevel < levels.length - 1 ? 'Next Level →' : '✨ See the Finale ✨'}
              </button>
            </div>
          </div>
        )}

        {/* Message popup */}
        {showMessage && gameState === 'playing' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-pink-900/80 backdrop-blur-sm text-pink-100 px-6 py-3 rounded-full text-sm font-medium animate-pulse">
            {showMessage}
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {gameState === 'playing' && (
        <div className="flex gap-3 mt-3">
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-pink-500 to-pink-700 text-white text-xl sm:text-2xl font-bold active:from-pink-400 active:to-pink-500 shadow-lg shadow-pink-500/40 border border-pink-400/30 flex items-center justify-center"
            onTouchStart={(e) => { e.preventDefault(); touchRef.current.left = true; }}
            onTouchEnd={() => { touchRef.current.left = false; }}
            onMouseDown={() => { touchRef.current.left = true; }}
            onMouseUp={() => { touchRef.current.left = false; }}
            onMouseLeave={() => { touchRef.current.left = false; }}
          >
            ◀
          </button>
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-pink-500 to-pink-700 text-white text-xl sm:text-2xl font-bold active:from-pink-400 active:to-pink-500 shadow-lg shadow-pink-500/40 border border-pink-400/30 flex items-center justify-center"
            onTouchStart={(e) => { e.preventDefault(); touchRef.current.jump = true; }}
            onTouchEnd={() => { touchRef.current.jump = false; }}
            onMouseDown={() => { touchRef.current.jump = true; }}
            onMouseUp={() => { touchRef.current.jump = false; }}
            onMouseLeave={() => { touchRef.current.jump = false; }}
          >
            ▲
          </button>
          <button
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-pink-500 to-pink-700 text-white text-xl sm:text-2xl font-bold active:from-pink-400 active:to-pink-500 shadow-lg shadow-pink-500/40 border border-pink-400/30 flex items-center justify-center"
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
          onClick={() => { setGameState('menu'); }}
          className="mt-4 px-6 py-2 bg-pink-600/80 hover:bg-pink-500 text-white rounded-full text-sm transition-all"
        >
          Play Again 💕
        </button>
      )}
    </div>
  );
}

export default App;
