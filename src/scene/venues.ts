// The three spaces, their stage transformations and the beacons that mark saved performances.
import gsap from "gsap";
import * as THREE from "three";
import { PROGRAMME, type VenueId } from "../game/programme";
import type { VenueFilter } from "../game/schedule";
import type { Architecture } from "./architecture";
import type { Materials } from "./materials";

const ANCHORS: Record<VenueId, THREE.Vector3> = {
  lens: new THREE.Vector3(0, 0.55, 4.6),
  boiler: new THREE.Vector3(-5.6, 0.55, 1.8),
  sky: new THREE.Vector3(6.2, 0.55, -0.7),
};
const DECK_LOW = 0.8;
const DECK_HIGH = 2.3;

export const CAMERA_SHOTS: Record<VenueFilter, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
  all: { pos: new THREE.Vector3(0, 4.1, 12.8), look: new THREE.Vector3(0, 3.4, -1) },
  lens: { pos: new THREE.Vector3(7.6, 3.8, 5.6), look: new THREE.Vector3(-0.8, 2.9, -0.2) },
  boiler: { pos: new THREE.Vector3(-1.2, 3.1, 8.4), look: new THREE.Vector3(-6.6, 2.4, -1.6) },
  sky: { pos: new THREE.Vector3(3.4, 2.8, 8.8), look: new THREE.Vector3(7.2, 7.2, -6) },
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
  private readonly rings: THREE.Mesh[] = [];
  private readonly ribbons: THREE.Mesh[] = [];
  private readonly beacons = new Map<string, THREE.Mesh>();
  private readonly stands = new Map<string, THREE.Mesh>();
  private timeline: gsap.core.Timeline | null = null;

  constructor(
    m: Materials,
    lens: THREE.Group,
    private readonly arch: Architecture,
    readonly deck: THREE.Group,
  ) {
    // The Lens: optical rings around the great lens that swing into alignment.
    [1.18, 1.32, 1.46].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 96), m.brass);
      ring.rotation.set(0.9 + i * 0.4, 0.6 - i * 0.5, 0);
      ring.castShadow = true;
      lens.add(ring);
      this.rings.push(ring);
    });

    this.buildRibbons();
    this.deck.position.set(6.4, DECK_LOW, -0.2);
    this.group.add(this.deck);
    this.buildBeacons(m);
  }

  private buildRibbons() {
    // Foil ribbons over the boilers: an installation that unfurls when the Boiler Room is chosen.
    const foil = new THREE.MeshPhysicalMaterial({
      color: "#e6c27a",
      metalness: 1,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 5; i++) {
      const ribbon = new THREE.Mesh(twistedRibbon(3.0 + (i % 3) * 0.5, 1.5 + (i % 2)), foil);
      ribbon.position.set(-4.4 - i * 1.1, 7, -3.4 + Math.sin(i * 1.7) * 0.6);
      ribbon.scale.y = 0.001;
      ribbon.visible = false;
      this.group.add(ribbon);
      this.ribbons.push(ribbon);
    }
  }

  private buildBeacons(m: Materials) {
    const geo = new THREE.OctahedronGeometry(0.14, 0);
    const standGeo = new THREE.CylinderGeometry(0.012, 0.05, 1, 10);
    standGeo.translate(0, 0.5, 0);
    const perVenue: Record<VenueId, number> = { lens: 0, boiler: 0, sky: 0 };
    for (const p of PROGRAMME) {
      const i = perVenue[p.venue]++;
      // A light token in the performance's colour (an emitter), held on a brass stand.
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: "#111111",
          emissive: p.motif.hue,
          emissiveIntensity: 6,
          roughness: 0.3,
        }),
      );
      mesh.position.copy(ANCHORS[p.venue]).add(new THREE.Vector3((i - 1.5) * 0.55, 0, i % 2));
      mesh.userData.baseY = mesh.position.y;
      mesh.scale.setScalar(0.001);
      mesh.visible = false;
      const stand = new THREE.Mesh(standGeo, m.brass);
      stand.position.set(mesh.position.x, 0, mesh.position.z);
      stand.visible = false;
      stand.castShadow = true;
      this.group.add(mesh, stand);
      this.beacons.set(p.id, mesh);
      this.stands.set(p.id, stand);
    }
  }

  /** Beacon height follows the deck so Sky Deck tokens sit on it. */
  private beaconLift(id: string): number {
    const p = PROGRAMME.find((q) => q.id === id);
    return p?.venue === "sky" ? this.deck.position.y + 0.11 : 0;
  }

  setSaved(ids: readonly string[], reduced: boolean) {
    for (const [id, mesh] of this.beacons) {
      const on = ids.includes(id);
      const target = on ? 1 : 0.001;
      if (on) mesh.visible = true;
      const stand = this.stands.get(id);
      if (stand) stand.visible = on;
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
    tl.to(this.arch.shutter.rotation, { y: open ? 0.7 : 0 }, 0);
    tl.to(this.arch.sky, { value: open ? 1 : 0.15 }, reduced ? 0 : 0.4);
    this.timeline = tl;
  }

  /** Idle life: beacons turn and bob; sky tokens stay on the deck as it moves. */
  update(time: number, reduced: boolean) {
    for (const [id, mesh] of this.beacons) {
      if (!mesh.visible) continue;
      const lift = this.beaconLift(id);
      const base = (mesh.userData.baseY as number) + lift;
      mesh.position.y = base + (reduced ? 0 : Math.sin(time * 1.6 + mesh.position.x) * 0.03);
      if (!reduced) mesh.rotation.y = time * 0.8;
      const stand = this.stands.get(id);
      if (stand) {
        stand.position.y = lift;
        stand.scale.y = Math.max(0.01, mesh.position.y - lift - 0.1);
      }
    }
  }
}
