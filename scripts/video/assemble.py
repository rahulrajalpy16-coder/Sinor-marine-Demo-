"""Assembles the exhibition demo video: slowed-time footage sped back up, title overlays, voice-over and
ducked background music, encoded as 1080p30 H.264 + AAC.

Usage: python3 assemble.py <footage.webm> <timeline.json> <voDir> <overlayDir> <music.py> <out.mp4>
"""
import json
import subprocess
import sys

footage, timeline_file, vo, ov, music_py, out = sys.argv[1:7]
tl = json.load(open(timeline_file))
dur = json.load(open(f"{vo}/durations.json"))
K = tl["K"]
OUTRO_HOLD = 3.0  # extra seconds on the outro card after the footage ends
VO_DELAY = 0.35

# Time-lapse the waiting after each voice-over (sims running, pole swinging): the part of a segment that runs
# more than 1 s past its narration is played faster so it lasts max(3 s, a third of its length).
order = [k for k in dur if k in tl]
starts = [tl[k] for k in order] + [tl["end"]]
pieces = []  # (src_start, src_end, speed)
for i, k in enumerate(order):
    a, b = starts[i], starts[i + 1]
    calm = a + dur[k] + VO_DELAY + 1.0
    tail = b - calm
    if k != "outro" and tail > 3.0:
        new = max(3.0, tail / 3)
        pieces += [(a, calm, 1.0), (calm, b, tail / new)]
    else:
        pieces.append((a, b, 1.0))
pieces[0] = (0.0, pieces[0][1], pieces[0][2])


def remap(t):
    out_t = 0.0
    for a, b, sp in pieces:
        if t <= b:
            return out_t + (max(t, a) - a) / sp
        out_t += (b - a) / sp
    return out_t


tl = {k: (remap(v) if k != "K" else v) for k, v in tl.items()}
end = tl["end"] + OUTRO_HOLD

music = out.rsplit("/", 1)[0] + "/music.wav"
subprocess.run([sys.executable, music_py, f"{end + 1:.2f}", music], check=True)

# Base footage back at normal speed (an intermediate file keeps memory low), then one input per piece.
base = out.rsplit("/", 1)[0] + "/base.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", footage, "-vf", f"setpts=(PTS-STARTPTS)/{K},fps=30,scale=1920:1080:flags=lanczos,setsar=1",
                "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", base], check=True)
inputs = []
for a, b, sp in pieces:
    inputs += ["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", base]
P = len(pieces)
for k in order:
    inputs += ["-i", f"{vo}/{k}.wav"]
inputs += ["-i", music]
overlays = []  # (png, start, stop, fade_in, fade_out)
overlays.append(("intro", 0.0, tl["overview"] - 0.2, 0.0, 0.8))
for k in order:
    if k in ("intro", "outro"):
        continue
    overlays.append((k, tl[k] + 0.15, tl[k] + 0.15 + min(4.2, dur[k]), 0.45, 0.45))
overlays.append(("outro", tl["outro"] + dur["outro"] + 0.6, end, 0.9, 0.0))
for name, *_ in overlays:
    inputs += ["-loop", "1", "-framerate", "30", "-i", f"{ov}/{name}.png"]

n_vo = len(order)
music_idx = P + n_vo
f = []
for i, (a, b, sp) in enumerate(pieces):
    f.append(f"[{i}:v]setpts=(PTS-STARTPTS)/{sp:.4f}[p{i}]")
f.append("".join(f"[p{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0,fps=30,tpad=stop_mode=clone:stop_duration={OUTRO_HOLD + 1}[v0]")
last = "v0"
for i, (name, a, b, fi, fo) in enumerate(overlays):
    idx = music_idx + 1 + i
    d = b - a
    chain = f"[{idx}:v]format=rgba,trim=duration={d:.3f}"
    if fi:
        chain += f",fade=t=in:st=0:d={fi}:alpha=1"
    if fo:
        chain += f",fade=t=out:st={max(0, d - fo):.3f}:d={fo}:alpha=1"
    chain += f",setpts=PTS-STARTPTS+{a:.3f}/TB[o{i}]"
    f.append(chain)
    f.append(f"[{last}][o{i}]overlay=eof_action=pass:enable='between(t,{a:.3f},{b:.3f})'[v{i + 1}]")
    last = f"v{i + 1}"
f.append(f"[{last}]trim=duration={end:.3f},format=yuv420p[vout]")
# Voice: each segment delayed to its chapter start, mixed, levelled.
for i, k in enumerate(order):
    ms = int((tl[k] + VO_DELAY) * 1000)
    f.append(f"[{P + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
f.append("".join(f"[a{i}]" for i in range(n_vo)) + f"amix=inputs={n_vo}:normalize=0,apad,atrim=duration={end:.3f},volume=1.6[voice]")
f.append("[voice]asplit=2[vk][vm]")
f.append(f"[{music_idx}:a]aresample=48000,atrim=duration={end:.3f},volume=0.42[mus]")
f.append("[mus][vk]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[duck]")
f.append("[duck][vm]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=9[aout]")

cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(f), "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", f"{end:.3f}", out]
subprocess.run(cmd, check=True)
print("written", out, f"{end:.1f}s")
