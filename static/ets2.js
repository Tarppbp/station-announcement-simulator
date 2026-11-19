'use strict';
/* 改编工坊 · 欧陆巡游
   欧卡 2 本体的城市报站，在本机用 AI 预先生成好（tools/gen_ets2.py），这里只播放。
   先选用哪段原声（上海公交 510 路 / 宇都宫线），再选国家、城市。
   数据：/api/ets2 → {countries, audio: {"国家:城市": {bus510: {url, warn}, utsunomiya: {...}}}, custom} */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const audio = $('audio');
const lcd = LCD.create($('lcdFrame'));
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('station-sim-lcd') : null;
const BASES = [
 {id: 'bus510', name: '公交 510 路', sub: '上海 · 普通话、沪语、英语', code: '510', color: '#e77736', line: '510路', city: 'zh', dir: '欧陆巡游方向'},
 {id: 'utsunomiya', name: '宇都宮線', sub: '东京 · 日语、英语', code: 'JU', color: '#f68b1e', line: '宇都宮線', city: 'ja', dir: '欧陆巡游'},
];
let countries = [], sounds = {};
const S = {base: 'bus510', country: '', idx: 0, phase: 'next', auto: false};
let after = null, data = null, revision = 0;

function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600) }
function save() { try { localStorage.setItem('station-sim-tour', JSON.stringify({base: S.base, country: S.country, idx: S.idx})) } catch (e) {} }
const base = () => BASES.find(b => b.id === S.base);
const country = () => countries.find(c => c.id === S.country);
const city = () => country()?.cities[S.idx];
const sound = (c = country(), x = city()) => sounds[`${c.id}:${x.local}`]?.[S.base];

/* ---------- 列表 ---------- */
function renderBases() {
 $('baseList').innerHTML = BASES.map(b => `<button type="button" class="t-base ${b.id === S.base ? 'on' : ''}" aria-pressed="${b.id === S.base}" data-base="${b.id}" style="--c:${b.color}">
  <span class="o-badge">${esc(b.code)}</span><span><b>${esc(b.name)}</b><small>${esc(b.sub)}</small></span></button>`).join('');
}
function renderCountries() {
 $('countryList').innerHTML = countries.map(c => {
  const ready = c.cities.filter(x => sound(c, x)).length;
  return `<button type="button" class="t-country ${c.id === S.country ? 'on' : ''}" aria-pressed="${c.id === S.country}" data-country="${c.id}">
   <span class="t-flag" aria-hidden="true">${c.flag}</span><span><b>${esc(c.zh)}</b><small>${esc(c.local)} · ${ready} / ${c.cities.length} 城已生成</small></span></button>`;
 }).join('');
}
function renderCities() {
 const c = country();
 $('cityCount').textContent = `${c.cities.length} 座`;
 $('cityList').innerHTML = c.cities.map((x, i) => {
  const s = sound(c, x);
  return `<li class="o-stop${i === S.idx ? ' current' : ''}${s ? '' : ' missing'}" data-i="${i}"><button type="button">
   <span class="o-no">${i + 1}</span><span class="o-name">${esc(x.zh)}</span><small>${esc(x.local)} · ${esc(S.base === 'utsunomiya' ? x.ja : x.en)}</small>
   ${!s ? '<em>未生成</em>' : x.uncertain ? '<em>待核实</em>' : ''}</button></li>`;
 }).join('');
}
$('baseList').onclick = e => { const b = e.target.closest('[data-base]'); if (b && b.dataset.base !== S.base) { halt(); S.base = b.dataset.base; S.phase = 'next'; renderAll() } };
$('countryList').onclick = e => { const b = e.target.closest('[data-country]'); if (b && b.dataset.country !== S.country) { halt(); S.country = b.dataset.country; S.idx = 0; S.phase = 'next'; renderAll() } };
$('cityList').onclick = e => { const li = e.target.closest('[data-i]'); if (li) go(+li.dataset.i) };

/* ---------- 显示屏 ---------- */
function draw() {
 const b = base(), c = country(), x = city(); if (!b || !c || !x) return;
 const ja = b.city === 'ja', count = 6, start = Math.max(0, Math.min(S.idx - 1, c.cities.length - count));
 data = {
  city: b.city, line: b.line, code: b.code, color: b.color, type: '', mark: '', typeColor: '',
  dest: `${c.flag} ${ja ? c.ja : c.zh}`, phase: S.phase,
  station: {zh: x.zh, jname: ja ? x.ja : '', kana: '', en: x.en, no: '', code3: ''},
  stops: c.cities.slice(start, start + count).map((y, i) => ({name: ja ? y.ja : y.zh, no: '', pass: false, state: start + i < S.idx ? 'past' : start + i === S.idx ? 'current' : 'next'})),
  transfer: {main: '', en: '', list: []}, door: '', speed: 3, langs: {kana: false, en: true, zh: ja},
 };
 lcd.update(data); channel?.postMessage(data);
 try { localStorage.setItem('station-sim-lcd', JSON.stringify(data)) } catch (e) {}
 const s = sound();
 $('tourTitle').textContent = `${c.flag} ${c.zh} · ${x.zh}`;
 $('tourSub').textContent = `用「${b.name}」的原声，站名由 AI 生成。` + (x.uncertain ? '这座城市是否属于欧卡 2 本体还没核实。' : '');
 $('playLabel').textContent = s ? `播放「${x.zh}」` : '这座城市还没生成';
 $('playCity').disabled = !s;
 $('prevCity').disabled = S.idx <= 0; $('nextCity').disabled = S.idx >= c.cities.length - 1;
 $('status').textContent = `${c.zh}第 ${S.idx + 1} / ${c.cities.length} 座城市` + (s?.warn ? '。自动检查对这段有提醒，建议试听。' : '。');
 $('autoRun').textContent = S.auto ? '停止连续播放' : '连续播放本国'; $('autoRun').setAttribute('aria-pressed', S.auto);
 [...$('cityList').children].forEach((li, i) => li.classList.toggle('current', i === S.idx));
}
if (channel) channel.onmessage = e => { if (e.data?.hello && data) channel.postMessage(data) };
function renderAll() { renderBases(); renderCountries(); renderCities(); draw(); save(); showNotices() }
/** 提示音跟着所选原声：510 路配上海公交提示，宇都宫线配 JR 的关门注意、停车中广播和发车音乐 */
function showNotices() { if (typeof Notices !== 'undefined') Notices.show(S.base === 'bus510' ? ['bus'] : ['door', 'stopping', 'melody']) }

