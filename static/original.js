'use strict';
/* 报站模拟器 · 原声页
   只播放原声，不做替换，不用 AI。左边两个文件夹：
   - 全线原声：JR 全线运行图（/api/jre/routes，本机 pids-jre-simulator），选种别，按真实顺序播放，可切换上一站、下一站；
   - 单段原声：data/<pid>/original.wav 的一段样本（上海公交 510 路、国铁、JR 单站样例、自己导入的录音），只有一站。
   改编页（自定义、AI 生成替换）在 /edit，代码在 app.js。

   每个运行图的一站：pa = 驶向这一站途中的车内广播（「次は」「まもなく」），sta = 这一站站台上的发车音乐。
   state：at = 停在 pos 这一站；run = 正驶向 pos 这一站，step 是下一段要播的广播。 */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const audio = $('audio');
const lcd = LCD.create($('lcdFrame'));
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('station-sim-lcd') : null;
const MARKS = {中央特快: 'chuo', 青梅特快: 'ome', 特別快速: 'chuo', 快速: 'rapid', 通勤快速: 'rapid', 快速アクティー: 'rapid', 快速アーバン: 'rapid', 快速ラビット: 'rapid', 特急: 'express', 通勤特快: 'express'};
const LINE_ORDER = ['山手線', '中央線快速', '京浜東北線', '総武快速線', '京葉線', '埼京線', '南武線', '東海道線', '高崎線', '宇都宮線'];

let runs = [], lines = [], singles = [];
const S = {line: '', run: '', single: '', pos: 0, state: 'at', step: 0, phase: 'at', auto: false};
let after = null, data = null;

function save() { try { localStorage.setItem('station-sim-original', JSON.stringify({line: S.line, run: S.run, pos: S.pos, single: S.single})) } catch (e) {} }
function restore() { try { return JSON.parse(localStorage.getItem('station-sim-original') || 'null') || {} } catch (e) { return {} } }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600) }

const run = () => S.single ? null : runs.find(r => r.id === S.run);
const single = () => singles.find(r => r.key === S.single);
const stop = () => run()?.stops[S.pos];
const lineRuns = name => runs.filter(r => r.line === name);
function nextIndex(from = S.pos, dir = 1) {
 const stops = run().stops;
 for (let i = from + dir; i >= 0 && i < stops.length; i += dir) if (!stops[i].pass) return i;
 return -1;
}

/* ---------- 线路和种别 ---------- */
function renderLines() {
 const open = {...(renderLines.open || {full: true, single: true})};
 for (const d of $('lineList').querySelectorAll('details[data-folder]')) open[d.dataset.folder] = d.open;
 renderLines.open = open;
 const card = (attr, on, color, code, name, sub) => `<button type="button" class="o-line ${on ? 'on' : ''}" aria-pressed="${on}" ${attr} style="--c:${esc(color)}">
   <span class="o-badge">${esc(code)}</span><span class="o-line-name">${esc(name)}<small>${esc(sub)}</small></span></button>`;
 const full = lines.map(name => {
  const rs = lineRuns(name), r = rs[0];
  const sub = [...new Set(rs.map(x => x.direction))].join('・') + ' · ' + rs.map(x => x.type).join('／');
  return card(`data-line="${esc(name)}"`, !S.single && name === S.line, r.color, r.code, name, sub);
 }).join('');
 const one = singles.map(r => card(`data-single="${esc(r.key)}"`, r.key === S.single, r.color, r.code, r.name, r.sub || r.kind || '')).join('');
 const folder = (key, title, hint, body) => `<details class="o-folder" data-folder="${key}" ${open[key] ? 'open' : ''}><summary><span>${title}</span><small>${hint}</small></summary><div class="o-line-list">${body || '<p class="o-note">暂无</p>'}</div></details>`;
 $('lineList').innerHTML = folder('full', '全线原声', `${lines.length} 条线，可逐站切换`, full) + folder('single', '单段原声', `${singles.length} 段，每段一站`, one);
}
function renderServices() {
 const rs = lineRuns(S.line);
 $('serviceTabs').innerHTML = rs.map(r => `<button type="button" class="o-service-btn ${r.id === S.run ? 'on' : ''}" aria-pressed="${r.id === S.run}" data-run="${esc(r.id)}" style="--c:${esc(r.type_color || r.color)}">
  <b>${esc(r.type)}</b><small>${esc(r.direction)} · ${esc(r.from)}→${esc(r.to)} · ${esc(r.id.split('/').pop())}</small></button>`).join('');
}
function chooseLine(name) {
 const rs = lineRuns(name); if (!rs.length) return;
 S.line = name; chooseRun(rs[0].id);
}
function chooseRun(id) {
 halt();
 S.single = ''; document.body.dataset.mode = 'jre';
 S.run = id; S.line = run().line; S.pos = 0; S.state = 'at'; S.step = 0; S.phase = 'at';
 renderLines(); renderServices(); renderStops(); draw(); save();
}
$('lineList').onclick = e => {
 const b = e.target.closest('[data-line]'); if (b && (S.single || b.dataset.line !== S.line)) { chooseLine(b.dataset.line); return }
 const o = e.target.closest('[data-single]'); if (o && o.dataset.single !== S.single) chooseSingle(o.dataset.single);
};

