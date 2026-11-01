"""Assembles the OEM showcase film (showcase.json) in 4K (3840 x 2160, 30 fps) from the captured footage
(showcase.mjs: 3D shots at 1920 x 1080, system screens at 3840 x 2160), the caption layers
(showcase_overlays.mjs) and the score (showcase_score.py).

The film is silent-friendly: everything is told by captions. Structure:
  intro    the vessel on station (title), then the X-ray of the systems inside the hull (pillars)
  chapter  per partner brand: a brand card, then per product a 3D shot (title, then "How it works" with
           three steps) and a second shot or the system's own screen (three "Key advantages" tiles)
  finale   the DP screen with every reference ("Every reference. One position."), the aerial shot with the
           tagline, and the end card
The Sinor Marine logo stays in the top right corner throughout (watermark), and while a partner's systems are
on screen its name stays in the top left (partner chip) with a rail of all partners along the bottom.

Every frame is composed here in Python: 3D shots upscaled (Lanczos and a light sharpen) and graded, screens
shown as a card with a slow push, crossfades, and the caption layers with fades, slides and a frosted glass
blur behind their panels. ffmpeg encodes two files:
  <out>          the TV master: H.264 High, level 5.1, 3840 x 2160, 30 fps, yuv420p, BT.709, about 20 Mbps
                 (Samsung Crystal UHD TVs play H.264 4K up to 60 Mbps from USB), AAC 48 kHz stereo
  <out>-web.mp4  the same film at a size budget (TARGET_MB, default 92) for GitHub Pages and phones

Usage: python3 showcase_assemble.py <captureDir> <overlayDir> <showcase.json> <music.wav> <out.mp4>
Environment: RETAKES=<captureDir> (shots filmed again), PREVIEW=1 (quick single-pass encode, half resolution), FROM/TO (seconds), JOBS (default 4),
             TARGET_MB, MASTER_MBPS (default 20).
"""
import json
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

cap, ov, spec_file, music, out = sys.argv[1:6]
FPS = 30
W, H = 3840, 2160
PREVIEW = bool(os.environ.get("PREVIEW"))
spec = json.load(open(spec_file))
TL = {k: json.load(open(f"{cap}/{k}/timeline.json")) for k in ("shots", "screens")}
# Shots re-filmed later (RETAKES=<captureDir>) replace the originals of the same name.
RETAKE_DIR = os.environ.get("RETAKES")
RETAKE = json.load(open(f"{RETAKE_DIR}/shots/timeline.json")) if RETAKE_DIR else {}
META = ("fps", "frames", "end")


def shot_src(s):
    """(timeline, directory) holding shot s."""
    return (RETAKE, f"{RETAKE_DIR}/shots") if s in RETAKE and s not in META else (TL["shots"], f"{cap}/shots")
LAYERS = json.load(open(f"{ov}/layers.json"))

# Which footage goes with which product: the 3D shot (A) and the second shot or screen (B).
SHOT_A = {"mt-dp": "dp", "mt-ibs": "ibs", "zthrust": "bt", "seastar": "dgps", "hpr": "hprx", "sprintnav": "sn",
          "cyscan": "cys", "radascan": "rada", "tautwire": "tw"}
SHOT_B = {"mt-dp": ("screen", "dp-hmi"), "mt-ibs": ("shot", "ibs2"), "zthrust": ("screen", "zthrust-hmi"),
          "seastar": ("screen", "dgps-hmi"), "hpr": ("screen", "hpr-hmi"), "sprintnav": ("screen", "sprintnav-hmi"),
          "cyscan": ("screen", "cyscan-hmi"), "radascan": ("screen", "radascan-hmi"), "tautwire": ("screen", "tautwire-hmi")}
GRADE = {"xray": "holo", "bt": "holo", "hprx": "holo"}

# ---------------------------------------------------------------------------------------------- the edit
clips = []  # kind, start, dur, xin (crossfade in) + kind fields
overlays = []  # layer, t0, t1, fade in, fade out, slide (dx, dy) at the start
X = 0.45  # crossfade


def add(kind, start, dur, xin=X, **kw):
    clips.append(dict(kind=kind, start=start, dur=dur, xin=xin, **kw))
    return start + dur


def shot_len(s):
    tl, _ = shot_src(s)
    nxt = sorted(v for k, v in tl.items() if isinstance(v, (int, float)) and k not in ("fps", "frames") and v > tl[s])
    return (nxt[0] if nxt else tl["frames"] / FPS) - tl[s]


def ov_add(name, t0, t1, fi=0.5, fo=0.4, slide=(0, 0)):
    overlays.append((name, t0, t1, fi, fo, slide))


