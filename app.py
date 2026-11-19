import os, sys, re, json, asyncio, uuid, shutil, subprocess, traceback, threading, time, hashlib, difflib, math
from pathlib import Path
from urllib.parse import urlsplit, unquote
from runtime_config import local_path, option
# 日志里可能有日文、特殊符号；Windows 控制台默认 GBK 编码写不出来会让生成出错，统一用 UTF-8 并替换无法显示的字符
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, 'reconfigure'): _stream.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HOME=str(ROOT/'cache'), TMP=str(ROOT/'tmp'), TEMP=str(ROOT/'tmp'))
(ROOT/'tmp').mkdir(exist_ok=True)
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
import soundfile as sf

app = FastAPI()

@app.middleware('http')
async def no_stale_pages(request, call_next):
    # 网页文件每次都向服务确认是否有更新，改了 static/ 下的文件刷新就能看到
    response = await call_next(request)
    if request.url.path in ('/', '/edit', '/tour') or request.url.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-cache'
    return response

app.mount('/data', StaticFiles(directory=DATA), name='data')
app.mount('/static', StaticFiles(directory=ROOT/'static'), name='static')
# 本机的 pids-jre-simulator（JR 全线原声）：只读取，不复制。位置见 local-config.json 的 jre_dir
import jre_routes
JRE_DIR = local_path('jre_dir')
if JRE_DIR and (JRE_DIR/'audio').is_dir() and (JRE_DIR/'data'/'line_icons').is_dir():
    app.mount('/jre/audio', StaticFiles(directory=JRE_DIR/'audio'), name='jre-audio')
    app.mount('/jre/icons', StaticFiles(directory=JRE_DIR/'data'/'line_icons'), name='jre-icons')
else:
    JRE_DIR = None
TTS_DIR = local_path('tts_dir')
SR = 24000
FIELDS = ('station', 'line', 'terminal', 'transfer', 'number', 'next2', 'door')
LANGS = ('ZH', 'JA', 'EN', 'WU')
model = None
lock = threading.Lock()
jobs = {}

