import { describe, expect, test } from "bun:test";
import { FOCAL, isFocused, LENS_START, nudge, separation, settle } from "../src/game/lens";
import { demoTicket, passCovers, recommendPass, ticketBlockers } from "../src/game/passes";

describe("passes", () => {
  test("recommends the cheapest pass covering every saved night", () => {
    expect(recommendPass(["slow-meridian"])).toBe("fri");
    expect(recommendPass(["perseid-room"])).toBe("sat");
    expect(recommendPass(["slow-meridian", "perseid-room"])).toBe("both");
  });

  test("a single-night pass does not cover a two-night itinerary", () => {
    expect(passCovers("fri", ["slow-meridian", "perseid-room"])).toBe(false);
    expect(passCovers("both", ["slow-meridian", "perseid-room"])).toBe(true);
  });

  test("the demo ticket waits for a saved, clash-free, covered night", () => {
    expect(ticketBlockers([], "both")).toContain("empty");
    expect(ticketBlockers(["chromatic-aberration", "pressure-garden"], "fri")).toEqual(["clashes"]);
    expect(ticketBlockers(["perseid-room"], "fri")).toEqual(["uncovered"]);
    expect(demoTicket(["perseid-room"], "fri")).toBeNull();
    const ticket = demoTicket(["perseid-room", "copper-weather"], "sat");
    expect(ticket?.total).toBe(38);
    expect(ticket?.performances).toBe(2);
    expect(ticket?.label).toContain("Demo");
  });
});

describe("lens", () => {
  test("starts out of focus and focuses at the focal point", () => {
    expect(isFocused(LENS_START)).toBe(false);
    expect(isFocused(FOCAL)).toBe(true);
    expect(separation(FOCAL)).toBe(0);
    expect(separation({ x: 1, y: 1 })).toBe(1);
  });

  test("nudges are clamped and near misses settle into focus", () => {
    expect(nudge({ x: 0.95, y: 0 }, 0.2, 0)).toEqual({ x: 1, y: 0 });
    expect(settle({ x: 0.1, y: 0.05 })).toEqual(FOCAL);
    expect(settle({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });
});
