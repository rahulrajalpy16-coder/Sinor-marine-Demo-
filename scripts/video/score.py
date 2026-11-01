"""Original score and sound effects for the story film (story.json), synthesised with numpy and scipy
(no samples, no licensing). The music follows the story beat by beat:

  calm     dark, wide D minor pad, a sub drone and a sparse piano motif (the vessel on station)
  pulse    a soft heartbeat comes in (the hidden systems)
  tension  a driving low ostinato with toms and ticking hats, building towards the generator trip
  trip     one impact, then near silence while the switchboard is dark
  recover  the beat comes back with a hopeful progression while the systems recover
  resolve  a broad major resolution ("together, they keep the vessel on station")
  reveal   a breath: one held note and the piano motif ("none of this happened at sea")
  lift     the uplifting theme in F for the simulator and the purpose
  tag      a swell under the tagline
  logo     a shimmer and the last chord ringing out under the logo and end card

Sound effects go to a separate track so the voice-over ducks the music but not the effects: sea ambience,
wind gusts, transition whooshes, alert tones, the trip alarm and an all-clear tone.

Usage: python3 score.py <seconds> <music.wav> <sfx.wav> <cues.json>
cues: {"pulse", "tension", "trip", "recover", "resolve", "reveal", "lift", "tag", "logo", "end": seconds,
       "sea": [[from, to], ...], "gust": [[from, to], ...], "whoosh": [s, ...], "ding": [s, ...],
       "alarm": [s, ...], "ok": [s, ...]}
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
total = float(sys.argv[1])
music_out, sfx_out = sys.argv[2], sys.argv[3]
C = json.load(open(sys.argv[4]))
N = int((total + 4) * SR)
rng = np.random.default_rng(11)
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)


class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, sig, start, gain=1.0, pan=0.0):
        """Mono or (n, 2) signal at `start` seconds, panned -1..1."""
        i = int(start * SR)
        if i >= N or i + len(sig) <= 0:
            return
        if i < 0:
            sig, i = sig[-i:], 0
        j = min(N, i + len(sig))
        s = sig[: j - i] * gain
        if s.ndim == 2:
            self.L[i:j] += s[:, 0]
            self.R[i:j] += s[:, 1]
        else:
            self.L[i:j] += s * np.sqrt((1 - pan) / 2) * 1.414
            self.R[i:j] += s * np.sqrt((1 + pan) / 2) * 1.414


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n, a, r, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) if a > 0 else np.ones(n)
    return e * np.clip((n / SR - t) / r, 0, 1)


def saw(f, t, harmonics=14):
    s = np.zeros_like(t)
    for h in range(1, harmonics + 1):
        if f * h > 12000:
            break
        s += np.sin(2 * np.pi * f * h * t) / h
    return s


# ---------------------------------------------------------------------------------------------- instruments
def pad(notes, dur, cutoff=1400, a=1.6, r=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    for k, m in enumerate(notes):
        f = midi(m)
        for d, side in ((-0.09, 0), (0.0, 2), (0.08, 1)):  # detuned voices spread across the stereo field
            v = saw(f * 2 ** (d / 12), t + rng.random(), 10)
            if side in (0, 2):
                L += v
            if side in (1, 2):
                R += v
    lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.17 * t)
    e = env(n, a, r) * lfo / max(1, len(notes))
    return np.stack([lp(L, cutoff) * e, lp(R, cutoff * 1.05) * e], axis=1)


def piano(m, dur=2.6, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = np.zeros(n)
    for h, g in ((1, 1), (2, 0.42 * bright), (3, 0.2 * bright), (4, 0.09 * bright), (5, 0.05 * bright)):
        s += g * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h * h) * t) * np.exp(-t * (1.6 + 0.9 * h))
    return s * np.minimum(1, t / 0.003)


def pluck(m, dur=0.32, cutoff=1800):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = saw(midi(m), t, 12) * np.exp(-t * 9)
    return lp(s, cutoff) * np.minimum(1, t / 0.002)


def sub(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * midi(m) * t) * env(n, 1.0, 1.5)


def kick():
    t = np.arange(int(0.45 * SR)) / SR
    ph = 2 * np.pi * np.cumsum(45 + 110 * np.exp(-t * 28)) / SR
    return np.tanh(1.6 * np.sin(ph) * np.exp(-t * 7.5))


def tom(f0=70):
    t = np.arange(int(0.9 * SR)) / SR
    ph = 2 * np.pi * np.cumsum(f0 + 60 * np.exp(-t * 18)) / SR
    body = np.sin(ph) * np.exp(-t * 4.2)
    skin = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 30) * 0.5
    return body + skin


def snare():
    t = np.arange(int(0.35 * SR)) / SR
    noise = bp(rng.standard_normal(len(t)), 1500, 7000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22)
    return noise * 0.8 + tone * 0.5


def tick():
    t = np.arange(int(0.05 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 90)


def impact(dur=4.0):
    t = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * np.cumsum(32 + 80 * np.exp(-t * 6)) / SR
    boom = np.tanh(2 * np.sin(ph) * np.exp(-t * 1.2))
    crash = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 3.5) * 0.35
    return boom + crash


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    noise = rng.standard_normal(n)
    out = lp(noise, 600) * (1 - k) + bp(noise, 900, 3000) * (1 - abs(2 * k - 1)) + hp(noise, 3000) * k
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * k ** 2) / SR) * 0.15
    return (out + tone) * k ** 2.2


def reverb(L, R, seconds=3.2, wet=0.32):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    irs = []
    for seed in (1, 2):
        g = np.random.default_rng(seed).standard_normal(n) * np.exp(-t * 6.9 / seconds)
        irs.append(lp(g, 5200) * 0.06)
    wl = fftconvolve(L, irs[0])[: len(L)]
    wr = fftconvolve(R, irs[1])[: len(R)]
    return L * (1 - wet) + wl * wet * 3, R * (1 - wet) + wr * wet * 3


# ---------------------------------------------------------------------------------------------- cues
T = {k: float(C[k]) for k in ("pulse", "tension", "trip", "recover", "resolve", "reveal", "lift", "tag", "logo", "end")}
T["stop"] = total
music = Bus()
DM = [50, 53, 57, 62, 64]  # D minor add9
TENSION = [([50, 57, 62, 65], 38), ([46, 53, 58, 62], 34), ([50, 57, 62, 65], 38), ([48, 55, 60, 64], 36)]  # Dm Bb Dm C
HOPE = [([50, 57, 62, 65], 38), ([46, 53, 58, 62], 34), ([53, 57, 60, 65], 41), ([48, 55, 60, 64], 36)]  # Dm Bb F C
LIFT = [([53, 57, 60, 65], 41), ([48, 55, 60, 64], 36), ([50, 57, 62, 65], 38), ([46, 53, 58, 62], 34)]  # F C Dm Bb

# 1. calm + pulse: a long drone that breathes, sparse piano.
calm_end = T["tension"] + 1.0
music.add(pad(DM, calm_end + 1.5, cutoff=900, a=3.0, r=2.5), 0.0, 0.28)
music.add(sub(26, calm_end + 1.0), 0.0, 0.07)
motif = [69, 74, 76, 77, 76, 74]
t = 2.2
i = 0
while t < T["tension"] - 1.0:
    music.add(piano(motif[i % len(motif)] + 0, 3.2), t, 0.10, pan=0.25 * np.sin(i))
    t += BEAT * (3 if i % 3 == 2 else 2)
    i += 1
t = T["pulse"]
while t < T["tension"]:
    k = min(1, (t - T["pulse"]) / 6)
    music.add(kick() * 0.6, t, 0.10 + 0.08 * k)
    music.add(kick() * 0.4, t + 0.22, 0.05 + 0.04 * k)
    t += BEAT * 2

# 2. tension: ostinato + toms + ticks, crescendo, a riser into the trip.
span = T["trip"] - T["tension"]
b = 0
t = T["tension"]
while t < T["trip"] - 0.05:
    notes, root = TENSION[(b // 2) % 4]
    k = (t - T["tension"]) / span
    if b % 2 == 0:
        music.add(pad(notes, BAR * 2 + 1.0, cutoff=900 + 1400 * k, a=0.6, r=1.0), t, 0.22 + 0.30 * k)
    for s16 in range(16):
        ts = t + s16 * BEAT / 4
        if ts >= T["trip"] - 0.05:
            break
        m = root + 12 + (0 if s16 % 4 else 0) + (12 if s16 % 8 == 6 else 0) + (7 if s16 % 16 == 10 else 0)
        music.add(pluck(m, 0.22, 900 + 1800 * k), ts, 0.10 + 0.10 * k, pan=-0.2 if s16 % 2 else 0.2)
        music.add(tick(), ts, (0.012 + 0.02 * k) * (1.6 if s16 % 4 == 2 else 1), pan=0.4)
    for q in (0, 2) if k < 0.5 else (0, 1, 2, 3):
        music.add(tom(62), t + q * BEAT, 0.16 + 0.22 * k, pan=-0.15)
    t += BAR
    b += 1
music.add(riser(min(3.0, span)), T["trip"] - min(3.0, span), 0.12)

# 3. trip: one impact, a dark rumble while the board is dead.
music.add(impact(), T["trip"], 0.55)
music.add(sub(26, T["recover"] - T["trip"] + 1.5), T["trip"] + 0.3, 0.10)

# 4. recover: the beat returns, hopeful.
span = T["resolve"] - T["recover"]
music.add(riser(1.2), T["recover"] - 1.2, 0.06)
b = 0
t = T["recover"]
while t < T["resolve"] - 0.05:
    notes, root = HOPE[(b // 2) % 4]
    k = (t - T["recover"]) / span
    if b % 2 == 0:
        music.add(pad(notes, BAR * 2 + 1.2, cutoff=1600 + 1400 * k, a=0.5, r=1.2), t, 0.38 + 0.12 * k)
    for s8 in range(8):
        ts = t + s8 * BEAT / 2
        if ts >= T["resolve"] - 0.05:
            break
        music.add(pluck(root + 12 + (12 if s8 % 4 == 3 else 0), 0.3, 1500 + 1500 * k), ts, 0.12 + 0.05 * k, pan=-0.25 if s8 % 2 else 0.25)
        music.add(pluck(notes[(s8 * 2) % 4] + 12, 0.28, 2600), ts + BEAT / 4, 0.035 + 0.03 * k, pan=0.5 if s8 % 2 else -0.5)
    for q in range(4):
        music.add(kick(), t + q * BEAT, 0.20 + 0.06 * k)
        if q % 2:
            music.add(snare(), t + q * BEAT, 0.07 + 0.05 * k, pan=0.1)
        music.add(tick(), t + q * BEAT + BEAT / 2, 0.025, pan=0.35)
    t += BAR
    b += 1
music.add(riser(2.0), T["resolve"] - 2.0, 0.10)

# 5. resolve: a broad major resolution with a hit and a tom roll.
music.add(impact(3.5), T["resolve"], 0.32)
res = [([46, 53, 58, 62, 65], 34), ([53, 57, 60, 65, 69], 41)]  # Bb, F
half = (T["reveal"] - T["resolve"]) / 2
for i, (notes, root) in enumerate(res):
    music.add(pad(notes, half + 2.2, cutoff=2600, a=0.4, r=2.0), T["resolve"] + i * half, 0.55)
    music.add(sub(root, half + 1.5), T["resolve"] + i * half, 0.10)
    music.add(piano(notes[-1] + 12, 3.0), T["resolve"] + i * half, 0.10)
for q in range(4):
    music.add(tom(58 + 6 * q), T["resolve"] + q * BEAT / 2, 0.22, pan=-0.3 + 0.2 * q)

# 6. reveal: a breath. One high note and the motif, then a riser into the lift.
music.add(pad([69, 76], T["lift"] - T["reveal"] + 1.0, cutoff=2400, a=0.8, r=1.2), T["reveal"], 0.30)
for i, m in enumerate([76, 74, 69]):
    music.add(piano(m, 3.0), T["reveal"] + 0.6 + i * BEAT * 2, 0.11)
music.add(riser(1.8), T["lift"] - 1.8, 0.10)

# 7. lift: the uplifting theme.
b = 0
t = T["lift"]
lift_end = T["logo"]
while t < lift_end - 0.05:
    notes, root = LIFT[(b // 2) % 4]
    tag = t >= T["tag"]
    if b % 2 == 0:
        music.add(pad(notes + [notes[0] + 24], BAR * 2 + 1.5, cutoff=3200, a=0.4, r=1.4), t, 0.50 if tag else 0.42)
        music.add(sub(root, BAR * 2 + 0.5), t, 0.09)
    arp = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[1] + 12, notes[2]]
    for s8 in range(8):
        ts = t + s8 * BEAT / 2
        if ts >= lift_end - 0.05:
            break
        music.add(piano(arp[s8] + 12, 1.4, 1.2), ts, 0.07, pan=0.35 if s8 % 2 else -0.35)
    if not tag:
        for q in range(4):
            music.add(kick(), t + q * BEAT, 0.18)
            if q % 2:
                music.add(snare(), t + q * BEAT, 0.06, pan=0.1)
            music.add(tick(), t + q * BEAT + BEAT / 2, 0.022, pan=0.35)
    t += BAR
    b += 1

# 9. logo: shimmer, a soft hit and the final F major chord ringing out to the end.
ring = T["stop"] - T["logo"] + 2.0
music.add(impact(3.0), T["logo"], 0.22)
music.add(pad([53, 60, 65, 69, 72, 79], ring, cutoff=3600, a=0.6, r=3.5), T["logo"], 0.50)
music.add(sub(29, ring), T["logo"], 0.10)
for i, m in enumerate([77, 81, 84, 89]):
    music.add(piano(m, 4.0, 0.6), T["logo"] + 0.4 + i * 0.18, 0.06, pan=-0.3 + 0.2 * i)

# ---------------------------------------------------------------------------------------------- effects
sfx = Bus()
for a_, b_ in C.get("sea", []):
    n = int((b_ - a_) * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal((n, 2))
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * t / 7.3) * np.sin(2 * np.pi * t / 3.1 + 1)
    wash = np.stack([lp(noise[:, 0], 700), lp(noise[:, 1], 760)], axis=1) * swell[:, None]
    hiss = np.stack([bp(noise[:, 1], 1800, 5000), bp(noise[:, 0], 1800, 5000)], axis=1) * (swell[:, None] ** 3) * 0.25
    sfx.add((wash + hiss) * env(n, 1.2, 1.2)[:, None], a_, 0.10)
for a_, b_ in C.get("gust", []):
    n = int((b_ - a_) * SR)
    t = np.arange(n) / SR
    g = np.clip(np.sin(np.pi * t / (b_ - a_)), 0, 1) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * t * 0.9))
    noise = rng.standard_normal(n)
    howl = bp(noise, 300, 1400) * g + bp(noise, 1400, 4200) * g ** 2 * 0.35
    sfx.add(howl, a_, 0.13, pan=0.2)
for w in C.get("whoosh", []):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    k = t / 1.1
    noise = rng.standard_normal(n)
    sig = (bp(noise, 300, 1500) * (1 - k) + bp(noise, 1500, 6000) * k) * np.sin(np.pi * k) ** 2
    sfx.add(sig, w - 0.55, 0.12, pan=-0.3)
for d in C.get("ding", []):
    t = np.arange(int(1.2 * SR)) / SR
    tone = (np.sin(2 * np.pi * 1318.5 * t) + 0.5 * np.sin(2 * np.pi * 1975.5 * t)) * np.exp(-t * 5)
    sfx.add(tone, d, 0.07)
for a in C.get("alarm", []):
    for i in range(3):
        t = np.arange(int(0.28 * SR)) / SR
        f = 880 if i % 2 == 0 else 660
        tone = np.sign(np.sin(2 * np.pi * f * t)) * 0.4 + np.sin(2 * np.pi * f * t) * 0.6
        sfx.add(lp(tone, 3000) * env(len(t), 0.01, 0.05), a + 0.15 + i * 0.36, 0.06)
for o in C.get("ok", []):
    for i, f in enumerate((987.8, 1318.5)):
        t = np.arange(int(0.9 * SR)) / SR
        sfx.add(np.sin(2 * np.pi * f * t) * np.exp(-t * 6), o + i * 0.13, 0.06)


def finish(bus, path, wet, peak):
    L, R = reverb(bus.L, bus.R, wet=wet)
    L, R = hp(L, 28), hp(R, 28)
    mix = np.stack([L, R], axis=1)[: int(total * SR)]
    mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
    fade = int(3.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.2) / np.tanh(1.2) * peak
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())


finish(music, music_out, 0.30, 0.85)
finish(sfx, sfx_out, 0.18, 0.7)
print("score", total, "s")
