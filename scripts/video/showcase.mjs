// Captures the footage for the OEM showcase film (showcase.json), frame-exact, through stage.mjs.
//   shots   - cinematic 3D shots with the interface hidden, one or two per system, in the order of the film.
//             The app starts with every reference stowed, and each system is started or deployed during its
//             own shot (the HPR pole, the SPRINT-Nav pole, the taut wire weight, the lasers and radar), so by
//             the closing aerial shot everything is in use.
//   screens - the system screens, recorded at double pixel density (3840 x 2160) for sharp 4K close-ups. The
//             full-screen HMIs (DP, Z-Thrust, HPR) are zoomed; the position reference panels are lifted out
//             of the side panel, centred and scaled up. Screens refresh at most 8 times a second, so this
//             session records at 15 fps (each frame is shown twice).
// PREVIEW=1 saves three stills per shot (start, middle, end) instead of the footage, to check the framing.
// ONLY=id,id records just those shots. Each shot's first frame goes to <outDir>/<session>/timeline.json.
// Usage: node showcase.mjs <shots|screens> <outDir> [baseUrl]
import { writeFileSync, mkdirSync } from 'node:fs';
import { openStage, FPS } from './stage.mjs';

const [, , session, outRoot, baseArg] = process.argv;
const base = baseArg || 'http://localhost:4173';
const out = `${outRoot}/${session}`;
const PREVIEW = !!process.env.PREVIEW;
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const HIDE = `[data-testid=skip-intro]{visibility:hidden!important} #demo-cursor{display:none!important}`;

// Shots in film order. keys: camera path in the vessel frame; act: what happens just before recording starts.
const SHOTS = [
  { id: 'wide', mode: 'realistic', sec: 7.5, fov: 17, keys: [{ p: [-175, 4, 175], t: [0, 6, 0] }, { p: [-160, 4.6, 193], t: [2, 6, 4] }] },
  { id: 'xray', mode: 'xray', sec: 5.5, fov: 34, keys: [{ p: [-62, 22, 74], t: [0, 4, 6] }, { p: [-74, 19, 40], t: [0, 4, 0] }] },
  { id: 'dp', shift: 0.2, mode: 'realistic', sec: 8.5, fov: 48, keys: [{ p: [1.8, 15.9, 11.5], t: [0.62, 13.7, 7.3] }, { p: [0.3, 15.6, 10.5], t: [0.3, 13.6, 7.0] }] },
  { id: 'ibs', shift: 0.2, mode: 'realistic', sec: 8.5, fov: 50, keys: [{ p: [2.9, 15.3, 18.0], t: [0.4, 14.1, 22.7] }, { p: [-1.9, 15.1, 18.3], t: [-0.3, 14.1, 22.7] }] },
  { id: 'ibs2', shift: 0.2, mode: 'realistic', sec: 6.5, fov: 38, keys: [{ p: [1.1, 14.95, 20.5], t: [0.2, 14.0, 22.9] }, { p: [-1.1, 14.9, 20.8], t: [-0.2, 14.0, 22.9] }] },
  { id: 'bt', shift: 0.2, mode: 'xray', sel: 'bow-thruster-001', act: 'thruster', sec: 8.5, fov: 40, keys: [{ p: [13, 0.8, 39], t: [0, -2.8, 28.4] }, { p: [10, -0.2, 35.5], t: [0, -2.8, 28.4] }] },
  { id: 'dgps', shift: 0.2, mode: 'realistic', sec: 8.5, fov: 30, keys: [{ p: [4.4, 22.25, 12.5], t: [3.0, 21.85, 14] }, { p: [3.4, 22.2, 12.3], t: [3.0, 21.85, 14] }] },
  { id: 'hprx', shift: 0.2, mode: 'xray', sel: 'deployment-001', act: 'hpr', sec: 9, fov: 50, keys: [{ p: [5, -2.0, 13.8], t: [0, -2.9, 11.8] }, { p: [4.6, -4.4, 14.8], t: [0, -5.6, 11.8] }] },
  { id: 'sn', shift: 0.2, mode: 'realistic', sel: 'sprintnav-001', act: 'pole', sec: 8.5, fov: 38, keys: [{ p: [-29, 7.0, 3], t: [-10.8, -0.5, -7.4] }, { p: [-25, 5.0, -1.5], t: [-10.8, -1.2, -7.4] }] },
  { id: 'cys', shift: 0.2, mode: 'realistic', sel: 'cyscan-001', act: 'cyscan', sec: 8.5, fov: 34, keys: [{ p: [7.8, 15.25, 2.9], t: [4.6, 14.4, 6.4] }, { p: [6.4, 15.1, 2.3], t: [4.6, 14.4, 6.4] }] },
  { id: 'rada', shift: 0.2, mode: 'realistic', sel: 'radascan-001', act: 'radascan', sec: 8.5, fov: 30, keys: [{ p: [-9.4, 15.9, 1.6], t: [-4.6, 14.5, 6.4] }, { p: [-7.2, 15.7, 0.9], t: [-4.6, 14.5, 6.4] }] },
  { id: 'tw', shift: 0.05, mode: 'realistic', sel: 'tautwire-001', act: 'tw', sec: 8.5, fov: 40, keys: [{ p: [4.4, 12.6, -2.8], t: [10.4, 8.4, 4.1] }, { p: [6.4, 11.8, -3.8], t: [10.6, 6.6, 4.1] }] },
  { id: 'aerial', mode: 'realistic', sec: 9, fov: 24, keys: [{ p: [-60, 22, 110], t: [0, 5, 0] }, { p: [-150, 52, 230], t: [0, 3, -12] }] },
];

