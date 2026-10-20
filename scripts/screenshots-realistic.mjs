// Realistic-mode audit: overview plus every system focused, at the chosen quality.
// Usage: node scripts/screenshots-realistic.mjs <outDir> [baseUrl] [quality]
import { chromium } from '@playwright/test';
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const out = process.argv[2] || 'shots';
const base = process.argv[3] || 'http://localhost:4173';
const quality = process.argv[4] || 'high';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(`${base}/?intro=0&quality=${quality}`);
await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 60000 });
await p.waitForTimeout(3000);
await p.click('[data-testid=mode-realistic]');
await p.waitForTimeout(2500);
if (!only) await p.screenshot({ path: `${out}/realistic-overview.png` });
const ids = only || ['dp-console-001', 'ibs-001', 'bow-thruster-001', 'hpr-001', 'deployment-001', 'radascan-001', 'cyscan-001', 'dgps-001', 'tautwire-001', 'sprintnav-001'];
for (const id of ids) {
  await p.click(`[data-testid=tree-${id}]`);
  await p.waitForFunction((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused'; }, id, { timeout: 45000 });
  await p.waitForTimeout(2500);
  // Hide the hover glow by moving the pointer off the canvas.
  await p.mouse.move(5, 5);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/realistic-${id}.png` });
}
console.log('errors:', JSON.stringify(logs));
await b.close();
