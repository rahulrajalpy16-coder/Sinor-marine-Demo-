"""Assembles the story film (story.json) from the captured footage (story.mjs, capture.mjs phone/tv), the
graphics (story_overlays.mjs), the voice-over (voice.py) and the score (score.py).

The edit is built from the narration: every cut, title and effect is placed relative to the sentence it
belongs to, and the system screens are slid in time so that each event (the wind sensors failing, the
generator trip, the UPS going to battery, the gyro being rejected) happens on the word that describes it.

Every output frame is composed here in Python: screen close-ups cropped from the double-density captures
with a slow push, a colour grade per kind of shot, crossfades, a power flicker at the generator trip, a
digital glitch where the simulator's interface appears, the pull back into a laptop with a television and a
phone, chapter titles and the tagline. ffmpeg then burns in the subtitles, mixes voice, ducked music and
effects, and encodes 1080p30 H.264 (two passes, to a size budget) with AAC.

Usage: python3 story_assemble.py <captureDir> <voDir> <overlayDir> <story.json> <score.py> <logoClip.mp4> <out.mp4>
Environment: TARGET_MB (default 62), PREVIEW=1 (quick single-pass encode), FROM/TO (render a time range, seconds).
"""
import json
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

cap, vo, ov, story_file, score_py, logo_clip, out = sys.argv[1:8]
work = os.path.join(os.path.dirname(os.path.abspath(out)), "work")
os.makedirs(work, exist_ok=True)
FPS = 30
W, H = 1920, 1080
dur = json.load(open(f"{vo}/durations.json"))
caps = json.load(open(f"{vo}/captions.json"))
story = {s["id"]: s for s in json.load(open(story_file))}
TL = {k: json.load(open(f"{cap}/{k}/timeline.json")) for k in ("shots", "screens", "phone", "tv")}
DEV = json.load(open(f"{ov}/devices.json"))


def cs(seg, i):
    """Start of caption i of a segment, seconds from the segment start."""
    return caps[seg][i][0]


def ce(seg, i):
    return caps[seg][i][1]


def fr(session, mark):
    return round(TL[session][mark] * FPS)


# ---------------------------------------------------------------------------------------------- the edit
clips = []  # dicts: kind, start, dur, xin (crossfade in), plus kind-specific fields
vo_at = {}
events = {}


def add(kind, start, d, xin=0.0, **kw):
    clips.append(dict(kind=kind, start=start, dur=d, xin=xin, **kw))


# Act 1: the vessel on station, the systems out of sight.
vo_at["cold"] = 1.4
side0 = vo_at["cold"] + dur["cold"] + 0.1
add("shot", 0.0, side0 + 0.8, 0.0, shot="wide", grade="real")
vo_at["hidden"] = side0 + 0.8
under0 = vo_at["hidden"] + cs("hidden", 1) - 0.2
add("shot", side0, under0 - side0 + 0.5, 0.8, shot="side", grade="real")
xray0 = vo_at["hidden"] + cs("hidden", 1) + 1.6
add("shot", under0, xray0 - under0 + 0.6, 0.5, shot="under", grade="real")
mast0 = vo_at["hidden"] + dur["hidden"] + 0.9

add("shot", xray0, mast0 - xray0 + 0.3, 0.6, shot="xray", grade="holo")

# 01 The wind: the mast, then the wind screen with the failure on "both wind sensors fail".
vo_at["wind"] = mast0 + 0.7
wscr0 = vo_at["wind"] + cs("wind", 1) - 0.5
add("shot", mast0, wscr0 - mast0, 0.3, shot="mast", grade="real", chapter="wind")
events["wind_fault"] = vo_at["wind"] + cs("wind", 1) + 0.5
wend = vo_at["wind"] + dur["wind"] + 0.7
add("screen", wscr0, wend - wscr0 + 1.1, 0.0, mark="wind-fault", at=events["wind_fault"],
    crop=([310, 349, 1299, 731], [310, 12, 1299, 731]))

