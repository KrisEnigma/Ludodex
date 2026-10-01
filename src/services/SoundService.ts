/**
 * SoundService — tiny Web Audio synth for reward sounds (no audio files).
 *
 * Design (docs/audit §2.2, decided with Kris): a very soft, constant-pitch
 * tick when a tile is added to the chain (confirms the touch, never hints at
 * right/wrong); reward sounds on finds, the end-of-puzzle transition and the
 * win screen; nothing on wrong attempts. On by default.
 * Style: "terminal blips" — short, clean triangle-wave beeps like a sci-fi UI
 * (chosen over piano / chiptune / neon / FM-bell in an audition).
 *
 *   playSelect()        — soft low tick per tile added to the chain.
 *   playFind(n, total)  — a two-beep blip per found answer, climbing a major
 *                         scale; the last answer gets a quick 4-beep run.
 *   playGlitch(ms)      — end-of-puzzle "corrupt" phase: digital stutters.
 *   playCollapse(ms)    — CRT power-off as the board collapses.
 *   playWinCues(cues)   — the win stinger (chiptune jingle over a soft pad;
 *                         3★ gets a longer two-octave flawless version) plus accents
 *                         per Win-screen beat: star pops, confetti popper,
 *                         time/pill/achievement blips — timed by WinView.
 *
 * The Settings toggle persists `ludodex.sound`.
 * iOS 17+: navigator.audioSession 'ambient' → respects the silent switch and
 * mixes with the player's music instead of interrupting it.
 */
import { Preferences } from '@capacitor/preferences';

const PREF_KEY = 'ludodex.sound';
const MASTER_GAIN = 0.25;

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export async function initSound(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    enabled = value !== 'off';
  } catch {
    enabled = true;
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export async function setSoundEnabled(on: boolean): Promise<void> {
  enabled = on;
  try {
    await Preferences.set({ key: PREF_KEY, value: on ? 'on' : 'off' });
  } catch {
    // Non-critical; the in-memory flag still applies this session.
  }
}

/** Lazily create/resume the context. First called from a user gesture (a find). */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return master ? { ctx, out: master } : null;
  } catch {
    return null;
  }
}

/** One short terminal beep: near-instant attack, clean cut-off. */
function blip(note: number, when = 0, length = 0.06, opts: { wave?: OscillatorType; gain?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.02 + when;
  const peak = opts.gain ?? 0.3;
  const osc = c.createOscillator();
  osc.type = opts.wave ?? 'triangle';
  osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(peak, t0 + 0.002);
  env.gain.setValueAtTime(peak, t0 + Math.max(0.003, length - 0.01));
  env.gain.linearRampToValueAtTime(0.0001, t0 + length);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
let pinkBuffer: AudioBuffer | null = null;

function whiteNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Pink noise (softer, warmer than white) — Paul Kellet's economy filter. */
function pinkNoise(c: AudioContext): AudioBuffer {
  if (!pinkBuffer) {
    pinkBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const data = pinkBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029591;
      b1 = 0.985 * b1 + w * 0.032534;
      b2 = 0.95 * b2 + w * 0.048056;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.6;
    }
  }
  return pinkBuffer;
}

/** Short filtered noise burst (static, pops). White by default; `pink` is softer. */
function noise(when: number, length: number, opts: { type: BiquadFilterType; freq: number; gain: number; freqEnd?: number; pink?: boolean }): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.02 + when;
  const src = c.createBufferSource();
  src.buffer = opts.pink ? pinkNoise(c) : whiteNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + length);
  const env = c.createGain();
  env.gain.setValueAtTime(opts.gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  src.connect(filter);
  filter.connect(env);
  env.connect(out);
  src.start(t0);
  src.stop(t0 + length + 0.02);
}

/**
 * End-of-puzzle glitch ("corrupt" phase): random-pitch square stutters every
 * ~40ms — the same cadence as the letter scramble — over light static.
 */
