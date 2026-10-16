import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __SINOR__?: {
      project: (id: string) => { x: number; y: number } | null;
      sample: () => { lit: number; cyan: number; total: number };
      state: () => {
        selectedId: string | null;
        hoveredId: string | null;
        phase: string;
        cameraMode: string;
        visualMode: string;
        cameraMoving: boolean;
        introActive: boolean;
        assetStatus: Record<string, string>;
      };
      thruster: () => { status: string; rpm: number; thrustKN: number; angle: number; command: number; pitch: number; station: string };
      dp: () => { status: string; mode: string; dpLost: boolean; eta: number[]; time: number; alarms: string[]; thrusters: { id: string; available: boolean; forceN: number }[]; refs: { id: string; ready: boolean; enabled: boolean; rejected: boolean }[] };
      hpr: () => { travel: number; valve: string; motion: string };
      posrefs: () => { tautwire: { phase: string; anchor: number[] | null }; pole: { phase: string; angleDeg: number }; cyscan: { phase: string } };
      camera: () => { position: number[] };
    };
  }
}

const errors: string[] = [];

async function boot(page: Page, query = '?intro=0') {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/' + query);
  await page.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45_000 });
  // Wait for real frames to be on the canvas.
  await expect.poll(() => page.evaluate(() => window.__SINOR__!.sample().lit), { timeout: 30_000 }).toBeGreaterThan(200);
}

const state = (page: Page) => page.evaluate(() => window.__SINOR__!.state());
/** Resolves when the camera has stopped moving (two samples 250 ms apart within 1 cm). */
async function waitCameraSettled(page: Page) {
  const cam = async () => (await page.evaluate(() => window.__SINOR__!.camera())).position;
  await expect
    .poll(async () => {
      const a = await cam();
      await page.waitForTimeout(250);
      const b = await cam();
      return Math.hypot(...a.map((v, i) => v - b[i]));
    })
    .toBeLessThan(0.01);
}

const waitFocused = (page: Page, id: string) =>
  expect.poll(async () => {
    const s = await state(page);
    return `${s.selectedId}:${s.phase}`;
  }, { timeout: 20_000 }).toBe(`${id}:focused`);

test('ship renders, uses procedural fallback for missing GLBs, and has no runtime errors', async ({ page }) => {
  await boot(page);
  const sample = await page.evaluate(() => window.__SINOR__!.sample());
  expect(sample.cyan).toBeGreaterThan(50); // hybrid cyan linework is on screen
  await expect.poll(async () => (await state(page)).assetStatus['bow-thruster-001']).toBe('procedural');
  expect((await state(page)).assetStatus['dp-console-001']).toBe('procedural');
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test('orbit drag and wheel zoom move the camera', async ({ page }) => {
  await boot(page);
  const canvas = page.locator('canvas').first();
  const box = (await canvas.boundingBox())!;
  const before = (await page.evaluate(() => window.__SINOR__!.camera())).position;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('camera-mode')).toHaveText('Free orbit');
  const afterOrbit = (await page.evaluate(() => window.__SINOR__!.camera())).position;
  expect(Math.hypot(...afterOrbit.map((v, i) => v - before[i]))).toBeGreaterThan(5);
  const dist = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -1200);
  await expect.poll(async () => dist((await page.evaluate(() => window.__SINOR__!.camera())).position)).toBeLessThan(dist(afterOrbit) - 3);
});

for (const [id, title] of [
  ['bow-thruster-001', 'Bow Tunnel Thruster'],
  ['deployment-001', 'Type 7950 Deployment Machine'],
  ['dp-console-001', 'DP System'],
  ['ibs-001', 'Integrated Bridge System'],
  ['radascan-001', 'RadaScan View · Radar'],
  ['cyscan-001', 'CyScan AS · Laser'],
] as const) {
  test(`clicking the ${title} mesh in the 3D scene opens its panel and focuses the camera`, async ({ page }) => {
    await boot(page, '?intro=0&quality=low');
    // Hide callout labels so the click lands on the canvas and goes through raycasting.
    await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
    await page.evaluate(() => window.__SINOR__!.state()); // ensure ready
    const xray = page.getByTestId('mode-xray');
    await xray.click(); // reveal interior/underwater meshes, as a user would
    const pt = (await page.evaluate((i) => window.__SINOR__!.project(i), id))!;
    await page.mouse.click(pt.x, pt.y);
    await waitFocused(page, id);
    await expect(page.getByTestId('inspector-title')).toHaveText(title);
    expect((await state(page)).cameraMode).toBe('inspection');
  });
}

