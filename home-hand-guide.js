// One eligible forest visit; subsequent purchases within that visit still get hints.
export function createHomeHandGuide(panel, upgrade, back) {
  const key = 'arrowpang-home-hand-guide-v1';
  let active = false, timer, removal, target;
  const hand = document.createElement('img');
  hand.alt = '';
  hand.setAttribute('aria-hidden', 'true');
  Object.assign(hand.style, {position:'fixed', zIndex:'10000', pointerEvents:'none', transition:'opacity 450ms ease', objectFit:'contain'});
  function hide() { clearTimeout(timer); clearTimeout(removal); hand.remove(); target = null; }
  function position() {
    if (!target) return;
    const r = target.getBoundingClientRect(), returning = target === back;
    const w = Math.min(190, Math.max(110, r.width * (returning ? 1.7 : 1.15)));
    const h = w * (returning ? 1184 / 1296 : 1024 / 1536);
    const x = r.left + r.width * .52, y = returning ? r.bottom - r.height * .22 : r.top + r.height * .18;
    hand.style.width = w + 'px'; hand.style.height = h + 'px';
    hand.style.left = (x - w * (returning ? .72 : .32)) + 'px';
    hand.style.top = (y - h * (returning ? .29 : .8)) + 'px';
  }
  function show(button) {
    hide(); target = button;
    hand.src = new URL('assets/guide-hands-v1/' + (button === back ? 'return-hand.png' : 'upgrade-hand.png'), import.meta.url).href;
    hand.style.opacity = '.8'; document.body.append(hand); position();
    timer = setTimeout(() => { hand.style.opacity = '0'; removal = setTimeout(hide, 460); }, 2000);
  }
  window.addEventListener('resize', position);
  new MutationObserver(() => { if (panel.hidden) { active = false; hide(); } }).observe(panel, {attributes:true, attributeFilter:['hidden']});
  return {
    open() {
      if (!upgrade.classList.contains('home-action-ready')) return;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch {}
      active = true; show(upgrade);
    },
    buying() { hide(); },
    completed() { if (active && !panel.hidden) show(upgrade.classList.contains('home-action-ready') ? upgrade : back); },
    close() { active = false; hide(); }
  };
}
