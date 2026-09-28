// Post-processing and quality tiers. Adapted from ODD TIDE's pipeline: the scene renders into a
// half-float target in linear light; GTAO adds contact occlusion; bloom takes only energy above an
// HDR threshold (true emitters: bulbs, beams, screen, fireboxes); tone mapping and the sRGB
// transfer happen once in OutputPass; SMAA anti-aliases the display-referred result.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
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

/** Starting tier: a `?quality=` override, else phones and small screens start at medium. */
export function initialTier(): Tier {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return forced;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  return coarse || small ? "medium" : "high";
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
