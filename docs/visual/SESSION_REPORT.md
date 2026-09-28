# Fidelity pass: session report (stopped early)

The session stopped at the request of the collection coordinator because the cloud credit ran out. Everything below is committed and pushed to `cloud-v1`. The last commit is marked **WIP**.

**Where it stopped:** partway through task 3 of 5 (lighting and post). The new lighting, materials, post pipeline and detailed sets are all in the code, and one calibration round was applied after the first work-in-progress capture. **The calibrated build has not been captured**, so no "after" scores exist yet.

## State of checks

- `bun run check` **passes** on the WIP commit: strict tsc, Biome, 30 unit tests and the production build.
- `bun run e2e` (the Playwright journey) **was not re-run** after the stage refactor (input module, pipeline, new sets). Run it first locally.

## Done

1. **Evidence (complete).**
   - The `window.__VISUAL_TEST__` capture hook (`src/scene/visual-test.ts`) is active in dev and `?e2e` builds only. It offers `ready`, `setBookmark`, `freeze`, `settle` and `info`, and `info` reports the renderer string and tier.
   - Six camera bookmarks are defined in `src/scene/bookmarks.ts`: `wide`, `hero`, `closeup`, `grazing`, `sky` and `phone-hero`.
   - The capture script is `e2e/capture.ts` (`bun run capture <dir>`, with `CAPTURE_ONLY=a,b` for a subset).
   - The baseline is in `docs/visual/captures/baseline/` (SwiftShader: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`).
   - `docs/visual/AUDIT.md` holds the baseline scorecard (overall mean **2.2 / 5**), luminance targets and a ranked fix list.
2. **Assets (complete, 6.0 MB).** `tools/assets/fetch_assets.py` fetches and processes everything and writes `assets.manifest.json` (source URL, author, licence, date, sha256 and processing for every file). All assets are CC0:
   - ambientCG copper, patina and brass scans;
   - Poly Haven riveted metal plate and painted shutter;
   - concrete, planks and wool copied from ODD TIDE with their upstream records;
   - Poly Haven 8 mm projector, industrial pipe lamp and brass lantern (meshopt + WebP ≤1K);
   - the Poly Haven `boiler_room` HDRI.
3. **ODD TIDE:** cloned read-only to `/home/user/01-odd-tide` with no access problems. Its pipeline (half-float composer, GTAO with the shadow re-render suppressed, clamped bloom high-pass, single OutputPass) was adapted in `src/scene/render/pipeline.ts`. The idea behind its PBR role materials and tiling breakup was adapted into `src/scene/materials.ts`.
4. **Rendering (implemented, WIP calibration).**
   - **Pipeline:** RenderPass (half-float, linear) → GTAOPass → UnrealBloomPass (HDR threshold, clamped) → OutputPass (AgX + sRGB, once) → SMAAPass.
   - **Tiers:** high, medium and low. Phones start at medium. An adaptive step-down drops a tier after about 2 s of frames over 16.7 ms and is disabled for `?e2e` captures. `?quality=` overrides the tier.
   - **Lighting:** one model with exposure as the only brightness control. Moonlight through the slit is the key light, with 2048² fitted shadows. There are real point and spot lights only at fixtures: lamps, projector, fireboxes, lanterns and floodlights. The hemisphere, rim and venue "rescue" lights are removed. The HDRI swaps in after the veil for reflections and faint bounce.
5. **Materials and detail (implemented, WIP).**
   - **Dome:** riveted plate shell with ~1,800 jittered rivets along the ribs, a shutter mechanism (rails, gear rack, drive with wheels), column plinths and brass capitals, and a shader night sky with round, twinkling stars and a faint band.
   - **Lens:** a lathed biconvex element in transmissive glass (IOR 1.52, dispersion 0.35) in a knurled brass cell with set screws and pins, on a weighted stand base.
   - **Boilers:** lathed boilers with patinated riveted bands and seams, firebox doors with a real light each, gauges (bezel, painted dial, needle, glass), handwheel valves, and copper pipes with flanges.
   - **Sky Deck:** jittered planks on joists, braced legs, brass railing, draped wool blankets, a telescope, and sourced lanterns with flame lights.
   - **Beacons:** grounded on brass stands.

## First WIP capture (before the last calibration), not committed

`hero` and `grazing` were captured to a scratch folder. Material detail and density were clearly up (estimated 3 on materials and detail). But the frame was **washed out**: the dome plate was bright and brown, and the screen and throw beam were blown out. That broke the audit's luminance targets. The last WIP commit applies a calibration for it:

- iron, dome and shutter drop the scans' colour maps;
- exposure 1.0, environment 0.05, moonlight 1.1;
- screen gain 1.05, and the beams, haze and floodlight faces reduced;
- bloom threshold 1.8 and strength 0.24;
- finer copper tiling.

**The calibration is unverified.**

## Left to do (in order)

1. Run `bun run e2e` and fix anything the stage refactor broke.
2. Capture `wide, hero, closeup, grazing, sky, phone-hero` with `bun run preview` then `bun run capture docs/visual/captures/after`. Check the audit's luminance targets: dome median under about 12 %, black point under about 5 %, and saturated split beams and brass glints popping on `hero`. Iterate exposure and light intensities.
3. Check the **projector model's orientation and height** (`Projection.loadDeferred` assumes the model's lens faces −X) and the **pipe-lamp bulb height** (`lighting.ts` `loadDeferred`), then adjust after seeing a capture.
4. Split `src/scene/projection.ts` (318 lines) by moving the lens build into `lens.ts`, to respect the ~300-line rule.
5. Still missing from the directive: **depth-faded beam cones**, which need a scene depth texture and aren't implemented (beams fade along their length only). Also missing: a jittered hue on instanced rivets (only scale jitter is done), and contact grounding under the deck legs and firebox doors, which relies on GTAO.
6. Update `AUDIT.md` with after scores and the three most visible remaining flaws per bookmark. Refresh `docs/readme/desktop.png`, `phone.png` and `preview.gif` (the keyframe method in the README round works under SwiftShader; keep GIF disposal "none"). Update the README credits for the visual assets. The manifest already has them.
7. Measure the loader time and frame rate on a real GPU. Core textures (about 2.5 MB) are awaited before the first frame for at most 2.5 s; models and the HDRI stream in afterwards.

## Asset budget

The assets shipped in `public/assets` total 6.0 MB. Audio (1.9 MB) is unchanged. Both are well under the ~25 MB budget.
