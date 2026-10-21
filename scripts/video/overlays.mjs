// Renders the advertisement's branded graphics at 1920×1080: the animated opener (frames), chapter cards,
// the tagline, the devices backdrop and bezels, and the end card with a QR code to the live simulator.
// Usage: node overlays.mjs <narration.json> <outDir> <qr.png> <url>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const [, , narrationFile, out, qrFile, url] = process.argv;
const segments = JSON.parse(readFileSync(narrationFile, 'utf8'));
mkdirSync(`${out}/opener`, { recursive: true });
const qr = `data:image/png;base64,${readFileSync(qrFile).toString('base64')}`;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const style = `
  *{margin:0;box-sizing:border-box}
  body{width:1920px;height:1080px;background:transparent;font-family:Inter,system-ui,sans-serif;color:#F4F8FC;overflow:hidden}
  .mono{font-family:'JetBrains Mono',monospace}
  .kick{font:600 22px 'JetBrains Mono',monospace;letter-spacing:.5em;color:#00D9FF;padding-left:.5em}
  .navy{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 48%,#0b2a3d 0%,#04121f 55%,#020813 100%)}
  .grid{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(0,217,255,.35) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,217,255,.35) 1px,transparent 1px);background-size:80px 80px;
    -webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 50%,#000 10%,transparent 75%)}
  .rule{height:2px;background:linear-gradient(90deg,transparent,#00D9FF 30%,#67F0FF 50%,#00D9FF 70%,transparent)}
  /* chapter card: top centre, under the simulator's own top bar */
  .chapter{position:absolute;left:50%;top:70px;transform:translateX(-50%);min-width:720px;max-width:1180px;padding:20px 48px 22px;text-align:center;
    background:linear-gradient(180deg,rgba(2,8,19,.94),rgba(4,18,31,.86));border:1px solid rgba(0,217,255,.42);border-radius:4px;
    box-shadow:0 24px 70px rgba(0,0,0,.55),0 0 50px rgba(0,217,255,.10)}
  .chapter .n{font:600 15px 'JetBrains Mono',monospace;letter-spacing:.42em;color:#00D9FF}
  .chapter .t{font:600 46px Inter;letter-spacing:-.005em;margin-top:6px}
  .chapter .s{font:400 22px Inter;color:#a8c4d4;margin-top:6px}
  .chapter .rule{width:160px;margin:14px auto 0}
  .tag{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(ellipse 55% 40% at 50% 50%,rgba(2,8,19,.62) 0%,rgba(2,8,19,.25) 60%,rgba(2,8,19,0) 100%)}
  .tag .t{font:300 86px Inter;letter-spacing:-.01em;margin-top:22px;text-shadow:0 8px 50px rgba(0,0,0,.65)}
  .tag .rule{width:520px;margin-top:26px}
  .dev .h{position:absolute;top:84px;left:0;right:0;text-align:center}
  .dev .h .t{font:600 50px Inter;margin-top:14px}
  .laptop{position:absolute;left:150px;top:262px;width:1120px;height:630px;border-radius:14px 14px 0 0;
    box-shadow:0 0 0 18px #0d1720,0 0 0 20px #2a3a48,0 40px 90px rgba(0,0,0,.7)}
  .base{position:absolute;left:90px;top:910px;width:1240px;height:26px;border-radius:0 0 22px 22px;background:linear-gradient(180deg,#3a4a58,#1a242d)}
  .notch{position:absolute;left:640px;top:910px;width:140px;height:9px;border-radius:0 0 8px 8px;background:#0d1720}
  .phone{position:absolute;left:1410px;top:226px;width:330px;height:714px;border-radius:44px;
    box-shadow:0 0 0 14px #0d1720,0 0 0 16px #33485a,0 40px 90px rgba(0,0,0,.7)}
  .phone:after{content:'';position:absolute;left:115px;top:12px;width:100px;height:26px;border-radius:14px;background:#0d1720}
  .end{position:absolute;inset:0}
  .end .brand{position:absolute;left:0;right:0;top:250px;text-align:center}
  .end .t{font:300 92px Inter;letter-spacing:-.01em;margin-top:26px}
  .end .s{font:400 30px Inter;color:#a8c4d4;margin-top:16px}
  .end .rule{width:560px;margin:34px auto 0}
  .end .try{position:absolute;left:50%;top:690px;transform:translateX(-50%);display:flex;align-items:center;gap:34px;
    padding:22px 34px;border:1px solid rgba(0,217,255,.4);border-radius:6px;background:rgba(2,8,19,.6)}
  .end .try img{width:168px;height:168px;border-radius:6px;background:#fff;padding:8px}
  .end .try .l{font:600 30px Inter}
  .end .try .u{font:500 21px 'JetBrains Mono',monospace;color:#9fe9ff;margin-top:12px}
  .end .try .d{font:400 19px Inter;color:#a8c4d4;margin-top:10px}
  .end .f{position:absolute;bottom:40px;left:0;right:0;text-align:center;font:400 16px Inter;color:#5f7f92}
`;
const shot = async (name, html, transparent = true) => {
  await page.setContent(`<html><head><style>${style}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: transparent });
};

// Chapter cards, numbered across the systems part of the walkthrough.
const chapters = segments.filter((s) => s.title && s.id !== 'platform' && s.id !== 'devices');
for (const [i, c] of chapters.entries()) {
  await shot(`chapter-${c.id}`, `<div class="chapter"><div class="n">SINOR MARINE · ${String(i + 1).padStart(2, '0')}</div>
    <div class="t">${c.title}</div><div class="s">${c.subtitle}</div><div class="rule"></div></div>`);
}

await shot('tagline', `<div class="tag"><div class="kick">SINOR MARINE</div><div class="t">We bring the vessel to you</div><div class="rule"></div></div>`);

await shot('devices-bg', `<div class="navy"></div><div class="grid"></div><div class="dev"><div class="h"><div class="kick">SINOR MARINE</div>
  <div class="t">Anywhere, on any screen</div></div></div>`, false);
await shot('devices-frames', `<div class="laptop"></div><div class="base"></div><div class="notch"></div><div class="phone"></div>`);

await shot('endcard', `<div class="navy"></div><div class="grid"></div><div class="end">
  <div class="brand"><div class="kick">SINOR MARINE</div><div class="t">We bring the vessel to you</div>
  <div class="s">Vessel Systems Simulator</div><div class="rule"></div></div>
  <div class="try"><img src="${qr}"><div><div class="l">Try the simulator now</div><div class="u">${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
  <div class="d">Runs in any web browser · desktop, tablet and phone</div></div></div>
  <div class="f">Sinor Marine system simulation for training and demonstration. Not connected to live vessel systems.</div></div>`, false);

// Opener: 5 s, driven frame by frame (no CSS clock), so every frame is exact.
await page.setContent(`<html><head><style>${style}
  #w{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  #k{font:600 30px 'JetBrains Mono',monospace;color:#00D9FF}
  #name{font:200 120px Inter;letter-spacing:.32em;padding-left:.32em;margin-top:6px}
  #r{height:2px;margin-top:30px}
  #sub{font:400 30px Inter;color:#a8c4d4;margin-top:26px;letter-spacing:.06em}
  #glow{position:absolute;left:50%;top:50%;width:1400px;height:500px;transform:translate(-50%,-50%);
    background:radial-gradient(ellipse at center,rgba(0,217,255,.22),rgba(0,217,255,0) 65%)}
  </style></head><body><div class="navy"></div><div class="grid" id="g"></div><div id="glow"></div>
  <div id="w"><div id="k">PRESENTS</div><div id="name">SINOR MARINE</div><div id="r" class="rule"></div>
  <div id="sub">Vessel Systems Simulator</div></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
const FRAMES = 150;
for (let f = 0; f < FRAMES; f++) {
  await page.evaluate((t) => {
    const c = (x) => Math.min(1, Math.max(0, x));
    const e = (x) => 1 - Math.pow(1 - c(x), 3);
    const $ = (id) => document.getElementById(id);
    $('k').style.opacity = 0; // the brand speaks for itself
    $('name').style.opacity = e((t - 0.3) / 1.1);
    $('name').style.letterSpacing = `${0.32 - 0.14 * e((t - 0.3) / 2.2)}em`;
    $('name').style.filter = `blur(${8 * (1 - e((t - 0.3) / 1.0))}px)`;
    $('r').style.width = `${760 * e((t - 0.9) / 1.3)}px`;
    $('sub').style.opacity = e((t - 1.8) / 0.9);
    $('sub').style.transform = `translateY(${14 * (1 - e((t - 1.8) / 0.9))}px)`;
    $('glow').style.opacity = 0.4 + 0.6 * e(t / 2.5);
    $('g').style.opacity = 0.18 * e(t / 1.5);
    $('g').style.backgroundPosition = `0 ${t * 12}px`;
  }, f / 30);
  await page.screenshot({ path: `${out}/opener/f${String(f).padStart(6, '0')}.png` });
}
await browser.close();
console.log('overlays written to', out);
