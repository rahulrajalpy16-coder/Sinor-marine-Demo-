import { navScore, pickNext, type Box } from './spatialNav';

const b = (x: number, y: number, w = 40, h = 20): Box => ({ x, y, w, h });

describe('D-pad spatial navigation', () => {
  const grid = [b(0, 0), b(60, 0), b(120, 0), b(0, 40), b(60, 40), b(120, 40)];
  it('moves to the neighbour in each direction', () => {
    const from = grid[4];
    const others = grid.filter((g) => g !== from);
    const name = (i: number) => others[i];
    expect(name(pickNext(from, others, 'left'))).toBe(grid[3]);
    expect(name(pickNext(from, others, 'right'))).toBe(grid[5]);
    expect(name(pickNext(from, others, 'up'))).toBe(grid[1]);
  });
  it('returns -1 at an edge', () => {
    expect(pickNext(grid[0], grid.slice(1).filter((g) => g.x === 0 && g.y < 0), 'up')).toBe(-1);
    expect(navScore(grid[2], grid[1], 'right')).toBeNull();
  });
  it('prefers an item in line over a nearer diagonal one', () => {
    const from = b(0, 100);
    const inLine = b(0, 200);
    const diagonal = b(150, 140);
    expect(pickNext(from, [diagonal, inLine], 'down')).toBe(1);
  });
});
