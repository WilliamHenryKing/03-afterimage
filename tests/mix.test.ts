import { describe, expect, test } from "bun:test";
import { CUE_GAIN, CUES, lensHum, musicLevel } from "../src/audio/mix";

describe("sound mix", () => {
  test("every cue has a level within a safe range", () => {
    for (const cue of CUES) {
      expect(CUE_GAIN[cue]).toBeGreaterThan(0);
      expect(CUE_GAIN[cue]).toBeLessThanOrEqual(1);
    }
  });

  test("the lens hum swells with motion and rises in pitch towards focus", () => {
    const still = lensHum(0, 0.8);
    const moving = lensHum(1.5, 0.8);
    expect(moving.gain).toBeGreaterThan(still.gain);
    expect(lensHum(1, 0).rate).toBeGreaterThan(lensHum(1, 1).rate);
    expect(lensHum(99, 5).gain).toBeLessThanOrEqual(0.4);
  });

  test("music waits for the identity and ducks under dialogs", () => {
    expect(musicLevel(false, false)).toBe(0);
    expect(musicLevel(true, true)).toBeLessThan(musicLevel(true, false));
  });
});
