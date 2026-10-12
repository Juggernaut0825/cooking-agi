/* Technology chronicle: world-tree highlighting, field filter, tooltips, period
   highlighting and compatibility for older share links. Everything stays
   readable without it. No storage, no network. */
(() => {
  const root = document.querySelector('[data-chronicle]');
  if (!root) return;
  const zh = (document.documentElement.lang || '').startsWith('zh');
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const $$ = selector => [...root.querySelectorAll(selector)];
  const stage = root.querySelector('[data-world-tree]');
  const works = $$('.chronicle-work');
  const branches = $$('.chronicle-branch');
  const eras = $$('.chronicle-era');
  const tableFields = $$('[data-field]');
  const treeFields = $$('[data-field-link]');
  const rows = $$('tr[data-topic]');
  const matrix = root.querySelector('.ch-matrix');
  const points = $$('.ch-chip, .wt-node');
  const banner = root.querySelector('[data-filter-banner]');
  const bannerLabel = root.querySelector('[data-filter-label]');
  const nav = root.querySelector('.ch-eras');
  const eraLinks = new Map($$('[data-era-link]').map(link => [link.dataset.eraLink, link]));
  const topicNames = new Map(tableFields.map(button => [button.dataset.field, button.querySelector('strong')?.textContent || button.dataset.field]));
  let active = null;

  // Highlight one field across the tree (hover preview or the active filter).
  function markField(name) {
    if (!stage) return;
    stage.classList.toggle('is-field', Boolean(name));
    stage.querySelectorAll('[data-topic], [data-field-link]').forEach(element => {
      const topic = element.dataset.topic || element.dataset.fieldLink;
      element.classList.toggle('is-active', Boolean(name) && topic === name);
    });
  }

  function setFilter(name, {remember = true} = {}) {
    active = topicNames.has(name) ? name : null;
    works.forEach(work => { work.hidden = Boolean(active) && work.dataset.workTopic !== active; });
    branches.forEach(branch => { branch.hidden = !branch.querySelector('.chronicle-work:not([hidden])'); });
    eras.forEach(era => {
      era.hidden = !era.querySelector('.chronicle-work:not([hidden])');
      eraLinks.get(era.dataset.era)?.classList.toggle('is-empty', era.hidden);
    });
    tableFields.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.field === active)));
    treeFields.forEach(link => link.setAttribute('aria-current', String(link.dataset.fieldLink === active)));
    rows.forEach(row => row.classList.toggle('is-active', row.dataset.topic === active));
    markField(active);
    banner.hidden = !active;
    if (active) {
      const count = works.filter(work => !work.hidden).length;
      const layer = rows.find(row => row.dataset.topic === active)?.closest('tbody')?.dataset.layer;
      if (layer) banner.dataset.layer = layer;
      bannerLabel.textContent = zh
        ? `只看「${topicNames.get(active)}」：${count} 个节点，按年代排列。`
        : `Showing ${topicNames.get(active)} only: ${count} milestone${count === 1 ? '' : 's'} in period order.`;
    }
    if (remember) {
      const url = new URL(location.href);
      if (active) url.searchParams.set('field', active); else url.searchParams.delete('field');
      url.hash = '';
      history.replaceState(history.state, '', url);
    }
  }

  function choose(name) {
    const next = name === active ? null : name;
    setFilter(next);
    if (next) banner.scrollIntoView({behavior: smooth(), block: 'start'});
  }
  tableFields.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => choose(button.dataset.field));
  });
  treeFields.forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      choose(link.dataset.fieldLink);
    });
    link.addEventListener('pointerenter', () => { if (!active) markField(link.dataset.fieldLink); });
    link.addEventListener('pointerleave', () => markField(active));
    link.addEventListener('focus', () => { if (!active) markField(link.dataset.fieldLink); });
    link.addEventListener('blur', () => markField(active));
  });
  root.querySelector('[data-filter-reset]')?.addEventListener('click', () => {
    setFilter(null);
    stage?.scrollIntoView({behavior: smooth(), block: 'center'});
  });

  // Tooltip and recorded connections for stars and table chips.
  const tip = document.createElement('div');
  tip.className = 'ch-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  function show(point) {
    const label = point.getAttribute('aria-label') || point.textContent;
    const [year, ...rest] = label.split(' · ');
    const topic = point.dataset.topic || point.closest('tr')?.dataset.topic;
    tip.replaceChildren();
    const time = document.createElement('time');
    time.textContent = topic ? `${year} · ${topicNames.get(topic) || ''}` : year;
    const title = document.createElement('span');
    title.textContent = rest.join(' · ');
    tip.append(time, title);
    const linked = (point.dataset.links || '').split(' ').filter(Boolean);
    if (linked.length) {
      const note = document.createElement('small');
      note.textContent = zh ? `有记录的联系：${linked.length} 条` : `${linked.length} recorded connection${linked.length === 1 ? '' : 's'}`;
      tip.append(note);
    }
    tip.hidden = false;
    const box = point.getBoundingClientRect();
    const width = tip.offsetWidth, height = tip.offsetHeight;
    tip.style.left = `${Math.min(Math.max(8, box.left + box.width / 2 - width / 2), innerWidth - width - 8)}px`;
    tip.style.top = `${box.top - height - 10 < 60 ? box.bottom + 10 : box.top - height - 10}px`;
    const name = point.dataset.node;
    root.querySelectorAll(`[data-node="${name}"]`).forEach(element => element.classList.add('is-current'));
    if (linked.length) {
      matrix?.classList.add('is-tracing');
      stage?.classList.add('is-tracing');
      linked.forEach(other => root.querySelectorAll(`[data-node="${other}"]`).forEach(element => element.classList.add('is-linked')));
      root.querySelectorAll(`.wt-vine[data-from="${name}"], .wt-vine[data-to="${name}"]`).forEach(vine => vine.classList.add('is-linked'));
    }
  }
  function hide() {
    tip.hidden = true;
    matrix?.classList.remove('is-tracing');
    stage?.classList.remove('is-tracing');
    root.querySelectorAll('.is-current, .is-linked').forEach(element => element.classList.remove('is-current', 'is-linked'));
  }
  points.forEach(point => {
    point.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(point); });
    point.addEventListener('pointerleave', hide);
    point.addEventListener('focus', () => show(point));
    point.addEventListener('blur', hide);
  });
  addEventListener('scroll', hide, {passive: true});

  // Period bar: hovering a period lights its stars and band on the tree.
  function markEra(name) {
    if (!stage) return;
    stage.classList.toggle('is-era', Boolean(name));
    stage.querySelectorAll('.wt-node').forEach(node => node.classList.toggle('is-era', node.dataset.era === name));
    stage.querySelectorAll('[data-era-band]').forEach(band => band.classList.toggle('is-focus', band.dataset.eraBand === name));
  }
  eraLinks.forEach((link, name) => {
    link.addEventListener('pointerenter', () => markEra(name));
    link.addEventListener('pointerleave', () => markEra(null));
    link.addEventListener('focus', () => markEra(name));
    link.addEventListener('blur', () => markEra(null));
  });

  // Reveal a target that the current filter hides.
  function reveal() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id.startsWith('field-')) {
      setFilter(id.slice(6), {remember: false});
      return;
    }
    const target = id && document.getElementById(id);
    if (target && active && target.closest('[hidden]')) {
      setFilter(null, {remember: false});
      target.scrollIntoView({block: 'start'});
    }
  }
  addEventListener('hashchange', reveal);

  // Highlight the period being read.
  if ('IntersectionObserver' in window && nav) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(entry => {
        eraLinks.forEach(link => link.removeAttribute('aria-current'));
        const link = eraLinks.get(entry.target.dataset.era);
        if (!link) return;
        link.setAttribute('aria-current', 'true');
        nav.scrollTo({left: link.offsetLeft - nav.clientWidth / 2 + link.offsetWidth / 2, behavior: smooth()});
      });
    }, {rootMargin: '-40% 0px -55% 0px'});
    eras.forEach(era => observer.observe(era));
  }

  // Older share links: ?milestone=, ?era=, ?field=.
  const params = new URLSearchParams(location.search);
  if (params.get('field')) setFilter(params.get('field'), {remember: false});
  const legacy = params.get('milestone') ? `event-${params.get('milestone')}` : params.get('era') ? `era-${params.get('era')}` : '';
  const legacyTarget = legacy && document.getElementById(legacy);
  if (legacyTarget && !location.hash) {
    if (active && legacyTarget.closest('[hidden]')) setFilter(null, {remember: false});
    const url = new URL(location.href);
    url.searchParams.delete('milestone');
    url.searchParams.delete('era');
    url.hash = legacy;
    history.replaceState(history.state, '', url);
    requestAnimationFrame(() => legacyTarget.scrollIntoView({block: 'start'}));
  } else if (location.hash) {
    reveal();
  }
})();
