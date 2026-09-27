import { useEffect, useState } from "react";
import { sound } from "../audio/sound";

/** Persistent sound toggle; M does the same from anywhere. */
export function MuteToggle() {
  const [muted, setMuted] = useState(sound.muted);
  useEffect(() => sound.subscribe(setMuted), []);
  return (
    <button
      type="button"
      className="chip pointer-events-auto mt-3 inline-flex items-center gap-2 bg-ink/60"
      aria-pressed={!muted}
      aria-keyshortcuts="M"
      title="Sound (M)"
      onClick={() => {
        sound.unlock();
        sound.setMuted(!muted);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M17 9l5 6M22 9l-5 6" />
        ) : (
          <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
        )}
      </svg>
      {muted ? "Sound off" : "Sound on"}
      <span className="sr-only">(press M to toggle)</span>
    </button>
  );
}
