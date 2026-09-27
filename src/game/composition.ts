// A saved itinerary becomes a poster/pass composition: a pure, deterministic description
// that the renderer draws. The same night always makes the same poster; changing it changes it.
import { type MotifKind, type Performance, type VenueId, venueById } from "./programme";
import { itinerary, nightsOf, savedVenues } from "./schedule";

export interface Layer {
  kind: MotifKind;
  hue: string;
  angle: number;
  x: number;
  y: number;
  scale: number;
  /** 0..1 pseudo-random seed for the renderer's small variations. */
  seed: number;
  code: string;
}

export interface Composition {
  key: string;
  serial: string;
  mood: string;
  /** Top and bottom of the ink ground. */
  ground: [string, string];
  accent: string;
  dominant: VenueId | "mixed" | "none";
  layers: Layer[];
  lines: { when: string; title: string; venue: string }[];
  nights: string;
  stamp: boolean;
}

const GROUNDS: Record<VenueId | "mixed" | "none", [string, string]> = {
  lens: ["#07121c", "#0d2536"],
  boiler: ["#1a0c07", "#3a1a0d"],
  sky: ["#0b0a1f", "#1e1946"],
  mixed: ["#0c0c12", "#221a2c"],
  none: ["#0b0c10", "#15171d"],
};

const MOODS: Record<VenueId | "mixed" | "none", string> = {
  lens: "A night of glass",
  boiler: "A night of copper",
  sky: "A night of open sky",
  mixed: "A night of refractions",
  none: "Compose a night",
};

/** FNV-1a over a string, as an unsigned 32-bit integer. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function dominantVenue(saved: readonly string[]): Composition["dominant"] {
  const counts = savedVenues(saved);
  const entries = (Object.entries(counts) as [VenueId, number][]).filter(([, n]) => n > 0);
  if (entries.length === 0) return "none";
  const max = Math.max(...entries.map(([, n]) => n));
  const top = entries.filter(([, n]) => n === max);
  return top.length === 1 && top[0] ? top[0][0] : "mixed";
}

function layerFor(p: Performance, index: number, total: number, key: number): Layer {
  const seed = (hash(`${p.id}:${key}`) % 1000) / 1000;
  // Layers stack down the poster in running order; the authored angle turns with the night's key.
  const y = total <= 1 ? 0.42 : 0.18 + (index / (total - 1)) * 0.52;
  return {
    kind: p.motif.kind,
    hue: p.motif.hue,
    angle: p.motif.angle + (seed - 0.5) * 10,
    x: p.motif.x,
    y,
    scale: 0.8 + seed * 0.45,
    seed,
    code: p.code,
  };
}

export function compose(saved: readonly string[], stamp = false): Composition {
  const night = itinerary(saved);
  const key = night.map((p) => p.code).join("");
  const keyHash = hash(key || "empty");
  const dominant = dominantVenue(saved);
  const nights = nightsOf(saved);
  return {
    key,
    serial: `AI-${keyHash.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`,
    mood: MOODS[dominant],
    ground: GROUNDS[dominant],
    accent: dominant === "mixed" || dominant === "none" ? "#e8d3a0" : venueById(dominant).colour,
    dominant,
    layers: night.map((p, i) => layerFor(p, i, night.length, keyHash)),
    lines: night.map((p) => ({
      when: `${p.day === "fri" ? "FRI" : "SAT"} ${String(Math.floor((p.start % 1440) / 60)).padStart(2, "0")}:${String(p.start % 60).padStart(2, "0")}`,
      title: p.title,
      venue: venueById(p.venue).short,
    })),
    nights: nights.length !== 1 ? "16–17 OCT" : nights[0] === "sat" ? "SAT 17 OCT" : "FRI 16 OCT",
    stamp,
  };
}
