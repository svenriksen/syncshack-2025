export function houseCoords(cols: number, rows: number) {
  if (cols < 2 || rows < 2) return [] as { x: number; y: number }[];
  const cx0 = Math.floor(cols / 2) - 1;
  const cy0 = Math.floor(rows / 2) - 1;
  return [
    { x: cx0, y: cy0 },
    { x: cx0 + 1, y: cy0 },
    { x: cx0, y: cy0 + 1 },
    { x: cx0 + 1, y: cy0 + 1 },
  ];
}

export function houseIndices(cols: number, rows: number) {
  return houseCoords(cols, rows).map(({ x, y }) => y * cols + x);
}

export function isHouse(x: number, y: number, cols: number, rows: number) {
  const list = houseCoords(cols, rows);
  return list.some((c) => c.x === x && c.y === y);
}
