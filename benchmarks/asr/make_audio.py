"""Builds ~5-minute French and English test recordings from text-<lang>.txt with a TTS voice
(Supertonic-3). The paragraphs are repeated until the audio passes 300 s; the exact spoken text is
written to ref-<lang>.txt for the word error rate."""
import os, sys, numpy as np, soundfile as sf
from supertonic import TTS
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
tts = TTS(auto_download=True)
for lang, voice in (('fr', 'M2'), ('en', 'M1')):
    paras = [p.strip() for p in open(os.path.join(HERE, f'text-{lang}.txt'), encoding='utf-8') if p.strip()]
    style = tts.get_voice_style(voice_name=voice)
    chunks, spoken, total, sr, i = [], [], 0.0, None, 0
    while total < 300:
        p = paras[i % len(paras)]; i += 1
        wav, dur = tts.synthesize(p, voice_style=style, lang=lang)
        tmp = os.path.join(OUT, 'tmp.wav'); tts.save_audio(wav, tmp)
        a, sr = sf.read(tmp, dtype='float32'); os.remove(tmp)
        if a.ndim > 1: a = a.mean(axis=1)
        chunks += [a, np.zeros(int(sr * 0.6), dtype='float32')]; spoken.append(p); total += len(a) / sr + 0.6
    sf.write(os.path.join(OUT, f'{lang}.wav'), np.concatenate(chunks), sr)
    open(os.path.join(OUT, f'ref-{lang}.txt'), 'w', encoding='utf-8').write('\n'.join(spoken))
    print(lang, round(total, 1), 's', sr, 'Hz', len(spoken), 'paragraphs')
