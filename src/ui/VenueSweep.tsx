import gsap from "gsap";
import { useEffect, useRef } from "react";
import { venueById } from "../game/programme";
import type { VenueFilter } from "../game/schedule";

interface Props {
  venue: VenueFilter;
  reduced: boolean;
  right: number;
}

/** Oversized venue typography that crosses the scene in step with its stage transformation. */
export function VenueSweep({ venue, reduced, right }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    el.textContent = venue === "all" ? "The Observatory" : venueById(venue).name;
    const tween = reduced
      ? gsap.fromTo(el, { opacity: 0.8, x: 0 }, { opacity: 0, duration: 0.01, delay: 1.2 })
      : gsap.fromTo(
          el,
          { xPercent: 20, opacity: 0 },
          {
            xPercent: -30,
            duration: 1.8,
            ease: "power2.inOut",
            keyframes: { opacity: [0, 0.9, 0.9, 0] },
          },
        );
    return () => {
      tween.kill();
    };
  }, [venue, reduced]);

  return (
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center overflow-hidden"
      style={{ right }}
      aria-hidden="true"
    >
      <div
        ref={ref}
        className="sweep pl-[10vw] text-[18vw] opacity-0 sm:text-[11vw]"
        style={{ color: venue === "all" ? undefined : `${venueById(venue).colour}22` }}
      />
    </div>
  );
}
