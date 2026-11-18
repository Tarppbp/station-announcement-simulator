"""Optional speech recognition worker used by app.py.
Protocol: one JSON object per line on stdin {"path": "...", "lang": "zh"};
one JSON object per line on stdout {"text": "..."} or {"error": "..."}.
"""
import sys, json, glob, subprocess
from pathlib import Path
from runtime_config import local_path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'asr_lib'))
import numpy as np
from faster_whisper import WhisperModel

# Only nudges Chinese output towards simplified characters; no content hints.
PROMPTS = {'zh': '简体中文。'}


def main():
    configured = local_path('asr_model')
    snapshots = glob.glob(str(Path.home() / '.cache/huggingface/hub/models--Systran--faster-whisper-medium/snapshots/*'))
    models = [configured] if configured else [Path(path) for path in snapshots]
    model_path = next((path for path in models if (path/'model.bin').is_file()), None)
    if model_path is None:
        print(json.dumps({'error': 'no model'}), flush=True)
        return
    model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=6)
    print(json.dumps({'ready': True}), flush=True)
    for line in sys.stdin:
        try:
            req = json.loads(line)
            lang = req.get('lang', 'zh')
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', req['path'], '-f', 'f32le', '-ar', '16000', '-ac', '1', '-'],
                                 capture_output=True, check=True).stdout
            words = bool(req.get('words'))
            seg, _ = model.transcribe(np.frombuffer(raw, dtype=np.float32), language=lang, beam_size=3,
                                      vad_filter=False, condition_on_previous_text=False,
                                      initial_prompt=PROMPTS.get(lang), word_timestamps=words)
            seg = list(seg)
            out = {'text': ''.join(s.text for s in seg).strip()}
            if words:
                out['words'] = [[round(w.start, 3), round(w.end, 3), w.word] for s in seg for w in (s.words or [])]
            print(json.dumps(out, ensure_ascii=False), flush=True)
        except Exception as e:  # keep the worker alive
            print(json.dumps({'error': str(e)}), flush=True)


if __name__ == '__main__':
    main()
