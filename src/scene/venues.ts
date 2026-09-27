// The three spaces, their stage transformations and the beacons that mark saved performances.
import gsap from "gsap";
import * as THREE from "three";
import { PROGRAMME, type VenueId, venueById } from "../game/programme";
import type { VenueFilter } from "../game/schedule";
import type { Architecture } from "./architecture";
import type { Materials } from "./materials";

const ANCHORS: Record<VenueId, THREE.Vector3> = {
  lens: new THREE.Vector3(0, 0.55, 4.6),
  boiler: new THREE.Vector3(-5.6, 0.55, 1.8),
  sky: new THREE.Vector3(6.2, 0.55, 1.4),
};
const DECK_LOW = 0.8;
const DECK_HIGH = 2.3;

export const CAMERA_SHOTS: Record<VenueFilter, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
  all: { pos: new THREE.Vector3(0, 4.3, 12.4), look: new THREE.Vector3(0, 3.7, -1) },
  lens: { pos: new THREE.Vector3(1.4, 3.2, 8.6), look: new THREE.Vector3(0, 3.3, -1) },
  boiler: { pos: new THREE.Vector3(-1.6, 3.4, 9), look: new THREE.Vector3(-6.2, 2.4, -1.2) },
  sky: { pos: new THREE.Vector3(2.4, 5.4, 9.2), look: new THREE.Vector3(6.4, 4.2, -1.4) },
};

function twistedRibbon(length: number, turns: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.34, length, 1, 24);
  geo.translate(0, -length / 2, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const a = (y / length) * turns * Math.PI;
    const x = pos.getX(i);
    pos.setXYZ(i, x * Math.cos(a), y, x * Math.sin(a));
  }
  geo.computeVertexNormals();
  return geo;
}

export class Venues {
  readonly group = new THREE.Group();
  private readonly lights: Record<VenueId, THREE.PointLight>;
  private readonly rings: THREE.Mesh[] = [];
  private readonly ribbons: THREE.Mesh[] = [];
  private readonly deck = new THREE.Group();
  private readonly beacons = new Map<string, THREE.Mesh>();
  private timeline: gsap.core.Timeline | null = null;

