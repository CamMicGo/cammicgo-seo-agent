"""Qwen3-ASR-0.6B int8 (sherpa-onnx) on 5-minute files, cut the way the Android app cuts them:
segments of at most 20 s, split at the quietest 200 ms between 12 and 20 s. Reports model files
(size + SHA-256), load time, transcription time, real-time factor, peak memory and word error rate."""
import hashlib, json, os, re, resource, sys, time, numpy as np, soundfile as sf, sherpa_onnx
MODEL, AUDIO = sys.argv[1], sys.argv[2]
THREADS = int(os.environ.get('THREADS', '2'))
FILES = ['conv_frontend.onnx', 'encoder.int8.onnx', 'decoder.int8.onnx', 'tokenizer/vocab.json', 'tokenizer/merges.txt', 'tokenizer/tokenizer_config.json']
rss = lambda: resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB (Linux reports KB)
files = []
for f in FILES:
    p = os.path.join(MODEL, f); h = hashlib.sha256()
    with open(p, 'rb') as fh:
        for b in iter(lambda: fh.read(1 << 20), b''): h.update(b)
    files.append({'path': f, 'bytes': os.path.getsize(p), 'sha256': h.hexdigest()})
print('MODEL_FILES', json.dumps(files))
print('MODEL_TOTAL_MB', round(sum(f['bytes'] for f in files) / 1e6, 1))
t = time.time()
rec = sherpa_onnx.OfflineRecognizer.from_qwen3_asr(conv_frontend=f'{MODEL}/conv_frontend.onnx', encoder=f'{MODEL}/encoder.int8.onnx',
    decoder=f'{MODEL}/decoder.int8.onnx', tokenizer=f'{MODEL}/tokenizer', num_threads=THREADS, max_total_len=1024, max_new_tokens=384)
print(f'LOAD threads={THREADS} {time.time()-t:.1f}s peakRSS={rss():.0f}MB')

def segments(a, sr=16000, max_s=20, min_s=12, win=0.2):
    i = 0
    while len(a) - i > max_s * sr:
        lo, hi, w = i + min_s * sr, i + max_s * sr, int(win * sr)
        e = [float(np.mean(a[s:s + w] ** 2)) for s in range(lo, hi - w, w // 2)]
        cut = lo + int(np.argmin(e)) * (w // 2) + w // 2
        yield a[i:cut]; i = cut
    yield a[i:]

norm = lambda s: re.sub(r"[^\w']+", ' ', s.lower()).split()
def wer(ref, hyp):
    r, h = norm(ref), norm(hyp); d = list(range(len(h) + 1))
    for i, rw in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hw in enumerate(h, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (rw != hw)); prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))

for lang in ('fr', 'en'):
    a, sr = sf.read(os.path.join(AUDIO, f'{lang}.wav'), dtype='float32')
    if sr != 16000:
        n = int(len(a) * 16000 / sr); a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype('float32'); sr = 16000
    t = time.time(); out = []; segs = 0
    for s in segments(a):
        st = rec.create_stream(); st.accept_waveform(16000, s); rec.decode_stream(st); out.append(st.result.text.strip()); segs += 1
    dt = time.time() - t; dur = len(a) / 16000; text = ' '.join(out)
    ref = open(os.path.join(AUDIO, f'ref-{lang}.txt'), encoding='utf-8').read()
    print(f'RESULT lang={lang} audio={dur:.0f}s segments={segs} time={dt:.0f}s rtf={dt/dur:.3f} peakRSS={rss():.0f}MB wer={wer(ref, text)*100:.1f}%')
    print(f'TEXT_{lang}', text[:600])
