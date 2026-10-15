import { chromium } from '@playwright/test';
// Equipment indicators at overview, intermediate and close-up distances, on desktop and phone.
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const out = process.argv[2] || 'screenshots';
const base = process.argv[3] || 'http://localhost:4173';
const logs = [];
for (const [tag, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const p = await b.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await p.goto(base + '/?intro=0&quality=medium');
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45000 });
  await p.waitForTimeout(3000);
  const shown = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^=hotspot-label-]')].filter((e) => e.dataset.shown === 'true').map((e) => e.textContent));
  await p.screenshot({ path: `${out}/50-indicators-overview-${tag}.png` });
  console.log(tag, 'overview', JSON.stringify(await p.evaluate(() => window.__SINOR__.camera())), await shown());
  if (!mobile) {
    await p.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(120); }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/51-indicators-intermediate-${tag}.png` });
    console.log(tag, 'mid', JSON.stringify(await p.evaluate(() => window.__SINOR__.camera())), await shown());
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(120); }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/52-indicators-close-${tag}.png` });
    console.log(tag, 'close', JSON.stringify(await p.evaluate(() => window.__SINOR__.camera())), await shown());
  }
  await p.close();
}
console.log('errors:', JSON.stringify(logs));
await b.close();
