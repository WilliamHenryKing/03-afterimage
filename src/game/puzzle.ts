// The projectionist's puzzle: rotate mirrors and open shutters so one beam lights the sculpture.
// Boards are authored as text: S source (fires east), T sculpture, # wall,
// / and \ rotatable mirrors, o open shutter, x closed shutter, . empty.

export type Cell = "." | "#" | "S" | "T" | "/" | "\\" | "o" | "x";
export type Dir = 0 | 1 | 2 | 3; // north, east, south, west

export interface Board {
  name: string;
  width: number;
  height: number;
  cells: Cell[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Trace {
  path: Point[];
  end: "target" | "wall" | "shutter" | "edge" | "loop";
}

const LAYOUTS: readonly { name: string; rows: string[] }[] = [
  { name: "First light", rows: ["S../..", "......", "......", ".../.T"] },
  { name: "Shutter hall", rows: ["....\\.T", "....x..", "S.x./.#", ".......", "....\\.#"] },
  { name: "Long throw", rows: ["S../..#", "...o...", ".#./.\\.", ".......", "T.x..\\."] },
];

export const PUZZLE_COUNT = LAYOUTS.length;

export function loadBoard(index: number): Board {
  const layout = LAYOUTS[index];
  if (!layout) throw new Error(`No puzzle ${index}`);
  const width = Math.max(...layout.rows.map((r) => r.length));
  const cells: Cell[] = [];
  for (const row of layout.rows) {
    for (let x = 0; x < width; x++) cells.push(toCell(row[x]));
  }
  return { name: layout.name, width, height: layout.rows.length, cells };
}

function toCell(ch: string | undefined): Cell {
  switch (ch) {
    case "#":
    case "S":
    case "T":
    case "/":
    case "\\":
    case "o":
    case "x":
      return ch;
    default:
      return ".";
  }
}

export function cellAt(board: Board, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return undefined;
  return board.cells[y * board.width + x];
}

export function isInteractive(cell: Cell | undefined): boolean {
  return cell === "/" || cell === "\\" || cell === "o" || cell === "x";
}

/** Rotate a mirror or flip a shutter. Other cells are unchanged. */
export function interact(board: Board, x: number, y: number): Board {
  const cell = cellAt(board, x, y);
  if (!isInteractive(cell)) return board;
  const next: Cell = cell === "/" ? "\\" : cell === "\\" ? "/" : cell === "o" ? "x" : "o";
  const cells = board.cells.slice();
  cells[y * board.width + x] = next;
  return { ...board, cells };
}

const STEP: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function reflect(dir: Dir, mirror: "/" | "\\"): Dir {
  // "/" swaps east<->north and west<->south; "\" swaps east<->south and west<->north.
  const slash: Dir[] = [1, 0, 3, 2];
  const back: Dir[] = [3, 2, 1, 0];
  return (mirror === "/" ? slash : back)[dir] as Dir;
}

export function traceBeam(board: Board): Trace {
  const start = board.cells.indexOf("S");
  if (start < 0) return { path: [], end: "edge" };
  let x = start % board.width;
  let y = Math.floor(start / board.width);
  let dir: Dir = 1;
  const path: Point[] = [{ x, y }];
  const visited = new Set<string>();
  for (;;) {
    const step = STEP[dir] as Point;
    x += step.x;
    y += step.y;
    const cell = cellAt(board, x, y);
    if (cell === undefined) {
      path.push({ x: x - step.x * 0.5, y: y - step.y * 0.5 });
      return { path, end: "edge" };
    }
    const stateKey = `${x},${y},${dir}`;
    if (visited.has(stateKey)) return { path, end: "loop" };
    visited.add(stateKey);
    path.push({ x, y });
    if (cell === "T") return { path, end: "target" };
    if (cell === "#") return { path, end: "wall" };
    if (cell === "x") return { path, end: "shutter" };
    if (cell === "/" || cell === "\\") dir = reflect(dir, cell);
  }
}

export function isSolved(board: Board): boolean {
  return traceBeam(board).end === "target";
}
