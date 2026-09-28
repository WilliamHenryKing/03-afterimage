// Per-venue staging that lives beyond the transformations: steam, gauges and firebox glow in
// the Boiler Room; lanterns and meteors on the Sky Deck; floodlit rig and screen in The Lens.
import gsap from "gsap";
import * as THREE from "three";
import type { VenueFilter } from "../game/schedule";
import { glowMap, glowSprite, type Materials } from "./materials";

const TANKS: [number, number, number, number][] = [
  [-7.6, 1.7, -1.6, 0.95],
  [-5.4, 1.3, -2.8, 0.75],
  [-8.6, 1.2, 1.2, 0.7],
];
const VENTS = [
  new THREE.Vector3(-1.8, 7.4, -3.4),
  new THREE.Vector3(-3.0, 5.6, -4.0),
  new THREE.Vector3(-9.6, 7.0, -1.8),
  new THREE.Vector3(-7.6, 3.6, -1.6),
];
const METEOR_DIR = new THREE.Vector3(-0.8, -0.45, 0.2).normalize();

export class Staging {
  readonly group = new THREE.Group();
  private readonly level = { lens: 0.4, boiler: 0.4, sky: 0.2 };
  private readonly steam: THREE.Sprite[] = [];
  private readonly needles: THREE.Mesh[] = [];
  private readonly fireboxes: THREE.Mesh[] = [];
  private readonly lanterns: THREE.Sprite[] = [];
  private readonly lanternLight = new THREE.PointLight("#ffb45e", 0, 6, 1.6);
  private readonly floods: THREE.SpotLight[] = [];
  private readonly meteor: THREE.Mesh;
  private readonly meteorMat: THREE.MeshBasicMaterial;
  private meteorT = -1;
  private nextMeteor = 2;

