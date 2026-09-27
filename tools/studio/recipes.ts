import type { Recipes } from "./kit/build";
import {
  bend,
  blend,
  box,
  capsule,
  carve,
  chain,
  cone,
  cylinder,
  displace,
  ellipsoid,
  extrude,
  fbm,
  lathe,
  type Mat,
  mat,
  mirrorX,
  mottle,
  move,
  type Node,
  paint,
  polygon2,
  radial,
  rng,
  rotate,
  scale,
  sphere,
  subtract,
  torus,
  union,
  type Vec3,
} from "./kit/sdf";

const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)] as T;
const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
void [bend, blend, box, capsule, carve, chain, cone, cylinder, displace, ellipsoid, extrude, fbm, lathe, mirrorX, mottle, move, paint, polygon2, radial, rotate, scale, sphere, subtract, torus, union];
type Build = (seed: number, index: number) => Node;
void (0 as unknown as Mat | Vec3 | Build);

// AFTERIMAGE — decommissioned-observatory machinery: boiler tanks and valves, lens housings,
// gears, gauges and projectors in brass, iron, optical glass and enamel.
const BRASS = mat(0xc49a4a, 0.3, 1);
const IRON = mat(0x3c3f44, 0.55, 1);
const ENAMEL = [0x1f3d5a, 0x7a2f3a, 0x2f5a4a, 0xe8e0cc];

const gear2 = (teeth: number, radius: number, depth: number) => (x: number, y: number) => {
  const a = Math.atan2(y, x);
  const rr = Math.hypot(x, y);
  const tooth = Math.max(0, Math.cos(a * teeth)) ** 0.6 * depth;
  return Math.max(rr - (radius + tooth), radius * 0.25 - rr);
};
const gear: Build = (seed) => {
  const r = rng(seed);
  const radius = range(r, 0.05, 0.25);
  const teeth = 10 + Math.floor(r() * 30);
  const g = extrude(gear2(teeth, radius, radius * 0.12), [-radius * 1.2, -radius * 1.2, radius * 1.2, radius * 1.2], radius * 0.2, 0.002, r() < 0.5 ? BRASS : IRON);
  const holes = 4 + Math.floor(r() * 3);
  let body: Node = g;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    body = subtract(body, move(cylinder(radius * 0.18, radius, 0), [Math.cos(a) * radius * 0.6, Math.sin(a) * radius * 0.6, 0]));
  }
  return rotate(body, [Math.PI / 2, 0, 0]);
};
const tank: Build = (seed) => {
  const r = rng(seed);
  const len = range(r, 0.8, 1.8);
  const rad = range(r, 0.25, 0.45);
  const shell = mat(pick(r, ENAMEL), 0.4, 0.3);
  const body = rotate(capsule([0, 0, -len / 2], [0, 0, len / 2], rad, rad, shell), [0, 0, 0]);
  const rivets = union(...[-0.3, 0, 0.3].map((t) => move(radial(move(sphere(0.012, IRON), [rad + 0.002, 0, 0]), 24), [0, 0, t * len])));
  const legs = mirrorX(union(capsule([rad * 0.6, -rad * 0.5, -len * 0.3], [rad * 0.8, -rad - 0.25, -len * 0.3], 0.03, 0.03, IRON), capsule([rad * 0.6, -rad * 0.5, len * 0.3], [rad * 0.8, -rad - 0.25, len * 0.3], 0.03, 0.03, IRON)));
  const pipe = chain([[0, rad, 0], [0, rad + 0.3, 0], [0.2, rad + 0.45, 0.1], [0.5, rad + 0.45, 0.1]], 0.04, 0.04, BRASS, 0.03);
  const valve = move(union(torus(0.08, 0.012, mat(0xa3322e, 0.5)), radial(capsule([0, 0, 0], [0.08, 0, 0], 0.008, 0.008, mat(0xa3322e, 0.5)), 5)), [0.5, rad + 0.55, 0.1]);
  return union(blend(0.02, body, legs), rivets, pipe, valve);
};
const lensHousing: Build = (seed) => {
  const r = rng(seed);
  const rad = range(r, 0.06, 0.18);
  const len = range(r, 0.15, 0.5);
  const tube = rotate(cylinder(rad, len, 0.004, pick(r, [BRASS, IRON, mat(0x1f3d5a, 0.35)])), [Math.PI / 2, 0, 0]);
  const rings = union(...[-0.45, 0, 0.45].map((t) => move(rotate(torus(rad * 1.04, rad * 0.06, BRASS), [Math.PI / 2, 0, 0]), [0, 0, t * len])));
  const glass = move(scale(sphere(1, mat(0x9fc6cf, 0.05)), rad * 0.95), [0, 0, len / 2 - rad * 0.75]);
  return union(subtract(tube, move(rotate(cylinder(rad * 0.85, len * 0.2), [Math.PI / 2, 0, 0]), [0, 0, len / 2])), rings, intersectZ(glass, len / 2 - rad * 0.2));
};
const intersectZ = (n: Node, z: number): Node => ({ d: (x, y, zz) => Math.max(n.d(x, y, zz), zz - z), mat: n.mat, box: n.box });
const gauge: Build = (seed) => {
  const r = rng(seed);
  const rad = range(r, 0.05, 0.12);
  const face = mat(0xefe6d2, 0.4);
  const body = rotate(union(cylinder(rad, rad * 0.4, 0.004, BRASS), move(cylinder(rad * 0.9, rad * 0.05, 0, face), [0, rad * 0.2, 0])), [Math.PI / 2, 0, 0]);
  const needle = capsule([0, 0, rad * 0.24], [rad * 0.7 * Math.cos(r() * 3), rad * 0.7 * Math.sin(r() * 3), rad * 0.24], rad * 0.03, rad * 0.01, mat(0xa3322e, 0.4));
  return union(body, needle, capsule([0, -rad, 0], [0, -rad * 2, 0], rad * 0.15, rad * 0.15, BRASS));
};
const projector: Build = (seed) => {
  const r = rng(seed);
  const shell = mat(pick(r, ENAMEL), 0.35, 0.2);
  const body = lathe([[0, 0], [0.22, 0], [0.26, 0.08], [0.26, 0.4], [0.2, 0.5], [0, 0.5]], 0, shell, true);
  const fins = radial(move(box(0.02, 0.3, 0.08, 0.004, IRON), [0.28, 0.25, 0]), 16);
  const barrel = move(rotate(cylinder(0.08, 0.35, 0.01, BRASS), [Math.PI / 2, 0, 0]), [0, 0.25, 0.4]);
  const lens = move(sphere(0.07, mat(0x9fc6cf, 0.05)), [0, 0.25, 0.58]);
  return union(body, fins, barrel, lens, move(cylinder(0.3, 0.04, 0.01, IRON), [0, -0.02, 0]));
};

