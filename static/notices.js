'use strict';
/* 提示音面板（原声）：上海公交车内提示、JR 关门注意、停车中广播、发车音乐。
   原声车厢和欧陆巡游共用。数据：/api/notices → {groups: [{id, title, source, items: [{title, text, url}]}]}
   用法：Notices.mount(容器元素)，Notices.show(['bus']) 只显示指定分组（不传则全部）。 */
const Notices = (() => {
 const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
 const player = new Audio();
 let groups = [], root = null, only = null, current = '';
 const main = document.getElementById('audio');

 function stop() { player.pause(); player.removeAttribute('src'); current = ''; mark() }
 function mark() { root?.querySelectorAll('[data-url]').forEach(b => { const on = b.dataset.url === current; b.classList.toggle('playing', on); b.setAttribute('aria-pressed', on) }) }
 function render() {
  if (!root) return;
  const list = groups.filter(g => g.items.length && (!only || only.includes(g.id)));
  root.hidden = !list.length;
  root.innerHTML = `<h2>提示音 <span class="o-count">原声，点一下播放，再点停止</span></h2>` + list.map(g => `
   <section class="n-group"><h3>${esc(g.title)}</h3><div class="n-grid">
    ${g.items.map(x => `<button type="button" class="n-item" data-url="${esc(x.url)}" aria-pressed="false" title="${esc(x.text)}"><b>${esc(x.title)}</b><small>${esc(x.text)}</small></button>`).join('')}
   </div><p class="o-note">来源：${esc(g.source)}</p></section>`).join('');
  mark();
 }
 async function mount(el) {
  root = el;
  try { groups = (await (await fetch('/api/notices')).json()).groups || [] } catch (e) { groups = [] }
  render();
  root.addEventListener('click', e => {
   const b = e.target.closest('[data-url]'); if (!b) return;
   if (current === b.dataset.url) { stop(); return }
   window.halt?.();  // 先停掉页面上正在播的报站
   current = b.dataset.url; player.src = current; mark();
   player.play().catch(() => { current = ''; mark() });
  });
 }
 player.addEventListener('ended', () => { current = ''; mark() });
 main?.addEventListener('play', stop);  // 报站开始播放时停掉提示音
 return {mount, show(ids) { only = ids || null; render() }, stop};
})();