test('system explorer focuses the matching equipment; return and overview always work', async ({ page }) => {
  await boot(page);
  const startCam = (await page.evaluate(() => window.__SINOR__!.camera())).position;
  await page.getByTestId('tree-hpr-001').click();
  await waitFocused(page, 'hpr-001');
  await expect(page.getByTestId('tree-hpr-001')).toHaveAttribute('aria-pressed', 'true');
  // Centre of view is now the HPR transducer.
  const pt = (await page.evaluate(() => window.__SINOR__!.project('hpr-001')))!;
  const vp = page.viewportSize()!;
  expect(Math.abs(pt.x - vp.width / 2)).toBeLessThan(40);
  expect(Math.abs(pt.y - vp.height / 2)).toBeLessThan(40);
  // Hop to another system, then Return restores the original overview pose.
  await page.getByTestId('tree-dp-console-001').click();
  await waitFocused(page, 'dp-console-001');
  await page.getByTestId('action-return').click();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await expect.poll(async () => {
    const p = (await page.evaluate(() => window.__SINOR__!.camera())).position;
    return Math.hypot(...p.map((v, i) => v - startCam[i]));
  }).toBeLessThan(0.5);
  // Overview reset from inspection and from free orbit.
  await page.getByTestId('tree-bow-thruster-001').click();
  await waitFocused(page, 'bow-thruster-001');
  await page.getByTestId('reset-overview').click();
  await expect(page.getByTestId('camera-mode')).toHaveText('Overview');
  expect((await state(page)).selectedId).toBeNull();
  // Escape key works as Return.
  await page.getByTestId('tree-hpr-001').click();
  await waitFocused(page, 'hpr-001');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inspector')).toHaveCount(0);
});

test('switching hybrid/realistic/blueprint/X-ray/isolate keeps the scene drawn, the selection and the camera', async ({ page }) => {
  await boot(page);
  await page.getByTestId('tree-bow-thruster-001').click();
  await waitFocused(page, 'bow-thruster-001');
  const cam = (await page.evaluate(() => window.__SINOR__!.camera())).position;
  for (const m of ['realistic', 'blueprint', 'xray', 'isolation', 'exploded', 'hybrid']) {
    await page.getByTestId(`mode-${m}`).click();
    await expect(page.getByTestId(`mode-${m}`)).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(400);
    const s = await state(page);
    expect(s.visualMode).toBe(m);
    expect(s.selectedId).toBe('bow-thruster-001');
    const sample = await page.evaluate(() => window.__SINOR__!.sample());
    expect(sample.lit, `scene not blank in ${m}`).toBeGreaterThan(200);
    const now = (await page.evaluate(() => window.__SINOR__!.camera())).position;
    expect(Math.hypot(...now.map((v, i) => v - cam[i]))).toBeLessThan(0.01);
  }
  // Exploded is unavailable for a non-explodable system.
  await page.getByTestId('tree-hpr-001').click();
  await expect(page.getByTestId('mode-exploded')).toBeDisabled();
});

