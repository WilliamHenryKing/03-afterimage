// Per-venue staging beyond the transformations: the Boiler Room and Sky Deck sets, floodlights
// that stage The Lens, and meteors through the open shutter. Venue levels drive their lights.
import gsap from "gsap";
import * as THREE from "three";
import type { VenueFilter } from "../game/schedule";
import { BoilerRoom } from "./boilers";
import { SkyDeck } from "./deck";
import { glowMap, type Materials } from "./materials";

const METEOR_DIR = new THREE.Vector3(-0.8, -0.45, 0.2).normalize();

export class Staging {
  readonly group = new THREE.Group();
  readonly boilers: BoilerRoom;
  readonly deck: SkyDeck;
  private readonly level = { lens: 0.4, boiler: 0.4, sky: 0.2 };
  private readonly floods: THREE.SpotLight[] = [];
  private readonly floodFaces: THREE.MeshStandardMaterial[] = [];
  private readonly meteor: THREE.Mesh;
  private readonly meteorMat: THREE.MeshBasicMaterial;
  private meteorT = -1;
  private nextMeteor = 2;

  constructor(m: Materials) {
    this.boilers = new BoilerRoom(m);
    this.deck = new SkyDeck(m);
    this.group.add(this.boilers.group);
    this.buildFloods(m);

    // One reusable meteor streak beyond the dome slit (an emitter: HDR white).
    this.meteorMat = new THREE.MeshBasicMaterial({
      map: glowMap(),
      color: new THREE.Color("#e8e6ff").multiplyScalar(6),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.meteor = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.2), this.meteorMat);
    this.meteor.visible = false;
    this.group.add(this.meteor);
  }

  get aoHidden(): THREE.Object3D[] {
    return [this.meteor, ...this.boilers.aoHidden];
  }

  async loadDeferred() {
    await this.deck.loadDeferred();
  }

  private buildFloods(m: Materials) {
    // Two floodlight fixtures flank the screen: in The Lens they stage the rig like a proscenium.
    for (const x of [-3.4, 3.4]) {
      const stand = new THREE.Group();
      stand.position.set(x, 0, -2.6);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3, 12), m.brass);
      pole.position.y = 1.5;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 24), m.iron);
      foot.position.y = 0.03;
      const head = new THREE.Group();
      head.position.y = 3.1;
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.45, 24, 1, true), m.iron);
      can.rotation.x = Math.PI / 2;
      const faceMat = new THREE.MeshStandardMaterial({
        color: "#1a1712",
        emissive: "#fff1d6",
        emissiveIntensity: 0,
        roughness: 0.2,
      });
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), faceMat);
      face.position.z = 0.2;
      head.add(can, face);
      stand.add(pole, foot, head);
      head.lookAt(-x * 0.3, 2.2, 2.4);
      stand.traverse((o) => {
        o.castShadow = o instanceof THREE.Mesh && o !== face;
      });
      const spot = new THREE.SpotLight("#fff1d6", 0, 0, 0.5, 0.6, 2);
      spot.position.set(x, 3.1, -2.4);
      spot.target.position.set(-x * 0.3, 2.2, 2.4);
      this.floods.push(spot);
      this.floodFaces.push(faceMat);
      this.group.add(stand, spot, spot.target);
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
    this.floods.forEach((f) => {
      f.intensity = 90 * lens;
    });
    for (const face of this.floodFaces) face.emissiveIntensity = 5 * lens;
    this.boilers.update(time, boiler, reduced);
    this.deck.update(time, sky, reduced);
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
