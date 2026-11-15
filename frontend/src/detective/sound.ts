// Nature sound effects made with the browser's audio API. No audio files to ship.
// Birds for good news, an owl for a miss, wind for running out of time, crickets for the clock.
// The audio context is created on the first click, which browsers require.

const KEY = "detective.sound";
let ctx: AudioContext | null = null;

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: ignore */
  }
}

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** A bird chirp: a quick pitch glide from f0 to f1 Hz. */
function chirp(c: AudioContext, f0: number, f1: number, at: number, len = 0.09, vol = 0.1) {
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.02);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + len + 0.06);
}

/** A soft low "hoo", like an owl. */
function hoot(c: AudioContext, freq: number, at: number, len = 0.28, vol = 0.18) {
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  o.type = "sine";
  o.frequency.setValueAtTime(freq * 1.06, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + len + 0.05);
}

/** Filtered noise: wind (slow sweep) or leaves (short, bright). */
function noise(c: AudioContext, at: number, len: number, f0: number, f1: number, vol: number) {
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  const t = c.currentTime + at;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.linearRampToValueAtTime(f1, t + len);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + len * 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export type Sfx = "right" | "wrong" | "late" | "streak" | "flip" | "tick" | "star";

export function play(name: Sfx) {
  if (!soundOn()) return;
  const c = audio();
  if (!c) return;
  switch (name) {
    case "right": // two bird chirps
      chirp(c, 2200, 3200, 0);
      chirp(c, 2600, 3600, 0.13);
      break;
    case "streak": // a songbird trill
      for (let i = 0; i < 6; i++) chirp(c, 2400 + i * 160, 3300 + i * 160, i * 0.07, 0.06, 0.09);
      chirp(c, 3000, 4200, 0.5, 0.18, 0.1);
      break;
    case "wrong": // owl: hoo, hoo
      hoot(c, 330, 0);
      hoot(c, 294, 0.34);
      break;
    case "late": // a gust of wind
      noise(c, 0, 0.9, 500, 1400, 0.22);
      break;
    case "flip": // leaves rustle
      noise(c, 0, 0.18, 3500, 5500, 0.16);
      break;
    case "tick": // a cricket
      chirp(c, 4300, 4300, 0, 0.025, 0.05);
      chirp(c, 4300, 4300, 0.05, 0.025, 0.05);
      break;
    case "star": // dawn chorus
      chirp(c, 2000, 3000, 0, 0.1);
      chirp(c, 2500, 3800, 0.15, 0.1);
      chirp(c, 1800, 2800, 0.3, 0.1);
      chirp(c, 3000, 4200, 0.45, 0.16);
      break;
  }
}
