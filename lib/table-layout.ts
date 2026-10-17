/** Portrait coordinates are CSS-only overrides; expanded tables retain the existing layout. */
export function portraitPositions(count: number): number[][] {
  if (count === 2) return [[50, 81], [14, 39]];
  if (count === 5) return [[50, 81], [13, 67], [13, 38], [87, 38], [87, 67]];
  if (count === 6) return [[50, 81], [13, 70], [12, 52], [15, 34], [85, 34], [88, 61]];
  if (count === 9) return [[50, 82], [13, 74], [12, 60], [12, 46], [16, 32], [84, 32], [88, 46], [88, 60], [87, 74]];
  return Array.from({ length: count }, (_, i) => i === 0 ? [50, 81] : [i <= count / 2 ? 13 : 87, 34 + (i % Math.ceil(count / 2)) * 14]);
}
