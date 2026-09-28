// The Sky Deck: a planked platform on braced iron legs, brass railing, wool blankets, a brass
// telescope, and sourced brass lanterns whose flames are real lights.
import * as THREE from "three";
import { model } from "./assets";
import { jitter } from "./jitter";
import type { Materials } from "./materials";

const W = 5;
const D = 3.8;
const LANTERNS: [number, number][] = [
  [-2.0, -1.2],
  [-0.6, 1.05],
  [0.7, -1.1],
  [1.9, 0.95],
  [2.2, -0.3],
];

/** A blanket laid on the deck: a subdivided sheet with soft folds and a raised edge. */
function blanketGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1.3, 0.95, 26, 18);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const folds =
      Math.sin(x * 5.2 + seed * 3) * 0.018 +
      Math.sin(z * 7.1 + x * 2 + seed) * 0.014 +
      Math.max(0, Math.sin(x * 2.3 + seed * 5)) * 0.03;
    const edge = Math.max(Math.abs(x) / 0.65, Math.abs(z) / 0.475);
    pos.setY(i, 0.012 + folds * (1 - edge * 0.5));
  }
  geo.computeVertexNormals();
  return geo;
}

export class SkyDeck {
  readonly group = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private readonly lanternSlots: THREE.Group[] = [];

  constructor(m: Materials) {
    // Planks, each a little different in level and angle, over iron joists.
    const planks = Math.floor(D / 0.19);
    const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(W, 0.045, 0.175), m.deck, planks);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < planks; i++) {
      tmp.position.set(
        (jitter(i, 1) - 0.5) * 0.04,
        0.09 + jitter(i, 2) * 0.006,
        -D / 2 + 0.1 + i * 0.19,
      );
      tmp.rotation.set((jitter(i, 3) - 0.5) * 0.01, (jitter(i, 4) - 0.5) * 0.006, 0);
      tmp.updateMatrix();
      plank.setMatrixAt(i, tmp.matrix);
      const tint = 0.85 + jitter(i, 5) * 0.2;
      plank.setColorAt(i, new THREE.Color(tint, tint * (0.97 + jitter(i, 6) * 0.05), tint * 0.96));
    }
    plank.castShadow = true;
    plank.receiveShadow = true;
    this.group.add(plank);
    for (const z of [-D / 2 + 0.15, 0, D / 2 - 0.15]) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 0.1), m.iron);
      joist.position.set(0, 0.01, z);
      joist.castShadow = true;
      this.group.add(joist);
    }
    // Legs with cross bracing, reaching the floor at any deck height (scaled in update).
    for (const [x, z] of [
      [-2.3, -1.7],
      [2.3, -1.7],
      [-2.3, 1.7],
      [2.3, 1.7],
    ] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4, 0.12), m.iron);
      leg.position.set(x, -2, z);
      leg.castShadow = true;
      this.group.add(leg);
    }
    for (const z of [-1.7, 1.7]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 5.4), m.iron);
      brace.rotation.set(0, Math.PI / 2, 0.55);
      brace.position.set(0, -0.9, z);
      this.group.add(brace);
    }

    // Brass railing along the open edge.
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W, 12), m.brass);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.05, D / 2 - 0.05);
    const mid = rail.clone();
    mid.scale.set(0.6, 1, 0.6);
    mid.position.y = 0.55;
    this.group.add(rail, mid);
    for (let i = 0; i <= 8; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1, 10), m.brass);
      post.position.set(-W / 2 + i * (W / 8), 0.6, D / 2 - 0.05);
      post.castShadow = true;
      this.group.add(post);
    }

    // Blankets in three wool tints, and one rolled up.
    const tints = ["#5c4f9a", "#8a5a46", "#3f5f6e"];
    for (let i = 0; i < 4; i++) {
      const mat = m.blanket.clone();
      mat.color.set(tints[i % tints.length] as string);
      const b = new THREE.Mesh(blanketGeometry(i), mat);
      b.position.set(-1.5 + i * 1.05, 0.11, -0.35 + (i % 2) * 0.75);
      b.rotation.y = (jitter(i, 7) - 0.5) * 0.8;
      b.receiveShadow = true;
      b.castShadow = true;
      this.group.add(b);
    }
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 20), m.blanket);
    roll.rotation.set(0, 0.3, Math.PI / 2);
    roll.position.set(-2.0, 0.22, 0.9);
    roll.castShadow = true;
    this.group.add(roll);

    this.group.add(this.telescope(m));

    // Lantern slots: a flame (emitter) now, the sourced brass lantern when it loads.
    LANTERNS.forEach(([x, z], i) => {
      const slot = new THREE.Group();
      slot.position.set(x, 0.115, z);
      slot.rotation.y = jitter(i, 8) * Math.PI * 2;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), m.bulb);
      flame.scale.set(1, 1.8, 1);
      flame.position.y = 0.16;
      slot.add(flame);
      this.flames.push(flame);
      this.lanternSlots.push(slot);
      this.group.add(slot);
    });
    // One real light for the lantern group (see boilers.ts: fewer point lights, faster compile).
    const light = new THREE.PointLight("#ffb45e", 0, 0, 2);
    light.position.set(0.1, 0.45, 0);
    this.lights.push(light);
    this.group.add(light);
  }

  private telescope(m: Materials): THREE.Group {
    const scope = new THREE.Group();
    scope.position.set(1.6, 0.11, 0.35);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 24), m.brass);
    tube.rotation.set(0, 0, -1.05);
    tube.position.set(0.1, 1.15, 0);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 12), m.iron);
    eye.rotation.z = -1.05;
    eye.position.set(-0.52, 0.78, 0);
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), m.iron);
    mount.position.set(0, 1.0, 0);
    scope.add(tube, eye, mount);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.08, 8), m.brass);
      leg.position.set(Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2);
      leg.lookAt(0, 1.2, 0);
      leg.rotateX(Math.PI / 2);
      scope.add(leg);
    }
    scope.traverse((o) => {
      o.castShadow = o instanceof THREE.Mesh;
    });
    return scope;
  }

  async loadDeferred() {
    const gltf = await model("lantern");
    if (!gltf) return;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const scale = 0.34 / (box.max.y - box.min.y);
    this.lanternSlots.forEach((slot, i) => {
      const clone = gltf.scene.clone(true);
      const s = scale * (0.85 + jitter(i, 9) * 0.3);
      clone.scale.setScalar(s);
      clone.position.y = -box.min.y * s;
      clone.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      slot.add(clone);
    });
  }

  update(time: number, level: number, reduced: boolean) {
    this.lights.forEach((l, i) => {
      l.intensity = (0.8 + 5.2 * level) * (reduced ? 1 : 1 + Math.sin(time * 3 + i * 1.7) * 0.06);
    });
    this.flames.forEach((f, i) => {
      f.scale.y = 1.8 * (reduced ? 1 : 1 + Math.sin(time * 11 + i * 2.3) * 0.12);
    });
  }
}