// The captions sit on the left of the frame, so product shots turn the camera a little to the left of the
// equipment (shift, as a fraction of the camera distance): the equipment then sits right of centre.
for (const sh of SHOTS) {
  if (!sh.shift) continue;
  sh.keys = sh.keys.map(({ p, t }) => {
    const f = [t[0] - p[0], t[2] - p[2]];
    const d = Math.hypot(t[0] - p[0], t[1] - p[1], t[2] - p[2]);
    const n = Math.hypot(f[0], f[1]) || 1;
    const left = [f[1] / n, 0, -f[0] / n];
    return { p, t: t.map((v, i) => v + left[i] * d * sh.shift) };
  });
}

/** Clicks a control by test id even when the interface is hidden (cinema mode). */
const press = (s, id) => s.page.evaluate((i) => {
  const el = document.querySelector(`[data-testid=${i}]`);
  if (!el) throw new Error(`no control ${i}`);
  el.click();
}, id);
/** Sets a React-controlled select or input and fires its events. */
const setValue = (s, id, v) => s.page.evaluate(([i, val]) => {
  const el = document.querySelector(`[data-testid=${i}]`);
  if (!el) throw new Error(`no control ${i}`);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(val));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);
const has = (s, id) => s.page.evaluate((i) => !!document.querySelector(`[data-testid=${i}]`), id);

async function act(s, a) {
  if (a === 'thruster') {
    await press(s, 'thruster-start');
    await s.skip(6);
    await setValue(s, 'thrust-input', 70);
    await s.page.evaluate(() => document.querySelector('[data-testid=thrust-input]').form?.requestSubmit());
    await s.skip(8);
  } else if (a === 'hpr') {
    if (await has(s, 'hpr-speed')) await setValue(s, 'hpr-speed', 10);
    await press(s, 'hpr-valve-open');
    await s.until(() => window.__SINOR__.hpr().valve === 'open', null, 40);
    await press(s, 'hpr-deploy');
    await s.skip(0.3, 1);
  } else if (a === 'pole') {
    if (await has(s, 'sn-speed')) await setValue(s, 'sn-speed', 5);
    await press(s, 'sprintnav-power');
    await press(s, 'pole-deploy');
    await s.skip(0.2, 1);
  } else if (a === 'cyscan' || a === 'radascan') {
    await press(s, `${a}-start`);
    await s.skip(0.2, 1);
  } else if (a === 'tw') {
    if (await has(s, 'tw-speed')) await setValue(s, 'tw-speed', 20);
    await press(s, 'tw-deploy');
    await s.skip(0.2, 1);
  }
}

