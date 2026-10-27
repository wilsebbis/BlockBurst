/**
 * The piece catalogue: the shapes a Block Blast-style tray deals. Every shape is fixed (pieces never rotate in
 * play), drawn as ASCII art so the table reads like the pieces themselves. Weights set how often the generator
 * offers each shape; the generator, not the catalogue, decides which tray you actually get.
 */
export interface Shape {
  id: string;
  /** Cells as [row, col] from the top-left of the shape's bounding box. */
  cells: [number, number][];
  w: number;
  h: number;
  /** Bitmask per shape row, bit c set for column c (column 0 is bit 0). */
  rowMasks: number[];
  size: number;
  weight: number;
  /** 'small' pieces (1–2 cells) get rarer as a Classic run goes on; 'big' ones (5+) more common. */
  tier: 'small' | 'mid' | 'big';
}

function shape(id: string, art: string, weight: number): Shape {
  const lines = art
    .trim()
    .split('/')
    .map((l) => l.trim());
  const cells: [number, number][] = [];
  lines.forEach((line, r) => [...line].forEach((ch, c) => ch === '#' && cells.push([r, c])));
  const h = lines.length;
  const w = Math.max(...lines.map((l) => l.length));
  const rowMasks = lines.map((line) => [...line].reduce((m, ch, c) => (ch === '#' ? m | (1 << c) : m), 0));
  const size = cells.length;
  return { id, cells, w, h, rowMasks, size, weight, tier: size <= 2 ? 'small' : size >= 5 ? 'big' : 'mid' };
}

export const SHAPES: Shape[] = [
  shape('dot', '#', 1.5),
  shape('i2h', '##', 2.5),
  shape('i2v', '#/#', 2.5),
  shape('i3h', '###', 3.5),
  shape('i3v', '#/#/#', 3.5),
  shape('i4h', '####', 3),
  shape('i4v', '#/#/#/#', 3),
  shape('i5h', '#####', 2),
  shape('i5v', '#/#/#/#/#', 2),
  shape('o2', '##/##', 4),
  shape('o3', '###/###/###', 1.6),
  shape('r23', '###/###', 1.8),
  shape('r32', '##/##/##', 1.8),
  // Small corners (3 cells).
  shape('c3a', '##/#.', 2.2),
  shape('c3b', '##/.#', 2.2),
  shape('c3c', '#./##', 2.2),
  shape('c3d', '.#/##', 2.2),
  // L and J (4 cells), every orientation.
  shape('l4a', '#./#./##', 1.4),
  shape('l4b', '###/#..', 1.4),
  shape('l4c', '##/.#/.#', 1.4),
  shape('l4d', '..#/###', 1.4),
  shape('j4a', '.#/.#/##', 1.4),
  shape('j4b', '#../###', 1.4),
  shape('j4c', '##/#./#.', 1.4),
  shape('j4d', '###/..#', 1.4),
  // Big corners (5 cells).
  shape('c5a', '###/#../#..', 1.3),
  shape('c5b', '###/..#/..#', 1.3),
  shape('c5c', '#../#../###', 1.3),
  shape('c5d', '..#/..#/###', 1.3),
  // T (4 cells).
  shape('t4a', '###/.#.', 1.4),
  shape('t4b', '.#./###', 1.4),
  shape('t4c', '#./##/#.', 1.4),
  shape('t4d', '.#/##/.#', 1.4),
  // S and Z (4 cells).
  shape('s4h', '.##/##.', 1.2),
  shape('z4h', '##./.##', 1.2),
  shape('s4v', '#./##/.#', 1.2),
  shape('z4v', '.#/##/#.', 1.2),
  // Diagonals.
  shape('d2a', '#./.#', 0.8),
  shape('d2b', '.#/#.', 0.8),
  shape('d3a', '#../.#./..#', 0.5),
  shape('d3b', '..#/.#./#..', 0.5),
];

const BY_ID = new Map(SHAPES.map((s) => [s.id, s]));

export function shapeById(id: string): Shape {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown shape ${id}`);
  return s;
}

/** Block colours 1–7. 0 is an empty cell. The palette itself lives in the skins, so a colour is only an index. */
export const COLOURS = 7;
