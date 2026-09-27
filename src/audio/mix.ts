// Pure mixing rules, kept apart from the Web Audio engine so they can be tested.

export type Cue =
  | "focus"
  | "save"
  | "unsave"
  | "clash"
  | "keep"
  | "click"
  | "tick"
  | "venue"
  | "panel-open"
  | "panel-close"
  | "mirror"
  | "shutter"
  | "beam-lit"
  | "puzzle-done"
  | "ticket"
  | "copy"
  | "replay";

export const CUES: readonly Cue[] = [
  "focus",
  "save",
  "unsave",
  "clash",
  "keep",
  "click",
  "tick",
  "venue",
  "panel-open",
  "panel-close",
  "mirror",
  "shutter",
  "beam-lit",
  "puzzle-done",
  "ticket",
  "copy",
  "replay",
];

/** Per-cue level, so interface ticks sit well under the big theatrical moments. */
export const CUE_GAIN: Record<Cue, number> = {
  focus: 0.9,
  save: 0.6,
  unsave: 0.45,
  clash: 0.55,
  keep: 0.55,
  click: 0.35,
  tick: 0.25,
  venue: 0.5,
  "panel-open": 0.3,
  "panel-close": 0.3,
  mirror: 0.5,
  shutter: 0.5,
  "beam-lit": 0.7,
  "puzzle-done": 0.7,
  ticket: 0.8,
  copy: 0.4,
  replay: 0.5,
};

export interface Hum {
  gain: number;
  rate: number;
}

/**
 * The lens hum: louder while the lens moves, rising in pitch as the light converges.
 * `speed` is lens units per second; `separation` is 0 (focused) .. 1.
 */
export function lensHum(speed: number, separation: number): Hum {
  const motion = Math.min(1, Math.max(0, speed) / 1.5);
  const s = Math.min(1, Math.max(0, separation));
  return {
    gain: 0.04 + motion * 0.32 * (0.4 + 0.6 * s),
    rate: 0.7 + (1 - s) * 0.55,
  };
}

/** Music level for the current state: silent until the identity resolves, lowered under dialogs. */
export function musicLevel(revealed: boolean, ducked: boolean): number {
  if (!revealed) return 0;
  return ducked ? 0.18 : 0.42;
}
