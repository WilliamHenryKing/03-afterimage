// Theatrical light for the observatory: moonlight key, a cool rim from the dome,
// hemisphere fill, brass practical lamps and a string of gallery bulbs. Plus the haze.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { glowSprite, type Materials } from "./materials";

export interface Lighting {
  update: (time: number, reduced: boolean) => void;
  dispose: () => void;
}

const LAMP_ANGLES = [-2.25, -1.75, -1.35, -0.9, 0.9 + Math.PI, 2.55];

export function buildLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  m: Materials,
): Lighting {
  renderer.toneMappingExposure = 1.6;
  scene.background = new THREE.Color("#080a12");
  // A faint blue-grey haze: distance falls off softly and beams have air to travel through.
  scene.fog = new THREE.FogExp2("#0d1020", 0.024);

  const pmrem = new THREE.PMREMGenerator(renderer);
  // Reflections only need a soft room; a 128px source halves the prefilter work of the default.
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 });
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.34;

  const key = new THREE.DirectionalLight("#dfe6ff", 1.9);
  key.position.set(6, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sc.far = 40;
  scene.add(key);

  // Rim from high behind the screen: silhouettes the lens, ribs and machinery.
  const rim = new THREE.DirectionalLight("#9fb4ff", 1.4);
  rim.position.set(-2, 10, -12);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight("#5d6894", "#2a1d14", 0.7));

  // Brass lamp standards around the room, each a real warm light.
  const lamps = new THREE.Group();
  const bulbs: THREE.Sprite[] = [];
  const lights: THREE.PointLight[] = [];
  const bulbMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ffcf8a").multiplyScalar(3),
  });
  LAMP_ANGLES.forEach((a, i) => {
    const lamp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 8), m.brass);
    post.position.y = 1.1;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 20, 1, true), m.brass);
    shade.position.y = 2.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), bulbMat);
    bulb.position.y = 2.12;
    const glow = glowSprite("#ffc27a", 1.3);
    glow.position.y = 2.1;
    bulbs.push(glow);
    lamp.add(post, shade, bulb, glow);
    lamp.position.set(Math.cos(a) * 9.4, 0, Math.sin(a) * 9.4);
    lamp.traverse((o) => {
      o.castShadow = o instanceof THREE.Mesh && o.material !== bulbMat;
    });
    if (i % 2 === 0 || i === LAMP_ANGLES.length - 1) {
      const light = new THREE.PointLight("#ffc27a", 7, 9, 1.8);
      light.position.set(lamp.position.x, 2.1, lamp.position.z);
      lights.push(light);
      lamps.add(light);
    }
    lamps.add(lamp);
  });

  // A string of bulbs along the gallery ring so the dome's structure reads at a glance.
  const count = 48;
  const string = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat, count);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    tmp.position.set(
      Math.cos(a) * 10.75,
      7.0 - Math.abs(Math.sin(a * 6)) * 0.25,
      Math.sin(a) * 10.75,
    );
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
        l.intensity = 7 + Math.sin(time * 1.7 + i * 2.1) * 0.5 + Math.sin(time * 7.3 + i) * 0.2;
      });
      bulbs.forEach((b, i) => {
        b.material.opacity = 0.8 + Math.sin(time * 1.7 + i * 2.1) * 0.12;
      });
    },
    dispose() {
      envTarget.dispose();
      pmrem.dispose();
    },
  };
}
