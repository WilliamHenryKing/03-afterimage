interface Props {
  focused: boolean;
  firstVisit: boolean;
  wide: boolean;
  right: number;
  bottom: number;
  onFocus: () => void;
  onSkip: () => void;
}

/** Teaches the lens in place: a first-time card, then a quiet reminder while out of focus. */
export function Hint({ focused, firstVisit, wide, right, bottom, onFocus, onSkip }: Props) {
  if (focused) return null;
  return (
    <div
      className="pointer-events-none fixed left-0 z-20 flex justify-center px-4 transition-[right,bottom] duration-500"
      style={{ right, bottom: bottom + (wide ? 40 : 16) }}
    >
      {firstVisit ? (
        <div className="glass pointer-events-auto max-w-sm rounded-2xl p-5 text-center">
          <p className="eyebrow">Projectionist's hint</p>
          <p className="mt-2 text-xl font-extrabold tracking-tight">Move the lens</p>
          <p className="mt-2 text-sm leading-relaxed text-paper/80">
            {wide ? "Drag" : "Drag with a finger"} anywhere on the observatory to bring the split
            light into focus. Arrow keys work too; Enter focuses it for you.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={onFocus}>
              Focus for me
            </button>
            <button type="button" className="btn btn-ghost" onClick={onSkip}>
              Programme
            </button>
          </div>
        </div>
      ) : (
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-sm">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-clash" />
          <span>Lens out of focus: drag to resolve</span>
          <button type="button" className="btn btn-ghost min-h-9 px-3 py-1" onClick={onFocus}>
            Focus
          </button>
        </div>
      )}
    </div>
  );
}