# 02 Blackout: the engine room, then the single line diagram; the trip lands on "trips".
gens0 = wend + 0.8
vo_at["trip"] = gens0 + 1.0
events["trip"] = vo_at["trip"] + ce("trip", 0) - 0.1
sld0 = events["trip"] - 0.8
add("shot", gens0, sld0 - gens0, 0.3, shot="gens", grade="holo", chapter="trip")
vo_at["recover"] = vo_at["trip"] + dur["trip"] + 1.2
rend = vo_at["recover"] + dur["recover"] + 0.7
# The dead bus lasts only a moment in the simulation: slowed for 3.5 s so it is seen while "goes dark" is said.
add("screen", sld0, rend - sld0 + 1.1, 0.0, mark="trip", at=events["trip"], flicker=events["trip"], slow=(3.5, 0.45),
    crop=([310, 12, 1299, 731], [350, 36, 1190, 669]))
events["restored"] = events["trip"] + 3.5 + (TL["screens"]["restored"] - TL["screens"]["trip"] - 3.5 * 0.45)

# 03 No-break power: the UPS room, then the UPS screen going to battery.
upsr0 = rend + 0.8
vo_at["ups"] = upsr0 + 1.0
uscr0 = upsr0 + 2.4
add("shot", upsr0, uscr0 - upsr0 + 0.3, 0.3, shot="upsroom", grade="holo", chapter="ups")
events["batt"] = vo_at["ups"] + 2.6
uend = vo_at["ups"] + dur["ups"] + 0.6
add("screen", uscr0, uend - uscr0 + 1.1, 0.3, mark="batt", at=events["batt"],
    crop=([310, 12, 1299, 731], [330, 40, 1270, 714]))

# 04 True heading: the heading screen, the drifting gyro rejected on "out-vote it".
gyro0 = uend + 0.8
vo_at["gyro"] = gyro0 + 0.8
# The drift is shown from its start, so the rejection follows the captured lead-in (it lands near "out-vote it").
events["reject"] = gyro0 + min(0.55 * dur["gyro"] + 0.8, TL["screens"]["reject"] - TL["screens"]["gyro"])
gend = vo_at["gyro"] + dur["gyro"] + 0.8
add("screen", gyro0, gend - gyro0, 0.3, mark="reject", at=events["reject"], chapter="gyro",
    crop=([310, 12, 1299, 731], [520, 110, 880, 495]))

# Together: rising over the deck.
crane0 = gend
vo_at["asone"] = crane0 + 0.8
cend = vo_at["asone"] + dur["asone"] + 0.9
add("shot", crane0, cend - crane0 + 0.8, 0.8, shot="crane", grade="real")

# The reveal: the interface appears ("It happened here"), then the pull back into the devices.
rev0 = cend
vo_at["reveal"] = rev0 + 0.6
events["ui"] = vo_at["reveal"] + cs("reveal", 1) - 0.1
events["pull"] = vo_at["reveal"] + cs("reveal", 1) + 1.1
PULL = 1.8
vo_at["devices"] = vo_at["reveal"] + dur["reveal"] + 0.6
dend = vo_at["devices"] + dur["devices"] + 0.6
add("devices", rev0, dend - rev0 + 0.8, 0.8)

# Why it matters, the tagline, the logo and the end card.
top0 = dend
vo_at["why"] = top0 + 0.6
tend = vo_at["why"] + dur["why"] + 0.7
add("shot", top0, tend - top0 + 0.8, 0.8, shot="top", grade="holo")
aer0 = tend
vo_at["tagline"] = aer0 + 0.8
events["tag"] = vo_at["tagline"] + cs("tagline", 1) - 0.4
aend = vo_at["tagline"] + dur["tagline"] + 1.8
add("shot", aer0, aend - aer0 + 0.8, 0.8, shot="aerial", grade="real")
logo0 = aend
LOGO = 8.5
vo_at["outro"] = logo0 + 4.4
add("logo", logo0, LOGO + 1.0, 0.8)
end0 = logo0 + LOGO
ENDCARD = 6.0
add("endcard", end0, ENDCARD, 1.0)
TOTAL = end0 + ENDCARD

