'use strict';
const $ = id => document.getElementById(id);
const row = (name, ja = '', en = '', no = '', tja = '', ten = '') => ({name, ja, en, no, tja, ten});

/* =====================================================================
   线路定义
   线路有原声时可以试听及替换已定位的名称。
   ===================================================================== */
const JR = (key, pid, name, code, color, direction, stations, note, extra = {}) => ({
 key, city: '东京', kind: '铁路', name, code, color, pid, ja: true, en: true, line: name, direction, stations, note, ...extra});
const CR = (key, pid, name, code, station, english, stationLabel, sub, note, serial) => ({
 key, pid, name, code, stationLabel, sub, note,
 city: '国铁', kind: '高铁', color: '#c8102e', en: true, line: name,
 stations: [row(station)], stationEnglish: {[station]: english},
 sourceUrl: 'https://www.jprailfan.com/announce/downconfirm.php?serial=' + serial
});
const routes = [
 {key: 'bus510', city: '上海', kind: '公交', name: '公交 510 路', code: '510', color: '#e77736', pid: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', en: true,
  line: '510路', terminal: '武威东路真金路', direction: '武威东路真金路方向', sub: '普通话 · 沪语 · 英语',
  stations: [row('公平路东长治路', '', 'Gongping Road at Dongchangzhi Road'), row('巴黎', 'パリ', 'Paris')],
  note: '普通话、沪语、英语原声。线路名、终点站、下一站会用语音生成替换，其余保留原声；沪语里的新名称暂用普通话。'},
 CR('crG3106', 'e521e8a6e66d880504ea0b20bae44ab8', '国铁 G3106 · 南京南', 'G3106',
  '南京南', 'Nanjing Nan', '即将到站', '到站预告 · 中英',
  '2022 年车内实录。可改中英文站名，保留行李和下车提示。', '2134'),
 CR('crG5602', 'f527a0650e23c6ed1aec3603b69b215c', '国铁 G5602 · 福田', 'G5602',
  '福田', 'Futian', '到站', '到站广播 · 中英',
  '2025 年车内实录的普通话和英文片段。可改站名，保留脚下安全提示。', '2820'),

 JR('yamanote', 'ffffffffffffffffffffffffffffffff', '山手線', 'JY', '#9acd32', '品川・渋谷方面',
  [row('目黒', 'めぐろ', 'Meguro', 'JY 22', '東急目黒線、地下鉄南北線、都営地下鉄三田線', 'the Tokyu Meguro Line, the Namboku Subway Line, and the Mita Subway Line'), row('五反田', 'ごたんだ', 'Gotanda', 'JY 23')],
  'E235 现行车内广播（目黒站前），清晰。可替换站名、车站编号、换乘；录音里没有念线路名。', {sub: 'E235 现行广播'}),
 JR('chuo', 'f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1', '中央線快速', 'JC', '#f15a22', '四ツ谷・東京方面',
  [row('新宿', 'しんじゅく', 'Shinjuku', 'JC 05', '代々木、千駄ケ谷、信濃町へおいでのお客様と、山手線、埼京線、湘南新宿ライン、小田急線、京王線、地下鉄丸ノ内線、都営地下鉄新宿線、都営地下鉄大江戸線', 'the Chuo Line local service, the Yamanote Line, the Saikyo Line, the Shonan-Shinjuku Line, the Odakyu Line, the Keio Line, the Marunouchi Subway Line, the Shinjuku Subway Line, and the Oedo Subway Line'), row('四ツ谷', 'よつや', 'Yotsuya', 'JC 04')],
  '车内自动广播（新宿到站前），很清晰。可替换站名、编号、再下一站、换乘。', {sub: 'E233 自动广播'}),
 JR('sobu', 'cae9e0662bf94ae41a5da3c2c1e50892', '総武快速線', 'JO', '#0067c0', '千葉・成田空港方面',
  [row('錦糸町', 'きんしちょう', 'Kinshicho', 'JO 22', '亀戸・平井へおいでのお客様と、地下鉄半蔵門線', 'the Sobu Line local service and the Hanzomon Subway Line'), row('新小岩', 'しんこいわ', 'Shin-Koiwa', 'JO 23')],
  '车内广播（錦糸町站前），清晰。可替换站名、编号、再下一站、换乘。', {sub: 'E235 广播'}),
 JR('keiyo', '55e540aa82543448a2360c58e7692359', '京葉線', 'JE', '#c9242f', '東京方面',
  [row('葛西臨海公園', '葛西臨海公園', 'Kasai-Rinkai Park', 'JE 06'), row('新木場', 'しんきば', 'Shin-Kiba', 'JE 05')],
  '车内广播（舞浜→葛西臨海公園），清晰。可替换线路名、终点、站名、编号。', {sub: '可换线路名和终点', terminal: '東京'}),
 JR('tokaido', '7548577c27ebf1a913f148f41f74efc4', '東海道線', 'JT', '#f68b1e', '横浜・小田原方面',
  [row('横浜', 'よこはま', 'Yokohama', 'JT 05'), row('戸塚', 'とつか', 'Totsuka', 'JT 06')],
  '普通列车车内广播（横浜站前），很清晰。可替换站名、编号。', {sub: '很清晰'}),
 JR('takasaki', 'bdc2617d2fba3d1dc453d5aa18aa360c', '高崎線', 'JU', '#f68b1e', '大宮・高崎方面',
  [row('浦和', 'うらわ', 'Urawa', 'JU 05'), row('さいたま新都心', 'さいたましんとしん', 'Saitama-Shintoshin', 'JU 06')],
  '车内广播（浦和站前），很清晰。可替换站名、编号。', {sub: '很清晰'}),
 JR('utsunomiya', '25e42318af4f221fd284342d2966e8b7', '宇都宮線', 'JU', '#f68b1e', '上野・東京方面',
  [row('東大宮', 'ひがしおおみや', 'Higashi-Omiya'), row('土呂', 'とろ', 'Toro')],
  '车内广播（東大宮站前），清晰。可替换站名。', {sub: '清晰'}),

];
const KINDS = ['公交', '地铁', '铁路', '高铁', '巴士'];
const known = {巴黎: ['パリ', 'Paris'], 东京: ['東京', 'Tokyo'], 上海: ['上海', 'Shanghai'], 伦敦: ['ロンドン', 'London'], 大阪: ['大阪', 'Osaka'], 北京: ['北京', 'Beijing'], 新宿: ['しんじゅく', 'Shinjuku'], 涩谷: ['しぶや', 'Shibuya'], 渋谷: ['しぶや', 'Shibuya'], 品川: ['しながわ', 'Shinagawa'], 人民广场: ['人民広場', "People's Square"], 浦东机场: ['浦東空港', 'Pudong Airport'], 虹桥枢纽: ['虹橋', 'Hongqiao Hub'], 北京南: ['北京南', 'Beijing South'], 浅草: ['あさくさ', 'Asakusa'], 新大阪: ['しんおおさか', 'Shin-Osaka'], 成田空港: ['なりたくうこう', 'Narita Airport'], 東京: ['とうきょう', 'Tokyo'], 横浜: ['よこはま', 'Yokohama'], 上野: ['うえの', 'Ueno'], パリ: ['パリ', 'Paris'], ロンドン: ['ロンドン', 'London']};
const TYPES = {
 上海: ['普通', '大站车', '区间车', '快车', '直达', '首班车', '末班车', '定班车', '高峰车', '夜宵线', '各站停车', '快速', '通勤快速', '特别快速', '准急', '急行', '快速急行', '特快', '特急', '直通'],
 东京: ['普通', '各駅停車', '快速', '通勤快速', '特別快速', '中央特快', '青梅特快', '快速アクティー', '急行', '特急', 'ライナー', '回送'],
};
function fillTypes() {
 const list = TYPES[sel().city] || TYPES.上海;
 const value = S.services.type1 || '普通', options = list.includes(value) ? list : [value, ...list];
 $('type1').innerHTML = options.map(type => `<option>${esc(type)}</option>`).join('') + '<option value="__custom">自定义……</option>';
 $('type1').value = value;
}
$('type1').onchange = () => {
 const choice = $('type1').value;
 const value = choice === '__custom' ? (prompt('输入车种名称', '') || '').trim().slice(0, 10) : choice;
 if (value) S.services.type1 = value;
 fillTypes(); draw(); persist();
};
const serviceMarks = {
 中央特快: 'chuo', 青梅特快: 'ome', 特別快速: 'chuo', 特别快速: 'chuo',
 快速: 'rapid', 通勤快速: 'rapid', 快速アクティー: 'rapid', 快车: 'rapid', 大站车: 'rapid',
 特急: 'express', 特快: 'express', 快速急行: 'express', 通勤特快: 'express'
};

