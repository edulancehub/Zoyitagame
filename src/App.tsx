import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import confetti from 'canvas-confetti';
import { Pause, Play, RotateCcw, Home, Volume2, VolumeX, Heart, Flower, Mail } from 'lucide-react';
import { Engine, type Input, type Stats } from './game/engine';
import { LEVELS } from './game/levels';
import { isMuted, playSound, setMuted, unlockAudio } from './game/audio';

type Screen = 'menu' | 'playing' | 'levelDone' | 'proposal' | 'finale';

const NO_LINES = ['No', 'Are you sure?', 'Really sure?', 'Think again 🥺', 'Pleaseee', "Can't catch me", 'Just say yes 💗'];

const isTouchDevice = () =>
  typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

export default function App() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const toastTimer = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>('menu');
  const [level, setLevel] = useState(0);
  const [stats, setStats] = useState<Stats>({ hearts: 0, totalHearts: 3, flowers: 0, totalFlowers: 0 });
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [intro, setIntro] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [touch] = useState(isTouchDevice);

  const showToast = useCallback((text: string, ms = 2600) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // Engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const engine = new Engine(canvas, {
      onStats: s => setStats(s),
      onLevelComplete: s => {
        setStats(s);
        setScreen('levelDone');
      },
      onToast: text => showToast(text),
      onSound: s => playSound(s),
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine });
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      engine.resize(r.width, r.height);
    });
    ro.observe(frame);
    engine.start();
    return () => {
      ro.disconnect();
      engine.stop();
    };
  }, [showToast]);

  const input = (): Input => engineRef.current!.input;

  const clearInput = () => {
    if (!engineRef.current) return;
    Object.assign(engineRef.current.input, { left: false, right: false, jump: false });
  };

  const beginLevel = useCallback((idx: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.loadLevel(idx, 'play');
    setLevel(idx);
    setPaused(false);
    setScreen('playing');
    setIntro(idx);
    window.setTimeout(() => setIntro(cur => (cur === idx ? null : cur)), 2800);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __begin: beginLevel });
  }, [beginLevel]);

  const startGame = () => {
    unlockAudio();
    playSound('click');
    beginLevel(0);
  };

  const continueAfterLevel = () => {
    playSound('click');
    if (level < LEVELS.length - 1) beginLevel(level + 1);
    else {
      engineRef.current?.loadLevel(LEVELS.length - 1, 'attract');
      setScreen('proposal');
    }
  };

  const goMenu = () => {
    clearInput();
    engineRef.current?.loadLevel(0, 'attract');
    setPaused(false);
    setScreen('menu');
  };

  const togglePause = useCallback(() => {
    if (screen !== 'playing') return;
    setPaused(p => {
      const next = !p;
      engineRef.current?.setMode(next ? 'frozen' : 'play');
      return next;
    });
    clearInput();
  }, [screen]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) {
      unlockAudio();
      playSound('click');
    }
  };

  // Keyboard
  useEffect(() => {
    const map: Record<string, keyof Input> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    };
    const down = (e: KeyboardEvent) => {
      const key = map[e.code];
      if (key) {
        e.preventDefault();
        if (engineRef.current) engineRef.current.input[key] = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
      if (e.code === 'Enter') {
        if (screen === 'menu') startGame();
        else if (screen === 'levelDone') continueAfterLevel();
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = map[e.code];
      if (key && engineRef.current) engineRef.current.input[key] = false;
    };
    const blur = () => clearInput();
    const vis = () => {
      if (document.hidden && screen === 'playing' && !paused) togglePause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    };
  });

  const hold = (key: keyof Input) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      input()[key] = true;
    },
    onPointerUp: () => { input()[key] = false; },
    onPointerCancel: () => { input()[key] = false; },
    onLostPointerCapture: () => { input()[key] = false; },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  const lvl = LEVELS[level];

  return (
    <div className={`app ${touch ? 'is-touch' : ''}`}>
      <div className="frame" ref={frameRef}>
        <canvas ref={canvasRef} className="game-canvas" />

        {screen === 'playing' && (
          <div className="hud">
            <div className="hud-pill">
              <span className="hud-level">{level + 1}/{LEVELS.length}</span>
              <span className="hud-title">{lvl.title}</span>
            </div>
            <div className="hud-pill hud-hearts" aria-label={`${stats.hearts} of ${stats.totalHearts} hearts`}>
              {Array.from({ length: stats.totalHearts }, (_, i) => (
                <Heart key={i} className={i < stats.hearts ? 'heart on' : 'heart'} size={18} />
              ))}
            </div>
            <div className="hud-right">
              <div className="hud-pill">
                <Flower size={16} className="flower-icon" />
                <span>{stats.flowers}/{stats.totalFlowers}</span>
              </div>
              <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button className="icon-btn" onClick={togglePause} aria-label="Pause">
                <Pause size={18} />
              </button>
            </div>
          </div>
        )}

        {screen === 'playing' && intro !== null && (
          <div className="intro" key={intro}>
            <div className="intro-kicker">Level {intro + 1}</div>
            <div className="intro-title">{LEVELS[intro].title}</div>
            <div className="intro-hint">{LEVELS[intro].hint}</div>
          </div>
        )}

        {screen === 'playing' && toast && intro === null && (
          <div className="toast" key={toast.id}>{toast.text}</div>
        )}
      </div>

      {screen === 'playing' && touch && !paused && (
        <div className="controls">
          <div className="controls-group">
            <button className="pad" aria-label="Left" {...hold('left')}>
              <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button className="pad" aria-label="Right" {...hold('right')}>
              <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <button className="pad pad-jump" aria-label="Jump" {...hold('jump')}>
            <svg viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
          </button>
          <p className="rotate-hint">Tip: turn your phone sideways for a bigger view</p>
        </div>
      )}

      {screen === 'menu' && <MenuScreen onStart={startGame} touch={touch} muted={muted} onToggleMute={toggleMute} />}

      {paused && screen === 'playing' && (
        <div className="overlay">
          <div className="card card-sm">
            <h2 className="card-title">Paused</h2>
            <div className="stack">
              <button className="btn btn-primary" onClick={togglePause}><Play size={18} /> Resume</button>
              <button className="btn btn-ghost" onClick={() => beginLevel(level)}><RotateCcw size={18} /> Restart level</button>
              <button className="btn btn-ghost" onClick={goMenu}><Home size={18} /> Main menu</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'levelDone' && <LevelDone level={level} stats={stats} onContinue={continueAfterLevel} />}

      {screen === 'proposal' && (
        <Proposal
          onYes={() => {
            playSound('win');
            setScreen('finale');
          }}
        />
      )}

      {screen === 'finale' && <Finale onReplay={goMenu} />}
    </div>
  );
}

