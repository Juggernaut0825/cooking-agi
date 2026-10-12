(() => {
  'use strict';
  const api = window.PrepProgressStore;
  if (!api) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const language = chinese ? 'zh' : 'en';
  const choose = (zh, en) => chinese ? zh : en;
  let storage;
  try { storage = window.localStorage; } catch {
    storage = {getItem() { throw Error('storage'); }, setItem() { throw Error('storage'); }};
  }
  const store = api.createStore(storage);
  const dashboard = document.querySelector('[data-prep-dashboard]');
  const editor = document.querySelector('[data-prep-note]');
  const now = () => new Date().toISOString();
  const labels = {
    planned: choose('未开始', 'Not started'), learning: choose('在学', 'Working on it'),
    revisit: choose('想再看一次', 'Revisit'), practiced: choose('这轮练过了', 'Practiced this round')
  };
  let catalog = null;
  let pendingImport = null;
  let importAttempt = 0;
  let previousImport = store.recovery();
  let positionTimer;
  let editorError = '';
  const updateBanner = document.querySelector('[data-prep-update-note]');
  const pendingFields = new Set();
  const base = new URL(window.SITE.prefix, location.href);

  function healthMessage() {
    const health = store.health();
    if (health.fault === 'missing') return choose('主记录不见了，但浏览器里还有恢复记录。已暂停保存，请在下方选择一份预览并恢复。',
      'The main record is missing, but recovery copies remain. Saving is paused. Preview a copy below to restore it.');
    if (health.blocked) return choose('现有进度格式无法安全读取，已停止写入。请先导出原文件保留；新版本文件请用更新后的站点打开。',
      'Existing progress cannot be read safely; writing is disabled. Export the original file first. A newer-format file needs an updated site.');
    if (health.fault === 'limits') return choose('本页记录与其他标签页的记录合起来超过了容量限制，已暂停写入。先导出本页进度，再到另一个标签页单独备份；目前没有把两份记录合成一份。',
      'This page and another tab exceed the limit when combined; writes are paused. Export this page, then back up the other tab separately. The two copies have not been combined.');
    if (health.unavailable) return choose('浏览器暂时无法持久保存。本页改动仍可导出，离开前请备份。',
      'Browser storage is unavailable. Changes can still be exported from this page; back up before leaving.');
    if (health.snapshotFault) return choose('当前进度已保存，但恢复副本未能写入。请导出文件备份。', 'Current progress is saved, but a recovery copy could not be written. Export a file backup.');
    return choose('已自动保存在此浏览器。不会上传，也不会自动跨设备同步。',
      'Saved automatically in this browser. Not uploaded or synced across devices.');
  }

  function syncCatalog() {
    if (!catalog || !window.PrepContentUpdates || store.health().blocked) return;
    const changes = window.PrepContentUpdates.reconcile(store.read(), catalog, now());
    if (Object.keys(changes).length) {
      try { store.updateWorkspace(changes, Object.keys(changes).some(key => key.startsWith('notice-')) ? 'content-sync' : ''); }
      catch { return; }
    }
    renderUpdateBanner();
  }

  function renderUpdateBanner() {
    if (!updateBanner || !editor) return;
    const identifier = editor.dataset.prepNote;
    const notice = store.read().workspace?.records?.['notice-' + identifier];
    updateBanner.hidden = notice?.kind !== 'updated' || !['available', 'queued'].includes(notice?.status);
    updateBanner.querySelector('[data-prep-update-summary]').textContent = catalog?.notes?.[identifier]?.update?.summary?.[language] || '';
    updateBanner.querySelector('[data-prep-update-read]').disabled = store.health().blocked;
  }

  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], {type: name.endsWith('.txt') ? 'text/plain;charset=utf-8' : 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function editorState() {
    if (!editor) return;
    const entry = store.read().entries[editor.dataset.prepNote];
    const status = editor.querySelector('[data-prep-status]');
    const memo = editor.querySelector('[data-prep-memo]');
    if (document.activeElement !== status && !pendingFields.has('status')) status.value = entry?.status || 'planned';
    if (document.activeElement !== memo && !pendingFields.has('note')) memo.value = entry?.note || '';
    status.disabled = memo.disabled = store.health().blocked;
    editorFeedback();
  }

  function editorFeedback() {
    editor.querySelector('[data-prep-note-message]').textContent = editorError || healthMessage();
    const backup = editor.querySelector('[data-prep-note-export]');
    backup.hidden = !editorError && !store.health().unavailable && !store.health().blocked;
    backup.textContent = editorError ? choose('导出未保存的备注（TXT）', 'Export the unsaved note (TXT)') :
      choose('先导出进度，再离开本页', 'Export progress before leaving this page');
  }

  function currentPosition() {
    const headings = [...document.querySelectorAll('.article-body h2[id], .article-body h3[id]')];
    const passed = headings.filter(heading => heading.getClientRects().length && heading.getBoundingClientRect().top <= 180);
    const anchor = passed.length ? passed[passed.length - 1].id : location.hash.slice(1);
    return /^[\p{L}\p{N}_:.-]{1,180}$/u.test(anchor) && document.getElementById(anchor)
      ? {anchor, language} : undefined;
  }

  function saveEditor(field) {
    if (!editor) return;
    const positionOnly = field === 'position';
    if (!positionOnly) pendingFields.add(field);
    const identifier = editor.dataset.prepNote;
    const previous = store.read().entries[identifier];
    const position = currentPosition();
    if (positionOnly && (!previous || !position ||
        (previous.position?.anchor === position.anchor && previous.position?.language === language))) return;
    const changes = previous ? {updatedAt: now()} : {status: 'planned', note: '', updatedAt: now()};
    changes.title = editor.dataset.prepTitle;
    if (!positionOnly && pendingFields.has('status')) changes.status = editor.querySelector('[data-prep-status]').value;
    if (!positionOnly && pendingFields.has('note')) changes.note = editor.querySelector('[data-prep-memo]').value;
    if (position) changes.position = position;
    try {
      store.updateEntry(identifier, changes);
      if (!positionOnly) syncCatalog();
      if (!positionOnly) { pendingFields.clear(); editorError = ''; }
    } catch {
      if (!positionOnly) editorError = choose('这次改动没能保存，可能已达到容量限制。请先复制备注或导出 TXT；进度 JSON 不包含这次未保存的改动。',
        'This change was not saved; the record or size limit may have been reached. Copy the note or export TXT. The progress JSON does not include this unsaved change.');
    }
    editorFeedback();
  }

  function destination(identifier, entry) {
    const page = catalog?.notes?.[identifier]?.pages?.[language];
    if (!page) return null;
    const url = new URL(page.url, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
    if (entry.position?.language === language) url.hash = entry.position.anchor;
    return {url: url.href, title: page.title};
  }

  function renderDashboard() {
    if (!dashboard) return;
    const state = store.read();
    dashboard.querySelector('[data-prep-storage]').textContent = healthMessage();
    const library = Object.entries(state.workspace?.records || {});
    const savedCount = library.filter(([key, value]) => key.startsWith('bookmark-') && value.saved).length;
    const positionCount = library.filter(([key, value]) => key.startsWith('position-') && value.anchor).length;
    dashboard.querySelector('[data-prep-library-summary]').textContent = choose(
      '这份备份还包含 ' + savedCount + ' 篇收藏、' + positionCount + ' 处阅读位置，以及学习台的设置。',
      'This backup also includes ' + savedCount + ' bookmarks, ' + positionCount + ' reading positions, and your dashboard settings.');
    const list = dashboard.querySelector('[data-prep-records]');
    const resume = dashboard.querySelector('[data-prep-continue]');
    list.replaceChildren();
    resume.hidden = true;
    const entries = Object.entries(state.entries).sort((left, right) =>
      Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt));
    let unavailable = 0;
    for (const [identifier, entry] of entries) {
      const target = destination(identifier, entry);
      if (!target) { unavailable++; continue; }
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = target.url;
      link.textContent = target.title;
      const status = document.createElement('small');
      status.textContent = labels[entry.status];
      row.append(link, status);
      if (entry.note) {
        const memo = document.createElement('p');
        memo.textContent = entry.note;
        row.append(memo);
      }
      list.append(row);
      if (resume.hidden && entry.status !== 'practiced') {
        resume.textContent = choose('接着看：', 'Continue: ') + target.title;
        resume.href = target.url;
        resume.hidden = false;
      }
    }
    dashboard.querySelector('[data-prep-empty]').hidden = entries.length > 0;
    const unknown = dashboard.querySelector('[data-prep-unknown]');
    unknown.hidden = !unavailable;
    unknown.textContent = catalog ? choose(
      unavailable + ' 条记录在当前站点没有对应页面，仍完整保留在备份中。',
      unavailable + ' records have no page in this version. They are kept in full in backups.') : choose(
      '目录暂时未加载，记录仍在。导出备份不受影响。',
      'The catalog is unavailable. Records are still here and can be exported.');
    dashboard.querySelector('[data-prep-recovery]').hidden = !previousImport;
    const copies = dashboard.querySelector('[data-prep-snapshots]');
    copies.replaceChildren();
    for (const snapshot of store.snapshots()) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = new Date(snapshot.at).toLocaleString(chinese ? 'zh-CN' : 'en-US');
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.textContent = choose('预览并恢复', 'Preview & restore');
      preview.disabled = store.health().blocked && store.health().fault !== 'missing';
      preview.addEventListener('click', () => readFile({size: 0, text: async () => api.encode(snapshot.state)}));
      const exportCopy = document.createElement('button');
      exportCopy.type = 'button';
      exportCopy.textContent = choose('下载这份', 'Download copy');
      exportCopy.addEventListener('click', () => download(api.encode(snapshot.state), 'agi-prep-progress-recovery.json'));
      row.append(label, preview, exportCopy);
      copies.append(row);
    }
    if (!copies.children.length) {
      const row = document.createElement('li');
      row.textContent = choose('保存学习记录后，这里会留下恢复副本。', 'Recovery copies appear after you save records.');
      copies.append(row);
    }
    if (pendingImport) renderPreview();
    window.dispatchEvent(new Event('notes:prep-changed'));
  }

  function renderPreview() {
    const policy = dashboard.querySelector('[data-prep-policy]').value;
    let result;
    try {
      result = api.merge(store.read(), pendingImport, policy);
    } catch {
      dashboard.querySelector('[data-prep-confirm]').disabled = true;
      dashboard.querySelector('[data-prep-preview-text]').textContent = choose(
        '当前记录有变化，暂时无法安全合并这份备份，可能会超过容量限制。你刚保存的记录不受影响；可以取消导入，先导出当前进度。',
        'Current records have changed and this backup cannot be merged safely, possibly because the combined size or record count is too large. Your saved changes are unaffected. Cancel the import and export your current progress first.');
      return false;
    }
    dashboard.querySelector('[data-prep-confirm]').disabled = false;
    const unknown = catalog ? Object.keys(pendingImport.entries).filter(identifier => !catalog.notes[identifier]).length : 0;
    dashboard.querySelector('[data-prep-preview-text]').textContent = choose(
      '将新增 ' + result.added + ' 条；' + result.conflicts + ' 条与现有记录不同，本次会替换 ' + result.replaced + ' 条。未知章节 ' + unknown + ' 条也会保留。模式：' + (result.state.mode.value === 'plan' ? '按计划学习' : '快速复习') + '。',
      'Add ' + result.added + ' records; ' + result.conflicts + ' differ from current records, with ' + result.replaced + ' replacements. ' + unknown + ' unknown chapters will also be kept. Mode: ' + (result.state.mode.value === 'plan' ? 'Study at your pace' : 'Quick review') + '.') + choose(
      ' 学习安排新增 ' + (result.addedSessions || 0) + ' 次；' + (result.conflictingSessions || 0) + ' 次记录不同，将替换 ' + (result.replacedSessions || 0) + ' 次。',
      ' Sessions: ' + (result.addedSessions || 0) + ' added; ' + (result.conflictingSessions || 0) + ' differ, with ' + (result.replacedSessions || 0) + ' replacements.') + choose(
      ' 设置、收藏或更新记录有 ' + (result.workspaceConflicts || 0) + ' 条不同，同样按上面的选项处理。',
      ' ' + (result.workspaceConflicts || 0) + ' settings, bookmarks or update records differ; the selected policy applies to them too.') +
      (store.health().fault === 'missing' ? choose(' 主记录为空：确认后将恢复整份备份。', ' The main record is missing: confirming restores this entire backup.') : '');
    return true;
  }

  function importError(error) {
    if (error.message === 'version') return choose('这份文件的版本暂不支持。请保留原文件，并用相应版本的站点打开；当前进度没有变化。',
      'This file version is not supported. Keep the original and open it with a compatible site version. Current progress is unchanged.');
    return choose('没能读取这份进度文件。请选择本站导出的 JSON（最多 2 MiB）；当前进度没有变化。',
      'Could not read this progress file. Choose a JSON exported by this site (up to 2 MiB). Current progress is unchanged.');
  }

  async function readFile(file) {
    const attempt = ++importAttempt;
    pendingImport = null;
    dashboard.querySelector('[data-prep-preview]').hidden = true;
    const message = dashboard.querySelector('[data-prep-message]');
    try {
      if (!file || file.size > api.MAX_BYTES) throw Error('limits');
      const imported = api.parse(await file.text());
      if (attempt !== importAttempt) return;
      api.merge(store.read(), imported);
      pendingImport = imported;
      dashboard.querySelector('[data-prep-policy]').value = 'keep-local';
      dashboard.querySelector('[data-prep-preview]').hidden = false;
      message.textContent = '';
      renderPreview();
      dashboard.querySelector('[data-prep-confirm]').focus();
    } catch (error) { if (attempt === importAttempt) message.textContent = importError(error); }
  }

  window.PreparationProgress = {
    library: window.PrepLibraryState?.create(store, storage),
    storageKey: api.KEY,
    getState() { return store.read(); },
    getCatalog() { return catalog; },
    getHealth() { return store.health(); },
    getHealthMessage: healthMessage,
    getDestination: destination,
    updateWorkspace(records, action) {
      const result = store.updateWorkspace(records, action);
      syncCatalog();
      renderDashboard();
      renderUpdateBanner();
      return result;
    },
    updateSession(identifier, changes) {
      store.updateSession(identifier, changes);
      syncCatalog();
      renderDashboard();
    },
    addSessions(records) {
      const result = store.addSessions(records);
      syncCatalog();
      renderDashboard();
      return result;
    },
    getMode() { return store.read().mode.value; },
    setMode(value) {
      try { store.setMode(value, now()); } catch {}
      renderDashboard();
    }
  };

  if (editor) {
    updateBanner?.querySelector('[data-prep-update-read]').addEventListener('click', () => {
      const identifier = editor.dataset.prepNote;
      const notice = store.read().workspace?.records?.['notice-' + identifier];
      if (!notice) return;
      try {
        store.updateWorkspace({['notice-' + identifier]: {...notice, status: 'reviewed', updatedAt: now()},
          ['seen-' + identifier]: {revision: notice.revision, updatedAt: now()}}, 'reviewed:' + identifier);
        renderUpdateBanner();
      } catch { editorError = choose('没能保存，请先导出备份。', 'Could not save. Export a backup first.'); editorFeedback(); }
    });
    editor.hidden = false;
    editorState();
    editor.querySelector('[data-prep-status]').addEventListener('change', () => saveEditor('status'));
    editor.querySelector('[data-prep-memo]').addEventListener('input', () => saveEditor('note'));
    editor.querySelector('[data-prep-memo]').addEventListener('blur', editorState);
    editor.querySelector('[data-prep-note-export]').addEventListener('click', () => {
      try {
        if (editorError) download(editor.dataset.prepTitle + '\n' + labels[editor.querySelector('[data-prep-status]').value] + '\n\n' + editor.querySelector('[data-prep-memo]').value, 'agi-prep-progress-unsaved-note.txt');
        else download(store.serialize(), 'agi-prep-progress-' + new Date().toISOString().slice(0, 10) + '.json');
      }
      catch { editor.querySelector('[data-prep-note-message]').textContent = choose('暂时无法导出。请先复制备注，不要关闭本页。', 'Export failed. Copy your notes before closing this page.'); }
    });
    window.addEventListener('scroll', () => {
      clearTimeout(positionTimer);
      positionTimer = setTimeout(() => saveEditor('position'), 300);
    }, {passive: true});
    window.addEventListener('pagehide', () => { clearTimeout(positionTimer); saveEditor('position'); });
  }

  if (dashboard) {
    dashboard.hidden = false;
    const fileInput = dashboard.querySelector('[data-prep-file]');
    const message = dashboard.querySelector('[data-prep-message]');
    dashboard.querySelector('[data-prep-export]').addEventListener('click', () => {
      try {
        download(store.serialize(), 'agi-prep-progress-' + new Date().toISOString().slice(0, 10) + '.json');
        message.textContent = choose('备份已生成。文件含你的私人备注，请自行妥善保管，不要提交到公开仓库。',
          'Backup created. It contains your private notes; keep it safe and out of public repositories.');
      } catch { message.textContent = choose('暂时无法导出，请勿清理浏览器数据。', 'Export failed; do not clear browser data.'); }
    });
    dashboard.querySelector('[data-prep-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) readFile(file);
      fileInput.value = '';
    });
    const drop = dashboard.querySelector('[data-prep-drop]');
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-dragging'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('is-dragging');
      if (event.dataTransfer.files.length === 1) readFile(event.dataTransfer.files[0]);
      else message.textContent = choose('请一次拖入一份备份。', 'Drop one backup at a time.');
    });
    dashboard.querySelector('[data-prep-policy]').addEventListener('change', renderPreview);
    dashboard.querySelector('[data-prep-cancel]').addEventListener('click', () => {
      importAttempt++;
      pendingImport = null;
      dashboard.querySelector('[data-prep-preview]').hidden = true;
      dashboard.querySelector('[data-prep-import]').focus();
    });
    dashboard.querySelector('[data-prep-confirm]').addEventListener('click', () => {
      if (!pendingImport || !renderPreview()) return;
      try {
        const policy = dashboard.querySelector('[data-prep-policy]').value;
        if (store.health().fault === 'missing') {
          store.restoreMissing(pendingImport);
          pendingImport = null;
          dashboard.querySelector('[data-prep-preview]').hidden = true;
          syncCatalog();
          renderDashboard();
          message.textContent = choose('已恢复这份备份。请再导出一份，保存在浏览器以外。', 'Backup restored. Export a copy to keep outside this browser too.');
          window.dispatchEvent(new Event('notes:prep-restored'));
          return;
        }
        const result = store.applyImport(pendingImport, policy);
        previousImport = result.previous;
        pendingImport = null;
        syncCatalog();
        dashboard.querySelector('[data-prep-preview]').hidden = true;
        renderDashboard();
        message.textContent = choose('已合并。导入前的记录也可以另存一份。', 'Merged. You can also export the records from before this import.') +
          (!result.persisted ? ' ' + healthMessage() : '');
        window.dispatchEvent(new Event('notes:prep-restored'));
        dashboard.querySelector('[data-prep-export]').focus();
      } catch (error) { message.textContent = importError(error); }
    });
    dashboard.querySelector('[data-prep-recovery]').addEventListener('click', () => {
      if (previousImport) download(api.encode(previousImport), 'agi-prep-progress-before-import.json');
    });
    renderDashboard();
    function openBackups() {
      if (location.hash === '#progress') dashboard.querySelector('[data-prep-backups]').open = true;
    }
    window.addEventListener('hashchange', openBackups);
    openBackups();
  }
  if (dashboard || editor) fetch(new URL('static/prep-progress-catalog.json', base)).then(response => {
    if (!response.ok) throw Error('catalog');
    return response.json();
  }).then(value => {
    catalog = value;
    if (dashboard && window.PreparationProgress.library) {
      try { window.PreparationProgress.library.read(Object.fromEntries(Object.entries(catalog.notes || {}).map(([identifier, note]) => [note.source, identifier]))); } catch {}
    }
    syncCatalog();
    renderDashboard();
    window.dispatchEvent(new Event('notes:prep-catalog'));
  }).catch(() => renderDashboard());
  window.addEventListener('storage', event => {
    if (event.key === api.KEY || event.key === null) {
      store.read();
      syncCatalog();
      editorState();
      renderUpdateBanner();
      renderDashboard();
      window.dispatchEvent(new Event('notes:prep-storage'));
    }
  });
})();
