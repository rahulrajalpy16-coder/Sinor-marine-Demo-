import { writeFileSync } from 'node:fs';
import { consistencyRun } from './consistency';

describe('consistency reference scenario (test H input)', () => {
  it('is deterministic and exercises the generator trip, sensor failure and recovery', () => {
    const a = consistencyRun();
    const b = consistencyRun();
    expect(b).toEqual(a);
    expect(a.events.some((e) => e.includes('G1 tripped'))).toBe(true);
    expect(a.samples.length).toBe(61);
    // The vessel stays within a few metres: a manageable failure with two sets per side.
    expect(Math.max(...a.samples.map((s) => s.posErr))).toBeLessThan(5);
    // CONSISTENCY_OUT=file writes the Node result for packaging/tests/consistency-compare.cjs.
    if (process.env.CONSISTENCY_OUT) writeFileSync(process.env.CONSISTENCY_OUT, JSON.stringify(a));
  });
});
