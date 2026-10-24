// Runs the reference consistency scenario (src/simulations/consistency.ts) inside a browser build and saves the result.
// Usage: node consistency-browser.cjs <http(s) URL of the app | folder of built web assets> <out.json>
// A folder is served from a virtual origin with every other request refused, as in the offline packages.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [SRC, OUT] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  let url = SRC;
  if (!/^https?:/.test(SRC)) {
    const root = path.resolve(SRC);
    url = 'https://appassets.androidplatform.net/index.html';
    await ctx.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.host !== 'appassets.androidplatform.net') return route.abort();
      const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!f.startsWith(root) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      const ext = f.split('.').pop();
      route.fulfill({ status: 200, contentType: { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[ext] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
  }
  const p = await ctx.newPage();
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'intro=0&quality=low');
  await p.waitForFunction(() => !!window.__SINOR__ && typeof window.__SINOR__.consistency === 'function', null, { timeout: 90000 });
  const r = await p.evaluate(() => window.__SINOR__.consistency());
  fs.writeFileSync(OUT, JSON.stringify(r));
  console.log('wrote', OUT, r.samples.length, 'samples');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
