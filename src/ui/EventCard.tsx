import { useState } from "react";
import { sound } from "../audio/sound";
import { dayName, type MotifKind, type Performance, timeRange, venueById } from "../game/programme";
import { clashesWith } from "../game/schedule";
import { encodeState } from "../game/share";
import { copyText } from "./hooks";

export const MOTIF_NAMES: Record<MotifKind, string> = {
  slit: "a moving slit of light",
  foil: "a foil ribbon",
  pattern: "a patterned projection",
  field: "a field of soft colour",
};

interface Props {
  p: Performance;
  saved: string[];
  open: boolean;
  onOpen: (id: string | null) => void;
  onToggle: (id: string) => void;
}

export function EventCard({ p, saved, open, onOpen, onToggle }: Props) {
  const venue = venueById(p.venue);
  const isSaved = saved.includes(p.id);
  const clash = clashesWith(saved, p.id);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${encodeState({ saved: [], event: p.id })}`;
    sound.play("copy");
    setCopied((await copyText(url)) ? "done" : "failed");
  };

  return (
    <li
      id={`event-${p.id}`}
      className={`rounded-xl border transition-colors ${isSaved ? "border-foil/60 bg-foil/[0.06]" : "border-paper/10"}`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg text-left"
          aria-expanded={open}
          aria-controls={`detail-${p.id}`}
          onClick={() => onOpen(open ? null : p.id)}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: venue.colour }}
            />
            {dayName(p.day).slice(0, 3)} {timeRange(p)} · {venue.short}
          </span>
          <span className="mt-1 block text-[1.05rem] leading-tight font-extrabold tracking-tight">
            {p.title}
          </span>
          <span className="mt-0.5 block text-sm text-paper/70">{p.artist}</span>
          {clash.length > 0 && !isSaved && (
            <span className="mt-1 block text-xs font-semibold text-clash">
              Overlaps {clash.map((c) => c.title).join(", ")}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={`${isSaved ? "Remove" : "Save"} ${p.title}`}
          className={`chip shrink-0 ${isSaved ? "" : "hover:bg-paper/10"}`}
          onClick={() => onToggle(p.id)}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
      {open && (
        <div id={`detail-${p.id}`} className="border-t border-paper/10 px-3 pt-3 pb-3 text-sm">
          <p className="leading-relaxed text-paper/85">{p.blurb}</p>
          <p className="mt-2 text-xs text-muted">
            {venue.name}, {dayName(p.day)} {timeRange(p)}. Saving it adds{" "}
            <span style={{ color: p.motif.hue }}>{MOTIF_NAMES[p.motif.kind]}</span> to your pass.
          </p>
          {clash.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-clash">
              Clashes with {clash.map((c) => `${c.title} (${timeRange(c)})`).join(", ")}. Choose
              between them in My night.
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost mt-3 min-h-9 px-3 py-1 text-xs"
            onClick={copyLink}
          >
            {copied === "done" ? "Link copied" : copied === "failed" ? "Copy failed" : "Copy link"}
          </button>
        </div>
      )}
    </li>
  );
}
