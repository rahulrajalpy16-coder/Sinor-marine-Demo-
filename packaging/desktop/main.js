// Sinor Marine Vessel Systems Simulator: offline desktop shell.
// Serves the bundled app from the program folder over a private app:// scheme and blocks every network request,
// so it runs the same from a pendrive with no internet. On Windows and Linux, saved scenarios and settings are kept
// next to the program (SinorMarineData), so they travel with the pendrive; if the drive is read-only the user profile
// is used instead. On macOS they stay in the user profile, because writing inside the app bundle breaks its signature.
// For all-day exhibition use, the display never sleeps while the simulator is open and the 3D view keeps full speed
// even when the window is not in front.
const { app, BrowserWindow, Menu, net, powerSaveBlocker, protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, 'web');
const HERE = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
const MAC = process.platform === 'darwin';

if (!MAC) try {
  const data = path.join(HERE, 'SinorMarineData');
  fs.mkdirSync(data, { recursive: true });
  fs.accessSync(data, fs.constants.W_OK);
  app.setPath('userData', data);
} catch {
  // Read-only media: keep the default profile folder.
}

// Trusted local content only: allow software WebGL on PCs without a usable graphics driver.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
// Full frame rate all day: no timer throttling or slow-down when the window is covered or not in front.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const args = process.argv.slice(1);
const query = new URLSearchParams();
if (args.includes('--demo')) query.set('demo', '1');
if (args.includes('--tv')) query.set('tv', '1');
if (args.includes('--no-intro')) query.set('intro', '0');

app.whenReady().then(() => {
  protocol.handle('app', async (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Offline guarantee: nothing may leave the machine.
  const blocked = [];
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => {
    const cancel = !/^(app|devtools|data|blob|file):/.test(d.url);
    if (cancel) blocked.push(d.url);
    cb({ cancel });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  // macOS needs an app menu for the standard Cmd+Q, Cmd+H and full-screen shortcuts; elsewhere there is no menu bar.
  Menu.setApplicationMenu(MAC ? Menu.buildFromTemplate([{ role: 'appMenu' }, { label: 'View', submenu: [{ role: 'togglefullscreen' }] }]) : null);
  // Keep the screen awake for the whole exhibition day.
  powerSaveBlocker.start('prevent-display-sleep');

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#020813',
    title: 'Sinor Marine · Vessel Systems Simulator',
    icon: path.join(WEB, 'brand', 'sinor-icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.maximize();
  if (args.includes('--fullscreen') || args.includes('--demo')) win.setFullScreen(true);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) e.preventDefault();
  });
  // F11 full screen, Ctrl+Q quit, Ctrl+R reload (on a Mac also Cmd+Q, Cmd+R and Ctrl+Cmd+F).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if ((input.control || input.meta) && input.key.toLowerCase() === 'q') app.quit();
    else if ((input.control || input.meta) && input.key.toLowerCase() === 'r') win.reload();
  });
  // Self-recovery for an unattended day: if the page or the graphics process ever crashes, or the page stops
  // responding for 20 s, reload it (the same start options, so a running exhibition demo starts again by itself).
  let recovering = false;
  const recover = (why) => {
    if (recovering || win.isDestroyed()) return;
    recovering = true;
    console.error(`Recovering after ${why}`);
    setTimeout(() => {
      recovering = false;
      if (!win.isDestroyed()) win.reload();
    }, 1500);
  };
  win.webContents.on('render-process-gone', (_e, d) => d.reason !== 'clean-exit' && recover(`page ${d.reason}`));
  app.on('child-process-gone', (_e, d) => d.type === 'GPU' && d.reason !== 'clean-exit' && recover(`graphics ${d.reason}`));
  let hang = null;
  win.on('unresponsive', () => {
    hang = setTimeout(() => recover('page not responding'), 20000);
  });
  win.on('responsive', () => clearTimeout(hang));
  const q = query.toString();
  win.loadURL(`app://sinor/index.html${q ? `?${q}` : ''}`);
  if (args.includes('--selftest')) selfTest(win, blocked);
});

