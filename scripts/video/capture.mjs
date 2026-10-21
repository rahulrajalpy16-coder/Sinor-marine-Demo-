// Captures the exhibition advertisement footage, frame by frame (see stage.mjs), as three sessions:
//   hero  - cinematic shots of the vessel on station in Realistic daylight, interface hidden
//   app   - the simulator walkthrough on desktop, every system in turn (starts stowed so deployments show)
//   phone - the same simulator on a phone screen
// Each narrated part lasts at least as long as its voice-over (durations.json); part starts go to
// <outDir>/<session>/timeline.json in output seconds.
// Usage: node capture.mjs <hero|app|phone> <outDir> <durations.json> [baseUrl] [quality] [scale]
import { readFileSync, writeFileSync } from 'node:fs';
import { openStage, FPS } from './stage.mjs';

const [, , session, outRoot, durFile, baseArg, qArg, scaleArg] = process.argv;
const base = baseArg || 'http://localhost:4173';
const quality = qArg || 'high';
const scale = Number(scaleArg || 1); // below 1 only for a quick rehearsal of the walkthrough
const durations = JSON.parse(readFileSync(durFile, 'utf8'));
const out = `${outRoot}/${session}`;
const HIDE = `[data-testid=skip-intro]{visibility:hidden!important}`;

async function hero() {
  const s = await openStage({ base, query: `?quality=${quality}&intro=0`, out, scale });
  await s.page.evaluate(() => window.__SINOR__.state().setVisualMode('realistic'));
  await s.cinema(true);
  await s.skip(2);
  s.recording = true;
  // Long-lens shots (narrow field of view) keep the nearby sea surface out of frame.
  // Across the bow, from port to starboard, the platform coming into view.
  s.mark('h1');
  await s.move([
    { p: [-40, 9.5, 150], t: [0, 8, 15] },
    { p: [16, 9.5, 158], t: [1, 8, 13] },
    { p: [72, 10, 141], t: [2, 8, 10] },
  ], 4.2, { fov: 24 });
  // Tracking aft along the starboard side.
  s.mark('h1b');
  await s.move([
    { p: [100, 19, 58], t: [0, 7, 12] },
    { p: [96, 17, 14], t: [0, 7, -2] },
  ], 4.0, { fov: 24 });
  // Beneath the hull: bow tunnels, the HPR pole and its acoustic beams, the taut wire to the seabed.
  s.mark('h2');
  await s.move([
    { p: [16, -10.5, 44], t: [0, -5.5, 12] },
    { p: [9, -9.5, 33], t: [0, -5, 8] },
  ], 5.5);
  // From astern, rising over the working deck towards the bridge.
  s.mark('h3');
  await s.move([
    { p: [50, 16, -128], t: [0, 7, 0] },
    { p: [35, 30, -110], t: [0, 6, 6] },
    { p: [20, 48, -95], t: [0, 6, 12] },
  ], 6.5, { fov: 26 });
  s.mark('end');
  return s;
}

