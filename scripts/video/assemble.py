"""Assembles the Sinor Marine exhibition advertisement from the captured frames (capture.mjs), the branded
graphics (overlays.mjs), the voice-over and captions (voice.py) and synthesised music (music.py).

Edit: animated opener > cinematic hero shots (tagline) > simulator walkthrough (chapter cards) > devices
scene (desktop + phone) > end card with QR code. Burned-in subtitles follow the voice-over sentence by
sentence, so the advert also works on a muted exhibition screen. Output: 1080p30 H.264 + AAC, fast start.

Usage: python3 assemble.py <captureDir> <voDir> <overlayDir> <narration.json> <music.py> <out.mp4>
"""
import json
import os
import subprocess
import sys

cap, vo, ov, narration_file, music_py, out = sys.argv[1:7]
work = os.path.join(os.path.dirname(os.path.abspath(out)), "work")
os.makedirs(work, exist_ok=True)
FPS = 30
dur = json.load(open(f"{vo}/durations.json"))
caps = json.load(open(f"{vo}/captions.json"))
segs = {s["id"]: s for s in json.load(open(narration_file))}
tl = {k: json.load(open(f"{cap}/{k}/timeline.json")) for k in ("hero", "app", "phone")}


def run(cmd):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *cmd], check=True)


def frames_clip(name, pattern, start_frame, n_frames, vf="scale=1920:1080:flags=lanczos"):
    """Encodes a run of numbered frames to a near-lossless intermediate clip."""
    path = f"{work}/{name}.mp4"
    run(["-framerate", str(FPS), "-start_number", str(start_frame), "-i", pattern, "-frames:v", str(n_frames), "-vf", f"{vf},setsar=1,format=yuv420p",
         "-c:v", "libx264", "-preset", "medium", "-crf", "12", path])
    return path


# ---- Clips -------------------------------------------------------------------------------------------
clips = []  # (name, path, duration, transition_in)
OPENER = 5.0
clips.append(("opener", frames_clip("opener", f"{ov}/opener/f%06d.png", 0, int(OPENER * FPS)), OPENER, 0.0))

h = tl["hero"]
marks = ["h1", "h1b", "h2", "h3"]
bounds = [round(h[m] * FPS) for m in marks] + [h["frames"]]
for i, m in enumerate(marks):
    n = bounds[i + 1] - bounds[i]
    clips.append((m, frames_clip(m, f"{cap}/hero/f%06d.jpg", bounds[i], n), n / FPS, [0.8, 0.4, 0.5, 0.5][i]))

# The walkthrough's frames, with optional extras from the environment:
#   APP_JOIN=dpall  - the separately captured last part replaces the app frames from its mark on
#   APP_FAST=a:b:k,... - app seconds a..b played k times faster (dropping frames) to trim waiting
a = dict(tl["app"])
src = [f"{cap}/app/f{i:06d}.jpg" for i in range(a.get("frames", 10**9)) if os.path.exists(f"{cap}/app/f{i:06d}.jpg")]
join = os.environ.get("APP_JOIN")
if join:
    j = json.load(open(f"{cap}/{join}/timeline.json"))
    cut = round(a[join] * FPS)
    src = src[:cut] + [f"{cap}/{join}/f{i:06d}.jpg" for i in range(j["frames"])]
    for k, v in j.items():
        if k not in ("fps", "frames"):
            a[k] = a[join] + v - j[join]
fast = [tuple(float(x) for x in r.split(":")) for r in os.environ.get("APP_FAST", "").split(",") if r]
keep, newidx = [], []
for i, path in enumerate(src):
    newidx.append(len(keep))
    t_ = i / FPS
    k = next((r[2] for r in fast if r[0] <= t_ < r[1]), 1)
    if k == 1 or round((t_ - next(r[0] for r in fast if r[0] <= t_ < r[1])) * FPS) % int(k) == 0:
        keep.append(path)
for k in list(a):
    if k not in ("fps", "frames"):
        a[k] = newidx[min(len(newidx) - 1, round(a[k] * FPS))] / FPS
seq = f"{work}/appseq"
os.makedirs(seq, exist_ok=True)
for i, path in enumerate(keep):
    dst = f"{seq}/f{i:06d}.jpg"
    if os.path.lexists(dst):
        os.remove(dst)
    os.symlink(path, dst)
