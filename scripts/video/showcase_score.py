"""Music bed for the OEM showcase film, synthesised with numpy and scipy (no samples, no licensing), reusing
the instruments of score.py. The film is made for exhibition screens that are often muted, so the music only
supports the pictures: a calm opening, a steady, light theme under the partner chapters with a soft swell at
every brand card, a lift without drums under the tagline and a final chord under the end card.

Usage: python3 showcase_score.py <edit.json> <music.wav>
(edit.json is written by showcase_assemble.py: the film length and every clip with its start.)
"""
import json
import os
import sys

edit = json.load(open(sys.argv[1]))
total = edit["total"]
here = os.path.dirname(os.path.abspath(__file__))
src = open(f"{here}/score.py").read()
# The instruments, buses and the mix-down of score.py (everything except its story-specific arrangement).
helpers = src[: src.index("# ---------------------------------------------------------------------------------------------- cues")]
finish_src = src[src.index("def finish("): src.index("finish(music, music_out")]
sys.argv = ["score.py", str(total), sys.argv[2], os.devnull, os.devnull]
json_load = json.load
json.load = lambda f: {}
exec(helpers)  # noqa: S102 - our own sibling script
exec(finish_src)  # noqa: S102
json.load = json_load

brands = [c["start"] for c in edit["clips"] if c["kind"] == "brand"]
first = brands[0]
aerial = [c["start"] for c in edit["clips"] if c.get("shot") == "aerial"][0]
endcard = [c["start"] for c in edit["clips"] if c["kind"] == "endcard"][0]

music = Bus()
DM = [50, 53, 57, 62, 64]
LIFT = [([53, 57, 60, 65], 41), ([48, 55, 60, 64], 36), ([50, 57, 62, 65], 38), ([46, 53, 58, 62], 34)]  # F C Dm Bb

# Opening: a wide pad and a sparse piano motif.
music.add(pad(DM, first + 2.0, cutoff=1000, a=2.5, r=2.5), 0.0, 0.30)
music.add(sub(26, first + 1.0), 0.0, 0.06)
motif = [69, 74, 76, 77, 76, 74]
t, i = 1.6, 0
while t < first - 1.0:
    music.add(piano(motif[i % len(motif)], 3.2), t, 0.10, pan=0.25 * np.sin(i))
    t += BEAT * (3 if i % 3 == 2 else 2)
    i += 1
music.add(riser(2.0), first - 2.0, 0.08)

# Chapters: the theme, chords every two bars, a light pulse; a swell and a soft hit at each brand card.
b = 0
t = first
while t < aerial - 0.05:
    notes, root = LIFT[(b // 2) % 4]
    if b % 2 == 0:
        music.add(pad(notes + [notes[0] + 24], BAR * 2 + 1.5, cutoff=2600, a=0.5, r=1.4), t, 0.36)
        music.add(sub(root, BAR * 2 + 0.5), t, 0.07)
    arp = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[1] + 12, notes[2]]
    for s8 in range(8):
        ts = t + s8 * BEAT / 2
        if ts >= aerial - 0.05:
            break
        music.add(piano(arp[s8] + 12, 1.4, 1.0), ts, 0.055, pan=0.35 if s8 % 2 else -0.35)
    for q in range(4):
        if t + q * BEAT >= aerial - 0.05:
            break
        music.add(kick(), t + q * BEAT, 0.12)
        music.add(tick(), t + q * BEAT + BEAT / 2, 0.016, pan=0.35)
    t += BAR
    b += 1
for s0 in brands:
    music.add(riser(1.0), s0 - 1.0, 0.05)
    music.add(impact(2.0), s0, 0.10)

# Tagline: the theme without drums, broader.
music.add(riser(1.5), aerial - 1.5, 0.08)
t, b = aerial, 0
while t < endcard - 0.05:
    notes, root = LIFT[(b // 2) % 4]
    if b % 2 == 0:
        music.add(pad(notes + [notes[0] + 24], BAR * 2 + 1.8, cutoff=3200, a=0.4, r=1.6), t, 0.48)
        music.add(sub(root, BAR * 2 + 0.5), t, 0.08)
    t += BAR
    b += 1

# End card: a soft hit and the final F major chord ringing out.
ring = total - endcard + 2.0
music.add(impact(3.0), endcard, 0.18)
music.add(pad([53, 60, 65, 69, 72, 79], ring, cutoff=3600, a=0.6, r=3.5), endcard, 0.48)
music.add(sub(29, ring), endcard, 0.08)
for i, m in enumerate([77, 81, 84, 89]):
    music.add(piano(m, 4.0, 0.6), endcard + 0.4 + i * 0.18, 0.06, pan=-0.3 + 0.2 * i)

finish(music, music_out, 0.28, 0.8)
print("music", round(total, 1), "s")