  constructor(
    m: Materials,
    lens: THREE.Group,
    private readonly arch: Architecture,
  ) {
    this.lights = {
      lens: new THREE.PointLight(venueById("lens").colour, 6, 12, 1.6),
      boiler: new THREE.PointLight("#ff7a3a", 10, 14, 1.6),
      sky: new THREE.PointLight(venueById("sky").colour, 8, 14, 1.6),
    };
    this.lights.lens.position.set(0, 6.5, 3);
    this.lights.boiler.position.set(-6, 3.2, 1);
    this.lights.sky.position.set(6.2, 5.2, 0.6);
    this.group.add(...Object.values(this.lights));

    // The Lens: optical rings around the great lens that swing into alignment.
    [1.18, 1.32, 1.46].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 96), m.brass);
      ring.rotation.set(0.9 + i * 0.4, 0.6 - i * 0.5, 0);
      ring.castShadow = true;
      lens.add(ring);
      this.rings.push(ring);
    });

    this.buildBoiler(m);
    this.buildDeck(m);
    this.buildBeacons();
  }

  private buildBoiler(m: Materials) {
    const boiler = new THREE.Group();
    const tanks: [number, number, number, number][] = [
      [-7.6, 1.7, -1.6, 0.95],
      [-5.4, 1.3, -2.8, 0.75],
      [-8.6, 1.2, 1.2, 0.7],
    ];
    for (const [x, y, z, r] of tanks) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(r, y * 1.4, 8, 24), m.copper);
      tank.position.set(x, y + 0.2, z);
      tank.castShadow = true;
      boiler.add(tank);
      const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.05, 8, 48), m.brass);
      band.rotation.x = Math.PI / 2;
      band.position.set(x, y, z);
      boiler.add(band);
    }
    const routes: [number, number, number][][] = [
      [
        [-7.6, 3.4, -1.6],
        [-7.4, 6.2, -1.4],
        [-4.2, 7.0, -2.2],
        [-1.8, 7.4, -3.4],
      ],
      [
        [-5.4, 2.6, -2.8],
        [-5.2, 5.0, -3.4],
        [-3.0, 5.6, -4.0],
      ],
      [
        [-8.6, 2.2, 1.2],
        [-8.9, 5.4, 0.6],
        [-9.6, 7.0, -1.8],
      ],
      [
        [-9.8, 0.3, -3.2],
        [-7.2, 0.6, -3.6],
        [-4.6, 0.4, -3.2],
        [-3.2, 2.2, -3.8],
      ],
    ];
    for (const route of routes) {
      const curve = new THREE.CatmullRomCurve3(
        route.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      );
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.11, 10), m.copper);
      pipe.castShadow = true;
      boiler.add(pipe);
    }
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.6), m.mirror);
      panel.position.set(-4.4 - i * 1.05, 1.5, -0.4 + i * 0.35);
      panel.rotation.y = 0.5 + i * 0.12;
      boiler.add(panel);
    }
    const foil = new THREE.MeshStandardMaterial({
      color: "#d8b46a",
      metalness: 1,
      roughness: 0.22,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const ribbon = new THREE.Mesh(twistedRibbon(4.2 + (i % 3) * 0.6, 1.5 + (i % 2)), foil);
      ribbon.position.set(-3.8 - i * 0.75, 7, -1.8 + Math.sin(i * 1.7) * 1.4);
      ribbon.scale.y = 0.001;
      ribbon.visible = false;
      boiler.add(ribbon);
      this.ribbons.push(ribbon);
    }
    this.group.add(boiler);
  }

  private buildDeck(m: Materials) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, 3.8), m.iron);
    top.receiveShadow = true;
    top.castShadow = true;
    this.deck.add(top);
    for (const [x, z] of [
      [-2.3, -1.7],
      [2.3, -1.7],
      [-2.3, 1.7],
      [2.3, 1.7],
    ] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3, 0.14), m.iron);
      leg.position.set(x, -1.5, z);
      this.deck.add(leg);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.05), m.brass);
    rail.position.set(0, 1, 1.85);
    this.deck.add(rail);
    for (let i = 0; i <= 8; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), m.brass);
      post.position.set(-2.5 + i * 0.625, 0.5, 1.85);
      this.deck.add(post);
    }
    const blanket = new THREE.MeshStandardMaterial({ color: "#3a3170", roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.8), blanket);
      b.position.set(-1.6 + i * 1.1, 0.15, -0.4 + (i % 2) * 0.7);
      b.rotation.y = (i - 1.5) * 0.25;
      this.deck.add(b);
    }
    this.deck.position.set(6.4, DECK_LOW, -0.2);
    this.group.add(this.deck);
  }

  private buildBeacons() {
    const geo = new THREE.OctahedronGeometry(0.16, 0);
    const perVenue: Record<VenueId, number> = { lens: 0, boiler: 0, sky: 0 };
    for (const p of PROGRAMME) {
      const i = perVenue[p.venue]++;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.motif.hue).multiplyScalar(2.2) }),
      );
      mesh.position.copy(ANCHORS[p.venue]).add(new THREE.Vector3((i - 1.5) * 0.55, 0, i % 2));
      mesh.userData.baseY = mesh.position.y;
      mesh.scale.setScalar(0.001);
      mesh.visible = false;
      this.group.add(mesh);
      this.beacons.set(p.id, mesh);
    }
  }

  /** Beacon height follows the deck so Sky Deck tokens sit on it. */
  private beaconLift(id: string): number {
    const p = PROGRAMME.find((q) => q.id === id);
    return p?.venue === "sky" ? this.deck.position.y + 0.2 : 0;
  }

  setSaved(ids: readonly string[], reduced: boolean) {
    for (const [id, mesh] of this.beacons) {
      const on = ids.includes(id);
      const target = on ? 1 : 0.001;
      if (on) mesh.visible = true;
      gsap.to(mesh.scale, {
        x: target,
        y: target,
        z: target,
        duration: reduced ? 0 : 0.6,
        ease: on ? "back.out(2.4)" : "power2.in",
        onComplete: () => {
          if (!on) mesh.visible = false;
        },
      });
    }
  }

  /** The stage transformation: scenery and light move together into the chosen space. */
  setVenue(v: VenueFilter, reduced: boolean) {
    this.timeline?.kill();
    const d = reduced ? 0 : 1.6;
    const tl = gsap.timeline({ defaults: { duration: d, ease: "power3.inOut" } });
    const level = (id: VenueId) => (v === "all" ? 0.55 : v === id ? 1.4 : 0.18);
    tl.to(this.lights.lens, { intensity: 6 * level("lens") }, 0);
    tl.to(this.lights.boiler, { intensity: 10 * level("boiler") }, 0);
    tl.to(this.lights.sky, { intensity: 8 * level("sky") }, 0);

    this.rings.forEach((ring, i) => {
      const aligned = v === "lens";
      tl.to(
        ring.rotation,
        { x: aligned ? 0 : 0.9 + i * 0.4, y: aligned ? 0 : 0.6 - i * 0.5 },
        reduced ? 0 : i * 0.12,
      );
    });

    const unfurl = v === "boiler";
    this.ribbons.forEach((r, i) => {
      if (unfurl) r.visible = true;
      tl.to(
        r.scale,
        {
          y: unfurl ? 1 : 0.001,
          ease: unfurl ? "elastic.out(1, 0.6)" : "power2.in",
          onComplete: () => {
            if (!unfurl) r.visible = false;
          },
        },
        reduced ? 0 : 0.1 + i * 0.06,
      );
    });

    const open = v === "sky";
    tl.to(this.deck.position, { y: open ? DECK_HIGH : DECK_LOW }, 0);
    tl.to(this.arch.shutter.rotation, { y: open ? 0.55 : 0 }, 0);
    tl.to(this.arch.stars.material, { opacity: open ? 0.95 : 0.12 }, reduced ? 0 : 0.4);
    this.timeline = tl;
  }

  /** Idle life: beacons turn and bob; sky tokens stay on the deck as it moves. */
  update(time: number, reduced: boolean) {
    for (const [id, mesh] of this.beacons) {
      if (!mesh.visible) continue;
      const base = (mesh.userData.baseY as number) + this.beaconLift(id);
      mesh.position.y = base + (reduced ? 0 : Math.sin(time * 1.6 + mesh.position.x) * 0.08);
      if (!reduced) mesh.rotation.y = time * 0.8;
    }
  }
}
