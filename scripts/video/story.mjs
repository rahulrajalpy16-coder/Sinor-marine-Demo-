// Captures the footage for the story-driven film (story.json): frame-exact, through stage.mjs.
//   shots   - cinematic 3D shots with the interface hidden (Realistic, X-ray and Hybrid views), ending with
//             the reveal: the simulator's own interface appears around the vessel
//   screens - the system screens during four training scenarios (wind sensors, blackout, DP UPS, gyro drift),
//             recorded at double pixel density so they can be cropped into sharp close-ups. Clicks happen
//             between recorded frames, so no pointer is seen.
// Each shot's first frame goes to <outDir>/<session>/timeline.json (seconds); the screens session also stores
// the bounding box of each full-screen system window (CSS pixels) for the crops.
// Usage: node story.mjs <shots|screens> <outDir> [baseUrl]
import { writeFileSync } from 'node:fs';
import { openStage, FPS } from './stage.mjs';

const [, , session, outRoot, baseArg] = process.argv;
const base = baseArg || 'http://localhost:4173';
const out = `${outRoot}/${session}`;
const HIDE = `[data-testid=skip-intro]{visibility:hidden!important} #demo-cursor{display:none!important}`;

const SHOTS = [
  // Wide, low and long-lens: the vessel on station beside the platform.
  { id: 'wide', mode: 'realistic', keys: [{ p: [-175, 4, 175], t: [0, 6, 0] }, { p: [-158, 4.6, 196], t: [2, 6, 4] }], sec: 12, fov: 17 },
  // Tracking aft along the starboard side.
  { id: 'side', mode: 'realistic', keys: [{ p: [100, 19, 58], t: [0, 7, 12] }, { p: [96, 17, 14], t: [0, 7, -2] }], sec: 5, fov: 24 },
  // Below the waterline, looking up at the bow tunnels and the acoustic pole.
  { id: 'under', mode: 'realistic', keys: [{ p: [15, -15, 47], t: [0, -4.5, 14] }, { p: [10, -13.5, 35], t: [0, -4, 9] }], sec: 5.5, fov: 42 },
  // X-ray: the systems inside the hull.
  { id: 'xray', mode: 'xray', keys: [{ p: [-62, 22, 74], t: [0, 4, 6] }, { p: [-76, 19, 32], t: [0, 4, 0] }], sec: 6.5, fov: 34 },
  // The mast top and its wind sensors against the sky.
  { id: 'mast', mode: 'realistic', keys: [{ p: [17, 20.5, 37], t: [0, 25.3, 14] }, { p: [13, 22, 32], t: [0, 25.3, 14] }], sec: 4.5, fov: 15 },
  // Engine room and UPS room, in X-ray.
  { id: 'gens', mode: 'xray', sel: 'gensets-001', keys: [{ p: [0, 0.9, -10.2], t: [0, -2.8, -21] }, { p: [0, 0.5, -12.6], t: [0, -2.8, -21] }], sec: 4, fov: 46 },
  { id: 'upsroom', mode: 'xray', sel: 'ups-001', keys: [{ p: [0, 11.8, 13.4], t: [-0.55, 10.9, 8.9] }, { p: [0.3, 11.6, 12.4], t: [-0.55, 10.9, 8.9] }], sec: 4, fov: 46 },
  // From astern, rising over the working deck towards the bridge.
  { id: 'crane', mode: 'realistic', keys: [{ p: [60, 14, -130], t: [0, 7, 0] }, { p: [40, 30, -112], t: [0, 6, 6] }, { p: [22, 50, -96], t: [0, 6, 12] }], sec: 8, fov: 26 },
  // Hybrid from above, turning slowly.
  { id: 'top', mode: 'hybrid', keys: [{ p: [30, 70, -60], t: [0, 0, 5] }, { p: [-25, 66, -58], t: [0, 0, 5] }], sec: 8, fov: 35 },
  // Pulling away and up: the vessel and the platform at sea.
  { id: 'aerial', mode: 'realistic', keys: [{ p: [-60, 22, 110], t: [0, 5, 0] }, { p: [-150, 52, 230], t: [0, 3, -12] }], sec: 8.5, fov: 24 },
];

async function setup(s, sh) {
  await s.page.evaluate((m) => window.__SINOR__.state().setVisualMode(m), sh.mode);
  if (sh.sel) {
    await s.page.evaluate((i) => window.__SINOR__.state().select(i), sh.sel);
    await s.skip(4);
  } else {
    await s.page.evaluate(() => window.__SINOR__.state().deselect());
    await s.skip(0.6);
  }
  await s.page.evaluate(([a, b, f]) => window.__SINOR__.setCamera(a, b, f), [sh.keys[0].p, sh.keys[0].t, sh.fov]);
  await s.skip(0.4, 1);
}