function MenuScreen({ onStart, touch, muted, onToggleMute }: { onStart: () => void; touch: boolean; muted: boolean; onToggleMute: () => void }) {
  return (
    <div className="overlay overlay-soft">
      <button className="icon-btn corner" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <div className="menu">
        <p className="eyebrow">a little jungle adventure for</p>
        <h1 className="name">Zoyita</h1>
        <p className="lede">Explore three magical places, collect the hearts, and uncover the secret hidden in the jungle.</p>
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          <Play size={20} fill="currentColor" /> Start adventure
        </button>
        <div className="keys">
          {touch ? (
            <span>Use the on-screen buttons to move and jump</span>
          ) : (
            <>
              <span><kbd>←</kbd><kbd>→</kbd> move</span>
              <span><kbd>Space</kbd> jump</span>
              <span><kbd>Esc</kbd> pause</span>
            </>
          )}
        </div>
        <div className="steps">
          {LEVELS.map((l, i) => (
            <div className="step" key={l.title}>
              <span className="step-num">{i + 1}</span>
              <span className="step-name">{l.title.replace('The ', '')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LevelDone({ level, stats, onContinue }: { level: number; stats: Stats; onContinue: () => void }) {
  const last = level === LEVELS.length - 1;
  return (
    <div className="overlay">
      <div className="card">
        <p className="eyebrow">Secret {level + 1} of {LEVELS.length} found</p>
        <div className="secret-word">{LEVELS[level].secret}</div>
        <div className="chips">
          {LEVELS.map((l, i) => (
            <span key={i} className={`chip ${i <= level ? 'chip-on' : ''} ${i === level ? 'chip-new' : ''}`}>
              {i <= level ? l.secret : '? ? ?'}
            </span>
          ))}
        </div>
        <div className="stat-row">
          <span><Heart size={16} className="heart on" /> {stats.hearts}/{stats.totalHearts}</span>
          <span><Flower size={16} className="flower-icon" /> {stats.flowers}/{stats.totalFlowers}</span>
        </div>
        <p className="muted">{last ? 'All three secrets are yours. Ready to read them together?' : 'More secrets wait deeper in the jungle…'}</p>
        <button className="btn btn-primary btn-lg" onClick={onContinue} autoFocus>
          {last ? <>Read the message <Mail size={18} /></> : 'Next level'}
        </button>
      </div>
    </div>
  );
}

function Proposal({ onYes }: { onYes: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [tries, setTries] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);

  const scaleFor = (t: number) => 1 + Math.min(t, 6) * 0.1;

  // Returns a checker for whether the No button, translated by (x, y), stays on screen and clear of Yes.
  const fitter = (yesScale: number, extraNoW: number) => {
    const yesEl = yesRef.current;
    const noEl = noRef.current;
    if (!yesEl || !noEl) return null;
    const pad = 20;
    const yr = yesEl.getBoundingClientRect();
    const cx = (yr.left + yr.right) / 2;
    const cy = (yr.top + yr.bottom) / 2;
    const yhw = (yesEl.offsetWidth / 2) * yesScale + pad;
    const yhh = (yesEl.offsetHeight / 2) * yesScale + pad;
    const nr = noEl.getBoundingClientRect();
    const m = new DOMMatrix(getComputedStyle(noEl).transform);
    const baseL = nr.left - m.m41;
    const baseT = nr.top - m.m42;
    const w = noEl.offsetWidth + extraNoW;
    const h = noEl.offsetHeight;
    return (x: number, y: number) => {
      const l = baseL + x;
      const t = baseT + y;
      const inView = l > 10 && l + w < window.innerWidth - 10 && t > 10 && t + h < window.innerHeight - 10;
      const hitsYes = l < cx + yhw && l + w > cx - yhw && t < cy + yhh && t + h > cy - yhh;
      return inView && !hitsYes;
    };
  };

  const nearestFit = (fits: (x: number, y: number) => boolean, from: { x: number; y: number }) => {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let x = -window.innerWidth; x <= window.innerWidth; x += 16) {
      for (let y = -180; y <= 180; y += 15) {
        if (!fits(x, y)) continue;
        const d = Math.hypot(x - from.x, (y - from.y) * 1.5);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  };

  const dodge = () => {
    const fits = fitter(scaleFor(tries + 1), 60);
    if (!fits) return;
    const area = areaRef.current?.getBoundingClientRect();
    const halfW = Math.min(window.innerWidth / 2, (area?.width ?? 400) / 2 + 80);
    let next: { x: number; y: number } | null = null;
    for (let i = 0; i < 60 && !next; i++) {
      const cand = { x: pos.x + (Math.random() * 2 - 1) * halfW, y: pos.y + (Math.random() * 2 - 1) * 90 };
      const moved = Math.abs(cand.x - pos.x) > 50 || Math.abs(cand.y - pos.y) > 40;
      if (Math.abs(cand.y) <= 180 && moved && fits(cand.x, cand.y)) next = cand;
    }
    setPos(next ?? nearestFit(fits, pos) ?? pos);
    setTries(t => t + 1);
    playSound('click');
  };

  useLayoutEffect(() => {
    if (tries === 0) return;
    const fits = fitter(scaleFor(tries), 0);
    if (!fits || fits(pos.x, pos.y)) return;
    const fixed = nearestFit(fits, pos);
    if (fixed) setPos(fixed);
  }, [pos, tries]);

  const yesScale = scaleFor(tries);

  return (
    <div className="overlay overlay-love">
      <FloatingHearts />
      <div className="proposal">
        <p className="line line-1">I love u</p>
        <p className="line line-2 name">Zoyita</p>
        <p className="line line-3">will u be mine?</p>
        <div className="answer" ref={areaRef}>
          <button ref={yesRef} className="btn btn-love btn-lg btn-yes" style={{ transform: `scale(${yesScale})` }} onClick={onYes}>
            Yes <Heart size={20} fill="currentColor" />
          </button>
          <button
            ref={noRef}
            className="btn btn-ghost btn-no"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            onPointerEnter={e => e.pointerType === 'mouse' && dodge()}
            onPointerDown={e => {
              e.preventDefault();
              dodge();
            }}
            onClick={e => {
              e.preventDefault();
              dodge();
            }}
          >
            {NO_LINES[Math.min(tries, NO_LINES.length - 1)]}
          </button>
        </div>
      </div>
    </div>
  );
}

function Finale({ onReplay }: { onReplay: () => void }) {
  useEffect(() => {
    const colors = ['#ff6fa8', '#ffd36e', '#ffffff', '#ff9ac4', '#c8ff9e'];
    const end = Date.now() + 3500;
    let raf = 0;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    confetti({ particleCount: 140, spread: 100, origin: { y: 0.55 }, colors, scalar: 1.1 });
    frame();
    return () => {
      cancelAnimationFrame(raf);
      confetti.reset();
    };
  }, []);

  return (
    <div className="overlay overlay-love">
      <FloatingHearts dense />
      <div className="proposal">
        <p className="line line-1">You said yes!</p>
        <p className="line line-2 name">Forever us</p>
        <p className="line line-3">You just made me the happiest person in the whole jungle 💕</p>
        <button className="btn btn-ghost reveal" onClick={onReplay}>
          <RotateCcw size={18} /> Play again
        </button>
      </div>
    </div>
  );
}

function FloatingHearts({ dense = false }: { dense?: boolean }) {
  const [hearts] = useState(() =>
    Array.from({ length: dense ? 28 : 16 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 12 + Math.random() * 22,
      delay: Math.random() * 8,
      duration: 7 + Math.random() * 7,
      opacity: 0.25 + Math.random() * 0.5,
    })),
  );
  return (
    <div className="float-hearts" aria-hidden>
      {hearts.map(h => (
        <span
          key={h.id}
          style={{
            left: `${h.left}%`,
            fontSize: h.size,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.duration}s`,
            opacity: h.opacity,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
