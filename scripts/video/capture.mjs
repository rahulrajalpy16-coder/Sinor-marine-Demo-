// Captures the exhibition demo footage. The page runs on slowed time (every clock and timer K times slower),
// so the software renderer reaches a smooth frame rate in app time; the recording is sped back up by K in
// assemble.sh. Each narration segment lasts at least as long as its voice-over (durations.json), and the
// start of every segment is written to timeline.json in app-time seconds.
// Usage: node capture.mjs <outDir> <durations.json> [baseUrl] [K]
import { chromium } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';

const [, , out, durFile, baseArg, kArg] = process.argv;
const base = baseArg || 'http://localhost:4173';
const K = Number(kArg || 10);
const durations = JSON.parse(readFileSync(durFile, 'utf8'));
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: out, size: { width: W, height: H } } });

// Slowed time: performance.now, Date.now, rAF timestamps and timer delays all run K times slower.
await ctx.addInitScript((k) => {
  const pNow = performance.now.bind(performance);
  const dNow = Date.now;
  const p0 = pNow();
  const d0 = dNow();
  const warp = (t) => p0 + (t - p0) / k;
  performance.now = () => warp(pNow());
  Date.now = () => d0 + (pNow() - p0) / k;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => cb(warp(t)));
  const st = window.setTimeout.bind(window);
  const si = window.setInterval.bind(window);
  window.setTimeout = (fn, d, ...a) => st(fn, (d || 0) * k, ...a);
  window.setInterval = (fn, d, ...a) => si(fn, (d || 0) * k, ...a);
  // Pointer for the viewer.
  const css = `#demo-cursor{position:fixed;z-index:2147483647;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
    border:2px solid #fff;background:rgba(47,214,255,.30);box-shadow:0 0 14px rgba(47,214,255,.9);pointer-events:none;left:-60px;top:-60px}
    #demo-cursor.down{background:rgba(47,214,255,.85);width:20px;height:20px;margin:-10px 0 0 -10px}`;
  const add = () => {
    if (document.getElementById('demo-cursor')) return;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add);
  else add();
}, K);

const p = await ctx.newPage();
const t0 = Date.now();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
const appNow = () => (Date.now() - t0) / 1000 / K;
const wait = (appSec) => p.waitForTimeout(appSec * 1000 * K);
let mouse = { x: W / 2, y: H / 2 };
const glide = async (x, y, appSec = 0.45) => {
  const steps = 14;
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const e = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
    await p.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await p.waitForTimeout((appSec * 1000 * K) / steps);
  }
  mouse = { x, y };
};
const tap = async (testid, { after = 0.5, last = false } = {}) => {
  const loc = last ? p.getByTestId(testid).last() : p.getByTestId(testid).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await wait(0.12);
  await loc.click();
  await wait(after);
};
const select = async (testid, value) => {
  const loc = p.getByTestId(testid).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await glide(b.x + b.width / 2, b.y + b.height / 2, 0.35);
  await loc.selectOption(value);
  await wait(0.3);
};
const type = async (testid, value) => {
  await tap(testid, { after: 0.1 });
  await p.getByTestId(testid).first().fill(String(value));
  await p.getByTestId(testid).first().press('Enter');
  await wait(0.3);
};
const until = (fn, arg, appTimeout = 60) => p.waitForFunction(fn, arg, { timeout: appTimeout * 1000 * K, polling: 200 });
const text = (tid, t) => until(([x, y]) => document.querySelector(`[data-testid=${x}]`)?.textContent === y, [tid, t]);
const focused = (id) =>
  until((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused' && !s.cameraMoving; }, id, 20);
const focus = async (id) => {
  await tap(`tree-${id}`, { after: 0.1 });
  await focused(id);
  await wait(0.3);
};
const drag = async (dx, dy, appSec = 1.6) => {
  await glide(W / 2, H / 2, 0.3);
  await p.mouse.down();
  await glide(W / 2 + dx, H / 2 + dy, appSec);
  await p.mouse.up();
};
const zoom = async (dy, times, appSec = 1.2) => {
  for (let i = 0; i < times; i++) {
    await p.mouse.wheel(0, dy);
    await p.waitForTimeout((appSec * 1000 * K) / times);
  }
};

const timeline = {};
/** Runs a narrated segment and pads it to its voice-over length (plus a short breath). */
const segment = async (id, fn, pad = 0.7) => {
  const start = appNow();
  timeline[id] = start;
  console.log('segment', id, start.toFixed(2));
  await fn();
  const left = durations[id] + pad - (appNow() - start);
  if (left > 0) await wait(left);
};

await p.goto(base + '/?quality=low');
await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 120000 * K });

