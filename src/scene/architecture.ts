// The observatory shell: concrete floor with brass meridian rings, a riveted plate dome with
// ribs, the shutter and its mechanism (rails, rack, drive), columns, and the night sky beyond.
import * as THREE from "three";
import { jitter } from "./jitter";
import type { Materials } from "./materials";

export const DOME_RADIUS = 14;
/** Horizontal angle of the dome slit, facing back and to the right (towards the Sky Deck). */
const SLIT_PHI = 4.25;
const SLIT_WIDTH = 0.5;
const RIBS = 16;

export interface Architecture {
  group: THREE.Group;
  shutter: THREE.Object3D;
  /** 0..1: how much of the sky shows (stars dim when the shutter is closed). */
  sky: { value: number };
  /** Emitters and backdrops the AO pass should skip. */
  aoHidden: THREE.Object3D[];
}

/** A point on the dome for spherical angles, matching SphereGeometry's parametrisation. */
function domePoint(r: number, phi: number, theta: number): THREE.Vector3 {
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform float uOpen;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    // Deep blue at the horizon to near-black at the zenith, with a faint galactic band.
    vec3 col = mix(vec3(0.010, 0.014, 0.034), vec3(0.002, 0.003, 0.008), pow(h, 0.6));
    float band = exp(-pow(dot(d, normalize(vec3(0.4, 0.55, -0.73))) * 5.0, 2.0));
    col += vec3(0.010, 0.010, 0.016) * band;
    // Stars: one candidate per cell, round, with varied size, warmth and a slow twinkle.
    vec3 cell = floor(d * 190.0);
    float r = hash(cell);
    if (r > 0.935) {
      vec3 centre = (cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.1), hash(cell + 3.7)) - 0.5) * 0.6) / 190.0;
      float dist = length(d - normalize(centre)) * 190.0;
      float size = mix(0.12, 0.34, hash(cell + 5.0));
      float star = smoothstep(size, 0.0, dist);
      float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + hash(cell + 9.0) * 3.0) + r * 60.0);
      vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash(cell + 7.0));
      col += tint * star * twinkle * mix(2.0, 14.0, pow(hash(cell + 11.0), 3.0));
    }
    gl_FragColor = vec4(col * mix(0.25, 1.0, uOpen), 1.0);
  }