/* =====================================================================
   状态（保存在本机服务 data/settings.json，浏览器里另存一份）
   ===================================================================== */
let S = {selected: 'bus510', profiles: {}, presets: [], services: {type1: '普通'}, city: '全部'};
let projects = [], current = null, rev = 0, resultUrl = null, lastRequest = null, saveTimer = null;
const audio = $('audio');
let cloudUrl = 'https://drive.google.com/drive/my-drive';

async function api(url, opts) { const r = await fetch(url, opts); if (!r.ok) { const x = await r.json().catch(() => ({})); throw Error(x.detail || '请求失败') } return r.json() }
const post = (url, body) => api(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
async function waitJob(id, onMessage, isCurrent = () => true) {
 while (isCurrent()) {
  const state = await api(`/api/jobs/${id}`);
  if (!isCurrent()) return null;
  onMessage?.(state.message);
  if (state.status === 'error') throw Error(state.message);
  if (state.status === 'done') return state;
  await new Promise(resolve => setTimeout(resolve, 900));
 }
 return null;
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600) }
function persist() {
 clearTimeout(saveTimer);
 saveTimer = setTimeout(() => { try { localStorage.setItem('station-sim-state', JSON.stringify(S)) } catch (e) {} fetch('/api/state', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(S)}).catch(() => {}) }, 500);
}

/* ---------- 线路查找 ---------- */
function importedRoutes() {
 return projects.filter(p => p.category === '我的录音').map(p => {
  const ms = p.markers || [], japanese = p.locale === 'JA' || ms.some(m => m.lang === 'JA');
  return {key: 'p_' + p.id, city: japanese ? '东京' : '上海', kind: '我的录音', name: p.name, code: 'REC', color: '#5b6b8c', pid: p.id, imported: true,
   ja: japanese, en: p.locale === 'EN' || ms.some(m => m.lang === 'EN'), line: p.line || '', terminal: p.terminal || undefined, sub: `可替换 ${ms.length} 处`,
   stations: [row(ms.find(m => m.field === 'station' && m.lang === (japanese ? 'JA' : 'ZH'))?.text || p.station || '站名', '', ms.find(m => m.field === 'station' && m.lang === 'EN')?.text || '')],
   note: '自己导入的录音。录音来源和使用范围请自行确认。'};
 });
}
function allRoutes() { return routes.concat(importedRoutes()) }
function baseRoute(key) { return allRoutes().find(r => r.key === key) }
function presetOf(key) { return S.presets.find(p => p.key === key && baseRoute(p.base)) }
/** 当前选择：内置线路、导入录音，或“我的线路”（基于某条线路 + 自己的设置） */
function sel() {
 const p = presetOf(S.selected);
 if (p) { const b = baseRoute(p.base) || routes[0]; return {...b, key: p.key, preset: p, name: p.name, sub: '基于 ' + b.name} }
 return baseRoute(S.selected) || routes[0];
}
function profile() {
 const r = sel();
 if (!S.profiles[r.key]) S.profiles[r.key] = {stations: structuredClone(r.stations || [row('巴黎', 'パリ', 'Paris')]), idx: 0};
 const p = S.profiles[r.key]; if (!p.stations.length) p.stations.push(row('')); p.idx = Math.min(Math.max(0, p.idx || 0), p.stations.length - 1);
 return p;
}
const curRow = () => profile().stations[profile().idx];
function has(field) { return !!current?.markers?.some(m => (m.field || 'station') === field) }
function readingsOf(name) { const k = known[name]; return k ? {ja: k[0], en: k[1]} : (autoOf(name) || null) }
const autoR = {};  // 自动读音缓存：城市|站名 -> {ja, en}
const autoOf = name => autoR[sel().city + '|' + String(name || '').trim()];
function fill(r) {
 const a = autoOf(r.name), k = known[r.name], stationEnglish = sel().stationEnglish?.[r.name];
 return {jname: r.jname || a?.jname || r.name, ja: r.ja || k?.[0] || a?.ja || r.name, en: r.en || stationEnglish || k?.[1] || a?.en || r.name};
}
async function ensureReadings(names) {
 const city = sel().city, need = [...new Set(names.map(n => String(n || '').trim()).filter(n => n && !autoR[city + '|' + n]))];
 if (!need.length) return false;
 try { const res = await post('/api/readings', {city, names: need}); for (const [n, v] of Object.entries(res)) autoR[city + '|' + n] = v; return true } catch (e) { return false }
}
let readTimer = null;
function refreshReadings() {
 clearTimeout(readTimer);
 readTimer = setTimeout(async () => {
  const p = profile(), names = p.stations.map(x => x.name).concat([$('terminal').value]);
  if (await ensureReadings(names)) { updatePlaceholders(); showStation(true) }
 }, 350);
}

/* =====================================================================
   线路列表
   ===================================================================== */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const FIELD_NAMES = {station: '站名', line: '线路名', terminal: '终点站', transfer: '换乘', number: '车站编号', next2: '再下一站', door: '开门方向'};
