// Renderer, camera and the loop. Owns the lens position; input, lighting and scenery live in
// their own modules. A capture hook (dev and ?e2e only) exposes bookmarks for visual review.
import gsap from "gsap";
import * as THREE from "three";
import { clampLens, FOCAL, isFocused, LENS_START, type LensPos, separation } from "../game/lens";
import type { VenueFilter } from "../game/schedule";
import { buildArchitecture } from "./architecture";
import { within } from "./assets";
import type { Bookmark } from "./bookmarks";
import { bindLensInput } from "./input";
import { buildLighting, EXPOSURE } from "./lighting";
import { attachTextures, makeMaterials } from "./materials";
import { Projection } from "./projection";
import { initialTier, Pipeline } from "./render/pipeline";
import { Staging } from "./staging";
import { CAMERA_SHOTS, Venues } from "./venues";
import { installVisualTest, visualTestEnabled } from "./visual-test";

export interface StageEvents {
  onFirstFrame: () => void;
  onFocusChange: (focused: boolean) => void;
  /** Each frame: lens speed (units/s) and how split the light is (0..1). */
  onLensFrame?: (speed: number, separation: number) => void;
}

export interface Stage {
  setVenue: (v: VenueFilter) => void;
  setSaved: (ids: readonly string[]) => void;
  posterChanged: () => void;
  setInsets: (right: number, bottom: number) => void;
  setReducedMotion: (reduced: boolean) => void;
  focusLens: () => void;
  resetLens: () => void;
  dispose: () => void;
}

