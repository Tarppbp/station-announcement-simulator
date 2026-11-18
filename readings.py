"""Automatic readings for station names.

Chinese (Shanghai)  -> English in the style used by Shanghai announcements:
    南京西路 -> West Nanjing Road, 人民广场 -> People's Square,
    公平路东长治路 -> Gongping Road at Dongchangzhi Road
Japanese (Tokyo)    -> hiragana reading and Hepburn romaji:
    錦糸町 -> きんしちょう / Kinshicho
Hand-typed readings in the page always win over these.
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent/'text_lib'))

# ---------------------------------------------------------------- Chinese -> English
FIXED = {  # names whose English is a translation rather than pinyin
    '人民广场': "People's Square", '世纪大道': 'Century Avenue', '上海火车站': 'Shanghai Railway Station',
    '虹桥火车站': 'Hongqiao Railway Station', '上海南站': 'Shanghai South Railway Station', '上海西站': 'Shanghai West Railway Station',
    '浦东国际机场': 'Pudong International Airport', '浦东机场': 'Pudong Airport', '虹桥枢纽': 'Hongqiao Hub',
    '上海科技馆': 'Shanghai Science and Technology Museum', '上海体育场': 'Shanghai Stadium', '上海体育馆': 'Shanghai Indoor Stadium',
    '徐家汇': 'Xujiahui', '陆家嘴': 'Lujiazui', '静安寺': "Jing'an Temple", '豫园': 'Yuyuan Garden', '外滩': 'The Bund',
    '迪士尼': 'Disney Resort', '东方明珠': 'Oriental Pearl Tower', '北京南': 'Beijing South', '苏州北': 'Suzhou North', '南京南': 'Nanjing South',
    '巴黎': 'Paris', '伦敦': 'London', '东京': 'Tokyo', '大阪': 'Osaka', '北京': 'Beijing', '上海': 'Shanghai',
}
PHRASES = {  # polyphones that pypinyin gets wrong in place names
    '长治': ['chang', 'zhi'], '长宁': ['chang', 'ning'], '长寿': ['chang', 'shou'], '长江': ['chang', 'jiang'], '长阳': ['chang', 'yang'],
    '长清': ['chang', 'qing'], '长白': ['chang', 'bai'], '长兴': ['chang', 'xing'], '长乐': ['chang', 'le'], '长安': ['chang', 'an'],
    '长春': ['chang', 'chun'], '长沙': ['chang', 'sha'], '长征': ['chang', 'zheng'], '长桥': ['chang', 'qiao'], '长岛': ['chang', 'dao'],
    '莘庄': ['xin', 'zhuang'], '六安': ['lu', 'an'], '蚌埠': ['beng', 'bu'], '番禺': ['pan', 'yu'], '厦门': ['xia', 'men'],
    '乐山': ['le', 'shan'], '行知': ['xing', 'zhi'], '大厦': ['da', 'sha'], '重庆': ['chong', 'qing'], '朝阳': ['chao', 'yang'],
    '曹家渡': ['cao', 'jia', 'du'], '会稽': ['kuai', 'ji'], '解放': ['jie', 'fang'], '虹口': ['hong', 'kou'], '虹桥': ['hong', 'qiao'],
    '泾': ['jing'], '漕溪': ['cao', 'xi'], '华漕': ['hua', 'cao'], '行政': ['xing', 'zheng'],
}
SUFFIX = [  # (Chinese, English, kind) longest first
    ('国际机场', 'International Airport', 'place'), ('火车站', 'Railway Station', 'place'), ('航站楼', 'Terminal', 'terminal'),
    ('汽车站', 'Bus Station', 'place'), ('客运站', 'Bus Terminal', 'place'), ('码头', 'Pier', 'place'),
    ('机场', 'Airport', 'place'), ('广场', 'Square', 'place'), ('公园', 'Park', 'place'), ('大道', 'Avenue', 'road'),
    ('公路', 'Highway', 'road'), ('大桥', 'Bridge', 'place'), ('隧道', 'Tunnel', 'place'), ('大学', 'University', 'place'),
    ('医院', 'Hospital', 'place'), ('中心', 'Center', 'place'), ('新村', 'Xincun', 'place'), ('枢纽', 'Hub', 'place'),
    ('路', 'Road', 'road'), ('街', 'Street', 'road'), ('镇', 'Town', 'place'), ('站', 'Station', 'place'),
]
DIRS = {'东': 'East', '西': 'West', '南': 'South', '北': 'North', '中': 'Middle'}

def _pinyin(text):
    from pypinyin import lazy_pinyin, load_phrases_dict, Style
    if not getattr(_pinyin, 'ready', False):
        load_phrases_dict({k: [[s] for s in v] for k, v in PHRASES.items()}, style='normal')
        _pinyin.ready = True
    syl = lazy_pinyin(text, style=Style.NORMAL, errors=lambda x: list(x))
    word = ''
    for s in syl:
        if word and s and s[0] in 'aoe' and word[-1].isalpha():
            word += "'"  # Xi'an, Jing'an
        word += s
    return word[:1].upper() + word[1:]

def pinyin_list(text):
    """Toneless pinyin syllables (place-name polyphones fixed) for comparing what was heard."""
    from pypinyin import lazy_pinyin, Style
    _pinyin('')  # make sure the place-name phrases are loaded
    return [x for x in lazy_pinyin(str(text), style=Style.NORMAL, errors='ignore') if x.strip()]

TTS_FIX = {  # tell the TTS the right reading of place-name polyphones (pinyin with tone digit)
    '莘庄': 'xin1庄', '莘松': 'xin1松', '莘': 'xin1', '长治': 'chang2治', '长宁': 'chang2宁', '长寿': 'chang2寿', '长江': 'chang2江',
    '长阳': 'chang2阳', '长白': 'chang2白', '长清': 'chang2清', '长兴': 'chang2兴', '长桥': 'chang2桥', '长征': 'chang2征',
    '六安': 'lu4安', '蚌埠': 'beng4埠', '番禺': 'pan1禺', '会稽': 'kuai4稽', '行知': 'xing2知', '乐山': 'le4山', '大厦': '大sha4',
}

def tts_text(text):
    for k in sorted(TTS_FIX, key=len, reverse=True):
        text = text.replace(k, TTS_FIX[k])
    return text

def zh_to_en(name):
    name = re.sub(r'\s+', '', str(name))
    if not name: return ''
    if re.fullmatch(r"[A-Za-z0-9 .,'&-]+", name): return name
    if name in FIXED: return FIXED[name]
    # "X号航站楼" -> "Terminal X"
    m = re.fullmatch(r'(.*?)(\d+)号?航站楼', name)
    if m: return (zh_to_en(m.group(1)) + ' Airport ' if m.group(1) else '') + 'Terminal ' + m.group(2)
    parts, rest = [], name
    while rest:
        for zh, en, kind in SUFFIX:
            k = rest.find(zh)
            if k > 0:
                base = rest[:k]; rest = rest[k + len(zh):]
                if base in FIXED: parts.append((FIXED[base] + ' ' + en, kind)); break
                if kind == 'road' and len(base) >= 3 and base[-1] in DIRS:  # 南京西路 -> West Nanjing Road
                    parts.append((f'{DIRS[base[-1]]} {_pinyin(base[:-1])} {en}', kind))
                elif zh == '站' and base[-1] in DIRS and len(base) >= 2:     # 上海南站 -> Shanghai South Station
                    parts.append((f'{_pinyin(base[:-1])} {DIRS[base[-1]]} {en}', kind))
                else:
                    parts.append((f'{_pinyin(base)} {en}', kind))
                break
        else:
            parts.append((FIXED.get(rest) or _pinyin(rest), 'name')); rest = ''
    if len(parts) == 2 and all(k == 'road' for _, k in parts):
        return f'{parts[0][0]} at {parts[1][0]}'  # bus-stop style: 公平路东长治路
    return ' '.join(p for p, _ in parts)

# ---------------------------------------------------------------- Japanese -> kana / romaji
_tagger = None

def ja_kana(name):
    """Hiragana reading of a Japanese name (kanji via the UniDic dictionary)."""
    global _tagger
    name = str(name).strip()
    if not name: return ''
    if re.fullmatch(r'[ぁ-ゖー・]+', name): return name
    try:
        if _tagger is None:
            import fugashi
            _tagger = fugashi.Tagger()
        kata = ''.join(getattr(w.feature, 'kana', None) or w.surface for w in _tagger(name))
    except Exception:
        kata = name
    return ''.join(chr(ord(c) - 96) if 'ァ' <= c <= 'ヶ' else c for c in kata)

ROMA = {
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo', 'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho', 'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo', 'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo', 'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo', 'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo', 'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo', 'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o', 'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so', 'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no', 'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo', 'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro', 'わ': 'wa', 'を': 'o', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go', 'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do', 'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po', 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
}

def kana_to_romaji(kana):
    out, i = '', 0
    while i < len(kana):
        c = kana[i]
        if c == 'っ' and i + 1 < len(kana):
            nxt = ROMA.get(kana[i+1:i+3]) or ROMA.get(kana[i+1], '')
            out += 't' if nxt.startswith('ch') else nxt[:1]; i += 1; continue
        if c == 'ー': i += 1; continue
        if c == '・': out += ' '; i += 1; continue
        two = kana[i:i+2]
        if two in ROMA: out += ROMA[two]; i += 2; continue
        if c in ROMA:
            r = ROMA[c]
            if c == 'ん' and i + 1 < len(kana) and (ROMA.get(kana[i+1], 'x')[0] in 'aiueoy'): r = "n'"
            out += r
        else:
            out += c
        i += 1
    out = re.sub(r'ou|oo', 'o', out); out = re.sub(r'uu', 'u', out)  # Tokyo, Oimachi (JR signage style)
    return ' '.join(w[:1].upper() + w[1:] for w in out.split(' '))

JA_SUFFIX = {'駅': 'Station', '空港': 'Airport', '公園': 'Park', '大学': 'University', '病院': 'Hospital', '広場': 'Square', '港': 'Port'}

def _ja_place_en(jname):
    """English for a Japanese place name ('渋谷' -> 'Shibuya', '東京駅' -> 'Tokyo Station'), or None if it doesn't look Japanese."""
    global _tagger
    try:
        if _tagger is None:
            import fugashi
            _tagger = fugashi.Tagger()
        words = list(_tagger(jname))
    except Exception:
        return None
    parts = []
    for w in words:
        if w.surface in JA_SUFFIX and parts: parts.append(JA_SUFFIX[w.surface]); continue
        if getattr(w.feature, 'pos3', '') != '地名' and getattr(w.feature, 'pos2', '') != '固有名詞': return None
        kana = ''.join(chr(ord(c) - 96) if 'ァ' <= c <= 'ヶ' else c for c in (getattr(w.feature, 'kana', None) or ''))
        if not re.fullmatch(r'[ぁ-ゖー]+', kana): return None
        parts.append(kana_to_romaji(kana))
    return ' '.join(parts) if parts else None

