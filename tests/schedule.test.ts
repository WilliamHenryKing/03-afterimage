import { describe, expect, test } from "bun:test";
import { clock, PROGRAMME, performanceById } from "../src/game/programme";
import {
  clashes,
  clashesWith,
  filterProgramme,
  itinerary,
  keepOnly,
  nightsOf,
  overlaps,
  toggleSaved,
} from "../src/game/schedule";

const get = (id: string) => {
  const p = performanceById(id);
  if (!p) throw new Error(id);
  return p;
};

describe("programme", () => {
  test("ids and codes are unique and every slot is well formed", () => {
    expect(new Set(PROGRAMME.map((p) => p.id)).size).toBe(PROGRAMME.length);
    expect(new Set(PROGRAMME.map((p) => p.code)).size).toBe(PROGRAMME.length);
    for (const p of PROGRAMME) expect(p.end).toBeGreaterThan(p.start);
  });

  test("clock wraps after midnight", () => {
    expect(clock(19 * 60 + 30)).toBe("19:30");
    expect(clock(24 * 60 + 30)).toBe("00:30");
  });
});

describe("filters", () => {
  test("day and venue filters combine and return running order", () => {
    const fri = filterProgramme("fri", "all");
    expect(fri.every((p) => p.day === "fri")).toBe(true);
    expect(fri.map((p) => p.start)).toEqual([...fri.map((p) => p.start)].sort((a, b) => a - b));
    const satLens = filterProgramme("sat", "lens");
    expect(satLens.map((p) => p.id)).toEqual(["iris-shutter", "closing-afterimage"]);
    expect(filterProgramme("all", "all")).toHaveLength(PROGRAMME.length);
  });
});

describe("overlaps", () => {
  test("touching end and start is not a clash", () => {
    const a = { ...get("chromatic-aberration"), id: "a", start: 1000, end: 1060 };
    const b = { ...a, id: "b", start: 1060, end: 1100 };
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, { ...b, start: 1059 })).toBe(true);
  });

  test("same times on different nights never clash", () => {
    const a = get("chromatic-aberration");
    expect(overlaps(a, { ...a, id: "other", day: "sat" })).toBe(false);
  });

  test("after-midnight sets clash with late sets", () => {
    expect(overlaps(get("slow-meridian"), get("afterglow-choir"))).toBe(true);
  });
});

describe("my night", () => {
  test("toggle saves and unsaves, ignoring unknown ids", () => {
    let saved = toggleSaved([], "slow-meridian");
    expect(saved).toEqual(["slow-meridian"]);
    saved = toggleSaved(saved, "nope");
    expect(saved).toEqual(["slow-meridian"]);
    expect(toggleSaved(saved, "slow-meridian")).toEqual([]);
  });

  test("itinerary is de-duplicated and ordered across nights", () => {
    const night = itinerary(["perseid-room", "chromatic-aberration", "perseid-room", "x"]);
    expect(night.map((p) => p.id)).toEqual(["chromatic-aberration", "perseid-room"]);
    expect(nightsOf(["perseid-room", "chromatic-aberration"])).toEqual(["fri", "sat"]);
  });

  test("clashes report each overlapping pair with shared minutes", () => {
    const found = clashes(["chromatic-aberration", "pressure-garden", "slow-meridian"]);
    expect(found).toHaveLength(1);
    expect(found[0]?.a.id).toBe("chromatic-aberration");
    expect(found[0]?.b.id).toBe("pressure-garden");
    expect(found[0]?.minutes).toBe(30);
    expect(clashesWith(["pressure-garden"], "negative-space").map((p) => p.id)).toEqual([
      "pressure-garden",
    ]);
  });

  test("keeping one side removes everything it overlaps and nothing else", () => {
    const saved = ["pressure-garden", "chromatic-aberration", "negative-space", "perseid-room"];
    const next = keepOnly(saved, "pressure-garden");
    expect(next.sort()).toEqual(["perseid-room", "pressure-garden"]);
    expect(clashes(next)).toHaveLength(0);
  });
});
