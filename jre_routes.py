"""读取本机 pids-jre-simulator 的运行图，转成报站模拟器使用的线路数据。

pids-jre-simulator：https://github.com/ksleungac/pids-jre-simulator
它的代码和线路数据（route.json、data/*.json）为 MIT 授权；录音属于 JR 东日本，
只在本机读取，不复制、不放进本仓库。线路标志（公有领域或 CC BY-SA 4.0，见 THIRD-PARTY.md）
随本项目放在 static/line_icons/；没有时退回读取 pids-jre-simulator 里的副本。文件夹位置由 local-config.json 的 jre_dir 指定。

运行图里每一站的字段：
  pa      列车驶向这一站途中的广播（「次は…」「まもなく…」），空表示通过不停
  sta     这一站站台上的发车音乐和关门广播
  dest    这一站起显示的终点（向后沿用，直到下一次改写）
"""
import json
from pathlib import Path

_cache = {}


def _json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def _hex(rgb, default='#9acd32'):
    try:
        return '#%02x%02x%02x' % tuple(int(x) for x in rgb[:3])
    except Exception:
        return default


def _line_entry(slug, lines):
    base, _, variant = slug.partition('.')
    entry = dict(lines.get(base) or {})
    if variant:
        entry.update((entry.get('variants') or {}).get(variant) or {})
    return entry


def _transfers(name, route, stations, lines, icons):
    info = stations.get(name) or {}
    drop = set(((info.get('transfers_by_view') or {}).get(route.get('transfer_view') or '') or {}).get('drop') or [])
    out = []
    for slug in info.get('transfers') or []:
        if slug in drop or slug.split('.')[0] in drop:
            continue
        entry = _line_entry(slug, lines)
        badges = entry.get('badges') or []
        if any(b.get('code') == route.get('line_code') for b in badges):
            continue  # 本线不算换乘
        out.append({
            'ja': entry.get('name_ja', ''), 'en': entry.get('name_en', ''),
            'badges': [{'code': b.get('code', ''), 'icon': icons.get(b.get('icon'), '')} for b in badges],
        })
    return out


def _run(run_dir, root, lines, stations, names, icons):
    route = _json(run_dir/'route.json')
    audio = (run_dir/route.get('audio_root', '..')).resolve()
    rel = audio.relative_to((root/'audio').resolve()).as_posix()

    def tracks(kind, ids):
        found = []
        for track in ids or []:
            file = audio/kind/f'{track}.mp3'
            if file.is_file():
                found.append(f'/jre/audio/{rel}/{kind}/{track}.mp3')
        return found

    stops, dest = [], route.get('dest', '')
    for i, s in enumerate(route.get('stops') or []):
        dest = s.get('dest', dest)
        name = s.get('name', '')
        tr = names.get(name) or {}
        stops.append({
            'name': name, 'kana': s.get('furigana') or tr.get('furigana', ''), 'en': s.get('english') or tr.get('english', ''),
            'code': s.get('sta_code', ''), 'code3': (stations.get(name) or {}).get('code_3', ''),
            'pass': i > 0 and not s.get('pa'), 'pa': tracks('pa', s.get('pa')), 'sta': tracks('sta', s.get('sta')),
            'dest': dest, 'transfers': _transfers(name, route, stations, lines, icons),
        })
    first, last = (stops[0]['name'], stops[-1]['name']) if stops else ('', '')
    return {
        'id': run_dir.relative_to(root/'audio').as_posix(), 'line': route.get('route', ''), 'code': route.get('line_code', ''),
        'color': _hex(route.get('color')), 'type': route.get('type', ''), 'type_color': _hex(route.get('type_color'), '') if route.get('type_color') else '',
        'direction': route.get('direction', ''), 'remarks': route.get('remarks', ''), 'dest': route.get('dest', ''),
        'loop': bool(stops) and first == last, 'from': first, 'to': last, 'stops': stops,
    }


def load(root):
    """返回全部运行图。以 route.json 的修改时间做缓存，数据没变就不重新读取。"""
    root = Path(root)
    files = sorted(p for p in (root/'audio').glob('*/*/route.json') if not any(part.startswith('_') for part in p.relative_to(root/'audio').parts))
    stamp = tuple((str(p), p.stat().st_mtime) for p in files)
    if _cache.get('stamp') == stamp:
        return _cache['data']
    data = root/'data'
    lines, stations, names = _json(data/'lines.json'), _json(data/'stations.json'), _json(data/'translations.json')
    own = Path(__file__).resolve().parent/'static'/'line_icons'
    icons = {p.stem: f'/jre/icons/{p.name}' for p in (data/'line_icons').glob('*.png')}
    icons.update({p.stem: f'/static/line_icons/{p.name}' for p in own.glob('*.png')})
    runs = []
    for f in files:
        try:
            runs.append(_run(f.parent, root, lines, stations, names, icons))
        except Exception as e:  # 单个运行图出错不影响其他
            print('[jre] 跳过', f.parent.name, e)
    _cache.update(stamp=stamp, data=runs)
    return runs


if __name__ == '__main__':
    import sys
    for r in load(sys.argv[1]):
        stops = r['stops']
        print(r['id'], r['line'], r['direction'], r['type'], len(stops), '站',
              '停', sum(not s['pass'] for s in stops), '广播', sum(len(s['pa']) for s in stops), '发车音乐', sum(len(s['sta']) for s in stops))