# ---------------------------------------------------------------- speech check
class Checker:
    """Optional Whisper check of each synthesised clip (runs in the system Python)."""
    def __init__(self):
        self.proc = None
        self.state = 'starting'
        self.lock = threading.Lock()

    def start(self):
        configured = option('asr_python') or os.environ.get('ASR_PYTHON')
        py = configured or sys.executable
        try:
            self.proc = subprocess.Popen([py, str(ROOT/'asr_worker.py')], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.DEVNULL, text=True, encoding='utf-8', cwd=str(ROOT),
                                         env={**os.environ, 'PYTHONIOENCODING': 'utf-8'},
                                         creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            first = json.loads(self.proc.stdout.readline() or '{}')
            self.state = 'ready' if first.get('ready') else 'unavailable'
        except (OSError, ValueError):
            self.state = 'unavailable'

    def transcribe(self, path, lang, words=False):
        if self.state != 'ready': return None
        with self.lock:
            try:
                self.proc.stdin.write(json.dumps({'path': str(path), 'lang': {'WU': 'zh', 'ZH': 'zh', 'JA': 'ja', 'EN': 'en'}[lang], 'words': words}) + '\n')
                self.proc.stdin.flush()
                out = json.loads(self.proc.stdout.readline())
                return out if words else out.get('text')
            except Exception:
                traceback.print_exc(); self.state = 'unavailable'
                try: self.proc.terminate()
                except Exception: pass
                return None


checker = Checker()
threading.Thread(target=checker.start, daemon=True).start()


# ---------------------------------------------------------------- helpers
def project(pid):
    if len(pid) != 32 or any(c not in '0123456789abcdef' for c in pid):
        raise HTTPException(400, '素材编号无效')
    folder = DATA / pid
    if not (folder/'project.json').exists(): raise HTTPException(404, '素材不存在')
    return folder

def load(pid):
    info = json.loads((project(pid)/'project.json').read_text(encoding='utf-8'))
    from door_markers import MARKERS
    extra = MARKERS.get(pid, [])
    if extra:
        existing = info.get('markers', [])
        info['markers'] = sorted(existing + [m.copy() for m in extra if not any(
            m['start'] < x['end'] and x['start'] < m['end'] for x in existing)], key=lambda x: x['start'])
    return info

def save(pid, obj):
    (project(pid)/'project.json').write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

def get_model():
    global model
    if model is None:
        if TTS_DIR is None or not (TTS_DIR/'checkpoints'/'config.yaml').is_file():
            raise ValueError('替换站名需要配置本地 IndexTTS 2.5。请参阅 README 的语音配置。')
        sys.path.insert(0, str(TTS_DIR))
        from indextts.infer_v2_5 import IndexTTS2
        model = IndexTTS2(cfg_path=str(TTS_DIR/'checkpoints'/'config.yaml'), model_dir=str(TTS_DIR/'checkpoints'),
                          use_bf16=True, use_qwen_emo=False, use_cuda_kernel=False)
    return model

def norm(s):
    return re.sub(r'[\W_]+', '', str(s).lower())

def units(text, lang):
    """Rough syllable count used to predict how long a name should take to say."""
    n = 0.0
    if lang in ('ZH', 'WU'):
        for ch in text:
            if '\u4e00' <= ch <= '\u9fff': n += 1
            elif ch.isdigit(): n += 1.2
            elif ch.isalpha(): n += 1.5   # letters such as "M1路" are read like "ai-mu"
    elif lang == 'JA':
        for ch in text:
            if ch in 'ャュョァィゥェォゃゅょぁぃぅぇぉ': continue
            if '\u3040' <= ch <= '\u30ff': n += 1
            elif '\u4e00' <= ch <= '\u9fff': n += 2
            elif ch.isalnum(): n += 1
    else:
        for w in re.findall(r'[A-Za-z]+|\d+', text):
            if w.isdigit(): n += 1.5 * len(w); continue
            w = w.lower(); k = len(re.findall(r'[aeiouy]+', w))
            if w.endswith('e') and k > 1 and not w.endswith('le'): k -= 1
            n += max(1, k)
    return max(n, 1.0)

DEFAULT_RATE = {'ZH': 0.26, 'WU': 0.26, 'EN': 0.21, 'JA': 0.12}

def frame_db(x, hop):
    n = len(x) // hop
    if n == 0: return np.array([-120.0])
    f = x[:n*hop].reshape(n, hop)
    return 20*np.log10(np.sqrt((f**2).mean(1)) + 1e-7)

def speech_rms(x):
    hop = int(.01*SR); db = frame_db(x, hop)
    keep = db > db.max() - 30
    f = x[:len(db)*hop].reshape(len(db), hop)[keep]
    return float(np.sqrt((f**2).mean()) + 1e-9) if f.size else 1e-9

def snap(audio, t, radius=.06):
    """Move a cut point to the quietest 10 ms within +-radius."""
    hop = int(.01*SR); a = max(0, int((t-radius)*SR)); b = min(len(audio), int((t+radius)*SR))
    if b - a < hop*2: return t
    db = frame_db(audio[a:b], hop)
    return (a + int(np.argmin(db))*hop + hop//2) / SR

def depth_of(x):
    """Speech-to-noise distance (dB) of a recording; small for noisy recordings."""
    db = frame_db(x, int(.01*SR))
    return float(np.clip(np.percentile(db, 95) - np.percentile(db, 10) - 2, 10, 35))

def islands(x, gap=.18, depth=35):
    """Speech regions [(start, end)] in samples, merging pauses shorter than gap."""
    hop = int(.01*SR); db = frame_db(x, hop)
    on = db > max(np.percentile(db, 98) - depth, -60)
    out = []; start = None; silent = 0
    for i, v in enumerate(on):
        if v:
            if start is None: start = i
            silent = 0; end = i
        elif start is not None:
            silent += 1
            if silent*hop >= gap*SR: out.append((start*hop, (end+1)*hop)); start = None
    if start is not None: out.append((start*hop, (end+1)*hop))
    return out

def trim(x, expected, strict=True, depth=35):
    """Cut synthesis padding; for short names also any babble that follows after a pause."""
    isl = islands(x, depth=depth)
    if not isl: return x
    keep = [isl[0]]
    for s, e in isl[1:]:
        if not strict or e/SR <= expected*1.45 + .3: keep.append((s, e))
        else: break
    a = max(0, keep[0][0] - int(.03*SR)); b = min(len(x), keep[-1][1] + int(.07*SR))
    return x[a:b]

def room_tone(audio, n):
    """Background noise of the original recording, looped to n samples."""
    w = int(.3*SR)
    if len(audio) < w*2 or n <= 0: return np.zeros(n, dtype=np.float32)
    hop = w // 3; best = None
    for i in range(0, len(audio) - w, hop):
        r = float(np.sqrt(np.mean(audio[i:i+w]**2)))
        if best is None or r < best[0]: best = (r, i)
    seg = audio[best[1]:best[1]+w].copy()
    fade = int(.03*SR); seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
    out = np.zeros(n + w, dtype=np.float32); step = w - fade
    for i in range(0, n, step): out[i:i+w] += seg
    return out[:n]

def read_mono(path):
    x, sr = sf.read(path, dtype='float32', always_2d=False)
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR:
        import librosa
        x = librosa.resample(x, orig_sr=sr, target_sr=SR)
    return x

_tagger = None

def kana(s):
    """Japanese text -> katakana reading, so kanji transcripts can be compared with kana input."""
    global _tagger
    try:
        if _tagger is None:
            import fugashi
            _tagger = fugashi.Tagger()
        out = ''.join(getattr(w.feature, 'kana', None) or w.surface for w in _tagger(str(s)))
    except Exception:
        out = str(s)
    out = ''.join(chr(ord(c) + 96) if 'ぁ' <= c <= 'ゖ' else c for c in out)
    return re.sub(r'[^ァ-ヺー]', '', out)

def score(text, lang, clip, expected, heard, check_text=True, suffix=''):
    dur = len(clip)/SR; dev = abs(math.log(max(dur, .05)/expected))
    s = 1.0 - max(0.0, dev - .35)
    notes = []
    if heard is not None and lang == 'JA' and check_text:
        h, t = kana(heard), kana(text)
        if t:
            sim = difflib.SequenceMatcher(None, h, t).ratio()
            s += .7*(sim - 1)  # ASR often mishears short names (パリ -> パディ), so weigh it lighter
            if len(t) >= 2 and h.count(t) >= 2: s -= 1; notes.append('repeat')
            sk = kana(suffix)
            if sk and difflib.SequenceMatcher(None, h[-(len(sk)+2):], sk).ratio() < .6:
                s -= .6; notes.append('suffix missing')  # e.g. "の次は" dropped by the TTS
        return s, notes
    if heard is not None:
        h, t = (re.sub('[0-9〇零一二两三四五六七八九十百]+', '#', norm(x)) for x in (heard, text))  # 2号线 == 二号线
        mixed_chinese = lang in ('ZH', 'WU') and bool(re.search(r'[a-z]', t))
        phonetic = False
        if lang in ('ZH', 'WU') and not mixed_chinese:  # compare sounds, not characters: 新庄 == 莘庄
            try:
                h, t = ' '.join(_readings.pinyin_list(h)), ' '.join(_readings.pinyin_list(t))
                phonetic = True
            except Exception: pass
        # Mandarin ASR is unreliable for Shanghainese and names with spelled-out letters.
        if check_text and not mixed_chinese and lang != 'WU':
            heard_units, target_units = (h.split(), t.split()) if phonetic else (h, t)
            sim = difflib.SequenceMatcher(None, heard_units, target_units).ratio() if target_units else 0
            s += sim - 1
            if lang == 'EN':  # every word must be there: "West Nanjing" for "West Nanjing Road" is not good enough
                heard_w = set(re.findall(r"[a-z0-9]+", heard.lower().replace("'", '')))
                missing = [w for w in re.findall(r"[a-z0-9]+", text.lower().replace("'", '')) if len(w) > 1 and w not in heard_w]
                if missing: s -= .35*len(missing); notes.append('missing ' + ' '.join(missing))
        if t and len(t) >= 2 and h.count(t) >= 2: s -= 1; notes.append('repeat')
        if t and len(h) > len(t)*1.9 + 3: s -= .5; notes.append('long')
    return s, notes

def synth(text, lang, ref, expected, folder, tag, attempts=3, progress=None, strict=True, check_text=True, suffix='', check=None):
    """Generate one clip, re-trying when the length or speech check looks wrong."""
    m = get_model(); best = None
    depth = depth_of(read_mono(ref))  # the TTS copies the reference's background noise
    for k in range(attempts):
        gen = folder/f'gen-{tag}-{k}.wav'
        m.infer(spk_audio_prompt=str(ref), text=text, lang='ZH' if lang == 'WU' else lang, output_path=str(gen),
                emo_vector=[0, 0, 0, 0, 0, 0, 0, 0.3], emo_alpha=0.5, duration_factor=1.0, use_random=False, verbose=False,
                max_mel_tokens=max(60, int(50*(expected*1.9 + .9))))
        clip = trim(read_mono(gen), expected, strict, depth); gen.unlink(missing_ok=True)
        heard = checker.transcribe(_tmp(folder, tag, clip), lang)
        s, notes = score(check or text, lang, clip, expected, heard, check_text, suffix)
        print(f'[synth] {lang} {text!r} try {k+1}: {len(clip)/SR:.2f}s (expect {expected:.2f}) heard={heard!r} score={s:.2f} {notes}', flush=True)
        if best is None or s > best[0]: best = (s, clip, heard)
        if s >= .8: break
        if progress: progress(k+1)
    (folder/f'chk-{tag}.wav').unlink(missing_ok=True)
    return best

def _tmp(folder, tag, clip):
    p = folder/f'chk-{tag}.wav'; sf.write(p, clip, SR); return p


# ---------------------------------------------------------------- API
# 两个页面：/ 是原声页（只放原声、切换站点），/edit 是改编页（自定义、AI 生成替换）；旧地址 /full 转到 /edit
@app.get('/')
def home(): return FileResponse(ROOT/'static'/'original.html')

@app.get('/edit')
def edit(): return FileResponse(ROOT/'static'/'index.html')

# 改编工坊 · 欧陆巡游：欧卡 2 城市的预生成报站（tools/gen_ets2.py 生成），只播放
@app.get('/tour')
def tour(): return FileResponse(ROOT/'static'/'ets2.html')

@app.get('/api/ets2')
def ets2():
    info = json.loads((ROOT/'static'/'ets2-cities.json').read_text(encoding='utf-8'))
    try: audio = json.loads((DATA/'ets2'/'manifest.json').read_text(encoding='utf-8'))
    except Exception: audio = {}
    return {**info, 'audio': audio, 'custom': True}

@app.get('/full')
def full(): return RedirectResponse('/edit')

@app.get('/api/projects')
def projects():
    out = []
    for f in DATA.glob('*/project.json'):
        try: out.append(load(f.parent.name))
        except Exception: pass
    return sorted(out, key=lambda x: x.get('created', 0), reverse=True)

import readings as _readings
import geonames as _geonames

@app.post('/api/readings')
async def auto_readings(request: Request):
    """Japanese reading and English name for each station name (used when the page leaves them empty)."""
    body = await request.json(); city = str(body.get('city', ''))
    names = [str(n)[:60] for n in (body.get('names') or [])][:300]
    out = {}
    for n in names:
        try: out[n] = _readings.readings(n, city)
        except Exception: out[n] = {'ja': n, 'en': n}
    return out

@app.post('/api/place-names')
async def place_names(request: Request):
    body = await request.json()
    name = str(body.get('name', '')).strip()
    if not name or len(name) > 80: raise HTTPException(400, '请输入地名。')
    try:
        results = [dict(item) for item in await asyncio.to_thread(_geonames.search, name)]
    except Exception:
        raise HTTPException(503, '暂时无法连接地名数据库，请检查网络后重试。')
    for item in results:
        estimated = bool(item['ja'] and not item['ja_reading'])
        if item['ja'] and not item['ja_reading']:
            try: item['ja_reading'] = _readings.readings(item['ja'], '东京')['ja']
            except Exception: item['ja_reading'] = ''
        item['reading_is_estimated'] = estimated and bool(item['ja_reading'])
    return {'results': results}

STATE = DATA/'settings.json'
CLOUD_DIR = local_path('drive_folder')
CLOUD_URL = option('drive_url')

@app.get('/api/state')
def get_state():
    try: return json.loads(STATE.read_text(encoding='utf-8'))
    except Exception: return {}

@app.put('/api/state')
async def put_state(request: Request):
    body = await request.body()
    if len(body) > 2*1024*1024: raise HTTPException(400, '设置内容太大')
    obj = json.loads(body.decode('utf-8'))
    if not isinstance(obj, dict): raise HTTPException(400, '设置格式不对')
    tmp = STATE.with_suffix('.tmp'); tmp.write_text(json.dumps(obj, ensure_ascii=False), encoding='utf-8'); tmp.replace(STATE)
    return {'ok': True}

@app.get('/api/status')
def status():
    return {'check': checker.state, 'model': model is not None}

@app.get('/api/recordings')
def recordings():
    """List completed local results without exposing temporary or source recordings."""
    out = []
    for folder in DATA.iterdir():
        if not folder.is_dir(): continue
        try: name = load(folder.name).get('name', '录音')
        except Exception: continue
        for path in folder.glob('*.wav'):
            if not (re.fullmatch(r'saved-[0-9a-f]{24}\.wav', path.name) or
                    re.fullmatch(r'result-[0-9a-f]{32}\.wav', path.name)):
                continue
            try:
                st = path.stat()
                meta_path = path.with_suffix('.json')
                try: display_name = json.loads(meta_path.read_text(encoding='utf-8')).get('display_name') or name
                except Exception: display_name = name
                out.append({'name': display_name, 'url': f'/data/{folder.name}/{path.name}', 'modified': st.st_mtime, 'size': st.st_size})
            except OSError: continue
    return sorted(out, key=lambda x: x['modified'], reverse=True)

@app.get('/api/options')
def options():
    sounds = ROOT / 'static' / 'sounds'
    drive_url = CLOUD_URL if re.fullmatch(r'https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+/?', CLOUD_URL) else ''
    return {
        'cloud_url': drive_url,
        'melodies': [name for name in ('JRE-IKST-025-01.mp3', 'JRE-IKST-025-02.mp3', 'JR-SH1-1_old.mp3') if (sounds/name).is_file()],
        'notices': [name for name in ('bus-turn.mp3', 'bus-seat.mp3', 'bus-safety.mp3') if (sounds/name).is_file()],
    }


@app.get('/api/mine')
def mine():
    """「我的线路」给原声页播放：每条线路的设置、站点读音，以及每站已生成好的录音（没生成或内容已改的站没有 url）。"""
    try: state = json.loads(STATE.read_text(encoding='utf-8'))
    except Exception: return {'presets': []}
    out = []
    for preset in state.get('presets') or []:
        prof = (state.get('profiles') or {}).get(preset.get('key')) or {}
        base = preset.get('base') or ''
        city = '东京' if not base.startswith(('bus', 'cr', 'p_')) else '上海'
        recs = prof.get('recordings') or {}
        stations = []
        for i, st in enumerate(prof.get('stations') or []):
            name = (st.get('name') or '').strip()
            if not name: continue
            try: auto = _readings.readings(name, city)
            except Exception: auto = {}
            item = {'name': name, 'jname': st.get('jname') or auto.get('jname') or name, 'ja': st.get('ja') or auto.get('ja', ''),
                    'en': st.get('en') or auto.get('en', ''), 'no': st.get('no', '')}
            rec = recs.get(str(i)) or {}
            url = rec.get('url') or ''
            fresh = rec.get('station') == st.get('name') and ('line' not in prof or rec.get('line', '') == (prof.get('line') or '').strip())
            m = re.fullmatch(r'/data/([0-9a-f]{32})/((?:saved-[0-9a-f]{24}|result-[0-9a-f]{32})\.wav)', url)
            if fresh and m and (DATA/m[1]/m[2]).is_file(): item['url'] = url
            stations.append(item)
        out.append({'key': preset.get('key'), 'name': preset.get('name'), 'base': base, 'city': city, 'stations': stations,
                    'line': (prof.get('boardLine') or prof.get('line') or '').strip(), 'code': prof.get('code') or '', 'color': prof.get('color') or '',
                    'direction': prof.get('direction') or '', 'type': (state.get('services') or {}).get('type1') or ''})
    return {'presets': out}


@app.get('/api/jre/routes')
def jre_list():
    if not JRE_DIR: return []
    try: return jre_routes.load(JRE_DIR)
    except Exception as e: raise HTTPException(500, f'读取 JR 运行图失败：{e}')


@app.get('/api/cloud/status')
def cloud_status():
    return {'available': CLOUD_DIR is not None and CLOUD_DIR.is_dir()}


@app.post('/api/cloud/upload')
async def cloud_upload(request: Request):
    """Copy one explicitly selected generated recording to the configured sync folder."""
    body = await request.json()
    path = unquote(urlsplit(str(body.get('url', ''))).path)
    match = re.fullmatch(r'/data/([0-9a-f]{32})/((?:saved-[0-9a-f]{24}|result-[0-9a-f]{32})\.wav)', path)
    if not match: raise HTTPException(400, '请选择已生成的录音。')
    source = (project(match.group(1)) / match.group(2)).resolve()
    if not source.is_relative_to(DATA.resolve()): raise HTTPException(400, '录音路径无效。')
    if not source.is_file(): raise HTTPException(404, '找不到这段录音。')
    folder = CLOUD_DIR
    if folder is None or not folder.is_dir(): raise HTTPException(503, '找不到 Google Drive 同步文件夹，请确认桌面版已启动并登录。')
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', ' ', str(body.get('name', '报站'))).strip()[:60] or '报站'
    filename = f"{name}-{time.strftime('%Y-%m-%d-%H%M%S')}-{uuid.uuid4().hex[:6]}.wav"
    target = folder / filename
    def copy_selected():
        created = False
        try:
            with source.open('rb') as src, target.open('xb') as dst:
                created = True
                shutil.copyfileobj(src, dst)
        except Exception:
            if created:
                try: target.unlink(missing_ok=True)
                except OSError: pass
            raise
    try: await asyncio.to_thread(copy_selected)
    except OSError as exc: raise HTTPException(500, f'写入云盘同步文件夹失败：{exc}')
    return {'ok': True, 'name': filename}

@app.post('/api/upload')
async def upload(request: Request, name: str = '我的录音', locale: str = 'ZH', station: str = '', line: str = '', terminal: str = ''):
    body = await request.body()
    if not body or len(body) > 150*1024*1024: raise HTTPException(400, '请选择小于 150 MB 的音频或视频')
    pid = uuid.uuid4().hex; p = DATA/pid; p.mkdir()
    (p/'input.bin').write_bytes(body)
    try:
        res = await asyncio.to_thread(subprocess.run, ['ffmpeg', '-v', 'error', '-i', str(p/'input.bin'),
            '-vn', '-ar', str(SR), '-ac', '1', '-y', str(p/'original.wav')], capture_output=True)
        if res.returncode:
            raise HTTPException(400, '无法读取该音频或视频，请尝试其他文件。')
        d = sf.info(p/'original.wav').duration
        if d > 1800:
            raise HTTPException(400, '录音请控制在 30 分钟以内。')
    except FileNotFoundError as exc:
        shutil.rmtree(p)
        raise HTTPException(503, '导入录音需要 FFmpeg，请将其加入 PATH。') from exc
    except Exception:
        shutil.rmtree(p)
        raise
    (p/'input.bin').unlink()
    obj = {'id': pid, 'name': name.strip()[:60] or '我的录音', 'category': '我的录音', 'created': time.time(),
           'duration': d, 'markers': [], 'source': '用户导入', 'locale': locale if locale in LANGS else 'ZH',
           'station': station.strip()[:50], 'line': line.strip()[:30], 'terminal': terminal.strip()[:30]}
    (p/'project.json').write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')
    return obj

NUM = set('0123456789〇零一二两三四五六七八九十百')

def chars_of(words, lang):
    """Flatten word timestamps into comparable units with times: characters (zh/ja) or words (en)."""
    out = []
    for a, b, w in words:
        if lang == 'EN':
            for t in re.findall(r"[A-Za-z0-9']+", w): out.append((a, b, norm(t)))
            continue
        cs = [c for c in w if not re.match(r'[\s\W_]', c)]
        for k, c in enumerate(cs):
            out.append((a + (b-a)*k/len(cs), a + (b-a)*(k+1)/len(cs), '#' if c in NUM else c.lower()))
    return out

def units_of(text, lang):
    if lang == 'EN': return [norm(t) for t in re.findall(r"[A-Za-z0-9']+", text)]
    return ['#' if c in NUM else c.lower() for c in text if not re.match(r'[\s\W_]', c)]

def find_spans(seq, target, min_ratio=None):
    """All non-overlapping places in seq that look like target (fuzzy; numbers match in any form)."""
    if not target: return []
    keys = [u for _, _, u in seq]; n = len(target); hits = []
    if min_ratio is None: min_ratio = .7 if n < 5 else .55  # long names survive a few misheard characters
    for i in range(len(keys)):
        best = None
        for L in range(max(1, n-2), n+3):
            if i+L > len(keys): break
            r = difflib.SequenceMatcher(None, keys[i:i+L], target).ratio()
            if best is None or r > best[0]: best = (r, L)
        if best and best[0] >= min_ratio: hits.append((best[0], i, i+best[1]))
    hits.sort(reverse=True); taken = []; out = []
    for r, a, b in hits:
        if any(a < y and x < b for x, y in taken): continue
        taken.append((a, b)); out.append((seq[a][0], seq[b-1][1]))
    return sorted(out)

@app.post('/api/projects/{pid}/auto')
async def auto_mark(pid: str, request: Request):
    """Find where the given original names are spoken and make them replaceable."""
    info = load(pid); body = await request.json(); p = project(pid)
    if checker.state != 'ready': raise HTTPException(503, '语音识别还没准备好，请稍后再试。')
    asked = []
    for field in FIELDS:
        for lang in ('ZH', 'JA', 'EN'):
            t = str((body.get(field) or {}).get(lang, '')).strip()[:120]
            if t: asked.append((field, lang, t))
    if not asked: raise HTTPException(400, '请至少填写录音里原来的一个站名或线路名。')
    markers = []; missing = []
    for lang in sorted({l for _, l, _ in asked}):
        res = await asyncio.to_thread(checker.transcribe, p/'original.wav', lang, True)
        seq = chars_of((res or {}).get('words', []), lang)
        for field, l, t in asked:
            if l != lang: continue
            spans = find_spans(seq, units_of(t, lang))
            if not spans: missing.append(t)
            for a, b in spans:
                a = max(0.0, a - .05); b = min(info['duration'], b + .05)
                markers.append({'start': round(a, 3), 'end': round(b, 3), 'lang': lang, 'field': field, 'text': t,
                                'ref_start': round(max(0.0, a - 4), 3), 'ref_end': round(min(info['duration'], b + 4), 3)})
    markers.sort(key=lambda m: m['start']); clean = []
    for m in markers:
        if clean and m['start'] < clean[-1]['end']: continue
        clean.append(m)
    info.update(markers=clean, name=str(body.get('name') or info['name'])[:60], category='我的录音')
    for field in ('line', 'terminal'):
        entry = body.get(field) or {}
        info[field] = str(entry.get(info.get('locale', 'ZH')) or info.get(field, ''))[:30]
    save(pid, info)
    return {'project': info, 'missing': missing}

@app.delete('/api/projects/{pid}')
def remove(pid: str):
    info = load(pid)
    if info.get('category') != '我的录音': raise HTTPException(400, '只能删除自己导入的录音。')
    shutil.rmtree(project(pid)); return {'ok': True}

@app.put('/api/projects/{pid}')
async def update(pid: str, request: Request):
    original = load(pid); body = await request.json()
    name = str(body.get('name', '')).strip()[:100]
    markers = body.get('markers', [])
    if not name or not isinstance(markers, list) or len(markers) > 30: raise HTTPException(400, '请填写素材名称并检查替换位置')
    clean = []; last = -1
    for m in sorted(markers, key=lambda x: float(x.get('start', 0))):
        a = float(m['start']); b = float(m['end']); lang = m.get('lang', 'ZH'); field = m.get('field', 'station')
        if lang not in LANGS or field not in FIELDS or a < 0 or b <= a or b > original['duration']+0.05 or a < last:
            raise HTTPException(400, '替换区间无效或重叠')
        entry = {'start': a, 'end': b, 'lang': lang, 'field': field}
        if m.get('text'): entry['text'] = str(m['text'])[:120]
        if m.get('suffix'): entry['suffix'] = str(m['suffix'])[:20]
        if 'ref_start' in m and 'ref_end' in m:
            rs, re_ = float(m['ref_start']), float(m['ref_end'])
            if not 0 <= rs < re_ <= original['duration']: raise HTTPException(400, '参考语音范围无效')
            entry.update(ref_start=rs, ref_end=re_)
        clean.append(entry); last = b
    original.update(name=name, category=str(body.get('category', '自定义'))[:40], markers=clean)
    save(pid, original); return original

def setjob(jid, **kwargs): jobs[jid].update(kwargs)

def wanted(values, m):
    """Text to put in place of marker m, or None to keep the original recording."""
    if '_replacement' in m: return m['_replacement']
    field = values.get(m.get('field', 'station'), {})
    text = field.get(m['lang']) or (field.get('ZH') if m['lang'] == 'WU' else None)
    text = str(text or '').strip()
    if not text: return None if m.get('field', 'station') != 'station' else ''
    if m.get('text') and norm(text) == norm(m['text']): return None
    # Some names run straight into the next words ("新宿の次は"); those words are re-voiced with the name.
    suffix = m.get('suffix', '')
    if m.get('field') == 'station' and suffix.strip() in ('站', '车站', 'Station', 'Railway Station'):
        if text.endswith('站') or re.search(r'\bstation$', text, re.IGNORECASE):
            return text
    return text + suffix

def parse_values(body):
    if isinstance(body.get('fields'), dict):
        return {f: {k: str(v) for k, v in (body['fields'].get(f) or {}).items() if k in LANGS} for f in FIELDS}
    return {'station': {k: str(v) for k, v in body.items() if k in LANGS}}

def run_job(jid, pid, values, retake, save_key=None, markers=None, display_name=''):
    try:
        with lock:
            p = project(pid); info = load(pid); marks = markers if markers is not None else info['markers']
            setjob(jid, status='working', message='正在准备录音……')
            audio = read_mono(p/'original.wav')
            todo = [(m, wanted(values, m)) for m in marks]
            todo = [(m, t) for m, t in todo if t is not None]
            if any(not t for _, t in todo): raise ValueError('请填写站名。')
            cache = p/'cache'; cache.mkdir(exist_ok=True)
            parts = []; last = 0; warn = []
            for i, (m, text) in enumerate(todo):
                setjob(jid, message=f'正在生成第 {i+1}/{len(todo)} 段：{text}')
                a_t = snap(audio, m['start']); b_t = snap(audio, m['end'])
                a = int(a_t*SR); b = int(b_t*SR)
                old = audio[a:b]
                rate = DEFAULT_RATE[m['lang']]
                if m.get('text'):
                    isl = islands(old, depth=depth_of(audio))
                    spoken = (isl[-1][1]-isl[0][0])/SR if isl else len(old)/SR
                    rate = min(max(spoken/units(m['text'] + m.get('suffix', ''), m['lang']), rate*.6), rate*1.8)
                expected = max(.45, rate*units(text, m['lang']) + .2)  # short names carry a fixed onset/release
                key = hashlib.sha1(json.dumps([m['start'], m['end'], m['lang'], text, 10]).encode()).hexdigest()[:20]
                cached = cache/f'{key}.wav'
                if cached.exists() and not retake:
                    clip = read_mono(cached); meta = json.loads((cache/f'{key}.json').read_text(encoding='utf-8'))
                    ok = meta.get('ok', False) and meta.get('heard') is not None
                else:
                    ref = p/f'ref-{jid}-{i}.wav'
                    left = max(0, int(m['ref_start']*SR)) if 'ref_start' in m else max(0, a-6*SR)
                    right = min(len(audio), int(m['ref_end']*SR)) if 'ref_end' in m else min(len(audio), b+6*SR)
                    src = audio
                    if m.get('ref_pid'):  # noisy recording: borrow a clean announcer voice from another sample
                        src = read_mono(project(m['ref_pid'])/'original.wav')
                        left, right = int(m['ref_start']*SR), min(len(src), int(m['ref_end']*SR))
                    sf.write(ref, src[left:right], SR)
                    say = re.sub(r'([A-Za-z])(?=[A-Za-z])', r'\1 ', text) if m.get('field') == 'number' else text  # JY 30 -> J Y 30
                    if m.get('suffix') and m['lang'] == 'JA': say += '。'
                    if m['lang'] in ('ZH', 'WU'): say = _readings.tts_text(say)  # 莘庄 -> xin1庄  # a full stop helps the TTS finish "…の次は"
                    s, clip, heard = synth(say, m['lang'], ref, expected, p, f'{jid}-{i}', check_text=m.get('field') != 'number', suffix=m.get('suffix', ''), check=text,
                                           progress=lambda k: setjob(jid, message=f'第 {i+1}/{len(todo)} 段读音不理想，正在重试（{k}）……'))
                    ref.unlink(missing_ok=True)
                    ok = s >= .6 and heard is not None
                    sf.write(cached, clip, SR)
                    (cache/f'{key}.json').write_text(json.dumps({'text': text, 'heard': heard, 'score': s, 'ok': ok}, ensure_ascii=False), encoding='utf-8')
                if not ok: warn.append(text)
                clip = clip * np.clip(speech_rms(old)/speech_rms(clip), .25, 3.0)
                fade = min(int(.012*SR), len(clip)//2)
                if fade: clip[:fade] *= np.linspace(0, 1, fade); clip[-fade:] *= np.linspace(1, 0, fade)
                tone = room_tone(audio, len(clip))
                if np.percentile(frame_db(clip, int(.01*SR)), 20) < 20*np.log10(np.sqrt(np.mean(tone**2)) + 1e-7) - 6:
                    clip = clip + tone  # clean synthesis inside a noisy recording: lay the original background under it
                clip = np.clip(clip, -.98, .98)
                head = audio[last:a].copy(); f2 = min(int(.008*SR), len(head)//2)
                if f2: head[len(head)-f2:] *= np.linspace(1, 0, f2)
                if last and f2: head[:f2] *= np.linspace(0, 1, f2)
                parts.extend([head, clip]); last = b
            tail = audio[last:].copy(); f2 = min(int(.008*SR), len(tail)//2)
            if last and f2: tail[:f2] *= np.linspace(0, 1, f2)
            parts.append(tail); out = np.concatenate(parts).astype(np.float32)
            name = f'saved-{save_key}.wav' if save_key else f'result-{jid}.wav'
            sf.write(p/name, out, SR, subtype='PCM_16')
            msg = '生成完成，请试听。' if not warn else f'生成完成，但「{"、".join(warn)}」自动校验未通过或不可用，建议试听，可点「换一种读法」。'
            if save_key: (p/f'saved-{save_key}.json').write_text(json.dumps({'message': msg, 'warn': bool(warn), 'display_name': display_name}, ensure_ascii=False), encoding='utf-8')
            setjob(jid, status='done', message=msg, url=f'/data/{pid}/{name}?v={jid[:8]}', warn=bool(warn))
    except Exception as e:
        traceback.print_exc(); setjob(jid, status='error', message=f'生成失败：{e}')

@app.post('/api/generate/{pid}')
async def generate(pid: str, request: Request):
    info = load(pid); body = await request.json(); values = parse_values(body)
    if not info['markers']: raise HTTPException(400, '这段录音还没有可替换的位置。')
    marks = list(info['markers'])
    customs = body.get('custom') or []
    if not isinstance(customs, list) or len(customs) > 5: raise HTTPException(400, '自定义内容最多添加 5 项。')
    if customs and checker.state != 'ready': raise HTTPException(503, '语音识别暂不可用，无法查找自定义内容。')
    transcriptions = {}
    for item in customs:
        if not isinstance(item, dict): raise HTTPException(400, '自定义内容格式不正确。')
        lang = item.get('lang'); old = str(item.get('original', '')).strip(); new = str(item.get('replacement', '')).strip()
        if lang not in ('ZH', 'JA', 'EN') or not old or not new or len(old) > 100 or len(new) > 100:
            raise HTTPException(400, '请填写原录音中的内容和新内容，每项最多 100 字。')
        if len(units_of(old, lang)) < 2: raise HTTPException(400, '原内容太短，请输入更完整的句子。')
        if norm(old) == norm(new): continue
        if lang not in transcriptions:
            transcriptions[lang] = await asyncio.to_thread(checker.transcribe, project(pid)/'original.wav', lang, True)
        res = transcriptions[lang]
        if not res or 'words' not in res: raise HTTPException(503, '语音识别未完成，请稍后再试。')
        spans = find_spans(chars_of(res['words'], lang), units_of(old, lang), min_ratio=.9)
        if not spans: raise HTTPException(400, f'没有找到「{old}」，请检查原文或选择正确语言。')
        for a, b in spans:
            a = max(0.0, a - .03); b = min(info['duration'], b + .03)
            if any(a < float(m['end']) and float(m['start']) < b for m in marks):
                raise HTTPException(400, f'「{old}」与已有可修改内容重叠，请使用对应的设置项。')
            marks.append({'start': a, 'end': b, 'lang': lang, 'field': 'custom', 'text': old,
                          '_replacement': new, 'ref_start': max(0.0, a - 4), 'ref_end': min(info['duration'], b + 4)})
    marks.sort(key=lambda m: m['start'])
    for m in marks:
        t = wanted(values, m)
        if t == '' or (t and len(t) > 120): raise HTTPException(400, '请填写站名，每项最长 120 字。')
    # Same names as before -> play the saved announcement instead of generating again.
    key = hashlib.sha1(json.dumps([pid, [(m['start'], m['end'], wanted(values, m)) for m in marks], 'v11'], ensure_ascii=False).encode()).hexdigest()[:24]
    jid = uuid.uuid4().hex; saved = project(pid)/f'saved-{key}.wav'
    if saved.exists() and not body.get('retake'):
        meta = {}
        try: meta = json.loads((project(pid)/f'saved-{key}.json').read_text(encoding='utf-8'))
        except Exception: pass
        jobs[jid] = {'status': 'done', 'message': '之前生成过，直接播放保存的音频。', 'url': f'/data/{pid}/{saved.name}', 'warn': meta.get('warn', False), 'saved': True}
        return {'id': jid}
    jobs[jid] = {'status': 'queued', 'message': '等待生成……'}
    display_name = str(body.get('display_name', '')).strip()[:120]
    threading.Thread(target=run_job, args=(jid, pid, values, bool(body.get('retake')), key, marks, display_name), daemon=True).start()
    return {'id': jid}

@app.get('/api/jobs/{jid}')
def job(jid: str):
    if jid not in jobs: raise HTTPException(404, '任务不存在')
    return jobs[jid]

if __name__ == '__main__':
    import uvicorn, webbrowser
    import socket
    port = int(os.environ.get('PORT', '8899'))
    with socket.socket() as probe:
        busy = probe.connect_ex(('127.0.0.1', port)) == 0
    if busy:  # already running (double-clicked twice): just show the page
        print('报站模拟器已经在运行，正在打开网页……', flush=True)
        webbrowser.open(f'http://127.0.0.1:{port}'); sys.exit(0)
    print('报站模拟器正在启动，请稍候，网页会自动打开。使用时不要关闭这个窗口。', flush=True)
    if not os.environ.get('NO_BROWSER'):
        threading.Timer(1.5, lambda: webbrowser.open(f'http://127.0.0.1:{port}')).start()
    uvicorn.run(app, host='127.0.0.1', port=port)