await segment('intro', async () => {
  await until(() => !window.__SINOR__.state().introActive, null, 30).catch(() => {});
}, 1.2);
await segment('overview', async () => {
  await drag(-420, 0, 2.6);
  await wait(0.3);
  await glide(W / 2, H / 2, 0.2);
  await zoom(-200, 8, 1.6);
  await wait(1.2);
  await zoom(200, 8, 1.2);
  await tap('reset-overview', { after: 1.2 });
});
await segment('modes', async () => {
  await tap('mode-realistic', { after: 1.4 });
  await tap('mode-blueprint', { after: 1.4 });
  await tap('mode-xray', { after: 1.6 });
  await tap('mode-hybrid', { after: 0.4 });
});
await segment('ibs', async () => {
  await focus('ibs-001');
  await wait(1.5);
  await tap('action-inspect', { after: 1.5 });
});
await segment('thruster', async () => {
  await focus('bow-thruster-001');
  await type('thrust-input', 0);
  await tap('thruster-start', { after: 0.2 });
  await text('thruster-status', 'running');
  await type('thrust-input', -70);
  await wait(2.2);
  await type('thrust-input', 60);
  await wait(1.6);
  await tap('action-explode', { after: 2.4 });
  await tap('action-explode', { after: 0.6 });
  await tap('thruster-reset', { after: 0.2 });
}, 0.3);
await segment('dp', async () => {
  await focus('dp-console-001');
  await select('dp-speed', '20');
  await tap('dp-start', { after: 1.2 });
  await tap('dp-tab-thrusters', { after: 0.5 });
  await tap('dp-bt1-take', { after: 1.5 });
  await tap('dp-tab-redundancy', { after: 0.6 });
  await tap('dp-fail-ctrl-A', { after: 2.0 });
  await tap('dp-fail-ctrl-A', { after: 0.4 });
  await tap('dp-tab-position', { after: 1.0 });
});
await segment('hpr', async () => {
  await focus('deployment-001');
  await select('hpr-speed', '20');
  await tap('hpr-valve-open', { after: 0.6 });
  await tap('hpr-deploy', { after: 0.2 });
  await text('hpr-status', 'DEPLOYED');
  await tap('hpr-signals', { after: 0.4 });
  await focus('hpr-001');
  await wait(1.5);
}, 0.4);
await segment('relative', async () => {
  await focus('radascan-001');
  await tap('radascan-start', { after: 0.2 });
  await text('radascan-hmi-status', 'TRACKING');
  await tap('radascan-dp-select', { after: 1.0 });
  await focus('cyscan-001');
  await tap('cyscan-start', { after: 0.2 });
  await text('cyscan-hmi-status', 'TRACKING');
  await tap('cyscan-dp-select', { after: 0.6 });
  await tap('cyscan-fog', { after: 2.2 });
  await tap('cyscan-fog', { after: 0.3 });
}, 0.3);
await segment('absolute', async () => {
  await focus('dgps-001');
  await wait(1.2);
  await focus('tautwire-001');
  await select('tw-speed', '20');
  await tap('tw-deploy', { after: 0.3 });
  await text('tautwire-hmi-status', 'ON BOTTOM · TENSIONED');
  await tap('tautwire-dp-select', { after: 0.8 });
}, 0.3);
await segment('sprintnav', async () => {
  await focus('sprintnav-001');
  await select('sn-speed', '20');
  await tap('sprintnav-power', { after: 0.3 });
  await tap('pole-deploy', { after: 0.2 });
  await text('sprintnav-hmi-status', 'REFERENCE OK');
  await tap('sprintnav-dp-select', { after: 0.8 });
}, 0.3);
await segment('dpall', async () => {
  await focus('dp-console-001');
  await tap('dp-tab-redundancy', { after: 0.5 });
  await tap('dp-drift-TAUTWIRE', { after: 0.2 });
  await until(() => window.__SINOR__.dp().refs.find((r) => r.id === 'TAUTWIRE')?.rejected, null, 60).catch(() => {});
  await wait(1.5);
  await tap('dp-drift-TAUTWIRE', { after: 0.3 });
});
await segment('outro', async () => {
  await tap('reset-overview', { after: 1.0 });
  await glide(W / 2, H / 2, 0.3);
  await p.mouse.down();
  await glide(W / 2 - 300, H / 2, 4.0);
  await p.mouse.up();
}, 3.0);
timeline.end = appNow();

await ctx.close();
renameSync(await p.video().path(), `${out}/footage.webm`);
writeFileSync(`${out}/timeline.json`, JSON.stringify({ K, ...timeline }, null, 1));
await browser.close();
console.log('done', timeline.end.toFixed(1), 's of app time');
