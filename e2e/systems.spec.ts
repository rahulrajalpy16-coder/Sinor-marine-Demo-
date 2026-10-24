import { expect, test, type Page } from '@playwright/test';

/** Test F: the power, UPS, wind and sensor systems in the 3D view and their HMIs, against the shared state. */

type W = Window & {
  __SINOR__: {
    project: (id: string) => { x: number; y: number } | null;
    sample: () => { lit: number };
    state: () => { selectedId: string | null; phase: string; select: (id: string) => void };
    power: () => {
      time: number;
      alarms: string[];
      gens: { id: string; state: string; kw: number; breaker: boolean }[];
      buses: Record<string, { live: boolean }>;
    };
    wind: () => { sensors: { status: string }[]; actual: { speedKn: number } };
    dp: () => { status: string; windFF: { valid: boolean } };
  };
  __sinorBack?: () => boolean;
};

const errors: string[] = [];
async function boot(page: Page, query = '?intro=0&quality=low') {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + query);
  await page.waitForFunction(() => !!(window as unknown as W).__SINOR__, null, { timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__SINOR__.sample().lit), { timeout: 30_000 }).toBeGreaterThan(200);
}
const S = (page: Page) => page.evaluate(() => (window as unknown as W).__SINOR__.state());
const power = (page: Page) => page.evaluate(() => (window as unknown as W).__SINOR__.power());
const waitFocused = (page: Page, id: string) =>
  expect.poll(async () => {
    const s = await S(page);
    return `${s.selectedId}:${s.phase}`;
  }, { timeout: 20_000 }).toBe(`${id}:focused`);

