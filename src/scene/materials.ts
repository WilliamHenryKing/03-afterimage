// Material roles. Sourced CC0 scans (assets.manifest.json) supply colour, normal and packed
// AO/roughness/metalness; they attach as they load, so the first frame never waits on the network.
// A world-space macro variation breaks up tiling on large surfaces.
import * as THREE from "three";
import { type PbrSet, pbrSet, type TextureRole, tiled } from "./assets";

const MACRO_KEY = "afterimage-macro-v1";

/** Low-frequency value noise in world space darkens and lightens large surfaces unevenly. */
function macroVariation(material: THREE.MeshStandardMaterial, scale: number, amount: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroScale = { value: scale };
    shader.uniforms.uMacroAmount = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMacroWorld;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvMacroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vMacroWorld;
        uniform float uMacroScale;
        uniform float uMacroAmount;
        float macroHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float macroNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(macroHash(i), macroHash(i + vec2(1.0, 0.0)), f.x),
                     mix(macroHash(i + vec2(0.0, 1.0)), macroHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 macroP = (vMacroWorld.xz + vMacroWorld.yy * 0.37) * uMacroScale;
        float macro = macroNoise(macroP) * 0.65 + macroNoise(macroP * 3.1 + 7.3) * 0.35;
        diffuseColor.rgb *= 1.0 + (macro - 0.5) * 2.0 * uMacroAmount;`,
      );
  };
  material.customProgramCacheKey = () => MACRO_KEY;
}

function attach(
  material: THREE.MeshStandardMaterial,
  set: PbrSet,
  useMetalness: boolean,
  useColour = true,
) {
  // Painted and plated steel keep only the scan's relief and wear: its paint colour is not ours.
  material.map = useColour ? set.colour : null;
  material.normalMap = set.normal;
  material.roughnessMap = set.arm;
  material.aoMap = set.arm;
  material.aoMapIntensity = 0.8;
  if (useMetalness) material.metalnessMap = set.arm;
  material.needsUpdate = true;
}

export function makeMaterials() {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const materials = {
    floor: std({ color: "#57534e", roughness: 1, metalness: 0 }),
    stone: std({ color: "#4a4845", roughness: 1, metalness: 0 }),
    iron: std({ color: "#2a2c31", roughness: 0.7, metalness: 0.7 }),
    domePlate: std({ color: "#1f232c", roughness: 0.8, metalness: 0.55, side: THREE.BackSide }),
    shutter: std({ color: "#2b2f38", roughness: 0.75, metalness: 0.55, side: THREE.BackSide }),
    brass: std({ color: "#e0b872", roughness: 1, metalness: 1 }),
    copper: std({ color: "#f0b08c", roughness: 1, metalness: 1 }),
    patina: std({ color: "#b8c9b4", roughness: 1, metalness: 1 }),
    deck: std({ color: "#b8b0a4", roughness: 1, metalness: 0 }),
    blanket: std({ color: "#5c4f9a", roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    paper: std({ color: "#efe6cf", roughness: 0.6, metalness: 0 }),
    // True emitters (HDR, feed bloom): bulb filaments, firebox coals.
    bulb: std({ color: "#fff4e0", emissive: "#ffc98a", emissiveIntensity: 40, roughness: 0.3 }),
    fire: std({ color: "#1a0a04", emissive: "#ff6a1f", emissiveIntensity: 14, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.32,
      ior: 1.52,
      dispersion: 0.35,
      attenuationColor: new THREE.Color("#d8f0ff"),
      attenuationDistance: 2.5,
      specularIntensity: 1,
      envMapIntensity: 1.4,
    }),
    gaugeGlass: new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.05,
      transmission: 1,
      thickness: 0.01,
      ior: 1.5,
    }),
  };
  macroVariation(materials.floor, 0.18, 0.28);
  macroVariation(materials.domePlate, 0.12, 0.3);
  return materials;
}

export type Materials = ReturnType<typeof makeMaterials>;

/** Attach the scanned maps. Repeats are metres per tile on each surface's UVs. */
export async function attachTextures(m: Materials, lowTier: boolean) {
  const load = async (role: TextureRole) => pbrSet(role);
  const [copper, patina, brass, dome, shutter, floor, deck, blanket] = await Promise.all([
    load("copper"),
    load("patina"),
    load("brass"),
    load("dome-plate"),
    load("shutter"),
    load("floor"),
    load("deck"),
    load("blanket"),
  ]);
  if (floor) attach(m.floor, tiled(floor, 7), false);
  if (floor) attach(m.stone, tiled(floor, 1, 4), false);
  if (dome) attach(m.domePlate, tiled(dome, 28, 7), true, false);
  if (shutter) attach(m.shutter, tiled(shutter, 2, 6), false, false);
  if (shutter) attach(m.iron, tiled(shutter, 1, 3), false, false);
  if (copper) attach(m.copper, tiled(copper, 5, 3), true);
  if (patina) attach(m.patina, tiled(patina, 2, 1), true);
  if (brass) attach(m.brass, tiled(brass, 1.5, 1.5), true);
  if (deck) attach(m.deck, tiled(deck, 1, 1), false);
  if (blanket) attach(m.blanket, tiled(blanket, 2, 2), false);
  if (lowTier) {
    // Transmission costs a second opaque render; the low tier uses a thin clear glass instead.
    m.glass.transmission = 0;
    m.glass.transparent = true;
    m.glass.opacity = 0.35;
    m.glass.needsUpdate = true;
  }
}

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