async function shots() {
  const s = await openStage({ base, query: '?quality=high&intro=0', out });
  await s.page.addStyleTag({ content: HIDE });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.cinema(true);
  await s.skip(2);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const sh of SHOTS) {
    if (only && !only.includes(sh.id)) continue;
    await setup(s, sh);
    s.recording = true;
    s.mark(sh.id);
    await s.move(sh.keys, sh.sec, { fov: sh.fov });
    s.recording = false;
  }
  if (!only || only.includes('reveal')) {
    // The reveal: a Hybrid shot with the interface hidden, then the simulator's interface appears (the film
    // dissolves across the 'ui' mark) and the camera keeps drifting for the laptop scene.
    const sh = { id: 'reveal', mode: 'hybrid', keys: [{ p: [-58, 23, 74], t: [0, 4, 6] }], fov: 34 };
    await setup(s, sh);
    s.recording = true;
    s.mark('reveal');
    await s.move([{ p: [-58, 23, 74], t: [0, 4, 6] }, { p: [-52, 22, 66], t: [0, 4, 5] }], 4, { fov: 34, ease: false });
    await s.page.evaluate(() => document.documentElement.classList.remove('cinema'));
    s.mark('ui');
    await s.move([{ p: [-52, 22, 66], t: [0, 4, 5] }, { p: [-30, 26, 80], t: [0, 4, 4] }, { p: [10, 30, 86], t: [0, 4, 2] }], 13, { fov: 34 });
  }
  s.mark('end');
  return s;
}

const ZOOM = `.fixed.inset-0.z-50 > .max-w-4xl{zoom:1.45} .fixed.inset-0.z-50{backdrop-filter:none!important;background:rgba(2,8,19,.86)!important}`;
async function screens() {
  const s = await openStage({ base, query: '?quality=low&intro=0', out, scale: 2 });
  await s.page.addStyleTag({ content: HIDE + ZOOM });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.skip(1.5);
  s.timeline.boxes = {};
  const click = async (id) => {
    await s.page.getByTestId(id).first().click();
    await s.skip(0.4, 1);
  };
  const scenario = async (id, hmi) => {
    s.recording = false;
    const open = await s.page.evaluate(() => [...document.querySelectorAll('[data-testid$="-hmi-expand"]')].find((b) => b.textContent === '✕')?.dataset.testid);
    if (open) await click(open);
    await click('sim-controls-open');
    await click(`sim-scenario-${id}`);
    await s.skip(2.4, 2);
    await click(`${hmi}-expand`);
    s.timeline.boxes[id] = await s.page.evaluate(() => {
      const r = document.querySelector('.fixed.inset-0.z-50 > .max-w-4xl').getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((v) => Math.round(v));
    });
    s.recording = true;
  };
  const q = (sel, txt) => s.until(([a, b]) => document.querySelector(a)?.textContent.includes(b), [sel, txt], 60);

  await scenario('wind-sensors', 'wind-hmi');
  s.mark('wind');
  await q('[data-testid=wind-status]', 'NO VALID SENSOR');
  s.mark('wind-fault');
  await s.hold(11);

  await scenario('blackout', 'pms-hmi');
  s.recording = false;
  await click('pms-tab-sld');
  s.recording = true;
  s.mark('blackout');
  await s.until(() => window.__SINOR__.power().alarms.length > 0, null, 60);
  s.mark('trip');
  await s.until(() => !window.__SINOR__.power().alarms.some((a) => a.startsWith('DRIVE_NOT_READY')), null, 60);
  s.mark('restored');
  await s.hold(9);

  await scenario('ups-battery', 'ups-hmi');
  s.mark('ups');
  await q('[data-testid=ups-UPS_A-mode]', 'ON BATTERY');
  s.mark('batt');
  await s.hold(10);

  await scenario('gyro-drift', 'sensors-hmi');
  s.mark('gyro');
  await s.hold(1);
  s.speed = 3;
  await s.until(() => window.__SINOR__.dp().sensors.find((x) => x.id === 'GYRO2')?.rejected, null, 90);
  s.speed = 1;
  s.mark('reject');
  await s.hold(5);
  s.mark('end');
  return s;
}

const s = await { shots, screens }[session]();
writeFileSync(`${out}/timeline.json`, JSON.stringify({ fps: FPS, frames: s.frame, ...s.timeline }, null, 1));
await s.close();
console.log('done', session, s.frame, 'frames', (s.frame / FPS).toFixed(1), 's');