test('thruster demonstration animates and reset stops it', async ({ page }) => {
  await boot(page);
  await page.getByTestId('hotspot-bow-thruster-001').click();
  await waitFocused(page, 'bow-thruster-001');
  await page.getByTestId('thrust-input').fill('abc');
  await page.getByTestId('thrust-input').press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'between -100 and 100' })).toBeVisible();
  await page.getByTestId('thrust-input').fill('-150');
  await page.getByTestId('thrust-input').press('Enter');
  expect((await page.evaluate(() => window.__SINOR__!.thruster())).command).toBe(-1); // clamped
  // Start interlock: lever must be at zero.
  await page.getByTestId('thruster-start').click();
  await expect(page.getByTestId('thruster-alarms')).toContainText('lever not at zero');
  await expect(page.getByTestId('thruster-status')).toHaveText('stopped');
  await page.getByTestId('thrust-input').fill('0');
  await page.getByTestId('thrust-input').press('Enter');
  await page.getByTestId('thruster-start').click();
  await expect(page.getByTestId('thruster-status')).toHaveText('running', { timeout: 15_000 });
  const a0 = (await page.evaluate(() => window.__SINOR__!.thruster())).angle;
  expect((await page.evaluate(() => window.__SINOR__!.thruster())).rpm).toBeGreaterThan(290);
  await page.getByTestId('thrust-input').fill('-100');
  await page.getByTestId('thrust-input').press('Enter');
  await expect.poll(async () => (await page.evaluate(() => window.__SINOR__!.thruster())).pitch, { timeout: 15_000 }).toBeLessThan(-0.5);
  const t = await page.evaluate(() => window.__SINOR__!.thruster());
  expect(t.thrustKN).toBeLessThan(0); // port
  expect(t.angle).not.toBe(a0);
  await expect(page.getByTestId('readout-thrust')).not.toHaveText('0.0 kN');
  expect((await state(page)).phase).toBe('simulating');
  await page.getByTestId('thruster-pause').click();
  await expect(page.getByTestId('thruster-status')).toHaveText('paused');
  await page.getByTestId('thruster-reset').click();
  await expect(page.getByTestId('thruster-status')).toHaveText('stopped');
  const r = await page.evaluate(() => window.__SINOR__!.thruster());
  expect(r.rpm).toBe(0);
  expect(r.thrustKN).toBe(0);
  await page.waitForTimeout(500);
  expect((await page.evaluate(() => window.__SINOR__!.thruster())).angle).toBe(0);
});

test('DP system: station keeping, BT1 handover, DP1 controller failure loses position', async ({ page }) => {
  await boot(page, '?intro=0&quality=low');
  await page.getByTestId('tree-dp-console-001').click();
  await waitFocused(page, 'dp-console-001');
  await expect(page.getByTestId('dp-hmi')).toBeVisible();
  await page.getByTestId('dp-speed').selectOption('20');
  await page.getByTestId('dp-start').click();
  await expect(page.getByTestId('dp-status')).toHaveText('running');
  expect((await page.evaluate(() => window.__SINOR__!.dp())).mode).toBe('AUTO_POSITION');
  // Hand BT1 from the bridge lever to DP: the Z-Thrust unit starts and DP drives its pitch.
  await page.getByTestId('dp-tab-thrusters').click();
  await page.getByTestId('dp-bt1-take').click();
  await expect.poll(async () => (await page.evaluate(() => window.__SINOR__!.thruster())).station).toBe('DP');
  await expect
    .poll(async () => (await page.evaluate(() => window.__SINOR__!.dp())).thrusters.find((t) => t.id === 'BT1')!.available, { timeout: 30_000 })
    .toBe(true);
  // Simulated time advances (20x) and the vessel holds near the setpoint.
  await expect.poll(async () => (await page.evaluate(() => window.__SINOR__!.dp())).time, { timeout: 30_000 }).toBeGreaterThan(60);
  const held = await page.evaluate(() => window.__SINOR__!.dp());
  expect(Math.hypot(held.eta[0], held.eta[1])).toBeLessThan(5);
  // DP1 has a single controller: failing it loses DP and the vessel drifts.
  await page.getByTestId('dp-class-1').click();
  await page.getByTestId('dp-start').click();
  await page.getByTestId('dp-tab-redundancy').click();
  await expect(page.getByTestId('dp-architecture')).toContainText('1 controller');
  await page.getByTestId('dp-fail-ctrl-A').click();
  await expect(page.getByTestId('dp-alarms')).toContainText('DP lost', { timeout: 15_000 });
  await expect
    .poll(async () => {
      const d = await page.evaluate(() => window.__SINOR__!.dp());
      return Math.hypot(d.eta[0], d.eta[1]);
    }, { timeout: 40_000 })
    .toBeGreaterThan(5);
  await page.getByTestId('dp-reset').click();
  await expect(page.getByTestId('dp-status')).toHaveText('stopped');
});