/* ---------- 单段原声 ---------- */
function chooseSingle(key) {
 halt();
 const r = singles.find(x => x.key === key); if (!r) return;
 S.single = key; S.run = ''; S.line = '';
 S.phase = {'即将到站': 'soon', '到站': 'at'}[r.stationLabel] || 'next';
 document.body.dataset.mode = 'single';
 $('status').textContent = '';
 $('singleTitle').textContent = r.name;
 $('singleNote').textContent = (r.sub ? r.sub + '。' : '') + '这段录音只有一站，按「播放原声」播放。';
 renderLines(); draw(); save();
}
function drawSingle() {
 const r = single(); if (!r) return;
 const s = r.stations[0] || row(''), ja = r.city === '东京';
 const en = s.en || r.stationEnglish?.[s.name] || '';
 data = {
  city: ja ? 'ja' : 'zh', line: r.line || r.name, code: r.code, color: r.color, type: '', mark: '', typeColor: '',
  dest: r.direction || (r.terminal ? r.terminal + (ja ? '方面' : '方向') : ''), phase: S.phase,
  station: {zh: s.name, jname: ja ? s.name : '', kana: ja ? s.ja : '', en: r.en ? en : '', no: s.no || '', code3: ''},
  stops: r.stations.map((x, i) => ({name: x.name, no: x.no || '', pass: false, state: i === 0 ? 'current' : 'next'})),
  transfer: {main: ja ? (s.tja || '') : '', en: s.ten || '', list: []}, door: '', speed: 3, langs: {kana: true, en: true, zh: false},
 };
 lcd.update(data); channel?.postMessage(data);
 try { localStorage.setItem('station-sim-lcd', JSON.stringify(data)) } catch (e) {}
}
$('playOriginal').onclick = () => { const r = single(); if (r) play(`/data/${r.pid}/original.wav`, '原声 · ' + r.name, null, null) };
$('serviceTabs').onclick = e => { const b = e.target.closest('[data-run]'); if (b && b.dataset.run !== S.run) chooseRun(b.dataset.run) };

/* ---------- 停靠站列表 ---------- */
function renderStops() {
 const r = run();
 $('stopCount').textContent = `${r.stops.filter(s => !s.pass).length} 站停车 / 共 ${r.stops.length} 站`;
 $('stopList').innerHTML = r.stops.map((s, i) => `<li class="o-stop${s.pass ? ' pass' : ''}" data-i="${i}">
  <button type="button" ${s.pass ? 'disabled' : ''}><span class="o-no">${esc(s.code)}</span><span class="o-name">${esc(s.name)}</span><small>${esc(s.kana)} · ${esc(s.en)}</small>${s.pass ? '<em>通过</em>' : ''}</button></li>`).join('');
 markStops();
}
function markStops() {
 [...$('stopList').children].forEach((li, i) => {
  li.classList.toggle('current', i === S.pos); li.classList.toggle('past', i < S.pos);
  li.querySelector('button').toggleAttribute('aria-current', i === S.pos);
 });
}
$('stopList').onclick = e => { const li = e.target.closest('[data-i]'); if (li && !li.classList.contains('pass')) goTo(+li.dataset.i) };

