// Nature sound effects made with the browser's audio API. No audio files to ship.
// Water drops and bamboo chimes for good news, a soft hollow-log knock for a miss,
// warbling birdsong for streaks and wins, leaf crackle for card flips, wind and crickets
// for the clock. Everything plays through a quiet "forest" echo and a soft top-end filter,
// so nothing sounds like an electronic beep.
// The audio context is created on the first click, which browsers require.

const KEY = "detective.sound";
let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;

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

/** A short, soft room tail made from decaying noise: sounds like an open forest, not a hall. */
function forestEcho(c: AudioContext): ConvolverNode {
  const len = Math.floor(c.sampleRate * 1.1);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = c.createConvolver();
  conv.buffer = buf;
  return conv;
}

function audio(): { c: AudioContext; out: AudioNode } | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // master: gentle level -> soften highs -> dry + a little echo
    const master = ctx.createGain();
    master.gain.value = 0.55;
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 6500;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const echo = forestEcho(ctx);
    master.connect(soft);
    soft.connect(ctx.destination);
    soft.connect(echo).connect(wet).connect(ctx.destination);
    bus = master;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: bus! };
}

/** Smooth attack/decay envelope on a gain node. */
function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** A water drop: a sine that rises fast in pitch and fades quickly ("plip"). */
function drop(c: AudioContext, out: AudioNode, at: number, base = 520, vol = 0.32) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.07);
  env(g, t, vol, 0.004, 0.14);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

/** A bamboo wind-chime note: a soft sine with a quiet wooden overtone and a long ring. */
function chime(c: AudioContext, out: AudioNode, freq: number, at: number, vol = 0.16, ring = 1.1) {
  const t = c.currentTime + at;
  for (const [mult, v, r] of [[1, vol, ring], [2.76, vol * 0.18, ring * 0.35]] as const) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * mult, t);
    env(g, t, v, 0.006, r);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + r + 0.05);
  }
}

/** One birdsong note: a pitch contour with fast warble (frequency modulation), like a real syrinx. */
function birdNote(
  c: AudioContext, out: AudioNode, at: number,
  f0: number, f1: number, len: number, warbleHz = 32, warbleDepth = 180, vol = 0.09,
) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const depth = c.createGain();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len);
  lfo.frequency.value = warbleHz;
  depth.gain.value = warbleDepth;
  lfo.connect(depth).connect(o.frequency);
  // rounded envelope: birds swell in and out, they do not click on
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + len * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + len + 0.03);
  lfo.stop(t + len + 0.03);
}

/** A hollow log knock: a low, quickly damped tone with a woody click. Gentle, not a buzzer. */
function knock(c: AudioContext, out: AudioNode, at: number, freq = 190, vol = 0.32) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  env(g, t, vol, 0.003, 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function noiseBuffer(c: AudioContext, len: number, shape: (i: number, n: number) => number) {
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * shape(i, n);
  return buf;
}

/** Leaves: many tiny crackles (sparse noise grains), not a steady hiss. */
function leaves(c: AudioContext, out: AudioNode, at: number, len = 0.32, vol = 0.5) {
  const t = c.currentTime + at;
  const grains = noiseBuffer(c, len, (i, n) => {
    const fade = Math.sin((Math.PI * i) / n);
    return Math.random() < 0.06 ? fade : fade * 0.08; // sparse pops on a faint bed
  });
  const src = c.createBufferSource();
  src.buffer = grains;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6000;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(hp).connect(lp).connect(g).connect(out);
  src.start(t);
}

/** Wind: low noise whose filter and level drift slowly, like a gust through pines. */
function wind(c: AudioContext, out: AudioNode, at: number, len = 1.6, vol = 0.35) {
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, len, () => 1);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(350, t);
  f.frequency.linearRampToValueAtTime(900, t + len * 0.45);
  f.frequency.linearRampToValueAtTime(420, t + len);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + len * 0.4);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + len * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** A cricket chirp: a high tone pulsed about 30 times a second, three pulses long. */
function cricket(c: AudioContext, out: AudioNode, at: number, vol = 0.05) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = 4400;
  g.gain.setValueAtTime(0, t);
  for (let k = 0; k < 3; k++) {
    const s = t + k * 0.033;
    g.gain.linearRampToValueAtTime(vol, s + 0.006);
    g.gain.linearRampToValueAtTime(0, s + 0.022);
  }
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.12);
}

// Pentatonic notes (C D E G A) sound pleasant in any order, like real wind chimes.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

export type Sfx = "right" | "wrong" | "late" | "streak" | "flip" | "tick" | "star";

export function play(name: Sfx) {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  switch (name) {
    case "right": // two water drops and a soft chime
      drop(c, out, 0, 520);
      drop(c, out, 0.09, 660, 0.26);
      chime(c, out, PENTA[4], 0.05, 0.08, 0.7);
      break;
    case "streak": // a warbling songbird phrase over rising chimes
      birdNote(c, out, 0, 2600, 3400, 0.12);
      birdNote(c, out, 0.15, 3400, 2700, 0.1, 40, 220);
      birdNote(c, out, 0.28, 2800, 3900, 0.16, 28, 160);
      [0, 2, 4].forEach((n, i) => chime(c, out, PENTA[n + 2], 0.05 + i * 0.12, 0.09, 0.9));
      break;
    case "wrong": // a soft hollow-log knock, twice, falling: "not quite"
      knock(c, out, 0, 210);
      knock(c, out, 0.16, 165, 0.26);
      break;
    case "late": // a gust of wind through the pines
      wind(c, out, 0);
      break;
    case "flip": // leaves crackle
      leaves(c, out, 0);
      break;
    case "tick": // one cricket chirp
      cricket(c, out, 0);
      break;
    case "star": // dawn: birds call back and forth, chimes ring out
      birdNote(c, out, 0, 2200, 3100, 0.18);
      birdNote(c, out, 0.25, 3300, 2500, 0.14, 38, 200);
      birdNote(c, out, 0.5, 2600, 3800, 0.2, 30, 150);
      birdNote(c, out, 0.85, 3000, 2400, 0.12, 44, 240, 0.07);
      PENTA.slice(0, 5).forEach((f, i) => chime(c, out, f, 0.1 + i * 0.14, 0.08, 1.3));
      break;
  }
}
