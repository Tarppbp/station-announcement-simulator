'use strict';
const $ = id => document.getElementById(id);
// row、JR、CR、routes 定义在 routes.js
const KINDS = ['JR 全线原声', '公交', '地铁', '铁路', '高铁', '巴士'];
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
let projects = [], jreRuns = [], current = null, rev = 0, resultUrl = null, lastRequest = null, saveTimer = null;
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
/** 本机 pids-jre-simulator 的全线运行图（只放原声，不做替换） */
function jreRoutes() {
 return jreRuns.map(run => ({
  key: 'jre:' + run.id, city: '东京', kind: 'JR 全线原声', jre: run, ja: true, en: true, numbered: true,
  name: `${run.line} ${run.direction}`, code: run.code, color: run.color, line: run.line,
  sub: `${run.type} · ${run.from}→${run.to} · ${run.stops.length} 站`,
  direction: run.loop ? run.dest + '方面' : run.dest + '行',
  stations: run.stops.map(x => ({...row(x.name, x.kana, x.en, x.code), jname: x.name, pass: x.pass})),
  note: `JR 东日本 ${run.line}（${run.remarks || run.direction}，车次 ${run.id.split('/').pop()}）全线原声。录音由铁道爱好者录制，版权归 JR 东日本，仅供个人使用；数据来自 pids-jre-simulator（MIT 授权）。`,
 }));
}
// 改编页只列能替换的单段原声；JR 全线原声在原声页播放（jreRoutes 保留，以后标好替换位置再接入）
const EDIT_JRE = false;
function allRoutes() { return routes.concat(EDIT_JRE ? jreRoutes() : [], importedRoutes()) }
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
 const p = S.profiles[r.key];
 if (r.jre) p.stations = r.stations;  // 站点和录音一一对应，始终用运行图里的站点
 if (!p.stations.length) p.stations.push(row('')); p.idx = Math.min(Math.max(0, p.idx || 0), p.stations.length - 1);
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
function renderRoutes() { if (!cities.includes(S.city)) S.city = '全部';
 $('activeRoute').textContent = routeTitle();
 for (const chip of $('cityChips').children) {
  const active = chip.dataset.city === S.city;
  chip.classList.toggle('on', active);
  chip.setAttribute('aria-pressed', active);
 }
 const q = $('routeSearch').value.trim().toLowerCase();
 const show = r => (S.city === '全部' || r.city === S.city || (S.city === 'JR' && r.jre)) && (!q || (r.name + r.code + (r.sub || '') + r.kind + (r.city === '国铁' ? 'CR 中国铁路' : '')).toLowerCase().includes(q));
 const card = r => `<button class="route ${r.key === S.selected ? 'on' : ''}" aria-pressed="${r.key === S.selected}" data-key="${esc(r.key)}" style="--rc:${esc(r.color)}">
   <span class="code">${esc(r.code)}</span><span class="nm">${esc(r.name)}<span class="sub">${esc(r.sub || r.kind)}</span></span>
   <span class="tag ${r.preset ? 'mine' : 'real'}">${r.preset ? '我的' : r.jre || projects.some(p => p.id === r.pid) ? '原声' : '显示模板'}</span></button>`;
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
 $('routeTag').textContent = r.preset ? '我的线路' : current || r.jre ? '原声' : '显示模板'; $('routeTag').className = 'tag ' + (r.preset ? 'mine' : 'real');
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
 const jre = !!r.jre;
 $('jrePanel').hidden = !jre; $('mainActions').hidden = jre; $('translatePlace').hidden = jre;
 if (jre) for (const id of ['readingsFold', 'editFold']) $(id).hidden = true;
 else $('editFold').hidden = false;
 $('stationActions').hidden = jre; $('stationName').readOnly = jre;
 $('stationsNote').textContent = jre ? '点一行切换到该站。灰色的是快速、特快不停的通过站。站点和原声一一对应，不能修改。' : '点一行切换到该站。只填中文站名就行：日文写法（汉字或片假名）、读音、英文会自动生成（灰色字），填了就用你填的。“再下一站”自动取下一行。';
 if (jre) { J.state = 'at'; J.step = 0; jreUI() }
 $('playOriginal').disabled = !current;
 $('sourceStatus').textContent = jre ? '' : !current ? '这条线路没有本地录音，可在右侧导入原声。' : !current.markers?.length ? '可试听原声。完成站名识别后可在原声中替换。' : '';
 $('presetName').value = r.preset ? r.preset.name : ''; $('deletePreset').hidden = !r.preset; $('resetRoute').hidden = !!r.preset; $('importDelete').hidden = !r.imported;
 markSwatch(); $('extraFold').hidden = !!r.jre || !(has('next2') || has('transfer') || r.numbered); fillTypes();
 renderStations(); showStation(); renderEditable(); invalidate(); refreshReadings();
}

