import { chromium } from '@playwright/test';
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const out = process.argv[2] || 'screenshots';
const base = process.argv[3] || 'http://localhost:4173';
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
const focused = (id) => p.waitForFunction((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused'; }, id, { timeout: 30000 });
const text = (tid, t) => p.waitForFunction(([x, y]) => document.querySelector(`[data-testid=${x}]`)?.textContent === y, [tid, t], { timeout: 90000 });
await p.goto(base + '/?intro=0&quality=medium');
await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 45000 }); await p.waitForTimeout(2000);

await p.click('[data-testid=tree-radascan-001]'); await focused('radascan-001');
await p.click('[data-testid=radascan-start]'); await text('radascan-hmi-status', 'TRACKING');
await p.click('[data-testid=radascan-dp-select]'); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/40-radascan.png` });

await p.click('[data-testid=tree-cyscan-001]'); await focused('cyscan-001');
await p.click('[data-testid=cyscan-start]'); await text('cyscan-hmi-status', 'TRACKING');
await p.click('[data-testid=cyscan-dp-select]'); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/41-cyscan.png` });

await p.click('[data-testid=tree-dgps-001]'); await focused('dgps-001'); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/42-dgps-seastar.png` });

await p.click('[data-testid=tree-tautwire-001]'); await focused('tautwire-001'); await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/43a-taut-wire-recovered.png` });
await p.selectOption('[data-testid=tw-speed]', '20');
await p.click('[data-testid=tw-deploy]'); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/43-taut-wire-lowering.png` });
await text('tautwire-hmi-status', 'ON BOTTOM · TENSIONED');
await p.click('[data-testid=tautwire-dp-select]'); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/43b-taut-wire-on-bottom.png` });

await p.click('[data-testid=tree-sprintnav-001]'); await focused('sprintnav-001'); await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/44-sprintnav-stowed.png` });
await p.selectOption('[data-testid=sn-speed]', '20');
await p.click('[data-testid=sprintnav-power]');
await p.click('[data-testid=pole-deploy]');
await text('sprintnav-hmi-status', 'REFERENCE OK');
await p.click('[data-testid=sprintnav-dp-select]'); await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/45-sprintnav-deployed.png` });

await p.click('[data-testid=reset-overview]'); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/46-references-overview.png` });
await p.click('[data-testid=mode-xray]'); await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/47-references-xray.png` });
await p.click('[data-testid=mode-hybrid]');
await p.click('[data-testid=tree-dp-console-001]'); await focused('dp-console-001'); await p.waitForTimeout(600);
const dp = await p.evaluate(() => window.__SINOR__.dp().refs.map(r => [r.id, r.installed, r.enabled, r.ready]));
console.log('dp refs', JSON.stringify(dp));
await p.screenshot({ path: `${out}/48-dp-references.png` });
console.log('errors:', JSON.stringify(logs));
await b.close();
