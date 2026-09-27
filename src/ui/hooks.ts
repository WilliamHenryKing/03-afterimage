import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useViewportHeight(): number {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const update = () => setH(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return h;
}

const HINT_KEY = "afterimage.hint-seen";

export function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Storage can be unavailable (private mode); the hint simply shows again next time.
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
