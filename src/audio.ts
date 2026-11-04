let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let noiseBuf: AudioBuffer | null = null;
let engOsc: OscillatorNode | null = null, engOsc2: OscillatorNode | null = null, engGain: GainNode | null = null, engFilter: BiquadFilterNode | null = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.7 : 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

export function setSound(on: boolean) {
  enabled = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export const sfx = {
  plow() { noise(0.18, 0.35, 700); tone(110, 0.12, 'triangle', 0.25, 60); },
  plant() { tone(520, 0.08, 'sine', 0.12, 780); noise(0.06, 0.08, 3000, 'highpass'); },
  water() { noise(0.35, 0.12, 2200, 'bandpass'); },
  harvest(combo: number) {
    const semis = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    const f = 440 * Math.pow(2, semis[Math.min(combo, semis.length - 1)] / 12);
    tone(f, 0.12, 'triangle', 0.16); tone(f * 2, 0.08, 'sine', 0.05, 0, 0.02);
    noise(0.07, 0.12, 1800, 'highpass');
  },
  coin() { tone(988, 0.07, 'square', 0.06); tone(1319, 0.18, 'square', 0.06, 0, 0.07); },
  buy() { tone(523, 0.1, 'triangle', 0.15); tone(659, 0.1, 'triangle', 0.15, 0, 0.08); tone(784, 0.2, 'triangle', 0.15, 0, 0.16); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, 0, i * 0.1)); tone(1568, 0.5, 'sine', 0.08, 0, 0.42); },
  error() { tone(200, 0.15, 'square', 0.06, 140); },
  click() { tone(800, 0.04, 'sine', 0.08); },
  fill() { noise(0.5, 0.15, 900, 'bandpass'); tone(300, 0.4, 'sine', 0.05, 600); },
  chirp() { const f = 2200 + Math.random() * 1500; tone(f, 0.08, 'sine', 0.03, f * 1.4); tone(f * 1.1, 0.07, 'sine', 0.025, f * 0.9, 0.12); },
  door() { tone(180, 0.2, 'triangle', 0.15, 90); },
  combo() { tone(1047, 0.1, 'square', 0.05); tone(1568, 0.25, 'triangle', 0.1, 0, 0.08); },
  shoot(k: number) {
    if (k === 2) { tone(1800, 0.18, 'sawtooth', 0.04, 300); noise(0.12, 0.05, 4000, 'highpass'); }
    else if (k === 1) { tone(300, 0.15, 'sine', 0.08, 120); }
    else if (k === 3) { tone(700, 0.06, 'square', 0.05, 220); noise(0.06, 0.12, 2500, 'bandpass'); }
    else { tone(520, 0.05, 'square', 0.04, 260); }
  },
  whack() { noise(0.12, 0.35, 900); tone(140, 0.12, 'triangle', 0.25, 70); },
  swing() { noise(0.15, 0.12, 1800, 'bandpass'); },
  splat() { noise(0.18, 0.25, 600); tone(180, 0.15, 'sine', 0.12, 60); },
  boom() { noise(0.9, 0.6, 400); tone(80, 0.7, 'sine', 0.4, 30); },
  groan(big: boolean) { const f = big ? 70 : 110 + Math.random() * 40; tone(f, 0.9, 'sawtooth', 0.05, f * 0.7); tone(f * 1.5, 0.8, 'sine', 0.03, f); },
  night() { tone(110, 2.2, 'sawtooth', 0.06, 82); tone(165, 2.2, 'sine', 0.05, 123); tone(55, 2.5, 'sine', 0.12); },
  gameover() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, 0, i * 0.28)); },
};

export function engine(on: boolean, speed = 0) {
  if (!ctx || !master) return;
  if (on && !engOsc) {
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth';
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'square';
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 300;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilter); engOsc2.connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
    engOsc.start(); engOsc2.start();
  }
  if (!engOsc || !engGain || !engOsc2 || !engFilter) return;
  const t = ctx.currentTime;
  if (!on) {
    engGain.gain.setTargetAtTime(0, t, 0.1);
    const o1 = engOsc, o2 = engOsc2;
    setTimeout(() => { try { o1.stop(); o2.stop(); } catch { /* */ } }, 500);
    engOsc = engOsc2 = null; engGain = null; engFilter = null;
    return;
  }
  const s = Math.min(1, Math.abs(speed));
  engOsc.frequency.setTargetAtTime(38 + s * 45, t, 0.1);
  engOsc2.frequency.setTargetAtTime(19 + s * 22, t, 0.1);
  engFilter.frequency.setTargetAtTime(260 + s * 500, t, 0.1);
  engGain.gain.setTargetAtTime(0.09 + s * 0.06, t, 0.1);
}
