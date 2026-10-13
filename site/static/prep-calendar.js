(function () {
  'use strict';
  const valid = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31') return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const shift = (value, offset) => {
    const date = new Date(value + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const monday = value => shift(value, -(new Date(value + 'T12:00:00Z').getUTCDay() + 6) % 7);
  const week = value => Array.from({length: 7}, (_, index) => shift(monday(value), index));
  if (typeof module === 'object' && module.exports) module.exports = {valid, shift, monday, week};
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-prep-calendar]');
  const progress = window.PreparationProgress;
  if (!root || !progress) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const choose = (zh, en) => chinese ? zh : en;
  const control = name => root.querySelector('[data-calendar-' + name + ']');
  const today = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  let current = monday(today());
  let selected = '';
  const format = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
  const weekday = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-US', {weekday: 'short', timeZone: 'UTC'});
  const fullDate = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-US', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC'});
  function element(tag, text) {
    const result = document.createElement(tag);
    result.textContent = text;
    return result;
  }
  function render() {
    const days = week(current);
    const entries = Object.values(progress.getState().schedule?.sessions || {}).filter(entry => entry.status === 'planned');
    control('heading').textContent = current.slice(0, 4) + ' · ' + format.format(new Date(days[0] + 'T12:00:00Z')) + ' — ' + format.format(new Date(days[6] + 'T12:00:00Z'));
    control('prev').disabled = shift(current, -7) < '1900-01-01';
    control('next').disabled = shift(current, 7) > '2200-12-31';
    const grid = control('days');
    grid.replaceChildren();
    for (const day of days) {
      const date = new Date(day + 'T12:00:00Z');
      const plans = entries.filter(entry => entry.date === day);
      const minutes = plans.reduce((sum, entry) => sum + entry.minutes, 0);
      const button = element('button', '');
      button.type = 'button';
      button.disabled = !valid(day);
      button.setAttribute('aria-pressed', String(day === selected));
      if (day === today()) button.setAttribute('aria-current', 'date');
      const detail = plans.length ? choose(plans.length + ' 次 · ' + minutes + ' 分钟', plans.length + ' planned · ' + minutes + ' min') : choose('留空', 'Free');
      button.setAttribute('aria-label', fullDate.format(date) + ' · ' + detail);
      button.append(element('span', weekday.format(date)), element('strong', String(date.getUTCDate())), element('small', detail));
      button.addEventListener('click', () => {
        selected = day;
        window.dispatchEvent(new CustomEvent('notes:prep-day', {detail: {date: day}}));
        const replacement = [...control('days').children].find(child => child.getAttribute('aria-pressed') === 'true');
        replacement?.focus();
      });
      grid.append(button);
    }
    root.hidden = false;
  }
  for (const [name, offset] of [['prev', -7], ['next', 7]]) control(name).addEventListener('click', () => { current = shift(current, offset); render(); });
  control('today').addEventListener('click', () => { current = monday(today()); render(); });
  window.addEventListener('notes:prep-day', event => {
    if (event.detail?.date !== '' && !valid(event.detail?.date)) return;
    selected = event.detail.date;
    if (selected) current = monday(selected);
    render();
  });
  for (const name of ['notes:prep-changed', 'notes:prep-storage', 'notes:prep-restored']) window.addEventListener(name, render);
  render();
})();
