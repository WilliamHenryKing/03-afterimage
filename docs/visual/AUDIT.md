# AFTERIMAGE visual audit

Evidence: `docs/visual/captures/<run>/` holds one PNG per camera bookmark plus `capture.json`, which records the renderer string, pixel ratio, draw calls and triangles. Captures come from `bun run capture <dir>` against `bun run preview`. It runs headless Chromium on SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`) with the HUD hidden, time frozen and the bookmark applied through `window.__VISUAL_TEST__` (dev and `?e2e` builds only).

Bookmarks (`src/scene/bookmarks.ts`):

| Bookmark | Framing |
| --- | --- |
| `wide` | Establishing wide from inside the column ring: dome, gallery, all three spaces, split light |
| `hero` | The arrival composition: lens in focus, beams converged on the screen |
| `closeup` | Arm's length on the lens rim, glass and optical rings |
| `grazing` | Grazing angle along the copper boilers and gauges |
| `sky` | Sky Deck with the dome shutter open |
| `phone-hero` | The hero framing at 390 × 844 portrait |

Scale: 1 placeholder, 2 tech demo, 3 competent indie, 4 premium studio web piece, 5 reference quality.

## Scorecard: baseline (`captures/baseline/`, commit before the fidelity pass)

| Bookmark | Light | Materials | Detail | Env. integration | Atmosphere & depth | Composition | Artefacts | Motion & UI | Mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wide | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 2.3 |
| hero | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.4 |
| closeup | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 3 | 2.0 |
| grazing | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 3 | 2.0 |
| sky | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2.1 |
| phone-hero | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 2.3 |
| **All** | | | | | | | | | **2.2** |

What the baseline shows:

- **Light:** a synthetic `RoomEnvironment` at low intensity, plus a hemisphere fill and a rim "rescue" light, flatten the room into an even blue-grey. The only warm pools come from untextured point lights. Bulbs and fireboxes are `MeshBasicMaterial` colours multiplied by 2–3, glowing without bloom, so they read as stickers.
- **Materials:** every surface is a flat `MeshStandardMaterial` colour. The copper and brass are uniform, plastic-looking metals that reflect a featureless room. The floor and dome have no texture, roughness variation or wear.
- **Detail:** boilers are capsules, gauges are flat discs and fireboxes are emissive rectangles. The lens is a squashed translucent sphere inside plain tori. The deck is a table with slab blankets. The dome ribs are bare tubes with no rivets, seams or shutter mechanism. The close-up and grazing shots fall apart at arm's length.
- **Environment integration:** props have no contact shadows or AO and float slightly (beacon diamonds, firebox glow cards). Stars through the shutter are square pixels on flat black.
- **Atmosphere:** the fog and beam haze work, but everything sits in one mid-grey band. There's no deep black and no highlight roll-off except on the screen.
- **Composition:** the arrival and hero framings are clear (lens, beams and screen in one line). The sky view looks up at mostly empty dome.

## Luminance targets (to keep contrast and colour through the pass)

These relationships are checked on the `hero` and `wide` captures:

- Dome shell and upper walls stay dark, around 3–8 % display luminance, and never lift to grey. Shadowed floor sits at 6–15 %.
- The lit floor inside lamp pools reaches 25–40 %, warm.
- Brass and copper specular highlights reach 75–95 %, with their body colour at 20–45 % and saturated.
- Beam cores at convergence and the screen whites reach 90–100 % and bloom. The split beams stay saturated red, green and blue, not pastel.
- Haze adds at most about 5 % to the dark regions, so the black point must stay below about 5 %.
- The hero bookmark must pop: the brightest 1 % of pixels (beams, screen, brass glints) against a dome whose median stays below about 12 %.

## Ranked fix list (baseline)

1. **One lighting model.** Replace `RoomEnvironment`, the hemisphere and the rim rescue with an interior HDRI environment. Use physically scaled real lights: a projector spot, lamp point lights and moonlight through the slit. Exposure is the only brightness control, and there are no emissive multipliers except true emitters feeding bloom.
2. **Metals.** Scanned PBR copper and brass with HDRI reflections, darker patina in recesses and polish on edges. Colour maps sRGB, the rest linear.
3. **Lens glass.** Physical transmission with thickness, IOR and a dispersion hint. A machined rim with knurling and set screws.
4. **Dome structure.** Rivet rows along ribs, panel seams and a shutter mechanism (rails, rack, wheels) along the slit.
5. **Post pipeline.** GTAO for contact occlusion, `UnrealBloomPass` with an HDR threshold (emitters only), SMAA and a single `OutputPass` for tone mapping and sRGB.
6. **Boiler Room props.** Lathed boilers with flanges, rivet bands and hatch doors. Gauges with bezels and glass. Valves and wheels. Pipes with flanged joints. Steam that sits in the light.
7. **Sky Deck props.** Planked deck, cloth blankets, real lanterns and a proper sky through the slit with round, twinkling stars.
8. **Grounding.** Fitted, texel-snapped key shadows. Nothing floating: beacons sit on plinths or hang from wires.
9. **Variation.** Instanced columns, lamps, bulbs and rivets get 15–25 % scale, rotation and hue jitter.
10. **Performance tiers.** Adaptive quality that drops GTAO and heavy passes when frame time stays above 16.7 ms for about 2 s, a lower phone tier, and asset loading deferred past the arrival veil where possible.
