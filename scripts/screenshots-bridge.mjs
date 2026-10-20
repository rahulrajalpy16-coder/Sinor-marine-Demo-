// Screenshots for the taut wire move, the HPT 5000 at rest behind the open seachest door, the DP2 bridge
// consoles and DP chairs with IJS, and all references in use. Run against `vite preview` (port 4173).
import { chromium } from '@playwright/test';
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const out = process.argv[2] || 'screenshots';
const base = process.argv[3] || 'http://localhost:4173';
const logs = [];
async function page(w = 1440, h = 900, query = '') {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) logs.push(m.text()); });
  await p.goto(`${base}/?intro=0&quality=medium${query}`);
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45000 });
  await p.waitForTimeout(2000);
  return p;
}
const focus = async (p, id) => {
  await p.evaluate((i) => window.__SINOR__.state().select(i), id);
  await p.waitForFunction((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused'; }, id, { timeout: 30000 });
  await p.waitForTimeout(1500);
};
const mode = (p, m) => p.evaluate((x) => window.__SINOR__.state().setVisualMode(x), m);
const status = (p, t) => p.waitForFunction((x) => document.querySelector('[data-testid=hpr-status]')?.textContent === x, t, { timeout: 60000 });

// Taut wire at the new position (on station: boom out, weight on the seabed).
let p = await page();
await mode(p, 'realistic');
await focus(p, 'tautwire-001');
await p.screenshot({ path: `${out}/80-taut-wire-new-position.png` });
await p.close();

// Phone overview of the starboard side, as in the marked-up image.
p = await page(390, 844);
await mode(p, 'realistic');
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/81-phone-overview-taut-wire.png` });
await p.close();

// HPT 5000 at rest: retracted, gate valve closed, seachest door open.
p = await page(1440, 900, '&start=stowed');
await mode(p, 'realistic');
await focus(p, 'deployment-001');
await p.click('[data-testid=hpr-door]');
await status(p, 'DOOR OPEN');
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/82-hpt5000-at-rest-door-open.png` });
await p.close();

// Forward and aft bridge consoles, DP chairs with IJS.
p = await page();
await mode(p, 'realistic');
await focus(p, 'ibs-001');
await p.screenshot({ path: `${out}/83-bridge-forward-console.png` });
await focus(p, 'dp-console-001');
await p.screenshot({ path: `${out}/84-bridge-aft-dp-station-chairs.png` });
// All references connected and in use.
await p.click('[data-testid=dp-start]');
await p.click('[data-testid=dp-tab-redundancy]');
await p.locator('[data-testid=dp-ref-SPRINTNAV]').scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/85-dp-references-all-in-use.png` });
await p.close();

console.log('errors:', JSON.stringify(logs));
await b.close();