// --selftest: start, let the simulation run, then write selftest.json and selftest.png next to the program (or in
// the data folder) and exit with code 0 when the 3D scene rendered and the simulation core is running.
// --selftest-minutes=N additionally runs the exhibition demo for N minutes, sampling memory and frame rate.
async function selfTest(win, blocked) {
  const out = (() => {
    try {
      if (MAC) throw new Error('keep the app bundle unchanged');
      fs.accessSync(HERE, fs.constants.W_OK);
      return HERE;
    } catch {
      return app.getPath('userData');
    }
  })();
  const minutesArg = args.find((a) => a.startsWith('--selftest-minutes='));
  const minutes = minutesArg ? Number(minutesArg.split('=')[1]) : 0;
  const t0 = Date.now();
  const js = (code) => win.webContents.executeJavaScript(code, true);
  let ready = false;
  while (!ready && Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await js('!!window.__SINOR__').catch(() => false);
  }
  const startMs = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 10000));
  // Persistence across launches: count runs in local storage (kept in SinorMarineData).
  const runs = ready ? await js(`(() => { const n = Number(localStorage.getItem('sinor.selftest.runs') || 0) + 1; localStorage.setItem('sinor.selftest.runs', String(n)); return n; })()`) : 0;
  const report = ready
    ? await js(`(() => { const S = window.__SINOR__; const p = S.power(); return {
        sample: S.sample(), dpStatus: S.dp().status, powerTime: p.time, buses: Object.fromEntries(Object.entries(p.buses).map(([k, b]) => [k, b.live])),
        gensOnline: p.gens.filter((g) => g.state === 'online').map((g) => g.id), windSensors: S.wind().sensors.map((x) => x.status),
        equipment: Object.keys(S.state().assetStatus).length }; })()`)
    : null;
  const consistency = ready ? await js('window.__SINOR__.consistency()') : null;
  if (consistency) fs.writeFileSync(path.join(out, 'selftest-consistency.json'), JSON.stringify(consistency));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(out, 'selftest.png'), img.toPNG());

  const endurance = [];
  if (ready && minutes > 0) {
    await js(`document.querySelector('[data-testid=sim-controls-open]').click()`);
    await new Promise((r) => setTimeout(r, 500));
    await js(`document.querySelector('[data-testid=demo-start]').click()`);
    // One sample at the end of every minute, on a fixed schedule (the sampling time does not add up).
    const t1 = Date.now();
    for (let i = 1; i <= minutes; i++) {
      await new Promise((r) => setTimeout(r, Math.max(0, t1 + i * 60000 - 2000 - Date.now())));
      const m = await js(`new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res({ fps: n / ((performance.now() - t) / 1000),
        heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, events: window.__SINOR__.power().events.length,
        demo: !!document.querySelector('[data-testid=demo-overlay]'), title: document.querySelector('[data-testid=demo-title]')?.textContent, lit: window.__SINOR__.sample().lit }); }; requestAnimationFrame(f); })`);
      const mem = await app.getAppMetrics().reduce((a, x) => a + x.memory.workingSetSize, 0);
      endurance.push({ minute: endurance.length + 1, ...m, processMB: Math.round(mem / 1024) });
      fs.writeFileSync(path.join(out, 'selftest-endurance.json'), JSON.stringify(endurance, null, 2));
    }
    await js(`document.querySelector('[data-testid=demo-exit]').click()`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  const after = ready ? await js(`({ demo: !!document.querySelector('[data-testid=demo-overlay]'), lit: window.__SINOR__.sample().lit, alarms: window.__SINOR__.power().alarms })`) : null;
  const pass =
    !!report && report.sample.lit > 500 && report.powerTime > 5 && report.buses.MSB_A && report.buses.MSB_B && blocked.length === 0 &&
    (minutes === 0 || (endurance.length >= minutes && endurance.every((e) => e.demo && e.lit > 300) && after && !after.demo));
  const result = { pass, displaySleepBlocked: true, backgroundThrottling: win.webContents.getBackgroundThrottling ? win.webContents.getBackgroundThrottling() : false, version: app.getVersion(), electron: process.versions.electron, platform: process.platform, arch: process.arch, startMs, runsOnThisDrive: runs, blockedNetworkRequests: blocked, report, endurance, afterExit: after };
  fs.writeFileSync(path.join(out, 'selftest.json'), JSON.stringify(result, null, 2));
  app.exit(pass ? 0 : 1);
}

app.on('window-all-closed', () => app.quit());