async function setup(s, sh) {
  await s.page.evaluate((m) => window.__SINOR__.state().setVisualMode(m), sh.mode);
  if (sh.sel) {
    await s.page.evaluate((i) => window.__SINOR__.state().select(i), sh.sel);
    await s.skip(3);
  } else {
    await s.page.evaluate(() => window.__SINOR__.state().deselect());
    await s.skip(0.6);
  }
  await s.page.evaluate(([a, b, f]) => window.__SINOR__.setCamera(a, b, f), [sh.keys[0].p, sh.keys[0].t, sh.fov]);
  await s.skip(0.3, 1);
  if (sh.act) await act(s, sh.act);
  await s.page.evaluate(([a, b, f]) => window.__SINOR__.setCamera(a, b, f), [sh.keys[0].p, sh.keys[0].t, sh.fov]);
}

/** PREVIEW: three stills along the shot, with app time running in between. */
async function preview(s, sh) {
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  for (const [k, u] of [[0, 0], [1, 0.5], [2, 1]]) {
    if (u > 0) await s.skip(sh.sec * 0.5, 6);
    const [A, B] = [sh.keys[0], sh.keys[sh.keys.length - 1]];
    await s.page.evaluate(([a, b, f]) => window.__SINOR__.setCamera(a, b, f), [lerp(A.p, B.p, u), lerp(A.t, B.t, u), sh.fov]);
    await s.skip(0.1, 1);
    await s.still(`${out}/${sh.id}-${k}.jpg`);
  }
}

async function shots() {
  const s = await openStage({ base, query: '?quality=high&intro=0&start=stowed', out });
  await s.page.addStyleTag({ content: HIDE });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.cinema(true);
  await s.skip(2);
  for (const sh of SHOTS) {
    if (only && !only.includes(sh.id)) continue;
    await setup(s, sh);
    if (PREVIEW) {
      await preview(s, sh);
      console.log('preview', sh.id);
      continue;
    }
    s.recording = true;
    s.mark(sh.id);
    await s.move(sh.keys, sh.sec, { fov: sh.fov });
    s.recording = false;
  }
  s.mark('end');
  return s;
}

