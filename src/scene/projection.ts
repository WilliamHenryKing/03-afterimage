// The signature rig: projector → movable lens → screen. Off focus, the light splits into
// its primaries and spills across the architecture; in focus it resolves into the identity.
import * as THREE from "three";
import type { LensPos } from "../game/lens";
import { beamMaterial, glowSprite, type Materials } from "./materials";

const LENS_HOME = new THREE.Vector3(0, 1.85, 2.4);
const LENS_TRAVEL = new THREE.Vector2(2.6, 0.8);
const PROJECTOR = new THREE.Vector3(0, 1.0, 7.4);
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
  private readonly throwBeam: Beam;
  private readonly splits: Beam[];
  private readonly splashes: THREE.Sprite[];
  private readonly stand: THREE.Mesh;
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
        uGain: { value: 1.7 },
      },
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
    });
    this.split = uniform(screenMat, "uSplit");
    this.spot = uniform(screenMat, "uSpot");
    this.focus = uniform(screenMat, "uFocus");
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

    // Projector on its tripod.
    const projector = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.2), m.iron);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 24), m.brass);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.85;
    const reel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 32), m.brass);
    reel.position.set(0, 0.62, 0.1);
    reel.rotation.y = Math.PI / 2;
    projector.add(body, barrel, reel);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), m.iron);
      leg.position.set(Math.cos(a) * 0.35, -0.55, Math.sin(a) * 0.35);
      leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
      projector.add(leg);
    }
    projector.position.copy(PROJECTOR).add(new THREE.Vector3(0, 0, 0.9));
    projector.lookAt(LENS_HOME.clone().setY(PROJECTOR.y));
    projector.traverse((o) => {
      o.castShadow = true;
    });
    this.group.add(projector);
    const aperture = glowSprite("#fff4dc", 1.1);
    aperture.position.copy(PROJECTOR);
    this.group.add(aperture);

    // The great lens: glass, rim and yoke, hung from a rod.
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 24), m.glass);
    glass.scale.z = 0.16;
    glass.renderOrder = 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.08, 16, 96), m.brass);
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.05, 8, 64, Math.PI), m.iron);
    rim.castShadow = true;
    yoke.castShadow = true;
    this.lens.add(glass, rim, yoke);
    yoke.rotation.z = Math.PI;
    // A floor stand carries the lens, so nothing crosses the projected image.
    this.stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 10), m.iron);
    this.stand.geometry.translate(0, 0.5, 0);
    this.stand.castShadow = true;
    this.group.add(this.lens, this.stand);

    this.throwBeam = makeBeam("#fff1d6", 0.12, 0.9);
    this.splits = CHANNELS.map((c) => makeBeam(c.colour, 0.85, 2.1));
    this.splashes = CHANNELS.map((c) => glowSprite(c.colour, 3.4));
    this.group.add(this.throwBeam.mesh, ...this.splits.map((b) => b.mesh), ...this.splashes);
  }

  /** Place the lens and re-aim every beam. `focus` is 0 (scattered) .. 1 (resolved). */
  update(pos: LensPos, focus: number, time: number) {
    const offset = new THREE.Vector3(pos.x * LENS_TRAVEL.x, pos.y * LENS_TRAVEL.y, 0);
    this.lens.position.copy(LENS_HOME).add(offset);
    this.lens.rotation.set(-pos.y * 0.25, pos.x * 0.35, 0);
    this.stand.position.set(this.lens.position.x, 0, this.lens.position.z);
    this.stand.scale.y = Math.max(0.01, this.lens.position.y - 1.24);

    aim(this.throwBeam, PROJECTOR, this.lens.position);
    this.throwBeam.intensity.value = 0.55;
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
      beam.intensity.value = 0.22 + spill * 0.28;
      beam.time.value = time;
      splash.position.copy(this.landing);
      splash.material.opacity = 0.25 + spill * 0.55;
    });

    this.split.value.set(pos.x * 0.12 * spill, pos.y * 0.12 * spill);
    this.spot.value.set(0.5 + pos.x * 0.35, 0.5 + pos.y * 0.35);
    this.focus.value = focus;
  }

  posterChanged() {
    this.texture.needsUpdate = true;
  }
}