function renderStations() {
 const p = profile(), r = sel();
 $('stationCount').textContent = `${p.stations.length} 站`;
 const ro = r.jre ? ' readonly' : '';
 $('stationTable').tBodies[0].innerHTML = p.stations.map((s, i) => `<tr class="${i === p.idx ? 'on' : ''}${s.pass ? ' pass' : ''}" data-i="${i}"><td title="切换到这一站">${i + 1}</td>
  <td><input data-k="name" value="${esc(s.name)}" placeholder="站名"${ro}>${s.pass ? '<small>通过</small>' : ''}</td>
  <td class="c-jn"><input data-k="jname" value="${esc(s.jname)}" placeholder="${esc(fill(s).jname)}"${ro}></td>
  <td class="c-ja"><input data-k="ja" value="${esc(s.ja)}" placeholder="${esc(fill(s).ja)}"${ro}></td>
  <td class="c-en"><input data-k="en" value="${esc(s.en)}" placeholder="${esc(fill(s).en)}"${ro}></td>
  <td class="c-no"><input data-k="no" value="${esc(s.no)}" placeholder="—"${ro}></td>
  <td>${r.jre ? '' : '<button class="del" title="删除这一站">✕</button>'}</td></tr>`).join('');
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
 if (sel().jre) { J.state = 'at'; J.step = 0; jreUI() }
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
function defaultPhase() { return sel().jre ? 'at' : {'即将到站': 'soon', '到站': 'at'}[sel().stationLabel] || 'next' }
function setPhase(phase) { if (phase === lcdPhase) return; lcdPhase = phase; draw() }
function draw() {
 const r = sel(), p = profile(), s = curRow(), f = fill(s), japanese = r.city === '东京', o = lcdOpt();
 const run = r.jre, stop = run?.stops[p.idx];
 const type = run ? run.type : $('type1').value;
 const nameOf = item => (japanese ? fill(item).jname || item.name : item.name).trim() || '—';
 const count = +o.stops, start = Math.max(0, Math.min(p.idx - 1, p.stations.length - count));
 const stops = p.stations.slice(start, start + count).map((item, i) => ({
  name: nameOf(item), no: (item.no || '').trim(), pass: !!item.pass, state: start + i < p.idx ? 'past' : start + i === p.idx ? 'current' : 'next'}));
 lcdData = {
  city: japanese ? 'ja' : 'zh',
  line: $('boardLineName').value.trim() || $('lineName').value.trim() || r.line || r.name,
  code: $('lineCode').value || r.code, color: p.color || r.color,
  type, mark: Object.hasOwn(serviceMarks, type) ? serviceMarks[type] : '', typeColor: run?.type_color || '',
  dest: stop ? (run.loop ? stop.dest + '方面' : stop.dest + '行') : $('direction').value.trim(),
  phase: o.state === 'auto' ? lcdPhase : o.state,
  station: {zh: s.name.trim(), jname: japanese ? f.jname : '', kana: japanese ? f.ja : '', en: r.en ? f.en : '', no: $('numberLabel').hidden ? '' : (s.no || '').trim(), code3: stop?.code3 || ''},
  stops,
  transfer: {main: (s.tzh || '').trim() || (japanese ? (s.tja || '').trim() : ''), en: (s.ten || '').trim(), list: stop?.transfers || []},
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
function play(url, title, report = !url.startsWith('/static/sounds/')) { jreAfter = null; audio.src = url; playingReport = report; if (playingReport) setPhase('soon'); startPlayback(title) }
function stop() { playbackRevision++; audio.pause(); audio.currentTime = 0; setPlayer('idle'); jreAfter = null; if (J.auto) { J.auto = false; jreUI() } if (playingReport) { playingReport = false; setPhase(defaultPhase()) } }
$('pausePlay').onclick = () => {
 const hadFocus = document.activeElement === $('pausePlay');
 playbackRevision++; audio.pause(); setPlayer('paused');
 if (hadFocus) $('resumePlay').focus({preventScroll: true});
};
$('resumePlay').onclick = () => startPlayback(undefined, document.activeElement === $('resumePlay'));
$('stopPlay').onclick = stop;
audio.addEventListener('ended', () => { setPlayer('idle'); if (playingReport) { playingReport = false; setPhase('at') } const after = jreAfter; jreAfter = null; after?.() });

/* ---------- JR 全线原声：按真实顺序播放 ----------
   运行图每站的 pa 是列车驶向这一站途中的广播（「次は」「まもなく」），sta 是这一站站台上的发车音乐。
   J.state：at = 停在 profile().idx 这一站；run = 正驶向这一站，J.step 是下一段要播的广播。 */
const J = {state: 'at', step: 0, auto: false};
let jreAfter = null;
const jreStop = () => sel().jre?.stops[profile().idx];
function jreNextIndex() { const stops = sel().jre.stops; for (let i = profile().idx + 1; i < stops.length; i++) if (!stops[i].pass) return i; return -1 }
function jrePlay(url, title, phase, after) { play(url, title, false); jreAfter = after; if (phase) setPhase(phase) }
function jreUI() {
 const run = sel().jre; if (!run) return;
 const s = jreStop(), n = jreNextIndex(), next = n >= 0 ? run.stops[n].name : '';
 $('jreStatus').textContent = J.state === 'at'
  ? `停在「${s.name}」。` + (n >= 0 ? `下一站：${next}。按「发车」开始下一段。` : '这是终点站。')
  : `正开往「${s.name}」：车内广播 ${Math.min(J.step, s.pa.length)} / ${s.pa.length}。`;
 $('jreNextLabel').textContent = J.state === 'at' ? (n >= 0 ? `发车，开往${next}` : '已到终点') : J.step < s.pa.length ? '下一段广播' : '到站';
 $('jreNext').disabled = J.state === 'at' && n < 0;
 $('jreMelody').disabled = J.state !== 'at' || !s.sta.length;
 $('jreAuto').textContent = J.auto ? '停止连续运行' : '连续运行'; $('jreAuto').setAttribute('aria-pressed', J.auto);
}
function jreDepart() {
 const n = jreNextIndex();
 if (n < 0) { J.auto = false; jreUI(); toast('已到终点站'); return }
 selectRow(n); J.state = 'run'; J.step = 0; jreTrack();
}
function jreTrack() {
 const s = jreStop(), url = s.pa[J.step];
 if (!url) { jreArrive(); return }
 J.step++; jreUI();
 jrePlay(url, `${sel().jre.line} · ${s.name} · 车内广播 ${J.step}/${s.pa.length}`, /-arr/.test(url) ? 'soon' : 'next',
  () => J.step >= s.pa.length ? jreArrive() : J.auto ? jreTrack() : jreUI());
}
function jreArrive() {
 J.state = 'at'; setPhase('at'); jreUI();
 if (J.auto) setTimeout(() => { if (J.auto && J.state === 'at') jreMelody() }, 1500);
}
function jreMelody(i = 0) {
 const s = jreStop(), url = s?.sta[i];
 if (!url) { if (J.auto) jreDepart(); else jreUI(); return }
 jrePlay(url, `${sel().jre.line} · ${s.name} · 发车音乐`, null, () => jreMelody(i + 1));
}
function jreNext() { if (!sel().jre) return; if (J.state === 'at') jreDepart(); else if (J.step < jreStop().pa.length) jreTrack(); else jreArrive() }
$('jreNext').onclick = jreNext;
$('jreMelody').onclick = () => { if (J.state === 'at') jreMelody() };
$('jreAuto').onclick = () => {
 if (J.auto) { stop(); return }
 J.auto = true; jreUI();
 if ($('player').dataset.state === 'playing') return;  // 正在播放的这段结束后自动接下去
 if (J.state === 'at') jreMelody(); else jreTrack();
};
$('jreRestart').onclick = () => { stop(); const p = profile(); p.idx = 0; J.state = 'at'; J.step = 0; lcdPhase = 'at'; renderStations(); showStation(); persist(); jreUI() };
document.addEventListener('keydown', e => {
 if (!sel().jre || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
 if (e.target.closest?.('input:not([readonly]), textarea, select')) return;
 if (e.key === 'PageDown') { e.preventDefault(); if (!$('jreNext').disabled) jreNext() }
 else if (e.key === 'PageUp') { e.preventDefault(); if (!$('jreMelody').disabled) jreMelody() }
 else if (e.key === 'End') { e.preventDefault(); const st = $('player').dataset.state; if (st === 'playing') $('pausePlay').click(); else if (st === 'paused') $('resumePlay').click() }
});

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

/* ---------- 选择改编的基础 ---------- */
function replaceable(r) {
 const p = projects.find(x => x.id === r.pid);
 const fields = [...new Set((p?.markers || []).map(m => m.field || 'station'))];
 return fields.map(f => FIELD_NAMES[f] || f).join('、');
}
function baseCard(r, extra = '') {
 const what = replaceable(r);
 return `<button type="button" class="base-card" data-key="${esc(r.key)}" style="--rc:${esc(r.color)}">
  <span class="code">${esc(r.code)}</span><span class="base-name">${esc(r.name)}<small>${esc(extra || r.sub || r.kind || '')}</small>
  <small class="base-fields">${what ? '可改：' + esc(what) : '只能试听，还没有可替换的位置'}</small></span></button>`;
}
function showPicker(on) {
 $('basePicker').hidden = !on; $('editorLayout').hidden = on;
 if (!on) return;
 stop();
 const mine = S.presets.filter(p => baseRoute(p.base));
 $('myBaseTitle').hidden = $('myBaseGrid').hidden = !mine.length;
 $('myBaseGrid').innerHTML = mine.map(p => { const b = baseRoute(p.base), pr = S.profiles[p.key] || {}; return baseCard({...b, key: p.key, name: p.name, code: pr.code || b.code, color: pr.color || b.color}, '基于 ' + b.name) }).join('');
 $('baseGrid').innerHTML = allRoutes().filter(r => projects.some(p => p.id === r.pid)).map(r => baseCard(r)).join('');
 scrollTo(0, 0);
}
$('basePicker').onclick = e => { const b = e.target.closest('[data-key]'); if (!b) return; showPicker(false); choose(b.dataset.key); $('routeTitle').focus({preventScroll: true}) };
$('changeBase').onclick = () => showPicker(true);

/* ---------- 启动 ---------- */
(async () => {
 jreRuns = await api('/api/jre/routes').catch(() => []);
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
 showPicker(true);  // 改编页一打开先选基础
})();
