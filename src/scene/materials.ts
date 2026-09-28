// Shared palette and materials: ink stone, blackened brass, copper, optical glass, additive light.
import * as THREE from "three";

export const PALETTE = {
  ink: new THREE.Color("#07080c"),
  stone: new THREE.Color("#1a1b20"),
  brass: new THREE.Color("#8a7248"),
  copper: new THREE.Color("#b8683a"),
  glass: new THREE.Color("#8fd8ff"),
  sky: new THREE.Color("#a99bff"),
  paper: new THREE.Color("#f1ece0"),
};

export function makeMaterials() {
  return {
    stone: new THREE.MeshStandardMaterial({ color: "#2c2d34", roughness: 0.8, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({ color: "#101116", roughness: 0.55, metalness: 0.2 }),
    iron: new THREE.MeshStandardMaterial({ color: "#3a3c44", roughness: 0.42, metalness: 0.8 }),
    brass: new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.32, metalness: 1 }),
    copper: new THREE.MeshStandardMaterial({ color: PALETTE.copper, roughness: 0.3, metalness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: "#4a4f58", roughness: 0.12, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#cfeaff",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      clearcoat: 1,
      iridescence: 0.8,
      iridescenceIOR: 1.6,
      envMapIntensity: 2.4,
      depthWrite: false,
    }),
  };
}

export type Materials = ReturnType<typeof makeMaterials>;

const BEAM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    // Soft edges: brightest where the cone faces the viewer, easing off along its throw.
    float facing = pow(abs(dot(vNormalV, vViewDir)), 1.15);
    float along = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y)) * mix(1.0, 0.6, vUv.y);
    float dust = 0.85 + 0.15 * sin(vUv.y * 40.0 - uTime * 1.3 + vUv.x * 18.0);
    gl_FragColor = vec4(uColor * uIntensity * facing * along * dust, 1.0);
  }
`;

/** An additive light cone. Uniforms are updated by the projection each frame. */
export function beamMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

let glowTexture: THREE.CanvasTexture | null = null;

/** A radial glow sprite texture, drawn once. */
export function glowMap(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function glowSprite(color: THREE.ColorRepresentation, size: number) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMap(),
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}
