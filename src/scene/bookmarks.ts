// Camera bookmarks for visual review: fixed, repeatable framings of the scene's key views.
import * as THREE from "three";
import type { LensPos } from "../game/lens";
import type { VenueFilter } from "../game/schedule";

export interface Bookmark {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  lens: LensPos;
  venue: VenueFilter;
  /** Vertical field of view in degrees; omitted means the adaptive framing fov. */
  fov?: number;
  note: string;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const BOOKMARKS = {
  wide: {
    pos: v(0, 6.4, 10.1),
    look: v(0, 3.0, -4),
    lens: { x: -0.55, y: -0.35 },
    venue: "all",
    fov: 60,
    note: "Establishing wide: dome, gallery, all three spaces, split light.",
  },
  hero: {
    pos: v(0, 4.1, 12.8),
    look: v(0, 3.4, -1),
    lens: { x: 0, y: 0 },
    venue: "all",
    note: "Hero: lens in focus, beams converged on the screen.",
  },
  closeup: {
    pos: v(1.5, 2.3, 5.1),
    look: v(0, 1.8, 2.4),
    lens: { x: 0, y: 0 },
    venue: "lens",
    fov: 40,
    note: "Arm's length: lens rim, glass and optical rings.",
  },
  grazing: {
    pos: v(-4.6, 1.2, 2.9),
    look: v(-7.4, 1.5, -1.4),
    lens: { x: 0, y: 0 },
    venue: "boiler",
    fov: 42,
    note: "Grazing-angle material shot along the copper boilers and gauges.",
  },
  sky: {
    pos: v(3.4, 2.8, 8.8),
    look: v(7.2, 7.2, -6),
    lens: { x: 0, y: 0 },
    venue: "sky",
    fov: 50,
    note: "Sky Deck: open shutter, stars, deck and lanterns.",
  },
  "phone-hero": {
    pos: v(0, 4.1, 12.8),
    look: v(0, 3.4, -1),
    lens: { x: 0, y: 0 },
    venue: "all",
    note: "Hero framing at phone portrait (390x844); uses the adaptive portrait fov.",
  },
} satisfies Record<string, Bookmark>;

export type BookmarkName = keyof typeof BOOKMARKS;
