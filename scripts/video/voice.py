"""Voice-over for the exhibition video (Kokoro TTS). Each narration sentence is spoken separately and joined
with a short pause, so the subtitle timing is exact. Writes <id>.wav per segment, durations.json and
captions.json (per segment: [start, end, text] in seconds from the segment start).

A sentence is a string, or {"say": spoken form, "show": subtitle form} when the two differ (numbers, units).
Usage: python3 voice.py <narration.json> <model.onnx> <voices.bin> <outDir> [voice] [speed]
"""
import json
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

narration, model, voices, out = sys.argv[1:5]
voice = sys.argv[5] if len(sys.argv) > 5 else "af_heart"
speed = float(sys.argv[6]) if len(sys.argv) > 6 else 0.96
GAP = 0.32  # pause between sentences
k = Kokoro(model, voices)
durations, captions = {}, {}
for seg in json.load(open(narration)):
    parts, caps, t = [], [], 0.0
    sr = 24000
    for i, s in enumerate(seg["text"]):
        say, show = (s, s) if isinstance(s, str) else (s["say"], s["show"])
        samples, sr = k.create(say, voice=voice, speed=speed, lang="en-us")
        # Trim the model's leading and trailing near-silence so the gaps are even.
        idx = np.where(np.abs(samples) > 0.01)[0]
        if len(idx):
            samples = samples[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)]
        if i:
            parts.append(np.zeros(int(GAP * sr), dtype=samples.dtype))
            t += GAP
        caps.append([round(t, 3), round(t + len(samples) / sr, 3), show])
        parts.append(samples)
        t += len(samples) / sr
    audio = np.concatenate(parts)
    sf.write(f"{out}/{seg['id']}.wav", audio, sr)
    durations[seg["id"]] = round(len(audio) / sr, 3)
    captions[seg["id"]] = caps
    print(seg["id"], durations[seg["id"]], flush=True)
json.dump(durations, open(f"{out}/durations.json", "w"), indent=1)
json.dump(captions, open(f"{out}/captions.json", "w"), indent=1)