/* ---------- 显示屏 ---------- */
function draw() {
 if (S.single) { drawSingle(); return }
 const r = run(), s = stop(); if (!r || !s) return;
 const count = 6, start = Math.max(0, Math.min(S.pos - 1, r.stops.length - count));
 data = {
  city: 'ja', line: r.line, code: r.code, color: r.color, type: r.type, mark: MARKS[r.type] || '', typeColor: r.type_color || '',
  dest: r.loop ? s.dest + '方面' : s.dest + '行', phase: S.phase,
  station: {zh: s.name, jname: s.name, kana: s.kana, en: s.en, no: s.code, code3: s.code3},
  stops: r.stops.slice(start, start + count).map((x, i) => ({name: x.name, no: x.code, pass: x.pass, state: start + i < S.pos ? 'past' : start + i === S.pos ? 'current' : 'next'})),
  transfer: {main: '', en: '', list: s.transfers || []}, door: '', speed: 3, langs: {kana: true, en: true, zh: false},
 };
 lcd.update(data); channel?.postMessage(data);
 try { localStorage.setItem('station-sim-lcd', JSON.stringify(data)) } catch (e) {}
 ui();
}
if (channel) channel.onmessage = e => { if (e.data?.hello && data) channel.postMessage(data) };
function setPhase(p) { if (p !== S.phase) { S.phase = p; draw() } }

/* ---------- 播放器 ---------- */
let revision = 0;
function setPlayer(state, title) {
 if (title !== undefined) $('nowPlaying').textContent = title;
 $('player').dataset.state = state;
 $('pausePlay').hidden = state !== 'playing'; $('resumePlay').hidden = state !== 'paused'; $('stopPlay').hidden = state === 'idle';
 if (state === 'idle') $('nowPlaying').textContent = '未在播放';
}
async function startPlayback(title) {
 const my = ++revision; setPlayer('playing', title);
 try { await audio.play() } catch (e) { if (my === revision) { setPlayer('idle'); after = null; S.auto = false; ui(); toast('音频播放失败，请重试') } }
}
function play(url, title, phase, then) { after = then; audio.src = url; if (phase) setPhase(phase); startPlayback(title) }
/** 停止声音和连续运行 */
function halt() { revision++; after = null; audio.pause(); audio.removeAttribute('src'); setPlayer('idle'); if (S.auto) S.auto = false; ui() }
$('pausePlay').onclick = () => { revision++; audio.pause(); setPlayer('paused') };
$('resumePlay').onclick = () => startPlayback();
$('stopPlay').onclick = () => { halt(); if (S.state === 'run') { S.state = 'at'; setPhase('at') } };
audio.addEventListener('ended', () => { setPlayer('idle'); const f = after; after = null; f?.() });

/* ---------- 运行 ---------- */
function goTo(i) {
 halt(); S.pos = i; S.state = 'at'; S.step = 0; S.phase = 'at';
 markStops(); draw(); save();
 $('stopList').children[i]?.scrollIntoView({block: 'nearest'});
}
function depart() {
 const n = nextIndex();
 if (n < 0) { S.auto = false; ui(); toast('已到终点站'); return }
 S.pos = n; S.state = 'run'; S.step = 0; markStops(); save(); track();
}
function track() {
 const s = stop(), url = s.pa[S.step];
 if (!url) { arrive(); return }
 S.step++;
 play(url, `${run().line} · ${s.name} · 车内广播 ${S.step}/${s.pa.length}`, /-arr/.test(url) ? 'soon' : 'next',
  () => S.step >= s.pa.length ? arrive() : S.auto ? track() : ui());
 ui();
}
function arrive() {
 S.state = 'at'; setPhase('at'); ui();
 if (S.auto) setTimeout(() => { if (S.auto && S.state === 'at') melody() }, 1500);
}
function melody(i = 0) {
 const s = stop(), url = s?.sta[i];
 if (!url) { if (S.auto) depart(); else ui(); return }
 play(url, `${run().line} · ${s.name} · 发车音乐`, null, () => melody(i + 1));
}
function advance() { if (S.state === 'at') depart(); else if (S.step < stop().pa.length) track(); else { halt(); arrive() } }

function ui() {
 const r = run(), s = stop(); if (!r || !s) return;  // 单段原声没有逐站控制
 const n = nextIndex(), p = nextIndex(S.pos, -1), next = n >= 0 ? r.stops[n].name : '';
 $('status').textContent = S.state === 'at'
  ? `停在「${s.name}」。` + (n >= 0 ? `下一站：${next}。` : '这是终点站。')
  : `正开往「${s.name}」：车内广播 ${Math.min(S.step, s.pa.length)} / ${s.pa.length}。`;
 $('departLabel').textContent = S.state === 'at' ? (n >= 0 ? `发车，开往${next}` : '已到终点') : S.step < s.pa.length ? '下一段广播' : '到站';
 $('depart').disabled = S.state === 'at' && n < 0;
 $('prevStation').disabled = p < 0; $('nextStation').disabled = n < 0;
 $('melody').disabled = S.state !== 'at' || !s.sta.length;
 $('autoRun').textContent = S.auto ? '停止连续运行' : '连续运行'; $('autoRun').setAttribute('aria-pressed', S.auto);
}