const LANGUAGE_NAMES = {ZH: '普通话', WU: '沪语', JA: '日文', EN: '英文'};
function renderEditable() {
 const marks = current?.markers || [];
 const grouped = new Map();
 for (const m of marks) {
  const field = m.field || 'station', key = field + ':' + m.lang;
  if (!grouped.has(key)) grouped.set(key, {field, lang: m.lang, examples: new Set()});
  if (m.text) grouped.get(key).examples.add(m.text);
 }
 $('editHint').textContent = '以下是这段录音已定位、可修改的内容；未列出的原声会保留。';
 $('editList').innerHTML = [...grouped.values()].map(g => `<li><b>${esc(FIELD_NAMES[g.field] || g.field)}</b> · ${esc(LANGUAGE_NAMES[g.lang] || g.lang)}${g.examples.size ? '：' + esc([...g.examples].join('、')) : ''}</li>`).join('') || '<li>暂未定位可替换内容。</li>';
 $('doorLabel').hidden = !has('door');
 $('doorSide').value = curRow().door || 'original';
 $('customArea').hidden = !current?.markers?.length;
 renderCustomRows();
}
function renderCustomRows() {
 const rows = profile().customEdits || [];
 $('customRows').innerHTML = rows.map((x, i) => `<div class="custom-edit" data-index="${i}"><label>语言<select data-key="lang"><option value="ZH" ${x.lang === 'ZH' ? 'selected' : ''}>普通话</option><option value="JA" ${x.lang === 'JA' ? 'selected' : ''}>日文</option><option value="EN" ${x.lang === 'EN' ? 'selected' : ''}>英文</option></select></label><label>原来的话<input data-key="original" maxlength="100" value="${esc(x.original)}" placeholder="录音中原来怎么说"></label><label>改成<input data-key="replacement" maxlength="100" value="${esc(x.replacement)}" placeholder="想改成什么"></label><button class="ghost small" type="button" data-remove="1" aria-label="删除这项修改">✕</button></div>`).join('');
 $('addCustom').hidden = rows.length >= 5;
}
$('doorSide').onchange = () => { curRow().door = $('doorSide').value; invalidate(); persist() };
$('addCustom').onclick = () => { const p = profile(); (p.customEdits ||= []).push({lang: sel().ja ? 'JA' : 'ZH', original: '', replacement: ''}); renderCustomRows(); invalidate(); persist() };
$('customRows').oninput = e => { const row = e.target.closest('[data-index]'), key = e.target.dataset.key; if (!row || !key) return; profile().customEdits[+row.dataset.index][key] = e.target.value; invalidate(); persist() };
$('customRows').onclick = e => { if (!e.target.closest('[data-remove]')) return; const row = e.target.closest('[data-index]'); profile().customEdits.splice(+row.dataset.index, 1); renderCustomRows(); invalidate(); persist() };
const narrowLayout = matchMedia('(max-width: 720px)');
function sizeRoutePicker() { $('routePanel').open = !narrowLayout.matches }
sizeRoutePicker();
narrowLayout.addEventListener('change', sizeRoutePicker);
const cities = ['全部', '上海', '东京', '国铁'];
$('cityChips').innerHTML = cities.map(c => `<button class="chip" type="button" data-city="${c}">${c}</button>`).join('');
function renderRoutes() {
 $('activeRoute').textContent = routeTitle();
 for (const chip of $('cityChips').children) {
  const active = chip.dataset.city === S.city;
  chip.classList.toggle('on', active);
  chip.setAttribute('aria-pressed', active);
 }
 const q = $('routeSearch').value.trim().toLowerCase();
 const show = r => (S.city === '全部' || r.city === S.city) && (!q || (r.name + r.code + (r.sub || '') + r.kind + (r.city === '国铁' ? 'CR 中国铁路' : '')).toLowerCase().includes(q));
 const card = r => `<button class="route ${r.key === S.selected ? 'on' : ''}" aria-pressed="${r.key === S.selected}" data-key="${esc(r.key)}" style="--rc:${esc(r.color)}">
   <span class="code">${esc(r.code)}</span><span class="nm">${esc(r.name)}<span class="sub">${esc(r.sub || r.kind)}</span></span>
   <span class="tag ${r.preset ? 'mine' : 'real'}">${r.preset ? '我的' : projects.some(p => p.id === r.pid) ? '原声' : '显示模板'}</span></button>`;
 let html = '';
 const mine = S.presets.filter(p => baseRoute(p.base)).map(p => { const b = baseRoute(p.base); const pr = S.profiles[p.key] || {}; return {...b, key: p.key, preset: p, name: p.name, code: pr.code || b.code, color: pr.color || b.color, sub: '基于 ' + b.name} }).filter(show);
 if (mine.length) html += `<div class="route-group">我的线路</div>` + mine.map(r => {
  const audio = S.profiles[r.key]?.lastRecording;
  return `<div class="my-route">${card(r)}<div class="my-route-actions">
   <button class="route-action" data-action="listen" data-key="${esc(r.key)}">试听</button>
   <button class="route-action" data-action="upload" data-key="${esc(r.key)}" ${audio?.url ? '' : 'disabled'}>传到云盘</button>
   <a class="route-action" href="${esc(cloudUrl)}" target="_blank" rel="noopener">打开云盘</a>
   <button class="route-action" data-action="refresh" data-key="${esc(r.key)}">刷新</button>
  </div><div class="my-route-note">${audio?.url ? '上次生成：' + esc(audio.station || '报站') : '点试听生成报站'}</div></div>`;
 }).join('');
 for (const k of [...KINDS, '我的录音']) {
  const list = allRoutes().filter(r => r.kind === k && show(r)).map(r => { const pr = S.profiles[r.key] || {}, t = routeTitle(r); return {...r, name: t, sub: t !== r.name ? '用「' + r.name + '」的录音' : r.sub, code: pr.code || r.code, color: pr.color || r.color} });
  if (list.length) html += `<div class="route-group">${k}</div>` + list.map(card).join('');
 }
 $('routeList').innerHTML = html || '<p class="note">没有找到线路。</p>';
}
$('cityChips').onclick = e => {
 const city = e.target.dataset.city;
 if (!city || city === S.city) return;
 S.city = city; renderRoutes(); $('routeList').scrollTop = 0; persist();
};
$('routeSearch').oninput = () => { renderRoutes(); $('routeList').scrollTop = 0 };
$('routeList').onclick = async e => {
 const action = e.target.closest('[data-action]');
 if (action) {
  const key = action.dataset.key, preset = presetOf(key), recording = S.profiles[key]?.lastRecording;
  if (!preset) return;
  if (action.dataset.action === 'listen') {
   if (recording?.url) {
    try {
     const check = await fetch(recording.url, {method: 'HEAD'});
     if (check.status === 404) { delete S.profiles[key].lastRecording; persist(); choose(key); toast('录音已不存在，正在重新生成'); await generate(false) }
     else if (!check.ok) toast('读取录音失败，请检查模拟器');
     else play(recording.url, `${preset.name} · ${recording.station || '报站'}`);
    } catch (_) { toast('读取录音失败，请检查模拟器') }
   } else {
    choose(key);
    if (current?.markers?.length) await generate(false);
    else if (current) $('playOriginal').click();
    else toast('请先导入原声录音');
   }
  } else if (action.dataset.action === 'upload') {
   if (recording?.url) await uploadRecording(recording.url, `${preset.name} · ${recording.station || '报站'}`, action);
  } else if (action.dataset.action === 'refresh') {
   try {
    const [items, cloud] = await Promise.all([api('/api/recordings'), api('/api/cloud/status')]);
    if (recording?.url && !items.some(x => x.url === recording.url.split('?')[0])) toast('录音已不存在，请点试听重新生成');
    else if (!cloud.available) toast('云盘尚未连接，请打开 Google Drive 桌面版');
    else toast('已刷新，请在云盘查看同步状态');
   } catch (err) { toast(err.message || '刷新失败，请检查模拟器') }
  }
  return;
 }
 const route = e.target.closest('.route');
 if (!route) return;
 const key = route.dataset.key;
 choose(key);
 if (narrowLayout.matches) {
  $('routePanel').open = false;
  $('routePanel').querySelector('summary').focus({preventScroll: true});
 } else {
  $('routeList').querySelector('.route.on')?.focus({preventScroll: true});
 }
};

