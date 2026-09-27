// Web Audio engine. Nothing loads or plays until the first user gesture; the experience
// works fully in silence. Music and ambience stream from media elements, SFX are decoded buffers.
import { CUE_GAIN, CUES, type Cue, lensHum, musicLevel } from "./mix";

const MUTE_KEY = "afterimage.muted";
const url = (name: string) => `${import.meta.env.BASE_URL}audio/${name}.mp3`;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private humSource: AudioBufferSourceNode | null = null;
  private readonly buffers = new Map<Cue | "lens-hum", AudioBuffer>();
  private media: HTMLAudioElement[] = [];
  private revealed = false;
  private ducked = false;
  private listeners = new Set<(muted: boolean) => void>();
  muted = typeof window === "undefined" ? false : readMuted();

  /** Call from inside a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = musicLevel(this.revealed, this.ducked);
    this.musicGain.connect(this.master);
    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.55;
    ambienceGain.connect(this.master);
    this.stream("music", this.musicGain);
    this.stream("ambience", ambienceGain);

    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    this.humGain.connect(this.master);
    void this.loadBuffers();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private stream(name: string, destination: AudioNode) {
    if (!this.ctx) return;
    const el = new Audio(url(name));
    el.loop = true;
    el.preload = "auto";
    this.ctx.createMediaElementSource(el).connect(destination);
    this.media.push(el);
    void el.play().catch(() => undefined);
  }

  private async loadBuffers() {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      [...CUES, "lens-hum" as const].map(async (name) => {
        try {
          const data = await (await fetch(url(name))).arrayBuffer();
          this.buffers.set(name, await ctx.decodeAudioData(data));
        } catch {
          // A missing cue just stays silent.
        }
      }),
    );
    const hum = this.buffers.get("lens-hum");
    if (hum && this.humGain) {
      const src = ctx.createBufferSource();
      src.buffer = hum;
      src.loop = true;
      src.connect(this.humGain);
      src.start();
      this.humSource = src;
    }
  }

  play(cue: Cue, rate = 1) {
    const ctx = this.ctx;
    const buffer = this.buffers.get(cue);
    if (!ctx || !this.master || !buffer || this.muted || ctx.state !== "running") return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = CUE_GAIN[cue];
    src.connect(gain).connect(this.master);
    src.start();
  }

  /** Called every frame by the stage with the lens speed and how split the light is. */
  lens(speed: number, separation: number) {
    const ctx = this.ctx;
    if (!ctx || !this.humGain || !this.humSource) return;
    const hum = lensHum(speed, separation);
    this.humGain.gain.setTargetAtTime(hum.gain, ctx.currentTime, 0.12);
    this.humSource.playbackRate.setTargetAtTime(hum.rate, ctx.currentTime, 0.2);
  }

  /** Music enters when the identity resolves; dialogs duck it. */
  setScene(revealed: boolean, ducked: boolean) {
    this.revealed = revealed;
    this.ducked = ducked;
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        musicLevel(revealed, ducked),
        this.ctx.currentTime,
        revealed ? 0.8 : 0.4,
      );
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Not persisted in private mode; the toggle still works for this visit.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    for (const fn of this.listeners) fn(muted);
  }

  subscribe(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** A hidden tab goes quiet: media pauses and the context suspends. */
  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      for (const el of this.media) el.pause();
      void this.ctx.suspend();
    } else {
      void this.ctx.resume();
      for (const el of this.media) void el.play().catch(() => undefined);
    }
  };
}

export const sound = new SoundEngine();