a["frames"] = len(keep)
clips.append(("app", frames_clip("app", f"{seq}/f%06d.jpg", 0, a["frames"]), a["frames"] / FPS, 0.8))

# Devices scene: the walkthrough's visual-modes part on a laptop, the phone capture on a phone.
DEV = max(7.0, dur["devices"] + 1.6)
m0 = round(a["modes"] * FPS)
laptop = frames_clip("laptop", f"{seq}/f%06d.jpg", m0, int(DEV * FPS), "scale=1120:630:flags=lanczos")
p = tl["phone"]
phone = frames_clip("phone", f"{cap}/phone/f%06d.jpg", 0, p["frames"], "scale=330:714:flags=lanczos")
dev = f"{work}/devices.mp4"
run(["-loop", "1", "-framerate", str(FPS), "-i", f"{ov}/devices-bg.png", "-i", laptop, "-i", phone,
     "-loop", "1", "-framerate", str(FPS), "-i", f"{ov}/devices-frames.png", "-filter_complex",
     f"[0:v]format=rgb24[bg];[2:v]tpad=stop_mode=clone:stop_duration={DEV}[ph];[1:v]tpad=stop_mode=clone:stop_duration={DEV}[lp];"
     f"[bg][lp]overlay=150:262[a];[a][ph]overlay=1410:226[b];[b][3:v]overlay=0:0,trim=duration={DEV},setsar=1,format=yuv420p[v]",
     "-map", "[v]", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "12", dev])
clips.append(("devices", dev, DEV, 0.6))

END = 8.5
endcard = f"{work}/endcard.mp4"
# A slow push-in on the end card.
run(["-loop", "1", "-framerate", str(FPS), "-i", f"{ov}/endcard.png", "-vf",
     f"scale=3840:2160,zoompan=z='1+0.035*on/{int(END * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS},format=yuv420p",
     "-frames:v", str(int(END * FPS)), "-c:v", "libx264", "-preset", "medium", "-crf", "12", endcard])
clips.append(("endcard", endcard, END, 0.8))

# Clip start times on the final timeline (each transition overlaps the previous clip).
start = {}
t = 0.0
for i, (name, _, d, x) in enumerate(clips):
    t -= x
    start[name] = t
    t += d
TOTAL = t

# ---- Voice-over placement ----------------------------------------------------------------------------
vo_at = {
    "hero1": start["h1"] + 0.5,
    "hero2": start["h2"] + 0.2,
    "hero3": start["h3"] + 0.3,
    "devices": start["devices"] + 0.6,
    "outro": start["endcard"] + 1.0,
}
for k in ("platform", "modes", "learn", "thruster", "dp", "hpr", "relative", "absolute", "sprintnav", "dpall"):
    vo_at[k] = start["app"] + a[k] + 0.35
order = [k for k in segs if k in vo_at]

