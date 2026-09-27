// Renderer, camera, lights and the loop. Owns the lens position and its pointer/keyboard input.
import gsap from "gsap";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  clampLens,
  FOCAL,
  isFocused,
  LENS_START,
  type LensPos,
  nudge,
  separation,
  settle,
} from "../game/lens";
import type { VenueFilter } from "../game/schedule";
import { buildArchitecture } from "./architecture";
import { makeMaterials } from "./materials";
import { Projection } from "./projection";
import { CAMERA_SHOTS, Venues } from "./venues";

export interface StageEvents {
  onFirstFrame: () => void;
  onFocusChange: (focused: boolean) => void;
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
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#05060a");
  scene.fog = new THREE.FogExp2("#05060a", 0.028);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.16;

  const key = new THREE.DirectionalLight("#dfe6ff", 1.4);
  key.position.set(6, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sc.far = 40;
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const shot = CAMERA_SHOTS.all;
  camera.position.copy(shot.pos);
  const look = shot.look.clone();

  const materials = makeMaterials();
  const arch = buildArchitecture(materials);
  const projection = new Projection(materials, poster);
  const venues = new Venues(materials, projection.lens, arch);
  scene.add(arch.group, projection.group, venues.group);

  let reduced = false;
  let lens: LensPos = { ...LENS_START };
  let focus = 0;
  let focused = false;
  let insets = { right: 0, bottom: 0 };
  let lensTween: gsap.core.Tween | null = null;
  let distance = 1;
  const base = shot.pos.clone();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const areaW = Math.max(1, w - insets.right);
    const areaH = Math.max(1, h - insets.bottom);
    const aspect = areaW / areaH;
    camera.aspect = w / h;
    // Hold a horizontal field of view so portrait phones still see the lens and the screen.
    const hfov = THREE.MathUtils.degToRad(44);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    camera.fov = THREE.MathUtils.clamp(vfov, 38, 74);
    distance = aspect < 0.8 ? 0.88 : 1;
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
    }
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

  // Pointer: drag anywhere on the scene to move the lens.
  let drag: { id: number; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    lensTween?.kill();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const scale = 2.4 / Math.max(240, Math.min(canvas.clientWidth, canvas.clientHeight));
    setLens(nudge(lens, (e.clientX - drag.x) * scale, -(e.clientY - drag.y) * scale));
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    canvas.classList.remove("is-dragging");
    const settled = settle(lens);
    if (settled !== lens) animateLens(settled, 0.5);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.02 : 0.07;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      lensTween?.kill();
      const next = nudge(lens, move[0], move[1]);
      const settled = settle(next);
      if (settled !== next) animateLens(settled, 0.35);
      else setLens(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      animateLens(FOCAL, 1.2);
    }
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("keydown", onKey);

  const timer = new THREE.Timer();
  let firstFrame = true;
  let cameraTween: gsap.core.Timeline | null = null;

  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    const target = 1 - Math.min(1, separation(lens) / 0.55);
    focus += (target - focus) * (reduced ? 1 : 1 - Math.exp(-dt * 8));
    // A slow breath in the lens hanger when idle, never enough to lose focus.
    const sway = reduced || drag ? 0 : Math.sin(t * 0.7) * 0.006;
    projection.update({ x: lens.x + sway, y: lens.y }, focus, t);
    venues.update(t, reduced);
    camera.position.copy(base).sub(look).multiplyScalar(distance).add(look);
    camera.lookAt(look);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      events.onFirstFrame();
    }
  });

  return {
    setVenue(v) {
      venues.setVenue(v, reduced);
      cameraTween?.kill();
      const next = CAMERA_SHOTS[v];
      const d = reduced ? 0 : 1.6;
      cameraTween = gsap
        .timeline({ defaults: { duration: d, ease: "power3.inOut" } })
        .to(base, { x: next.pos.x, y: next.pos.y, z: next.pos.z }, 0)
        .to(look, { x: next.look.x, y: next.look.y, z: next.look.z }, 0);
    },
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
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
