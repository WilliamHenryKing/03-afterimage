// The festival programme: three spaces, two nights, authored motifs.
// Times are minutes from midnight at the start of the festival day; values past 1440 run after midnight.

export type VenueId = "lens" | "boiler" | "sky";
export type Day = "fri" | "sat";
export type MotifKind = "slit" | "foil" | "pattern" | "field";

export interface Venue {
  id: VenueId;
  name: string;
  short: string;
  mood: string;
  colour: string;
  description: string;
}

export interface Motif {
  kind: MotifKind;
  /** Authored colour of the light this performance leaves behind. */
  hue: string;
  /** Degrees; the direction the motif travels across the poster. */
  angle: number;
  /** Horizontal anchor on the poster, 0..1. */
  x: number;
}

export interface Performance {
  id: string;
  code: string;
  title: string;
  artist: string;
  venue: VenueId;
  day: Day;
  start: number;
  end: number;
  blurb: string;
  motif: Motif;
}

export const VENUES: readonly Venue[] = [
  {
    id: "lens",
    name: "The Lens",
    short: "Lens",
    mood: "Intimate light and sound beneath the great optical assembly",
    colour: "#8fd8ff",
    description:
      "The old refractor hall. A two-metre objective hangs overhead; every seat sits inside its throw of light.",
  },
  {
    id: "boiler",
    name: "The Boiler Room",
    short: "Boiler",
    mood: "Warm, tactile installations among pipes and reflective surfaces",
    colour: "#f0935a",
    description:
      "The heating plant under the dome. Copper pipes, polished tanks and low warm air you can walk through.",
  },
  {
    id: "sky",
    name: "The Sky Deck",
    short: "Sky Deck",
    mood: "Open-air performances and slower late-night work",
    colour: "#a99bff",
    description:
      "The roof platform where the shutter opens. Blankets, a horizon of hills and the longest sets of the night.",
  },
];

export const DAYS: readonly { id: Day; name: string; date: string }[] = [
  { id: "fri", name: "Friday", date: "Fri 16 Oct" },
  { id: "sat", name: "Saturday", date: "Sat 17 Oct" },
];

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const PROGRAMME: readonly Performance[] = [
  {
    id: "chromatic-aberration",
    code: "CA",
    title: "Chromatic Aberration",
    artist: "Idris Vane",
    venue: "lens",
    day: "fri",
    start: h(19),
    end: h(20),
    blurb:
      "A single white beam, pulled apart into its colours by a rotating prism and slowly sewn back together with live cello.",
    motif: { kind: "slit", hue: "#9fe3ff", angle: 12, x: 0.34 },
  },
  {
    id: "pressure-garden",
    code: "PG",
    title: "Pressure Garden",
    artist: "Mara Okonkwo-Lind",
    venue: "boiler",
    day: "fri",
    start: h(19, 30),
    end: h(21),
    blurb:
      "Steam, brass leaf and heat lamps. Walk through a greenhouse of foil petals that open when the pipes knock.",
    motif: { kind: "foil", hue: "#e7b567", angle: -18, x: 0.62 },
  },
  {
    id: "negative-space",
    code: "NS",
    title: "Negative Space for Two Projectors",
    artist: "Halden & Rue",
    venue: "lens",
    day: "fri",
    start: h(20, 30),
    end: h(21, 30),
    blurb:
      "Two 16 mm projectors face each other across the hall. Where the beams cross, a third film appears that neither holds.",
    motif: { kind: "pattern", hue: "#c7f0ff", angle: 30, x: 0.5 },
  },
  {
    id: "slow-meridian",
    code: "SM",
    title: "Slow Meridian",
    artist: "The Nocturne Collective",
    venue: "sky",
    day: "fri",
    start: h(21, 30),
    end: h(23),
    blurb:
      "Drones tuned to the transit of three bright stars. Arrive, lie down, and leave whenever the sky tells you to.",
    motif: { kind: "field", hue: "#7d6bff", angle: 0, x: 0.3 },
  },
  {
    id: "afterglow-choir",
    code: "AC",
    title: "Afterglow Choir",
    artist: "Sela Marr & choir",
    venue: "sky",
    day: "fri",
    start: h(22, 30),
    end: h(24, 30),
    blurb:
      "Forty voices spread along the parapet, each carrying a lantern that dims as its part falls silent.",
    motif: { kind: "field", hue: "#ff8fb3", angle: 0, x: 0.72 },
  },
  {
    id: "copper-weather",
    code: "CW",
    title: "Copper Weather",
    artist: "Ines Farrow",
    venue: "boiler",
    day: "sat",
    start: h(18, 30),
    end: h(19, 45),
    blurb:
      "A rain of copper ribbons over the old tanks, lit from below. The sound is the building itself, amplified.",
    motif: { kind: "foil", hue: "#f28c4b", angle: 22, x: 0.4 },
  },
  {
    id: "iris-shutter",
    code: "IS",
    title: "Iris / Shutter",
    artist: "Tomasz Wren",
    venue: "lens",
    day: "sat",
    start: h(19, 30),
    end: h(20, 30),
    blurb:
      "A mechanical iris the width of the room opens by millimetres. Percussion is played on its blades.",
    motif: { kind: "slit", hue: "#ffe7a3", angle: -8, x: 0.66 },
  },
  {
    id: "mirror-engine",
    code: "ME",
    title: "Mirror Engine",
    artist: "Kasper Nwosu",
    venue: "boiler",
    day: "sat",
    start: h(21),
    end: h(22, 30),
    blurb:
      "Two hundred hand-cut mirrors on a boiler flywheel throw a turning lattice of light over the audience.",
    motif: { kind: "pattern", hue: "#ffb27a", angle: -40, x: 0.5 },
  },
  {
    id: "perseid-room",
    code: "PR",
    title: "Perseid Listening Room",
    artist: "Oona Bryce",
    venue: "sky",
    day: "sat",
    start: h(22),
    end: h(24, 30),
    blurb:
      "Radio meteor echoes turned into tones as they happen. A slow set for blankets and very late conversation.",
    motif: { kind: "field", hue: "#6fb7ff", angle: 0, x: 0.55 },
  },
  {
    id: "closing-afterimage",
    code: "AI",
    title: "Afterimage",
    artist: "Festival ensemble",
    venue: "lens",
    day: "sat",
    start: h(22, 45),
    end: h(23, 45),
    blurb:
      "The closing piece. Every lamp in the building fires once, then the room holds its afterimage in the dark.",
    motif: { kind: "slit", hue: "#ffffff", angle: 0, x: 0.5 },
  },
];

export function venueById(id: VenueId): Venue {
  const venue = VENUES.find((v) => v.id === id);
  if (!venue) throw new Error(`Unknown venue ${id}`);
  return venue;
}

export function performanceById(id: string): Performance | undefined {
  return PROGRAMME.find((p) => p.id === id);
}

export function dayName(day: Day): string {
  return DAYS.find((d) => d.id === day)?.name ?? day;
}

/** "19:30" style clock text; after-midnight times wrap. */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function timeRange(p: Performance): string {
  return `${clock(p.start)}–${clock(p.end)}`;
}
