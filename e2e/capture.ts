// Visual capture of every camera bookmark against a running preview (bun run preview).
// Usage: bun e2e/capture.ts <out-dir>   (SwiftShader, so it runs on machines without a GPU)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "docs/visual/captures/latest";
const base = process.env.CAPTURE_URL ?? "http://127.0.0.1:4613/";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

type Shot = { name: string; width: number; height: number };
const desktop: Shot[] = ["wide", "hero", "closeup", "grazing", "sky"].map((name) => ({
  name,
  width: 1440,
  height: 900,
}));
const only = process.env.CAPTURE_ONLY?.split(",");
const shots: Shot[] = [...desktop, { name: "phone-hero", width: 390, height: 844 }].filter(
  (s) => !only || only.includes(s.name),
);
const log: Record<string, unknown>[] = [];

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  const started = Date.now();
  await page.goto(`${base}?e2e#night=CA.SM.CW`);
  await page.waitForFunction(() => window.__VISUAL_TEST__ !== undefined, null, {
    timeout: 120_000,
  });
  await page.evaluate(() => window.__VISUAL_TEST__?.ready);
  // The capture is of the scene: hide the HUD and the arrival veil.
  await page.addStyleTag({
    content: "#root > :not(canvas), #arrival { display: none !important; }",
  });
  await page.evaluate(async (name) => {
    const vt = window.__VISUAL_TEST__;
    if (!vt) throw new Error("no capture hook");
    vt.freeze(false);
    vt.setBookmark(name as never);
    await vt.settle(4);
    vt.freeze(true);
    await vt.settle(3);
  }, shot.name);
  const file = join(out, `${shot.name}.png`);
  await page.screenshot({ path: file, timeout: 300_000 });
  const info = await page.evaluate(() => window.__VISUAL_TEST__?.info());
  log.push({ ...shot, file, ms: Date.now() - started, ...info });
  console.log(shot.name, Date.now() - started, "ms", info?.renderer);
  await page.close();
}

writeFileSync(
  join(out, only ? `capture-${only.join("-")}.json` : "capture.json"),
  `${JSON.stringify({ date: new Date().toISOString(), shots: log }, null, 2)}\n`,
);
await browser.close();
