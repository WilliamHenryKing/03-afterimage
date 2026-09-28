// The signature rig: projector → movable lens → screen. Off focus, the light splits into
// its primaries and spills across the architecture; in focus it resolves into the identity.
import * as THREE from "three";
import type { LensPos } from "../game/lens";
import { model } from "./assets";
import { Haze } from "./haze";
import { beamMaterial, glowSprite, type Materials } from "./materials";

const LENS_HOME = new THREE.Vector3(0, 1.75, 2.4);
const LENS_TRAVEL = new THREE.Vector2(2.6, 0.8);
export const PROJECTOR = new THREE.Vector3(0, 1.0, 7.4);
export const SCREEN_CENTER = new THREE.Vector3(0, 4.5, -4.2);
const SCREEN_W = 3.6;
const SCREEN_H = 4.8;
const CHANNELS = [
  { colour: "#ff2f55", k: 1 },
  { colour: "#2fff8f", k: 0 },
  { colour: "#2f6bff", k: -1 },
] as const;

const SCREEN_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSplit;
  uniform vec2 uSpot;
  uniform float uFocus;
  uniform float uGain;
  varying vec2 vUv;
  void main() {
    float blur = (1.0 - uFocus) * 0.03;
    vec3 col = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float t = float(i) / 4.0 - 0.5;
      vec2 o = vec2(t * blur, t * blur * 0.7);
      col.r += texture2D(uMap, vUv + uSplit + o).r;
      col.g += texture2D(uMap, vUv + o).g;
      col.b += texture2D(uMap, vUv - uSplit + o).b;
    }
    col /= 5.0;
    vec2 c = (vUv - uSpot) * vec2(0.75, 1.0);
    float spot = smoothstep(0.78, 0.18, length(c));
    col *= mix(0.08, 1.0, spot) * mix(0.3, 1.0, uFocus) * uGain;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Beam {
  mesh: THREE.Mesh;
  intensity: THREE.IUniform<number>;
  time: THREE.IUniform<number>;
}

function uniform<T>(material: THREE.ShaderMaterial, name: string): THREE.IUniform<T> {
  const u = material.uniforms[name];
  if (!u) throw new Error(`Missing uniform ${name}`);
  return u as THREE.IUniform<T>;
}

function makeBeam(colour: THREE.ColorRepresentation, r0: number, r1: number): Beam {
  const geo = new THREE.CylinderGeometry(r1, r0, 1, 40, 1, true);
  geo.translate(0, 0.5, 0);
  const material = beamMaterial(colour);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, intensity: uniform(material, "uIntensity"), time: uniform(material, "uTime") };
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

function aim(beam: Beam, from: THREE.Vector3, to: THREE.Vector3) {
  tmpDir.subVectors(to, from);
  const length = tmpDir.length();
  beam.mesh.position.copy(from);
  beam.mesh.quaternion.setFromUnitVectors(UP, tmpDir.normalize());
  beam.mesh.scale.set(1, length, 1);
}

export class Projection {
  readonly group = new THREE.Group();
  /** Moves with the lens; venue scenery for The Lens hangs from it. */
  readonly lens = new THREE.Group();
  readonly texture: THREE.CanvasTexture;
  private readonly split: THREE.IUniform<THREE.Vector2>;
  private readonly spot: THREE.IUniform<THREE.Vector2>;
  private readonly focus: THREE.IUniform<number>;
  private readonly gain: THREE.IUniform<number>;
  private readonly haze = new Haze();
  /** 0..1 burst when the image resolves; tweened by the stage. */
  flash = 0;
  pixelRatio = 1;
  private readonly throwBeam: Beam;
  private readonly splits: Beam[];
  private readonly splashes: THREE.Sprite[];
  private readonly stand: THREE.Mesh;
  private readonly standBase: THREE.Mesh;
  private readonly projector = new THREE.Group();
  private readonly standIn = new THREE.Group();
  private readonly landing = new THREE.Vector3();

