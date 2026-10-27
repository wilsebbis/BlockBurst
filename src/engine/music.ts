/**
 * Background music, synthesised live like every other sound (no audio files): a soft lo-fi music box. Each
 * place in the game has its own little tune (key, tempo, chords and instrument), with melodies composed on the
 * fly in an A A' B A shape so it never loops audibly. A crowded board adds a gentle shaker to lift the tension,
 * and it all ducks under the results. Purely audio: nothing here reads the rules.
 */
import { createRng } from "./rng";

export type MusicTheme =
  | "menu"
  | "meadow"
  | "forest"
  | "pond"
  | "beach"
  | "underwater"
  | "caverns"
  | "mines"
  | "snow"
  | "sky"
  | "nursery"
  | "twilight";

interface Voice {
  type: OscillatorType;
  attack: number;
  decay: number;
  gain: number;
  /** Lowpass cutoff in Hz (none if omitted). */
  filter?: number;
  /** A quiet overtone at this frequency ratio, for bells and glass. */
  overtone?: number;
}

interface Theme {
  bpm: number;
  /** MIDI note of the key's root. */
  root: number;
  /** Chords as semitone offsets from the root, one per bar. */
  chords: number[][];
  /** Eighth notes per bar: 8 for 4/4, 6 for a 3/4 lullaby. */
  bar: number;
  lead: Voice;
  /** How busy the melody is (share of eighths that get a note). */
  density: number;
  /** Echo on the melody, 0..1. */
  echo: number;
  padGain: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const POP = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]; // I V vi IV
const LOFI = [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]]; // ii7 V7 Imaj7 vi7
const DREAMY = [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [5, 9, 12, 14]]; // Imaj7 IVmaj7 vi7 IVadd9
const LULLABY = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]]; // I IV I V

const BOX: Voice = { type: "triangle", attack: 0.004, decay: 0.55, gain: 0.07 };
const BELL: Voice = { type: "sine", attack: 0.003, decay: 1.1, gain: 0.06, overtone: 3.01 };
const MARIMBA: Voice = { type: "sine", attack: 0.003, decay: 0.32, gain: 0.09, overtone: 4 };
const PLUCK: Voice = { type: "sawtooth", attack: 0.004, decay: 0.3, gain: 0.035, filter: 1600 };
const GLASS: Voice = { type: "sine", attack: 0.01, decay: 0.9, gain: 0.06, overtone: 2.76 };
const FLUTE: Voice = { type: "sine", attack: 0.06, decay: 0.5, gain: 0.06 };
const KEYS: Voice = { type: "triangle", attack: 0.008, decay: 0.8, gain: 0.06, filter: 2400 };

