// Post-processing and quality tiers. Adapted from ODD TIDE's pipeline: the scene renders into a
// half-float target in linear light; GTAO adds contact occlusion; bloom takes only energy above an
// HDR threshold (true emitters: bulbs, beams, screen, fireboxes); tone mapping and the sRGB
// transfer happen once in OutputPass; SMAA anti-aliases the display-referred result.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type Tier = "high" | "medium" | "low";

const TIERS: Record<Tier, { ao: boolean; maxPixelRatio: number; bloomScale: number }> = {
  high: { ao: true, maxPixelRatio: 2, bloomScale: 1 },
  medium: { ao: false, maxPixelRatio: 1.5, bloomScale: 0.75 },
  low: { ao: false, maxPixelRatio: 1, bloomScale: 0.5 },
};
const ORDER: Tier[] = ["high", "medium", "low"];
/** Drawing-buffer pixel budget, so a large retina canvas stays bounded (~2560 × 1440). */
const PIXEL_BUDGET = 3.7e6;

/**
 * Zeroes NaN and infinity (all exponent bits set: immune to fast-math) and caps HDR values
 * before bloom. Some GPUs (Apple's) make NaN where others quietly don't, and bloom's blur
 * would spread one bad pixel over the whole frame.
 */
const FiniteShader = {
  name: "FiniteShader",
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float finite(float x) {
      return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u ? 0.0 : clamp(x, 0.0, 16384.0);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(finite(c.r), finite(c.g), finite(c.b), 1.0);
    }`,
};

/** The GPU's name, for a first guess at the tier (empty if WebGL 2 is unavailable). */
function gpuName(): string {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

/**
 * Starting tier: a `?quality=` override; phones and small screens start at medium; otherwise
 * the GPU decides (integrated graphics start at medium, software rendering at low). The
 * adaptive step corrects the guess in play.
 */
export function initialTier(): Tier {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return forced;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  if (coarse || small) return "medium";
  const gpu = gpuName();
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return "low";
  if (/nvidia|geforce|rtx|gtx|radeon (rx|pro)|amd radeon rx|apple m[2-9]/i.test(gpu)) return "high";
  return gpu ? "medium" : "high";
}

type VisibilityPatched = { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[] };

export class Pipeline {
  readonly composer: EffectComposer;
  readonly ao: GTAOPass;
  readonly bloom: UnrealBloomPass;
  tier: Tier;
  /** Objects the AO G-buffer must ignore: additive light, sprites, haze. */
  private aoHidden: THREE.Object3D[] = [];
  private width = 1;
  private height = 1;
  private slow = 0;
  private readonly adaptive: boolean;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    tier: Tier,
    adaptive: boolean,
  ) {
    this.tier = tier;
    this.adaptive = adaptive;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.ao = new GTAOPass(scene, camera, 1, 1);
    this.ao.blendIntensity = 0.9;
    // The AO pre-pass is a full render; the scene pass has already drawn the shadow maps.
    const aoRender = this.ao.render.bind(this.ao);
    this.ao.render = ((...args: Parameters<GTAOPass["render"]>) => {
      const shadows = renderer.shadowMap;
      const auto = shadows.autoUpdate;
      shadows.autoUpdate = false;
      try {
        aoRender(...args);
      } finally {
        shadows.autoUpdate = auto;
      }
    }) as GTAOPass["render"];
    this.ao.updateGtaoMaterial({
      radius: 0.5,
      distanceExponent: 1.6,
      thickness: 1,
      scale: 1.1,
      samples: 12,
    });
    this.ao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 5,
      rings: 2,
      samples: 12,
    });
    const patched = this.ao as unknown as VisibilityPatched;
    const original = patched._overrideVisibility.bind(this.ao);
    patched._overrideVisibility = () => {
      original();
      for (const object of this.aoHidden)
        if (object.visible) {
          object.visible = false;
          patched._visibilityCache.push(object);
        }
    };
    this.composer.addPass(this.ao);
    this.composer.addPass(new ShaderPass(FiniteShader));

    // Bloom is lens glare: only energy above the threshold, clamped so a lamp cannot flood the frame.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.3, 1.8);
    const highPass = this.bloom.materialHighPassFilter;
    highPass.fragmentShader = highPass.fragmentShader.replace(
      "gl_FragColor = mix( outputColor, texel, alpha );",
      `vec3 above = texel.rgb * (max(v - luminosityThreshold, 0.0) / max(v, 1e-4));
        above *= min(1.0, 12.0 / max(luminance(above), 1e-4));
        gl_FragColor = vec4(above, 1.0);`,
    );
    highPass.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new SMAAPass());
    this.applyTier();
  }

  hideFromAo(objects: THREE.Object3D[]) {
    this.aoHidden = objects;
  }

  setSize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const t = TIERS[this.tier];
    const budget = Math.sqrt(PIXEL_BUDGET / (this.width * this.height));
    const ratio = Math.max(0.75, Math.min(window.devicePixelRatio || 1, t.maxPixelRatio, budget));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(this.width, this.height);
    this.bloom.resolution.set(this.width * t.bloomScale, this.height * t.bloomScale);
  }

  setTier(tier: Tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    this.applyTier();
  }

  private applyTier() {
    this.ao.enabled = TIERS[this.tier].ao;
    this.setSize(this.width, this.height);
  }

  /**
   * Compile the scene's and every post pass's programs in parallel (KHR_parallel_shader_compile)
   * before the first frame. three.js keys a program's tone mapping and output colour space on the
   * render target bound when it compiles (WebGLPrograms: renderer.getRenderTarget()), and the
   * scene only ever renders into the composer's half-float target, so compile against that
   * target. Compiling against the screen built the wrong variants, and the first frame then
   * compiled ~44 programs synchronously on D3D11, holding the arrival veil for seconds.
   */
  async warm(scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    const passes = new THREE.Scene();
    const quad = new THREE.PlaneGeometry(2, 2);
    const seen = new Set<THREE.Material>();
    const add = (value: unknown) => {
      if (value instanceof THREE.Material && !seen.has(value)) {
        seen.add(value);
        passes.add(new THREE.Mesh(quad, value));
      }
    };
    for (const pass of this.composer.passes) {
      for (const value of Object.values(pass)) {
        if (Array.isArray(value)) value.forEach(add);
        else add(value);
      }
    }
    // compileAsync resolves program parameters synchronously, so the bound target applies.
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.composer.readBuffer);
    const jobs = [
      this.renderer.compileAsync(scene, camera),
      this.renderer.compileAsync(passes, camera),
    ];
    this.renderer.setRenderTarget(previous);
    await Promise.all(jobs);
    quad.dispose();
  }

  /** Render one frame; `frameMs` is the wall time since the previous frame. */
  render(frameMs: number) {
    this.composer.render();
    if (!this.adaptive || frameMs <= 0) return;
    // Two seconds of frames slower than 60 fps step the tier down; it never steps back up
    // within a visit, so quality does not oscillate.
    this.slow = frameMs > 16.7 ? this.slow + frameMs : Math.max(0, this.slow - frameMs * 0.5);
    if (this.slow > 2000) {
      this.slow = 0;
      const next = ORDER[ORDER.indexOf(this.tier) + 1];
      if (next) this.setTier(next);
    }
  }

  dispose() {
    this.ao.dispose();
    this.bloom.dispose();
    this.composer.dispose();
  }
}
