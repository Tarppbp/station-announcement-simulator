"""整理「提示音」：上海公交车内提示（原声）和 JR 的关门注意、停车中广播、发车音乐（原声）。

- 上海公交：downloads/shanghai-bus-keys/Key-1..7.mp3（来源 github.com/95xp4qk8y5-code/shanghai-bus 的 510路/Key-*.mp3）
- JR 关门注意：每条线取一站的发车音乐，从运行图记录的 sta_cut（音乐结束、关门广播开始）剪到结尾
- JR 停车中广播：pids-jre-simulator 的 *-stopping-*.mp3
- JR 发车音乐：static/sounds 里已有的 3 段
输出：data/notices/*.mp3（录音不进公开仓库）和 data/notices/notices.json（/api/notices 读取）。
用法：python tools/build_notices.py
"""
import json, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JRE = ROOT.parent/'pids-jre-simulator'
OUT = ROOT/'data'/'notices'
BUS = [('请拉好扶手', '乘客们，车辆转弯，请拉好扶手。'), ('主动投币', '乘客们，上车请主动投币，不设找零，投币后请朝里走，谢谢。'),
       ('文明乘车', '乘客们，文明规范乘车从你我做起，请遵守七不规范，保持车厢环境整洁，请不要在车厢内吸烟，谢谢。'),
       ('请让座', '乘客们，请给需要帮助的乘客让个座，谢谢。'), ('遵守交通法规', '乘客们，请自觉遵守交通法规，下车后请走人行道，过马路请走横道线。'),
       ('勿带易燃物品', '乘客们，为了您和他人的安全，请不要携带易燃物品上车，谢谢配合。'), ('保管好随身物品', '乘客们，车辆拥挤，请您保管好自己随身携带的物品。')]
STOPPING = {'omiya-stopping-south': '大宮 停车中（京浜東北線）', 'kozu-stopping-1-down-futsu': '国府津 停车中 1（東海道線）',
            'kozu-stopping-2-down-futsu': '国府津 停车中 2（東海道線）', 'tokyo-stopping-down-futsu': '東京 停车中（東海道線）',
            'kuroiso-stopping-up': '黒磯 停车中（宇都宮線）'}
MELODIES = [('JRE-IKST-025-01.mp3', '发车音乐 JRE-IKST-025-01'), ('JRE-IKST-025-02.mp3', '发车音乐 JRE-IKST-025-02'), ('JR-SH1-1_old.mp3', '发车音乐 JR-SH1-1（旧版）')]


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def main():
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    bus = []
    for i, (title, text) in enumerate(BUS, 1):
        shutil.copyfile(ROOT/'downloads'/'shanghai-bus-keys'/f'Key-{i}.mp3', OUT/f'bus-key-{i}.mp3')
        bus.append({'title': title, 'text': text, 'url': f'/data/notices/bus-key-{i}.mp3'})
    door, seen = [], set()
    for f in sorted((JRE/'audio').glob('*/*/route.json')):
        line = f.parent.parent.name
        if line.startswith('_') or line in seen: continue
        r = json.loads(f.read_text(encoding='utf-8'))
        for s in r['stops']:
            if s.get('sta') and s.get('sta_cut'):
                src = JRE/'audio'/line/'sta'/f"{s['sta'][-1]}.mp3"
                ffmpeg('-ss', str(s['sta_cut']), '-i', str(src), '-ac', '1', '-b:a', '128k', str(OUT/f'door-{line}.mp3'))
                door.append({'title': f"{r['route']} · {s['name']}", 'text': '关门广播（ドアが閉まります）', 'url': f'/data/notices/door-{line}.mp3'})
                seen.add(line); break
    stopping = []
    for name, title in STOPPING.items():
        src = next((JRE/'audio').glob(f'*/pa/{name}.mp3'), None)
        if src: shutil.copyfile(src, OUT/f'{name}.mp3'); stopping.append({'title': title, 'text': '停车中的车内广播', 'url': f'/data/notices/{name}.mp3'})
    melody = []
    for name, title in MELODIES:
        src = ROOT/'static'/'sounds'/name
        if src.is_file(): shutil.copyfile(src, OUT/name); melody.append({'title': title, 'text': '站台发车音乐', 'url': f'/data/notices/{name}'})
    groups = [
        {'id': 'bus', 'title': '上海公交 · 车内提示', 'source': 'github.com/95xp4qk8y5-code/shanghai-bus', 'items': bus},
        {'id': 'door', 'title': 'JR · 关门注意', 'source': 'pids-jre-simulator（录音版权归 JR 东日本）', 'items': door},
        {'id': 'stopping', 'title': 'JR · 停车中广播', 'source': 'pids-jre-simulator（录音版权归 JR 东日本）', 'items': stopping},
        {'id': 'melody', 'title': 'JR · 发车音乐', 'source': 'github.com/MOTTERIA/departure-melodies', 'items': melody},
    ]
    (OUT/'notices.json').write_text(json.dumps({'groups': groups}, ensure_ascii=False, indent=1), encoding='utf-8')
    print({g['id']: len(g['items']) for g in groups})


if __name__ == '__main__':
    main()
