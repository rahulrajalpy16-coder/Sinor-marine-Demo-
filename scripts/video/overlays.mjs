// Renders the video's title overlays as transparent 1920×1080 PNGs (intro card, a chapter title per
// segment, outro card). Usage: node overlays.mjs <narration.json> <outDir>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const [, , narrationFile, out] = process.argv;
const segments = JSON.parse(readFileSync(narrationFile, 'utf8'));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const style = `
  *{margin:0;box-sizing:border-box} body{width:1920px;height:1080px;background:transparent;font-family:Inter,'Segoe UI',system-ui,sans-serif;color:#eaf7fc}
  .k{font:600 22px ui-monospace,'DejaVu Sans Mono',monospace;letter-spacing:.42em;color:#2fd6ff}
  .chapter{position:absolute;left:50%;top:92px;transform:translateX(-50%);min-width:760px;max-width:1100px;padding:22px 40px 24px;
    background:linear-gradient(180deg,rgba(3,16,28,.92),rgba(3,16,28,.80));border:1px solid rgba(47,214,255,.45);border-radius:14px;
    box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 40px rgba(47,214,255,.12);text-align:center}
  .chapter .n{font:600 16px ui-monospace,'DejaVu Sans Mono',monospace;letter-spacing:.35em;color:#2fd6ff}
  .chapter .t{font-size:44px;font-weight:650;margin-top:6px;letter-spacing:.01em}
  .chapter .s{font-size:22px;color:#a9cbd8;margin-top:8px}
  .chapter .bar{height:3px;width:120px;margin:14px auto 0;background:linear-gradient(90deg,transparent,#2fd6ff,transparent)}
  .intro{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(2,10,18,0) 30%,rgba(2,10,18,.78) 85%),
    linear-gradient(180deg,rgba(2,10,18,.15) 0%,rgba(2,10,18,0) 40%,rgba(2,10,18,.85) 100%)}
  .intro .box{position:absolute;left:0;right:0;bottom:120px;text-align:center}
  .intro .t{font-size:84px;font-weight:700;letter-spacing:.02em;margin-top:18px;text-shadow:0 6px 40px rgba(0,0,0,.6)}
  .intro .s{font-size:28px;color:#a9cbd8;margin-top:14px}
  .outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 42%,#0c2d40 0%,#03101b 62%,#020910 100%)}
  .outro .t{font-size:76px;font-weight:700;margin-top:22px}
  .outro .s{font-size:30px;color:#a9cbd8;margin-top:14px}
  .outro .u{margin-top:46px;padding:14px 28px;border:1px solid rgba(47,214,255,.5);border-radius:10px;font:500 26px ui-monospace,'DejaVu Sans Mono',monospace;color:#cdf3ff}
  .outro .f{position:absolute;bottom:56px;font-size:18px;color:#6f93a3}
`;
const render = async (name, html) => {
  await page.setContent(`<html><head><style>${style}</style></head><body>${html}</body></html>`);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: true });
};

const chapters = segments.filter((s) => s.id !== 'intro' && s.id !== 'outro');
const intro = segments.find((s) => s.id === 'intro');
await render('intro', `<div class="intro"><div class="box"><div class="k">${intro.title}</div><div class="t">${intro.subtitle}</div>
  <div class="s">Interactive 3D digital model of a DP2 offshore support vessel</div></div></div>`);
let i = 1;
for (const c of chapters) {
  await render(c.id, `<div class="chapter"><div class="n">${String(i).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}</div>
    <div class="t">${c.title}</div><div class="s">${c.subtitle}</div><div class="bar"></div></div>`);
  i++;
}
await render('outro', `<div class="outro"><div class="k">SINOR MARINE</div><div class="t">Offshore Vessel Explorer</div>
  <div class="s">Explore every system, anywhere</div><div class="u">rahulrajalpy16-coder.github.io/Sinor-marine-Demo-</div>
  <div class="f">Representative concept for demonstration and training. Not certified equipment data.</div></div>`);
await browser.close();
console.log('overlays written to', out);
