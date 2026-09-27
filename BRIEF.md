# AFTERIMAGE — v1 brief for a cloud build session

You are building this project's v1 in one focused session. Ship a small, polished, complete experience — not a prototype and not a sprawling one. Read this brief once, write a plan of 5–10 lines, then build. Stop when the definition of done is met.

## The idea

**03 — AFTERIMAGE.** Design an original festival identity for a decommissioned observatory: The Lens, Boiler Room and Sky Deck. Connect venue discovery, programme filters, event details, conflict-aware scheduling and a demo pass journey. Saved performances determine a coherent personal pass/poster composition. Include an optional small mirror/shutter puzzle. Begin with one excellent projection scene and three programme choices that produce deliberate visual variations.

## 3. AFTERIMAGE — compose a night, leave with its light

### The stronger premise

A fictional arts festival takes over a decommissioned observatory. Old lenses, projection equipment, mechanical shutters and a sky deck become its visual language.

Three spaces carry different moods:

- **The Lens:** intimate light and sound performances beneath an enormous optical assembly.
- **The Boiler Room:** warm, tactile installations among pipes and reflective surfaces.
- **The Sky Deck:** open-air performances and slower late-night work.

As visitors choose performances, they build both a practical itinerary and a personal visual composition. Their final pass and poster remember the night they designed.

### The signature interaction

Move a large projection lens. Light separates across the architecture and resolves into the festival identity. The movement reveals the venue and its programme.

Saving a performance contributes one authored motif to the visitor's composition: a moving slit of light, a foil ribbon, a patterned projection or a field of soft colour. The combination comes from the actual saved itinerary, so changing the night changes the poster.

The composition must work silently. An optional sound layer uses original or appropriately licensed stems; it is not necessary for scheduling or the visual payoff.

### Features worth building

- A practical programme with day/stage filters, readable descriptions and direct links.
- **“My night”** with actual overlap detection and an easy way to choose between conflicting performances.
- Venue views that reveal where saved performances take place.
- A **personal pass** with a consistent visual identity generated from the selected programme.
- A static poster export and shareable itinerary state; motion export can be considered later.
- An optional **projectionist's puzzle**: rotate a few mirrors and shutters to light a sculpture. Use readable beam paths and a small number of authored puzzles.
- A short stage transformation for each space, with typography and physical scenery moving together.

### Useful journey

Discover the event, choose performances, resolve clashes, understand pass options and reach a clearly labelled demo ticket summary. No performance is hidden behind completing a game.

The projected identity, artist visuals, ticket and programme should belong to the same art direction. This coherence will matter more than the number of shader effects.

### First thing to prove

One lens/projection scene and three programme items. Saving different items produces visibly distinct but consistently beautiful pass designs. The programme remains usable while the spectacle is happening.

---

Art direction: **AFTERIMAGE:** optical glass, ink, foil, projection, oversized typography and theatrical light.

## Definition of done (v1)

1. One focused scene delivering the idea above, with a complete loop: start → core interaction → a visible result or ending → replay. A short first-time hint teaches the controls in place.
2. Arrival loader: keep the veil in `index.html` and `src/loader.ts`; restyle the veil to the art direction and call `worldReady()` after the first rendered frame.
3. Desktop (1440×900) and phone (390×844) layouts; mouse, touch and keyboard; honour `prefers-reduced-motion`; visible focus and labelled controls.
4. `bun run check` passes: strict `tsc`, Biome, `bun test`, production build into `dist/`.
5. Unit tests of the game rules (pure TypeScript, no DOM) replace `tests/scaffold.test.ts`.
6. `README.md`: one status paragraph, how to play, and credits for any asset used.
No extra modes, settings screens, accounts, leaderboards, backends, analytics or network calls.

## Technical rules

- The stack is installed and pinned: Vite, React, strict TypeScript, three.js 0.186 (direct, no React Three Fiber), GSAP, Tailwind v4, Biome, Bun. Add a dependency only if essential, pinned exactly.
- `bun run dev` serves the real app (`index.html` → `src/main.tsx`); `bun run build` builds it into `dist/`. `development/` is old tooling: leave it alone.
- Single responsibility: `src/game/` pure rules and state (tested), `src/scene/` three.js scene, camera, lights and meshes, `src/ui/` React HUD and panels, `src/main.tsx` wiring. Files under ~300 lines.
- Visuals: author forms procedurally in code (geometry, instancing, small shaders where they clearly help), AgX or ACES tone mapping, one key light plus hemisphere or environment light, soft shadows where cheap, a cohesive palette and strong silhouettes. Type: a system font stack. External assets only if CC0 or public domain, with the source in README.
- Performance: 60 fps on a mid laptop; cap devicePixelRatio at 2.
- Do not change `wrangler.jsonc`, deploy or publish anything.

## Working method

- There is no GPU here. Do not loop on screenshots: at most two headless checks (desktop, phone) if Chromium is available (software WebGL is fine).
- Commit in small, clear steps. Finish with a message: what was built, how to play, known gaps.
