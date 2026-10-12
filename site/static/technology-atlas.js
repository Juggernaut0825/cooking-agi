(() => {
  const chronicle = document.querySelector('[data-chronicle]');
  if (!chronicle) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const details = [...chronicle.querySelectorAll('details')].filter(item => item.id);
  const languageLinks = [...document.querySelectorAll('[data-language-switch]')];
  const targets = new Map([...chronicle.querySelectorAll('[id]')].map(item => [item.id, item]));
  targets.set('tree-map', chronicle);
  const summaryOf = item => item.querySelector('summary');
  const topicButtons = [...chronicle.querySelectorAll('[data-topic]')];
  const topicPanels = [...chronicle.querySelectorAll('[data-topic-panel]')];
  const works = [...chronicle.querySelectorAll('.chronicle-work')];
  const branches = [...chronicle.querySelectorAll('.chronicle-branch')];
  const eras = [...chronicle.querySelectorAll('.chronicle-era')];
  const reset = chronicle.querySelector('[data-topic-reset]');
  const limbs = [...chronicle.querySelectorAll('[data-limb]')];
  const announcement = chronicle.querySelector('[data-world-announcement]');
  const motionButton = chronicle.querySelector('[data-world-motion]');
  const chinese = document.documentElement?.lang.startsWith('zh');
  const say = (zh, en) => chinese ? zh : en;
  let motionPaused = motion.matches;
  let activeTopic = 'all';
  let initialScrollPending = true;

  function highlight(name) {
    limbs.forEach(limb => {
      limb.dataset.focus = name === 'all' ? 'all' : limb.dataset.limb === name ? 'active' : 'other';
    });
  }

  function updateMotion() {
    chronicle.classList.toggle('world-motion-paused', motionPaused || motion.matches);
    if (!motionButton) return;
    motionButton.disabled = motion.matches;
    motionButton.setAttribute('aria-pressed', String(motionPaused || motion.matches));
    motionButton.textContent = motion.matches ? say('已减少动效', 'Reduced motion') : motionPaused ? say('播放动效', 'Play motion') : say('暂停动效', 'Pause motion');
  }

  function identifierFrom(hash) {
    try { return decodeURIComponent(hash.slice(1)); }
    catch { return ''; }
  }

  function topicURL(url, name) {
    if (name === 'all') url.searchParams.delete('topic');
    else url.searchParams.set('topic', name);
    return url;
  }

  function filterTopic(name) {
    if (name !== 'all' && !topicButtons.some(button => button.dataset.topic === name)) return;
    activeTopic = name;
    highlight(name);
    topicButtons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.topic === name)); });
    topicPanels.forEach(panel => { panel.hidden = panel.dataset.topicPanel !== name; });
    chronicle.querySelectorAll('[data-work-topic]').forEach(item => {
      item.hidden = name !== 'all' && item.dataset.workTopic !== name;
    });
    branches.forEach(branch => {
      const branchWorks = works.filter(work => branch.contains(work));
      const visibleWorks = branchWorks.filter(work => !work.hidden);
      branch.hidden = visibleWorks.length === 0;
      branch.querySelector('.chronicle-branch-label small').textContent = visibleWorks.map(work =>
        work.querySelector('[data-work-title]').textContent.split(' · ')[0]).join(' · ');
      const description = branch.querySelector('[data-branch-summary]');
      if (description) description.hidden = visibleWorks.length !== branchWorks.length;
    });
    eras.forEach(era => {
      era.hidden = !branches.some(branch => !branch.hidden && era.contains(branch));
      const title = era.querySelector('[data-era-title]');
      const focusedTitle = era.querySelector('[data-era-focus]');
      if (title && focusedTitle) {
        title.hidden = name !== 'all';
        focusedTitle.hidden = name === 'all';
        focusedTitle.textContent = topicButtons.find(button => button.dataset.topic === name)?.querySelector('strong').textContent || '';
      }
      const featured = era.querySelector('.chronicle-featured');
      if (featured) featured.hidden = ![...featured.querySelectorAll('a')].some(link => !link.hidden);
    });
    chronicle.querySelectorAll('.chronicle-nav a').forEach(link => { link.hidden = Boolean(targets.get(identifierFrom(link.hash))?.hidden); });
    if (reset) reset.disabled = name === 'all';
    chronicle.dataset.topic = name;
    if (announcement) announcement.textContent = name === 'all' ? say('显示全部领域。', 'Showing all fields.') :
      topicButtons.find(button => button.dataset.topic === name).querySelector('strong').textContent +
      say('：下方显示该领域的年代与代表节点。', ': the timeline now shows this field.');
  }

  function restore(scroll = true, focus = false) {
    const identifier = identifierFrom(location.hash);
    const target = targets.get(identifier);
    const requested = target?.dataset.topic || new URL(location.href).searchParams.get('topic');
    filterTopic(identifier !== 'tree-map' && topicButtons.some(button => button.dataset.topic === requested) ? requested : 'all');
    if (target && (target.hidden || target.closest('[hidden]'))) filterTopic('all');
    const url = topicURL(new URL(location.href), activeTopic);
    if (url.href !== location.href) history.replaceState(history.state, '', url.href);
    languageLinks.forEach(link => {
      const translated = topicURL(new URL(link.href, location.href), activeTopic);
      translated.hash = location.hash;
      link.href = translated.href;
    });
    details.forEach(item => item.classList.toggle('chronicle-selected', item === target));
    if (!target) return;
    let current = target;
    while (current && current !== chronicle) {
      if (current.tagName === 'DETAILS') current.open = true;
      current = current.parentElement;
    }
    const reading = new URL(location.href).searchParams.has('milestone') || chronicle.querySelector('.world-dialog')?.open;
    const scrollTarget = identifier.startsWith('field-') ? chronicle.querySelector('[data-world-grove]') || target : target;
    if (scroll && !reading) scrollTarget.scrollIntoView({block:'start', behavior:motion.matches ? 'auto' : 'smooth'});
    if (focus && target.tagName === 'DETAILS') summaryOf(target).focus({preventScroll:true});
    else if (focus && target.tagName === 'BUTTON') target.focus({preventScroll:true});
  }

  function navigate(identifier, scroll, focus) {
    initialScrollPending = false;
    const target = targets.get(identifier);
    const topic = identifier === 'tree-map' || target?.hidden || target?.closest('[hidden]') ? 'all' : target?.dataset.topic || activeTopic;
    const url = topicURL(new URL(location.href), topic);
    url.hash = identifier;
    if (location.href !== url.href) history.pushState(null, '', url.href);
    window.dispatchEvent(new Event('hashchange'));
    restore(scroll, focus);
  }

  details.forEach(item => {
    summaryOf(item).addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      item.open = !item.open;
      if (item.open) navigate(item.id, false, false);
      else {
        const parent = item.parentElement.closest('details, .chronicle-era');
        navigate(parent.id, false, false);
      }
    });
  });

  topicButtons.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      const identifier = activeTopic === button.dataset.topic ? 'tree-map' : button.id;
      navigate(identifier, false, false);
      if (window.matchMedia('(max-width: 780px)').matches) {
        chronicle.querySelector('.world-insight')?.scrollIntoView({block:'nearest', behavior:motion.matches ? 'auto' : 'smooth'});
      }
    });
    button.addEventListener('pointerenter', () => highlight(button.dataset.topic));
    button.addEventListener('pointerleave', () => highlight(activeTopic));
    button.addEventListener('focus', () => highlight(button.dataset.topic));
    button.addEventListener('blur', () => highlight(activeTopic));
  });
  if (reset) reset.addEventListener('click', () => navigate('tree-map', false, false));
  window.addEventListener('world:select-topic', event => {
    const name = event.detail;
    if (name === 'all' || topicButtons.some(button => button.dataset.topic === name)) {
      navigate(name === 'all' ? 'tree-map' : 'field-' + name, false, false);
    }
  });
  if (motionButton) motionButton.addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });
  motion.addEventListener?.('change', updateMotion);
  updateMotion();

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const identifier = identifierFrom(link.hash);
    if (!targets.has(identifier)) return;
    event.preventDefault();
    navigate(identifier, true, true);
  });

  window.addEventListener('popstate', () => { initialScrollPending = false; restore(); });
  window.addEventListener('hashchange', () => { initialScrollPending = false; restore(false); });
  document.addEventListener('visibilitychange', () => {
    chronicle.classList.toggle('chronicle-paused', document.hidden);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      chronicle.classList.toggle('chronicle-offscreen', !entries[0].isIntersecting);
    });
    observer.observe(chronicle.querySelector('[data-world-grove]') || chronicle.querySelector('.world-map') || chronicle);
  }
  restore(false);
  const initialURL = location.href;
  if (targets.has(identifierFrom(location.hash))) requestAnimationFrame(() => {
    if (initialScrollPending && location.href === initialURL) restore(true);
    initialScrollPending = false;
  });
})();
