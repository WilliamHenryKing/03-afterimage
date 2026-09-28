// Dust in the projector's throw. Motes light up only inside the beams, so the light reads
// as shafts through air rather than soft blobs. One draw call, positions animated on the GPU.
import * as THREE from "three";

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform float uSpread;
  uniform float uPixel;
  attribute float aSeed;
  varying float vLight;

  float segDist(vec3 p, vec3 a, vec3 b, out float t) {
    vec3 ab = b - a;
    t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + ab * t));
  }

  void main() {
    vec3 p = position;
    p.y += mod(uTime * (0.05 + aSeed * 0.08) + aSeed * 7.0, 7.0) - 3.5;
    p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.25;
    float t1;
    float t2;
    // Throw from the projector to the lens is narrow; from the lens to the screen it widens.
    float d1 = segDist(p, uA, uB, t1) / mix(0.12, 0.9, t1);
    float d2 = segDist(p, uB, uC, t2) / (mix(0.85, 2.1, t2) * (1.0 + uSpread));
    vLight = max(smoothstep(1.0, 0.0, d1), smoothstep(1.0, 0.0, d2) * (1.0 - uSpread * 0.5)) + 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPixel * (0.6 + aSeed) * 14.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vLight;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.94, 0.84) * vLight * a * 0.9, 1.0);
  }
`;

export class Haze {
  readonly points: THREE.Points;
  private readonly u: {
    uTime: THREE.IUniform<number>;
    uA: THREE.IUniform<THREE.Vector3>;
    uB: THREE.IUniform<THREE.Vector3>;
    uC: THREE.IUniform<THREE.Vector3>;
    uSpread: THREE.IUniform<number>;
    uPixel: THREE.IUniform<number>;
  };

  constructor(count = 1400) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = 0.3 + Math.random() * 7.5;
      positions[i * 3 + 2] = -4 + Math.random() * 12;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.u = {
      uTime: { value: 0 },
      uA: { value: new THREE.Vector3() },
      uB: { value: new THREE.Vector3() },
      uC: { value: new THREE.Vector3() },
      uSpread: { value: 1 },
      uPixel: { value: 1 },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(
    projector: THREE.Vector3,
    lens: THREE.Vector3,
    screen: THREE.Vector3,
    spread: number,
    time: number,
    pixelRatio: number,
  ) {
    this.u.uA.value.copy(projector);
    this.u.uB.value.copy(lens);
    this.u.uC.value.copy(screen);
    this.u.uSpread.value = spread;
    this.u.uTime.value = time;
    this.u.uPixel.value = pixelRatio;
  }
}