export function playGlitch(durationMs: number): void {
  if (!enabled) return;
  const total = durationMs / 1000;
  for (let t = 0; t < total; t += 0.04) {
    const note = 55 + Math.floor(Math.random() * 45);
    blip(note, t, 0.018 + Math.random() * 0.012, { wave: 'square', gain: 0.09 });
    if (Math.random() < 0.5) noise(t, 0.03, { type: 'bandpass', freq: 1500 + Math.random() * 4000, gain: 0.12 });
  }
}

/** CRT power-off ("collapse" phase): fast downward sweep + falling static. */
export function playCollapse(durationMs: number): void {
  const a = enabled ? audio() : null;
  if (!a) return;
  const { ctx: c, out } = a;
  const len = durationMs / 1000;
  const t0 = c.currentTime + 0.02;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + len);
  const env = c.createGain();
  env.gain.setValueAtTime(0.22, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + len + 0.02);
  noise(0, len, { type: 'lowpass', freq: 6000, freqEnd: 300, gain: 0.1 });
  blip(96, len, 0.012, { gain: 0.12 }); // tiny "tick" as the line vanishes
}

/**
 * A tile was added to the chain: low, soft, short — same pitch every time so
 * it carries no right/wrong information.
 */
export function playSelect(): void {
  if (!enabled) return;
  blip(57, 0, 0.03, { gain: 0.08 }); // A3
}

// C major from E5 upward (MIDI note numbers).
const FIND_SCALE = [76, 79, 81, 84, 86, 88]; // E5 G5 A5 C6 D6 E6

/** A word was found: `found` is how many answers are now solved (1-based). */
export function playFind(found: number, total: number): void {
  if (!enabled) return;
  if (total > 0 && found >= total) {
    // Last answer: quick ascending run.
    [76, 79, 83, 88].forEach((n, i) => blip(n, i * 0.06, 0.06));
    return;
  }
  const n = FIND_SCALE[Math.min(FIND_SCALE.length - 1, Math.max(0, found - 1))];
  blip(n, 0, 0.05);
  blip(n + 7, 0.07, 0.06); // up a fifth
}

/**
 * Win screen: one sound per visual beat, scheduled by WinView so audio and
 * animation share a single timeline (`at` = ms after the Win view mounts).
 */
export type WinCue =
  | { at: number; kind: 'stinger'; flawless: boolean } // THE win sound; 3★ gets the longer flawless version
  | { at: number; kind: 'star'; index: 0 | 1 | 2 } // a filled star lands
  | { at: number; kind: 'confetti' } // 3★ confetti launch
  | { at: number; kind: 'time' } // solve time lands
  | { at: number; kind: 'pill' } // NEW BEST / NEW RATING / freeze pill
  | { at: number; kind: 'unlock'; index: number }; // achievement card #index lands

const UNLOCK_STEPS = [0, 2, 4, 5, 7, 9]; // major-scale lift per achievement card
const STAR_POP_HZ = [620, 780, 940]; // each star's pop starts a little higher

/**
 * General synth voice for the win stinger: attack → exponential decay, with
 * optional low-pass, vibrato (cents) and detune (cents).
 */