`;

export function buildArchitecture(m: Materials): Architecture {
  const group = new THREE.Group();
  const aoHidden: THREE.Object3D[] = [];
  const tmp = new THREE.Object3D();

  const floor = new THREE.Mesh(new THREE.CircleGeometry(DOME_RADIUS, 96), m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  // Inlaid brass meridian rings, set flush into the floor.
  for (const r of [3.2, 6.4, 9.6]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.045, 160), m.brass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    ring.receiveShadow = true;
    group.add(ring);
  }

  // Dome shell of riveted plates, with a slit the shutter covers.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(
      DOME_RADIUS,
      96,
      32,
      SLIT_PHI + SLIT_WIDTH / 2,
      Math.PI * 2 - SLIT_WIDTH,
      0,
      Math.PI / 2,
    ),
    m.domePlate,
  );
  shell.receiveShadow = true;
  group.add(shell);

  // Shutter leaf with a gear rack down one edge; it slides along the rails to open.
  const shutterPivot = new THREE.Group();
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(
      DOME_RADIUS - 0.18,
      10,
      24,
      SLIT_PHI - SLIT_WIDTH / 2 - 0.02,
      SLIT_WIDTH + 0.04,
      0,
      Math.PI / 2,
    ),
    m.shutter,
  );
  shutterPivot.add(leaf);
  const toothGeo = new THREE.BoxGeometry(0.06, 0.05, 0.1);
  const teeth = 120;
  const rack = new THREE.InstancedMesh(toothGeo, m.iron, teeth);
  for (let i = 0; i < teeth; i++) {
    const theta = 0.08 + (i / teeth) * (Math.PI / 2 - 0.12);
    tmp.position.copy(domePoint(DOME_RADIUS - 0.3, SLIT_PHI - SLIT_WIDTH / 2 + 0.02, theta));
    tmp.lookAt(0, 0, 0);
    tmp.scale.setScalar(1);
    tmp.updateMatrix();
    rack.setMatrixAt(i, tmp.matrix);
  }
  shutterPivot.add(rack);
  group.add(shutterPivot);

  // Rails either side of the slit, and the drive at its foot.
  for (const side of [-1, 1]) {
    const phi = SLIT_PHI + (side * SLIT_WIDTH) / 2;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++)
      pts.push(domePoint(DOME_RADIUS - 0.26, phi, 0.03 + (i / 40) * (Math.PI / 2 - 0.05)));
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.06, 8),
      m.iron,
    );
    rail.castShadow = true;
    group.add(rail);
  }
  const drive = new THREE.Group();
  const foot = domePoint(DOME_RADIUS - 0.7, SLIT_PHI, Math.PI / 2 - 0.02);
  drive.position.set(foot.x, 0.45, foot.z);
  drive.lookAt(0, 0.45, 0);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.6), m.iron);
  drive.add(housing);
  for (const x of [-0.45, 0.45]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 36), m.brass);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.1, 0.36);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 16), m.iron);
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(wheel.position);
    drive.add(wheel, hub);
  }
  drive.traverse((o) => {
    o.castShadow = o instanceof THREE.Mesh;
  });
  group.add(drive);

  // Ribs, with rivet rows either side of each where it meets the plates.
  const rib = new THREE.TorusGeometry(DOME_RADIUS - 0.2, 0.07, 8, 64, Math.PI / 2);
  const ribs = new THREE.InstancedMesh(rib, m.iron, RIBS);
  for (let i = 0; i < RIBS; i++) {
    tmp.position.set(0, 0, 0);
    tmp.rotation.set(0, (i / RIBS) * Math.PI * 2, 0);
    tmp.scale.setScalar(1);
    tmp.updateMatrix();
    ribs.setMatrixAt(i, tmp.matrix);
  }
  ribs.castShadow = true;
  group.add(ribs);
  const perRib = 56;
  const rivetMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.03, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    m.iron,
    RIBS * perRib * 2,
  );
  let n = 0;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < RIBS; i++) {
    const rho = (i / RIBS) * Math.PI * 2;
    for (let k = 0; k < perRib; k++) {
      const alpha = 0.04 + (k / perRib) * (Math.PI / 2 - 0.06);
      for (const side of [-1, 1]) {
        const p = new THREE.Vector3(Math.cos(alpha), Math.sin(alpha), 0).multiplyScalar(
          DOME_RADIUS - 0.012,
        );
        p.applyAxisAngle(up, rho);
        const across = new THREE.Vector3(0, 0, side * 0.16).applyAxisAngle(up, rho);
        p.add(across);
        tmp.position.copy(p);
        tmp.quaternion.setFromUnitVectors(up, p.clone().normalize().negate());
        tmp.scale.setScalar(0.8 + jitter(n, 3) * 0.4);
        tmp.updateMatrix();
        rivetMesh.setMatrixAt(n++, tmp.matrix);
      }
    }
  }
  group.add(rivetMesh);

  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(DOME_RADIUS - 0.25, 0.14, 10, 128),
    m.iron,
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.2;
  group.add(baseRing);

  // Columns on plinths with brass capitals, carrying the gallery ring.
  const colCount = 12;
  const shaft = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.27, 6.7, 20),
    m.stone,
    colCount,
  );
  const plinth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.3, 0.72), m.stone, colCount);
  const capital = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.36, 0.24, 0.26, 20),
    m.brass,
    colCount,
  );
  for (let i = 0; i < colCount; i++) {
    const a = (i / colCount) * Math.PI * 2 + 0.26;
    const x = Math.cos(a) * 10.8;
    const z = Math.sin(a) * 10.8;
    const turn = jitter(i, 4) * Math.PI;
    tmp.rotation.set(0, turn, 0);
    tmp.scale.set(1, 1, 1);
    tmp.position.set(x, 3.65, z);
    tmp.updateMatrix();
    shaft.setMatrixAt(i, tmp.matrix);
    tmp.rotation.set(0, a, 0);
    tmp.position.set(x, 0.15, z);
    tmp.updateMatrix();
    plinth.setMatrixAt(i, tmp.matrix);
    tmp.position.set(x, 7.0, z);
    tmp.updateMatrix();
    capital.setMatrixAt(i, tmp.matrix);
  }
  for (const mesh of [shaft, plinth, capital]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(10.8, 0.16, 10, 160), m.brass);
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 7.2;
  group.add(gallery);

  // The night beyond the slit: an emissive sky shell, never fogged.
  const sky = { value: 0.15 };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uOpen: sky, uTime: { value: 0 } },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), skyMat);
  skyMesh.renderOrder = -1;
  skyMesh.onBeforeRender = () => {
    const t = skyMat.uniforms.uTime;
    if (t) t.value = performance.now() / 1000;
  };
  group.add(skyMesh);
  aoHidden.push(skyMesh);

  return { group, shutter: shutterPivot, sky, aoHidden };
}