async function app() {
  const s = await openStage({ base, query: `?quality=${quality}&start=stowed`, out, scale });
  await s.page.addStyleTag({ content: HIDE });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  s.recording = true;
  const seg = async (id, fn, pad = 0.6) => {
    const start = s.t;
    s.mark(id);
    await fn();
    const left = durations[id] + pad - (s.t - start);
    if (left > 0) await s.hold(left);
  };
  const lapse = async (k, fn) => {
    s.speed = k;
    await fn();
    s.speed = 1;
  };
  await seg('platform', async () => {
    await s.until(() => !window.__SINOR__.state().introActive, null, 12);
    await s.hold(0.4);
    await s.drag(-260, 0, 2.6);
    await s.hold(0.4);
  });
  await seg('modes', async () => {
    await s.tap('mode-realistic', { after: 1.6 });
    await s.tap('mode-blueprint', { after: 1.5 });
    await s.tap('mode-xray', { after: 1.7 });
    await s.tap('mode-hybrid', { after: 0.3 });
  }, 0.3);
  await seg('learn', async () => {
    await s.tap('reset-overview', { after: 0.6, move: 0.35 });
    await s.tap('guide-open', { after: 1.6 });
    await s.tap('guide-bow-thruster-001', { after: 0.1 });
    await s.focused('bow-thruster-001');
    await s.hold(0.6);
    await s.tap('tab-learn', { after: 2.2 });
    await s.tap('action-inspect', { after: 1.8 });
    await s.tap('tab-operate', { after: 0.4 });
  }, 0.2);
  await seg('thruster', async () => {
    await s.type('thrust-input', 0);
    await s.tap('thruster-start', { after: 0.2 });
    await lapse(3, () => s.text('thruster-status', 'running', 30));
    await s.type('thrust-input', -70);
    await s.hold(2.0);
    await s.type('thrust-input', 60);
    await s.hold(1.5);
    await s.tap('action-explode', { after: 2.6 });
    await s.tap('action-explode', { after: 0.6 });
    await s.tap('thruster-reset', { after: 0.2 });
  }, 0.2);
  await seg('dp', async () => {
    await s.focus('dp-console-001');
    await s.select('dp-speed', '20');
    await s.tap('dp-start', { after: 1.0 });
    await s.tap('dp-tab-thrusters', { after: 0.5 });
    await s.tap('dp-bt1-take', { after: 1.4 });
    await s.tap('dp-tab-redundancy', { after: 0.6 });
    await s.tap('dp-fail-ctrl-A', { after: 2.0 });
    await s.tap('dp-fail-ctrl-A', { after: 0.4 });
    await s.tap('dp-tab-position', { after: 0.8 });
  });
  await seg('hpr', async () => {
    await s.focus('deployment-001');
    await s.select('hpr-speed', '20');
    await s.tap('hpr-valve-open', { after: 0.6 });
    await s.tap('hpr-deploy', { after: 0.2 });
    await lapse(3, () => s.text('hpr-status', 'DEPLOYED', 60));
    await s.tap('hpr-signals', { after: 0.6 });
    await s.focus('hpr-001', 0.4);
    await s.tap('action-closeup', { after: 0.1 });
    await s.until(() => !window.__SINOR__.state().cameraMoving, null, 10);
    await s.hold(1.6);
  }, 0.3);
  await seg('relative', async () => {
    await s.tap('mode-hybrid', { after: 0.2 });
    await s.focus('radascan-001');
    await s.tap('radascan-start', { after: 0.2 });
    await lapse(3, () => s.text('radascan-hmi-status', 'TRACKING', 40));
    await s.hold(0.6);
    await s.focus('cyscan-001');
    await s.tap('cyscan-start', { after: 0.2 });
    await lapse(3, () => s.text('cyscan-hmi-status', 'TRACKING', 40));
    await s.hold(0.4);
    await s.tap('cyscan-fog', { after: 2.2 });
    await s.tap('cyscan-fog', { after: 0.3 });
  }, 0.3);
  await seg('absolute', async () => {
    await s.focus('dgps-001', 1.0);
    await s.focus('tautwire-001');
    await s.select('tw-speed', '20');
    await s.tap('tw-deploy', { after: 0.3 });
    await lapse(3, () => s.text('tautwire-hmi-status', 'ON BOTTOM · TENSIONED', 60));
    await s.hold(0.6);
  }, 0.3);
  await seg('sprintnav', async () => {
    await s.focus('sprintnav-001');
    await s.select('sn-speed', '20');
    await s.tap('sprintnav-power', { after: 0.2 });
    await s.tap('pole-deploy', { after: 0.2 });
    await lapse(3, () => s.text('sprintnav-hmi-status', 'REFERENCE OK', 60));
    await s.tap('action-closeup', { after: 0.1 });
    await s.until(() => !window.__SINOR__.state().cameraMoving, null, 10);
    await s.hold(1.6);
  }, 0.3);
  await seg('dpall', async () => {
    await s.tap('mode-hybrid', { after: 0.2 });
    await s.focus('dp-console-001');
    await s.tap('dp-tab-redundancy', { after: 0.5 });
    await s.tap('dp-drift-TAUTWIRE', { after: 0.2 });
    await lapse(3, () => s.until(() => window.__SINOR__.dp().refs.find((r) => r.id === 'TAUTWIRE')?.rejected, null, 60));
    await s.hold(1.6);
    await s.tap('dp-drift-TAUTWIRE', { after: 0.3 });
  });
  // Tail under the transition to the next scene.
  s.mark('tail');
  await s.tap('reset-overview', { after: 0.4 });
  await s.drag(-300, 0, 3.0);
  s.mark('end');
  return s;
}

// The last walkthrough part on its own, from the on-station start (every reference deployed), so it can be
// re-captured without the whole walkthrough. Joins the app frames at its 'dpall' mark.
async function dpall() {
  const s = await openStage({ base, query: `?quality=${quality}&intro=0`, out, scale });
  await s.page.addStyleTag({ content: HIDE });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.skip(1.5);
  s.recording = true;
  s.mark('dpall');
  await s.hold(0.3);
  await s.focus('dp-console-001');
  await s.select('dp-speed', '20');
  await s.tap('dp-start', { after: 0.6 });
  await s.tap('dp-tab-redundancy', { after: 0.5 });
  await s.tap('dp-drift-TAUTWIRE', { after: 0.2 });
  s.speed = 3;
  await s.until(() => window.__SINOR__.dp().refs.find((r) => r.id === 'TAUTWIRE')?.rejected, null, 60);
  s.speed = 1;
  await s.hold(1.6);
  const left = durations.dpall + 0.6 - s.t;
  if (left > 0) await s.hold(left);
  s.mark('tail');
  await s.tap('reset-overview', { after: 0.4 });
  await s.drag(-300, 0, 3.0);
  s.mark('end');
  return s;
}

async function phone() {
  const s = await openStage({ base, query: `?quality=${quality}&intro=0`, out, width: 390, height: 844, scale: scale === 1 ? 2 : scale });
  await s.page.evaluate(() => localStorage.setItem('sinor-guide-seen', '1'));
  await s.skip(1.5);
  s.recording = true;
  s.mark('start');
  await s.hold(0.6);
  await s.drag(-120, 0, 2.2);
  await s.tap('tree-toggle', { after: 0.9 });
  await s.tap('tree-sprintnav-001', { after: 0.1 });
  await s.focused('sprintnav-001');
  await s.hold(2.6);
  s.mark('end');
  return s;
}

const s = await { hero, app, dpall, phone }[session]();
writeFileSync(`${out}/timeline.json`, JSON.stringify({ fps: FPS, frames: s.frame, ...s.timeline }, null, 1));
await s.close();
console.log('done', session, s.frame, 'frames', (s.frame / FPS).toFixed(1), 's');