export function createStage(
  canvas: HTMLCanvasElement,
  poster: HTMLCanvasElement,
  events: StageEvents,
): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Applied once, in OutputPass; the composer's intermediate targets stay linear.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const materials = makeMaterials();
  const lighting = buildLighting(scene, renderer, materials);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const shot = CAMERA_SHOTS.all;
  camera.position.copy(shot.pos);
  const look = shot.look.clone();

  const arch = buildArchitecture(materials);
  const projection = new Projection(materials, poster);
  projection.pixelRatio = renderer.getPixelRatio();
  const staging = new Staging(materials);
  const venues = new Venues(materials, projection.lens, arch, staging.deck.group);
  scene.add(arch.group, projection.group, venues.group, staging.group);

  const testing = visualTestEnabled();
  const pipeline = new Pipeline(renderer, scene, camera, initialTier(), !testing);
  pipeline.hideFromAo([...arch.aoHidden, ...projection.aoHidden, ...staging.aoHidden]);

  let reduced = false;
  let lens: LensPos = { ...LENS_START };
  let focus = 0;
  let focused = false;
  let insets = { right: 0, bottom: 0 };
  let lensTween: gsap.core.Tween | null = null;
  let distance = 1;
  let pinnedFov: number | null = null;
  const base = shot.pos.clone();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    pipeline.setSize(w, h);
    const areaW = Math.max(1, w - insets.right);
    const areaH = Math.max(1, h - insets.bottom);
    const aspect = areaW / areaH;
    camera.aspect = w / h;
    // Hold a horizontal field of view so portrait phones still see the lens and the screen.
    const hfov = THREE.MathUtils.degToRad(44);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    camera.fov = pinnedFov ?? THREE.MathUtils.clamp(vfov, 38, 74);
    distance = pinnedFov === null && aspect < 0.8 ? 0.88 : 1;
    camera.setViewOffset(w, h, insets.right / 2, insets.bottom / 2, w, h);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function setLens(next: LensPos) {
    lens = clampLens(next);
    const now = isFocused(lens);
    if (now !== focused) {
      focused = now;
      events.onFocusChange(now);
      if (now) payoff();
    }
  }

  // The focus payoff: beams converge in a brief bloom that settles back.
  function payoff() {
    gsap.killTweensOf(projection);
    if (reduced || frozen) {
      projection.flash = reduced && !frozen ? 0.35 : 0;
      if (!frozen) gsap.to(projection, { flash: 0, duration: 0.6, ease: "none" });
      return;
    }
    gsap.fromTo(projection, { flash: 1 }, { flash: 0, duration: 1.4, ease: "expo.out" });
    gsap.fromTo(
      renderer,
      { toneMappingExposure: EXPOSURE * 1.45 },
      { toneMappingExposure: EXPOSURE, duration: 1.2, ease: "power2.out" },
    );
  }

  function animateLens(to: LensPos, duration: number) {
    lensTween?.kill();
    const proxy = { ...lens };
    lensTween = gsap.to(proxy, {
      x: to.x,
      y: to.y,
      duration: reduced ? 0 : duration,
      ease: "power3.inOut",
      onUpdate: () => setLens(proxy),
    });
  }

  const input = bindLensInput(canvas, {
    get: () => lens,
    set: setLens,
    animate: animateLens,
    stop: () => lensTween?.kill(),
  });

  const timer = new THREE.Timer();
  let lastLens: LensPos = { ...lens };
  let firstFrame = true;
  let cameraTween: gsap.core.Timeline | null = null;
  let frozen = false;
  let frozenAt = 0;
  const waiters: { left: number; done: () => void }[] = [];
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  let lastNow = 0;
  const frame = (now: number) => {
    const frameMs = lastNow ? now - lastNow : 0;
    lastNow = now;
    timer.update(now);
    const dt = frozen ? 0 : Math.min(timer.getDelta(), 0.1);
    const t = frozen ? frozenAt : timer.getElapsed();
    const sep = separation(lens);
    const speed = dt > 0 ? Math.hypot(lens.x - lastLens.x, lens.y - lastLens.y) / dt : 0;
    lastLens = { ...lens };
    events.onLensFrame?.(speed, sep);
    const target = 1 - Math.min(1, sep / 0.55);
    focus += (target - focus) * (reduced || frozen ? 1 : 1 - Math.exp(-dt * 8));
    // A slow breath in the lens stand when idle, never enough to lose focus.
    const still = reduced || frozen || input.dragging();
    const sway = still ? 0 : Math.sin(t * 0.7) * 0.006;
    projection.update({ x: lens.x + sway, y: lens.y }, focus, t);
    venues.update(t, reduced || frozen);
    lighting.update(t, reduced || frozen);
    staging.update(t, dt, reduced || frozen);
    camera.position.copy(base).sub(look).multiplyScalar(distance).add(look);
    camera.lookAt(look);
    pipeline.render(frozen ? 0 : frameMs);
    if (firstFrame) {
      firstFrame = false;
      events.onFirstFrame();
      // Models and the HDRI load before the first frame (see below); captures wait for them.
      deferred.then(() => resolveReady());
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (w && --w.left <= 0) {
        waiters.splice(i, 1);
        w.done();
      }
    }
  };

  // Core textures (capped at 2.5 s so the veil never waits on a slow network), then compile
  // every visible material in parallel (KHR_parallel_shader_compile where available) before the
  // first frame, instead of stalling that frame on a queue of synchronous compiles.
  let disposed = false;
  const start = () => {
    if (!disposed) renderer.setAnimationLoop(frame);
  };
  // Models and the HDRI now load before the veil lifts (capped at 6 s on slow links), so one
  // parallel warm-up compiles everything; streaming them in afterwards added programs that
  // compiled synchronously and froze the page (and the veil's fade) for seconds.
  const deferred = Promise.all([
    lighting.loadDeferred(),
    projection.loadDeferred(),
    staging.loadDeferred(),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  within(attachTextures(materials, pipeline.tier === "low"), 2500)
    .then(() => within(deferred, 6000))
    .then(() => pipeline.warm(scene, camera))
    .then(start, start);

  function setVenue(v: VenueFilter, instant = reduced) {
    venues.setVenue(v, instant);
    staging.setVenue(v, instant);
    cameraTween?.kill();
    const next = CAMERA_SHOTS[v];
    const d = instant ? 0 : 1.6;
    cameraTween = gsap
      .timeline({ defaults: { duration: d, ease: "power3.inOut" } })
      .to(base, { x: next.pos.x, y: next.pos.y, z: next.pos.z }, 0)
      .to(look, { x: next.look.x, y: next.look.y, z: next.look.z }, 0);
  }

  const removeHook = testing
    ? installVisualTest({
        ready,
        apply(bookmark: Bookmark) {
          lensTween?.kill();
          setVenue(bookmark.venue, true);
          cameraTween?.kill();
          setLens(bookmark.lens);
          focus = 1 - Math.min(1, separation(lens) / 0.55);
          base.copy(bookmark.pos);
          look.copy(bookmark.look);
          insets = { right: 0, bottom: 0 };
          pinnedFov = bookmark.fov ?? null;
          resize();
        },
        freeze(on) {
          frozen = on;
          frozenAt = timer.getElapsed();
          if (on) gsap.globalTimeline.pause();
          else gsap.globalTimeline.resume();
        },
        frames: (count) =>
          new Promise<void>((done) => {
            waiters.push({ left: count, done });
          }),
        info: () => {
          const gl = renderer.getContext();
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown",
            pixelRatio: renderer.getPixelRatio(),
            tier: pipeline.tier,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            textures: renderer.info.memory.textures,
          };
        },
      })
    : () => undefined;

  return {
    setVenue: (v) => setVenue(v),
    setSaved(ids) {
      venues.setSaved(ids, reduced);
    },
    posterChanged() {
      projection.posterChanged();
    },
    setInsets(right, bottom) {
      insets = { right, bottom };
      resize();
    },
    setReducedMotion(r) {
      reduced = r;
    },
    focusLens() {
      animateLens(FOCAL, 1.4);
    },
    resetLens() {
      animateLens(LENS_START, 1.2);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      input.dispose();
      removeHook();
      lighting.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
