// Graphics for the story film (story.json) at 1920×1080: chapter titles, the tagline, the simulator title,
// the devices stage (backdrop and bezels for a television, a laptop and a phone) and the end card.
// Usage: node story_overlays.mjs <story.json> <outDir> <logo.png (light, transparent)>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const [, , storyFile, out, logoFile] = process.argv;
const story = JSON.parse(readFileSync(storyFile, 'utf8'));
mkdirSync(out, { recursive: true });
const logo = `data:image/png;base64,${readFileSync(logoFile).toString('base64')}`;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// Device screen rectangles on the devices stage (also used by the assembler).
const DEV = {
  laptop: { x: 600, y: 318, w: 864, h: 486 },
  tv: { x: 70, y: 236, w: 576, h: 324 },
  phone: { x: 1546, y: 300, w: 234, h: 507 },
};
writeFileSync(`${out}/devices.json`, JSON.stringify(DEV, null, 1));

const style = `
  *{margin:0;box-sizing:border-box}
  body{width:1920px;height:1080px;background:transparent;font-family:Inter,system-ui,sans-serif;color:#F4F8FC;overflow:hidden}
  .navy{position:absolute;inset:0;background:radial-gradient(ellipse 75% 65% at 50% 45%,#0c2c40 0%,#04121f 58%,#01060e 100%)}
  .grid{position:absolute;inset:0;opacity:.16;background-image:linear-gradient(rgba(0,217,255,.35) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,217,255,.35) 1px,transparent 1px);background-size:80px 80px;
    -webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 55%,#000 10%,transparent 75%)}
  .floor{position:absolute;left:0;right:0;top:860px;bottom:0;background:linear-gradient(180deg,rgba(0,217,255,.07),transparent 70%)}
  .rule{height:2px;background:linear-gradient(90deg,transparent,#00D9FF 30%,#67F0FF 50%,#00D9FF 70%,transparent)}
  .lrule{height:2px;background:linear-gradient(90deg,#00D9FF,rgba(0,217,255,0))}
  /* chapter title: top left, clear of the subtitles; sized for a 55 inch TV */
  .chapbg{position:absolute;left:0;top:0;width:1300px;height:520px;background:radial-gradient(ellipse 60% 55% at 22% 30%,rgba(2,8,19,.82) 0%,rgba(2,8,19,.5) 45%,rgba(2,8,19,0) 100%)}
  .chap{position:absolute;left:110px;top:92px;display:flex;align-items:flex-start;gap:26px;
    filter:drop-shadow(0 6px 26px rgba(0,0,0,.75))}
  .chap .n{font:200 132px Inter;line-height:.9;color:#00D9FF;letter-spacing:-.02em}
  .chap .r{padding-top:20px}
  .chap .k{font:600 17px 'JetBrains Mono',monospace;letter-spacing:.42em;color:#9fdcf0}
  .chap .t{font:600 76px Inter;letter-spacing:-.01em;margin-top:6px}
  .chap .lrule{width:480px;margin-top:18px}
  .tag{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(ellipse 55% 42% at 50% 50%,rgba(2,8,19,.6) 0%,rgba(2,8,19,.22) 60%,rgba(2,8,19,0) 100%)}
  .tag .t{font:300 88px Inter;letter-spacing:-.01em;margin-top:26px;text-shadow:0 8px 50px rgba(0,0,0,.7)}
  .tag .rule{width:520px;margin-top:28px}
  .head{position:absolute;top:84px;left:0;right:0;text-align:center}
  .head .k{font:600 18px 'JetBrains Mono',monospace;letter-spacing:.42em;padding-left:.42em;color:#00D9FF}
  .head .t{font:600 54px Inter;margin-top:10px;letter-spacing:-.01em}
  .bez{position:absolute;border-radius:10px;box-shadow:0 0 0 14px #0b141c,0 0 0 16px #2a3a48,0 40px 90px rgba(0,0,0,.75)}
  .end{position:absolute;inset:0}
  .end .brand{position:absolute;left:0;right:0;top:170px;text-align:center}
  .end .t{font:300 84px Inter;letter-spacing:-.01em;margin-top:34px}
  .end .s{font:400 30px Inter;color:#a8c4d4;margin-top:16px}
  .end .rule{width:560px;margin:30px auto 0}
  .end .excl{position:absolute;left:50%;top:790px;transform:translateX(-50%);text-align:center;white-space:nowrap;
    padding:22px 56px;border:1px solid rgba(0,217,255,.4);border-radius:6px;background:rgba(2,8,19,.6)}
  .end .excl .k2{font:600 20px 'JetBrains Mono',monospace;letter-spacing:.42em;color:#00D9FF;padding-left:.42em}
  .end .f{position:absolute;bottom:40px;left:0;right:0;text-align:center;font:400 16px Inter;color:#5f7f92}
`;
const shot = async (name, html, transparent = true) => {
  await page.setContent(`<html><head><style>${style}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: transparent });
};
const mark = (h) => `<img src="${logo}" style="height:${h}px;max-width:${h * 5}px;object-fit:contain">`;

for (const s of story.filter((x) => x.chapter)) {
  const [n, t] = s.chapter;
  await shot(`chapter-${s.id}`, `<div class="chapbg"></div><div class="chap"><div class="n">${n}</div><div class="r">
    <div class="t">${t}</div><div class="lrule"></div></div></div>`);
}
await shot('tagline', `<div class="tag">${mark(130)}<div class="t">We bring the vessel to you</div><div class="rule"></div></div>`);

const d = DEV;
await shot('devices-bg', `<div class="navy"></div><div class="grid"></div><div class="floor"></div>`, false);
await shot('devices-head', `<div class="head"><div class="k">AN EXCLUSIVE SINOR MARINE INITIATIVE</div><div class="t">Vessel Systems Simulator</div></div>`);
// Bezels: drawn around the screen rectangles (screens themselves stay transparent).
await shot('bezel-laptop', `<div class="bez" style="left:${d.laptop.x}px;top:${d.laptop.y}px;width:${d.laptop.w}px;height:${d.laptop.h}px;border-radius:12px 12px 2px 2px"></div>
  <div style="position:absolute;left:${d.laptop.x - 70}px;top:${d.laptop.y + d.laptop.h + 16}px;width:${d.laptop.w + 140}px;height:22px;border-radius:0 0 22px 22px;background:linear-gradient(180deg,#3a4a58,#141c24)"></div>
  <div style="position:absolute;left:${d.laptop.x + d.laptop.w / 2 - 70}px;top:${d.laptop.y + d.laptop.h + 16}px;width:140px;height:8px;border-radius:0 0 8px 8px;background:#0b141c"></div>`);
await shot('bezel-tv', `<div class="bez" style="left:${d.tv.x}px;top:${d.tv.y}px;width:${d.tv.w}px;height:${d.tv.h}px;border-radius:4px"></div>
  <div style="position:absolute;left:${d.tv.x + d.tv.w / 2 - 12}px;top:${d.tv.y + d.tv.h + 16}px;width:24px;height:70px;background:linear-gradient(90deg,#1a242d,#3a4a58,#1a242d)"></div>
  <div style="position:absolute;left:${d.tv.x + d.tv.w / 2 - 110}px;top:${d.tv.y + d.tv.h + 84}px;width:220px;height:12px;border-radius:6px;background:linear-gradient(180deg,#3a4a58,#141c24)"></div>`);
await shot('bezel-phone', `<div class="bez" style="left:${d.phone.x}px;top:${d.phone.y}px;width:${d.phone.w}px;height:${d.phone.h}px;border-radius:34px"></div>
  <div style="position:absolute;left:${d.phone.x + d.phone.w / 2 - 38}px;top:${d.phone.y + 10}px;width:76px;height:20px;border-radius:10px;background:#0b141c"></div>`);

await shot('endcard', `<div class="navy"></div><div class="grid"></div><div class="end">
  <div class="brand">${mark(220)}<div class="t">We bring the vessel to you</div>
  <div class="s">Vessel Systems Simulator</div><div class="rule"></div></div>
  <div class="excl"><div class="k2">AN EXCLUSIVE SINOR MARINE INITIATIVE</div></div>
  <div class="f">Sinor Marine system simulation for training and demonstration. Not connected to live vessel systems.</div></div>`, false);
await browser.close();
console.log('overlays written to', out);
