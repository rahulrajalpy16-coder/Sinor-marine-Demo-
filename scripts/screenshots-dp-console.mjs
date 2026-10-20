// DP console to drawing 5000-501092: close-up in every view mode, the exploded view and a phone.
// Usage: node scripts/screenshots-dp-console.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const out = process.argv[2] || 'shots';
const base = process.argv[3] || 'http://localhost:4173';
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const open = async (viewport, opts = {}, quality = 'high') => {
  const p = await b.newPage({ viewport, ...opts });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await p.goto(`${base}/?intro=0&quality=${quality}`);
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  return p;
};
const focus = (p, id) => p.waitForFunction((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused'; }, id, { timeout: 45000 });
const p = await open({ width: 1440, height: 900 });
await p.click('[data-testid=mode-realistic]');
await p.click('[data-testid=tree-dp-console-001]');
await focus(p, 'dp-console-001');
await p.waitForTimeout(1500);
// Orbit a little to the operator's side and zoom in on the pedestals.
await p.mouse.move(660, 520); await p.mouse.down(); await p.mouse.move(600, 500, { steps: 10 }); await p.mouse.up();
await p.mouse.move(700, 560);
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(250); }
await p.mouse.move(5, 5);
await p.waitForTimeout(2000);
await p.screenshot({ path: `${out}/70-dp-console-realistic.png` });
for (const m of ['hybrid', 'blueprint', 'xray']) {
  await p.click(`[data-testid=mode-${m}]`);
  await p.mouse.move(5, 5);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/71-dp-console-${m}.png` });
}
await p.click('[data-testid=mode-exploded]');
await p.mouse.move(5, 5);
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/72-dp-console-exploded.png` });
await p.close();
const m = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true }, 'medium');
await m.tap('[data-testid=view-menu-toggle]');
await m.locator('[data-testid=view-menu] [data-testid=mode-realistic]').tap();
await m.tap('[data-testid=view-menu-toggle]');
await m.waitForTimeout(1500);
await m.screenshot({ path: `${out}/73-phone-realistic-overview.png` });
console.log('errors:', JSON.stringify(logs));
await b.close();
