# AFTERIMAGE

**Status:** v1 is complete. It is a single-scene festival experience for a fictional arts festival in a decommissioned observatory. You move a large projection lens until the split light resolves into the festival identity, browse and filter a ten-performance programme across The Lens, The Boiler Room and The Sky Deck, save performances, resolve clashes, choose a pass and reach a clearly labelled demo ticket. That ticket carries a poster composed from the night you saved. Everything runs locally: there is no backend, no network calls, no analytics, and all festival content is fictional.

## How to play

1. **Move the lens.** Drag anywhere on the observatory (mouse or touch), or focus the scene and use the arrow keys (Shift for fine steps). While the lens is out of focus, the light splits into red, green and blue beams that spill across the architecture. Bring it to the centre and it snaps into focus, the identity resolves on the screen, and the programme opens. **Enter** or **Focus for me** does it for you.
2. **Choose performances.** Filter by night and space. Open a performance to read about it and copy a direct link. **Save** adds it to your night and lays one authored motif onto your poster: a moving slit of light, a foil ribbon, a patterned projection or a field of soft colour. Changing the night changes the poster, which is projected live on the observatory screen.
3. **Visit the spaces.** Picking a space runs its stage transformation. The lens rings swing into alignment, foil ribbons unfurl in the Boiler Room, and the dome shutter opens above the rising Sky Deck. Your saved performances glow where they take place.
4. **Resolve clashes.** **My night** lists real overlaps. Pick **Keep this** on either side and everything overlapping it is dropped.
5. **Choose a pass and finish.** The pass that fits your night is preselected. **Issue demo pass** opens the ticket summary, which is marked as a demo with no purchase made. From there you can download the poster as a PNG, copy a link that restores your night (`#night=CA.SM…`) or **Compose another night** to start again.
6. **Optional:** the projectionist's puzzle in My night has three small boards. Turn the mirrors and open the shutters to light the sculpture. Solving all three adds a foil stamp to your pass. It never hides any performance.

The composition needs no sound, and v1 ships none. It honours `prefers-reduced-motion`: camera moves, transformations and idle motion become instant or still.

## Development

```sh
bun install --frozen-lockfile
bun run dev     # http://127.0.0.1:4513/
bun run check   # tsc, Biome, bun test, production build into dist/
```

- `src/game/`: the pure rules, covered by the tests in `tests/`. It holds the programme data, the filters, overlap detection and clash resolution, the itinerary-to-poster composition, the share-state codec, the pass options and demo ticket, the lens focus rules and the mirror puzzle.
- `src/scene/`: the three.js observatory, lens rig, venue transformations and beacons.
- `src/ui/`: the React HUD and the canvas poster renderer. The same renderer feeds the projection screen, the pass preview and the PNG export.
- `src/main.tsx`: mounts the app. `src/loader.ts` lifts the arrival veil after the first rendered frame.

## Credits

All geometry, shaders, poster motifs and typography are authored procedurally in this repository and set in the system font stack. There are no external images, models, fonts or audio. The environment reflections use three.js's built-in `RoomEnvironment` (MIT, part of three.js). All artists, performances and prices are fictional.
