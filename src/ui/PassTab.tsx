import { PASSES, passCovers, recommendPass, ticketBlockers } from "../game/passes";
import type { PanelProps } from "./Panel";
import { PosterCanvas } from "./PosterCanvas";

const BLOCKER_TEXT = {
  empty: "Save at least one performance first.",
  clashes: "Resolve the clashes in My night first.",
  uncovered: "This pass does not cover every night you saved.",
} as const;

export function PassTab({ saved, pass, onPass, composition, onIssue, onTab }: PanelProps) {
  const blockers = ticketBlockers(saved, pass);
  const recommended = recommendPass(saved);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[minmax(0,9rem)_1fr] items-start gap-4">
        <PosterCanvas composition={composition} />
        <div>
          <p className="eyebrow">Your pass</p>
          <p className="mt-1 text-lg leading-tight font-extrabold italic">{composition.mood}</p>
          <p className="mt-1 font-mono text-xs text-foil">{composition.serial}</p>
          <p className="mt-2 text-xs leading-relaxed text-paper/70">
            The design is made from the night you saved. Change the night and the pass changes with
            it.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="eyebrow mb-2">Pass options (demo prices)</legend>
        <div className="flex flex-col gap-2">
          {PASSES.map((p) => {
            const covers = passCovers(p.id, saved);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foil ${pass === p.id ? "border-paper/70 bg-paper/[0.06]" : "border-paper/15"}`}
              >
                <input
                  type="radio"
                  name="pass"
                  value={p.id}
                  checked={pass === p.id}
                  onChange={() => onPass(p.id)}
                  className="h-4 w-4 accent-[#d8b46a]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {p.name}
                    {saved.length > 0 && p.id === recommended && (
                      <span className="ml-2 rounded-full bg-foil px-2 py-0.5 text-[0.65rem] tracking-wider text-ink uppercase">
                        fits your night
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-paper/65">
                    {p.note}
                    {!covers && saved.length > 0 ? " · misses a saved night" : ""}
                  </span>
                </span>
                <span className="text-lg font-black">£{p.price}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {blockers.length > 0 && (
        <ul className="text-sm text-clash" aria-live="polite">
          {blockers.map((b) => (
            <li key={b}>{BLOCKER_TEXT[b]}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={blockers.length > 0}
          onClick={onIssue}
        >
          Issue demo pass
        </button>
        {blockers.includes("clashes") && (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onTab("night")}>
            Resolve clashes
          </button>
        )}
        {blockers.includes("empty") && (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onTab("programme")}>
            Browse the programme
          </button>
        )}
        <p className="text-center text-xs text-muted">
          A demonstration: no payment is taken and nothing is sent anywhere.
        </p>
      </div>
    </div>
  );
}
