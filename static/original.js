'use strict';
/* 报站模拟器 · 原声版
   只播放原声，不做替换，不用 AI。选线路和种别，按真实顺序播放车内广播和发车音乐，可切换上一站、下一站。
   数据来自 /api/jre/routes（本机 pids-jre-simulator）。完整版（自定义、AI 生成）在 /full，代码另存在 app.js。

   每个运行图的一站：pa = 驶向这一站途中的车内广播（「次は」「まもなく」），sta = 这一站站台上的发车音乐。
   state：at = 停在 pos 这一站；run = 正驶向 pos 这一站，step 是下一段要播的广播。 */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const audio = $('audio');
const lcd = LCD.create($('lcdFrame'));
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('station-sim-lcd') : null;
const MARKS = {中央特快: 'chuo', 青梅特快: 'ome', 特別快速: 'chuo', 快速: 'rapid', 通勤快速: 'rapid', 快速アクティー: 'rapid', 快速アーバン: 'rapid', 快速ラビット: 'rapid', 特急: 'express', 通勤特快: 'express'};
const LINE_ORDER = ['山手線', '中央線快速', '京浜東北線', '総武快速線', '京葉線', '埼京線', '南武線', '東海道線', '高崎線', '宇都宮線'];

let runs = [], lines = [];
const S = {line: '', run: '', pos: 0, state: 'at', step: 0, phase: 'at', auto: false};
let after = null, data = null;

function save() { try { localStorage.setItem('station-sim-original', JSON.stringify({line: S.line, run: S.run, pos: S.pos})) } catch (e) {} }
function restore() { try { return JSON.parse(localStorage.getItem('station-sim-original') || 'null') || {} } catch (e) { return {} } }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600) }

const run = () => runs.find(r => r.id === S.run);
const stop = () => run()?.stops[S.pos];
const lineRuns = name => runs.filter(r => r.line === name);
function nextIndex(from = S.pos, dir = 1) {
 const stops = run().stops;
 for (let i = from + dir; i >= 0 && i < stops.length; i += dir) if (!stops[i].pass) return i;
 return -1;
}

/* ---------- 线路和种别 ---------- */
function renderLines() {
 $('lineList').innerHTML = lines.map(name => {
  const rs = lineRuns(name), r = rs[0];
  const sub = [...new Set(rs.map(x => x.direction))].join('・') + ' · ' + rs.map(x => x.type).join('／');
  return `<button type="button" class="o-line ${name === S.line ? 'on' : ''}" aria-pressed="${name === S.line}" data-line="${esc(name)}" style="--c:${esc(r.color)}">
   <span class="o-badge">${esc(r.code)}</span><span class="o-line-name">${esc(name)}<small>${esc(sub)}</small></span></button>`;
 }).join('');
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
 S.run = id; S.line = run().line; S.pos = 0; S.state = 'at'; S.step = 0; S.phase = 'at';
 renderLines(); renderServices(); renderStops(); draw(); save();
}
$('lineList').onclick = e => { const b = e.target.closest('[data-line]'); if (b && b.dataset.line !== S.line) chooseLine(b.dataset.line) };
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
 const r = run(), s = stop(); if (!r || !s) return;
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
 if (!run() || e.isComposing || e.ctrlKey || e.metaKey) return;
 if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); $('prevStation').click(); return }
 if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); $('nextStation').click(); return }
 if (e.altKey) return;
 if (e.key === 'PageDown') { e.preventDefault(); if (!$('depart').disabled) advance() }
 else if (e.key === 'PageUp') { e.preventDefault(); if (!$('melody').disabled) melody() }
 else if (e.key === 'End') { e.preventDefault(); const st = $('player').dataset.state; if (st === 'playing') $('pausePlay').click(); else if (st === 'paused') $('resumePlay').click() }
});

/* ---------- 启动 ---------- */
(async () => {
 try { runs = await (await fetch('/api/jre/routes')).json() } catch (e) { runs = [] }
 if (!Array.isArray(runs) || !runs.length) { $('empty').hidden = false; document.querySelector('.o-main').hidden = true; return }
 const names = [...new Set(runs.map(r => r.line))];
 lines = names.sort((a, b) => (LINE_ORDER.indexOf(a) + 1 || 99) - (LINE_ORDER.indexOf(b) + 1 || 99));
 const saved = restore();
 if (runs.some(r => r.id === saved.run)) {
  chooseRun(saved.run);
  if (saved.pos > 0 && saved.pos < run().stops.length && !run().stops[saved.pos].pass) goTo(saved.pos);
 } else chooseLine(lines[0]);
})();