# ---- Subtitles (ASS) ---------------------------------------------------------------------------------
def ts(x):
    cs = int(round(x * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def wrap(text, width=62):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    if len(lines) == 2 and len(lines[1]) < 12:  # avoid a lonely word on the second line
        return wrap(text, width - 10)
    return "\\N".join(lines)


ass = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
    "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Sub,Inter Medium,38,&H00FCF8F4,&H00FCF8F4,&H64130802,&H64130802,0,0,0,0,100,100,0.2,0,3,14,0,2,200,200,74,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
]
skip = {("hero3", 1), ("outro", 0), ("outro", 1)}  # spoken while the same words are on screen as titles
for k in order:
    for i, (c0, c1, text) in enumerate(caps[k]):
        if (k, i) in skip:
            continue
        s0, s1 = vo_at[k] + c0 - 0.05, vo_at[k] + c1 + 0.25
        ass.append(f"Dialogue: 0,{ts(s0)},{ts(s1)},Sub,,0,0,0,,{{\\fad(120,160)}}{wrap(text)}")
open(f"{work}/subs.ass", "w").write("\n".join(ass) + "\n")

# ---- Overlays ----------------------------------------------------------------------------------------
overlays = []  # (png, start, stop, fade_in, fade_out)
tag0 = vo_at["hero3"] + caps["hero3"][1][0] - 0.2
overlays.append(("tagline", tag0, start["app"] + 0.5, 0.6, 0.6))
app_ids = ["modes", "learn", "thruster", "dp", "hpr", "relative", "absolute", "sprintnav", "dpall"]
for i, k in enumerate(app_ids):
    s0 = start["app"] + a[k] + 0.15
    nxt = start["app"] + (a[app_ids[i + 1]] if i + 1 < len(app_ids) else a["tail"])
    overlays.append((f"chapter-{k}", s0, min(s0 + 4.0, nxt - 0.3), 0.4, 0.4))

# ---- Music -------------------------------------------------------------------------------------------
music = f"{work}/music.wav"
cues = {"drums": start["app"] + 0.1, "hits": [0.35, start["app"] + 0.1, start["endcard"] + 0.2], "end": start["endcard"] + 0.4}
json.dump(cues, open(f"{work}/cues.json", "w"))
subprocess.run([sys.executable, music_py, f"{TOTAL + 1:.2f}", music, f"{work}/cues.json"], check=True)

# ---- Final mix and encode ----------------------------------------------------------------------------
inputs, f = [], []
for name, path, d, x in clips:
    inputs += ["-i", path]
for i in range(len(clips)):
    f.append(f"[{i}:v]fps={FPS},settb=AVTB,setsar=1,format=yuv420p[c{i}]")
last = "c0"
for i in range(1, len(clips)):
    name, _, d, x = clips[i]
    f.append(f"[{last}][c{i}]xfade=transition=fade:duration={x}:offset={start[name]:.3f}[x{i}]")
    last = f"x{i}"
C = len(clips)
for k in order:
    inputs += ["-i", f"{vo}/{k}.wav"]
inputs += ["-i", music]
M = C + len(order)
for name, *_ in overlays:
    inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"{ov}/{name}.png"]
for i, (name, s0, s1, fi, fo) in enumerate(overlays):
    idx = M + 1 + i
    d = s1 - s0
    f.append(f"[{idx}:v]format=rgba,trim=duration={d:.3f},fade=t=in:st=0:d={fi}:alpha=1,fade=t=out:st={max(0, d - fo):.3f}:d={fo}:alpha=1,"
             f"setpts=PTS-STARTPTS+{s0:.3f}/TB[o{i}]")
    f.append(f"[{last}][o{i}]overlay=eof_action=pass:enable='between(t,{s0:.3f},{s1:.3f})'[ov{i}]")
    last = f"ov{i}"
f.append(f"[{last}]subtitles='{work}/subs.ass':fontsdir=/usr/share/fonts,trim=duration={TOTAL:.3f},fade=t=out:st={TOTAL - 0.6:.3f}:d=0.6,format=yuv420p[vout]")
for i, k in enumerate(order):
    ms = int(vo_at[k] * 1000)
    f.append(f"[{C + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
f.append("".join(f"[a{i}]" for i in range(len(order))) + f"amix=inputs={len(order)}:normalize=0,apad,atrim=duration={TOTAL:.3f},"
         "highpass=f=70,acompressor=threshold=0.12:ratio=2.5:attack=8:release=120,volume=1.7[voice]")
f.append("[voice]asplit=2[vk][vm]")
f.append(f"[{M}:a]aresample=48000,atrim=duration={TOTAL:.3f},volume=0.5[mus]")
f.append("[mus][vk]sidechaincompress=threshold=0.03:ratio=7:attack=30:release=500[duck]")
f.append(f"[duck][vm]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=9,afade=t=out:st={TOTAL - 1.0:.3f}:d=1.0[aout]")

open(f"{work}/filter.txt", "w").write(";\n".join(f))
run([*inputs, "-filter_complex_script", f"{work}/filter.txt", "-map", "[vout]", "-map", "[aout]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "4M", "-bufsize", "8M", "-profile:v", "high", "-pix_fmt", "yuv420p",
     "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", f"{TOTAL:.3f}", out])
json.dump({"start": start, "vo": vo_at, "total": TOTAL}, open(f"{work}/edit.json", "w"), indent=1)
print("written", out, f"{TOTAL:.1f}s")