function routeTitle(r = sel()) {
 const line = (S.profiles[r.key]?.line || '').trim();
 return line && line !== r.line && !r.preset ? line : r.name;
}
function choose(key) {
 S.selected = key; stop();
 const r = sel(); current = projects.find(p => p.id === r.pid) || null;
 renderRoutes(); loadRoute(); persist();
}

/* =====================================================================
   报站面板
   ===================================================================== */
function loadRoute() {
 const r = sel(), p = profile();
 const japanese = r.city === '东京';
 $('stationBoard').setAttribute('aria-label', japanese ? '車内案内表示器' : '车内显示屏');
 $('lcdKanaBox').hidden = !japanese; $('lcdZhBox').hidden = !japanese; $('lcdEn').disabled = !r.en;
 lcdPhase = defaultPhase();
 $('readingsFold').hidden = !r.ja && !r.en && !has('number');
 clearPlaceResults();
 $('routeTitle').textContent = routeTitle(r);
 $('routeTag').textContent = r.preset ? '我的线路' : current ? '原声' : '显示模板'; $('routeTag').className = 'tag ' + (r.preset ? 'mine' : 'real');
 $('routeNote').textContent = (r.preset ? `基于「${baseRoute(r.preset.base)?.name || ''}」。改动会自动保存到这条线路。` : '') + (r.note || '');
 $('routeSource').hidden = !r.sourceUrl;
 if (r.sourceUrl) $('routeSource').href = r.sourceUrl;
 $('stationNameLabel').textContent = r.stationLabel || '下一站';
 $('jaLabel').hidden = !r.ja; $('jnLabel').hidden = !r.ja; $('enLabel').hidden = !r.en; $('numberLabel').hidden = !(r.ja || has('number') || r.numbered);
 $('next2Box').hidden = !has('next2'); $('transferBox').hidden = !(has('transfer') || r.numbered);
 $('terminalLabel').hidden = r.terminal === undefined && !has('terminal');
 $('lineNote').textContent = has('line') || has('terminal') ? '对应原声片段可替换。' : '线路名用于车厢屏。';
 $('lineName').value = p.line ?? r.line ?? ''; $('terminal').value = p.terminal ?? r.terminal ?? '';
 $('lineCode').value = p.code ?? r.code; $('lineColor').value = p.color ?? r.color; $('boardLineName').value = p.boardLine ?? '';
 $('direction').value = p.direction ?? r.direction ?? (r.terminal ? r.terminal + (r.city === '东京' ? '方面' : '方向') : '');
 $('next2Ja').value = ''; $('next2En').value = '';
 $('playOriginal').disabled = !current;
 $('sourceStatus').textContent = !current ? '这条线路没有本地录音，可在右侧导入原声。' : !current.markers?.length ? '可试听原声。完成站名识别后可在原声中替换。' : '';
 $('presetName').value = r.preset ? r.preset.name : ''; $('deletePreset').hidden = !r.preset; $('resetRoute').hidden = !!r.preset; $('importDelete').hidden = !r.imported;
 markSwatch(); $('extraFold').hidden = !(has('next2') || has('transfer') || r.numbered); fillTypes();
 renderStations(); showStation(); renderEditable(); invalidate(); refreshReadings();
}