const THEMES: Record<MusicTheme, Theme> = {
  menu: { bpm: 84, root: 65, chords: DREAMY, bar: 8, lead: BOX, density: 0.45, echo: 0.25, padGain: 0.025 },
  meadow: { bpm: 88, root: 65, chords: POP, bar: 8, lead: BOX, density: 0.55, echo: 0.2, padGain: 0.025 },
  forest: { bpm: 82, root: 62, chords: LOFI, bar: 8, lead: MARIMBA, density: 0.6, echo: 0.15, padGain: 0.022 },
  pond: { bpm: 74, root: 63, chords: LOFI, bar: 8, lead: KEYS, density: 0.4, echo: 0.3, padGain: 0.03 },
  beach: { bpm: 96, root: 67, chords: POP, bar: 8, lead: PLUCK, density: 0.6, echo: 0.12, padGain: 0.02 },
  underwater: { bpm: 70, root: 62, chords: DREAMY, bar: 8, lead: GLASS, density: 0.35, echo: 0.45, padGain: 0.035 },
  caverns: { bpm: 76, root: 64, chords: DREAMY, bar: 8, lead: GLASS, density: 0.4, echo: 0.5, padGain: 0.03 },
  mines: { bpm: 90, root: 60, chords: LOFI, bar: 8, lead: PLUCK, density: 0.55, echo: 0.2, padGain: 0.022 },
  snow: { bpm: 78, root: 69, chords: POP, bar: 8, lead: BELL, density: 0.4, echo: 0.35, padGain: 0.028 },
  sky: { bpm: 86, root: 66, chords: DREAMY, bar: 8, lead: FLUTE, density: 0.5, echo: 0.3, padGain: 0.03 },
  nursery: { bpm: 96, root: 67, chords: LULLABY, bar: 6, lead: BELL, density: 0.6, echo: 0.25, padGain: 0.022 },
  twilight: { bpm: 68, root: 61, chords: LOFI, bar: 8, lead: KEYS, density: 0.38, echo: 0.4, padGain: 0.03 },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** A melody for one phrase (two bars): per eighth, a scale step above the root, or null for a rest. */
function composePhrase(theme: Theme, seed: string, chordA: number[], chordB: number[]): (number | null)[] {
  const rng = createRng(seed);
  const steps: (number | null)[] = [];
  let degree = 2 + rng.int(4);
  for (let i = 0; i < theme.bar * 2; i++) {
    const strong = i % (theme.bar / 2) === 0;
    if (!strong && rng.next() > theme.density) {
      steps.push(null);
      continue;
    }
    // Wander by small steps; on strong beats settle on a chord tone.
    degree = Math.max(0, Math.min(11, degree + [-2, -1, -1, 0, 1, 1, 2][rng.int(7)]!));
    let semis = Math.floor(degree / 7) * 12 + MAJOR[degree % 7]!;
    if (strong) {
      const chord = i < theme.bar ? chordA : chordB;
      const octave = Math.floor(semis / 12) * 12;
      semis = chord.map((tone) => octave + (tone % 12)).reduce((best, tone) => (Math.abs(tone - semis) < Math.abs(best - semis) ? tone : best));
    }
    steps.push(semis);
  }
  // Phrases end by resting on the last beat, so the tune breathes.
  steps[steps.length - 1] = null;
  return steps;
}

export class MusicBox {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  private echoIn: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private theme: MusicTheme = "menu";
  private nextTime = 0;
  private eighth = 0;
  private song: (number | null)[][] = [];
  private intensity = 0;
  private volume = 0.5;
  private ducked = false;
  private noise: AudioBuffer | null = null;

  /** Starts playing into `dest` (idempotent). */
  start(ac: AudioContext, dest: AudioNode): void {
    if (this.ac) return;
    this.ac = ac;
    this.out = ac.createGain();
    this.out.gain.value = this.level();
    this.out.connect(dest);
    // A soft echo for the melody: delay -> lowpass -> feedback.
    const delay = ac.createDelay(1);
    delay.delayTime.value = (60 / THEMES[this.theme].bpm) * 0.75;
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2200;
    const feedback = ac.createGain();
    feedback.gain.value = 0.35;
    this.echoIn = ac.createGain();
    this.echoIn.connect(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(this.out);
    this.compose();
    this.nextTime = ac.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.out?.disconnect();
    this.ac = null;
    this.out = null;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.ramp();
  }

  /** Softer under the results and the pause menu. */
  duck(on: boolean): void {
    this.ducked = on;
    this.ramp();
  }

  /** 0 = calm, 1 = a crowded board: adds a gentle shaker and a busier tune. */
  setIntensity(x: number): void {
    this.intensity = Math.max(0, Math.min(1, x));
  }

  setTheme(theme: MusicTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.compose();
    // Start the new tune on a fresh bar.
    this.eighth = 0;
  }

  get current(): MusicTheme {
    return this.theme;
  }

  private level(): number {
    return 1.1 * this.volume * (this.ducked ? 0.35 : 1);
  }

  private ramp(): void {
    if (!this.ac || !this.out) return;
    this.out.gain.setTargetAtTime(this.level(), this.ac.currentTime, 0.25);
  }

  /** Four two-bar phrases in an A A' B A shape, over the theme's four chords. */
  private compose(): void {
    const t = THEMES[this.theme];
    const seed = `${this.theme}/${Math.floor(Date.now() / 60000)}`;
    const a = composePhrase(t, `${seed}/a`, t.chords[0]!, t.chords[1]!);
    const a2 = composePhrase(t, `${seed}/a2`, t.chords[0]!, t.chords[1]!).map((n, i) => (i < t.bar ? a[i]! : n));
    const b = composePhrase(t, `${seed}/b`, t.chords[2]!, t.chords[3]!);
    const a3 = composePhrase(t, `${seed}/a3`, t.chords[2]!, t.chords[3]!).map((n, i) => (i < t.bar ? (a[i] ?? null) : n));
    this.song = [a, a2, b, a3];
  }

  private schedule(): void {
    const ac = this.ac;
    if (!ac || ac.state !== "running") return;
    const t = THEMES[this.theme];
    const step = 60 / t.bpm / 2;
    // After a pause (a hidden tab), pick the beat back up from now rather than racing to catch up.
    if (this.nextTime < ac.currentTime - 0.2) this.nextTime = ac.currentTime + 0.05;
    while (this.nextTime < ac.currentTime + 0.15) {
      this.playEighth(this.nextTime, t, step);
      this.nextTime += step;
      this.eighth++;
    }
  }

  private playEighth(at: number, t: Theme, step: number): void {
    const songLength = t.bar * 8;
    const pos = this.eighth % songLength;
    const bar = Math.floor(pos / t.bar);
    const inBar = pos % t.bar;
    const chord = t.chords[bar % t.chords.length]!;
    const phrase = this.song[Math.floor(bar / 2)]!;
    const note = phrase[pos % (t.bar * 2)];
    if (inBar === 0) {
      // Pad: the chord, swelling softly across the bar.
      for (const tone of chord) this.voice(at, hz(t.root - 12 + tone), { type: "sine", attack: step * 2, decay: step * t.bar, gain: t.padGain / chord.length, filter: 1200 }, false);
      this.voice(at, hz(t.root - 24 + chord[0]!), { type: "triangle", attack: 0.01, decay: step * 3, gain: 0.07, filter: 700 }, false);
    }
    if (inBar === t.bar / 2) this.voice(at, hz(t.root - 24 + chord[0]! + 7), { type: "triangle", attack: 0.01, decay: step * 2, gain: 0.05, filter: 700 }, false);
    if (note !== null && note !== undefined) this.voice(at, hz(t.root + note), t.lead, t.echo > 0);
    // A busier board: an extra grace note now and then, and a soft shaker on every eighth.
    if (this.intensity > 0.3 && note === null && Math.random() < this.intensity * 0.35) this.voice(at, hz(t.root + 12 + chord[1]! % 12), t.lead, true, 0.6);
    if (this.intensity > 0) this.shaker(at, (inBar % 2 ? 0.035 : 0.02) * this.intensity);
  }

  private voice(at: number, freq: number, v: Voice, echo: boolean, level = 1): void {
    const ac = this.ac!;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * level), at + v.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + v.attack + v.decay);
    let last: AudioNode = env;
    if (v.filter) {
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = v.filter;
      env.connect(f);
      last = f;
    }
    last.connect(this.out!);
    if (echo && this.echoIn) {
      const send = ac.createGain();
      send.gain.value = THEMES[this.theme].echo;
      last.connect(send).connect(this.echoIn);
    }
    const end = at + v.attack + v.decay + 0.05;
    const osc = ac.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(freq, at);
    osc.connect(env);
    osc.start(at);
    osc.stop(end);
    if (v.overtone) {
      const over = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.25;
      over.frequency.setValueAtTime(freq * v.overtone, at);
      over.connect(g).connect(env);
      over.start(at);
      over.stop(end);
    }
  }

  private shaker(at: number, gain: number): void {
    const ac = this.ac!;
    if (!this.noise) {
      this.noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.1), ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 6500;
    const env = ac.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(f).connect(env).connect(this.out!);
    src.start(at);
    src.stop(at + 0.08);
  }
}
