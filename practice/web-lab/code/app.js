'use strict';

const copy = {
  en: {
    eyebrow: 'BUILD SOMETHING SMALL / 02', title: 'One thing to read next.',
    intro: 'A page, an API, a database. Add a note and follow the request.',
    browser: 'Browser', server: 'Python API', label: 'What are you reading?',
    save: 'Save', list: 'Your reading list', refresh: 'Refresh',
    limit: 'Showing the latest 100 items. Data stays on the server computer.',
    inspect: 'What request just happened?', network: "Open your browser's Network panel for the full request and response.",
    boundary: "Local learning exercise. No accounts or access control. Don't expose this server to the internet or store private data here.",
    empty: 'Nothing here yet. Try adding BERT.', loading: 'Working…', saved: 'Saved.', loaded: 'List refreshed.',
    changed: 'Status saved.', to_read: 'To read', reading: 'Reading', done: 'Read',
    status: 'Reading status for', network_error: 'Could not confirm the result. Refresh the list before trying to save again.',
    invalid_title: 'Use 1–120 characters without line breaks.', title_required: 'Enter a title.',
    invalid_status: 'Choose one of the three reading states.', storage_unavailable: 'Storage is unavailable. Check the server, then refresh.',
    failed: 'The request failed. Inspect the request below.',
  },
  zh: {
    eyebrow: '小项目入门 / 02', title: '下一篇，读什么？',
    intro: '一个页面、一个 API、一份数据库。存一条记录，看看请求去了哪里。',
    browser: '浏览器', server: 'Python 服务', label: '想读哪篇？',
    save: '保存', list: '阅读清单', refresh: '刷新',
    limit: '显示最近添加的 100 条。数据保存在运行服务的电脑上。',
    inspect: '刚才发生了什么请求？', network: '打开浏览器的 Network 面板，可以看完整的请求和响应。',
    boundary: '仅供本机学习。没有账户和访问权限管理，不要开放到公网，也不要存隐私数据。',
    empty: '还没有记录，先加一篇 BERT 试试。', loading: '处理中…', saved: '保存好了。', loaded: '清单已刷新。',
    changed: '状态已保存。', to_read: '待读', reading: '在读', done: '已读',
    status: '阅读状态：', network_error: '暂时无法确认结果。先刷新清单，确认是否已保存，再决定要不要重试。',
    invalid_title: '请输入 1–120 个字符，不要换行。', title_required: '请填写标题。',
    invalid_status: '请选择待读、在读或已读。', storage_unavailable: '暂时无法读写数据库，检查服务后再刷新。',
    failed: '请求没有成功，可以展开下面的请求记录查看。',
  },
};
let language = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : 'en';
let items = [];
let busy = false;
let messageKey = '';
const message = document.querySelector('#message');
const trace = document.querySelector('#trace');

function showMessage(key) {
  messageKey = key;
  message.textContent = copy[language][key] || copy[language].failed;
}

function renderItems() {
  const list = document.querySelector('#notes');
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = copy[language].empty;
    list.append(empty);
  }
  for (const item of items) {
    const row = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = item.title;
    const status = document.createElement('select');
    status.setAttribute('aria-label', `${copy[language].status} ${item.title}`);
    for (const value of ['to_read', 'reading', 'done']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = copy[language][value];
      status.append(option);
    }
    status.value = item.status;
    status.disabled = busy;
    status.addEventListener('change', () => run(async () => {
      const updated = await request(`/api/notes/${item.id}`, 'PATCH', {status: status.value});
      items = items.map(existing => existing.id === item.id ? updated : existing);
      showMessage('changed');
    }));
    row.append(title, status);
    list.append(row);
  }
}

function renderLanguage() {
  document.documentElement.lang = language;
  document.title = language === 'zh' ? '阅读清单 · 本地练习' : 'Reading list · Local lab';
  document.querySelector('#language').textContent = language === 'zh' ? 'EN' : '中文';
  document.querySelector('.flow').setAttribute('aria-label', language === 'zh' ? '请求路径' : 'Request path');
  for (const element of document.querySelectorAll('[data-copy]')) {
    element.textContent = copy[language][element.dataset.copy];
  }
  if (messageKey) showMessage(messageKey);
  renderItems();
}

async function request(path, method = 'GET', data) {
  const options = {method};
  if (data !== undefined) {
    options.headers = {'Content-Type': 'application/json'};
    options.body = JSON.stringify(data);
  }
  trace.textContent = `${method} ${path}\n${data ? JSON.stringify(data) : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  options.signal = controller.signal;
  try {
    const response = await fetch(path, options);
    trace.textContent += `\nHTTP ${response.status}`;
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'failed');
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function run(action) {
  if (busy) return;
  busy = true;
  for (const control of document.querySelectorAll('input, button, select')) control.disabled = true;
  showMessage('loading');
  try {
    await action();
  } catch (error) {
    showMessage(Object.hasOwn(copy[language], error.message) ? error.message : 'network_error');
  } finally {
    busy = false;
    for (const control of document.querySelectorAll('input, button, select')) control.disabled = false;
    renderItems();
  }
}

document.querySelector('#add-note').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    const input = document.querySelector('#title');
    const item = await request('/api/notes', 'POST', {title: input.value});
    items = [item, ...items].slice(0, 100);
    input.value = '';
    showMessage('saved');
  });
});
document.querySelector('#refresh').addEventListener('click', () => run(async () => {
  items = (await request('/api/notes')).items;
  showMessage('loaded');
}));
document.querySelector('#language').addEventListener('click', () => {
  language = language === 'zh' ? 'en' : 'zh';
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  renderLanguage();
});
renderLanguage();
run(async () => {
  items = (await request('/api/notes')).items;
  showMessage('loaded');
});
