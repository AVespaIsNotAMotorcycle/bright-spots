// Tiny sound effects made with the browser's audio API. No audio files to ship.
// The sound is created on the first click, which browsers require.

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

/** One soft note: frequency in Hz, start offset and length in seconds. */
function note(c: AudioContext, freq: number, at: number, len: number, type: OscillatorType = "sine", vol = 0.16) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + len + 0.05);
}

export type Sfx = "right" | "wrong" | "late" | "streak" | "flip" | "tick" | "star";

export function play(name: Sfx) {
  if (!soundOn()) return;
  const c = audio();
  if (!c) return;
  switch (name) {
    case "right": // two rising notes
      note(c, 523, 0, 0.16);
      note(c, 784, 0.1, 0.26);
      break;
    case "streak": // three rising notes, brighter
      note(c, 523, 0, 0.14, "triangle");
      note(c, 659, 0.09, 0.14, "triangle");
      note(c, 784, 0.18, 0.14, "triangle");
      note(c, 1047, 0.27, 0.34, "triangle");
      break;
    case "wrong": // low buzz
      note(c, 196, 0, 0.28, "sawtooth", 0.09);
      note(c, 147, 0.12, 0.34, "sawtooth", 0.09);
      break;
    case "late": // falling pair
      note(c, 392, 0, 0.16, "square", 0.07);
      note(c, 262, 0.14, 0.3, "square", 0.07);
      break;
    case "flip":
      note(c, 330, 0, 0.12, "triangle", 0.08);
      note(c, 494, 0.06, 0.12, "triangle", 0.08);
      break;
    case "tick":
      note(c, 880, 0, 0.05, "square", 0.04);
      break;
    case "star":
      note(c, 784, 0, 0.12, "triangle");
      note(c, 988, 0.1, 0.12, "triangle");
      note(c, 1319, 0.2, 0.3, "triangle");
      break;
  }
}