function renderStations() {
 const p = profile(), r = sel();
 $('stationCount').textContent = `${p.stations.length} 站`;
 $('stationTable').tBodies[0].innerHTML = p.stations.map((s, i) => `<tr class="${i === p.idx ? 'on' : ''}" data-i="${i}"><td title="切换到这一站">${i + 1}</td>
  <td><input data-k="name" value="${esc(s.name)}" placeholder="站名"></td>
  <td class="c-jn"><input data-k="jname" value="${esc(s.jname)}" placeholder="${esc(fill(s).jname)}"></td>
  <td class="c-ja"><input data-k="ja" value="${esc(s.ja)}" placeholder="${esc(fill(s).ja)}"></td>
  <td class="c-en"><input data-k="en" value="${esc(s.en)}" placeholder="${esc(fill(s).en)}"></td>
  <td class="c-no"><input data-k="no" value="${esc(s.no)}" placeholder="—"></td>
  <td><button class="del" title="删除这一站">✕</button></td></tr>`).join('');
 document.querySelectorAll('.c-ja,.c-jn').forEach(e => e.hidden = !r.ja);
 document.querySelectorAll('.c-en').forEach(e => e.hidden = !r.en);
 document.querySelectorAll('.c-no').forEach(e => e.hidden = !(r.ja || has('number') || r.numbered));
 navButtons();
}
function updatePlaceholders() {
 const rows = $('stationTable').tBodies[0].rows;
 profile().stations.forEach((s, i) => { const f = fill(s), r = rows[i]; if (!r) return; r.querySelector('[data-k="jname"]').placeholder = f.jname; r.querySelector('[data-k="ja"]').placeholder = f.ja; r.querySelector('[data-k="en"]').placeholder = f.en });
}
function navButtons() {
 const p = profile(), total = p.stations.length;
 $('stationPosition').textContent = `${p.idx + 1} / ${total}`;
 $('previousStation').disabled = p.idx <= 0;
 $('nextStation').disabled = p.idx >= total - 1;
}
function selectRow(i) {
 const p = profile(); if (i === p.idx) return; p.idx = i; lcdPhase = defaultPhase();
 clearPlaceResults();
 document.querySelectorAll('#stationTable tr.on').forEach(x => x.classList.remove('on'));
 $('stationTable').tBodies[0].rows[i]?.classList.add('on'); navButtons(); showStation(); invalidate(); persist();
}
function clearTranslatedReadings(row, nextName) {
 const previous = row._placeTranslation;
 if (!previous || row.name === nextName) return false;
 let changed = false;
 for (const key of ['jname', 'ja', 'en']) {
  if (previous[key] && row[key] === previous[key]) { row[key] = ''; changed = true }
 }
 delete row._placeTranslation;
 return changed;
}
function updateRowReadings(i) {
 const tr = $('stationTable').tBodies[0].rows[i], row = profile().stations[i];
 if (!tr || !row) return;
 for (const key of ['jname', 'ja', 'en']) { const input = tr.querySelector(`[data-k="${key}"]`); if (input) input.value = row[key] || '' }
}
$('stationTable').addEventListener('input', e => {
 const tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k) return;
 const p = profile(), i = +tr.dataset.i, changed = k === 'name' && clearTranslatedReadings(p.stations[i], e.target.value); p.stations[i][k] = e.target.value;
 if (changed) updateRowReadings(i);
 if (i === p.idx) { if (k === 'name') clearPlaceResults(); showStation() } invalidate(); persist(); if (k === 'name') refreshReadings();
});
$('stationTable').addEventListener('focusin', e => { const tr = e.target.closest('tr[data-i]'); if (tr) selectRow(+tr.dataset.i) });
$('stationTable').addEventListener('click', e => {
 const tr = e.target.closest('tr[data-i]'); if (!tr) return; const p = profile(), i = +tr.dataset.i;
 if (e.target.closest('.del')) { clearPlaceResults(); if (p.stations.length === 1) { p.stations = [row('')] } else { p.stations.splice(i, 1); if (p.idx >= i && p.idx > 0) p.idx-- } renderStations(); showStation(); invalidate(); persist(); return }
 selectRow(i);
});
function showStation(preserveFocus = false) {
 const s = curRow(), f = fill(s), nx = profile().stations[profile().idx + 1];
 for (const [id, key] of [['stationName', 'name'], ['jpName', 'jname'], ['jaName', 'ja'], ['enName', 'en'],
   ['stationNo', 'no'], ['transferJa', 'tja'], ['transferEn', 'ten']]) {
  const input = $(id), value = s[key] ?? '';
  if (input.value !== value && (!preserveFocus || document.activeElement !== input)) input.value = value;
 }
 $('jpName').placeholder = f.jname; $('jaName').placeholder = f.ja; $('enName').placeholder = f.en;
 $('doorSide').value = s.door || 'original';
 $('next2Ja').placeholder = nx ? '自动：' + fill(nx).ja : '保留原声'; $('next2En').placeholder = nx ? '自动：' + fill(nx).en : '保留原声';
 draw();
}
function bindRow(id, key) {
 $(id).addEventListener('input', () => {
  const changed = key === 'name' && clearTranslatedReadings(curRow(), $(id).value);
  curRow()[key] = $(id).value;
  const inp = $('stationTable').tBodies[0].rows[profile().idx]?.querySelector(`[data-k="${key}"]`); if (inp) inp.value = $(id).value;
  if (changed) { updateRowReadings(profile().idx); showStation() }
  if (key === 'name') { clearPlaceResults(); const f = fill(curRow()); $('jpName').placeholder = f.jname; $('jaName').placeholder = f.ja; $('enName').placeholder = f.en; refreshReadings() }
  draw(); invalidate(); persist();
 });
}
bindRow('stationName', 'name'); bindRow('jpName', 'jname'); bindRow('jaName', 'ja'); bindRow('enName', 'en'); bindRow('stationNo', 'no'); bindRow('transferJa', 'tja'); bindRow('transferEn', 'ten');

/* 地名数据库：只在主动点击时联网，结果需要能够切换同名地点。 */
let placeLookup = null, placeToken = 0;
function clearPlaceResults() { placeToken++; placeLookup = null; $('translatePlace').disabled = false; $('placeResults').hidden = true; $('placeChoices').innerHTML = '' }
function placeStillCurrent(lookup) { return !!lookup && S.selected === lookup.route && curRow() === lookup.row && curRow().name === lookup.currentName }
function applyPlace(index, explicit = false) {
 const lookup = placeLookup, item = lookup?.items[index];
 if (!item || !placeStillCurrent(lookup)) { clearPlaceResults(); return }
 const s = lookup.row;
 const previous = s._placeTranslation || {};
 for (const key of ['jname', 'ja', 'en']) if (previous[key] && s[key] === previous[key]) s[key] = '';
 if (item.zh && (explicit || !/[\u3400-\u9fff]/.test(s.name))) s.name = item.zh;
 const assigned = {};
 if (item.ja) assigned.jname = s.jname = item.ja;
 if (item.ja_reading) assigned.ja = s.ja = item.ja_reading;
 if (item.en) assigned.en = s.en = item.en;
 s._placeTranslation = assigned;
 lookup.currentName = s.name;
 renderStations(); showStation(); invalidate(); persist();
 const missing = [!item.ja && '日文', !item.en && '英文'].filter(Boolean);
 const readingNote = item.reading_is_estimated ? ' 日文读音为自动推测，请核对。' : '';
 $('placeMessage').innerHTML = `<b>${esc(item.zh || item.name || lookup.query)}</b>：${esc(item.en || '英文未收录')} / ${esc(item.ja || '日文未收录')}<br><span class="note">${esc(item.context)}${missing.length ? '；' + esc(missing.join('、')) + '未收录，请检查现有输入。' : ''}${readingNote}</span>`;
 $('placeChoices').innerHTML = lookup.items.length > 1 ? `<details><summary>同名地点？选择其他结果</summary>${lookup.items.map((x, i) => `<button type="button" class="place-result" data-place="${i}">${esc(x.zh || x.name || '地点')} · ${esc(x.en || x.ja || '')}<small>${esc(x.context)}</small></button>`).join('')}</details>` : '';
 $('placeResults').hidden = false;
}
$('placeChoices').onclick = e => { const button = e.target.closest('[data-place]'); if (button) applyPlace(+button.dataset.place, true) };
$('translatePlace').onclick = async () => {
 const name = curRow()?.name?.trim(); if (!name) { toast('请先输入地名'); $('stationName').focus(); return }
 const token = ++placeToken, lookup = {route: S.selected, row: curRow(), currentName: curRow().name, query: name, items: []};
 placeLookup = lookup; $('translatePlace').disabled = true; $('placeResults').hidden = false;
 $('placeMessage').textContent = '正在查询地名……'; $('placeChoices').innerHTML = '';
 try {
  const data = await post('/api/place-names', {name});
  if (token !== placeToken || !placeStillCurrent(lookup)) return;
  lookup.items = data.results || [];
  if (!lookup.items.length) { $('placeMessage').textContent = '没有找到这个地名，请换一种写法或手动填写。'; return }
  applyPlace(0);
 } catch (err) { if (token === placeToken && placeStillCurrent(lookup)) $('placeMessage').textContent = err.message || '地名查询失败，请稍后再试。' }
 finally { if (token === placeToken) $('translatePlace').disabled = false }
};
function moveStation(d) { const p = profile(), n = p.idx + d; if (n < 0 || n >= p.stations.length) return; selectRow(n) }
$('previousStation').onclick = () => moveStation(-1); $('nextStation').onclick = () => moveStation(1);
$('addStation').onclick = () => { clearPlaceResults(); const p = profile(); p.stations.push(row('')); p.idx = p.stations.length - 1; renderStations(); showStation(); invalidate(); persist(); $('stationName').focus() };
$('reverseStations').onclick = () => { clearPlaceResults(); const p = profile(); p.stations.reverse(); p.idx = p.stations.length - 1 - p.idx; renderStations(); showStation(); invalidate(); persist() };
$('clearStations').onclick = () => { if (!confirm('清空站点表？')) return; clearPlaceResults(); const p = profile(); p.stations = [row('')]; p.idx = 0; renderStations(); showStation(); invalidate(); persist() };
$('pasteStations').onclick = () => { $('pasteBox').hidden = false; $('pasteText').value = profile().stations.map(s => [s.name, s.ja, s.en, s.no].join(',').replace(/,+$/, '')).join('\n'); $('pasteText').focus() };
$('pasteCancel').onclick = () => $('pasteBox').hidden = true;
$('pasteApply').onclick = () => {
 const rows = $('pasteText').value.split(/\r?\n/).map(l => l.split(/[,，\t]/).map(x => x.trim())).filter(c => c[0]).slice(0, 200).map(c => row(c[0], c[1] || '', c[2] || '', c[3] || ''));
 if (!rows.length) return toast('没有读到站名');
 clearPlaceResults(); const p = profile(); p.stations = rows; p.idx = 0; $('pasteBox').hidden = true; renderStations(); showStation(); invalidate(); persist(); refreshReadings(); toast(`已载入 ${rows.length} 个站`);
};