overlays = []  # (name, start, stop, fade, slide)
for c in clips:
    if c.get("chapter"):
        overlays.append((f"chapter-{c['chapter']}", c["start"] + 0.25, c["start"] + 3.6, 0.45, True))
overlays.append(("tagline", events["tag"], aend + 0.4, 0.6, False))
overlays.append(("devices-head", events["pull"] + PULL - 0.2, dend + 0.6, 0.6, False))

# ---------------------------------------------------------------------------------------------- frames
_cache = {}


def asset(name):
    if name not in _cache:
        im = Image.open(name)
        _cache[name] = np.asarray(im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")).astype(np.float32) / 255
    return _cache[name]


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
R2 = ((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2 * 0.6
VIG = {k: (1 - a * np.clip(R2, 0, 1.6) ** 1.3)[..., None] for k, a in (("real", 0.30), ("holo", 0.26), ("screen", 0.16), ("none", 0.0))}


def grade(x, kind):
    if kind == "real":
        x = 0.5 + (x - 0.5) * 1.13
        x = np.clip(x, 0, 1) ** 1.06
        lum = (x * [0.299, 0.587, 0.114]).sum(-1, keepdims=True)
        x = lum + (x - lum) * 1.16
        sh = np.clip(1 - lum * 2, 0, 1)
        hi = np.clip(lum * 2 - 1, 0, 1)
        x = x + sh * np.array([-0.012, 0.004, 0.022], np.float32) + hi * np.array([0.03, 0.014, -0.022], np.float32)
    elif kind == "holo":
        x = 0.5 + (x - 0.5) * 1.07
        lum = (x * [0.299, 0.587, 0.114]).sum(-1, keepdims=True)
        x = lum + (x - lum) * 1.1
    return np.clip(x * VIG[kind], 0, 1)


def jpg(session, i):
    n = TL[session]["frames"]
    return f"{cap}/{session}/f{min(max(i, 0), n - 1):06d}.jpg"


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def shot_frame(c, t):
    s = c["shot"]
    i = fr("shots", s) + round((t - c["start"]) * FPS)
    return grade(np.asarray(Image.open(jpg("shots", i)).convert("RGB"), np.float32) / 255, c["grade"])


def screen_frame(c, t):
    dt = t - c["at"]
    if c.get("slow") and dt > 0:  # slow motion just after the event, so the narration can describe it
        span, rate = c["slow"]
        dt = rate * min(dt, span) + max(0.0, dt - span)
    i = fr("screens", c["mark"]) + round(dt * FPS)
    im = Image.open(jpg("screens", i)).convert("RGB")
    u = ease((t - c["start"]) / c["dur"])
    a, b = c["crop"]
    r = [(a[k] + (b[k] - a[k]) * u) * 2 for k in range(4)]  # CSS px to device px
    im = im.resize((W, H), Image.LANCZOS, box=(r[0], r[1], r[0] + r[2], r[1] + r[3]))
    x = grade(np.asarray(im, np.float32) / 255, "screen")
    if c.get("flicker") is not None:
        k = round((t - c["flicker"]) * FPS)
        prof = [0.32, 0.22, 0.62, 0.3, 0.26, 0.78, 0.55, 0.9, 1.0]
        if 0 <= k < len(prof):
            x = x * prof[k]
    return x


def place(dst, src, x, y, w, h, alpha=1.0):
    """Resizes an RGB float frame into dst at (x, y, w, h)."""
    w, h = max(2, round(w)), max(2, round(h))
    im = Image.fromarray((src * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    s = np.asarray(im, np.float32) / 255
    x0, y0 = round(x), round(y)
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xb <= xa or yb <= ya:
        return
    seg = s[ya - y0: yb - y0, xa - x0: xb - x0]
    dst[ya:yb, xa:xb] = dst[ya:yb, xa:xb] * (1 - alpha) + seg * alpha


def over(dst, rgba, alpha=1.0, dx=0):
    a = rgba[..., 3:4] * alpha
    if dx:
        rgba = np.roll(rgba, dx, axis=1)
        a = np.roll(a, dx, axis=1)
    dst[:] = dst * (1 - a) + rgba[..., :3] * a


def stretch(session, mark_from, t, t0, t1):
    """Frame of a capture from `mark_from` to its end, stretched over [t0, t1]."""
    a = fr(session, mark_from) if mark_from else 0
    n = TL[session]["frames"] - 1
    u = min(1.0, max(0.0, (t - t0) / max(0.01, t1 - t0)))
    return np.asarray(Image.open(jpg(session, round(a + (n - a) * u))).convert("RGB"), np.float32) / 255


def devices_frame(c, t):
    ui = events["ui"]
    ui_idx = fr("shots", "ui")
    pull, pend = events["pull"], events["pull"] + PULL
    end = c["start"] + c["dur"]
    if t < pull:
        i = ui_idx + round((t - ui) * FPS)
    else:  # the rest of the captured shot, stretched to the end of the scene
        i0 = ui_idx + round((pull - ui) * FPS)
        i = i0 + round((TL["shots"]["frames"] - 1 - i0) * min(1.0, (t - pull) / (end - pull)))
    lap = grade(np.asarray(Image.open(jpg("shots", i)).convert("RGB"), np.float32) / 255, "holo" if t < ui else "none")
    k = round((t - ui) * FPS)
    if 0 <= k < 7:  # the interface appears: a short digital glitch
        sh = [16, 12, 8, 5, 3, 2, 1][k]
        lap = lap.copy()
        lap[..., 0] = np.roll(lap[..., 0], -sh, axis=1)
        lap[..., 2] = np.roll(lap[..., 2], sh, axis=1)
        rows = np.random.default_rng(k).integers(0, H - 40, 5)
        for r0 in rows:
            lap[r0: r0 + 30] = np.roll(lap[r0: r0 + 30], sh * 4, axis=1)
        lap = np.clip(lap * (1 + 0.5 * (7 - k) / 7) + np.array([0, 0.05, 0.08], np.float32) * (7 - k) / 7, 0, 1)
    if t < pull:
        return lap
    u = ease((t - pull) / PULL)
    L = DEV["laptop"]
    frame = asset(f"{ov}/devices-bg.png")[..., :3].copy()
    v = ease((t - (pend - 0.4)) / 0.9)  # TV and phone slide in
    if v > 0:
        tv = stretch("tv", None, t, pend - 0.4, end)
        T_ = DEV["tv"]
        place(frame, tv, T_["x"] - 90 * (1 - v), T_["y"], T_["w"], T_["h"], v)
        over(frame, asset(f"{ov}/bezel-tv.png"), v, dx=-round(90 * (1 - v)))
        ph = stretch("phone", "start", t, pend - 0.4, end)
        P = DEV["phone"]
        place(frame, ph, P["x"] + 90 * (1 - v), P["y"], P["w"], P["h"], v)
        over(frame, asset(f"{ov}/bezel-phone.png"), v, dx=round(90 * (1 - v)))
    over(frame, asset(f"{ov}/bezel-laptop.png"), u)
    x, y = L["x"] * u, L["y"] * u
    w, h = W + (L["w"] - W) * u, H + (L["h"] - H) * u
    frame = frame * (0.35 + 0.65 * u)  # the stage brightens as the picture shrinks into the laptop
    place(frame, lap, x, y, w, h)
    return frame


def logo_frame(c, t):
    i = round((t - c["start"]) * FPS)
    n = len(os.listdir(f"{work}/logo"))
    return np.asarray(Image.open(f"{work}/logo/f{min(i, n - 1) + 1:05d}.png").convert("RGB"), np.float32) / 255


def endcard_frame(c, t):
    u = (t - c["start"]) / c["dur"]
    z = 1 + 0.035 * u
    im = Image.open(f"{ov}/endcard.png").convert("RGB")
    w, h = W / z, H / z
    im = im.resize((W, H), Image.LANCZOS, box=((W - w) / 2, (H - h) / 2, (W + w) / 2, (H + h) / 2))
    return np.asarray(im, np.float32) / 255


KIND = {"shot": shot_frame, "screen": screen_frame, "devices": devices_frame, "logo": logo_frame, "endcard": endcard_frame}


def render(i):
    t = i / FPS
    act = [c for c in clips if c["start"] - 1e-6 <= t < c["start"] + c["dur"]]
    frame = None
    for c in act:  # later clips cross-fade in over earlier ones
        f = KIND[c["kind"]](c, t)
        a = 1.0 if c["xin"] <= 0 else min(1.0, (t - c["start"]) / c["xin"])
        frame = f if frame is None or a >= 1 else frame * (1 - a) + f * a
    if frame is None:
        frame = np.zeros((H, W, 3), np.float32)
    for name, s0, s1, fade, slide in overlays:
        if s0 <= t < s1:
            a = min(1.0, (t - s0) / fade, (s1 - t) / fade)
            over(frame, asset(f"{ov}/{name}.png"), a, dx=-round(40 * (1 - ease((t - s0) / fade))) if slide else 0)
    if t < 1.0:
        frame = frame * ease(t / 1.0)
    if t > TOTAL - 1.2:
        frame = frame * ease((TOTAL - t) / 1.2)
    return (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()


def run(cmd):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *cmd], check=True)


if __name__ == "__main__":
    # The logo clip: watermark removed, 1080p30.
    os.makedirs(f"{work}/logo", exist_ok=True)
    if not os.listdir(f"{work}/logo"):
        run(["-ss", "1.0", "-i", logo_clip, "-t", str(LOGO + 1.0), "-an", "-vf",
             "delogo=x=1126:y=564:w=68:h=70,fps=30,scale=1920:1080:flags=lanczos", f"{work}/logo/f%05d.png"])

    t_from = float(os.environ.get("FROM", 0))
    t_to = min(TOTAL, float(os.environ.get("TO", TOTAL)))
    frames = range(round(t_from * FPS), round(t_to * FPS))
    video = f"{work}/video.mp4"
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", "-pix_fmt", "yuv444p", video], stdin=subprocess.PIPE)
    with Pool(int(os.environ.get("JOBS", 4))) as pool:
        for k, b in enumerate(pool.imap(render, frames, chunksize=6)):
            enc.stdin.write(b)
            if k % 300 == 0:
                print(f"frame {k}/{len(frames)}", flush=True)
    enc.stdin.close()
    enc.wait()

    # Subtitles.
    def ts(x):
        c_ = int(round(max(0, x - t_from) * 100))
        return f"{c_ // 360000}:{c_ // 6000 % 60:02d}:{c_ // 100 % 60:02d}.{c_ % 100:02d}"

    def wrap(text, width=60):
        words, lines, cur = text.split(), [], ""
        for w_ in words:
            if len(cur) + len(w_) + 1 > width and cur:
                lines.append(cur)
                cur = w_
            else:
                cur = f"{cur} {w_}".strip()
        lines.append(cur)
        if len(lines) == 2 and len(lines[1]) < 14:
            return wrap(text, width - 10)
        return "\\N".join(lines)

    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "", "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
           "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           "Style: Sub,Inter Medium,40,&H00FCF8F4,&H00FCF8F4,&H50130802,&H50130802,0,0,0,0,100,100,0.2,0,3,15,0,2,200,200,70,1",
           "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for k in story:
        skip = set(story[k].get("nosub", []))
        for i, (c0, c1, text) in enumerate(caps[k]):
            if i in skip:
                continue
            ass.append(f"Dialogue: 0,{ts(vo_at[k] + c0 - 0.05)},{ts(vo_at[k] + c1 + 0.25)},Sub,,0,0,0,,{{\\fad(120,160)}}{wrap(text)}")
    open(f"{work}/subs.ass", "w").write("\n".join(ass) + "\n")

    # Score and effects.
    chapters = [c["start"] for c in clips if c.get("chapter")]
    cues = {"pulse": under0, "tension": mast0, "trip": events["trip"], "recover": vo_at["recover"] - 0.3, "resolve": crane0,
            "reveal": rev0 + 0.3, "lift": events["pull"], "tag": aer0, "logo": logo0 + 1.4, "end": end0,
            "sea": [[0, mast0 + 1.0], [aer0 - 0.5, logo0 + 2.0]], "gust": [[mast0 - 0.3, mast0 + 5.5]],
            "whoosh": chapters + [events["pull"] + 0.3, logo0 + 0.4], "ding": [events["wind_fault"], events["batt"], events["reject"]],
            "alarm": [events["trip"]], "ok": [events["restored"]]}
    json.dump(cues, open(f"{work}/cues.json", "w"), indent=1)
    subprocess.run([sys.executable, score_py, f"{TOTAL:.2f}", f"{work}/music.wav", f"{work}/sfx.wav", f"{work}/cues.json"], check=True)

    # Final mix and encode.
    order = list(story)
    inputs = ["-i", video]  # already rendered from t_from
    for k in order:
        inputs += ["-i", f"{vo}/{k}.wav"]
    inputs += ["-i", f"{work}/music.wav", "-i", f"{work}/sfx.wav"]
    M = 1 + len(order)
    D = t_to - t_from
    f = [f"[0:v]subtitles='{work}/subs.ass':fontsdir=/usr/share/fonts,format=yuv420p[vout]"]
    for i, k in enumerate(order):
        ms = max(0, int((vo_at[k] - t_from) * 1000))
        f.append(f"[{1 + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    f.append("".join(f"[a{i}]" for i in range(len(order))) + f"amix=inputs={len(order)}:normalize=0,apad,atrim=duration={TOTAL:.3f},"
             "highpass=f=70,acompressor=threshold=0.12:ratio=2.5:attack=8:release=120,volume=1.8[voice]")
    f.append("[voice]asplit=2[vk][vm]")
    f.append(f"[{M}:a]aresample=48000,atrim=duration={TOTAL:.3f},volume=0.55[mus]")
    f.append("[mus][vk]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[duck]")
    f.append(f"[{M + 1}:a]aresample=48000,atrim=duration={TOTAL:.3f},volume=0.45[fx]")
    f.append(f"[duck][vm][fx]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=10,atrim=start={t_from:.3f},asetpts=PTS-STARTPTS[aout]")
    open(f"{work}/filter.txt", "w").write(";\n".join(f))
    common = ["-filter_complex_script", f"{work}/filter.txt", "-map", "[vout]", "-map", "[aout]", "-r", str(FPS), "-t", f"{D:.3f}"]
    if os.environ.get("PREVIEW"):
        run([*inputs, *common, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
    else:
        mb = float(os.environ.get("TARGET_MB", 62))
        vk = int((mb * 8 * 1024 * 1024 / D - 192_000) / 1000)
        x264 = ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{vk}k", "-maxrate", f"{int(vk * 1.8)}k", "-bufsize", f"{vk * 3}k",
                "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-g", "60", "-x264-params", f"stats={work}/x264.log"]
        run([*inputs, *common, *x264, "-pass", "1", "-an", "-f", "mp4", "/dev/null"])
        run([*inputs, *common, *x264, "-pass", "2", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out])
    json.dump({"clips": clips, "vo": vo_at, "events": events, "total": TOTAL}, open(f"{work}/edit.json", "w"), indent=1)
    print("written", out, f"{D:.1f}s of {TOTAL:.1f}s")