t = 0.0
# Intro: the vessel on station, then the systems inside the hull.
end = add("shot", t, shot_len("wide"), 0.0, shot="wide")
ov_add("intro-title", 1.0, end - 0.1, 0.8, 0.5, (0, 50))
t = end - X
end = add("shot", t, shot_len("xray"), shot="xray")
ov_add("intro-pillars", t + 0.6, end - 0.1, 0.6, 0.45, (0, 40))
t = end - X

BRAND = 2.8
for ci, ch in enumerate(spec["chapters"]):
    end = add("brand", t, BRAND, layer=f"brand-{ci}")
    t = end - X
    c0 = t
    for pr in ch["products"]:
        a = SHOT_A[pr["id"]]
        da = shot_len(a)
        end = add("shot", t, da, shot=a)
        ov_add(f"{pr['id']}-title", t + 0.35, t + 2.75, 0.5, 0.35, (-60, 0))
        ov_add(f"{pr['id']}-how", t + 2.6, end - 0.05, 0.45, 0.3, (-60, 0))
        for k in range(3):
            ov_add(f"{pr['id']}-step{k + 1}", t + 2.95 + k * 1.05, end - 0.05, 0.4, 0.3, (40, 0))
        t = end - X
        kind, ref = SHOT_B[pr["id"]]
        if kind == "screen":
            db = 7.0
            end = add("screen", t, db, screen=ref)
        else:
            db = shot_len(ref)
            end = add("shot", t, db, shot=ref)
        ov_add(f"{pr['id']}-advhead", t + 0.3, end - 0.05, 0.4, 0.3, (-40, 0))
        for k in range(3):
            ov_add(f"{pr['id']}-adv{k + 1}", t + 0.45 + k * 0.4, end - 0.05, 0.45, 0.3, (-70, 0))
        t = end - X
    ov_add(f"chip-{ci}", c0 + 0.2, t + X - 0.05, 0.5, 0.35, (-40, 0))
    ov_add(f"rail-{ci}", c0 + 0.2, t + X - 0.05, 0.5, 0.35)

# Finale.
end = add("screen", t, 7.0, screen="dp-refs", full=True, crop_h=0.792)  # the reference list only, without the consequence and alarm lines below
ov_add("finale-head", t + 0.8, end - 0.1, 0.6, 0.45, (0, 40))
t = end - X
end = add("shot", t, shot_len("aerial"), shot="aerial")
ov_add("finale-tag", t + 1.2, end - 0.3, 0.8, 0.6, (0, 40))
t = end - 0.8
ENDCARD = 6.5
end = add("endcard", t, ENDCARD, 0.8)
TOTAL = end
WATERMARK = (0.8, TOTAL - ENDCARD + 0.4)

# ---------------------------------------------------------------------------------------------- frames
_cache = {}


def layer(name):
    """A caption layer cropped to its visible area: (x, y, rgb uint8, alpha uint8, glass)."""
    if name not in _cache:
        im = np.asarray(Image.open(f"{ov}/{name}.png").convert("RGBA"))
        a = im[..., 3]
        ys, xs = np.nonzero(a)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        glass = []
        for gx, gy, gw, gh, r in (map(round, g) for g in LAYERS[name]["glass"]):
            m = Image.new("L", (gw, gh), 0)
            ImageDraw.Draw(m).rounded_rectangle((0, 0, gw - 1, gh - 1), r, fill=255)
            glass.append((gx, gy, gw, gh, np.asarray(m, np.float32)[..., None] / 255))
        _cache[name] = (x0, y0, im[y0:y1, x0:x1, :3].copy(), a[y0:y1, x0:x1, None].copy(), glass)
    return _cache[name]


def image(path):
    if path not in _cache:
        _cache[path] = np.asarray(Image.open(path).convert("RGB"), np.float32) / 255
    return _cache[path]


