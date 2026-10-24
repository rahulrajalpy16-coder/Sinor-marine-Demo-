// Test I (browser targets): runs the exhibition demo for N minutes in a browser engine and samples frame rate, memory,
// scene drawing and errors once a minute, then leaves the demo and checks the simulator is back to normal.
// Usage: node endurance-browser.cjs <URL | folder of built web assets> <minutes> <out.json>
// A folder is served from the Android WebView's virtual origin with every other request refused.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [SRC, MIN, OUT] = process.argv.slice(2);
const minutes = Number(MIN);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const blocked = [];
  let url = SRC;
  if (!/^https?:/.test(SRC)) {
    const root = path.resolve(SRC);
    url = 'https://appassets.androidplatform.net/index.html';
    await ctx.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.host !== 'appassets.androidplatform.net') { blocked.push(u.href); return route.abort(); }
      const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!f.startsWith(root) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      const ext = f.split('.').pop();
      route.fulfill({ status: 200, contentType: { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[ext] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'tv=1&intro=0&demo=1');
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 90000 });
  const samples = [];
  const t0 = Date.now();
  for (let m = 1; m <= minutes; m++) {
    await p.waitForTimeout(Math.max(0, t0 + m * 60000 - Date.now() - 5000));
    const s = await p.evaluate(() => new Promise((res) => {
      let n = 0; const start = performance.now();
      const f = () => { n++; if (performance.now() - start < 5000) requestAnimationFrame(f); else res({
        fps: +(n / ((performance.now() - start) / 1000)).toFixed(1),
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        lit: window.__SINOR__.sample().lit,
        demo: !!document.querySelector('[data-testid="demo-overlay"]'),
        events: window.__SINOR__.power().events.length,
      }); };
      requestAnimationFrame(f);
    }));
    samples.push({ minute: m, ...s, errors: errors.length });
    console.log(JSON.stringify(samples.at(-1)));
    fs.writeFileSync(OUT, JSON.stringify({ samples }, null, 2));
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(2000);
  const after = await p.evaluate(() => ({ demo: !!document.querySelector('[data-testid="demo-overlay"]'), alarms: window.__SINOR__.power().alarms, lit: window.__SINOR__.sample().lit }));
  const heaps = samples.map((s) => s.heapMB).filter((x) => x != null);
  const pass = samples.length === minutes && samples.every((s) => s.demo && s.lit > 300) && errors.length === 0 && !after.demo && after.alarms.length === 0 && blocked.length === 0;
  const result = { pass, minutes, samples, after, errors, blocked, heapGrowthMB: heaps.length ? heaps.at(-1) - heaps[0] : null, minFps: Math.min(...samples.map((s) => s.fps)) };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('pass', pass, 'minFps', result.minFps, 'heapGrowthMB', result.heapGrowthMB);
  await b.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
