// Runs the APK's bundled web assets from the same virtual origin the Android WebView uses, with every other
// request refused (as the app has no INTERNET permission), in TV mode, and checks the D-pad / Back behaviour.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const OUT = process.argv[3];
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', json: 'application/json' };
(async () => {
  const res = { checks: [], blocked: [], errors: [] };
  const ok = (name, pass, detail) => { res.checks.push({ name, pass: !!pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail ?? ''); };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.host !== 'appassets.androidplatform.net') { res.blocked.push(u.href); return route.abort(); }
    let p = u.pathname === '/' ? '/index.html' : u.pathname;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'Not found' });
    route.fulfill({ status: 200, contentType: MIME[p.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => res.errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && res.errors.push(m.text()));
  p.on('response', (r) => r.status() === 404 && !/\/models\/[\w-]+\.glb$/.test(r.url()) && res.errors.push('404 ' + r.url()));
  const t0 = Date.now();
  await p.goto('https://appassets.androidplatform.net/index.html?tv=1&intro=0');
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 90000 });
  for (let i = 0; i < 60 && (await p.evaluate(() => window.__SINOR__.sample().lit)) < 300; i++) await p.waitForTimeout(500);
  ok('cold start from APK assets renders the 3D scene', (await p.evaluate(() => window.__SINOR__.sample().lit)) > 300, `${Date.now() - t0} ms`);
  ok('TV mode active (focus ring style, camera pad)', await p.evaluate(() => document.documentElement.classList.contains('tv-mode') && !!document.querySelector('[data-testid=tv-camera-pad]')));
  // D-pad moves the focus between controls.
  await p.keyboard.press('ArrowDown');
  const who = () => p.evaluate(() => { const e = document.activeElement; return e && e !== document.body ? `${e.tagName}:${e.getAttribute('data-testid') || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30)}` : null; });
  const a = await who();
  await p.keyboard.press('ArrowDown');
  const b2 = await who();
  ok('D-pad Down moves focus to another control', a && b2 && a !== b2, `${a} → ${b2}`);
  // OK (Enter) presses the focused control: open the simulator controls.
  await p.focus('[data-testid=sim-controls-open]');
  await p.keyboard.press('Enter');
  ok('OK opens the Simulator controls', await p.isVisible('[data-testid=sim-controls]'));
  await p.keyboard.press('ArrowDown');
  ok('D-pad stays inside the open dialog', await p.evaluate(() => !!document.activeElement?.closest('[data-testid=sim-controls]')));
  ok('Back closes the dialog (handled by the app)', (await p.evaluate(() => window.__sinorBack())) === true && !(await p.isVisible('[data-testid=sim-controls]')));
  await p.evaluate(() => window.__SINOR__.state().select('pms-001'));
  await p.waitForTimeout(2500);
  ok('Back leaves a selected system', (await p.evaluate(() => window.__sinorBack())) === true);
  await p.waitForTimeout(2500);
  ok('Back with nothing open lets Android leave the app', (await p.evaluate(() => window.__sinorBack())) === false);
  // Camera pad: orbit button moves the camera.
  const c0 = await p.evaluate(() => window.__SINOR__.camera().position);
  await p.click('[data-testid="cam-ArrowLeft"]');
  await p.waitForTimeout(300);
  const c1 = await p.evaluate(() => window.__SINOR__.camera().position);
  ok('on-screen camera button orbits', Math.hypot(...c0.map((v, i) => v - c1[i])) > 0.1);
  // Local persistence survives an app restart.
  await p.click('[data-testid=sim-controls-open]');
  await p.fill('[data-testid=sim-save-name]', 'TV check');
  await p.click('[data-testid=sim-save]');
  await p.reload();
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 90000 });
  await p.click('[data-testid=sim-controls-open]');
  ok('saved scenario survives a restart', (await p.textContent('[data-testid=sim-controls]')).includes('TV check'));
  await p.screenshot({ path: path.join(OUT, 'apk-assets-tv.png') });
  ok('no network request attempted outside the app', res.blocked.length === 0, res.blocked.slice(0, 3).join(' '));
  ok('no runtime errors', res.errors.length === 0, res.errors.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(OUT, 'apk-assets-tv.json'), JSON.stringify(res, null, 2));
  await b.close();
  process.exit(res.checks.every((c) => c.pass) ? 0 : 1);
})();
