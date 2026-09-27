import { describe, expect, test } from "bun:test";
import { compose, hash } from "../src/game/composition";
import { decodeState, encodeState } from "../src/game/share";

describe("composition", () => {
  test("is deterministic and independent of the order things were saved", () => {
    const a = compose(["slow-meridian", "chromatic-aberration"]);
    const b = compose(["chromatic-aberration", "slow-meridian"]);
    expect(a).toEqual(b);
  });

  test("different nights produce visibly different compositions", () => {
    const glass = compose(["chromatic-aberration"]);
    const copper = compose(["pressure-garden"]);
    const sky = compose(["slow-meridian"]);
    expect(new Set([glass.serial, copper.serial, sky.serial]).size).toBe(3);
    expect(glass.ground).not.toEqual(copper.ground);
    expect(copper.ground).not.toEqual(sky.ground);
    expect(glass.layers[0]?.kind).toBe("slit");
    expect(copper.layers[0]?.kind).toBe("foil");
    expect(sky.layers[0]?.kind).toBe("field");
    expect(glass.mood).toBe("A night of glass");
  });

  test("each saved performance contributes one layer in running order", () => {
    const c = compose(["perseid-room", "copper-weather", "mirror-engine"]);
    expect(c.layers.map((l) => l.code)).toEqual(["CW", "ME", "PR"]);
    expect(c.dominant).toBe("boiler");
    expect(c.nights).toBe("SAT 17 OCT");
    for (const l of c.layers) {
      expect(l.seed).toBeGreaterThanOrEqual(0);
      expect(l.seed).toBeLessThan(1);
    }
  });

  test("a tie between venues reads as a mixed night; empty is an invitation", () => {
    expect(compose(["chromatic-aberration", "slow-meridian"]).dominant).toBe("mixed");
    const empty = compose([]);
    expect(empty.layers).toHaveLength(0);
    expect(empty.mood).toBe("Compose a night");
  });

  test("the projectionist stamp is carried through", () => {
    expect(compose(["slow-meridian"], true).stamp).toBe(true);
    expect(compose(["slow-meridian"]).stamp).toBe(false);
  });

  test("hash is stable", () => {
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("abc")).not.toBe(hash("abd"));
  });
});

describe("share state", () => {
  test("round-trips the saved night and an open event", () => {
    const state = { saved: ["chromatic-aberration", "perseid-room"], event: "slow-meridian" };
    const encoded = encodeState(state);
    expect(encoded).toBe("#night=CA.PR&event=slow-meridian");
    expect(decodeState(encoded)).toEqual(state);
  });

  test("ignores junk and duplicates", () => {
    expect(decodeState("#night=CA.zz.CA.pr&event=nope")).toEqual({
      saved: ["chromatic-aberration", "perseid-room"],
      event: null,
    });
    expect(encodeState({ saved: [], event: null })).toBe("");
  });
});
