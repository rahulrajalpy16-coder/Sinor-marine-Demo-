// Renders the caption graphics of the OEM showcase film (showcase.json) as transparent 4K PNG layers. The
// assembler (showcase_assemble.py) animates them (fade, slide, frosted glass behind the panels).
// Every layer is a full 3840 x 2160 frame, so the assembler composites them without positioning; a layer's
// glass panels (the rectangles to blur behind it) are written to layers.json.
// Usage: node showcase_overlays.mjs <showcase.json> <logo-light.png> <outDir>
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [, , specFile, logoFile, out] = process.argv;
mkdirSync(out, { recursive: true });
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const logo = `data:image/png;base64,${readFileSync(logoFile).toString('base64')}`;
const W = 3840;
const H = 2160;
const M = 200; // safe margin (about 5 %): TVs that overscan still show everything

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
body{font-family:'Inter',sans-serif;color:#fff;-webkit-font-smoothing:antialiased;position:relative}
.d{font-family:'Inter Display','Inter',sans-serif}
.abs{position:absolute}
.cy{color:#3ad2ff}
.kick{font-size:50px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:#3ad2ff}
.glass{background:linear-gradient(135deg,rgba(6,22,44,.72),rgba(4,14,30,.62));border:2px solid rgba(120,200,255,.22);border-radius:28px;
  box-shadow:0 30px 80px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)}
.shadow{text-shadow:0 4px 30px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.5)}
`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const layers = {};

async function layer(name, html, glass = []) {
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: true });
  layers[name] = { glass };
}

/** A glass rectangle drawn in the layer and listed for the assembler's blur. */
const panel = (x, y, w, h, r = 28) => ({ html: `<div class="abs glass" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px"></div>`, rect: [x, y, w, h, r] });

// ------------------------------------------------------------------------------------- persistent pieces
await layer('watermark', `<div class="abs" style="right:${M - 120}px;top:${M - 150}px;width:820px;height:400px;background:radial-gradient(ellipse at 60% 45%,rgba(2,10,24,.55) 0%,rgba(2,10,24,.25) 45%,rgba(2,10,24,0) 70%)"></div>
  <img class="abs" src="${logo}" style="right:${M - 20}px;top:${M - 70}px;width:560px;opacity:.96;filter:drop-shadow(0 4px 14px rgba(0,0,0,.6))">`);

const brands = spec.chapters.map((c) => c.brand);
for (const [i, c] of spec.chapters.entries()) {
  // Partner chip, top left, for the whole chapter.
  const p = panel(M - 40, M - 70, Math.max(820, 300 + c.brand.length * (c.brand.length > 16 ? 50 : 57)), 230, 24);
  await layer(`chip-${i}`, `${p.html}
    <div class="abs" style="left:${M + 10}px;top:${M - 32}px;width:12px;height:156px;border-radius:6px;background:linear-gradient(#3ad2ff,#1d6fe0)"></div>
    <div class="abs kick" style="left:${M + 62}px;top:${M - 30}px;font-size:40px">Technology partner</div>
    <div class="abs d" style="left:${M + 60}px;top:${M + 20}px;font-size:${c.brand.length > 16 ? 86 : 98}px;font-weight:800;letter-spacing:-.01em;white-space:nowrap">${c.brand}</div>`, [p.rect]);

  // Brand card: the interstitial between chapters (opaque).
  await layer(`brand-${i}`, `
    <div class="abs" style="inset:0;background:radial-gradient(ellipse at 30% 40%,#0d3260 0%,#06172e 45%,#020a16 100%)"></div>
    <svg class="abs" style="inset:0;opacity:.18" width="${W}" height="${H}">
      ${Array.from({ length: 28 }, (_, k) => `<path d="M0 ${1500 + k * 26} C ${W * 0.3} ${1380 + k * 30}, ${W * 0.6} ${1640 + k * 22}, ${W} ${1460 + k * 28}" stroke="#3ad2ff" stroke-width="2" fill="none" opacity="${1 - k / 30}"/>`).join('')}
    </svg>
    <svg class="abs" style="right:-300px;top:180px;opacity:.16" width="1900" height="1900" viewBox="0 0 1900 1900">
      ${Array.from({ length: 7 }, (_, k) => `<circle cx="950" cy="950" r="${190 + k * 120}" stroke="#3ad2ff" stroke-width="${k === 3 ? 6 : 2}" fill="none" opacity="${1 - k * 0.11}"/>`).join('')}
      <path d="M950 950 L1800 560" stroke="#3ad2ff" stroke-width="4" opacity=".9"/>
    </svg>
    <div class="abs kick" style="left:${M + 80}px;top:700px;font-size:60px">Technology partner · ${String(i + 1).padStart(2, '0')} / ${String(brands.length).padStart(2, '0')}</div>
    <div class="abs d" style="left:${M + 70}px;top:800px;font-size:${c.brand.length > 16 ? 250 : 290}px;font-weight:800;letter-spacing:-.025em;line-height:1">${c.brand}</div>
    <div class="abs" style="left:${M + 84}px;top:1150px;width:520px;height:12px;border-radius:6px;background:linear-gradient(90deg,#3ad2ff,#1d6fe0)"></div>
    <div class="abs" style="left:${M + 84}px;top:1220px;font-size:88px;font-weight:500;color:#cfe6ff">${c.field}</div>
    <div class="abs" style="left:${M + 84}px;top:1380px;font-size:60px;font-weight:400;color:#8fb3d6">${c.products.map((p) => p.name).join('  ·  ')}</div>`);

  // Progress rail along the bottom: the partner brands with this one lit.
  await layer(`rail-${i}`, `<div class="abs" style="left:0;right:0;bottom:0;height:230px;background:linear-gradient(0deg,rgba(2,10,22,.6),rgba(2,10,22,0))"></div><div class="abs" style="left:${M}px;right:${M}px;bottom:70px;display:flex;gap:70px;justify-content:center;align-items:center">
    ${brands.map((b, k) => `<div style="font-size:38px;font-weight:${k === i ? 700 : 500};letter-spacing:.14em;text-transform:uppercase;color:${k === i ? '#fff' : 'rgba(210,230,255,.45)'};
      ${k === i ? 'border-bottom:6px solid #3ad2ff;padding-bottom:10px' : 'padding-bottom:16px'};text-shadow:0 2px 10px rgba(0,0,0,.6)">${b}</div>`).join('')}</div>`);

  for (const pr of c.products) {
    // Product title, lower left.
    const nameSize = pr.name.length > 20 ? 150 : 180;
    const tp = panel(M - 40, 1430, Math.min(3000, 220 + pr.name.length * nameSize * 0.56), 470, 28);
    await layer(`${pr.id}-title`, `${tp.html}
      <div class="abs kick" style="left:${M + 40}px;top:1500px">${pr.category}</div>
      <div class="abs d" style="left:${M + 34}px;top:1580px;font-size:${nameSize}px;font-weight:800;letter-spacing:-.02em;white-space:nowrap">${pr.name}</div>`, [tp.rect]);

    // How it works: a panel on the left with the three steps, each a layer of its own.
    const hx = M - 40;
    const hy = 520;
    const hw = 1700;
    const hh = 1260;
    const hp = panel(hx, hy, hw, hh, 32);
    await layer(`${pr.id}-how`, `${hp.html}
      <div class="abs kick" style="left:${hx + 90}px;top:${hy + 80}px">How it works</div>
      <div class="abs d" style="left:${hx + 88}px;top:${hy + 150}px;font-size:84px;font-weight:800">${pr.name}</div>`, [hp.rect]);
    for (const [k, step] of pr.how.entries()) {
      const y = hy + 330 + k * 300;
      await layer(`${pr.id}-step${k + 1}`, `
        <div class="abs d" style="left:${hx + 90}px;top:${y}px;width:120px;height:120px;border-radius:60px;border:5px solid #3ad2ff;color:#3ad2ff;
          font-size:64px;font-weight:800;display:flex;align-items:center;justify-content:center">${k + 1}</div>
        <div class="abs" style="left:${hx + 260}px;top:${y - 6}px;width:${hw - 340}px;font-size:70px;line-height:1.22;font-weight:600">${step}</div>`);
    }

    // Key advantages: three tiles stacked on the left (the system screen or shot fills the right).
    const tw = 1320;
    const th = 390;
    const tx = M - 40;
    const ty = 600;
    await layer(`${pr.id}-advhead`, `<div class="abs" style="left:${M - 60}px;top:${ty - 150}px;width:900px;height:150px;background:radial-gradient(ellipse at 35% 55%,rgba(2,10,24,.6) 0%,rgba(2,10,24,0) 70%)"></div><div class="abs kick shadow" style="left:${M}px;top:${ty - 100}px;font-size:54px">Key advantages</div>`);
    for (const [k, a] of pr.adv.entries()) {
      const y = ty + k * (th + 40);
      const ap = panel(tx, y, tw, th, 30);
      const big = a.big.length > 9 ? 116 : 140;
      await layer(`${pr.id}-adv${k + 1}`, `${ap.html}
        <div class="abs" style="left:${tx + 70}px;top:${y + 56}px;width:90px;height:10px;border-radius:5px;background:#3ad2ff"></div>
        <div class="abs d" style="left:${tx + 66}px;top:${y + 84}px;font-size:${big}px;line-height:1.1;font-weight:800;letter-spacing:-.02em;white-space:nowrap;color:#fff">${a.big}</div>
        <div class="abs" style="left:${tx + 70}px;top:${y + 104 + big * 1.1}px;width:${tw - 140}px;font-size:54px;line-height:1.2;font-weight:500;color:#d6e9ff">${a.small}</div>`, [ap.rect]);
    }
  }
}

// ------------------------------------------------------------------------------------------ intro / finale
const it = spec.intro;
await layer('intro-title', `
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(2,10,22,.78) 0%,rgba(2,10,22,.45) 45%,rgba(2,10,22,0) 70%)"></div>
  <div class="abs kick" style="left:${M}px;top:820px;font-size:56px">${it.kicker}</div>
  <div class="abs d shadow" style="left:${M - 6}px;top:910px;width:2300px;font-size:190px;font-weight:800;line-height:1.02;letter-spacing:-.025em">${it.headline}</div>
  <div class="abs" style="left:${M}px;top:1350px;width:520px;height:12px;border-radius:6px;background:linear-gradient(90deg,#3ad2ff,#1d6fe0)"></div>
  <div class="abs shadow" style="left:${M}px;top:1420px;width:2100px;font-size:76px;font-weight:500;color:#d8ebff;line-height:1.25">${it.sub}</div>`);
await layer('intro-pillars', `
  <div class="abs" style="inset:0;background:linear-gradient(0deg,rgba(2,10,22,.75) 0%,rgba(2,10,22,0) 45%)"></div>
  <div class="abs" style="left:0;right:0;top:1560px;display:flex;justify-content:center;gap:120px">
    ${it.pillars.map((p, k) => `<div style="text-align:center"><div class="kick" style="font-size:44px">${String(k + 1).padStart(2, '0')}</div>
      <div class="d shadow" style="font-size:150px;font-weight:800;letter-spacing:-.02em">${p}</div></div>`).join('<div class="d" style="font-size:150px;font-weight:300;color:#3ad2ff;padding-top:60px">·</div>')}
  </div>`);

const fi = spec.finale;
await layer('finale-head', `
  <div class="abs" style="inset:0;background:linear-gradient(0deg,rgba(2,10,22,.82) 0%,rgba(2,10,22,.35) 40%,rgba(2,10,22,0) 60%)"></div>
  <div class="abs d shadow" style="left:0;right:0;top:1520px;text-align:center;font-size:190px;font-weight:800;letter-spacing:-.025em">${fi.headline}</div>
  <div class="abs kick shadow" style="left:0;right:0;top:1770px;text-align:center;font-size:58px">${fi.sub}</div>`);
await layer('finale-tag', `
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(2,10,22,.65) 0%,rgba(2,10,22,.2) 60%,rgba(2,10,22,0) 80%)"></div>
  <div class="abs kick shadow" style="left:0;right:0;top:880px;text-align:center;font-size:64px">${fi.tagline1}</div>
  <div class="abs d shadow" style="left:0;right:0;top:980px;text-align:center;font-size:230px;font-weight:800;letter-spacing:-.025em">${fi.tagline2}</div>`);
await layer('endcard', `
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 45%,#0d3260 0%,#06172e 50%,#020a16 100%)"></div>
  <img class="abs" src="${logo}" style="left:${(W - 1900) / 2}px;top:560px;width:1900px">
  <div class="abs" style="left:${(W - 520) / 2}px;top:1390px;width:520px;height:10px;border-radius:5px;background:linear-gradient(90deg,#3ad2ff,#1d6fe0)"></div>
  <div class="abs d" style="left:0;right:0;top:1460px;text-align:center;font-size:110px;font-weight:700;color:#fff">${fi.tagline2}</div>
  <div class="abs kick" style="left:0;right:0;top:1640px;text-align:center;font-size:52px">${fi.tagline1}</div>`);

writeFileSync(`${out}/layers.json`, JSON.stringify(layers, null, 1));
await browser.close();
console.log('overlays', Object.keys(layers).length);
