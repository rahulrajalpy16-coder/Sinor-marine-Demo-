// Frame-exact capture stage for the exhibition video. The page runs on Playwright's paused clock and on a
// requestAnimationFrame queue that only this script flushes, so every output frame is exactly 1/FPS of app
// time, rendered once and saved as a JPEG. The software renderer can take seconds per frame; the motion in
// the video stays perfectly smooth.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

export const FPS = 30;
const DT = 1000 / FPS;

export async function openStage({ base, query, out, width = 1920, height = 1080, scale = 1 }) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: scale > 1, isMobile: scale > 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  await p.clock.pauseAt(new Date('2026-10-21T10:00:01Z'));
  await p.addInitScript(() => {
    // One animation frame per output frame, flushed by the capture script.
    let id = 0;
    let queue = new Map();
    window.requestAnimationFrame = (cb) => {
      queue.set(++id, cb);
      return id;
    };
    window.cancelAnimationFrame = (i) => queue.delete(i);
    window.__frame = () => {
      const run = queue;
      queue = new Map();
      const t = performance.now();
      for (const cb of run.values()) cb(t);
    };
    // Pointer for the viewer, and a switch that hides the interface for cinematic shots.
    const css = `#demo-cursor{position:fixed;z-index:2147483647;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;
      border:2px solid #fff;background:rgba(47,214,255,.30);box-shadow:0 0 16px rgba(47,214,255,.9);pointer-events:none;left:-80px;top:-80px;
      transition:none}#demo-cursor.down{background:rgba(47,214,255,.85);width:22px;height:22px;margin:-11px 0 0 -11px}
      #demo-cursor.hide{display:none}
      html.cinema [data-testid=app-shell],html.cinema .scanlines,html.cinema [data-testid^=hotspot],html.cinema .hotspot-layer{visibility:hidden!important}`;
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
  });
  const cdp = await ctx.newCDPSession(p);
  await p.goto(base + '/' + query);
  for (let i = 0; i < 600; i++) {
    await p.clock.runFor(DT);
    await p.evaluate(() => window.__frame?.());
    if (await p.evaluate(() => !!window.__SINOR__)) break;
  }

  const s = {
    page: p,
    W: width,
    H: height,
    frame: 0,
    recording: false,
    /** App seconds per output second: above 1 the capture is a time-lapse (one render per output frame). */
    speed: 1,
    timeline: {},
    mouse: { x: width / 2, y: height / 2 },
    /** App time in seconds since the stage opened. */
    get t() { return s.frame / FPS; },
    /** Advances one frame; saves it when recording. */
    async step() {
      await p.clock.runFor(DT * s.speed);
      await p.evaluate(() => window.__frame());
      if (s.recording) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true });
        await import('node:fs').then((fs) => fs.writeFileSync(`${out}/f${String(s.frame).padStart(6, '0')}.jpg`, Buffer.from(data, 'base64')));
        s.frame++;
        if (s.frame % 150 === 0) console.log(`frame ${s.frame} (${(s.frame / FPS).toFixed(1)} s)`);
      }
    },
    async hold(sec) {
      for (let i = 0, n = Math.round(sec * FPS); i < n; i++) await s.step();
    },
    /** Steps until fn() is true in the page (recording as it goes), up to maxSec. */
    async until(fn, arg, maxSec = 60) {
      for (let i = 0, n = maxSec * FPS; i < n; i++) {
        if (await p.evaluate(fn, arg)) return true;
        await s.step();
      }
      console.log('until: gave up after', maxSec, 's');
      return false;
    },
    /** Advances app time without recording (for set-up between shots), in coarse steps. */
    async skip(sec, every = 4) {
      const was = s.recording;
      s.recording = false;
      for (let i = 0, n = Math.round(sec * FPS); i < n; i++) {
        await p.clock.runFor(DT);
        if (i % every === 0) await p.evaluate(() => window.__frame());
      }
      await p.evaluate(() => window.__frame());
      s.recording = was;
    },
    async glide(x, y, sec = 0.45) {
      const n = Math.max(1, Math.round(sec * FPS));
      const from = { ...s.mouse };
      for (let i = 1; i <= n; i++) {
        const e = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
        await p.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        await s.step();
      }
      s.mouse = { x, y };
    },
    async box(testid, last = false) {
      const loc = last ? p.getByTestId(testid).last() : p.getByTestId(testid).first();
      await loc.scrollIntoViewIfNeeded();
      return { loc, b: await loc.boundingBox() };
    },
    async tap(testid, { after = 0.5, last = false, move = 0.45 } = {}) {
      const { b } = await s.box(testid, last);
      await s.glide(b.x + b.width / 2, b.y + b.height / 2, move);
      await s.hold(0.1);
      await p.mouse.down();
      await s.step();
      await s.step();
      await p.mouse.up();
      await s.hold(after);
    },
    async select(testid, value) {
      const { loc, b } = await s.box(testid);
      await s.glide(b.x + b.width / 2, b.y + b.height / 2, 0.35);
      await loc.selectOption(value);
      await s.hold(0.3);
    },
    async type(testid, value) {
      await s.tap(testid, { after: 0.1 });
      const loc = p.getByTestId(testid).first();
      await loc.fill(String(value));
      await loc.press('Enter');
      await s.hold(0.3);
    },
    text(testid, t, maxSec = 60) {
      return s.until(([x, y]) => document.querySelector(`[data-testid=${x}]`)?.textContent === y, [testid, t], maxSec);
    },
    focused(id) {
      return s.until((i) => { const st = window.__SINOR__.state(); return st.selectedId === i && st.phase === 'focused' && !st.cameraMoving; }, id, 20);
    },
    async focus(id, settle = 0.3) {
      await s.tap(`tree-${id}`, { after: 0.1 });
      await s.focused(id);
      await s.hold(settle);
    },
    async drag(dx, dy, sec = 1.6) {
      await s.glide(s.W / 2, s.H / 2, 0.3);
      await p.mouse.down();
      await s.glide(s.W / 2 + dx, s.H / 2 + dy, sec);
      await p.mouse.up();
    },
    async wheel(dy, sec = 1.2) {
      const n = Math.round(sec * FPS);
      for (let i = 0; i < n; i++) {
        await p.mouse.wheel(0, dy / n);
        await s.step();
      }
    },
    async cinema(on) {
      await p.evaluate((v) => document.documentElement.classList.toggle('cinema', v), on);
      await p.evaluate((v) => document.getElementById('demo-cursor')?.classList.toggle('hide', v), on);
    },
    /** A camera move along vessel-frame keyframes [{p:[x,y,z], t:[x,y,z]}...] with smooth easing. */
    async move(keys, sec, { ease = true, fov = 42 } = {}) {
      const n = Math.round(sec * FPS);
      const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
      // Catmull-Rom through the keyframes for a smooth path.
      const cr = (pts, u) => {
        const m = pts.length - 1;
        const seg = Math.min(m - 1e-9, u * m);
        const i = Math.floor(seg);
        const k = seg - i;
        const P0 = pts[Math.max(0, i - 1)], P1 = pts[i], P2 = pts[i + 1], P3 = pts[Math.min(m, i + 2)];
        return P1.map((_, d) => 0.5 * (2 * P1[d] + (-P0[d] + P2[d]) * k + (2 * P0[d] - 5 * P1[d] + 4 * P2[d] - P3[d]) * k * k + (-P0[d] + 3 * P1[d] - 3 * P2[d] + P3[d]) * k * k * k));
      };
      for (let i = 0; i <= n; i++) {
        let u = i / n;
        if (ease) u = u * u * (3 - 2 * u) * 0.6 + u * 0.4; // gentle ease-in-out that never stops dead
        const pos = keys.length > 2 ? cr(keys.map((k) => k.p), u) : lerp(keys[0].p, keys[1].p, u);
        const tgt = keys.length > 2 ? cr(keys.map((k) => k.t), u) : lerp(keys[0].t, keys[1].t, u);
        await p.evaluate(([a, b, f]) => window.__SINOR__.setCamera(a, b, f), [pos, tgt, fov]);
        await s.step();
      }
    },
    mark(id) {
      s.timeline[id] = s.t;
      console.log('segment', id, s.t.toFixed(2));
    },
    async still(path) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
      await import('node:fs').then((fs) => fs.writeFileSync(path, Buffer.from(data, 'base64')));
    },
    close: () => browser.close(),
  };
  return s;
}