/* ---------- 线路名、终点、显示牌 ---------- */
function codeFromLine(line) {
 const m = line.trim().match(/^(.{1,4}?)(路|号线|線|线|ライン)$/);
 return m ? m[1] : line.trim().slice(0, 4);
}
for (const [id, key] of [['lineName', 'line'], ['terminal', 'terminal'], ['lineCode', 'code'], ['lineColor', 'color'], ['boardLineName', 'boardLine'], ['direction', 'direction']]) {
 $(id).addEventListener('input', () => {
  const p = profile(); p[key] = $(id).value;
  if (key === 'code') p.codeManual = !!$(id).value.trim();
  if (key === 'line' && !p.codeManual) { p.code = $(id).value.trim() && $(id).value.trim() !== sel().line ? codeFromLine($(id).value) : sel().code; $('lineCode').value = p.code; renderRoutes(); $('routeTitle').textContent = routeTitle() }
  if (key === 'terminal') refreshReadings();
  if (key === 'terminal') { const t = $(id).value.trim(); $('direction').value = t ? t + (sel().city === '东京' ? '方面' : '方向') : ''; profile().direction = $('direction').value }
  if (key === 'line' || key === 'terminal') invalidate();
  draw(); persist(); if (key === 'code' || key === 'color') renderRoutes();
 });
}
$('next2Ja').oninput = $('next2En').oninput = invalidate;
/* ---------- 车内动态显示屏 ---------- */
const lcdScreen = LCD.create($('lcdFrame'));
const lcdChannel = 'BroadcastChannel' in window ? new BroadcastChannel('station-sim-lcd') : null;
const LCD_DEFAULTS = {state: 'auto', speed: 3, stops: 6, size: 100, kana: true, en: true, zh: true};
let lcdPhase = 'next', lcdData = null;
const lcdOpt = () => ({...LCD_DEFAULTS, ...(S.lcd || {})});
/** 线路本身的录音是“即将到站”或“到站”广播时，默认显示对应状态 */
function defaultPhase() { return {'即将到站': 'soon', '到站': 'at'}[sel().stationLabel] || 'next' }
function setPhase(phase) { if (phase === lcdPhase) return; lcdPhase = phase; draw() }
function draw() {
 const r = sel(), p = profile(), s = curRow(), f = fill(s), japanese = r.city === '东京', o = lcdOpt();
 const type = $('type1').value;
 const nameOf = item => (japanese ? fill(item).jname || item.name : item.name).trim() || '—';
 const count = +o.stops, start = Math.max(0, Math.min(p.idx - 1, p.stations.length - count));
 const stops = p.stations.slice(start, start + count).map((item, i) => ({
  name: nameOf(item), no: (item.no || '').trim(), state: start + i < p.idx ? 'past' : start + i === p.idx ? 'current' : 'next'}));
 lcdData = {
  city: japanese ? 'ja' : 'zh',
  line: $('boardLineName').value.trim() || $('lineName').value.trim() || r.line || r.name,
  code: $('lineCode').value || r.code, color: p.color || r.color,
  type, mark: Object.hasOwn(serviceMarks, type) ? serviceMarks[type] : '',
  dest: $('direction').value.trim(),
  phase: o.state === 'auto' ? lcdPhase : o.state,
  station: {zh: s.name.trim(), jname: japanese ? f.jname : '', kana: japanese ? f.ja : '', en: r.en ? f.en : '', no: $('numberLabel').hidden ? '' : (s.no || '').trim()},
  stops,
  transfer: {main: (s.tzh || '').trim() || (japanese ? (s.tja || '').trim() : ''), en: (s.ten || '').trim()},
  door: s.sdoor || (s.door && s.door !== 'original' ? s.door : ''),
  speed: +o.speed, langs: {kana: o.kana, en: o.en && !!r.en, zh: o.zh},
 };
 lcdScreen.update(lcdData);
 lcdChannel?.postMessage(lcdData);
 try { localStorage.setItem('station-sim-lcd', JSON.stringify(lcdData)) } catch (e) {}
 for (const b of $('lcdStates').children) b.setAttribute('aria-pressed', b.dataset.s === o.state);
 if (document.activeElement !== $('lcdTransfer')) $('lcdTransfer').value = s.tzh || '';
 $('lcdDoor').value = s.sdoor || '';
}
if (lcdChannel) lcdChannel.onmessage = e => { if (e.data?.hello && lcdData) lcdChannel.postMessage(lcdData) };
function lcdSettings() {
 const o = lcdOpt();
 $('lcdSpeed').value = o.speed; $('lcdStops').value = o.stops; $('lcdSize').value = o.size;
 $('lcdKana').checked = o.kana; $('lcdEn').checked = o.en; $('lcdZh').checked = o.zh;
 $('lcdSizeText').textContent = o.size + '%';
 $('stationBoard').style.setProperty('--lcd-size', o.size + '%');
}
function setLcd(key, value) { S.lcd = {...lcdOpt(), [key]: value}; lcdSettings(); draw(); persist() }
$('lcdStates').onclick = e => { const b = e.target.closest('[data-s]'); if (b) setLcd('state', b.dataset.s) };
$('lcdSpeed').onchange = () => setLcd('speed', +$('lcdSpeed').value);
$('lcdStops').onchange = () => setLcd('stops', +$('lcdStops').value);
$('lcdSize').oninput = () => setLcd('size', +$('lcdSize').value);
for (const [id, key] of [['lcdKana', 'kana'], ['lcdEn', 'en'], ['lcdZh', 'zh']]) $(id).onchange = () => setLcd(key, $(id).checked);
$('lcdTransfer').oninput = () => { curRow().tzh = $('lcdTransfer').value; draw(); persist() };
$('lcdDoor').onchange = () => { curRow().sdoor = $('lcdDoor').value; draw(); persist() };
$('lcdFull').onclick = () => $('lcdFrame').requestFullscreen?.().catch(() => toast('浏览器不允许全屏'));
$('lcdFrame').ondblclick = () => document.fullscreenElement ? document.exitFullscreen() : $('lcdFrame').requestFullscreen?.().catch(() => {});
$('lcdWindow').onclick = () => { if (!window.open('/static/display.html', 'station-sim-lcd', 'width=1280,height=760')) toast('浏览器拦截了新窗口，请允许弹出窗口') };

