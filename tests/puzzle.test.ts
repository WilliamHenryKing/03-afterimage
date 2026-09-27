import { describe, expect, test } from "bun:test";
import {
  type Board,
  cellAt,
  interact,
  isSolved,
  loadBoard,
  PUZZLE_COUNT,
  traceBeam,
} from "../src/game/puzzle";

const SOLUTIONS: [number, number][][] = [
  [
    [3, 0],
    [3, 3],
  ],
  [
    [2, 2],
    [4, 1],
    [4, 0],
  ],
  [
    [3, 0],
    [3, 2],
    [5, 4],
    [2, 4],
  ],
];

describe("projectionist's puzzle", () => {
  test("every authored board starts unsolved and is solved by its moves", () => {
    expect(SOLUTIONS).toHaveLength(PUZZLE_COUNT);
    SOLUTIONS.forEach((moves, i) => {
      let board = loadBoard(i);
      expect(isSolved(board)).toBe(false);
      for (const [x, y] of moves) board = interact(board, x, y);
      expect(isSolved(board)).toBe(true);
    });
  });

  test("mirrors rotate, shutters flip, other cells ignore input", () => {
    const board = loadBoard(1);
    expect(cellAt(interact(board, 4, 0), 4, 0)).toBe("/");
    expect(cellAt(interact(board, 2, 2), 2, 2)).toBe("o");
    expect(interact(board, 0, 2)).toBe(board);
    expect(interact(board, 1, 1)).toBe(board);
  });

  test("the beam stops at a closed shutter and runs off open edges", () => {
    expect(traceBeam(loadBoard(1)).end).toBe("shutter");
    const first = traceBeam(loadBoard(0));
    expect(first.end).toBe("edge");
    expect(first.path[0]).toEqual({ x: 0, y: 0 });
  });

  test("a beam bounced back through its source still terminates", () => {
    // S → "\" down → "/" west → "\" north, back through S and off the top edge.
    const board: Board = { name: "ring", width: 2, height: 2, cells: ["S", "\\", "\\", "/"] };
    const trace = traceBeam(board);
    expect(trace.end).toBe("edge");
    expect(trace.path.length).toBeGreaterThan(4);
  });
});
