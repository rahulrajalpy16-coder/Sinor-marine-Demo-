import {
  applyPowerCommand,
  batteryKWh,
  driveAvailable,
  initialPowerState,
  POWER_CONFIG,
  PowerCommandRejected,
  stepPower,
  thrusterKW,
  thrustForKW,
  type PowerCommand,
  type PowerDemand,
  type PowerState,
} from './power';

const DT = 0.1;
const run = (s: PowerState, seconds: number, demand?: PowerDemand) => {
  for (let t = 0; t < seconds - 1e-9; t += DT) s = stepPower(s, DT, demand);
  return s;
};
const cmd = (s: PowerState, ...c: PowerCommand[]) => c.reduce((a, x) => applyPowerCommand(a, x), s);
const gen = (s: PowerState, id: string) => s.gens.find((g) => g.id === id)!;
const ups = (s: PowerState, id: string) => s.ups.find((u) => u.id === id)!;
const island = (s: PowerState, bus: string) => s.islands.find((i) => i.buses.includes(bus as never))!;
const AZ = POWER_CONFIG.drives.find((d) => d.id === 'AZ1')!;
const BT = POWER_CONFIG.drives.find((d) => d.id === 'BT2')!;
/** All four thrusters asking for (and delivering) a given fraction of their maximum thrust. */
const thrust = (frac: number): PowerDemand => {
  const cmdN = { AZ1: 250e3 * frac, AZ2: 250e3 * frac, BT1: 105e3 * frac, BT2: 105e3 * frac };
  return { cmdN, forceN: cmdN, running: { AZ1: true, AZ2: true, BT1: true, BT2: true } };
};

describe('thruster power relationship', () => {
  it('follows P ∝ T^1.5 for the azimuths and inverts exactly', () => {
    // Independent check: full thrust needs rated/η + idle; half thrust needs 0.5^1.5 = 35.4 % of rated shaft power.
    expect(thrusterKW(AZ, 250e3)).toBeCloseTo(1800 / 0.96 + 27, 6);
    expect(thrusterKW(AZ, 125e3)).toBeCloseTo((1800 * 0.5 ** 1.5) / 0.96 + 27, 6);
    for (const f of [10e3, 80e3, 200e3]) expect(thrustForKW(AZ, thrusterKW(AZ, f))).toBeCloseTo(f, 0);
    for (const f of [5e3, 50e3, 100e3]) expect(thrustForKW(BT, thrusterKW(BT, f))).toBeCloseTo(f, -1);
  });
});

describe('PMS: topology and load flow', () => {
  it('starts on station with G1 and G3 online, bus tie open, every section live', () => {
    const s = run(initialPowerState(), 2, thrust(0.2));
    expect(gen(s, 'G1').state).toBe('online');
    expect(gen(s, 'G3').state).toBe('online');
    expect(s.ties.MSB_TIE.closed).toBe(false);
    for (const b of ['MSB_A', 'MSB_B', 'DB_A', 'DB_B', 'ESB'] as const) expect(s.buses[b].live).toBe(true);
    expect(s.buses.MSB_A.hz).toBeCloseTo(60, 0);
    expect(s.islands.filter((i) => i.capacityKW > 0)).toHaveLength(2);
  });

  it('balances generation against consumption plus transformer losses (tolerance 1e-6 kW)', () => {
    let s = initialPowerState();
    for (const f of [0.1, 0.4, 0.7]) {
      s = run(s, 20, thrust(f));
      expect(Math.abs(s.balance.genKW - s.balance.loadKW - s.balance.lossKW)).toBeLessThan(1e-6);
      const sumGen = s.gens.reduce((a, g) => a + g.kw, 0);
      expect(sumGen).toBeCloseTo(s.balance.genKW, 6);
      // Load sharing by rating: G1 carries island A, G3 island B.
      expect(gen(s, 'G1').kw).toBeCloseTo(island(s, 'MSB_A').loadKW, 6);
    }
  });

  it('derives kVA, current and power factor from the same kW/kVAr', () => {
    const s = run(initialPowerState(), 5, thrust(0.3));
    const g = gen(s, 'G1');
    const kva = Math.hypot(g.kw, g.kvar);
    expect(kva).toBeGreaterThan(g.kw);
    const i = (kva * 1000) / (Math.sqrt(3) * g.v);
    expect(i).toBeGreaterThan(0);
    expect(island(s, 'MSB_A').pf).toBeCloseTo(g.kw / kva, 6);
  });
});

