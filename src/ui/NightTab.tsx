import { DAYS, timeRange, VENUES, venueById } from "../game/programme";
import { clashes, itinerary, savedVenues } from "../game/schedule";
import { MOTIF_NAMES } from "./EventCard";
import type { PanelProps } from "./Panel";

export function NightTab({
  saved,
  onToggle,
  onKeep,
  onTab,
  onVenue,
  venue,
  onPuzzle,
  stamp,
}: PanelProps) {
  const night = itinerary(saved);
  const found = clashes(saved);
  const counts = savedVenues(saved);

  if (night.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-lg font-extrabold">Your night is empty</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-paper/75">
          Save performances from the programme. Each one leaves its own light on your pass.
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => onTab("programme")}>
          Open the programme
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {found.length > 0 && (
        <section aria-labelledby="clash-title">
          <h2 id="clash-title" className="eyebrow mb-2 text-clash">
            {found.length} clash{found.length > 1 ? "es" : ""}: choose one
          </h2>
          <ul className="flex flex-col gap-2">
            {found.map(({ a, b, minutes }) => (
              <li key={`${a.id}-${b.id}`} className="rounded-xl border border-clash/50 p-3">
                <p className="text-xs text-muted">
                  {minutes} minutes overlap · {DAYS.find((d) => d.id === a.day)?.name}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[a, b].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="rounded-lg border border-paper/20 p-2.5 text-left transition-colors hover:border-paper/60 hover:bg-paper/5"
                      onClick={() => onKeep(p.id)}
                    >
                      <span className="block text-[0.7rem] text-muted">
                        {timeRange(p)} · {venueById(p.venue).short}
                      </span>
                      <span className="mt-0.5 block text-sm leading-tight font-bold">
                        {p.title}
                      </span>
                      <span className="mt-1 block text-[0.7rem] font-bold tracking-widest text-foil uppercase">
                        Keep this
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {DAYS.map((d) => {
        const items = night.filter((p) => p.day === d.id);
        if (!items.length) return null;
        return (
          <section key={d.id} aria-labelledby={`night-${d.id}`}>
            <h2 id={`night-${d.id}`} className="eyebrow mb-2">
              {d.date}
            </h2>
            <ol className="flex flex-col">
              {items.map((p) => {
                const inClash = found.some((c) => c.a.id === p.id || c.b.id === p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border-b border-paper/10 py-2.5 last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ background: p.motif.hue, boxShadow: `0 0 12px ${p.motif.hue}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {timeRange(p)} · {venueById(p.venue).name}
                        {inClash && <span className="font-bold text-clash"> · clash</span>}
                      </p>
                      <p className="truncate font-bold">{p.title}</p>
                      <p className="text-xs text-paper/60">Leaves {MOTIF_NAMES[p.motif.kind]}</p>
                    </div>
                    <button
                      type="button"
                      className="chip shrink-0"
                      aria-label={`Remove ${p.title}`}
                      onClick={() => onToggle(p.id)}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section aria-labelledby="where-title">
        <h2 id="where-title" className="eyebrow mb-2">
          Where you'll be
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {VENUES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={venue === v.id}
              className="rounded-xl border border-paper/15 p-2.5 text-left transition-colors hover:bg-paper/5 aria-pressed:border-paper/70"
              onClick={() => onVenue(venue === v.id ? "all" : v.id)}
            >
              <span className="block text-2xl font-black" style={{ color: v.colour }}>
                {counts[v.id]}
              </span>
              <span className="block text-xs leading-tight font-semibold">{v.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Choose a space to fly there; your saved performances glow where they happen.
        </p>
      </section>

      <section className="rounded-xl border border-foil/30 p-3">
        <p className="text-sm font-bold">The projectionist's puzzle</p>
        <p className="mt-1 text-xs text-paper/70">
          Optional. Turn mirrors and open shutters to light the sculpture.{" "}
          {stamp ? "Stamp earned: it is on your pass." : "Solve all three for a foil stamp."}
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-2 min-h-9 px-3 py-1 text-xs"
          onClick={onPuzzle}
        >
          {stamp ? "Play again" : "Try the puzzle"}
        </button>
      </section>

      <button type="button" className="btn btn-primary w-full" onClick={() => onTab("pass")}>
        Choose a pass
      </button>
    </div>
  );
}
