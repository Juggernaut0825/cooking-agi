(() => {
  'use strict';
  const root = document.querySelector('[data-prep-workspace]');
  const progress = window.PreparationProgress;
  if (!root || !progress) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const choose = (zh, en) => chinese ? zh : en;
  const control = name => root.querySelector('[data-workspace-' + name + ']');
  const format = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-US', {month: 'short', day: 'numeric', year: 'numeric'});
  const address = new URL(location.href);
  let topic = ['ml', 'post', 'systems', 'algorithms'].includes(address.searchParams.get('topic')) ? address.searchParams.get('topic') : 'ml';
  let level = ['start', 'refresh'].includes(address.searchParams.get('level')) ? address.searchParams.get('level') : 'start';
  let activeSection = null;
  const headings = {
    overview: [choose('学习概览', 'Pick up where you left off.'), choose('查看接下来的安排，或继续上次的笔记。', 'Choose what to learn and when you have time. Leave room for everything else.')],
    schedule: [choose('学习安排', 'Make room for what you want to learn.'), choose('选择日期和时长，完成后留下记录。每次安排都可以单独调整。', 'Twenty minutes one day, an hour the next. Change the plan when you need to.')],
    routes: [choose('选择学习路线', 'Start where it helps you most.'), choose('按目标和基础选练习，添加到学习安排。', 'Choose a topic and a starting point, then fit a few exercises into your plan.')],
    updates: [choose('更新与设置', 'New material. Still your plan.'), choose('查看关注主题的新内容，设置是否自动加入学习清单。', 'Follow your topics. Keep new material here until you want to make time for it.')],
    progress: [choose('笔记与备份', 'Keep a note for next time.'), choose('查看文章里的状态和备注，导出或恢复学习记录。', 'Your chapter notes and statuses live here. Back them up with your schedule.')]
  };
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  root.querySelectorAll('[id]').forEach(element => {
    if (Object.hasOwn(headings, element.id)) element.id = 'workspace-' + element.id;
  });

  function render() {
    const state = progress.getState();
    const sessions = Object.values(state.schedule?.sessions || {});
    const planned = sessions.filter(entry => entry.status === 'planned').sort((left, right) => left.date.localeCompare(right.date));
    control('planned').textContent = String(planned.length);
    control('completed').textContent = String(sessions.filter(entry => entry.status === 'done').length);
    control('notes').textContent = String(Object.keys(state.entries).length);
    const next = planned[0];
    control('next-title').textContent = next?.title || choose('还没有学习安排', 'Start with one small task');
    control('next-detail').textContent = next
      ? format.format(new Date(next.date + 'T12:00:00')) + choose(' · 计划学习 ', ' · Planned focus: ') + next.minutes + choose(' 分钟', ' min')
      : choose('先选一个练习，再安排适合你的日期和时长。', 'Choose an exercise from a study route and a day that works for you.');
    const target = next?.noteId ? progress.getDestination(next.noteId, {}) : null;
    const link = control('next-link');
    link.href = target ? target.url : next ? '#schedule' : '#routes';
    link.textContent = target ? choose('打开这篇笔记 →', 'Open this note →') : next ? choose('查看安排 →', 'View schedule →') : choose('选择练习 →', 'Choose an exercise →');
    const resume = control('resume');
    resume.hidden = true;
    for (const [identifier, entry] of Object.entries(state.entries).sort((left, right) => right[1].updatedAt.localeCompare(left[1].updatedAt))) {
      const destination = progress.getDestination(identifier, entry);
      if (destination && entry.status !== 'practiced') {
        resume.href = destination.url;
        resume.textContent = choose('接着看：', 'Continue: ') + destination.title;
        resume.hidden = false;
        break;
      }
    }
    control('route').hash = state.mode.value === 'plan' ? 'plan' : 'review';
    control('overview').hidden = false;
    const health = progress.getHealth();
    const badge = root.querySelector('.study-local-badge');
    badge.textContent = health.blocked ? choose('暂不能保存', 'SAVING PAUSED') : health.unavailable ? choose('暂存于本页，请导出', 'IN MEMORY · EXPORT') : choose('仅保存在本地', 'LOCAL ONLY');
    root.querySelector('[data-route-catalog-status]').hidden = Boolean(progress.getCatalog());
    root.querySelectorAll('[data-route-plan]').forEach(button => {
      button.hidden = false;
      button.disabled = progress.getHealth().blocked || !progress.getCatalog()?.notes?.[button.getAttribute('data-note-id')];
    });
  }

  function navigation() {
    const parameters = new URL(location.href).searchParams;
    topic = ['ml', 'post', 'systems', 'algorithms'].includes(parameters.get('topic')) ? parameters.get('topic') : 'ml';
    level = ['start', 'refresh'].includes(parameters.get('level')) ? parameters.get('level') : 'start';
    filterRoutes();
    const requestedSection = location.hash.slice(1);
    const section = Object.hasOwn(headings, requestedSection) ? requestedSection : requestedSection === 'content' && activeSection ? activeSection : 'overview';
    let moveFocus = false;
    root.querySelectorAll('[data-workspace-panel]').forEach(panel => {
      panel.hidden = panel.getAttribute('data-workspace-panel') !== section;
      if (panel.hidden && panel.contains(document.activeElement)) moveFocus = true;
    });
    control('heading').textContent = headings[section][0];
    control('description').textContent = headings[section][1];
    if (section === 'progress') root.querySelector('[data-prep-backups]').open = true;
    root.querySelectorAll('[data-workspace-nav]').forEach(link => {
      if (link.getAttribute('href') === '#' + section) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (activeSection !== section) window.scrollTo({top: 0});
    if (moveFocus) control('heading').focus({preventScroll: true});
    activeSection = section;
    document.querySelectorAll('.topbar [data-language-switch]').forEach(link => {
      const target = new URL(link.href, location.href);
      target.hash = '#' + section;
      target.searchParams.delete('note');
      const note = new URL(location.href).searchParams.get('note');
      if (note && /^note-[a-f0-9]{16}$/.test(note)) target.searchParams.set('note', note);
      target.searchParams.set('topic', topic);
      target.searchParams.set('level', level);
      link.href = target.href;
    });
  }

  function filterRoutes() {
    for (const [kind, value] of [['topic', topic], ['level', level]]) {
      root.querySelectorAll('[data-route-' + kind + ']').forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute('data-route-' + kind) === value)));
    }
    root.querySelectorAll('[data-study-route]').forEach(route => {
      route.hidden = route.getAttribute('data-topic') !== topic || route.getAttribute('data-level') !== level;
    });
    root.querySelector('[data-route-result]').textContent = choose('三个练习，可以跳过，也可以多练几次。', 'Three exercises. Skip one, repeat one, or make them your own.');
    root.querySelector('[data-route-filters]').hidden = false;
  }

  for (const kind of ['topic', 'level']) {
    root.querySelectorAll('[data-route-' + kind + ']').forEach(button => button.addEventListener('click', () => {
      if (kind === 'topic') topic = button.getAttribute('data-route-topic');
      else level = button.getAttribute('data-route-level');
      const target = new URL(location.href);
      target.searchParams.set('topic', topic);
      target.searchParams.set('level', level);
      window.history.replaceState(window.history.state, '', target.href);
      filterRoutes();
      navigation();
    }));
  }
  root.querySelectorAll('[data-route-plan]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled) return;
    location.hash = '#schedule';
    navigation();
    window.dispatchEvent(new CustomEvent('notes:prep-plan-request', {detail: {
      noteId: button.getAttribute('data-note-id'),
      title: button.getAttribute('data-task-title'),
      minutes: Number(button.getAttribute('data-task-minutes'))
    }}));
  }));
  window.addEventListener('notes:prep-changed', render);
  window.addEventListener('notes:prep-catalog', render);
  window.addEventListener('notes:prep-storage', render);
  window.addEventListener('notes:prep-restored', render);
  window.addEventListener('hashchange', navigation);
  window.addEventListener('notes:prep-navigation', navigation);
  filterRoutes();
  render();
  navigation();
})();
