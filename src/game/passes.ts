// Pass options and the demo ticket summary. Nothing is sold: every figure is illustrative.
import type { Day } from "./programme";
import { clashes, itinerary, nightsOf } from "./schedule";

export type PassId = "fri" | "sat" | "both";

export interface PassOption {
  id: PassId;
  name: string;
  covers: Day[];
  price: number;
  note: string;
}

export const PASSES: readonly PassOption[] = [
  { id: "fri", name: "Friday night", covers: ["fri"], price: 38, note: "All three spaces, Friday" },
  {
    id: "sat",
    name: "Saturday night",
    covers: ["sat"],
    price: 38,
    note: "All three spaces, Saturday",
  },
  {
    id: "both",
    name: "Both nights",
    covers: ["fri", "sat"],
    price: 64,
    note: "Both nights, save £12",
  },
];

export function passById(id: PassId): PassOption {
  const pass = PASSES.find((p) => p.id === id);
  if (!pass) throw new Error(`Unknown pass ${id}`);
  return pass;
}

/** The cheapest pass that covers every saved night. */
export function recommendPass(saved: readonly string[]): PassId {
  const nights = nightsOf(saved);
  if (nights.length === 2) return "both";
  return nights[0] ?? "both";
}

export function passCovers(pass: PassId, saved: readonly string[]): boolean {
  const covers = passById(pass).covers;
  return nightsOf(saved).every((d) => covers.includes(d));
}

export type TicketBlocker = "empty" | "clashes" | "uncovered";

export function ticketBlockers(saved: readonly string[], pass: PassId): TicketBlocker[] {
  const out: TicketBlocker[] = [];
  if (itinerary(saved).length === 0) out.push("empty");
  if (clashes(saved).length > 0) out.push("clashes");
  if (!passCovers(pass, saved)) out.push("uncovered");
  return out;
}

export interface DemoTicket {
  pass: PassOption;
  performances: number;
  total: number;
  label: string;
}

export function demoTicket(saved: readonly string[], pass: PassId): DemoTicket | null {
  if (ticketBlockers(saved, pass).length) return null;
  const option = passById(pass);
  return {
    pass: option,
    performances: itinerary(saved).length,
    total: option.price,
    label: "Demo ticket — no purchase made",
  };
}
