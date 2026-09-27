import { useState } from "react";
import type { Composition } from "../game/composition";
import { demoTicket, type PassId } from "../game/passes";
import { timeRange, venueById } from "../game/programme";
import { itinerary } from "../game/schedule";
import { encodeState } from "../game/share";
import { Dialog } from "./Dialog";
import { copyText } from "./hooks";
import { PosterCanvas } from "./PosterCanvas";
import { drawPoster, POSTER_H, POSTER_W } from "./poster";

interface Props {
  open: boolean;
  onClose: () => void;
  saved: string[];
  pass: PassId;
  composition: Composition;
  onReplay: () => void;
}

function downloadPoster(c: Composition) {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W * 2;
  canvas.height = POSTER_H * 2;
  drawPoster(canvas, c);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afterimage-${c.serial}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/** The ending: a clearly labelled demo ticket with the poster the night produced. */
export function TicketDialog({ open, onClose, saved, pass, composition, onReplay }: Props) {
  const ticket = demoTicket(saved, pass);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${encodeState({ saved, event: null })}`;
    setCopied((await copyText(url)) ? "done" : "failed");
  };

  return (
    <Dialog open={open} onClose={onClose} label="Your demo ticket" className="[--w:880px]">
      {ticket && (
        <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-7">
          <PosterCanvas composition={composition} />
          <div className="flex flex-col">
            <p className="self-start rounded-full border border-clash/60 px-3 py-1 text-[0.7rem] font-bold tracking-[0.2em] text-clash uppercase">
              {ticket.label}
            </p>
            <h2 className="mt-4 text-4xl leading-[0.9] font-black tracking-tight sm:text-5xl">
              {composition.mood}
            </h2>
            <p className="mt-2 font-mono text-sm text-foil">
              {composition.serial} · {ticket.pass.name}
            </p>
            <ol className="mt-5 flex flex-col gap-2 border-y border-paper/10 py-4">
              {itinerary(saved).map((p) => (
                <li key={p.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted">
                    {p.day === "fri" ? "Fri" : "Sat"} {timeRange(p)}
                  </span>
                  <span className="min-w-0 flex-1 font-bold">{p.title}</span>
                  <span className="text-xs" style={{ color: venueById(p.venue).colour }}>
                    {venueById(p.venue).short}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 flex justify-between text-sm">
              <span className="text-paper/70">
                {ticket.performances} performance{ticket.performances > 1 ? "s" : ""} · demo total
              </span>
              <span className="text-xl font-black">£{ticket.total}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadPoster(composition)}
              >
                Download poster
              </button>
              <button type="button" className="btn btn-ghost" onClick={copyLink}>
                {copied === "done"
                  ? "Link copied"
                  : copied === "failed"
                    ? "Copy failed"
                    : "Copy night link"}
              </button>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <button type="button" className="btn btn-ghost" onClick={onReplay}>
                Compose another night
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Back to my night
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
