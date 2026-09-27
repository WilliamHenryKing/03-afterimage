// Itinerary rules: filters, saving, overlap detection and clash resolution.
import { type Day, type Performance, PROGRAMME, performanceById, type VenueId } from "./programme";

export type DayFilter = Day | "all";
export type VenueFilter = VenueId | "all";

export function filterProgramme(
  day: DayFilter,
  venue: VenueFilter,
  programme: readonly Performance[] = PROGRAMME,
): Performance[] {
  return programme
    .filter((p) => (day === "all" || p.day === day) && (venue === "all" || p.venue === venue))
    .sort(byTime);
}

export function byTime(a: Performance, b: Performance): number {
  if (a.day !== b.day) return a.day === "fri" ? -1 : 1;
  return a.start - b.start || a.end - b.end || a.id.localeCompare(b.id);
}

export function overlaps(a: Performance, b: Performance): boolean {
  return a.id !== b.id && a.day === b.day && a.start < b.end && b.start < a.end;
}

/** Saved ids as performances, in running order. Unknown ids are dropped. */
export function itinerary(saved: readonly string[]): Performance[] {
  const seen = new Set<string>();
  const out: Performance[] = [];
  for (const id of saved) {
    const p = performanceById(id);
    if (p && !seen.has(id)) {
      seen.add(id);
      out.push(p);
    }
  }
  return out.sort(byTime);
}

export function toggleSaved(saved: readonly string[], id: string): string[] {
  if (!performanceById(id)) return [...saved];
  return saved.includes(id) ? saved.filter((s) => s !== id) : [...saved, id];
}

export interface Clash {
  a: Performance;
  b: Performance;
  /** Minutes the two performances share. */
  minutes: number;
}

export function clashes(saved: readonly string[]): Clash[] {
  const night = itinerary(saved);
  const out: Clash[] = [];
  for (let i = 0; i < night.length; i++) {
    for (let j = i + 1; j < night.length; j++) {
      const a = night[i];
      const b = night[j];
      if (a && b && overlaps(a, b)) {
        out.push({ a, b, minutes: Math.min(a.end, b.end) - Math.max(a.start, b.start) });
      }
    }
  }
  return out;
}

/** Saved performances that overlap the given one. */
export function clashesWith(saved: readonly string[], id: string): Performance[] {
  const p = performanceById(id);
  if (!p) return [];
  return itinerary(saved).filter((s) => overlaps(s, p));
}

/** Keep one side of a clash: drops everything saved that overlaps the kept performance. */
export function keepOnly(saved: readonly string[], keepId: string): string[] {
  const keep = performanceById(keepId);
  if (!keep) return [...saved];
  const next = saved.filter((id) => {
    const p = performanceById(id);
    return p !== undefined && !overlaps(p, keep);
  });
  return next.includes(keepId) ? next : [...next, keepId];
}

export function nightsOf(saved: readonly string[]): Day[] {
  const days = new Set(itinerary(saved).map((p) => p.day));
  return (["fri", "sat"] as const).filter((d) => days.has(d));
}

export function savedVenues(saved: readonly string[]): Record<VenueId, number> {
  const counts: Record<VenueId, number> = { lens: 0, boiler: 0, sky: 0 };
  for (const p of itinerary(saved)) counts[p.venue]++;
  return counts;
}
