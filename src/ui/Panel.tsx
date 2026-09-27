import type { Composition } from "../game/composition";
import type { PassId } from "../game/passes";
import { clashes, type DayFilter, type VenueFilter } from "../game/schedule";
import { NightTab } from "./NightTab";
import { PassTab } from "./PassTab";
import { ProgrammeTab } from "./ProgrammeTab";

export type Tab = "programme" | "night" | "pass";

export interface PanelProps {
  wide: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: Tab;
  onTab: (tab: Tab) => void;
  saved: string[];
  onToggle: (id: string) => void;
  onKeep: (id: string) => void;
  day: DayFilter;
  onDay: (d: DayFilter) => void;
  venue: VenueFilter;
  onVenue: (v: VenueFilter) => void;
  openEvent: string | null;
  onOpenEvent: (id: string | null) => void;
  pass: PassId;
  onPass: (p: PassId) => void;
  composition: Composition;
  onIssue: () => void;
  onPuzzle: () => void;
  stamp: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "programme", label: "Programme" },
  { id: "night", label: "My night" },
  { id: "pass", label: "Pass" },
];

export function Panel(props: PanelProps) {
  const { wide, open, onOpenChange, tab, onTab, saved } = props;
  const clashCount = clashes(saved).length;

  const choose = (t: Tab) => {
    onTab(t);
    onOpenChange(true);
  };

  const frame = wide
    ? `fixed top-3 right-3 bottom-3 z-30 w-[440px] rounded-2xl transition-transform duration-500 ${open ? "" : "translate-x-[calc(100%+24px)]"}`
    : `fixed inset-x-0 bottom-0 z-30 rounded-t-2xl transition-[height] duration-500 ${open ? "h-[58dvh]" : "h-[124px]"}`;

  return (
    <>
      {wide && !open && (
        <button
          type="button"
          className="btn btn-primary fixed top-6 right-6 z-30"
          onClick={() => onOpenChange(true)}
        >
          Programme
        </button>
      )}
      <aside
        className={`glass flex flex-col overflow-hidden ${frame}`}
        aria-label="Festival programme and my night"
        inert={wide && !open}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          {!wide && (
            <button
              type="button"
              className="mx-auto mb-1 h-6 w-16 rounded-full"
              aria-label={open ? "Collapse panel" : "Expand panel"}
              aria-expanded={open}
              onClick={() => onOpenChange(!open)}
            >
              <span className="mx-auto block h-1 w-10 rounded-full bg-paper/40" />
            </button>
          )}
          {wide && (
            <>
              <p className="eyebrow">Afterimage · programme</p>
              <button
                type="button"
                className="btn btn-ghost min-h-9 px-3 py-1 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Hide
              </button>
            </>
          )}
        </div>
        <div role="tablist" aria-label="Sections" className="flex gap-1 px-3 pt-2 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="panel-body"
              className={`relative flex-1 rounded-xl px-2 py-2.5 text-sm font-bold transition-colors ${tab === t.id ? "bg-paper text-ink" : "text-paper/80 hover:bg-paper/10"}`}
              onClick={() => choose(t.id)}
            >
              {t.label}
              {t.id === "night" && saved.length > 0 && (
                <span
                  className={`ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.7rem] ${clashCount ? "bg-clash text-ink" : "bg-foil text-ink"}`}
                  role="img"
                  aria-label={
                    clashCount
                      ? `${saved.length} saved, ${clashCount} clash${clashCount > 1 ? "es" : ""}`
                      : `${saved.length} saved`
                  }
                >
                  {clashCount ? "!" : saved.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div
          id="panel-body"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        >
          {tab === "programme" && <ProgrammeTab {...props} />}
          {tab === "night" && <NightTab {...props} />}
          {tab === "pass" && <PassTab {...props} />}
        </div>
      </aside>
    </>
  );
}
