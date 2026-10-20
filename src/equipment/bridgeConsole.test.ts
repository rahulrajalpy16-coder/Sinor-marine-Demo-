import { describe, expect, it } from 'vitest';
import { AFT_CONSOLE, CONSOLE_DEPTH, CONSOLE_PROFILE, CONSOLE_TOP, FWD_CONSOLE, consolePoint } from './bridgeConsole';
import { WHEELHOUSE_AFT_Z, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';

describe('bridge consoles', () => {
  it('keep the console top at or below 1.2 m so the view over them is kept (SOLAS V/22, MSC/Circ.982)', () => {
    expect(Math.max(...CONSOLE_PROFILE.map(([, y]) => y))).toBeLessThanOrEqual(CONSOLE_TOP);
    expect(CONSOLE_TOP).toBeLessThanOrEqual(1.2);
    expect(Math.max(...CONSOLE_PROFILE.map(([d]) => d))).toBeCloseTo(CONSOLE_DEPTH, 6);
  });

  it('stand inside the wheelhouse, clear of the front and aft walls', () => {
    for (const s of FWD_CONSOLE) {
      for (const along of [-s.length / 2, s.length / 2]) {
        const [, , zBack] = consolePoint(s, along, 0, 0);
        const [, , zFront] = consolePoint(s, along, CONSOLE_DEPTH, 0);
        expect(zBack).toBeLessThan(WHEELHOUSE_FRONT_Z - 0.125);
        expect(zFront).toBeLessThan(zBack);
      }
    }
    for (const s of AFT_CONSOLE) {
      const [, , zBack] = consolePoint(s, 0, 0, 0);
      expect(zBack).toBeGreaterThan(WHEELHOUSE_AFT_Z + 0.125);
      expect(Math.abs(s.x) + s.length / 2).toBeLessThan(3.5 - 0.125);
    }
  });

  it('face the operator: forward console aft, aft console forward', () => {
    const c = FWD_CONSOLE.find((s) => s.name === 'fwd-centre')!;
    expect(consolePoint(c, 0, 1, 0)[2]).toBeLessThan(c.z);
    for (const s of AFT_CONSOLE) expect(consolePoint(s, 0, 1, 0)[2]).toBeGreaterThan(s.z);
  });

  it('wings follow the chamfered front corners and mirror each other', () => {
    const [p, , st] = FWD_CONSOLE;
    expect(p.x).toBeCloseTo(-st.x, 6);
    expect(p.z).toBeCloseTo(st.z, 6);
    expect(Math.abs(st.x) + st.length / 2).toBeLessThan(7.2);
  });
});