  constructor(m: Materials, poster: HTMLCanvasElement) {
    this.texture = new THREE.CanvasTexture(poster);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    // Screen and its frame.
    const screenMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.texture },
        uSplit: { value: new THREE.Vector2() },
        uSpot: { value: new THREE.Vector2(0.5, 0.5) },
        uFocus: { value: 0 },
        uGain: { value: 1.0 },
      },
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
    });
    this.split = uniform(screenMat, "uSplit");
    this.spot = uniform(screenMat, "uSpot");
    this.focus = uniform(screenMat, "uFocus");
    this.gain = uniform(screenMat, "uGain");
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.position.copy(SCREEN_CENTER);
    this.group.add(screen);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(SCREEN_W + 0.5, SCREEN_H + 0.5, 0.2),
      m.iron,
    );
    frame.position.copy(SCREEN_CENTER).add(new THREE.Vector3(0, 0, -0.12));
    frame.castShadow = true;
    this.group.add(frame);
    for (const x of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, SCREEN_CENTER.y, 0.16), m.brass);
      leg.position.set((x * (SCREEN_W + 0.5)) / 2, SCREEN_CENTER.y / 2, SCREEN_CENTER.z);
      leg.castShadow = true;
      this.group.add(leg);
    }

    // Projector on its tripod: a procedural stand-in until the sourced 8 mm projector loads.
    this.projector.position.copy(PROJECTOR).add(new THREE.Vector3(0, 0, 0.9));
    this.projector.lookAt(LENS_HOME.clone().setY(PROJECTOR.y));
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.2), m.iron);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 24), m.brass);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.85;
    this.standIn.add(body, barrel);
    this.projector.add(this.standIn);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.12, 8), m.brass);
      leg.position.set(Math.cos(a) * 0.3, -0.53, Math.sin(a) * 0.3);
      leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
      this.projector.add(leg);
    }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 20), m.iron);
    this.projector.add(head);
    this.projector.traverse((o) => {
      o.castShadow = true;
    });
    this.group.add(this.projector);
    // The aperture is the lamp's visible face (an HDR emitter); the lamp also lights the rig.
    const aperture = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff4dc").multiplyScalar(30) }),
    );
    aperture.position.copy(PROJECTOR);
    aperture.lookAt(LENS_HOME);
    const lamp = new THREE.PointLight("#ffe2b0", 6, 0, 2);
    lamp.position.copy(PROJECTOR).add(new THREE.Vector3(0, 0.35, 0.5));
    this.group.add(aperture, lamp, this.haze.points);

    // The great lens: a biconvex element of dispersive glass in a machined brass cell.
    const R = 1.0;
    const profile: THREE.Vector2[] = [];
    const steps = 24;
    const sag = (r: number) => 0.025 + 0.13 * (1 - (r / R) ** 2);
    for (let i = 0; i <= steps; i++)
      profile.push(new THREE.Vector2((i / steps) * R, sag((i / steps) * R)));
    for (let i = steps; i >= 0; i--)
      profile.push(new THREE.Vector2((i / steps) * R, -sag((i / steps) * R)));
    const glassGeo = new THREE.LatheGeometry(profile, 72);
    glassGeo.rotateX(Math.PI / 2);
    const glass = new THREE.Mesh(glassGeo, m.glass);
    const cellProfile = [
      [0.97, -0.09],
      [1.1, -0.09],
      [1.12, -0.06],
      [1.12, 0.06],
      [1.1, 0.09],
      [0.97, 0.09],
      [0.97, 0.05],
      [1.02, 0.05],
      [1.02, -0.05],
      [0.97, -0.05],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cellGeo = new THREE.LatheGeometry(cellProfile, 96);
    cellGeo.rotateX(Math.PI / 2);
    const cell = new THREE.Mesh(cellGeo, m.brass);
    // Knurled grip band and three set screws.
    const knurl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.06, 0.022), m.brass, 120);
    const t = new THREE.Object3D();
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      t.position.set(Math.cos(a) * 1.125, Math.sin(a) * 1.125, 0);
      t.rotation.set(0, 0, a);
      t.updateMatrix();
      knurl.setMatrixAt(i, t.matrix);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), m.iron);
      screw.position.set(Math.cos(a) * 1.13, Math.sin(a) * 1.13, 0.1);
      screw.rotation.x = Math.PI / 2;
      this.lens.add(screw);
    }
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.05, 10, 64, Math.PI), m.iron);
    yoke.rotation.z = Math.PI;
    for (const side of [-1, 1]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), m.brass);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(side * 1.18, 0, 0);
      this.lens.add(pin);
    }
    for (const o of [cell, knurl, yoke]) o.castShadow = true;
    this.lens.add(glass, cell, knurl, yoke);
    // A floor stand on a weighted base carries the lens, so nothing crosses the projected image.
    this.stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 12), m.iron);
    this.stand.geometry.translate(0, 0.5, 0);
    this.stand.castShadow = true;
    this.standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.07, 32), m.iron);
    this.standBase.castShadow = true;
    this.standBase.receiveShadow = true;
    this.group.add(this.lens, this.stand, this.standBase);

    // Shafts, not floods: on a real GPU the earlier 0.85 → 2.1 cones and 3.4-unit splashes
    // (7.4 during the focus flash) swamped the poster in soft colour.
    this.throwBeam = makeBeam("#fff1d6", 0.1, 0.55);
    this.splits = CHANNELS.map((c) => makeBeam(c.colour, 0.35, 1.1));
    this.splashes = CHANNELS.map((c) => glowSprite(c.colour, 1.6));
    this.group.add(this.throwBeam.mesh, ...this.splits.map((b) => b.mesh), ...this.splashes);
  }

  /** Place the lens and re-aim every beam. `focus` is 0 (scattered) .. 1 (resolved). */
  update(pos: LensPos, focus: number, time: number) {
    const offset = new THREE.Vector3(pos.x * LENS_TRAVEL.x, pos.y * LENS_TRAVEL.y, 0);
    this.lens.position.copy(LENS_HOME).add(offset);
    this.lens.rotation.set(-pos.y * 0.25, pos.x * 0.35, 0);
    this.stand.position.set(this.lens.position.x, 0, this.lens.position.z);
    this.standBase.position.set(this.lens.position.x, 0.035, this.lens.position.z);
    this.stand.scale.y = Math.max(0.01, this.lens.position.y - 1.24);

    aim(this.throwBeam, PROJECTOR, this.lens.position);
    this.throwBeam.intensity.value = 0.26 + this.flash * 0.45;
    this.throwBeam.time.value = time;

    const spill = 1 - focus;
    CHANNELS.forEach((c, i) => {
      const beam = this.splits[i];
      const splash = this.splashes[i];
      if (!beam || !splash) return;
      this.landing
        .copy(SCREEN_CENTER)
        .addScaledVector(offset, 1 + c.k * 1.8)
        .setZ(SCREEN_CENTER.z + 0.05);
      aim(beam, this.lens.position, this.landing);
      beam.intensity.value = 0.14 + spill * 0.24 + this.flash * 0.5;
      beam.time.value = time;
      splash.position.copy(this.landing);
      splash.material.opacity = Math.min(0.75, 0.12 + spill * 0.35 + this.flash * 0.4);
      splash.scale.setScalar(1.6 + this.flash * 1.6);
    });

    this.split.value.set(pos.x * 0.12 * spill, pos.y * 0.12 * spill);
    this.spot.value.set(0.5 + pos.x * 0.35, 0.5 + pos.y * 0.35);
    this.focus.value = focus;
    this.gain.value = 1.05 + this.flash * 1.6;
    this.haze.update(PROJECTOR, this.lens.position, SCREEN_CENTER, spill, time, this.pixelRatio);
  }

  /** Additive light and sprites the AO pass must skip. */
  get aoHidden(): THREE.Object3D[] {
    return [
      this.throwBeam.mesh,
      ...this.splits.map((b) => b.mesh),
      ...this.splashes,
      this.haze.points,
    ];
  }

  /** Swap the stand-in for the sourced projector, sized to the rig and aimed down the throw. */
  async loadDeferred() {
    const gltf = await model("projector");
    if (!gltf) return;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.25 / Math.max(size.x, size.z);
    const centre = box.getCenter(new THREE.Vector3());
    gltf.scene.scale.setScalar(s);
    gltf.scene.position.set(-centre.x * s, -box.min.y * s - 0.02, -centre.z * s);
    // The model's lens faces -X; the rig's throw runs along local +Z.
    gltf.scene.rotation.y = -Math.PI / 2;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const mount = new THREE.Group();
    mount.position.y = 0.04;
    mount.add(gltf.scene);
    this.standIn.visible = false;
    this.projector.add(mount);
  }

  posterChanged() {
    this.texture.needsUpdate = true;
  }
}