/* =====================================================================
   生成
   ===================================================================== */
function setGenerating(busy) {
 $('generate').disabled = busy || !current?.markers?.length;
 $('generateLabel').textContent = busy ? '正在生成…' : '替换并播放';
}
function invalidate() {
 rev++; resultUrl = null; lastRequest = null;
 $('resultActions').hidden = true;
 $('progressBox').hidden = true;
 setGenerating(false);
}
function buildRequest() {
 const r = sel(), p = profile(), s = curRow(), f = fill(s), nx = p.stations[p.idx + 1];
 const line = $('lineName').value.trim(), term = $('terminal').value.trim(), tr = readingsOf(term);
 const fields = {station: {ZH: s.name.trim(), WU: s.name.trim(), JA: f.ja, EN: r.en ? f.en : s.name.trim()},
  number: {EN: (s.no || '').trim()}, transfer: {JA: (s.tja || '').trim(), EN: (s.ten || '').trim()},
  next2: {JA: $('next2Ja').value.trim() || (nx ? fill(nx).ja : ''), EN: $('next2En').value.trim() || (nx ? fill(nx).en : '')}};
 if (line && line !== r.line) fields.line = {ZH: line, JA: line, EN: line};
 if (term && term !== r.terminal) fields.terminal = {ZH: term, JA: tr?.ja || term, EN: tr?.en || term};
 if (has('door') && s.door && s.door !== 'original') {
  const left = s.door === 'left';
  fields.door = {ZH: left ? '开左边门' : '开右边门', JA: left ? 'お出口は左側です' : 'お出口は右側です', EN: r.pid === '7988eb745f523d4669eefe530cc3398d' ? `doors are open on the ${left ? 'left' : 'right'}` : `The doors on the ${left ? 'left' : 'right'} side will open`};
 }
 return {url: `/api/generate/${r.pid}`, body: {fields, custom: (p.customEdits || []).filter(x => x.original.trim() || x.replacement.trim())}};
}
async function generate(retake) {
 if ($('generate').disabled) return;
 if (!curRow()?.name?.trim()) { toast('请先输入站名'); $('stationName').focus(); return }
 const pr = profile(), my = ++rev, isCurrent = () => my === rev;
 stop();
 setGenerating(true);
 $('resultActions').hidden = true;
 $('progressBox').hidden = false;
 $('progressBar').parentElement.hidden = false;
 $('progress').textContent = '正在准备报站…';
 try {
  await ensureReadings([curRow().name, pr.stations[pr.idx + 1]?.name, $('terminal').value]);
  if (!isCurrent()) return;
  const req = retake && lastRequest ? lastRequest : buildRequest();
  const j = await post(req.url, {...req.body, retake: !!retake, display_name: `${sel().name} · ${curRow().name}`});
  const s = await waitJob(j.id, message => { $('progress').textContent = message }, isCurrent);
  if (!s || !isCurrent()) return;
  resultUrl = s.url; lastRequest = req;
  $('resultActions').hidden = false;
  $('download').href = s.url; $('download').hidden = false; $('playResult').disabled = false; $('retake').hidden = false;
  if (sel().preset) { profile().lastRecording = {url: s.url.split('?')[0], station: curRow().name}; persist(); renderRoutes() }
  $('progressBar').parentElement.hidden = true;
  $('progressBox').hidden = !s.warn;
  $('progress').textContent = s.warn ? s.message : '';
  play(s.url, `${sel().name} · ${curRow().name}`);
 } catch (e) { if (isCurrent()) { $('progressBar').parentElement.hidden = true; $('progress').textContent = e.message } }
 finally { if (isCurrent()) setGenerating(false) }
}
$('generate').onclick = () => generate(false);
$('retake').onclick = () => generate(true);
$('playResult').onclick = () => resultUrl && play(resultUrl, `${sel().name} · ${curRow().name}`);
$('playOriginal').onclick = () => current && play(`/data/${current.id}/original.wav`, '原声 · ' + current.name);
document.addEventListener('keydown', e => {
 if (e.isComposing || e.repeat) return;
 if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); generate(false) }
 if (e.altKey && e.key === 'ArrowRight' && !$('nextStation').disabled) { e.preventDefault(); moveStation(1) }
 if (e.altKey && e.key === 'ArrowLeft' && !$('previousStation').disabled) { e.preventDefault(); moveStation(-1) }
});

/* ---------- 播放器 ---------- */
let playbackRevision = 0;
function setPlayer(state, title) {
 if (title !== undefined) $('nowPlaying').textContent = title;
 $('player').dataset.state = state;
 $('pausePlay').hidden = state !== 'playing';
 $('resumePlay').hidden = state !== 'paused';
 $('stopPlay').hidden = state === 'idle';
 if (state === 'idle') $('nowPlaying').textContent = '未在播放';
}
async function startPlayback(title, focusControl = false) {
 const revision = ++playbackRevision;
 setPlayer('playing', title);
 if (focusControl) $('pausePlay').focus({preventScroll: true});
 try { await audio.play() }
 catch (e) {
  if (revision !== playbackRevision) return;
  setPlayer('idle'); toast('音频播放失败，请点试听重试');
 }
}
// 播放报站录音时，显示屏（自动模式）切到「即将到站」，播完切到「到站」；发车音乐等其他声音不影响
let playingReport = false;
function play(url, title) { audio.src = url; playingReport = !url.startsWith('/static/sounds/'); if (playingReport) setPhase('soon'); startPlayback(title) }
function stop() { playbackRevision++; audio.pause(); audio.currentTime = 0; setPlayer('idle'); if (playingReport) { playingReport = false; setPhase(defaultPhase()) } }
$('pausePlay').onclick = () => {
 const hadFocus = document.activeElement === $('pausePlay');
 playbackRevision++; audio.pause(); setPlayer('paused');
 if (hadFocus) $('resumePlay').focus({preventScroll: true});
};
$('resumePlay').onclick = () => startPlayback(undefined, document.activeElement === $('resumePlay'));
$('stopPlay').onclick = stop;
audio.addEventListener('ended', () => { setPlayer('idle'); if (playingReport) { playingReport = false; setPhase('at') } });