describe('PMS: interlocks', () => {
  it('rejects closing an unsynchronised generator on to a live bus, and allows SYNC & CLOSE', () => {
    let s = cmd(initialPowerState(), { type: 'gen-mode', id: 'G2', mode: 'MANUAL' }, { type: 'gen-start', id: 'G2' });
    s = run(s, 9);
    expect(gen(s, 'G2').state).toBe('running');
    expect(() => applyPowerCommand(s, { type: 'gen-close', id: 'G2' })).toThrow(PowerCommandRejected);
    expect(() => applyPowerCommand(s, { type: 'gen-close', id: 'G2' })).toThrow(/Synchronising check failed/);
    s = cmd(s, { type: 'gen-sync-close', id: 'G2' });
    s = run(s, 2);
    expect(gen(s, 'G2').breaker).toBe(false); // still synchronising
    expect(gen(s, 'G2').state).toBe('synchronising');
    s = run(s, 4);
    expect(gen(s, 'G2').state).toBe('online');
    expect(gen(s, 'G2').breaker).toBe(true);
  });

  it('permits dead-bus closing only on a dead, healthy bus', () => {
    let s = cmd(initialPowerState(), { type: 'pms-auto', on: false }, { type: 'gen-trip', id: 'G1' });
    s = run(s, 1);
    expect(s.buses.MSB_A.live).toBe(false);
    expect(gen(s, 'G1').kw).toBe(0);
    s = cmd(s, { type: 'gen-start', id: 'G2' });
    expect(() => applyPowerCommand(s, { type: 'gen-close', id: 'G2' })).toThrow(/not ready/);
    s = run(s, 9);
    s = cmd(s, { type: 'gen-close', id: 'G2' });
    expect(gen(s, 'G2').breaker).toBe(true);
    expect(s.buses.MSB_A.live).toBe(true);
  });

  it('a tripped generator contributes no output and needs a reset before it can start', () => {
    let s = cmd(initialPowerState('2' as never, 'two-per-bus'), { type: 'gen-trip', id: 'G2' });
    s = run(s, 5, thrust(0.3));
    expect(gen(s, 'G2').kw).toBe(0);
    expect(gen(s, 'G2').breaker).toBe(false);
    expect(() => applyPowerCommand(s, { type: 'gen-start', id: 'G2' })).toThrow(/reset the trip/);
    s = cmd(s, { type: 'gen-reset', id: 'G2' }, { type: 'gen-start', id: 'G2' });
    expect(gen(s, 'G2').state).toBe('starting');
  });

  it('inhibits stopping the only generator on a loaded bus', () => {
    const s = run(initialPowerState(), 2, thrust(0.2));
    expect(() => applyPowerCommand(s, { type: 'gen-stop', id: 'G1' })).toThrow(/only generator/);
  });

  it('never parallels the emergency generator with the main supply, or two live sections through transformers', () => {
    const s = run(initialPowerState(), 1);
    expect(() => applyPowerCommand(s, { type: 'tie-close', id: 'DB_TIE' })).toThrow(/parallel two live sections/);
    expect(() => applyPowerCommand(s, { type: 'gen-sync-close', id: 'EG' })).toThrow();
    expect(() => applyPowerCommand(s, { type: 'tie-close', id: 'MSB_TIE' })).toThrow(/Synchronising check failed/);
    let t = cmd(s, { type: 'tie-sync-close', id: 'MSB_TIE' });
    t = run(t, 6);
    expect(t.ties.MSB_TIE.closed).toBe(true);
    expect(t.islands.find((i) => i.buses.includes('MSB_A'))!.buses).toContain('MSB_B');
  });
});