for (const [id, title, hmi] of [
  ['pms-001', 'Power Management System', 'pms-hmi'],
  ['gensets-001', 'Main Diesel Generators G1 to G4', 'pms-hmi'],
  ['msb-001', 'Main Switchboard and Bus Tie', 'pms-hmi'],
  ['emergency-gen-001', 'Emergency Generator and Switchboard', 'pms-hmi'],
  ['ups-001', 'DP UPS A, B and C', 'ups-hmi'],
  ['wind-001', 'Wind Sensors', 'wind-hmi'],
  ['gyro-mru-001', 'Gyrocompasses and MRUs', 'sensors-hmi'],
  ['azimuth-001', 'Stern Azimuth Thrusters', 'az-hmi'],
] as const) {
  test(`clicking the ${title} in the 3D scene opens its HMI`, async ({ page }) => {
    await boot(page);
    await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
    await page.getByTestId('mode-xray').click();
    const pt = (await page.evaluate((i) => (window as unknown as W).__SINOR__.project(i), id))!;
    await page.mouse.click(pt.x, pt.y);
    await waitFocused(page, id);
    await expect(page.getByTestId('inspector-title')).toHaveText(title);
    await expect(page.getByTestId(hmi)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('PMS shows the shared state, enforces the synchronising interlock and synchronises a standby set', async ({ page }) => {
  await boot(page);
  await page.getByTestId('tree-pms-001').click();
  await waitFocused(page, 'pms-001');
  await page.getByTestId('pms-tab-gen').click();
  // Freeze, then the displayed G1 power must equal the model value.
  await page.getByTestId('sim-controls-open').click();
  await page.getByTestId('sim-freeze').click();
  await page.getByTestId('sim-controls-close').click();
  const p = await power(page);
  const g1 = p.gens.find((g) => g.id === 'G1')!;
  await expect(page.getByTestId('pms-gen-G1-kw')).toContainText(`${g1.kw.toFixed(0)} /`);
  await page.getByTestId('sim-controls-open').click();
  await page.getByTestId('sim-freeze').click();
  await page.getByTestId('sim-controls-close').click();
  // G2 is the standby set (one set per side). Start it, then try to close it onto the live bus without synchronising.
  await page.getByTestId('pms-gen-G2-start').click();
  await expect.poll(async () => (await power(page)).gens.find((g) => g.id === 'G2')!.state, { timeout: 20_000 }).toBe('running');
  await page.getByTestId('pms-gen-G2-close').click();
  await expect(page.getByTestId('hmi-rejection')).toContainText(/synchronis/i);
  expect((await power(page)).gens.find((g) => g.id === 'G2')!.breaker).toBe(false);
  await page.getByTestId('pms-gen-G2-sync').click();
  await expect.poll(async () => (await power(page)).gens.find((g) => g.id === 'G2')!.breaker, { timeout: 20_000 }).toBe(true);
});

test('a blackout scenario recovers automatically and Reset all restores a normal plant from any state', async ({ page }) => {
  await boot(page);
  await page.getByTestId('sim-controls-open').click();
  await page.getByTestId('sim-speed-20').click();
  await page.getByTestId('sim-scenario-blackout').click();
  await waitFocused(page, 'pms-001');
  await expect.poll(async () => (await power(page)).alarms.some((a) => a.startsWith('BLACKOUT')), { timeout: 30_000 }).toBe(true);
  await expect(page.getByTestId('pms-status')).toContainText('BLACKOUT');
  // Automatic recovery brings section A back.
  await expect.poll(async () => (await power(page)).buses.MSB_A.live, { timeout: 40_000 }).toBe(true);
  // Now break things further and freeze, then Reset all.
  await page.getByTestId('pms-tab-faults').click();
  await page.getByTestId('pms-fault-bus-MSB_B').click();
  await page.getByTestId('sim-controls-open').click();
  await page.getByTestId('sim-freeze').click();
  await page.getByTestId('sim-reset-all').click();
  await page.getByTestId('sim-controls-close').click();
  const p = await power(page);
  expect(p.alarms).toEqual([]);
  expect(Object.values(p.buses).every((b) => b.live)).toBe(true);
  await expect.poll(async () => (await power(page)).time, { timeout: 10_000 }).toBeGreaterThan(1); // not frozen any more
  expect((await S(page)).selectedId).toBeNull();
});

test('UPS goes on battery when its 440 V board is lost and the consumer map follows', async ({ page }) => {
  await boot(page);
  await page.getByTestId('tree-ups-001').click();
  await waitFocused(page, 'ups-001');
  await expect(page.getByTestId('ups-UPS_A-mode')).toContainText('NORMAL');
  await page.evaluate(() => (window as unknown as W).__SINOR__.state().select('pms-001'));
  await page.getByTestId('pms-tab-faults').click();
  await page.getByTestId('pms-fault-trip-TR_A').click();
  await page.evaluate(() => (window as unknown as W).__SINOR__.state().select('ups-001'));
  await expect(page.getByTestId('ups-UPS_A-mode')).toContainText('ON BATTERY');
  await expect(page.getByTestId('ups-consumer-DP_OS1')).toHaveAttribute('data-powered', 'true');
  await expect(page.getByTestId('ups-UPS_A-runtime')).toContainText('min');
});

test('wind sensor failure leaves the physical wind and switches the DP feed-forward off', async ({ page }) => {
  await boot(page);
  await page.getByTestId('tree-wind-001').click();
  await waitFocused(page, 'wind-001');
  await page.getByTestId('wind-speed-30').click();
  await page.getByTestId('wind-WS1-fault-fail').click();
  await page.getByTestId('wind-WS2-fault-fail').click();
  await expect(page.getByTestId('wind-status')).toContainText('NO VALID SENSOR', { timeout: 20_000 });
  await expect(page.getByTestId('wind-ff')).toContainText('OFF');
  const w = await page.evaluate(() => (window as unknown as W).__SINOR__.wind());
  expect(w.actual.speedKn).toBeGreaterThan(15); // the real wind is still there
});

test('exhibition demo runs with a caption and exits on Escape back to a reset simulator', async ({ page }) => {
  await boot(page);
  await page.getByTestId('sim-controls-open').click();
  await page.getByTestId('demo-start').click();
  await expect(page.getByTestId('demo-overlay')).toBeVisible();
  await expect(page.getByTestId('demo-title')).not.toBeEmpty();
  await expect.poll(async () => (await S(page)).selectedId).not.toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('demo-overlay')).toBeHidden();
  expect((await power(page)).alarms).toEqual([]);
});

test('damaged saved scenarios are reported and set aside, valid ones still load', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('sinor.scenarios', '{"schema":2,"items":[');
    }
  });
  await boot(page);
  await page.getByTestId('sim-controls-open').click();
  await expect(page.getByTestId('sim-note')).toContainText('damaged');
  await page.getByTestId('sim-save-name').fill('Good one');
  await page.getByTestId('sim-save').click();
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as W).__SINOR__, null, { timeout: 45_000 });
  await page.getByTestId('sim-controls-open').click();
  await expect(page.getByTestId('sim-controls')).toContainText('Good one');
  await page.getByTestId('sim-load').first().click();
  await expect(page.getByTestId('sim-note')).toContainText('Loaded');
  expect(await page.evaluate(() => localStorage.getItem('sinor.scenarios.damaged'))).toContain('"schema":2');
});

test('TV mode: the D-pad moves the focus, OK presses, Back closes, camera buttons orbit', async ({ page }) => {
  await boot(page, '?intro=0&quality=low&tv=1');
  await expect(page.getByTestId('tv-camera-pad')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  const first = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
  await page.keyboard.press('ArrowRight');
  const second = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
  expect(first).not.toBe('BODY');
  expect(second).not.toBe(first);
  await page.getByTestId('sim-controls-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sim-controls')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as W).__sinorBack!())).toBe(true);
  await expect(page.getByTestId('sim-controls')).toBeHidden();
  const before = await page.evaluate(() => (window as unknown as { __SINOR__: { camera: () => { position: number[] } } }).__SINOR__.camera().position);
  await page.getByTestId('cam-ArrowLeft').click();
  const after = await page.evaluate(() => (window as unknown as { __SINOR__: { camera: () => { position: number[] } } }).__SINOR__.camera().position);
  expect(Math.hypot(...before.map((v, i) => v - after[i]))).toBeGreaterThan(0.1);
});