// The position reference panels normally sit in the side panel; for filming, the open panel is lifted out,
// centred and scaled as large as the screen allows over a dark backdrop (ancestors that would trap a fixed
// element, through a transform, filter or containment, are neutralised first).
const lift = (s, id) => s.page.evaluate((i) => {
  const el = document.querySelector(`[data-testid=${i}]`);
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.backdropFilter !== 'none' || cs.contain !== 'none' || cs.willChange !== 'auto') {
      for (const [k, v] of [['transform', 'none'], ['filter', 'none'], ['backdrop-filter', 'none'], ['contain', 'none'], ['will-change', 'auto']]) p.style.setProperty(k, v, 'important');
    }
  }
  el.dataset.lifted = el.style.cssText;
  el.style.setProperty('width', '440px', 'important');
  const r = el.getBoundingClientRect();
  const k = Math.min(2.3, 1030 / r.height, 1800 / r.width);
  Object.assign(el.style, { position: 'fixed', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${k})`, zIndex: '2147483000', boxShadow: '0 0 0 4000px rgba(2,8,19,.94)' });
}, id);
const unlift = (s) => s.page.evaluate(() => document.querySelectorAll('[data-lifted]').forEach((el) => { el.style.cssText = el.dataset.lifted; delete el.dataset.lifted; }));
const ZOOM = `.fixed.inset-0.z-50{backdrop-filter:none!important;background:rgba(2,8,19,.94)!important}`;
const SCREENS = [
  { id: 'dp-hmi', sel: 'dp-console-001', full: 'dp-expand', sec: 7, tab: 'dp-tab-position' },
  { id: 'zthrust-hmi', sel: 'bow-thruster-001', full: 'hmi-expand', sec: 7, thrust: true },
  { id: 'dgps-hmi', sel: 'dgps-001', sec: 7 },
  { id: 'hpr-hmi', sel: 'hpr-001', full: 'hpr-expand', sec: 7 },
  { id: 'sprintnav-hmi', sel: 'sprintnav-001', sec: 7 },
  { id: 'cyscan-hmi', sel: 'cyscan-001', sec: 7 },
  { id: 'radascan-hmi', sel: 'radascan-001', sec: 7 },
  { id: 'tautwire-hmi', sel: 'tautwire-001', sec: 7 },
  { id: 'dp-refs', sel: 'dp-console-001', full: 'dp-expand', sec: 7, tab: 'dp-tab-redundancy' },
];

async function screens() {
  const s = await openStage({ base, query: '?quality=low&intro=0', out, scale: 2 });
  await s.page.addStyleTag({ content: HIDE + ZOOM });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.skip(1.5);
  // DP running in auto position, so every screen shows a vessel holding station.
  await s.page.evaluate(() => window.__SINOR__.state().select('dp-console-001'));
  await s.skip(3);
  await press(s, 'dp-start');
  await s.skip(0.5, 1);
  await press(s, 'dp-mode-AUTO_POSITION');
  await s.skip(12, 6);
  s.timeline.boxes = {};
  for (const sc of SCREENS) {
    if (only && !only.includes(sc.id)) continue;
    s.recording = false;
    const open = await s.page.evaluate(() => [...document.querySelectorAll('[data-testid$="-expand"]')].find((b) => b.textContent === '✕')?.dataset.testid);
    if (open) await press(s, open);
    await unlift(s);
    await s.page.evaluate((i) => window.__SINOR__.state().select(i), sc.sel);
    await s.skip(3);
    if (sc.thrust && (await has(s, 'thruster-start'))) {
      await press(s, 'thruster-start');
      await s.skip(6);
      await setValue(s, 'thrust-input', 70);
      await s.page.evaluate(() => document.querySelector('[data-testid=thrust-input]').form?.requestSubmit());
      await s.skip(4);
    }
    if (sc.full) {
      await press(s, sc.full);
      await s.skip(0.6, 1);
      if (sc.tab && (await has(s, sc.tab))) await press(s, sc.tab);
      await s.skip(0.6, 1);
      // As large as the screen allows, whole panel in view.
      await s.page.evaluate(() => {
        const el = document.querySelector('.fixed.inset-0.z-50 > div');
        el.style.zoom = '1';
        const r = el.getBoundingClientRect();
        el.style.zoom = String(Math.min(1.9, 1040 / r.height, 1820 / r.width));
      });
      await s.skip(0.4, 1);
    } else {
      await lift(s, sc.id);
      await s.skip(0.6, 1);
    }
    s.timeline.boxes[sc.id] = await s.page.evaluate(([full, id]) => {
      const el = full ? document.querySelector('.fixed.inset-0.z-50 > div') : document.querySelector(`[data-testid=${id}]`);
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((v) => Math.round(v));
    }, [!!sc.full, sc.id]);
    if (PREVIEW) {
      await s.still(`${out}/${sc.id}.jpg`);
      console.log('preview', sc.id, s.timeline.boxes[sc.id]);
      continue;
    }
    // 15 fps: two app frames per saved frame.
    s.recording = true;
    s.mark(sc.id);
    const n = Math.round(sc.sec * 15);
    for (let i = 0; i < n; i++) {
      await s.skip(1 / FPS, 1);
      await s.step();
    }
    s.recording = false;
  }
  s.mark('end');
  s.timeline.fps = 15;
  return s;
}

mkdirSync(out, { recursive: true });
const s = await { shots, screens }[session]();
writeFileSync(`${out}/timeline.json`, JSON.stringify({ fps: FPS, frames: s.frame, ...s.timeline }, null, 1));
await s.close();
console.log('done', session, s.frame, 'frames');
