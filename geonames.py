"""Look up real place names; never guess a missing multilingual name."""
import json
import re
import threading
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

NOMINATIM = 'https://nominatim.openstreetmap.org/search'
WIKIDATA = 'https://www.wikidata.org/w/api.php'
USER_AGENT = 'StationSimulator/1.0 (personal transit announcement simulator; place name lookup)'
_lock = threading.Lock()
_last_request = 0.0
_cache = {}


def _json(url, params, timeout=12):
    request = Request(url + '?' + urlencode(params), headers={
        'User-Agent': USER_AGENT, 'Accept': 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7'})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read(4 * 1024 * 1024).decode('utf-8'))


def _osm_search(query):
    global _last_request
    with _lock:
        wait = 1.1 - (time.monotonic() - _last_request)
        if wait > 0: time.sleep(wait)
        _last_request = time.monotonic()
        return _json(NOMINATIM, {'q': query, 'format': 'jsonv2', 'addressdetails': 1,
                                 'namedetails': 1, 'extratags': 1, 'limit': 6})


def _wikidata(ids):
    if not ids: return {}
    data = _json(WIKIDATA, {'action': 'wbgetentities', 'ids': '|'.join(ids),
                            'props': 'labels|claims', 'languages': 'zh-hans|zh|ja|en', 'format': 'json'}, timeout=10)
    return data.get('entities', {})


def _label(entity, *langs):
    labels = entity.get('labels') or {}
    return next((str(labels[lang].get('value', '')).strip() for lang in langs
                 if lang in labels and labels[lang].get('value')), '')


def _japanese_reading(entity):
    for claim in (entity.get('claims') or {}).get('P1814', []):
        try:
            value = claim['mainsnak']['datavalue']['value']
            text = value['text'] if isinstance(value, dict) else value
            if re.fullmatch(r'[ぁ-ゖァ-ヺー・ 　]+', text): return text
        except (KeyError, TypeError): pass
    return ''


def search(query):
    query = str(query).strip()
    if not query or len(query) > 80: raise ValueError('请输入不超过 80 个字的地名。')
    cached = _cache.get(query)
    if cached and time.monotonic() - cached[0] < 86400: return cached[1]
    places = _osm_search(query)
    if not isinstance(places, list): raise ValueError('地名服务返回的数据有误。')
    ids = list(dict.fromkeys(str((p.get('extratags') or {}).get('wikidata', '')) for p in places))
    ids = [x for x in ids if re.fullmatch(r'Q[1-9][0-9]*', x)]
    try: entities = _wikidata(ids)
    except Exception: entities = {}  # OpenStreetMap can still supply individual language names.
    results = []
    for p in places:
        names = p.get('namedetails') or {}
        qid = str((p.get('extratags') or {}).get('wikidata', ''))
        entity = entities.get(qid, {})
        zh = names.get('name:zh-Hans') or names.get('name:zh') or _label(entity, 'zh-hans', 'zh')
        ja = names.get('name:ja') or _label(entity, 'ja')
        en = names.get('name:en') or _label(entity, 'en')
        results.append({'name': str(p.get('name') or ''), 'context': str(p.get('display_name') or ''),
                        'zh': str(zh or ''), 'ja': str(ja or ''), 'en': str(en or ''),
                        'ja_reading': _japanese_reading(entity),
                        'wikidata': qid if re.fullmatch(r'Q[1-9][0-9]*', qid) else ''})
    _cache[query] = (time.monotonic(), results)
    return results