def vignette(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r2 = ((xx - w / 2) / (w / 2)) ** 2 * 0.8 + ((yy - h / 2) / (h / 2)) ** 2 * 0.6
    return {k: (1 - a * np.clip(r2, 0, 1.6) ** 1.3)[..., None].astype(np.float32) for k, a in (("real", 0.26), ("holo", 0.22), ("none", 0.0))}


VIG = vignette(W, H)
VIG_HD = vignette(1920, 1080)  # the 3D shots are graded before the upscale (a quarter of the work)
# Screen card stage: deep navy with a soft light behind the screen.
gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
STAGE = (np.array([0.008, 0.035, 0.075], np.float32) + np.array([0.03, 0.09, 0.17], np.float32)
         * np.exp(-(((gx - 2600) / 1500) ** 2 + ((gy - 1080) / 1000) ** 2))[..., None]).astype(np.float32)
del gy, gx


def grade(x, kind, vig=None):
    if kind == "real":
        x = 0.5 + (x - 0.5) * 1.1
        x = np.clip(x, 0, 1) ** 1.04
        lum = (x * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
        x = lum + (x - lum) * 1.14
        sh = np.clip(1 - lum * 2, 0, 1)
        hi = np.clip(lum * 2 - 1, 0, 1)
        x = x + sh * np.array([-0.01, 0.004, 0.02], np.float32) + hi * np.array([0.022, 0.01, -0.016], np.float32)
    elif kind == "holo":
        x = 0.5 + (x - 0.5) * 1.06
        lum = (x * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
        x = lum + (x - lum) * 1.08
    return np.clip(x * (vig or VIG)[kind], 0, 1)


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def shot_frame(c, t):
    s = c["shot"]
    tl, d = shot_src(s)
    i = min(tl["frames"] - 1, round(tl[s] * FPS) + round((t - c["start"]) * FPS))
    x = grade(np.asarray(Image.open(f"{d}/f{i:06d}.jpg").convert("RGB"), np.float32) / 255, GRADE.get(s, "real"), VIG_HD)
    im = Image.fromarray((x * 255 + 0.5).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=45, threshold=1))
    return np.asarray(im, np.float32) / 255


def screen_frame(c, t):
    sc = c["screen"]
    n = TL["screens"]["frames"]
    i = min(n - 1, round(TL["screens"][sc] * FPS) + int((t - c["start"]) * 15))
    im = Image.open(f"{cap}/screens/f{i:06d}.jpg").convert("RGB")
    bx, by, bw, bh = [v * 2 for v in TL["screens"]["boxes"][sc]]
    pad = 6
    bh = round(bh * c.get("crop_h", 1.0))
    im = im.crop((bx - pad, by - pad, bx + bw + pad, by + bh + pad))
    # Fit region: the right of the frame (the advantage tiles are on the left), or centred for the finale.
    rx, ry, rw, rh = (360, 150, 3120, 1300) if c.get("full") else (1520, 400, 2220, 1600)
    u = ease((t - c["start"]) / c["dur"])
    k = min(rw / im.width, rh / im.height) * (0.97 + 0.04 * u)
    w, h = round(im.width * k), round(im.height * k)
    x, y = rx + (rw - w) // 2, ry + (rh - h) // 2
    frame = STAGE.copy()
    # Shadow and a thin cyan edge around the screen.
    frame[max(0, y + 30): y + h + 60, max(0, x - 10): x + w + 40] *= 0.55
    frame[y - 4: y + h + 4, x - 4: x + w + 4] = np.array([0.16, 0.55, 0.75], np.float32)
    frame[y: y + h, x: x + w] = np.asarray(im.resize((w, h), Image.LANCZOS), np.float32) / 255
    return np.clip(frame * VIG["none"], 0, 1)


def brand_frame(c, t):
    u = (t - c["start"]) / c["dur"]
    base = image(f"{ov}/{c['layer']}.png").copy()
    # A slow light sweep across the card.
    sweep = np.exp(-((np.arange(W, dtype=np.float32) - (-600 + 5000 * u)) / 700) ** 2) * 0.05
    return np.clip(base + sweep[None, :, None] * np.array([0.4, 0.8, 1.0], np.float32), 0, 1)


def endcard_frame(c, t):
    u = (t - c["start"]) / c["dur"]
    z = 1 + 0.03 * u
    im = Image.open(f"{ov}/endcard.png").convert("RGB")
    w, h = W / z, H / z
    im = im.resize((W, H), Image.LANCZOS, box=((W - w) / 2, (H - h) / 2, (W + w) / 2, (H + h) / 2))
    return np.asarray(im, np.float32) / 255


KIND = {"shot": shot_frame, "screen": screen_frame, "brand": brand_frame, "endcard": endcard_frame}


def blur_region(frame, x, y, w, h):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    reg = Image.fromarray((frame[y0:y1, x0:x1] * 255).astype(np.uint8))
    sw, sh = max(1, (x1 - x0) // 10), max(1, (y1 - y0) // 10)
    reg = reg.resize((sw, sh), Image.BOX).filter(ImageFilter.GaussianBlur(3)).resize((x1 - x0, y1 - y0), Image.BILINEAR)
    return np.asarray(reg, np.float32) / 255, (x0, y0, x1, y1)


def composite(frame, name, alpha, dx, dy):
    x0, y0, rgb, a, glass = layer(name)
    for gx, gy, gw, gh, m in glass:  # frosted glass behind the panels
        b, (bx0, by0, bx1, by1) = blur_region(frame, gx + dx, gy + dy, gw, gh)
        mm = m[by0 - (gy + dy): by1 - (gy + dy), bx0 - (gx + dx): bx1 - (gx + dx)] * alpha
        frame[by0:by1, bx0:bx1] = frame[by0:by1, bx0:bx1] * (1 - mm) + b * mm
    x, y = x0 + dx, y0 + dy
    h, w = a.shape[:2]
    xa, ya, xb, yb = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if xb <= xa or yb <= ya:
        return
    aa = a[ya - y: yb - y, xa - x: xb - x].astype(np.float32) * (alpha / 255)
    cc = rgb[ya - y: yb - y, xa - x: xb - x].astype(np.float32) / 255
    frame[ya:yb, xa:xb] = frame[ya:yb, xa:xb] * (1 - aa) + cc * aa


def render(i):
    t = i / FPS
    act = [c for c in clips if c["start"] - 1e-6 <= t < c["start"] + c["dur"]]
    frame = None
    for c in act:  # later clips cross-fade in over earlier ones
        f = KIND[c["kind"]](c, t)
        a = 1.0 if c["xin"] <= 0 else ease((t - c["start"]) / c["xin"])
        frame = f if frame is None or a >= 1 else frame * (1 - a) + f * a
    if frame is None:
        frame = np.zeros((H, W, 3), np.float32)
    for name, s0, s1, fi, fo, (sx, sy) in overlays:
        if s0 <= t < s1:
            a = min(1.0, ease((t - s0) / fi), ease((s1 - t) / fo))
            k = 1 - ease((t - s0) / (fi * 1.6))
            composite(frame, name, a, round(sx * k), round(sy * k))
    if WATERMARK[0] <= t < WATERMARK[1]:
        composite(frame, "watermark", min(1.0, ease((t - WATERMARK[0]) / 1.0), ease((WATERMARK[1] - t) / 0.6)), 0, 0)
    if t < 0.8:
        frame *= ease(t / 0.8)
    if t > TOTAL - 1.0:
        frame *= ease((TOTAL - t) / 1.0)
    out8 = (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8)
    if PREVIEW:
        out8 = np.asarray(Image.fromarray(out8).resize((W // 2, H // 2), Image.BILINEAR))
    return out8.tobytes()


def run(cmd):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *cmd], check=True)


if __name__ == "__main__":
    work = os.path.join(os.path.dirname(os.path.abspath(out)), "work")
    os.makedirs(work, exist_ok=True)
    json.dump({"total": TOTAL, "clips": clips, "overlays": overlays}, open(f"{work}/edit.json", "w"), indent=1)
    print(f"film {TOTAL:.1f} s, {len(clips)} clips, {len(overlays)} caption layers")
    t_from = float(os.environ.get("FROM", 0))
    t_to = min(TOTAL, float(os.environ.get("TO", TOTAL)))
    frames = range(round(t_from * FPS), round(t_to * FPS))
    ow, oh = (W // 2, H // 2) if PREVIEW else (W, H)
    inter = f"{work}/video.mkv"
    # Intermediate: near lossless, so the two final encodes start from the same picture.
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "ultrafast" if PREVIEW else "veryfast", "-crf", "20" if PREVIEW else "8",
                            "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                            "-vf", "scale=out_color_matrix=bt709:flags=lanczos", inter], stdin=subprocess.PIPE)
    with Pool(int(os.environ.get("JOBS", 4))) as pool:
        for k, buf in enumerate(pool.imap(render, frames, chunksize=4)):
            enc.stdin.write(buf)
            if k % 150 == 0:
                print(f"frame {k}/{len(frames)}", flush=True)
    enc.stdin.close()
    enc.wait()

    dur = (t_to - t_from)
    audio = ["-ss", str(t_from), "-t", str(dur), "-i", music]
    common_v = ["-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                "-g", "60", "-keyint_min", "30", "-sc_threshold", "0", "-movflags", "+faststart", "-tag:v", "avc1"]
    common_a = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest"]
    if PREVIEW:
        run(["-i", inter, *audio, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", *common_v, *common_a, out])
        sys.exit(0)
    mbps = float(os.environ.get("MASTER_MBPS", 20))
    run(["-i", inter, *audio, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-profile:v", "high", "-level:v", "5.1", "-preset", "slow",
         "-b:v", f"{mbps}M", "-maxrate", f"{mbps * 1.6:.0f}M", "-bufsize", f"{mbps * 2:.0f}M", *common_v, *common_a, out])
    target = float(os.environ.get("TARGET_MB", 92))
    vbit = target * 8 * 1024 * 1024 / dur - 128_000
    web = out[:-4] + "-web.mp4"
    for p in (1, 2):
        run(["-i", inter, *audio, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-profile:v", "high", "-level:v", "5.1", "-preset", "slow",
             "-b:v", str(int(vbit)), "-maxrate", str(int(vbit * 2)), "-bufsize", str(int(vbit * 4)), "-pass", str(p), "-passlogfile", f"{work}/x264",
             *common_v, *(["-an", "-f", "null", "/dev/null"] if p == 1 else ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-shortest", web])])
    print("done", out, web)