$('depart').onclick = advance;
$('prevStation').onclick = () => { const p = nextIndex(S.pos, -1); if (p >= 0) goTo(p) };
$('nextStation').onclick = () => { const n = nextIndex(); if (n >= 0) goTo(n) };
$('melody').onclick = () => { if (S.state === 'at') melody() };
$('autoRun').onclick = () => {
 if (S.auto) { halt(); return }
 S.auto = true; ui();
 if ($('player').dataset.state === 'playing') return;  // 当前这段播完后自动接下去
 if (S.state === 'at') melody(); else track();
};
$('restart').onclick = () => goTo(0);
$('lcdFull').onclick = () => $('lcdFrame').requestFullscreen?.().catch(() => toast('浏览器不允许全屏'));
$('lcdFrame').ondblclick = () => document.fullscreenElement ? document.exitFullscreen() : $('lcdFrame').requestFullscreen?.().catch(() => {});
$('lcdWindow').onclick = () => { if (!window.open('/static/display.html', 'station-sim-lcd', 'width=1280,height=760')) toast('浏览器拦截了新窗口，请允许弹出窗口') };
document.addEventListener('keydown', e => {
 if (S.single && e.key === 'End' && !e.altKey && !e.ctrlKey) { e.preventDefault(); const st = $('player').dataset.state; if (st === 'playing') $('pausePlay').click(); else if (st === 'paused') $('resumePlay').click(); return }
 if (!run() || e.isComposing || e.ctrlKey || e.metaKey) return;
 if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); $('prevStation').click(); return }
 if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); $('nextStation').click(); return }
 if (e.altKey) return;
 if (e.key === 'PageDown') { e.preventDefault(); if (!$('depart').disabled) advance() }
 else if (e.key === 'PageUp') { e.preventDefault(); if (!$('melody').disabled) melody() }
 else if (e.key === 'End') { e.preventDefault(); const st = $('player').dataset.state; if (st === 'playing') $('pausePlay').click(); else if (st === 'paused') $('resumePlay').click() }
});

/* ---------- 启动 ---------- */
/** 单段原声：routes.js 里的内置样本（本机有录音的）加上自己导入的录音 */
function buildSingles(projects) {
 const has = new Set(projects.map(p => p.id));
 const builtIn = routes.filter(r => has.has(r.pid));
 const mine = projects.filter(p => p.category === '我的录音').map(p => {
  const ms = p.markers || [], ja = p.locale === 'JA' || ms.some(m => m.lang === 'JA');
  return {key: 'p_' + p.id, pid: p.id, name: p.name, code: 'REC', color: '#5b6b8c', city: ja ? '东京' : '上海', kind: '我的录音', sub: '自己导入的录音',
   en: ms.some(m => m.lang === 'EN'), line: p.line || '', stations: [row(ms.find(m => m.field === 'station')?.text || p.station || '')]};
 });
 return builtIn.concat(mine);
}

(async () => {
 const [r1, r2] = await Promise.all([fetch('/api/jre/routes').then(r => r.json()).catch(() => []), fetch('/api/projects').then(r => r.json()).catch(() => [])]);
 runs = Array.isArray(r1) ? r1 : []; singles = buildSingles(Array.isArray(r2) ? r2 : []);
 if (!runs.length && !singles.length) { $('empty').hidden = false; document.querySelector('.o-main').hidden = true; return }
 const names = [...new Set(runs.map(r => r.line))];
 lines = names.sort((a, b) => (LINE_ORDER.indexOf(a) + 1 || 99) - (LINE_ORDER.indexOf(b) + 1 || 99));
 const saved = restore();
 if (saved.single && singles.some(r => r.key === saved.single)) chooseSingle(saved.single);
 else if (!runs.length) chooseSingle(singles[0].key);
 else if (runs.some(r => r.id === saved.run)) {
  chooseRun(saved.run);
  if (saved.pos > 0 && saved.pos < run().stops.length && !run().stops[saved.pos].pass) goTo(saved.pos);
 } else chooseLine(lines[0]);
})();
