import { useEffect, useRef } from "react";
import type { Composition } from "../game/composition";
import { drawPoster, POSTER_H, POSTER_W } from "./poster";

interface Props {
  composition: Composition;
  className?: string;
}

export function describe(c: Composition): string {
  if (!c.layers.length) return "Pass design: the bare festival identity, waiting for a night.";
  return `Pass design, ${c.mood.toLowerCase()}: ${c.layers.length} layer${c.layers.length > 1 ? "s" : ""} of light for ${c.lines.map((l) => l.title).join(", ")}.`;
}

/** A crisp poster preview; draws at the poster's native resolution and scales with CSS. */
export function PosterCanvas({ composition, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPoster(ref.current, composition);
  }, [composition]);
  return (
    <canvas
      ref={ref}
      width={POSTER_W}
      height={POSTER_H}
      role="img"
      aria-label={describe(composition)}
      className={`block aspect-[3/4] h-auto w-full rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${className ?? ""}`}
    />
  );
}
