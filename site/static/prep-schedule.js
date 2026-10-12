(() => {
  'use strict';
  const root = document.querySelector('[data-prep-schedule]');
  const progress = window.PreparationProgress;
  if (!root || !progress?.updateSession) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const language = chinese ? 'zh' : 'en';
  const choose = (zh, en) => chinese ? zh : en;
  const control = name => root.querySelector('[data-' + name + ']');
  const form = control('schedule-form');
  const checkin = control('schedule-checkin');
  const dateFormat = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-US', {year: 'numeric', month: 'short', day: 'numeric', weekday: 'short'});
  let editing = null;
  let recording = null;
  let baseline = null;
  let returnFocus = null;
  let selectedDay = '';
  let requestedNote = new URL(window.location.href).searchParams.get('note');
  const localDate = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const formatDate = value => dateFormat.format(new Date(value + 'T12:00:00'));
  const sessions = () => progress.getState().schedule?.sessions || {};

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31') return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function newIdentifier() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return 'session-' + [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function showFeedback(message) {
    const health = progress.getHealth();
    control('schedule-message').textContent = message + (health.blocked || health.unavailable ? ' ' + progress.getHealthMessage() : '');
  }

  function save(identifier, changes) {
    try {
      progress.updateSession(identifier, {...changes, updatedAt: new Date().toISOString()});
      return true;
    } catch {
      return false;
    }
  }

  function errorText() {
    return choose('这次还没保存。可能已到 300 次安排或备份大小的上限，也可能原文件暂不兼容。先导出备份；表单内容还在。',
      'Not saved. The 300-session or backup-size limit may have been reached, or existing data may be incompatible. Export a backup; your form is still here.');
  }

  function closeForms(focus = true) {
    form.hidden = checkin.hidden = true;
    editing = recording = baseline = null;
    if (focus) {
      const address = new URL(window.location.href);
      if (address.searchParams.has('note')) {
        address.searchParams.delete('note');
        window.history.replaceState(window.history.state, '', address.href);
        window.dispatchEvent(new Event('notes:prep-navigation'));
      }
      if (returnFocus?.isConnected) returnFocus.focus();
      else control('schedule-add').focus();
    }
  }

  function fillNotes(selected = '') {
    const select = control('session-note');
    select.replaceChildren();
    const empty = node('option', choose('不关联，自己安排', 'No note—use my own task'));
    empty.value = '';
    select.append(empty);
    const catalog = progress.getCatalog();
    const search = (control('session-search')?.value || '').trim().toLocaleLowerCase();
    const notes = Object.entries(catalog?.notes || {}).filter(([identifier, item]) => item.pages?.[language] &&
      (identifier === selected || ((!catalog.updatesVersion || item.topics?.length) &&
        (!search || (item.pages[language].title + ' ' + item.source).toLocaleLowerCase().includes(search)))));
    notes.sort((left, right) => left[1].pages[language].title.localeCompare(right[1].pages[language].title, language));
    for (const [identifier, item] of notes) {
      const option = node('option', item.pages[language].title);
      option.value = identifier;
      select.append(option);
    }
    if (selected && !notes.some(([identifier]) => identifier === selected)) {
      const option = node('option', choose('保留原来的笔记链接（当前目录未找到）', 'Keep the original note (not in this catalog)'));
      option.value = selected;
      select.append(option);
    }
    select.value = selected;
  }

  function openPlan(identifier, trigger) {
    const entry = identifier ? sessions()[identifier] : null;
    if (identifier && (!entry || entry.status === 'cancelled')) return;
    closeForms(false);
    editing = identifier;
    baseline = entry ? JSON.stringify(entry) : null;
    returnFocus = trigger;
    control('schedule-form-title').textContent = identifier ? choose('调整这次安排', 'Edit this session') : choose('安排一次学习', 'Plan a session');
    control('session-title').value = entry?.title || '';
    control('session-date').value = entry?.date || selectedDay || localDate();
    control('session-minutes').value = String(entry?.minutes || 30);
    if (control('session-search')) control('session-search').value = '';
    fillNotes(entry?.noteId || '');
    control('schedule-form-error').textContent = '';
    control('schedule-message').textContent = '';
    form.hidden = false;
    control('session-title').focus();
  }

  function openCheckin(identifier, trigger) {
    const entry = sessions()[identifier];
    if (!entry || entry.status === 'cancelled') return;
    closeForms(false);
    recording = identifier;
    baseline = JSON.stringify(entry);
    returnFocus = trigger;
    control('checkin-task').textContent = entry.title;
    control('checkin-date').value = entry.completedOn || localDate();
    control('checkin-date').max = localDate();
    control('checkin-minutes').value = entry.actualMinutes === null ? '' : String(entry.actualMinutes);
    control('checkin-error').textContent = '';
    control('schedule-message').textContent = '';
    checkin.hidden = false;
    control('checkin-date').focus();
  }

  function prefillNote() {
    if (!requestedNote || !progress.getCatalog()) return;
    const identifier = requestedNote;
    requestedNote = null;
    if (!/^note-[a-f0-9]{16}$/.test(identifier) || !form.hidden || !checkin.hidden || progress.getHealth().blocked) return;
    const note = progress.getCatalog().notes?.[identifier]?.pages?.[language];
    if (!note) return;
    openPlan(null, control('schedule-add'));
    control('session-note').value = identifier;
    control('session-title').value = note.title.slice(0, 160);
  }

  function changedElsewhere(identifier, errorControl) {
    if (identifier && JSON.stringify(sessions()[identifier]) !== baseline) {
      errorControl.textContent = choose('这次安排刚在另一处改过。请先取消编辑，再打开查看最新记录；没有覆盖你的表单。',
        'This session changed elsewhere. Cancel and reopen it to review the latest record. Your form has not overwritten it.');
      return true;
    }
    return false;
  }

  function action(label, callback, title) {
    const button = node('button', label);
    button.type = 'button';
    button.disabled = progress.getHealth().blocked;
    button.setAttribute('aria-label', label + ': ' + title);
    button.addEventListener('click', () => callback(button));
    return button;
  }

  function changeStatus(identifier, status, expected, button) {
    const current = sessions()[identifier];
    if (!current || JSON.stringify(current) !== JSON.stringify(expected)) {
      render();
      showFeedback(choose('这次安排刚在另一处改过。已显示最新记录，请确认后再操作。',
        'This session changed elsewhere. The latest record is now shown; review it before trying again.'));
      control('schedule-filter').focus();
      return;
    }
    if (!save(identifier, {status, completedOn: '', actualMinutes: null})) {
      showFeedback(errorText());
      return;
    }
    render();
    showFeedback(status === 'cancelled' ? choose('已移除。在「已移除的安排」里可以放回来。', 'Removed. You can restore it from the Removed view.') :
      choose('已恢复为待完成，可以重新调整日期。', 'Back in your plan. Continue whenever it suits you.'));
    if (!button.isConnected) control('schedule-filter').focus();
  }

  function row(identifier, entry) {
    const item = node('li', undefined, 'prep-session-row');
    item.append(node('strong', entry.title, 'prep-session-title'));
    const detail = entry.status === 'done'
      ? choose('完成于 ', 'Studied ') + formatDate(entry.completedOn) + (entry.actualMinutes === null ? choose(' · 未记录时长', ' · duration not recorded') : choose(' · 实际学习 ', ' · focused for ') + entry.actualMinutes + choose(' 分钟', ' min'))
      : entry.status === 'cancelled' ? choose('已移除 · 可以重新安排', 'Removed · available to restore')
        : choose('计划学习 ', 'Planned focus: ') + entry.minutes + choose(' 分钟', ' min');
    item.append(node('p', detail, 'prep-session-meta'));
    if (entry.noteId) {
      const target = progress.getDestination(entry.noteId, {});
      if (target) {
        const link = node('a', target.title + ' →', 'prep-session-note');
        link.href = target.url;
        item.append(link);
      }
    }
    const actions = node('div', undefined, 'prep-session-actions');
    if (entry.status === 'cancelled') actions.append(action(choose('放回计划', 'Restore'), button => changeStatus(identifier, 'planned', entry, button), entry.title));
    else {
      actions.append(action(entry.status === 'done' ? choose('修改记录', 'Edit check-in') : choose('记录本次学习', 'Record a session'), button => openCheckin(identifier, button), entry.title));
      actions.append(action(choose('调整安排', 'Edit plan'), button => openPlan(identifier, button), entry.title));
      actions.append(entry.status === 'done'
        ? action(choose('撤销完成', 'Undo check-in'), button => changeStatus(identifier, 'planned', entry, button), entry.title)
        : action(choose('移除', 'Remove'), button => changeStatus(identifier, 'cancelled', entry, button), entry.title));
    }
    item.append(actions);
    return item;
  }

  function render() {
    const all = Object.entries(sessions());
    const planned = all.filter(([, entry]) => entry.status === 'planned').length;
    const done = all.filter(([, entry]) => entry.status === 'done').length;
    control('schedule-summary').textContent = choose('待完成 ' + planned + ' 次 · 已完成 ' + done + ' 次', planned + ' planned · ' + done + ' recorded');
    const filter = control('schedule-filter').value;
    const entries = all.filter(([, entry]) => (!selectedDay || entry.date === selectedDay) && (filter === 'all' ? entry.status !== 'cancelled' : entry.status === filter));
    control('schedule-day-filter').hidden = !selectedDay;
    control('schedule-day-label').textContent = selectedDay ? choose('计划日期：', 'Planned date: ') + formatDate(selectedDay) : '';
    entries.sort((left, right) => left[1].date.localeCompare(right[1].date) || left[0].localeCompare(right[0]));
    const groups = new Map();
    for (const [identifier, entry] of entries) {
      if (!groups.has(entry.date)) groups.set(entry.date, []);
      groups.get(entry.date).push([identifier, entry]);
    }
    const list = control('schedule-list');
    list.replaceChildren();
    for (const [date, entriesOnDate] of groups) {
      const day = node('section', undefined, 'prep-day');
      const heading = node('div', undefined, 'prep-day-heading');
      const time = node('time', formatDate(date));
      time.dateTime = date;
      heading.append(time, node('small', choose('计划日期', 'Planned date')));
      const tasks = node('ul');
      for (const [identifier, entry] of entriesOnDate) tasks.append(row(identifier, entry));
      day.append(heading, tasks);
      list.append(day);
    }
    control('schedule-empty').hidden = entries.length > 0;
    control('schedule-empty').textContent = selectedDay
      ? choose('这一天没有符合筛选条件的安排。可以切换筛选，或查看所有日期。', 'No sessions match this day and filter. Change the filter or show all dates.')
      : filter === 'done' ? choose('还没有完成记录。学完后，在对应安排里点「记录本次学习」，也可以补记之前的学习。', 'Record a session when you finish. You can also log one from an earlier day.')
      : filter === 'cancelled' ? choose('还没有移除过安排。', 'No removed sessions.')
      : choose('当前没有待完成的安排。点「安排一次学习」，填写练习、日期和时长。', 'Pick a day and one small task. No need to fill the whole week.');
    const health = progress.getHealth();
    control('schedule-add').disabled = health.blocked;
    control('schedule-fields').disabled = control('checkin-fields').disabled = health.blocked;
    if (health.blocked || health.unavailable) control('schedule-message').textContent = progress.getHealthMessage();
  }

  control('schedule-add').addEventListener('click', event => openPlan(null, event.currentTarget));
  control('schedule-cancel').addEventListener('click', () => closeForms());
  control('checkin-cancel').addEventListener('click', () => closeForms());
  control('schedule-filter').addEventListener('change', render);
  control('schedule-clear-day').addEventListener('click', () => {
    selectedDay = '';
    render();
    window.dispatchEvent(new CustomEvent('notes:prep-day', {detail: {date: ''}}));
    control('schedule-filter').focus();
  });
  window.addEventListener('notes:prep-day', event => {
    const date = event.detail?.date;
    if (date !== '' && !validDate(date)) return;
    selectedDay = date;
    if (date && !event.detail.preserveFilter) control('schedule-filter').value = 'planned';
    render();
  });
  window.addEventListener('notes:prep-plan-request', event => {
    const task = event.detail;
    if (!task || progress.getHealth().blocked || !progress.getCatalog()?.notes?.[task.noteId]?.pages?.[language]) return;
    if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 160 || !Number.isInteger(task.minutes) || task.minutes < 1 || task.minutes > 1440) return;
    if (!form.hidden || !checkin.hidden) {
      showFeedback(choose('这里还有一份没保存的内容。请先保存或取消，再从路线库加入练习。', 'You have an open draft. Save or cancel it before adding an exercise from a route.'));
      (!form.hidden ? control('session-title') : control('checkin-date')).focus();
      return;
    }
    openPlan(null, control('schedule-add'));
    control('session-title').value = task.title;
    control('session-minutes').value = String(task.minutes);
    control('session-note').value = task.noteId;
  });
  control('session-note').addEventListener('change', () => {
    const title = control('session-title');
    const note = progress.getCatalog()?.notes?.[control('session-note').value]?.pages?.[language];
    if (!title.value.trim() && note) title.value = note.title.slice(0, 160);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const error = control('schedule-form-error');
    error.textContent = '';
    if (!form.reportValidity() || changedElsewhere(editing, error)) return;
    const title = control('session-title').value.trim();
    const date = control('session-date').value;
    const minutes = Number(control('session-minutes').value);
    if (!title || title.length > 160 || !validDate(date) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      error.textContent = choose('写一件想做的事，选好日期，再填 1–1440 的整数分钟。', 'Enter a task, a valid date, and a whole number of minutes from 1 to 1440.');
      return;
    }
    const changes = {title, date, minutes, noteId: control('session-note').value};
    if (!editing) Object.assign(changes, {status: 'planned', completedOn: '', actualMinutes: null});
    let identifier;
    try { identifier = editing || newIdentifier(); } catch { error.textContent = errorText(); return; }
    if (!save(identifier, changes)) { error.textContent = errorText(); return; }
    control('schedule-filter').value = sessions()[identifier].status;
    if (selectedDay) {
      selectedDay = date;
      window.dispatchEvent(new CustomEvent('notes:prep-day', {detail: {date, preserveFilter: true}}));
    }
    render();
    closeForms();
    showFeedback(choose('安排已保存，可随时修改日期和时长。', 'Session saved. Change it whenever your plans change.'));
  });
  checkin.addEventListener('submit', event => {
    event.preventDefault();
    const error = control('checkin-error');
    error.textContent = '';
    if (!checkin.reportValidity() || changedElsewhere(recording, error)) return;
    const completedOn = control('checkin-date').value;
    const input = control('checkin-minutes').value.trim();
    const actualMinutes = input === '' ? null : Number(input);
    if (!validDate(completedOn) || completedOn > localDate() || (actualMinutes !== null && (!Number.isInteger(actualMinutes) || actualMinutes < 0 || actualMinutes > 1440))) {
      error.textContent = choose('请选择今天或之前的学习日期；时长可以留空，或填 0–1440 的整数分钟。', 'Choose today or an earlier date. Leave time blank or enter a whole number from 0 to 1440 minutes.');
      return;
    }
    if (!save(recording, {status: 'done', completedOn, actualMinutes})) { error.textContent = errorText(); return; }
    control('schedule-filter').value = 'done';
    render();
    closeForms();
    showFeedback(choose('记下了。这次花了多久都算，下次按你的节奏来。', 'Recorded. Pick up again when it works for you.'));
  });
  for (const event of ['notes:prep-restored', 'notes:prep-storage', 'notes:prep-changed']) window.addEventListener(event, render);
  window.addEventListener('notes:prep-catalog', () => { fillNotes(control('session-note').value); render(); prefillNote(); });
  control('session-search')?.addEventListener('input', () => fillNotes(control('session-note').value));
  root.hidden = false;
  render();
  prefillNote();
})();