def readings(name, city):
    """{'jname': Japanese written form, 'ja': reading for the TTS, 'en': English}."""
    import ja_names
    name = str(name).strip()
    if not name: return {'jname': '', 'ja': '', 'en': ''}
    if city == '东京' or re.search(r'[ぁ-ヺ]', name):
        jname, en, fixed = ja_names.to_japanese(name)
        chinese_road = bool(re.search(r'[路街]$', jname))
        if fixed: reading = fixed
        elif re.fullmatch(r'[ァ-ヺー・ 　]+', jname): reading = jname          # katakana names: the TTS reads them as written
        elif chinese_road: reading = ja_kana(jname[:-1]) + 'ろ'                 # 南京西路 -> なんきんにしろ
        else: reading = ja_kana(jname)
        if not en:
            chinese_place = fixed or chinese_road or name in FIXED
            if not chinese_place:
                en = _ja_place_en(jname)                                        # 涩谷 -> 渋谷 -> Shibuya
                if not en and jname == name and not re.search(r'[a-zA-Z]', name):
                    kana = reading if re.fullmatch(r'[ぁ-ゖー・]+', reading) else ''
                    en = kana_to_romaji(kana) if kana else None                # Japanese input: romaji of the reading
            en = en or zh_to_en(name)
        return {'jname': jname, 'ja': reading, 'en': en}
    foreign = ja_names.FOREIGN.get(name)  # 柏林 -> Berlin (not "Bolin")
    return {'jname': foreign[0] if foreign else name, 'ja': name, 'en': foreign[1] if foreign else zh_to_en(name)}

if __name__ == '__main__':
    for n in ['公平路东长治路', '南京西路', '人民广场', '上海南站', '虹桥2号航站楼', '莘庄', '陆家嘴', '中山公园', '长寿路', '静安寺', '武威东路真金路', '西藏南路', '浦东大道', '张江高科']:
        print(n, '->', zh_to_en(n))
    for n in ['錦糸町', '新小岩', '東京', '大井町', '日暮里', '品川', '御茶ノ水', '秋葉原', '新宿', '両国', '葛西臨海公園',
              '巴黎', '伦敦', '人民广场', '涩谷', '上海', '北京', '南京西路', '浦东机场', '横滨', '东京站', '迪士尼乐园', '曼彻斯特', '杭州', '樱花站']:
        r = readings(n, '东京'); print(n, '->', r['jname'], '|', r['ja'], '|', r['en'])
