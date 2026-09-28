// Pointer and keyboard control of the lens. Drag anywhere on the scene; arrows nudge; Enter focuses.
import { FOCAL, type LensPos, nudge, settle } from "../game/lens";

export interface LensControl {
  get: () => LensPos;
  set: (p: LensPos) => void;
  animate: (to: LensPos, duration: number) => void;
  stop: () => void;
}

export interface LensInput {
  dragging: () => boolean;
  dispose: () => void;
}

export function bindLensInput(canvas: HTMLCanvasElement, lens: LensControl): LensInput {
  let drag: { id: number; x: number; y: number } | null = null;

  const onDown = (e: PointerEvent) => {
    lens.stop();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const scale = 2.4 / Math.max(240, Math.min(canvas.clientWidth, canvas.clientHeight));
    lens.set(nudge(lens.get(), (e.clientX - drag.x) * scale, -(e.clientY - drag.y) * scale));
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    canvas.classList.remove("is-dragging");
    const current = lens.get();
    const settled = settle(current);
    if (settled !== current) lens.animate(settled, 0.5);
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
      lens.stop();
      const next = nudge(lens.get(), move[0], move[1]);
      const settled = settle(next);
      if (settled !== next) lens.animate(settled, 0.35);
      else lens.set(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      lens.animate(FOCAL, 1.2);
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("keydown", onKey);

  return {
    dragging: () => drag !== null,
    dispose() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
    },
  };
}
