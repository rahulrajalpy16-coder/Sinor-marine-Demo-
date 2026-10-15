"""Voice-over for the demo video: one WAV per narration segment (Kokoro TTS), plus durations.json.

Usage: python3 voice.py <narration.json> <model.onnx> <voices.bin> <outDir> [voice]
"""
import json
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

narration, model, voices, out = sys.argv[1:5]
voice = sys.argv[5] if len(sys.argv) > 5 else "af_heart"
k = Kokoro(model, voices)
durations = {}
for seg in json.load(open(narration)):
    samples, sr = k.create(seg["text"], voice=voice, speed=1.0, lang="en-us")
    sf.write(f"{out}/{seg['id']}.wav", samples, sr)
    durations[seg["id"]] = round(len(samples) / sr, 3)
    print(seg["id"], durations[seg["id"]], flush=True)
json.dump(durations, open(f"{out}/durations.json", "w"), indent=1)
