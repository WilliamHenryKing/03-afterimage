import { useEffect } from "react";
import { DAYS, VENUES, venueById } from "../game/programme";
import { filterProgramme, savedVenues } from "../game/schedule";
import { EventCard } from "./EventCard";
import type { PanelProps } from "./Panel";

export function ProgrammeTab({
  day,
  onDay,
  venue,
  onVenue,
  saved,
  onToggle,
  openEvent,
  onOpenEvent,
}: PanelProps) {
  const list = filterProgramme(day, venue);
  const counts = savedVenues(saved);

  // A direct link opens its event: make sure it is visible and in view.
  useEffect(() => {
    if (!openEvent) return;
    document.getElementById(`event-${openEvent}`)?.scrollIntoView({ block: "nearest" });
  }, [openEvent]);

  return (
    <div>
      <fieldset>
        <legend className="eyebrow mb-2">Night</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="chip"
            aria-pressed={day === "all"}
            onClick={() => onDay("all")}
          >
            Both
          </button>
          {DAYS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="chip"
              aria-pressed={day === d.id}
              onClick={() => onDay(d.id)}
            >
              {d.date}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="eyebrow mb-2">Space</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="chip"
            aria-pressed={venue === "all"}
            onClick={() => onVenue("all")}
          >
            All spaces
          </button>
          {VENUES.map((v) => (
            <button
              key={v.id}
              type="button"
              className="chip"
              aria-pressed={venue === v.id}
              onClick={() => onVenue(v.id)}
            >
              <span
                aria-hidden="true"
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ background: v.colour }}
              />
              {v.short}
            </button>
          ))}
        </div>
      </fieldset>

      {venue !== "all" && (
        <div className="mt-4 rounded-xl border border-paper/10 p-3">
          <p
            className="text-lg font-black tracking-tight"
            style={{ color: venueById(venue).colour }}
          >
            {venueById(venue).name}
          </p>
          <p className="mt-1 text-sm text-paper/80">{venueById(venue).description}</p>
          <p className="mt-2 text-xs text-muted">
            {counts[venue]
              ? `${counts[venue]} of your saved performances happen here; their lights are marked in the observatory.`
              : "Nothing saved here yet."}
          </p>
        </div>
      )}

      <p className="eyebrow mt-5 mb-2" aria-live="polite">
        {list.length} performance{list.length === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((p) => (
          <EventCard
            key={p.id}
            p={p}
            saved={saved}
            open={openEvent === p.id}
            onOpen={onOpenEvent}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}
