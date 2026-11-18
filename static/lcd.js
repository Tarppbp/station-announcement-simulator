'use strict';
/* 车内动态显示屏（车门上方的液晶屏）。主页面和单独显示页（display.html）共用。
   画面只由 update(data) 传入的数据决定；内部按 1280×720 绘制，再整体等比缩放。 */
const LCD = (() => {
 const W = 1280, H = 720;
 const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');

 function kindStyle(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return null;
  const [r, g, b] = color.slice(1).match(/../g).map(hex => {
   const value = parseInt(hex, 16) / 255;
   return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return {background: color, ink: (.2126 * r + .7152 * g + .0722 * b) > .179 ? '#000' : '#fff'};
 }

 function stationBadge(station) {
  const no = String(station?.no || '').trim(), code3 = String(station?.code3 || '').trim();
  const split = /^([A-Z]{1,4})\s*(\d{1,3})$/i.exec(no);
  const parts = split ? split.slice(1) : no ? [no] : [];
  return (code3 ? `<span class="lcd-code3">${esc(code3)}</span>` : '') +
   parts.map(part => `<span>${esc(part)}</span>`).join('');
 }

 function iconMarkup(badge) {
  const icon = String(badge?.icon || ''), code = String(badge?.code || '').trim();
  const fallback = code ? `<span class="lcd-transfer-code">${esc(code)}</span>` : '';
  return /^\/jre\/icons\/[a-z0-9_.%+-]+\.png$/i.test(icon)
   ? `<img src="${esc(icon)}" alt="${esc(code)}">` : fallback;
 }

 // 各语言的状态文字。key：next 下一站 / soon 即将到站 / at 到站
 const LABEL = {
  ja: {next: '次は', soon: 'まもなく', at: 'ただいま'},
  kana: {next: 'つぎは', soon: 'まもなく', at: 'ただいま'},
  en: {next: 'Next', soon: 'Arriving at', at: 'Now at'},
  zh: {next: '下一站', soon: '即将到站', at: '到站'},
 };
 const DOOR = {
  ja: {left: '左側のドアが開きます', right: '右側のドアが開きます'},
  zh: {left: '左侧开门', right: '右侧开门'},
  en: {left: 'Doors on the left side will open', right: 'Doors on the right side will open'},
 };

 /** 站名轮播：按语言列出 [{lang, label, name}] */
 function names(d) {
  const st = d.station || {}, show = d.langs || {}, out = [], seen = new Set();
  const add = (lang, name) => { name = String(name || '').trim(); if (!name || seen.has(name)) return; seen.add(name); out.push({lang, name}) };
  if (d.city === 'ja') {
   add('ja', st.jname || st.zh);
   if (show.kana !== false) add('kana', st.kana);
   if (show.en !== false) add('en', st.en);
   if (show.zh !== false) add('zh', st.zh);
  } else {
   add('zh', st.zh);
   if (show.en !== false) add('en', st.en);
  }
  if (!out.length) out.push({lang: d.city === 'ja' ? 'ja' : 'zh', name: '—'});
  return out;
 }
 /** 下半屏轮播页：路线图、换乘、开门方向 */
 function pages(d) {
  const list = ['route'];
  if (d.transfer?.list?.length || (d.transfer?.main || d.transfer?.en || '').trim()) list.push('transfer');
  if (d.door === 'left' || d.door === 'right') list.push('door');
  return list;
 }
 const langAttr = lang => ({ja: 'ja', kana: 'ja', en: 'en', zh: 'zh-CN'}[lang]);

 function create(frame) {
  frame.classList.add('lcd-frame');
  frame.innerHTML = `<div class="lcd" role="img" aria-roledescription="车内显示屏">
   <header class="lcd-head">
    <span class="lcd-code"></span><b class="lcd-line"></b><span class="lcd-type"></span>
    <span class="lcd-dest"></span><time class="lcd-clock"></time>
   </header>
   <div class="lcd-stripe"></div>
   <section class="lcd-main">
    <div class="lcd-label"><span></span></div>
    <div class="lcd-name"><span class="lcd-no"></span><div class="lcd-name-box"><span class="lcd-name-text"></span></div></div>
   </section>
   <section class="lcd-lower"></section>
  </div>`;
  const q = s => frame.querySelector(s);
  const el = {screen: q('.lcd'), code: q('.lcd-code'), line: q('.lcd-line'), type: q('.lcd-type'), dest: q('.lcd-dest'), clock: q('.lcd-clock'),
   label: q('.lcd-label span'), no: q('.lcd-no'), box: q('.lcd-name-box'), name: q('.lcd-name-text'), lower: q('.lcd-lower')};
  let data = null, tick = 0, timer = null, lastLower = '', lastName = '';

  // 缩放：按容器大小等比缩放，四周留黑边
  function fit() {
   const w = frame.clientWidth, h = frame.clientHeight || w * H / W;
   const s = Math.min(w / W, h / H);
   el.screen.style.transform = `translate(${(w - W * s) / 2}px, ${(h - H * s) / 2}px) scale(${s})`;
  }
  new ResizeObserver(fit).observe(frame);

  // 名字太长时像真实屏幕那样横向压扁，压到一半还放不下再缩小字号
  // 英文（wrap）太长时改为缩小字号分两行，避免压得太窄
  function squeeze(text, box, base, wrap = false) {
   text.style.cssText = `font-size:${base}px`;
   const avail = box.clientWidth, need = text.scrollWidth;
   if (!avail || need <= avail) return;
   let ratio = avail / need;
   if (wrap && ratio < .75) { text.style.cssText = `font-size:${Math.round(base * .62)}px;white-space:normal;display:block;line-height:1.1`; return }
   if (ratio < .5) { text.style.fontSize = Math.max(28, base * ratio / .5) + 'px'; ratio = Math.min(1, avail / text.scrollWidth) }
   text.style.transform = `scaleX(${Math.max(ratio, .5)})`;
  }
  function animate(node) {
   if (reduced.matches) return;
   node.classList.remove('lcd-in'); void node.offsetWidth; node.classList.add('lcd-in');
  }

  function drawClock() {
   const now = new Date();
   el.clock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }
  setInterval(drawClock, 1000); drawClock();

  function drawRoute(d) {
   const stops = d.stops || [], n = Math.max(stops.length, 2), cur = Math.max(0, stops.findIndex(s => s.state === 'current'));
   const x = i => (i + .5) / n * 100;
   // 列车位置：下一站时在两站中间，即将到站时靠近，到站时停在站上
   const from = cur > 0 ? x(cur - 1) : x(cur) - 50 / n;
   const pos = d.phase === 'at' ? x(cur) : from + (x(cur) - from) * (d.phase === 'soon' ? .72 : .4);
   const past = cur > 0 ? `<i class="lcd-track past" style="left:${x(0)}%;width:${Math.max(0, pos - x(0))}%"></i>` : '';
   return `<div class="lcd-route ${d.phase}" style="--n:${n}">
    <i class="lcd-track" style="left:${x(0)}%;width:${x(stops.length - 1) - x(0)}%"></i>${past}
    ${stops.map((s, i) => `<div class="lcd-stop ${s.state}${s.pass ? ' pass' : ''}" style="left:${x(i)}%;width:${100 / n}%">
      <span class="lcd-stop-name" lang="${d.city === 'ja' ? 'ja' : 'zh-CN'}"><span>${esc(s.name)}</span></span>
      <i class="lcd-dot"></i><span class="lcd-stop-no">${esc(s.no || (s.pass ? (d.city === 'ja' ? '通過' : '通过') : ''))}</span></div>`).join('')}
    <span class="lcd-train ${d.phase}" style="left:${pos}%" aria-hidden="true"><i></i><i></i><i></i></span>
   </div>`;
  }
  function drawTransfer(d) {
   const ja = d.city === 'ja';
   const entries = d.transfer.list?.slice(0, 8);
   const title = `<div class="lcd-page-title"><b>${ja ? '乗換えのご案内' : '换乘信息'}</b><span lang="en">Transfer</span></div>`;
   if (entries?.length) {
    return `<div class="lcd-page lcd-transfer lcd-transfer-list">${title}<ul>${entries.map(line => `<li>
     <div class="lcd-transfer-badges">${(line.badges || []).slice(0, 3).map(iconMarkup).join('')}</div>
     <div class="lcd-transfer-name"><b lang="ja">${esc(line.ja)}</b><span lang="en">${esc(line.en)}</span></div>
    </li>`).join('')}</ul></div>`;
   }
   return `<div class="lcd-page lcd-transfer">${title}
    <div class="lcd-page-body"><p lang="${ja ? 'ja' : 'zh-CN'}">${esc(d.transfer.main)}</p>${d.transfer.en ? `<p class="en" lang="en">${esc(d.transfer.en)}</p>` : ''}</div></div>`;
  }
  function drawDoor(d) {
   const ja = d.city === 'ja', side = d.door;
   return `<div class="lcd-page lcd-door ${side}"><div class="lcd-car" aria-hidden="true"><i class="l"></i><i class="r"></i></div>
    <div class="lcd-page-body"><p lang="${ja ? 'ja' : 'zh-CN'}">${esc((ja ? DOOR.ja : DOOR.zh)[side])}</p><p class="en" lang="en">${esc(DOOR.en[side])}</p></div></div>`;
  }

  function step() {
   if (!data) return;
   const list = names(data), pageList = pages(data);
   const item = list[tick % list.length];
   const page = pageList[Math.floor(tick / list.length) % pageList.length];
   el.label.textContent = LABEL[item.lang][data.phase] || LABEL[item.lang].next;
   el.label.lang = langAttr(item.lang);
   el.label.parentElement.dataset.lang = item.lang;
   const nameKey = item.lang + '|' + item.name;
   if (nameKey !== lastName) {
    el.name.textContent = item.name; el.name.lang = langAttr(item.lang);
    el.box.dataset.lang = item.lang;
    squeeze(el.name, el.box, item.lang === 'en' ? 104 : 132, item.lang === 'en');
    animate(el.box); lastName = nameKey;
   }
   const lowerHtml = page === 'transfer' ? drawTransfer(data) : page === 'door' ? drawDoor(data) : drawRoute(data);
   if (lowerHtml !== lastLower) {
    el.lower.innerHTML = lowerHtml;
    if (!lastLower.startsWith(lowerHtml.slice(0, 30))) animate(el.lower);
    lastLower = lowerHtml;
    el.lower.querySelectorAll('.lcd-stop-name').forEach(box => squeeze(box.firstElementChild, box, 30));
   }
   const text = list.map(x => x.name).join(' / ');
   el.screen.setAttribute('aria-label', `${data.line || ''} ${LABEL[data.city === 'ja' ? 'ja' : 'zh'][data.phase] || ''} ${text}`);
  }
  function restart() {
   clearInterval(timer);
   timer = setInterval(() => { tick++; step() }, Math.max(1.5, +data?.speed || 3) * 1000);
  }

  function update(d) {
   const old = data; data = d;
   el.screen.style.setProperty('--line-color', d.color || '#9acd32');
   el.screen.lang = d.city === 'ja' ? 'ja' : 'zh-CN';
   el.code.textContent = d.code || ''; el.code.hidden = !d.code;
   el.line.textContent = d.line || '';
   el.type.textContent = d.type || ''; el.type.dataset.mark = d.mark || ''; el.type.hidden = !d.type;
   const palette = kindStyle(d.typeColor);
   el.type.style.setProperty('--type-color', palette?.background || '');
   el.type.style.setProperty('--type-ink', palette?.ink || '');
   el.dest.textContent = d.dest || '';
   const badge = stationBadge(d.station);
   el.no.innerHTML = badge; el.no.hidden = !badge;
   // 换了站、状态或轮播内容时从第一种语言重新开始
   const key = d => d && JSON.stringify([d.station, d.phase, d.langs, d.door, d.transfer]);
   if (key(old) !== key(d)) { tick = 0; lastName = ''; restart() }
   else if (old?.speed !== d.speed) restart();
   step();
   if (!old) fit();
  }
  return {update, fit};
 }
 return {create};
})();
