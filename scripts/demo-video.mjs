// Records the product demo video of the web interface: opening, navigation, visual modes and every system's
// controls, with chapter captions and a visible pointer. Writes WebM clips; scripts/demo-video.sh joins them.
// Usage: node scripts/demo-video.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';

const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const out = process.argv[2] || 'demo-video';
const base = process.argv[3] || 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// Pointer, caption and title-card overlays, added to every page before the app loads.
const overlay = () => {
  const css = `
    #demo-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      border:2px solid #fff;background:rgba(47,214,255,.35);box-shadow:0 0 10px rgba(47,214,255,.9);pointer-events:none;
      transition:transform .12s;left:-50px;top:-50px}
    #demo-cursor.down{transform:scale(.7);background:rgba(47,214,255,.8)}
    #demo-caption{position:fixed;z-index:2147483646;left:50%;bottom:86px;transform:translateX(-50%);max-width:640px;
      padding:10px 18px;border-radius:10px;background:rgba(4,14,24,.88);border:1px solid rgba(47,214,255,.55);
      color:#e8f6fb;font:500 15px/1.35 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;
      opacity:0;transition:opacity .35s}
    #demo-caption b{display:block;color:#2fd6ff;font:600 11px/1.6 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase}
    #demo-card{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:14px;background:radial-gradient(circle at 50% 40%,#0b2a3c,#020a12 70%);color:#e8f6fb;
      font-family:Inter,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .5s;pointer-events:none}
    #demo-card .k{color:#2fd6ff;font:600 14px ui-monospace,monospace;letter-spacing:.4em}
    #demo-card .t{font-size:40px;font-weight:600;letter-spacing:.02em}
    #demo-card .s{font-size:18px;color:#9fc3d1;max-width:820px}`;
  const add = () => {
    if (document.getElementById('demo-cursor')) return;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    for (const id of ['demo-cursor', 'demo-caption', 'demo-card']) {
      const d = document.createElement('div');
      d.id = id;
      document.body.appendChild(d);
    }
    const c = document.getElementById('demo-cursor');
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add);
  else add();
};

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport }, deviceScaleFactor: 1 });
  await ctx.addInitScript(overlay);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  return { ctx, page };
}

function helpers(p) {
  const wait = (ms) => p.waitForTimeout(ms);
  const caption = async (chapter, text, hold = 0) => {
    await p.evaluate(([c, t]) => {
      const el = document.getElementById('demo-caption');
      el.innerHTML = c ? `<b>${c}</b>${t}` : '';
      el.style.opacity = c ? '1' : '0';
    }, [chapter, text]);
    if (hold) await wait(hold);
  };
  const card = async (kicker, title, sub, hold = 3500) => {
    await p.evaluate(([k, t, s]) => {
      const el = document.getElementById('demo-card');
      el.innerHTML = `<div class="k">${k}</div><div class="t">${t}</div><div class="s">${s}</div>`;
      el.style.opacity = '1';
    }, [kicker, title, sub]);
    await wait(hold);
    await p.evaluate(() => (document.getElementById('demo-card').style.opacity = '0'));
    await wait(600);
  };
  /** Glide the pointer to an element, then click it. */
  const tap = async (testid, { pause = 700, nth } = {}) => {
    let loc = p.getByTestId(testid);
    loc = nth === 'last' ? loc.last() : loc.first();
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
    await wait(180);
    await loc.click();
    await wait(pause);
  };
  const select = async (testid, value) => {
    const loc = p.getByTestId(testid).first();
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await loc.selectOption(value);
    await wait(400);
  };
  const type = async (testid, value) => {
    await tap(testid, { pause: 200 });
    await p.getByTestId(testid).first().fill(String(value));
    await p.getByTestId(testid).first().press('Enter');
    await wait(500);
  };
  const text = (tid, t, timeout = 120000) =>
    p.waitForFunction(([x, y]) => document.querySelector(`[data-testid=${x}]`)?.textContent === y, [tid, t], { timeout });
  const focused = (id) =>
    p.waitForFunction((i) => { const s = window.__SINOR__.state(); return s.selectedId === i && s.phase === 'focused' && !s.cameraMoving; }, id, { timeout: 30000 });
  const system = async (id, chapter, line) => {
    await caption(chapter, line);
    await tap(`tree-${id}`, { pause: 200 });
    await focused(id);
    await wait(1200);
  };
  /** Orbit by dragging across the canvas centre. */
  const drag = async (dx, dy, steps = 40) => {
    const b = await p.locator('canvas').first().boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await p.mouse.move(x, y, { steps: 8 });
    await p.mouse.down();
    await p.mouse.move(x + dx, y + dy, { steps });
    await p.mouse.up();
  };
  const zoom = async (dy, times) => {
    for (let i = 0; i < times; i++) {
      await p.mouse.wheel(0, dy);
      await wait(120);
    }
  };
  return { wait, caption, card, tap, select, type, text, focused, system, drag, zoom };
}