function synth(
  wave: OscillatorType,
  note: number,
  when: number,
  dur: number,
  gain: number,
  { attack = 0.005, lowpass = 0, vibrato = 0, detune = 0 }: { attack?: number; lowpass?: number; vibrato?: number; detune?: number } = {}
): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.02 + when;
  const osc = c.createOscillator();
  osc.type = wave;
  osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
  osc.detune.value = detune;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = osc;
  if (lowpass) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(env);
  env.connect(out);
  if (vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = vibrato;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/**
 * THE win stinger (approved "hybrid"): a chiptune "level clear" jingle on top
 * of a soft detuned-saw pad swell ("system online") for warmth.
 */
function winStinger(when: number): void {
  // Pad: C3 G3 C4 E4 G4, two detuned saws each, slow attack, low-passed.
  [48, 55, 60, 64, 67].forEach((n, i) => {
    for (const d of [-6, 6]) {
      synth('sawtooth', n, when + i * 0.03, 1.5, 0.025 * 0.8, { attack: 0.25, lowpass: 1800, detune: d });
    }
  });
  // Jingle: G4 C5 E5 G5 → held C6 with vibrato, plus a triangle C4 underneath.
  const steps: Array<[note: number, at: number, len: number]> = [[67, 0, 0.09], [72, 0.09, 0.09], [76, 0.18, 0.09], [79, 0.27, 0.09], [84, 0.38, 0.5]];
  for (const [n, at, len] of steps) {
    const held = at === 0.38;
    synth('square', n, when + at, held ? len + 0.3 : len + 0.04, 0.09 * 0.85, { lowpass: 3500, vibrato: held ? 18 : 0 });
  }
  synth('triangle', 60, when + 0.38, 0.8, 0.12 * 0.85);
}

/**
 * Flawless (3★) stinger (approved "Flawless B"): two-octave major arpeggio
 * C5 → C7 in the jingle's square voice (top note held with vibrato), landing
 * on a higher, fuller pad than the normal stinger (7-note major add9 voicing,
 * brighter, longer swell) with a soft high shimmer.
 */
function flawlessStinger(when: number): void {
  const notes = [72, 76, 79, 84, 88, 91, 96]; // C5 E5 G5 C6 E6 G6 C7
  const gap = 0.07;
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    synth('square', n, when + i * gap, last ? 0.9 : gap + 0.04, 0.085, { lowpass: 3600, vibrato: last ? 20 : 0 });
  });
  const end = when + (notes.length - 1) * gap;
  synth('triangle', 60, end, 1.1, 0.1); // C4 body under the held note
  // High pad: C4 E4 G4 C5 D5 E5 G5, two detuned saws each.
  [60, 64, 67, 72, 74, 76, 79].forEach((n, i) => {
    for (const d of [-7, 7]) {
      synth('sawtooth', n, end - 0.1 + i * 0.04, 2.4, 0.017, { attack: 0.35, lowpass: 2600, detune: d });
    }
  });
  synth('triangle', 96, end + 0.15, 1.6, 0.05, { vibrato: 12 }); // shimmer
}

/** Percussive pop: sine with a fast downward pitch drop (star landing). */
function pop(startHz: number, when: number, gain = 0.32): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.02 + when;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startHz, t0);
  osc.frequency.exponentialRampToValueAtTime(startHz * 0.35, t0 + 0.07);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.13);
}

const POPPER_LEVEL = 0.3; // approved: 30% of the original (it was too loud)

/** Confetti launch: party popper — low thump + sharp paper crack + short tail. */
function partyPopper(when: number): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.02 + when;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.06);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(0.9 * POPPER_LEVEL, t0 + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.1);
  noise(when, 0.09, { type: 'highpass', freq: 1200, gain: 0.9 * POPPER_LEVEL, pink: true }); // crack
  noise(when + 0.005, 0.25, { type: 'bandpass', freq: 3000, freqEnd: 1200, gain: 0.18 * POPPER_LEVEL, pink: true }); // paper tail
}

export function playWinCues(cues: WinCue[]): void {
  if (!enabled) return;
  for (const cue of cues) {
    const s = cue.at / 1000;
    switch (cue.kind) {
      case 'stinger':
        if (cue.flawless) flawlessStinger(s);
        else winStinger(s);
        break;
      case 'star':
        pop(STAR_POP_HZ[cue.index], s);
        break;
      case 'confetti':
        partyPopper(s);
        break;
      case 'time': // terminal "readout": two quick same-pitch beeps
        blip(67, s, 0.04);
        blip(67, s + 0.06, 0.04);
        break;
      case 'pill':
        blip(88, s, 0.06);
        break;
      case 'unlock': { // two-tone up, rising a scale step per card
        const lift = UNLOCK_STEPS[Math.min(UNLOCK_STEPS.length - 1, cue.index)];
        blip(79 + lift, s, 0.05);
        blip(84 + lift, s + 0.06, 0.07);
        break;
      }
    }
  }
}