/* ---------- 播放 ---------- */
function setPlayer(state, title) {
 if (title !== undefined) $('nowPlaying').textContent = title;
 $('player').dataset.state = state;
 $('pausePlay').hidden = state !== 'playing'; $('resumePlay').hidden = state !== 'paused'; $('stopPlay').hidden = state === 'idle';
 if (state === 'idle') $('nowPlaying').textContent = '未在播放';
}
async function startPlayback(title) {
 const my = ++revision; setPlayer('playing', title);
 try { await audio.play() } catch (e) { if (my === revision) { setPlayer('idle'); after = null; S.auto = false; draw(); toast('音频播放失败，请重试') } }
}
function halt() { revision++; after = null; audio.pause(); audio.removeAttribute('src'); setPlayer('idle'); S.auto = false }
function playCurrent() {
 const s = sound(), x = city(); if (!s) { if (S.auto) next(); return }
 after = () => { S.phase = 'at'; draw(); if (S.auto) setTimeout(() => S.auto && next(), 1500) };
 audio.src = s.url; S.phase = 'next'; draw();
 startPlayback(`${base().name} · ${country().zh} · ${x.zh}`);
}
function go(i) { const c = country(); if (!c || i < 0 || i >= c.cities.length) return; halt(); S.idx = i; S.phase = 'next'; draw(); save() }
function next() {
 const c = country();
 if (S.idx >= c.cities.length - 1) { S.auto = false; draw(); toast(`${c.zh}的城市播完了`); return }
 S.idx++; S.phase = 'next'; draw(); save(); playCurrent();
}
audio.addEventListener('ended', () => { setPlayer('idle'); const f = after; after = null; f?.() });
$('pausePlay').onclick = () => { revision++; audio.pause(); setPlayer('paused') };
$('resumePlay').onclick = () => startPlayback();
$('stopPlay').onclick = () => { halt(); draw() };
$('playCity').onclick = () => { S.auto = false; playCurrent() };
$('prevCity').onclick = () => go(S.idx - 1);
$('nextCity').onclick = () => go(S.idx + 1);
$('autoRun').onclick = () => { if (S.auto) { halt(); draw(); return } S.auto = true; playCurrent() };
$('lcdFull').onclick = () => $('lcdFrame').requestFullscreen?.().catch(() => toast('浏览器不允许全屏'));
$('lcdFrame').ondblclick = () => document.fullscreenElement ? document.exitFullscreen() : $('lcdFrame').requestFullscreen?.().catch(() => {});
$('lcdWindow').onclick = () => { if (!window.open('/static/display.html', 'station-sim-lcd', 'width=1280,height=760')) toast('浏览器拦截了新窗口，请允许弹出窗口') };
document.addEventListener('keydown', e => {
 if (e.isComposing || e.ctrlKey || e.metaKey) return;
 if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); go(S.idx - 1) }
 else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); go(S.idx + 1) }
 else if (!e.altKey && e.key === 'End') { e.preventDefault(); const st = $('player').dataset.state; if (st === 'playing') $('pausePlay').click(); else if (st === 'paused') $('resumePlay').click() }
});

(async () => {
 let d = {};
 try { d = await (await fetch('/api/ets2')).json() } catch (e) {}
 countries = d.countries || []; sounds = d.audio || {};
 $('customLink').hidden = !d.custom;  // 服务器上没有 AI，只能播放，不显示「自制改编」
 $('tourNote').textContent = d.note || '';
 if (!countries.length) { $('status').textContent = '还没有城市数据。'; return }
 let saved = {}; try { saved = JSON.parse(localStorage.getItem('station-sim-tour') || '{}') } catch (e) {}
 if (BASES.some(b => b.id === saved.base)) S.base = saved.base;
 S.country = countries.some(c => c.id === saved.country) ? saved.country : countries[0].id;
 S.idx = Math.min(Math.max(0, saved.idx || 0), country().cities.length - 1);
 renderAll();
})();
