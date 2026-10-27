/**
 * WebAudioSynthesizer: every sound in Block Burst is built at play time from oscillators, filtered noise and
 * envelopes. No audio files ship with the game (tests/playbook.test.ts checks).
 */
import { MusicBox } from './music';

const NOTE = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12);
/** C major pentatonic from C5, for clears that climb with the combo. */
/** Semitones of a major scale over two octaves: C D E F G A B C D E F G A B C. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21].map((s) => NOTE(3 + s));

interface ToneOpts {
  type?: OscillatorType;
  at?: number;
  peak?: number;
  attack?: number;
  decay?: number;
  glideTo?: number;
}

class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private masterVolume = 0.8;
  private sfxVolume = 0.9;
  private muted = false;

  /** The background music (see music.ts); it starts with the first sound, once the browser allows audio. */
  readonly music = new MusicBox();
  private musicOn = true;

  configure(opts: { masterVolume?: number; sfxVolume?: number; muted?: boolean; music?: boolean; musicVolume?: number }): void {
    if (opts.masterVolume !== undefined) this.masterVolume = opts.masterVolume;
    if (opts.sfxVolume !== undefined) this.sfxVolume = opts.sfxVolume;
    if (opts.muted !== undefined) this.muted = opts.muted;
    if (opts.musicVolume !== undefined) this.music.setVolume(opts.musicVolume);
    if (opts.music !== undefined) {
      this.musicOn = opts.music;
      if (!opts.music) this.music.stop();
      else if (this.ctx && this.master) this.music.start(this.ctx, this.master);
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVolume;
    if (this.sfx) this.sfx.gain.value = this.sfxVolume;
  }

  /** Browsers only allow audio after a gesture; call this from the first tap. */
  unlock(): void {
    this.audio();
  }

  private audio(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVolume;
      this.sfx.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn && this.master) this.music.start(this.ctx, this.master);
    return this.ctx;
  }

  private env(ac: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  private tone(freq: number, o: ToneOpts = {}): void {
    const ac = this.audio();
    if (!ac || !this.sfx) return;
    const at = ac.currentTime + (o.at ?? 0);
    const attack = o.attack ?? 0.005;
    const decay = o.decay ?? 0.2;
    const osc = ac.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, at + attack + decay);
    osc.connect(this.env(ac, at, o.peak ?? 0.25, attack, decay)).connect(this.sfx);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  private noise(ac: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 1), ac.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private filteredNoise(type: BiquadFilterType, from: number, to: number, len: number, peak: number, q = 1, at = 0): void {
    const ac = this.audio();
    if (!ac || !this.sfx) return;
    const t = ac.currentTime + at;
    const src = ac.createBufferSource();
    src.buffer = this.noise(ac);
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + len);
    src.connect(f).connect(this.env(ac, t, peak, Math.min(0.02, len * 0.2), len)).connect(this.sfx);
    src.start(t);
    src.stop(t + len + 0.05);
  }

  private chord(semis: number[][], step: number, peak: number, lastLen = 1.1): void {
    const ac = this.audio();
    if (!ac || !this.sfx) return;
    semis.forEach((chord, ci) => {
      const at = ac.currentTime + ci * step;
      const len = ci === semis.length - 1 ? lastLen : step + 0.02;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(500, at);
      lp.frequency.exponentialRampToValueAtTime(3200, at + 0.1);
      lp.frequency.exponentialRampToValueAtTime(900, at + len);
      const g = this.env(ac, at, peak, 0.03, len);
      lp.connect(g).connect(this.sfx!);
      for (const semi of chord) {
        for (const detune of [-6, 6]) {
          const osc = ac.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = NOTE(semi - 9);
          osc.detune.value = detune;
          osc.connect(lp);
          osc.start(at);
          osc.stop(at + len + 0.1);
        }
      }
    });
  }

  /** Picking up a piece: a soft rising blip. */
  playPick(): void {
    this.tone(520, { type: 'sine', glideTo: 780, attack: 0.003, decay: 0.06, peak: 0.07 });
  }

  /** Placing a piece: a woody thunk plus a tiny click, slightly lower for bigger pieces. */
  playPlace(size = 4): void {
    const f = 260 - Math.min(9, size) * 10;
    this.tone(f, { type: 'triangle', glideTo: f * 0.6, attack: 0.002, decay: 0.09, peak: 0.2 });
    this.filteredNoise('bandpass', 2400, 1800, 0.03, 0.18, 6);
  }

  /** Cozy drop: a soft bubble-wrap pop, a quick falling blip with a tiny click, lower for bigger pieces. */
  playBubble(size = 4): void {
    const f = 900 - Math.min(9, size) * 45;
    this.tone(f, { type: 'sine', glideTo: f * 0.45, attack: 0.001, decay: 0.07, peak: 0.16 });
    this.filteredNoise('bandpass', 3200, 2200, 0.025, 0.12, 8);
  }

  /**
   * Cozy line clear: one creature chirp per line, climbing a major scale (C, D, E, F, G...). Each combo starts
   * the run a step higher, so a streak keeps rising, the addictive pitch ladder of block puzzles.
   */
  playChirps(lines: number, combo: number): void {
    const start = Math.min(MAJOR.length - 1, Math.max(0, combo - 1));
    for (let i = 0; i < Math.min(6, lines); i++) {
      const f = NOTE(3 + (MAJOR[Math.min(MAJOR.length - 1, start + i)] ?? 0));
      // A little vocal chirp: a quick upward slide, then a bubbly sparkle on the last one.
      this.tone(f * 0.82, { type: 'sine', glideTo: f * 1.12, at: i * 0.07, attack: 0.004, decay: 0.13, peak: 0.12 });
    }
    this.filteredNoise('highpass', 7000, 4000, 0.18, 0.04, 1, Math.min(6, lines) * 0.07);
  }

  /** Nervous board: a quiet, low "lub-dub" heartbeat. */
  playHeartbeat(): void {
    this.tone(62, { type: 'sine', glideTo: 48, attack: 0.005, decay: 0.12, peak: 0.12 });
    this.tone(58, { type: 'sine', glideTo: 44, at: 0.2, attack: 0.005, decay: 0.14, peak: 0.08 });
  }

  /** Nearly locked: a few soft drops of rain. */
  playRain(): void {
    for (let drop = 0; drop < 5; drop++) this.filteredNoise('bandpass', 4200 - drop * 300, 2600, 0.04, 0.03, 4, drop * 0.11 + Math.random() * 0.05);
  }

  /** The board locks up: a tiny, high whimper that droops at the end. */
  playWhimper(): void {
    this.tone(NOTE(19), { type: 'sine', glideTo: NOTE(15), attack: 0.02, decay: 0.28, peak: 0.07 });
    this.tone(NOTE(17), { type: 'sine', glideTo: NOTE(10), at: 0.3, attack: 0.02, decay: 0.38, peak: 0.06 });
  }

  /** A win: a little crowd of joyous squeaks, each voice jumping up, before the fanfare. */
  playCheer(): void {
    [0, 4, 7, 12, 9, 16].forEach((semi, voice) => {
      const f = NOTE(12 + semi);
      this.tone(f, { type: 'sine', glideTo: f * 1.35, at: voice * 0.045 + (voice % 2) * 0.02, attack: 0.004, decay: 0.12, peak: 0.07 });
    });
  }

  /** Relief: a soft falling breath of air. */
  playSigh(): void {
    this.filteredNoise('lowpass', 1400, 300, 0.7, 0.07, 1);
    this.tone(NOTE(7), { type: 'sine', glideTo: NOTE(0), attack: 0.08, decay: 0.6, peak: 0.04 });
  }

  /** A revive: the soft swish of a tissue, then a happy two-note lift. */
  playTissue(): void {
    this.filteredNoise('bandpass', 2600, 1200, 0.35, 0.08, 2);
    this.filteredNoise('bandpass', 2400, 1100, 0.3, 0.06, 2, 0.4);
    this.tone(NOTE(12), { type: 'triangle', at: 0.75, attack: 0.004, decay: 0.15, peak: 0.08 });
    this.tone(NOTE(19), { type: 'triangle', at: 0.85, attack: 0.004, decay: 0.3, peak: 0.08 });
  }

  /** A piece that doesn't fit floats back to the tray: a gentle falling slide, never a buzzer. */
  playReturn(): void {
    this.tone(500, { type: 'sine', glideTo: 330, attack: 0.004, decay: 0.12, peak: 0.06 });
  }

  /** Line clear: a pentatonic run that starts higher the longer the combo, one note per line plus a sparkle. */
  playClear(lines: number, combo: number): void {
    const base = Math.min(5, Math.max(0, combo - 1));
    for (let i = 0; i < Math.min(5, lines + 1); i++) this.tone(PENTATONIC[Math.min(PENTATONIC.length - 1, base + i)], { type: 'triangle', at: i * 0.055, peak: 0.13, decay: 0.28 });
    this.filteredNoise('highpass', 6000, 3000, 0.25, 0.05, 1, 0.02);
  }

  /** Combo call-out from x3 up: a bright two-note lift. */
  playCombo(combo: number): void {
    const lift = Math.min(6, combo - 3);
    this.tone(NOTE(10 + lift), { type: 'square', at: 0.12, attack: 0.004, decay: 0.12, peak: 0.04 });
    this.tone(NOTE(15 + lift), { type: 'square', at: 0.2, attack: 0.004, decay: 0.2, peak: 0.04 });
  }

  /** Gem collected: a glassy ping with a shimmer. */
  playGem(): void {
    this.tone(NOTE(24), { type: 'sine', attack: 0.002, decay: 0.5, peak: 0.08 });
    this.tone(NOTE(31), { type: 'sine', at: 0.05, attack: 0.002, decay: 0.4, peak: 0.04 });
  }

  /** Perfect Clear: a quick major arpeggio into a held chord. */
  playPerfect(): void {
    this.chord([[0, 4, 7], [4, 7, 12], [7, 12, 16], [12, 16, 19, 24]], 0.09, 0.1, 1.2);
  }

  /** A fresh tray: three soft pops. */
  playDeal(): void {
    [0, 1, 2].forEach((i) => this.tone(700 + i * 120, { type: 'sine', at: i * 0.05, attack: 0.002, decay: 0.05, peak: 0.04 }));
  }

  /** New best: I–IV–V–I detuned-saw pads through an opening low-pass (as in AntLink's victory). */
  playNewBest(): void {
    this.chord([[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]], 0.22, 0.12);
  }

  /** Level won: a shorter cadence. */
  playWin(): void {
    this.chord([[5, 9, 12], [7, 11, 14], [12, 16, 19]], 0.18, 0.11);
  }

  /** Rank up: a rising fourth-stacked fanfare. */
  playRankUp(): void {
    this.chord([[0, 5, 10], [2, 7, 12], [5, 10, 15, 19]], 0.16, 0.11);
  }

  /** Game over: a gentle low dual-sine chord with a slow attack. Never a buzzer. */
  playCalmEnd(): void {
    for (const f of [220, 277.18]) this.tone(f, { type: 'sine', peak: 0.08, attack: 0.3, decay: 1.2 });
  }

  /** Passing your previous best mid-run: a small rising arpeggio. */
  playPassBest(): void {
    [0, 2, 4, 5].forEach((n, i) => this.tone(PENTATONIC[n + 2], { type: 'sine', at: i * 0.07, peak: 0.1, decay: 0.25 }));
  }

  /** Coins: two quick pentatonic dings. */
  playCoin(): void {
    [5, 7].forEach((n, i) => this.tone(PENTATONIC[n], { type: 'triangle', at: i * 0.06, peak: 0.12, decay: 0.18 }));
  }

  /**
   * Praise for a big clear: a bright rising run that climbs higher and longer with the tier, a soft chord under
   * it and a shimmer on top (tier 6, an All Clear, gets the full sweep).
   */
  playPraise(tier: number): void {
    const steps = Math.min(MAJOR.length, 3 + tier);
    for (let i = 0; i < steps; i++) this.tone(NOTE(3 + MAJOR[i]! + (tier >= 4 ? 12 : 0)), { type: 'triangle', at: i * 0.045, peak: 0.09, decay: 0.28 });
    [0, 4, 7].forEach((semis) => this.tone(NOTE(-9 + semis + tier), { type: 'sine', at: 0.02, peak: 0.07, attack: 0.03, decay: 0.7 }));
    this.filteredNoise('highpass', 5000, 9000, 0.35 + tier * 0.05, 0.05, 1, steps * 0.045);
  }

  /** The FAIL stamp landing: a soft, low thump with a papery slap. */
  playStamp(): void {
    this.tone(90, { type: 'sine', peak: 0.22, decay: 0.25 });
    this.filteredNoise('lowpass', 1800, 400, 0.12, 0.2, 1);
  }

  /** Treasure chest: a quick wooden rattle as it's tapped. */
  playChestRattle(): void {
    for (let i = 0; i < 5; i++) this.filteredNoise('bandpass', 900, 700, 0.03, 0.18, 6, i * 0.065);
  }

  /** Treasure chest: the lid popping off, a soft whoosh with a bright rising arpeggio. */
  playChestOpen(): void {
    this.filteredNoise('bandpass', 500, 3200, 0.3, 0.12, 2);
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone(NOTE(8 + s), { type: 'triangle', at: 0.03 + i * 0.045, peak: 0.08, decay: 0.3 }));
  }

  /** Coin shower: the burst, a quick jingle of bright pings. */
  playCoinBurst(): void {
    for (let i = 0; i < 10; i++) this.tone(PENTATONIC[5 + (i % 5)], { type: 'triangle', at: i * 0.03 + Math.random() * 0.02, peak: 0.06, decay: 0.2 });
  }

  /** Coin shower: a coin landing on the floor. */
  playCoinClink(): void {
    this.tone(PENTATONIC[6 + Math.floor(Math.random() * 4)] * 2, { type: 'sine', peak: 0.04, decay: 0.08 });
  }

  /** Coin shower: the n-th coin reaching the corner, climbing the scale. */
  playCoinArrive(n: number): void {
    this.tone(PENTATONIC[n % PENTATONIC.length] * (n >= PENTATONIC.length ? 2 : 1), { type: 'triangle', peak: 0.05, decay: 0.12 });
  }

  /** Small UI tick for buttons. */
  playTap(): void {
    this.tone(660, { type: 'triangle', attack: 0.002, decay: 0.05, peak: 0.08 });
  }

  /** Reward chime for gifts, milestones, unlocks and the crate. */
  playChime(): void {
    [0, 7, 12, 16].forEach((s, i) => this.tone(NOTE(3 + s), { type: 'sine', at: i * 0.06, peak: 0.12, decay: 0.5 }));
  }

  /** Mystery Crate: a run of ratchet clicks. */
  playCrank(): void {
    for (let i = 0; i < 8; i++) this.filteredNoise('bandpass', 1400, 1200, 0.025, 0.5, 8, i * 0.09);
  }
}

export const synth = new WebAudioSynthesizer();
export type { WebAudioSynthesizer };
