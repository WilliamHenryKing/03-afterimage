import { useState } from "react";
import {
  type Cell,
  interact,
  isInteractive,
  loadBoard,
  PUZZLE_COUNT,
  traceBeam,
} from "../game/puzzle";
import { Dialog } from "./Dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSolvedAll: () => void;
}

const LABELS: Record<Cell, string> = {
  ".": "empty",
  "#": "wall",
  S: "projector",
  T: "sculpture",
  "/": "mirror leaning right",
  "\\": "mirror leaning left",
  o: "open shutter",
  x: "closed shutter",
};

function CellArt({ cell, lit }: { cell: Cell; lit: boolean }) {
  switch (cell) {
    case "#":
      return <rect x="6" y="6" width="88" height="88" rx="6" fill="#1b1c22" />;
    case "S":
      return (
        <g>
          <rect
            x="18"
            y="30"
            width="46"
            height="40"
            rx="6"
            fill="#2a2b33"
            stroke="#8a7248"
            strokeWidth="3"
          />
          <circle cx="74" cy="50" r="10" fill="#fff1d6" />
        </g>
      );
    case "T":
      return (
        <polygon
          points="50,14 80,50 50,86 20,50"
          fill={lit ? "#f1ece0" : "#23242b"}
          stroke={lit ? "#d8b46a" : "#5a5850"}
          strokeWidth="4"
          style={lit ? { filter: "drop-shadow(0 0 12px #d8b46a)" } : undefined}
        />
      );
    case "/":
    case "\\":
      return (
        <line
          x1="20"
          y1={cell === "/" ? 80 : 20}
          x2="80"
          y2={cell === "/" ? 20 : 80}
          stroke="#cfe7ff"
          strokeWidth="8"
          strokeLinecap="round"
        />
      );
    case "o":
      return (
        <g stroke="#8a7248" strokeWidth="6" strokeLinecap="round">
          <line x1="50" y1="8" x2="50" y2="26" />
          <line x1="50" y1="74" x2="50" y2="92" />
        </g>
      );
    case "x":
      return <rect x="42" y="8" width="16" height="84" rx="4" fill="#8a7248" />;
    default:
      return <circle cx="50" cy="50" r="2.5" fill="#f1ece0" opacity="0.2" />;
  }
}

interface CellProps {
  cell: Cell;
  x: number;
  y: number;
  lit: boolean;
  onAct: () => void;
}

function PuzzleCell({ cell, x, y, lit, onAct }: CellProps) {
  const label = `${LABELS[cell]}, row ${y + 1}, column ${x + 1}`;
  const art = (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <CellArt cell={cell} lit={lit} />
    </svg>
  );
  if (isInteractive(cell)) {
    return (
      <button
        type="button"
        aria-label={`${label}. Press to change.`}
        className="m-[2px] rounded-md border border-paper/25 bg-paper/[0.04] hover:bg-paper/10"
        onClick={onAct}
      >
        {art}
      </button>
    );
  }
  return (
    <div role="img" aria-label={label} className="m-[2px] rounded-md bg-ink/60">
      {art}
    </div>
  );
}

export function PuzzleDialog({ open, onClose, onSolvedAll }: Props) {
  const [index, setIndex] = useState(0);
  const [board, setBoard] = useState(() => loadBoard(0));
  const trace = traceBeam(board);
  const solved = trace.end === "target";
  const last = index === PUZZLE_COUNT - 1;

  const go = (i: number) => {
    setIndex(i);
    setBoard(loadBoard(i));
  };
  const act = (x: number, y: number) => {
    const next = interact(board, x, y);
    setBoard(next);
    if (last && traceBeam(next).end === "target") onSolvedAll();
  };
  const points = trace.path.map((p) => `${(p.x + 0.5) * 100},${(p.y + 0.5) * 100}`).join(" ");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="The projectionist's puzzle"
      className="[--w:560px]"
    >
      <div className="p-5 sm:p-7">
        <p className="eyebrow">
          Projectionist's puzzle · {index + 1} of {PUZZLE_COUNT}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">{board.name}</h2>
        <p className="mt-1 text-sm text-paper/75">
          Tap a mirror to turn it, a shutter to open or close it. Light the sculpture.
        </p>
        <div
          className="relative mx-auto mt-4 w-full"
          style={{ maxWidth: board.width * 64, aspectRatio: `${board.width} / ${board.height}` }}
        >
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${board.width}, 1fr)` }}
          >
            {board.cells.map((cell, i) => {
              const x = i % board.width;
              const y = Math.floor(i / board.width);
              return (
                <PuzzleCell
                  key={`${x}-${y}`}
                  cell={cell}
                  x={x}
                  y={y}
                  lit={solved}
                  onAct={() => act(x, y)}
                />
              );
            })}
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${board.width * 100} ${board.height * 100}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={points}
              fill="none"
              stroke="#fff1d6"
              strokeOpacity="0.25"
              strokeWidth="22"
              strokeLinejoin="round"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#fff6e4"
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-4 min-h-6 text-center text-sm font-semibold" aria-live="polite">
          {solved
            ? last
              ? "The sculpture burns bright. The foil stamp is on your pass."
              : "The sculpture is lit."
            : trace.end === "shutter"
              ? "A closed shutter stops the beam."
              : "The beam has not reached the sculpture yet."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => go(index)}>
            Reset
          </button>
          {solved && !last && (
            <button type="button" className="btn btn-primary" onClick={() => go(index + 1)}>
              Next board
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {solved && last ? "Done" : "Close"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
