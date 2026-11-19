"""「欧陆巡游」：为欧卡 2 本体的每个城市预先生成报站（本机模拟器要先开着，用显卡生成）。

两套线路：
  bus510      上海公交 510 路原声，替换普通话、沪语、英语的站名
  utsunomiya  宇都宫线原声，替换日语「次は○○です」和英语站名
城市名单在 static/ets2-cities.json。结果写进 data/ets2/manifest.json，可以中断后重新运行，
已生成过的会直接用保存的结果（模拟器按内容缓存），不会重复生成。
"""
import json, sys, time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = 'http://127.0.0.1:8899'
BASES = {
    # 510 路的录音会念线路名和终点：换成这个国家的线路（如「德意志特快」）和首都
    'bus510': ('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', lambda n, c: {'station': {'ZH': c['zh'], 'WU': c['zh'], 'EN': c['en']},
                                                              'line': {'ZH': n['line']['zh'], 'WU': n['line']['zh']},
                                                              'terminal': {'ZH': n['line']['terminal'], 'WU': n['line']['terminal']}}),
    # 宇都宫线的录音只念站名（日语、英语），线路名只在显示屏上换
    'utsunomiya': ('25e42318af4f221fd284342d2966e8b7', lambda n, c: {'station': {'JA': c['ja'], 'EN': c['en']}}),
}
OUT = ROOT/'data'/'ets2'/'manifest.json'


def call(path, body=None):
    req = Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                  headers={'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    return json.loads(urlopen(req, timeout=60).read().decode('utf-8'))


def generate(pid, fields, name):
    job = call(f'/api/generate/{pid}', {'fields': fields, 'custom': [], 'retake': False, 'display_name': name})
    while True:
        state = call(f"/api/jobs/{job['id']}")
        if state['status'] == 'error': raise RuntimeError(state['message'])
        if state['status'] == 'done': return state
        time.sleep(1.5)


def main():
    cities = json.loads((ROOT/'static'/'ets2-cities.json').read_text(encoding='utf-8'))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    done = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    only = sys.argv[1:]  # 可只生成指定线路，例如 utsunomiya
    total = sum(len(c['cities']) for c in cities['countries']) * len([b for b in BASES if not only or b in only])
    n = 0
    for country in cities['countries']:
        for city in country['cities']:
            key = f"{country['id']}:{city['local']}"
            for base, (pid, make) in BASES.items():
                if only and base not in only: continue
                n += 1
                t0 = time.time()
                try:
                    state = generate(pid, make(country, city), f"欧陆巡游 · {country['line']['zh']} · {city['zh']}")
                    done.setdefault(key, {})[base] = {'url': state['url'].split('?')[0], 'warn': bool(state.get('warn'))}
                    print(f"[{n}/{total}] {country['zh']} {city['zh']} {base} {'（自动检查有提醒）' if state.get('warn') else ''} {time.time() - t0:.0f}s", flush=True)
                except Exception as e:
                    print(f"[{n}/{total}] {country['zh']} {city['zh']} {base} 失败：{e}", flush=True)
                OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding='utf-8')
    ok = sum(1 for v in done.values() for b in v)
    print(f'完成：{ok} 段录音，写入 {OUT}')


if __name__ == '__main__':
    main()