export const project = { id: "03-afterimage", name: "AFTERIMAGE", background: 0x1b1d2a };
export const families: Recipes["families"] = [
  { id: "gear", count: 60, voxel: 0.0025, keep: 0.3, build: gear },
  { id: "boiler-tank", count: 20, voxel: 0.01, keep: 0.25, hero: true, build: tank },
  { id: "lens-housing", count: 24, voxel: 0.003, keep: 0.3, build: lensHousing },
  { id: "gauge", count: 32, voxel: 0.002, keep: 0.3, build: gauge },
  { id: "projector", count: 12, voxel: 0.006, keep: 0.3, hero: true, build: projector },
];
export const textures: Recipes["textures"] = [
  { id: "aged-brass", ramp: [0x5d4a26, 0x9c7a36, 0xc49a4a, 0xd9b565], layers: [{ kind: "fibres", scale: 64, stretch: 12 }, { kind: "fbm", scale: 6, weight: 0.8 }], roughness: [0.25, 0.6], normal: 0.6 },
  { id: "cast-iron", ramp: [0x2a2c30, 0x3c3f44, 0x55585e], layers: [{ kind: "fbm", scale: 40, octaves: 5 }, { kind: "cells", count: 30, weight: 0.3 }], roughness: [0.5, 0.8], normal: 1.5 },
  { id: "velvet-curtain", ramp: [0x3a0f18, 0x6e1f2c, 0x8f2a3a], layers: [{ kind: "fibres", scale: 8, stretch: 3 }, { kind: "fbm", scale: 64, weight: 0.3 }], roughness: [0.7, 0.95], normal: 1 },
  { id: "foil-print", ramp: [0x8a6d2a, 0xd9b565, 0xf2dc9c], layers: [{ kind: "cells", count: 40, crack: true }, { kind: "fbm", scale: 16, weight: 0.4 }], roughness: [0.15, 0.35], normal: 0.8 },
  { id: "observatory-plaster", ramp: [0xb8b1a3, 0xd9d2c3, 0xe8e2d4], layers: [{ kind: "fbm", scale: 10, octaves: 6 }, { kind: "cells", count: 8, crack: true, weight: 0.2 }], roughness: [0.8, 0.95], normal: 1.2 },
];