test('HPR: Type 7950 interlocks, deployment of the HPT 5000, and the deployed transceiver as a DP reference', async ({ page }) => {
  await boot(page, '?intro=0&quality=low');
  await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
  await page.getByTestId('tree-deployment-001').click();
  await waitFocused(page, 'deployment-001');
  await expect(page.getByTestId('hpr-status')).toHaveText('PARKED');
  await expect.poll(async () => (await page.evaluate(() => window.__SINOR__!.dp())).refs.find((r) => r.id === 'HPR')!.ready).toBe(false);
  // Interlock: no deployment through a closed gate valve.
  await page.getByTestId('hpr-deploy').click();
  await expect(page.getByTestId('hpr-error')).toContainText('gate valve');
  await page.getByTestId('hpr-speed').selectOption('20');
  await page.getByTestId('hpr-valve-open').click();
  await expect(page.getByTestId('hpr-status')).toHaveText('READY TO DEPLOY');
  await page.getByTestId('hpr-door').click();
  await expect(page.getByTestId('hpr-error')).toContainText('Close the gate valve');
  await page.getByTestId('hpr-deploy').click();
  await expect(page.getByTestId('hpr-status')).toHaveText('DEPLOYED');
  await expect(page.getByTestId('hpr-depth')).toHaveText('2.95 m');
  await page.getByTestId('hpr-valve-close').click();
  await expect(page.getByTestId('hpr-error')).toContainText('Retract');
  await page.getByTestId('hpr-signals').click();
  await expect(page.getByTestId('hpr-range')).toHaveText(/m$/);
  // Exploded view of the machine keeps the scene alive.
  await page.getByTestId('action-explode').click();
  await expect(page.getByTestId('mode-exploded')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('action-explode').click();
  // The deployed transceiver is now under the hull and can be picked in the 3D view.
  await page.getByTestId('reset-overview').click();
  await expect(page.getByTestId('camera-mode')).toHaveText('Overview');
  await page.getByTestId('mode-xray').click();
  // The mode label switches at the start of the camera flight; pick only once the camera has settled.
  await waitCameraSettled(page);
  // Hover first and wait for the pick to land: on the software renderer a frame can take longer than a
  // click, and the scene only picks on rendered frames.
  // The vessel keeps moving in the seaway, so re-project and click again if a frame-late pick missed.
  await expect(async () => {
    const p = (await page.evaluate(() => window.__SINOR__!.project('hpr-001')))!;
    await page.mouse.move(p.x, p.y);
    await expect.poll(async () => (await state(page)).hoveredId, { timeout: 3_000 }).toBe('hpr-001');
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(async () => (await state(page)).selectedId, { timeout: 3_000 }).toBe('hpr-001');
  }).toPass({ timeout: 30_000 });
  await waitFocused(page, 'hpr-001');
  await expect(page.getByTestId('inspector-title')).toHaveText('HPR · HPT 5000 USBL');
  // DP sees the HPR as ready only while deployed.
  await expect.poll(async () => (await page.evaluate(() => window.__SINOR__!.dp())).refs.find((r) => r.id === 'HPR')!.ready).toBe(true);
  await page.getByTestId('hpr-retract').click();
  await expect(page.getByTestId('hpr-status')).toHaveText('READY TO DEPLOY');
  await page.getByTestId('hpr-reset').click();
  await expect(page.getByTestId('hpr-status')).toHaveText('PARKED');
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test('position references: RadaScan, CyScan, DGPS, taut wire and SPRINT-Nav feed DP once running', async ({ page }) => {
  await boot(page, '?intro=0&quality=low');
  await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
  const ref = async (id: string) => (await page.evaluate(() => window.__SINOR__!.dp())).refs.find((r) => r.id === id)!;

  // RadaScan and CyScan lock on to the platform's responder and reflector.
  await page.getByTestId('tree-radascan-001').click();
  await waitFocused(page, 'radascan-001');
  await page.getByTestId('radascan-start').click();
  await expect(page.getByTestId('radascan-hmi-status')).toHaveText('TRACKING', { timeout: 30_000 });
  await expect(page.getByTestId('radascan-range')).toHaveText(/^\d+\.\d m$/);
  await expect(page.getByTestId('radascan-ppi')).toBeVisible();
  await page.getByTestId('radascan-dp-select').click();
  await page.getByTestId('tree-cyscan-001').click();
  await waitFocused(page, 'cyscan-001');
  await page.getByTestId('cyscan-start').click();
  await expect(page.getByTestId('cyscan-hmi-status')).toHaveText('TRACKING', { timeout: 30_000 });
  await page.getByTestId('cyscan-dp-select').click();
  // Fog blinds the laser, not the radar.
  await page.getByTestId('cyscan-fog').click();
  await expect(page.getByTestId('cyscan-hmi-status')).toHaveText('NO TARGET');
  await expect.poll(async () => (await ref('CYSCAN')).ready).toBe(false);
  expect((await ref('RADASCAN')).ready).toBe(true);
  await page.getByTestId('cyscan-fog').click();

  // DGPS: both receivers online in DP2.
  await page.getByTestId('tree-dgps-001').click();
  await waitFocused(page, 'dgps-001');
  await expect(page.getByTestId('dgps-hmi-status')).toHaveText('2 / 2 ONLINE');
  await expect(page.getByTestId('dgps-display-1')).toContainText('G4 DIFF');

  // Taut wire: weight lowered to the seabed.
  await page.getByTestId('tree-tautwire-001').click();
  await waitFocused(page, 'tautwire-001');
  await page.getByTestId('tw-speed').selectOption('20');
  await page.getByTestId('tw-deploy').click();
  await expect(page.getByTestId('tautwire-hmi-status')).toHaveText('ON BOTTOM · TENSIONED', { timeout: 60_000 });
  await expect(page.getByTestId('tw-angle')).toHaveText(/°$/);
  await expect(page.getByTestId('tw-nmea')).toHaveText(/^\$PCPTW,-?\d{3}\.\d{2},-?\d{3}\.\d{2},A,00,\d{3}\.\d\*[0-9A-F]{2}$/);
  await page.getByTestId('tautwire-dp-select').click();

  // SPRINT-Nav: deploy the pole, power and align, then select into DP.
  await page.getByTestId('tree-sprintnav-001').click();
  await waitFocused(page, 'sprintnav-001');
  await page.getByTestId('sn-speed').selectOption('20');
  await page.getByTestId('sprintnav-power').click();
  await page.getByTestId('pole-deploy').click();
  await expect(page.getByTestId('sprintnav-hmi-status')).toHaveText('REFERENCE OK', { timeout: 60_000 });
  await expect(page.getByTestId('pole-angle')).toHaveText(/90° · LOCKED/);
  await page.getByTestId('sprintnav-dp-select').click();

  // DP: all selected references ready; a drifting taut wire is voted out.
  await page.getByTestId('tree-dp-console-001').click();
  await waitFocused(page, 'dp-console-001');
  for (const id of ['GNSS1', 'GNSS2', 'RADASCAN', 'CYSCAN', 'TAUTWIRE', 'SPRINTNAV']) await expect.poll(async () => (await ref(id)).ready && (await ref(id)).enabled).toBe(true);
  await page.getByTestId('dp-start').click();
  await page.getByTestId('dp-tab-redundancy').click();
  await expect(page.getByTestId('dp-ref-TAUTWIRE')).toContainText('OK');
  await page.getByTestId('dp-drift-TAUTWIRE').click();
  await expect.poll(async () => (await ref('TAUTWIRE')).rejected, { timeout: 60_000 }).toBe(true);
  await expect(page.getByTestId('dp-ref-TAUTWIRE')).toContainText('REJECTED');
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test('intro plays, can be skipped, and reduced motion skips it', async ({ page, browser }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45_000 });
  await expect(page.getByTestId('skip-intro')).toBeVisible();
  await page.getByTestId('skip-intro').click();
  await expect(page.getByTestId('skip-intro')).toHaveCount(0);
  expect((await state(page)).introActive).toBe(false);

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p2 = await ctx.newPage();
  await p2.goto('/');
  await p2.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45_000 });
  await expect(p2.getByTestId('skip-intro')).toHaveCount(0);
  expect(await p2.evaluate(() => window.__SINOR__!.state().introActive)).toBe(false);
  await ctx.close();
});

test('keyboard-accessible equipment list', async ({ page }) => {
  await boot(page);
  const item = page.getByTestId('tree-bow-thruster-001');
  await item.focus();
  await page.keyboard.press('Enter');
  await waitFocused(page, 'bow-thruster-001');
  await expect(page.getByTestId('tree-deployment-001')).toBeEnabled();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('narrow screen: systems drawer, tap select, explicit return', async ({ page }) => {
    await boot(page);
    await page.getByTestId('tree-toggle').tap();
    await page.getByTestId('tree-hpr-001').last().tap();
    await waitFocused(page, 'hpr-001');
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.getByTestId('action-return').tap();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    const canvas = await page.locator('canvas').first().boundingBox();
    expect(canvas!.width).toBeLessThanOrEqual(390);
  });
});
