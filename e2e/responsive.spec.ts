import { expect, test, type Page } from '@playwright/test';

/* Responsive shell and shared mouse/touch/keyboard input across device classes. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S = (page: Page, fn: string, arg?: string): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(([f, a]) => (window as any).__SINOR__[f as string](a), [fn, arg] as const);

async function boot(page: Page, query = '?intro=0') {
  await page.goto('/' + query);
  await page.waitForFunction(() => !!(window as unknown as { __SINOR__?: unknown }).__SINOR__, null, { timeout: 45_000 });
  await expect.poll(async () => (await S(page, 'sample')).lit, { timeout: 30_000 }).toBeGreaterThan(200);
}

const cam = async (page: Page) => (await S(page, 'camera')).position as number[];
const dist = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
const waitFocused = (page: Page, id: string) =>
  expect.poll(async () => {
    const s = await S(page, 'state');
    return `${s.selectedId}:${s.phase}`;
  }, { timeout: 20_000 }).toBe(`${id}:focused`);

async function canvasSize(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const r = c.getBoundingClientRect();
    return { cssW: Math.round(r.width), cssH: Math.round(r.height), bufW: c.width, bufH: c.height };
  });
}

test.describe('desktop', () => {
  test('keyboard orbits, zooms and returns to the overview', async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'desktop');
    await expect(page.getByTestId('systems-panel')).toBeVisible();
    const p0 = await cam(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Math.hypot(...(await cam(page)).map((v, i) => v - p0[i]))).toBeGreaterThan(5);
    await expect(page.getByTestId('camera-mode')).toHaveText('Free orbit');
    const d1 = dist(await cam(page));
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await expect.poll(async () => dist(await cam(page))).toBeLessThan(d1 - 5);
    await page.keyboard.press('Home');
    await expect(page.getByTestId('camera-mode')).toHaveText('Overview');
    await expect.poll(async () => Math.hypot(...(await cam(page)).map((v, i) => v - p0[i])), { timeout: 10_000 }).toBeLessThan(0.5);
  });

  test('orbiting by dragging across a system does not re-select it', async ({ page }) => {
    await boot(page, '?intro=0&quality=low');
    await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
    // Inside the bridge the consoles fill the view, so every drag starts and ends on them.
    await page.getByTestId('tree-ibs-001').click();
    await waitFocused(page, 'ibs-001');
    const seq = (await S(page, 'state')).cameraRequest.seq;
    const pt = await S(page, 'project', 'ibs-001');
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x + 40, pt.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const st = await S(page, 'state');
    expect(st.cameraRequest.seq).toBe(seq); // no refocus flight was requested
    expect(st.phase).toBe('focused');
    // A genuine click still works.
    await page.getByTestId('tree-bow-thruster-001').click();
    await waitFocused(page, 'bow-thruster-001');
  });

  test('the chosen quality is remembered for the next visit', async ({ page }) => {
    await boot(page);
    await page.getByTestId('quality').selectOption('high');
    expect((await S(page, 'state')).quality).toBe('high');
    await boot(page);
    expect((await S(page, 'state')).quality).toBe('high');
    await expect(page.getByTestId('quality')).toHaveValue('high');
    await page.evaluate(() => localStorage.clear());
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('tap a system in 3D, bottom sheet resizes, view menu holds the modes', async ({ page }) => {
    await boot(page, '?intro=0&quality=low');
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'mobile');
    await page.addStyleTag({ content: '[data-testid^="hotspot-"]{display:none!important}' });
    // Modes live in the View menu on phones.
    await expect(page.getByTestId('mode-xray')).toHaveCount(0);
    await page.getByTestId('view-menu-toggle').tap();
    await page.getByTestId('mode-xray').tap();
    await page.getByTestId('view-menu-toggle').tap();
    const pt = await S(page, 'project', 'bow-thruster-001');
    await page.touchscreen.tap(pt.x, pt.y);
    await waitFocused(page, 'bow-thruster-001');
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toHaveAttribute('data-snap', 'half');
    await expect(page.getByTestId('inspector-title')).toHaveText('Bow Tunnel Thruster');
    const h1 = (await sheet.boundingBox())!.height;
    await page.getByTestId('sheet-handle').tap();
    await expect(sheet).toHaveAttribute('data-snap', 'full');
    await expect.poll(async () => (await sheet.boundingBox())!.height).toBeGreaterThan(h1 + 100);
    // Touch targets are finger sized.
    const ret = (await page.getByTestId('action-return').boundingBox())!;
    expect(ret.height).toBeGreaterThanOrEqual(43);
    await page.getByTestId('action-return').tap();
    await expect(sheet).toHaveCount(0);
  });

  test('one-finger drag orbits and two-finger pinch zooms', async ({ page }) => {
    await boot(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const p0 = await cam(page);
    await touch('touchStart', [[200, 600]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[200 - i * 15, 600]]);
    await touch('touchEnd', []);
    await expect.poll(async () => Math.hypot(...(await cam(page)).map((v, i) => v - p0[i]))).toBeGreaterThan(5);
    await expect(page.getByTestId('camera-mode')).toHaveText('Free orbit');
    const d0 = dist(await cam(page));
    await touch('touchStart', [[180, 420], [210, 450]]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [[180 - i * 10, 420 - i * 12], [210 + i * 10, 450 + i * 12]]);
    await touch('touchEnd', []);
    await expect.poll(async () => dist(await cam(page))).toBeLessThan(d0 - 5);
  });

  test('rotating the phone resizes the canvas and keeps the selection', async ({ page }) => {
    await boot(page);
    await page.getByTestId('tree-toggle').tap();
    await page.getByTestId('tree-dp-console-001').tap();
    await waitFocused(page, 'dp-console-001');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await canvasSize(page)).cssW).toBe(844);
    const s = await canvasSize(page);
    expect(s.cssH).toBeLessThanOrEqual(390);
    expect(s.bufW).toBeGreaterThanOrEqual(s.cssW * 0.7); // drawing buffer follows (DPR may be scaled down)
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'mobile');
    expect((await S(page, 'state')).selectedId).toBe('dp-console-001');
    // Landscape phone: details move to a side drawer so the 3D view keeps its height.
    await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
    await expect(page.getByTestId('inspector')).toBeVisible();
    await expect(page.getByTestId('inspector-collapse')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await canvasSize(page)).cssW).toBe(390);
    await expect(page.getByTestId('bottom-sheet')).toBeVisible();
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });

  test('collapsible systems and details panels; portrait uses the bottom sheet', async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'tablet');
    await expect(page.getByTestId('systems-panel')).toHaveCount(0);
    await page.getByTestId('tree-toggle').tap();
    await page.getByTestId('tree-bow-thruster-001').tap();
    await waitFocused(page, 'bow-thruster-001');
    await expect(page.getByTestId('systems-panel')).toHaveCount(0); // closes after a pick
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.getByTestId('inspector-collapse').tap();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await page.getByTestId('inspector-expand').tap();
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.getByTestId('bottom-sheet')).toBeVisible();
    await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-snap', 'peek');
  });
});
