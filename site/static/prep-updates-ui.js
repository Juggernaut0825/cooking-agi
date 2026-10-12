(() => {
  'use strict';
  const root = document.querySelector('.study-updates');
  const progress = window.PreparationProgress;
  if (!root || !progress) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const choose = (zh, en) => chinese ? zh : en;
  const language = chinese ? 'zh' : 'en';
  const query = name => root.querySelector('[data-update-' + name + ']');
  const now = () => new Date().toISOString();
  const topicNames = {ml: choose('ML 基础', 'ML foundations'), llm: choose('语言模型', 'Language models'),
    post: choose('后训练', 'Post-training'), systems: choose('工程与系统', 'Systems'), algorithms: choose('算法与编程', 'Algorithms')};
  const statusNames = {queued: choose('待安排', 'In your queue'), available: choose('可选', 'Available'),
    dismissed: choose('已略过', 'Dismissed'), reviewed: choose('已看过更新', 'Update read'), scheduled: choose('已安排', 'Scheduled')};

  function save(records, action) {
    try {
      const result = progress.updateWorkspace(records, action);
      query('message').textContent = result.persisted ? choose('已保存。已有的学习安排不变。', 'Saved. Your existing schedule is unchanged.') : progress.getHealthMessage();
      return true;
    } catch {
      query('message').textContent = choose('暂时没能保存，先去「笔记与备份」保留记录。', 'Could not save. Keep a copy in Notes & backups first.');
      return false;
    }
  }

  function changeNotice(identifier, status) {
    const key = 'notice-' + identifier;
    const previous = progress.getState().workspace?.records?.[key];
    if (!previous) return;
    const records = {[key]: {...previous, status, updatedAt: now()}};
    if (status === 'reviewed') records['seen-' + identifier] = {revision: previous.revision, updatedAt: now()};
    save(records, status + ':' + identifier);
  }

  function button(label, handler) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.disabled = progress.getHealth().blocked;
    element.addEventListener('click', handler);
    return element;
  }

  function render() {
    const state = progress.getState();
    const records = state.workspace?.records || {};
    const catalog = progress.getCatalog();
    const supported = catalog?.updatesVersion === 1;
    const disabled = !supported || progress.getHealth().blocked;
    root.querySelectorAll('[data-update-follow]').forEach(input => {
      input.checked = Boolean(records['follow-' + input.getAttribute('data-update-follow')]?.enabled);
      input.disabled = disabled;
    });
    query('auto').checked = records.preferences?.autoAdd !== false;
    query('auto').disabled = disabled;
    const list = query('list');
    const history = query('history');
    list.replaceChildren();
    history.replaceChildren();
    let visible = 0;
    let queued = 0;
    const notices = Object.entries(records).filter(([key]) => key.startsWith('notice-note-'))
      .sort((left, right) => right[1].updatedAt.localeCompare(left[1].updatedAt));
    for (const [key, notice] of notices) {
      const identifier = key.slice(7);
      const target = progress.getDestination(identifier, {});
      if (!target) continue;
      if (['dismissed', 'reviewed', 'scheduled'].includes(notice.status)) {
        const row = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = statusNames[notice.status] + ' · ' + target.title;
        row.append(label, button(choose('重新打开', 'Reopen'), () => changeNotice(identifier, 'available')));
        history.append(row);
        continue;
      }
      visible++;
      if (notice.status === 'queued') queued++;
      const card = document.createElement('article');
      const kind = document.createElement('p');
      kind.className = 'study-kicker';
      kind.textContent = (notice.kind === 'new' ? choose('新笔记', 'NEW NOTE') : choose('内容更新', 'NEW MATERIAL')) + ' · ' + statusNames[notice.status];
      const title = document.createElement('h3');
      const link = document.createElement('a');
      link.href = target.url;
      link.textContent = target.title;
      title.append(link);
      const summary = document.createElement('p');
      summary.textContent = catalog.notes[identifier]?.update?.summary?.[language] ||
        choose('来自你关注的主题。可以直接阅读，或添加到学习安排。', 'New in a topic you follow. Read it first, then decide whether to schedule it.');
      const actions = document.createElement('div');
      actions.className = 'study-step-actions';
      const read = document.createElement('a');
      read.href = target.url;
      read.textContent = choose('打开笔记 ↗', 'Read note ↗');
      actions.append(read, button(choose('安排时间', 'Plan a session'), () => {
        location.hash = '#schedule';
        window.dispatchEvent(new CustomEvent('notes:prep-plan-request', {detail: {noteId: identifier, title: target.title.slice(0, 160), minutes: 25}}));
      }));
      if (notice.status !== 'queued') actions.append(button(choose('加入待安排', 'Add to queue'), () => changeNotice(identifier, 'queued')));
      if (notice.kind === 'updated') actions.append(button(choose('标记更新已读', 'Mark update as read'), () => changeNotice(identifier, 'reviewed')));
      actions.append(button(choose('先略过', 'Dismiss'), () => changeNotice(identifier, 'dismissed')));
      card.append(kind, title, summary, actions);
      list.append(card);
    }
    for (const event of (state.workspace?.history || []).slice(0, 20)) {
      const row = document.createElement('li');
      const [action, identifier, flag] = event.action.split(':');
      let label = action === 'content-sync' ? choose('收到内容更新', 'Content updates received') :
        action === 'auto-add' ? choose('自动加入新笔记：', 'Auto-add new notes: ') + (flag === 'on' || identifier === 'on' ? choose('开启', 'on') : choose('关闭', 'off')) :
        action === 'follow' ? (topicNames[identifier] || identifier) + ' · ' + (flag === 'on' ? choose('已关注', 'followed') : choose('取消关注', 'unfollowed')) :
        (statusNames[action] || choose('设置有变化', 'Settings changed')) + (identifier ? ' · ' + (progress.getDestination(identifier, {})?.title || identifier) : '');
      row.textContent = new Date(event.at).toLocaleString(chinese ? 'zh-CN' : 'en-US') + ' · ' + label;
      history.append(row);
    }
    query('count').textContent = choose(visible + ' 条待查看，其中 ' + queued + ' 篇已加入待安排', queued + ' queued · ' + visible + ' to consider. No need to do it all now.');
    query('empty').hidden = visible > 0;
    if (!supported) query('empty').textContent = choose('更新目录暂时不可用。已有安排和备份仍可使用，稍后刷新再试。', 'The update catalog is unavailable. Your schedule and backups still work. Refresh later to try again.');
    else query('empty').textContent = choose('暂无新内容。关注主题后，新发布的笔记会显示在这里。已有笔记请到「选择学习路线」查看。', 'Nothing new to work through. Future notes in followed topics appear here; existing notes stay in the study routes.');
    const overview = document.querySelector('[data-update-overview]');
    if (overview) overview.textContent = !supported ? choose('目录暂时不可用', 'Catalog unavailable') : visible ? choose(visible + ' 条待查看', visible + ' to consider') : choose('暂无新内容 · 管理关注', 'Up to date · Manage topics');
  }

  root.querySelectorAll('[data-update-follow]').forEach(input => input.addEventListener('change', () => {
    const topic = input.getAttribute('data-update-follow');
    save({['follow-' + topic]: {enabled: input.checked, edition: progress.getCatalog().edition, updatedAt: now()}}, 'follow:' + topic + ':' + (input.checked ? 'on' : 'off'));
    render();
  }));
  query('auto').addEventListener('change', () => {
    save({preferences: {autoAdd: query('auto').checked, updatedAt: now()}}, 'auto-add:' + (query('auto').checked ? 'on' : 'off'));
    render();
  });
  for (const event of ['notes:prep-changed', 'notes:prep-catalog', 'notes:prep-storage', 'notes:prep-restored']) window.addEventListener(event, render);
  render();
})();
