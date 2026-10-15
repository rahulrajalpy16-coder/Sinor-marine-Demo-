"""Original background music for the demo video, synthesised with numpy (no samples, no licensing).

Uplifting corporate ambient at 96 BPM: I-V-vi-IV in C with warm pads, a plucked arpeggio, soft bass and
light drums, an 8-bar intro and a fading outro. Usage: python3 music.py <seconds> <out.wav>
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
total = float(sys.argv[1])
out = sys.argv[2]
n = int(total * SR) + SR
L = np.zeros(n)
R = np.zeros(n)

midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)
# C, G/B, Am, F (chord tones as MIDI notes) with roots for the bass.
CHORDS = [([60, 64, 67, 72], 48), ([59, 62, 67, 71], 43), ([57, 60, 64, 69], 45), ([57, 60, 65, 69], 41)]


def env(length, a, r):
    t = np.arange(length) / SR
    e = np.minimum(1, t / a) if a > 0 else np.ones(length)
    return e * np.minimum(1, (length / SR - t) / r)


def add(sig, start, gain, pan=0.0):
    i = int(start * SR)
    j = min(n, i + len(sig))
    if i >= n:
        return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - pan) / 2 ** 0.5 * 1.2
    R[i:j] += s * (1 + pan) / 2 ** 0.5 * 1.2


def pad(f, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for det in (-0.12, 0.0, 0.11):  # three detuned voices, soft saw (8 harmonics)
        ff = f * 2 ** (det / 12)
        for h in range(1, 9):
            s += np.sin(2 * np.pi * ff * h * t + det * h) / h ** 1.6
    return s * env(len(t), 0.9, 1.2) * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * t))


def pluck(f, dur=0.9):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t * 5.5) * np.minimum(1, t / 0.004)


def bass(f, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * env(len(t), 0.01, 0.15) * np.exp(-t * 1.2)


def kick():
    t = np.arange(int(0.35 * SR)) / SR
    ph = 2 * np.pi * np.cumsum(50 + 90 * np.exp(-t * 30)) / SR
    return np.sin(ph) * np.exp(-t * 9)


def hat(rng):
    t = np.arange(int(0.08 * SR)) / SR
    noise = rng.standard_normal(len(t))
    noise = noise - np.convolve(noise, np.ones(4) / 4, mode="same")  # crude high-pass
    return noise * np.exp(-t * 60)


rng = np.random.default_rng(7)
K = kick()
bars = int(total / BAR) + 1
intro, outro = 4, 4
for b in range(bars):
    t0 = b * BAR
    notes, root = CHORDS[b % 4]
    part = "intro" if b < intro else "outro" if b >= bars - outro else "main"
    for k, m in enumerate(notes[:3]):
        add(pad(midi(m), BAR + 1.0), t0, 0.045, pan=(k - 1) * 0.5)
    add(pad(midi(notes[3] + 12), BAR + 1.0), t0, 0.012, pan=0.2)
    if part != "intro" or b >= 2:
        seq = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[1] + 12, notes[2]]
        for s8 in range(8):
            add(pluck(midi(seq[s8] + 12)), t0 + s8 * BEAT / 2, 0.05 if part == "main" else 0.035, pan=0.45 if s8 % 2 else -0.45)
    if part == "main":
        for q in range(4):
            add(bass(midi(root - 12), BEAT * 0.95), t0 + q * BEAT, 0.16)
            add(K, t0 + q * BEAT, 0.22)
            add(hat(rng), t0 + q * BEAT + BEAT / 2, 0.035, pan=0.3)

# Stereo delay / room: a few decaying echoes.
for d, g in ((0.375, 0.28), (0.75, 0.16), (1.125, 0.09)):
    s = int(d * SR)
    L[s:] += R[:-s] * g
    R[s:] += L[:-s] * g

mix = np.stack([L, R], axis=1)[: int(total * SR)]
fade = int(4 * SR)
mix[:SR] *= np.linspace(0, 1, SR)[:, None]
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) / 0.8
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("music", total, "s")