  constructor(m: Materials, deck: THREE.Group) {
    this.buildBoiler(m);
    this.buildDeck(deck);
    this.buildFloods(m);

    // One reusable meteor streak beyond the dome slit.
    this.meteorMat = new THREE.MeshBasicMaterial({
      map: glowMap(),
      color: "#e8e6ff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.meteor = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.25), this.meteorMat);
    this.meteor.visible = false;
    this.group.add(this.meteor);
  }

  private buildBoiler(m: Materials) {
    const fire = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ff6a1f").multiplyScalar(2.2),
    });
    const face = new THREE.MeshStandardMaterial({ color: "#efe6cf", roughness: 0.5 });
    const needleMat = new THREE.MeshBasicMaterial({ color: "#1a1010" });
    for (const [x, y, z, r] of TANKS) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, r * 0.45, 0.06), fire);
      box.position.set(x, 0.45, z + r + 0.02);
      this.fireboxes.push(box);
      const glow = glowSprite("#ff7a2a", r * 2.4);
      glow.position.set(x, 0.5, z + r + 0.3);
      this.group.add(box, glow);

      const gauge = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), m.brass);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), face);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.01), needleMat);
      needle.geometry.translate(0, 0.07, 0.01);
      gauge.add(rim, disc, needle);
      gauge.position.set(x + r * 0.3, y + 0.6, z + r + 0.04);
      this.needles.push(needle);
      this.group.add(gauge);
    }
    // Steam: soft puffs that rise and fade from the vents, recycled forever.
    const steamMat = new THREE.SpriteMaterial({
      map: glowMap(),
      color: "#d8d4cc",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 28; i++) {
      const puff = new THREE.Sprite(steamMat.clone());
      puff.userData = { vent: i % VENTS.length, phase: i / 28, drift: Math.random() * Math.PI * 2 };
      this.steam.push(puff);
      this.group.add(puff);
    }
  }

  private buildDeck(deck: THREE.Group) {
    // Low lanterns among the blankets on the deck.
    const glass = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffc27a").multiplyScalar(2),
    });
    for (let i = 0; i < 5; i++) {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), glass);
      lantern.position.set(-2 + i * 1.0, 0.22, (i % 2 ? 0.9 : -1.1) + Math.sin(i) * 0.2);
      const glow = glowSprite("#ffb45e", 0.9);
      glow.position.copy(lantern.position);
      this.lanterns.push(glow);
      deck.add(lantern, glow);
    }
    this.lanternLight.position.set(0, 0.8, 0);
    deck.add(this.lanternLight);
  }

  private buildFloods(m: Materials) {
    // Two brass floodlights flank the screen: in The Lens they stage the rig like a proscenium.
    for (const x of [-3.4, 3.4]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3, 8), m.brass);
      stand.position.set(x, 1.5, -2.6);
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.32, 0.45, 16, 1, true),
        m.iron,
      );
      head.position.set(x, 3.1, -2.6);
      head.lookAt(0, 4.5, -4.2);
      head.rotateX(Math.PI / 2);
      const glow = glowSprite("#fff1d6", 0.9);
      glow.position.set(x * 0.95, 3.1, -2.75);
      const spot = new THREE.SpotLight("#fff1d6", 0, 14, 0.5, 0.6, 1.4);
      spot.position.set(x, 3.1, -2.6);
      spot.target.position.set(-x * 0.3, 2.2, 2.4);
      this.floods.push(spot);
      this.group.add(stand, head, glow, spot, spot.target);
    }
  }

  setVenue(v: VenueFilter, reduced: boolean) {
    const target = {
      lens: v === "lens" ? 1 : v === "all" ? 0.4 : 0.1,
      boiler: v === "boiler" ? 1 : v === "all" ? 0.4 : 0.15,
      sky: v === "sky" ? 1 : 0.15,
    };
    gsap.to(this.level, { ...target, duration: reduced ? 0 : 1.6, ease: "power2.inOut" });
  }

  update(time: number, dt: number, reduced: boolean) {
    const { lens, boiler, sky } = this.level;
    for (const f of this.floods) f.intensity = 30 * lens;

    const flicker = reduced ? 1 : 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.07;
    for (const box of this.fireboxes) box.scale.setScalar(0.6 + 0.4 * boiler * flicker);
    this.needles.forEach((n, i) => {
      n.rotation.z = -0.6 + boiler * 1.2 + (reduced ? 0 : Math.sin(time * (2 + i) + i) * 0.06);
    });
    for (const puff of this.steam) {
      const d = puff.userData as { vent: number; phase: number; drift: number };
      const k = reduced ? d.phase : (d.phase + time * 0.12) % 1;
      const vent = VENTS[d.vent] as THREE.Vector3;
      puff.position.set(
        vent.x + Math.sin(d.drift + k * 3) * 0.4,
        vent.y + k * 2.4,
        vent.z + Math.cos(d.drift) * 0.3,
      );
      puff.scale.setScalar(0.8 + k * 2.6);
      puff.material.opacity = Math.sin(k * Math.PI) * (0.12 + 0.34 * boiler);
    }

    this.lanternLight.intensity = 4 * sky;
    this.lanterns.forEach((l, i) => {
      l.material.opacity =
        0.3 + 0.7 * sky * (reduced ? 1 : 0.9 + Math.sin(time * 3 + i * 1.7) * 0.1);
    });
    this.updateMeteor(time, dt, reduced, sky);
  }

  private updateMeteor(time: number, dt: number, reduced: boolean, sky: number) {
    if (reduced || sky < 0.5) {
      this.meteor.visible = false;
      this.meteorT = -1;
      return;
    }
    if (this.meteorT < 0 && time > this.nextMeteor) {
      this.meteorT = 0;
      // Start somewhere in the slit's patch of sky, beyond the dome.
      const phi = 4.25 + (Math.random() - 0.5) * 0.35;
      const theta = 0.35 + Math.random() * 0.5;
      const r = 36;
      this.meteor.position.set(
        -r * Math.cos(phi) * Math.sin(theta),
        r * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
      );
      this.meteor.lookAt(0, 4, 0);
      this.meteor.visible = true;
    }
    if (this.meteorT >= 0) {
      this.meteorT += dt;
      const k = this.meteorT / 0.9;
      this.meteor.position.addScaledVector(METEOR_DIR, dt * 22);
      this.meteorMat.opacity = Math.sin(Math.min(1, k) * Math.PI) * sky;
      if (k >= 1) {
        this.meteor.visible = false;
        this.meteorT = -1;
        this.nextMeteor = time + 2.5 + Math.random() * 4;
      }
    }
  }
}
