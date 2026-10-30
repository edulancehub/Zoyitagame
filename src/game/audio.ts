export type SoundName = 'jump' | 'land' | 'flower' | 'heart' | 'spring' | 'hurt' | 'open' | 'win' | 'click';

const STORAGE_KEY = 'zoyita-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; delay?: number } = {}) {
  const ac = ensure();
  if (!ac || !master) return;
  const { type = 'sine', vol = 0.5, to, delay = 0 } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playSound(name: SoundName) {
  if (muted) return;
  switch (name) {
    case 'jump':
      tone(380, 0.16, { type: 'triangle', vol: 0.25, to: 720 });
      break;
    case 'land':
      tone(140, 0.08, { type: 'sine', vol: 0.2, to: 90 });
      break;
    case 'flower':
      tone(988, 0.12, { vol: 0.25 });
      tone(1318, 0.18, { vol: 0.2, delay: 0.06 });
      break;
    case 'heart':
      [659, 831, 988, 1318].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, delay: i * 0.07 }));
      break;
    case 'spring':
      tone(220, 0.3, { type: 'sine', vol: 0.35, to: 880 });
      break;
    case 'hurt':
      tone(330, 0.3, { type: 'sawtooth', vol: 0.12, to: 110 });
      break;
    case 'open':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, { vol: 0.2, delay: i * 0.1 }));
      break;
    case 'win':
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.22, delay: i * 0.12 }));
      break;
    case 'click':
      tone(660, 0.08, { type: 'triangle', vol: 0.2 });
      break;
  }
}