describe('PMS: protection, load management and recovery', () => {
  it('limits thruster power to the available generation (phase-back) instead of overloading', () => {
    // One 1700 kW set per side cannot run AZ1 + BT1 flat out (≈ 1900 + 900 kW).
    const s = run(initialPowerState(), 3, thrust(1));
    const a = island(s, 'MSB_A');
    expect(a.loadPct).toBeLessThanOrEqual(POWER_CONFIG.pms.phaseBackPct + 0.5);
    expect(s.alarms).toContain('PHASE_BACK:MSB_A');
    const az1 = s.drives.find((d) => d.id === 'AZ1')!;
    expect(az1.limitN).toBeLessThan(250e3);
    expect(s.balance.unmetKW).toBeGreaterThan(0);
    expect(gen(s, 'G1').state).toBe('online');
  });

  it('starts the standby generator on sustained high load after the configured delay, and shares load', () => {
    let s = run(initialPowerState(), 9, thrust(0.75));
    expect(island(s, 'MSB_A').loadPct).toBeGreaterThan(85);
    expect(gen(s, 'G2').state).toBe('stopped');
    s = run(s, 2, thrust(0.75));
    expect(gen(s, 'G2').state).toBe('starting');
    s = run(s, 8 + 5 + 12, thrust(0.75));
    expect(gen(s, 'G2').state).toBe('online');
    expect(gen(s, 'G2').kw).toBeCloseTo(gen(s, 'G1').kw, 0);
    // The events show start → running → synchronised close in that order.
    const ev = s.events.filter((e) => e.src === 'G2').map((e) => e.text);
    expect(ev.findIndex((t) => /start/.test(t))).toBeLessThan(ev.findIndex((t) => /running at rated/.test(t)));
    expect(ev.findIndex((t) => /running at rated/.test(t))).toBeLessThan(ev.findIndex((t) => /synchronised/.test(t)));
  });

  it('does not oscillate: a steady load gives at most one start and no stop over an hour', () => {
    let s = initialPowerState();
    let starts = 0;
    let stops = 0;
    let prev = s.events.length;
    for (let t = 0; t < 3600; t += 10) {
      s = run(s, 10, thrust(0.62));
      s.events.slice(prev).forEach((e) => {
        if (/ start:/.test(e.text)) starts++;
        if (/ stop:/.test(e.text)) stops++;
      });
      prev = s.events.length;
    }
    expect(starts).toBeLessThanOrEqual(2); // at most one per side
    expect(stops).toBe(0);
  });

  it('stops a lightly loaded set only when the remaining sets stay below the limit', () => {
    // DP mode keeps two per section; with the minimum set to one the PMS may stop a set.
    const dpMode = run(initialPowerState(2, 'two-per-bus'), 200, thrust(0.05));
    expect(dpMode.gens.filter((g) => g.state === 'online')).toHaveLength(4);
    let s = cmd(initialPowerState(2, 'two-per-bus'), { type: 'min-online', section: 'A', value: 1 }, { type: 'min-online', section: 'B', value: 1 });
    s = run(s, 130, thrust(0.05));
    expect(s.gens.filter((g) => g.state === 'unloading' || g.state === 'cooldown' || g.state === 'stopped').length).toBeGreaterThanOrEqual(2);
    s = run(s, 60, thrust(0.05));
    expect(gen(s, 'G1').state).toBe('online');
    expect(gen(s, 'G3').state).toBe('online');
  });

  it('runs blackout recovery in sequence after the only generator on a section trips', () => {
    let s = run(initialPowerState(), 2, thrust(0.2));
    s = cmd(s, { type: 'gen-trip', id: 'G1' });
    s = run(s, 0.5, thrust(0.2));
    expect(s.buses.MSB_A.live).toBe(false);
    expect(s.drives.find((d) => d.id === 'AZ1')!.status).toBe('tripped');
    expect(driveAvailable(s, 'AZ1')).toBe(false);
    expect(s.buses.MSB_B.live).toBe(true); // open bus tie: side B unaffected
    s = run(s, 1, thrust(0.2));
    expect(s.alarms).toContain('BLACKOUT:MSB_A');
    expect(gen(s, 'G2').state).toBe('starting');
    s = run(s, 9, thrust(0.2));
    expect(gen(s, 'G2').breaker).toBe(true); // dead-bus closing
    s = run(s, 40, thrust(0.2));
    expect(driveAvailable(s, 'AZ1')).toBe(true);
    expect(driveAvailable(s, 'BT1')).toBe(true);
    expect(s.recovery.A.stage).toBe('normal');
    const order = ['tripped', 'Blackout', 'G2 start', 'dead-bus', 'restarting consumers', 'drive ready', 'recovery complete'];
    const idx = order.map((k) => s.events.findIndex((e) => e.text.includes(k)));
    idx.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('without phase-back a generator trip cascades into a full section blackout (overload protection)', () => {
    let s = cmd(initialPowerState(2, 'two-per-bus'), { type: 'phase-back', on: false });
    s = run(s, 15, thrust(0.95));
    s = cmd(s, { type: 'gen-trip', id: 'G1' });
    s = run(s, 8, thrust(0.95));
    expect(gen(s, 'G2').state).toBe('tripped');
    expect(gen(s, 'G2').tripReason).toMatch(/overload/);
    // With phase-back the same trip is survived.
    let p = run(initialPowerState(2, 'two-per-bus'), 15, thrust(0.95));
    p = cmd(p, { type: 'gen-trip', id: 'G1' });
    p = run(p, 8, thrust(0.95));
    expect(gen(p, 'G2').state).toBe('online');
  });

  it('sheds loads by priority when the plant stays overloaded, and reconnects them with hysteresis', () => {
    let s = cmd(initialPowerState(), { type: 'pms-auto', on: false });
    s = run(s, 1, thrust(0));
    const before = s.feeders.filter((f) => f.shed).length;
    expect(before).toBe(0);
    // Disable phase-back so thrusters push the island over 100 %.
    s = cmd(s, { type: 'phase-back', on: false });
    s = run(s, 3, thrust(0.98));
    const shed = s.feeders.filter((f) => f.shed).map((f) => f.id);
    expect(shed[0]).toBe('HOTEL_A');
    s = cmd(s, { type: 'pms-auto', on: true }, { type: 'phase-back', on: true });
    // Reconnection: most important first (crane, tugger before hotel), one every reconnect delay.
    s = run(s, 25, thrust(0.1));
    expect(s.feeders.find((f) => f.id === 'CRANE')!.shed).toBe(false);
    expect(s.feeders.find((f) => f.id === 'HOTEL_A')!.shed).toBe(true);
    s = run(s, 4 * POWER_CONFIG.pms.reconnectDelayS, thrust(0.1));
    expect(s.feeders.filter((f) => f.shed)).toHaveLength(0);
  });

  it('a busbar fault isolates its section and the dependent consumers; the emergency generator takes the ESB', () => {
    let s = run(initialPowerState(), 2, thrust(0.2));
    s = cmd(s, { type: 'bus-fault', bus: 'MSB_A' });
    s = run(s, 0.5, thrust(0.2));
    expect(gen(s, 'G1').state).toBe('tripped');
    expect(s.buses.MSB_A.live).toBe(false);
    expect(s.buses.DB_A.live).toBe(false);
    expect(s.buses.MSB_B.live).toBe(true);
    expect(ups(s, 'UPS_A').mode).toBe('battery');
    expect(ups(s, 'UPS_B').mode).toBe('normal');
    // Recovery must not close a generator on to the faulted bus.
    s = run(s, 20, thrust(0.2));
    expect(gen(s, 'G2').breaker).toBe(false);
    expect(s.buses.ESB.live).toBe(true);
    expect(gen(s, 'EG').breaker).toBe(true);
    expect(s.ties.ESB_FEED.closed).toBe(false);
    // Clear the fault: PMS restores section A, then returns the ESB to the main supply after the delay.
    s = cmd(s, { type: 'bus-fault-clear', bus: 'MSB_A' });
    s = run(s, 60, thrust(0.2));
    expect(s.buses.MSB_A.live).toBe(true);
    expect(s.ties.ESB_FEED.closed).toBe(true);
    expect(gen(s, 'EG').breaker).toBe(false);
  });

  it('models the shared auxiliary dependency: losing 440 V board A trips G1 after the ride-through unless re-fed', () => {
    let s = run(initialPowerState(), 2, thrust(0.2));
    s = cmd(s, { type: 'tie-trip', id: 'TR_A' });
    s = run(s, 1, thrust(0.2));
    expect(s.alarms).toContain('AUX_LOST:G1');
    expect(driveAvailable(s, 'AZ1')).toBe(false); // steering pumps on DB-A
    s = run(s, POWER_CONFIG.pms.genAuxRideThroughS, thrust(0.2));
    expect(gen(s, 'G1').state).toBe('tripped');
    // Same failure, but the operator closes the 440 V interconnector to feed DB-A from side B in time.
    let r = run(initialPowerState(), 2, thrust(0.2));
    r = cmd(r, { type: 'tie-trip', id: 'TR_A' });
    r = run(r, 5, thrust(0.2));
    r = cmd(r, { type: 'tie-close', id: 'DB_TIE' });
    r = run(r, 120, thrust(0.2));
    expect(gen(r, 'G1').state).toBe('online');
    expect(driveAvailable(r, 'AZ1')).toBe(true);
  });
});

describe('DP UPS', () => {
  const loadA = () => {
    const s = run(initialPowerState(), 1);
    return ups(s, 'UPS_A').loadKW;
  };

  it('maps consumers to their UPS and splits dual-fed loads', () => {
    const s = run(initialPowerState(), 1);
    const sum = Object.values(POWER_CONFIG.consumers)
      .filter((c) => c.supplies.includes('UPS_A'))
      .reduce((a, c) => a + c.kw / c.supplies.length, 0);
    expect(ups(s, 'UPS_A').loadKW).toBeCloseTo(sum, 9);
    expect(ups(s, 'UPS_C').installed).toBe(false);
  });

  it('transfers to battery on input loss and discharges at load/η (energy accounting)', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'ups-fault', id: 'UPS_A', kind: 'rectifier', on: true });
    const E = batteryKWh(ups(s, 'UPS_A'));
    const load = loadA();
    s = run(s, 600);
    const u = ups(s, 'UPS_A');
    expect(u.mode).toBe('battery');
    const expectedSoc = 1 - (load / 0.93) * (600 / 3600) / E;
    expect(u.soc).toBeCloseTo(expectedSoc, 3);
    expect(u.battA).toBeGreaterThan(0);
    expect(u.runtimeMin!).toBeCloseTo((E * u.soc * 0.93 * 60) / load, 6);
    expect(s.consumers.DP_CTRL_A).toBe(true);
    expect(s.alarms).toContain('UPS_BATT:UPS_A');
  });

  it('meets 30 minutes at full rated load (ABS DPS guide 3/9 sizing check, demonstration battery)', () => {
    const u = POWER_CONFIG.ups[0];
    const minutes = ((batteryKWh({ id: 'UPS_A', soh: 1 }) * u.inverterEff) / (u.ratedKVA * u.pf)) * 60;
    expect(minutes).toBeGreaterThanOrEqual(30);
  });

  it('raises low and critical battery in order, then loses only the consumers it feeds', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'ups-fault', id: 'UPS_A', kind: 'rectifier', on: true }, { type: 'ups-soh', id: 'UPS_A', value: 0.2 });
    let lowAt = -1;
    let critAt = -1;
    let offAt = -1;
    for (let t = 0; t < 3 * 3600 && offAt < 0; t += 10) {
      s = run(s, 10);
      if (lowAt < 0 && s.alarms.includes('UPS_LOW:UPS_A')) lowAt = t;
      if (critAt < 0 && s.alarms.includes('UPS_CRIT:UPS_A')) critAt = t;
      if (offAt < 0 && ups(s, 'UPS_A').mode !== 'battery') offAt = t;
    }
    expect(lowAt).toBeGreaterThan(0);
    expect(critAt).toBeGreaterThan(lowAt);
    expect(offAt).toBeGreaterThan(critAt);
    // Bypass supply (DB-A) is live, so on depletion the UPS transfers to static bypass and the load stays fed.
    expect(ups(s, 'UPS_A').mode).toBe('static-bypass');
    expect(s.consumers.DP_CTRL_A).toBe(true);
  });

  it('with input and bypass both dead, depletion de-energises only UPS A consumers', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'bus-fault', bus: 'DB_A' }, { type: 'ups-soh', id: 'UPS_A', value: 0.1 });
    for (let t = 0; t < 3600 && ups(s, 'UPS_A').mode === 'battery'; t += 5) s = run(s, 5);
    expect(ups(s, 'UPS_A').mode).toBe('off');
    expect(s.consumers.DP_CTRL_A).toBe(false);
    expect(s.consumers.GNSS1).toBe(false);
    expect(s.consumers.AZ1_CTRL).toBe(false);
    expect(s.consumers.DP_CTRL_C).toBe(true); // dual-fed
    expect(s.consumers.GYRO3).toBe(true);
    expect(s.consumers.GNSS2).toBe(true);
    expect(s.alarms).toContain('REDUNDANCY:UPS A');
  });

  it('inverter fault goes to static bypass only when the bypass source is live', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'ups-fault', id: 'UPS_B', kind: 'inverter', on: true });
    s = run(s, 1);
    expect(ups(s, 'UPS_B').mode).toBe('static-bypass');
    expect(s.consumers.GNSS2).toBe(true);
    s = cmd(s, { type: 'bus-fault', bus: 'DB_B' });
    s = run(s, 1);
    expect(ups(s, 'UPS_B').mode).toBe('off');
    expect(s.consumers.GNSS2).toBe(false);
  });

  it('recharges after the input is restored', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'ups-fault', id: 'UPS_A', kind: 'rectifier', on: true });
    s = run(s, 1200);
    const low = ups(s, 'UPS_A').soc;
    s = cmd(s, { type: 'ups-fault', id: 'UPS_A', kind: 'rectifier', on: false });
    s = run(s, 600);
    expect(ups(s, 'UPS_A').mode).toBe('normal');
    expect(ups(s, 'UPS_A').soc).toBeGreaterThan(low);
    expect(ups(s, 'UPS_A').battA).toBeLessThan(0);
  });

  it('reproduces the IMCA DPE 04/18 case: selector on EMERGENCY + ESB loss drains UPS A', () => {
    let s = run(initialPowerState(), 1);
    s = cmd(s, { type: 'ups-selector', id: 'UPS_A', selector: 'EMERG' }, { type: 'tie-trip', id: 'ESB_FEED' }, { type: 'gen-mode', id: 'EG', mode: 'MANUAL' });
    s = run(s, 5);
    expect(s.alarms).toContain('UPS_SEL_EMERG:UPS_A');
    expect(ups(s, 'UPS_A').mode).toBe('battery');
  });
});
