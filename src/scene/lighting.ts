// One lighting model, in physical units with exposure as the only brightness control:
// moonlight through the dome slit (the key, with fitted shadows), image-based reflections from a
// CC0 interior HDRI, and real lights only where there is a fixture: lamp standards, gallery bulbs
// (emissive only), the projector, fireboxes and lanterns (in their own modules).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { hdri, model } from "./assets";
import { jitter } from "./jitter";
import type { Materials } from "./materials";

export interface Lighting {
  update: (time: number, reduced: boolean) => void;
  /** Swap in sourced assets once the first frame is up. */
  loadDeferred: () => Promise<void>;
  dispose: () => void;
}

const LAMP_ANGLES = [-2.25, -1.75, -1.35, -0.9, 0.9 + Math.PI, 2.55];
export const EXPOSURE = 1.0;

export function buildLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  m: Materials,
): Lighting {
  renderer.toneMappingExposure = EXPOSURE;
  scene.background = new THREE.Color("#04050a");
  // Thin interior haze: depth without lifting the blacks.
  scene.fog = new THREE.FogExp2("#0a0c16", 0.018);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 });
  scene.environment = envTarget.texture;
  // A daylight interior probe, scaled down to the night: reflections and a faint bounce.
  scene.environmentIntensity = 0.05;

  // Moonlight through the shutter slit, high behind the screen: the key and the rim in one.
  const moon = new THREE.DirectionalLight("#c9d6ff", 1.1);
  moon.position.set(4.4, 17, -8.8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  moon.shadow.radius = 3;
  const sc = moon.shadow.camera;
  // Fitted to the observatory floor (radius 11 inside the columns), so texels stay small.
  sc.left = -11.5;
  sc.right = 11.5;
  sc.top = 11.5;
  sc.bottom = -11.5;
  sc.near = 4;
  sc.far = 36;
  scene.add(moon, moon.target);

  // Lamp standards: procedural until the sourced pipe lamp arrives; each carries a real light.
  const lamps = new THREE.Group();
  const lights: THREE.PointLight[] = [];
  const stands: THREE.Group[] = [];
  LAMP_ANGLES.forEach((a, i) => {
    const stand = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 10), m.iron);
    post.position.y = 1.1;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), m.bulb);
    bulb.position.y = 2.15;
    stand.add(post, bulb);
    stand.position.set(Math.cos(a) * 9.4, 0, Math.sin(a) * 9.4);
    stand.rotation.y = -a + Math.PI / 2 + (jitter(i) - 0.5) * 0.6;
    const s = 0.9 + jitter(i, 1) * 0.2;
    stand.scale.setScalar(s);
    stand.traverse((o) => {
      o.castShadow = o instanceof THREE.Mesh && o.material !== m.bulb;
    });
    const light = new THREE.PointLight("#ffc88a", 22, 0, 2);
    light.position.set(stand.position.x, 2.15 * s - 0.05, stand.position.z);
    lights.push(light);
    stands.push(stand);
    lamps.add(stand, light);
  });

  // Gallery bulbs: emitters only (bloom carries their glow), each hung a little differently.
  const count = 48;
  const string = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8), m.bulb, count);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (jitter(i, 2) - 0.5) * 0.03;
    tmp.position.set(Math.cos(a) * 10.75, 6.72 - jitter(i, 3) * 0.18, Math.sin(a) * 10.75);
    tmp.scale.setScalar(0.8 + jitter(i, 4) * 0.4);
    tmp.updateMatrix();
    string.setMatrixAt(i, tmp.matrix);
  }
  lamps.add(string);
  scene.add(lamps);

  return {
    update(time, reduced) {
      if (reduced) return;
      // Old filament lamps: a slow, slightly uneven breath.
      lights.forEach((l, i) => {
        l.intensity =
          22 * (1 + Math.sin(time * 1.7 + i * 2.1) * 0.04 + Math.sin(time * 7.3 + i) * 0.02);
      });
    },
    async loadDeferred() {
      const [probe, lamp] = await Promise.all([hdri(), model("pipe-lamp")]);
      if (probe) {
        const next = pmrem.fromEquirectangular(probe);
        scene.environment = next.texture;
        scene.environmentRotation.set(0, 1.2, 0);
        envTarget.dispose();
        envTarget = next;
        probe.dispose();
      }
      if (lamp) {
        // The sourced industrial pipe lamp replaces each procedural post, scaled to a floor standard.
        const box = new THREE.Box3().setFromObject(lamp.scene);
        const height = box.max.y - box.min.y;
        stands.forEach((stand, i) => {
          const clone = lamp.scene.clone(true);
          clone.scale.setScalar(2.3 / height);
          clone.position.y = -box.min.y * (2.3 / height);
          clone.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          const post = stand.children[0];
          if (post) post.visible = false;
          stand.add(clone);
          const light = lights[i];
          if (light) light.position.y = 2.0 * stand.scale.y;
        });
      }
    },
    dispose() {
      envTarget.dispose();
      pmrem.dispose();
    },
  };
}