// ---------------------------------------------------------------- Desktop walkthrough
{
  const { ctx, page: p } = await newPage({ width: 1280, height: 720 });
  const h = helpers(p);
  const { wait, caption, card, tap, select, type, text, system, drag, zoom } = h;

  await p.goto(base + '/?quality=low');
  await card('SINOR MARINE', 'Offshore Vessel Explorer', 'Demo of the web interface: an interactive 3D DP2 offshore vessel with its bridge, dynamic positioning, position references and thrusters', 4500);

  // 1. Opening
  await caption('1 · Opening', 'The vessel is revealed as a holographic wireframe, then a sweep turns it realistic');
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 60000 });
  await p.waitForFunction(() => !window.__SINOR__.state().introActive, null, { timeout: 60000 }).catch(() => {});
  await wait(1500);

  // 2. Navigation
  await caption('2 · Navigate', 'Drag to orbit, scroll to zoom, right-drag to pan. Rings mark every system');
  await drag(-260, 0, 60);
  await wait(600);
  await drag(180, -60, 50);
  await caption('2 · Navigate', 'Zoom in and short names fade in beside the rings; labels never overlap');
  const cb = await p.locator('canvas').first().boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 8 });
  await zoom(-250, 7);
  await wait(1800);
  await zoom(250, 7);
  await tap('reset-overview', { pause: 2500 });

  // 3. Visual modes
  await caption('3 · Visual modes', 'Hybrid: realistic aft, holographic forward');
  await tap('mode-hybrid', { pause: 1800 });
  await caption('3 · Visual modes', 'Realistic: painted hull, superstructure and deck equipment');
  await tap('mode-realistic', { pause: 2200 });
  await caption('3 · Visual modes', 'Blueprint: engineering line drawing');
  await tap('mode-blueprint', { pause: 2200 });
  await caption('3 · Visual modes', 'X-ray: see through the hull to interior and underwater systems');
  await tap('mode-xray', { pause: 2400 });
  await tap('mode-hybrid', { pause: 800 });
  await caption('3 · Visual modes', 'Render quality adapts to the device (low, medium, high)');
  await select('quality', 'medium');
  await wait(1500);

  // 4. Integrated bridge
  await system('ibs-001', '4 · Integrated Bridge System', 'Pick any system from the explorer: the camera flies to it and its panel opens');
  await wait(1500);
  await caption('4 · Integrated Bridge System', 'Forward console with five multi-function workstations, steering stand and chart table');
  await tap('action-inspect', { pause: 2500 });
  await caption('4 · Integrated Bridge System', 'Inspect details lists the specifications and where each item is installed');
  await p.getByTestId('inspector').first().evaluate((el) => el.querySelector('[class*=overflow]')?.scrollBy({ top: 400, behavior: 'smooth' })).catch(() => {});
  await wait(2200);
  await tap('action-isolate', { pause: 2000 });
  await caption('4 · Integrated Bridge System', 'Isolate hides everything else to study one system');
  await wait(1500);
  await tap('mode-hybrid', { pause: 600 });

  // 5. Bow thruster
  await system('bow-thruster-001', '5 · Bow tunnel thruster', 'P2 controllable-pitch tunnel thruster with the Z-Thrust control panel');
  await type('thrust-input', 0);
  await caption('5 · Bow tunnel thruster', 'Start the motor: the lever must be at zero (start interlock)');
  await tap('thruster-start', { pause: 400 });
  await text('thruster-status', 'running', 30000);
  await wait(1000);
  await caption('5 · Bow tunnel thruster', 'Command thrust: pitch, power, RPM and thrust respond, and the water flow shows the direction');
  await type('thrust-input', -70);
  await wait(3500);
  await type('thrust-input', 60);
  await wait(3500);
  await caption('5 · Bow tunnel thruster', 'Exploded view separates the tunnel, gearbox, hub and motor');
  await tap('action-explode', { pause: 3200 });
  await tap('action-explode', { pause: 1500 });
  await tap('thruster-reset', { pause: 800 });

  // 6. DP
  await system('dp-console-001', '6 · Dynamic positioning', 'Aft-facing DP station overlooking the working deck');
  await caption('6 · Dynamic positioning', 'Start DP in Auto Position: the vessel holds its setpoint against wind and current');
  await select('dp-speed', '20');
  await tap('dp-start', { pause: 2500 });
  await caption('6 · Dynamic positioning', 'Thrusters page: hand bow thruster BT1 from the bridge lever to DP');
  await tap('dp-tab-thrusters', { pause: 1200 });
  await tap('dp-bt1-take', { pause: 3000 });
  await caption('6 · Dynamic positioning', 'Environment page: wind and current drive the simulation');
  await tap('dp-tab-environment', { pause: 2500 });
  await caption('6 · Dynamic positioning', 'Redundancy page: DP class, controllers, networks and position references');
  await tap('dp-tab-redundancy', { pause: 1500 });
  await caption('6 · Dynamic positioning', 'Fail a controller on DP2: the others vote on and position is held');
  await tap('dp-fail-ctrl-A', { pause: 3500 });
  await tap('dp-fail-ctrl-A', { pause: 1000 });
  await tap('dp-tab-position', { pause: 2500 });

  // 7. HPR on the Type 7950
  await system('deployment-001', '7 · HPR deployment machine', 'Sonardyne Type 7950 deploys the HPT 5000 USBL transceiver through the hull');
  await select('hpr-speed', '20');
  await caption('7 · HPR deployment machine', 'Interlocks: open the gate valve, then deploy the pole');
  await tap('hpr-valve-open', { pause: 1500 });
  await tap('hpr-deploy', { pause: 400 });
  await text('hpr-status', 'DEPLOYED', 120000);
  await wait(1200);
  await caption('7 · HPR deployment machine', 'Deployed 2.95 m below the keel; acoustic signals give range and bearing');
  await tap('hpr-signals', { pause: 2500 });
  await system('hpr-001', '7 · HPR', 'Under the hull: the transceiver and the acoustic link to the seabed transponder');
  await wait(2500);

  // 8. Position references
  await system('radascan-001', '8 · RadaScan View', 'Radar position reference, on the aft bridge deck facing the platform astern');
  await tap('radascan-start', { pause: 400 });
  await text('radascan-hmi-status', 'TRACKING');
  await caption('8 · RadaScan View', 'Tracking the coded responder: range, bearing and radar picture; select it in DP');
  await tap('radascan-dp-select', { pause: 2500 });

  await system('cyscan-001', '9 · CyScan AS', 'Laser position reference on the opposite corner, measuring to the target');
  await tap('cyscan-start', { pause: 400 });
  await text('cyscan-hmi-status', 'TRACKING');
  await tap('cyscan-dp-select', { pause: 1500 });
  await caption('9 · CyScan AS', 'Fog or rain blocks the laser; the radar keeps working');
  await tap('cyscan-fog', { pause: 3500 });
  await tap('cyscan-fog', { pause: 1500 });

  await system('dgps-001', '10 · DGPS', 'Two Fugro Seastar 9410-AUT receivers with Trimble GA830 antennas on the mast');
  await wait(3000);

  await system('tautwire-001', '11 · Taut wire', 'SMT Taut Wire 2.0: the boom swings out and lowers the 400 kg weight to the seabed');
  await select('tw-speed', '20');
  await tap('tw-deploy', { pause: 400 });
  await wait(4000);
  await caption('11 · Taut wire', 'Wire angle gives the vessel offset; the panel shows the $PCPTW output');
  await text('tautwire-hmi-status', 'ON BOTTOM · TENSIONED');
  await tap('tautwire-dp-select', { pause: 2500 });

  await system('sprintnav-001', '12 · SPRINT-Nav DP', 'Inertial and Doppler reference on the 8097 over-the-side pole');
  await select('sn-speed', '20');
  await tap('sprintnav-power', { pause: 600 });
  await tap('pole-deploy', { pause: 400 });
  await caption('12 · SPRINT-Nav DP', 'The pole swings down and locks; the instrument aligns, then feeds DP');
  await text('sprintnav-hmi-status', 'REFERENCE OK');
  await tap('sprintnav-dp-select', { pause: 2000 });

  // 13. All together
  await system('dp-console-001', '13 · DP with every reference', 'DP weighs all the references; a drifting one is rejected');
  await tap('dp-tab-redundancy', { pause: 1500 });
  await tap('dp-drift-TAUTWIRE', { pause: 400 });
  await p.waitForFunction(() => window.__SINOR__.dp().refs.find((r) => r.id === 'TAUTWIRE')?.rejected, null, { timeout: 90000 }).catch(() => {});
  await wait(2500);
  await tap('dp-drift-TAUTWIRE', { pause: 800 });

  await caption('', '');
  await tap('reset-overview', { pause: 2500 });
  await caption('Overview', 'Return to the overview at any time');
  await drag(-200, 0, 60);
  await wait(1500);
  await caption('', '');
  await card('SINOR MARINE', 'Try it in your browser', 'rahulrajalpy16-coder.github.io/Sinor-marine-Demo-<br>Representative concept for demonstration, not certified', 5000);
  await ctx.close();
  renameSync(await p.video().path(), `${out}/1-desktop.webm`);
}

// ---------------------------------------------------------------- Phone layout
{
  const { ctx, page: p } = await newPage({ width: 405, height: 720 });
  const { wait, caption, tap, focused } = helpers(p);
  await p.goto(base + '/?intro=0&quality=low');
  await p.waitForFunction(() => !!window.__SINOR__, null, { timeout: 60000 });
  await wait(1500);
  await caption('14 · Phones and tablets', 'Same app on a phone: systems in a drawer');
  await wait(1500);
  await tap('tree-toggle', { pause: 1200 });
  await tap('tree-tautwire-001', { pause: 200, nth: 'last' });
  await focused('tautwire-001');
  await caption('14 · Phones and tablets', 'Controls in a bottom sheet; touch to orbit and pinch to zoom');
  await wait(3500);
  await tap('action-return', { pause: 2000 });
  await caption('', '');
  await ctx.close();
  renameSync(await p.video().path(), `${out}/2-phone.webm`);
}

await browser.close();
console.log('clips written to', out);