/* ---------- 其他广播 ---------- */
function mountSounds(group, selectId, buttonId) {
 const select = $(selectId);
 for (const option of [...select.options]) {
  if (!group.includes(option.value)) option.remove();
 }
 select.closest('.sound').hidden = !select.options.length;
 $(buttonId).onclick = () => play('/static/sounds/' + select.value, select.selectedOptions[0].text);
}

/* ---------- 标准色 ---------- */
const SWATCHES = [['#e60012', '红'], ['#f15a22', '橙'], ['#f39800', '橘黄'], ['#ffd400', '黄'], ['#9acd32', '黄绿'], ['#009944', '绿'],
 ['#00ac9a', '青绿'], ['#00b2e5', '天蓝'], ['#0067c0', '蓝'], ['#1d2088', '深蓝'], ['#7f3f98', '紫'], ['#e4007f', '粉红'],
 ['#8b5a2b', '棕'], ['#999999', '灰'], ['#222222', '黑']];
$('swatches').innerHTML = SWATCHES.map(([c, n]) => `<button class="swatch" data-c="${c}" title="${n} ${c}" style="background:${c}"></button>`).join('');
$('swatches').onclick = e => { const c = e.target.dataset.c; if (!c) return; $('lineColor').value = c; $('lineColor').dispatchEvent(new Event('input')); $('colorPop').hidden = true };
function markSwatch() {
 const v = $('lineColor').value.toLowerCase(), hit = SWATCHES.find(([c]) => c === v);
 document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.c === v));
 $('colorChip').style.background = v; $('colorName').textContent = hit ? hit[1] : v;
}
$('lineColor').addEventListener('input', markSwatch);
$('colorBtn').onclick = e => { e.stopPropagation(); $('colorPop').hidden = !$('colorPop').hidden };
$('colorPop').onclick = e => e.stopPropagation();
document.addEventListener('click', () => { $('colorPop').hidden = true });

/* ---------- 还原 ---------- */
$('resetRoute').onclick = () => {
 const r = sel();
 const msg = r.preset ? `把「${r.name}」还原成保存时的样子？` : `把「${r.name}」还原成默认设置？
站点表、线路名、终点站、颜色等改动会清除；你保存的「我的线路」不受影响。`;
 if (!confirm(msg)) return;
 if (r.preset && r.preset.snapshot) S.profiles[r.key] = structuredClone(r.preset.snapshot); else delete S.profiles[r.key];
 if (!r.preset) $('routeSearch').value = '';
 stop(); renderRoutes(); loadRoute(); persist(); toast('已还原');
};

/* ---------- 我的线路 ---------- */
$('savePreset').onclick = () => {
 const name = $('presetName').value.trim(); if (!name) { toast('请先给线路起个名字'); $('presetName').focus(); return }
 const r = sel();
 if (r.preset && r.preset.name === name) { toast('已保存'); return }  // 我的线路里的改动本来就会自动保存
 const key = 'u_' + Date.now().toString(36);
 const saved = structuredClone(profile()); delete saved.lastRecording;
 if (resultUrl) saved.lastRecording = {url: resultUrl.split('?')[0], station: curRow().name};
 S.presets.push({key, name, base: r.preset ? r.preset.base : r.key, snapshot: structuredClone(saved)}); S.profiles[key] = saved;
 choose(key); toast(`已保存为「${name}」`);
};
$('deletePreset').onclick = () => {
 const r = sel(); if (!r.preset || !confirm(`删除「${r.preset.name}」？`)) return;
 S.presets = S.presets.filter(p => p.key !== r.preset.key); delete S.profiles[r.preset.key]; choose(r.preset.base);
};

/* ---------- 导入录音 ---------- */
$('importGo').onclick = async () => {
 const file = $('importFile').files[0], st = $('importStatus'), locale = $('importLocale').value;
 if (!file) { st.textContent = '请先选择录音文件。'; return }
 const names = {station: $('importStation').value.trim(), line: $('importLine').value.trim(), terminal: $('importTerminal').value.trim()};
 const name = $('importName').value.trim() || file.name.replace(/\.[^.]+$/, '');
 const details = {name, station: {}, line: {}, terminal: {}};
 for (const [field, text] of Object.entries(names)) details[field][locale] = text;
 const english = $('importStationEn').value.trim();
 if (english) details.station.EN = english;
 $('importGo').disabled = true; st.textContent = '正在导入……';
 try {
  const query = new URLSearchParams({...names, name, locale});
  const p = await api('/api/upload?' + query, {method: 'POST', body: file});
  projects.unshift(p); choose('p_' + p.id);
  st.textContent = '已导入，可试听原声。';
  if (!Object.values(names).some(Boolean) && !english) return;
  st.textContent = '已导入，正在识别可替换位置……';
  try {
   const res = await post(`/api/projects/${p.id}/auto`, details);
   projects = projects.map(project => project.id === p.id ? res.project : project);
   if (S.selected === 'p_' + p.id) choose(S.selected);
   st.textContent = res.project.markers.length ? `找到 ${res.project.markers.length} 处可替换内容。` : '未识别出可替换的名称。可继续试听原声。';
   if (res.missing.length) st.textContent += ' 未找到：' + res.missing.join('、');
  } catch (e) { st.textContent = '可试听原声。' + e.message }
 } catch (e) { st.textContent = e.message } finally { $('importGo').disabled = false }
};
$('importDelete').onclick = async () => {
 const r = sel(); if (!r.imported || !confirm(`删除「${r.name}」？此操作不能撤销。`)) return;
 try { await api(`/api/projects/${r.pid}`, {method: 'DELETE'}); projects = projects.filter(p => p.id !== r.pid); choose('bus510') } catch (e) { $('importStatus').textContent = e.message }
};

/* ---------- 启动 ---------- */
(async () => {
 try { projects = await api('/api/projects') } catch (e) { $('sourceStatus').textContent = '无法连接本机服务，请重新启动模拟器。'; return }
 const options = await api('/api/options').catch(() => ({}));
 if (options.cloud_url) cloudUrl = options.cloud_url;
 mountSounds(options.melodies || [], 'melody', 'playMelody');
 mountSounds(options.notices || [], 'busNotice', 'playNotice');
 const hasSounds = $('melody').options.length || $('busNotice').options.length;
 $('otherBroadcasts').hidden = !hasSounds;
 $('otherLink').hidden = !hasSounds;
 let saved = await api('/api/state').catch(() => null);
 if (!saved || !Object.keys(saved).length) { try { saved = JSON.parse(localStorage.getItem('station-sim-state') || 'null') } catch (e) {} }
 if (saved) S = {...S, ...saved, services: {...S.services, ...(saved.services || {})}};
 if (!presetOf(S.selected) && !baseRoute(S.selected)) S.selected = 'bus510';
 lcdSettings();
 choose(S.selected);
})();
