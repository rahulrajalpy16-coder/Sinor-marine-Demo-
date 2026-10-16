import { describe, expect, it } from 'vitest';
import { LEVEL } from '../vessels/vesselLayout';
import { VR_DECKS, VR_SPAWN, isWalkable } from './vrDecks';

describe('VR walkable decks', () => {
  it('spawns the visitor on a walkable deck', () => {
    expect(isWalkable(VR_SPAWN.position)).toBe(true);
  });

  it('keeps every deck inside the hull beam', () => {
    for (const d of VR_DECKS) {
      expect(d.half).toBeLessThan(10);
      expect(d.z0).toBeLessThan(d.z1);
    }
  });

  it('rejects points outboard, in mid-air and below the deck', () => {
    expect(isWalkable([12, LEVEL.main, -20])).toBe(false);
    expect(isWalkable([0, LEVEL.main + 3, -20])).toBe(false);
    expect(isWalkable([0, 0, -20])).toBe(false);
  });

  it('accepts the bridge floor and the helideck', () => {
    expect(isWalkable([0, LEVEL.bridge, 15])).toBe(true);
    expect(isWalkable([0, LEVEL.helideck, 33.4])).toBe(true);
  });
});
