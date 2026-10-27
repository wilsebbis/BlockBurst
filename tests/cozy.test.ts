import { describe, expect, it } from "vitest";
import { SIZE } from "../src/engine/board";
import { boardBodies, COZY_CLEARING, COZY_PALETTE, emoteFor, faceAnchor, gazeTowards, shapeLinks, shapeParts } from "../src/engine/cozy";
import { isCozy } from "../src/lib/look";

describe("the Cozy look", () => {
  it("is the default, including for saves made before the setting existed", () => {
    expect(isCozy({})).toBe(true);
    expect(isCozy({ look: "cozy" })).toBe(true);
    expect(isCozy({ look: "classic" })).toBe(false);
  });

  it("grows two touching pieces of the same colour into one creature", () => {
    const colours = new Array<number>(SIZE * SIZE).fill(0);
    const owners = new Array<number>(SIZE * SIZE).fill(0);
    // Two touching red dominoes from two different placements, and a blue one beside them.
    for (const [i, colour, owner] of [[0, 1, 1], [1, 1, 1], [2, 1, 2], [3, 1, 2], [4, 2, 3], [5, 2, 3]] as const) {
      colours[i] = colour;
      owners[i] = owner;
    }
    const bodies = boardBodies(colours, owners);
    expect(bodies.map((body) => body.cells.length)).toEqual([4, 2]);
  });

  it("keeps a diagonal piece one creature, joined by necks", () => {
    const colours = new Array<number>(SIZE * SIZE).fill(0);
    const owners = new Array<number>(SIZE * SIZE).fill(0);
    for (const i of [0, SIZE + 1, 2 * SIZE + 2]) {
      colours[i] = 5;
      owners[i] = 4;
    }
    const [body] = boardBodies(colours, owners);
    expect(body?.cells).toHaveLength(3);
    expect(body?.links).toHaveLength(2);
    // The same piece in the tray gets the same two necks.
    expect(shapeLinks([[0, 0], [1, 1], [2, 2]])).toHaveLength(2);
  });

  it("joins same-coloured cells that touch at a corner into one creature, whichever pieces they came from", () => {
    const colours = new Array<number>(SIZE * SIZE).fill(0);
    const owners = new Array<number>(SIZE * SIZE).fill(0);
    colours[0] = 5;
    owners[0] = 1;
    colours[SIZE + 1] = 5;
    owners[SIZE + 1] = 2;
    const bodies = boardBodies(colours, owners);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.links).toHaveLength(1);
  });

  it("keeps separated cells of the same colour as separate creatures", () => {
    const colours = new Array<number>(SIZE * SIZE).fill(0);
    const owners = new Array<number>(SIZE * SIZE).fill(0);
    // Once one piece, now split by a cleared line: two creatures, so two faces.
    colours[0] = 3;
    colours[2] = 3;
    owners[0] = 1;
    owners[2] = 1;
    expect(boardBodies(colours, owners)).toHaveLength(2);
  });

  it("never grows necks or joins across the clearing bar", () => {
    const colours = new Array<number>(SIZE * SIZE).fill(0);
    const owners = new Array<number>(SIZE * SIZE).fill(0);
    colours[0] = 9;
    owners[0] = -1;
    colours[SIZE + 1] = 9;
    owners[SIZE + 1] = -1;
    expect(boardBodies(colours, owners).every((body) => body.links.length === 0)).toBe(true);
  });

  it("puts the face on the top row, as far right as it can go without covering a gift", () => {
    expect(faceAnchor([[0, 0]])).toMatchObject({ x: 0.53, scale: 0.9 });
    const square = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;
    // A big body gets wider-set, larger eyes straddling its top two cells.
    expect(faceAnchor(square)).toMatchObject({ x: 1, scale: 1.3 });
    // A gift in the top-right cell pushes the face left.
    expect(faceAnchor(square, new Set(["0,1"]))).toMatchObject({ x: 0.53 });
  });


  it("uses a clearing colour no piece uses", () => {
    expect(COZY_PALETTE).not.toContain(COZY_CLEARING);
    expect(new Set(COZY_PALETTE).size).toBe(7);
  });

  it("gives each separate part of a diagonal piece its own face, in the tray as on the board", () => {
    expect(shapeParts([[0, 0], [1, 1], [2, 2]])).toHaveLength(3);
    expect(shapeParts([[0, 0], [0, 1], [1, 1]])).toHaveLength(1);
  });

  it("points the eyes at the held piece", () => {
    expect(gazeTowards(0, 0, 10, 0)).toEqual({ x: 1, y: 0 });
    expect(gazeTowards(5, 5, 5, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe("proximity emotes", () => {
  const board = (cells: [number, number, number][]) => {
    const g = new Array(SIZE * SIZE).fill(0);
    for (const [r, c, v] of cells) g[r * SIZE + c] = v;
    return g;
  };

  it("a lone piece in open space says nothing", () => {
    const g = board([[3, 3, 1], [3, 4, 1]]);
    expect(emoteFor(g, [[3, 3], [3, 4]], 1)).toBeNull();
  });

  it("snuggling along three sides of another creature earns a heart between them", () => {
    // A 1x3 bar landing right on top of a 1x3 bar of another colour.
    const g = board([[3, 2, 1], [3, 3, 1], [3, 4, 1], [4, 2, 2], [4, 3, 2], [4, 4, 2]]);
    const e = emoteFor(g, [[3, 2], [3, 3], [3, 4]], 1);
    expect(e?.kind).toBe("heart");
    expect(e!.y).toBeCloseTo(3.85);
  });

  it("squeezing into a pocket between walls and others earns a bolt", () => {
    // A single cell dropped into the corner, hemmed in by two other creatures.
    const g = board([[0, 0, 3], [0, 1, 4], [1, 0, 5]]);
    expect(emoteFor(g, [[0, 0]], 3)?.kind).toBe("bolt");
  });

  it("touching its own colour doesn't count as finding a partner", () => {
    const g = board([[3, 2, 1], [3, 3, 1], [3, 4, 1], [4, 2, 1], [4, 3, 1], [4, 4, 1]]);
    expect(emoteFor(g, [[3, 2], [3, 3], [3, 4]], 1)).toBeNull();
  });
});
