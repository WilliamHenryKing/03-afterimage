// Sourced assets (see assets.manifest.json): PBR texture sets, glTF models and the HDRI.
// Colour maps are sRGB, everything else linear. Loads are cached and never throw: a missing
// file leaves the procedural fallback in place.
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

export type TextureRole =
  | "copper"
  | "patina"
  | "brass"
  | "dome-plate"
  | "shutter"
  | "floor"
  | "deck"
  | "blanket";
export type ModelRole = "projector" | "pipe-lamp" | "lantern";

export interface PbrSet {
  colour: THREE.Texture;
  normal: THREE.Texture;
  arm: THREE.Texture;
}

const base = `${import.meta.env.BASE_URL}assets/`;
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const sets = new Map<TextureRole, Promise<PbrSet | null>>();
const models = new Map<ModelRole, Promise<GLTF | null>>();

function texture(url: string, colour: boolean): Promise<THREE.Texture> {
  return textureLoader.loadAsync(url).then((t) => {
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  });
}

export function pbrSet(role: TextureRole): Promise<PbrSet | null> {
  let pending = sets.get(role);
  if (!pending) {
    const dir = `${base}textures/${role}/`;
    pending = Promise.all([
      texture(`${dir}colour.webp`, true),
      texture(`${dir}normal.webp`, false),
      texture(`${dir}arm.webp`, false),
    ])
      .then(([colour, normal, arm]) => ({ colour, normal, arm }))
      .catch(() => null);
    sets.set(role, pending);
  }
  return pending;
}

/** A tiled copy of a set, so two materials can use different repeats of the same scan. */
export function tiled(set: PbrSet, x: number, y = x, rotation = 0): PbrSet {
  const copy = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(x, y);
    c.center.set(0.5, 0.5);
    c.rotation = rotation;
    c.needsUpdate = true;
    return c;
  };
  return { colour: copy(set.colour), normal: copy(set.normal), arm: copy(set.arm) };
}

export function model(role: ModelRole): Promise<GLTF | null> {
  let pending = models.get(role);
  if (!pending) {
    pending = gltfLoader.loadAsync(`${base}models/${role}.glb`).catch(() => null);
    models.set(role, pending);
  }
  return pending;
}

export function hdri(): Promise<THREE.DataTexture | null> {
  return new HDRLoader()
    .loadAsync(`${base}hdri/boiler_room_1k.hdr`)
    .then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    })
    .catch(() => null);
}

/** Resolve after `promise` or `ms`, whichever is first: the veil never waits on a slow network. */
export function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}
