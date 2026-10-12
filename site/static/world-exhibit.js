(() => {
  const root = document.querySelector('[data-chronicle]');
  if (!root) return;
  const controls = [...root.querySelectorAll('[data-world-era]')];
  if (!controls.length) return;
  const copies = [...root.querySelectorAll('[data-world-era-copy]')];
  const leaves = [...root.querySelectorAll('[data-world-era-leaves]')];
  const limbs = [...root.querySelectorAll('[data-birth]')];
  const canopy = root.querySelector('.world-canopy');
  const status = root.querySelector('[data-world-era-status]');
  const languageLinks = [...document.querySelectorAll('[data-language-switch]:not([data-world-language])')];
  const dialogLanguage = root.querySelector('[data-world-language]');
  const dialog = root.querySelector('.world-dialog');
  const title = root.querySelector('#world-dialog-title');
  const year = root.querySelector('[data-world-year]');
  const body = root.querySelector('[data-world-dialog-body]');
  const readLink = root.querySelector('[data-world-dialog-read]');
  const closeButton = root.querySelector('[data-world-close]');
  const eraSteps = [...root.querySelectorAll('[data-world-era-step]')];
  const eraPosition = root.querySelector('[data-world-era-position]');
  const chinese = document.documentElement.lang.startsWith('zh');
  const say = (zh, en) => chinese ? zh : en;
  let activeEra = 0;

  function selectEra(index, save) {
    if (!Number.isInteger(index) || index < 0 || index >= controls.length) return;
    activeEra = index;
    controls.forEach((control, position) => control.setAttribute('aria-pressed', String(position === index)));
    copies.forEach(copy => { copy.hidden = Number(copy.dataset.worldEraCopy) !== index; });
    leaves.forEach(group => { group.hidden = Number(group.dataset.worldEraLeaves) !== index; });
    limbs.forEach(limb => { limb.dataset.future = String(index !== 0 && Number(limb.dataset.birth) > index); });
    canopy?.style.setProperty('--world-growth', String(index === 0 ? 1 : .72 + .28 * index / Math.max(1, controls.length - 1)));
    if (status) status.textContent = controls[index].getAttribute('aria-label');
    if (save) {
      const rail = controls[index].parentElement;
      rail.scrollLeft = controls[index].offsetLeft - rail.clientWidth / 2 + controls[index].offsetWidth / 2;
    }
    if (eraPosition) eraPosition.textContent = index === 0 ? say('先看全景，再选年代', 'Overview · choose a period') : `${index} / ${controls.length - 1}`;
    eraSteps.forEach(button => {
      button.disabled = index + Number(button.dataset.worldEraStep) < 0 || index + Number(button.dataset.worldEraStep) >= controls.length;
    });
    if (save) {
      const url = new URL(location.href);
      if (index === 0) url.searchParams.delete('era');
      else url.searchParams.set('era', controls[index].dataset.worldEraKey);
      history.replaceState(history.state, '', url.href);
    }
    languageLinks.forEach(link => {
      const url = new URL(link.href, location.href);
      if (index === 0) url.searchParams.delete('era');
      else url.searchParams.set('era', controls[index].dataset.worldEraKey);
      link.href = url.href;
    });
    window.dispatchEvent(new CustomEvent('world:era-change', {detail:index === 0 ? null : {
      start:Number(controls[index].dataset.eraStart), end:Number(controls[index].dataset.eraEnd)
    }}));
  }

  eraSteps.forEach(button => {
    button.parentElement.hidden = false;
    button.addEventListener('click', () => {
      selectEra(activeEra + Number(button.dataset.worldEraStep), true);
    });
  });

  function restoreEra() {
    const requested = new URL(location.href).searchParams.get('era');
    const index = controls.findIndex(control => control.dataset.worldEraKey === requested);
    selectEra(index >= 0 ? index : 0, false);
  }

  controls.forEach((control, index) => {
    control.disabled = false;
    control.addEventListener('click', () => selectEra(index, true));
    control.addEventListener('keydown', event => {
      const destinations = {ArrowLeft:Math.max(0, index - 1), ArrowRight:Math.min(controls.length - 1, index + 1), Home:0, End:controls.length - 1};
      if (!(event.key in destinations)) return;
      event.preventDefault();
      const next = destinations[event.key];
      controls[next].focus({preventScroll:true});
      controls[next].scrollIntoView({block:'nearest', inline:'nearest'});
      selectEra(next, true);
    });
  });
  window.addEventListener('popstate', restoreEra);
  window.addEventListener('hashchange', restoreEra);
  restoreEra();

  if (!dialog || typeof dialog.showModal !== 'function') return;
  const works = [...root.querySelectorAll('.chronicle-work')].sort((first, second) =>
    Number(first.querySelector('time').textContent) - Number(second.querySelector('time').textContent));
  const workById = new Map(works.map(work => [work.id, work]));
  const readerSteps = [...root.querySelectorAll('[data-world-reader-step]')];
  const readerContext = root.querySelector('[data-world-dialog-context]');
  const readerBack = root.querySelector('[data-world-reader-back]');
  let activeWork = null;
  let readerWorks = [];
  let trail = [];
  let opener = null;
  const workTitle = work => work.querySelector('[data-work-title]').textContent.split(' · ')[0];

  function syncReaderLinks() {
    languageLinks.forEach(link => {
      const url = new URL(link.href, location.href);
      const milestone = new URL(location.href).searchParams.get('milestone');
      if (milestone) url.searchParams.set('milestone', milestone);
      else url.searchParams.delete('milestone');
      link.href = url.href;
    });
    if (dialogLanguage && languageLinks[0]) {
      dialogLanguage.href = languageLinks[0].href;
      dialogLanguage.hidden = false;
    }
  }

  function saveReader(work, opening) {
    const url = new URL(location.href);
    url.searchParams.set('milestone', work.id.slice(6));
    if (opening) history.pushState({...history.state, worldReader:{path:location.pathname, returnURL:location.href}}, '', url.href);
    else history.replaceState(history.state, '', url.href);
    syncReaderLinks();
  }

  function showWork(work, save = false) {
    const content = work?.querySelector('.chronicle-work-body');
    if (!content) return;
    const opening = !dialog.open;
    activeWork = work;
    const topic = new URL(location.href).searchParams.get('topic');
    const era = work.closest('.chronicle-era');
    const sameField = topic && work.dataset.workTopic === topic;
    readerWorks = works.filter(candidate => sameField ? candidate.dataset.workTopic === topic : candidate.closest('.chronicle-era') === era);
    const index = readerWorks.indexOf(work);
    const context = sameField ? root.querySelector(`button[data-topic="${topic}"] strong`).textContent :
      [...era.querySelectorAll('.chronicle-date span')].map(part => part.textContent.trim()).join(' ');
    readerContext.textContent = `${context} · ${index + 1} / ${readerWorks.length}`;
    year.textContent = work.querySelector('time').textContent;
    title.textContent = workTitle(work);
    body.replaceChildren(content.cloneNode(true));
    readLink.setAttribute('href', '#' + work.id);
    readerSteps.forEach(button => {
      const next = readerWorks[index + Number(button.dataset.worldReaderStep)];
      button.disabled = !next;
      button.querySelector('span').textContent = next ? workTitle(next) : say('已经到头了', 'End of this selection');
    });
    readerBack.hidden = trail.length === 0;
    readerBack.textContent = trail.length ? say('← 返回 ', '← Back to ') + workTitle(trail[trail.length - 1]) : '';
    if (opening) dialog.showModal();
    document.documentElement.classList.add('world-dialog-open');
    dialog.scrollTop = 0;
    title.focus({preventScroll:true});
    if (save) saveReader(work, opening);
  }

  function clearReaderURL() {
    const url = new URL(location.href);
    url.searchParams.delete('milestone');
    const state = {...history.state};
    delete state.worldReader;
    history.replaceState(state, '', url.href);
    syncReaderLinks();
  }

  function closeReader() {
    if (history.state?.worldReader?.path === location.pathname) history.back();
    else {
      clearReaderURL();
      dialog.close();
    }
  }

  function restoreReader() {
    const requested = new URL(location.href).searchParams.get('milestone');
    const work = workById.get('event-' + requested);
    if (work) {
      trail = [];
      showWork(work);
    } else {
      if (requested) clearReaderURL();
      if (dialog.open) dialog.close();
    }
    syncReaderLinks();
  }

  root.querySelectorAll('[data-world-peek]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const work = workById.get(link.hash.slice(1));
      if (!work) return;
      event.preventDefault();
      event.stopPropagation();
      opener = link;
      trail = [];
      showWork(work, true);
    });
  });
  readerSteps.forEach(button => button.addEventListener('click', () => {
    const next = readerWorks[readerWorks.indexOf(activeWork) + Number(button.dataset.worldReaderStep)];
    if (next) {
      trail = [];
      showWork(next, true);
    }
  }));
  readerBack.addEventListener('click', () => {
    if (trail.length) showWork(trail.pop(), true);
  });
  closeButton.addEventListener('click', closeReader);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeReader(); });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('world-dialog-open');
    opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.defaultPrevented && !event.button && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const work = workById.get(link.hash.slice(1));
      if (work && link !== readLink) {
        event.preventDefault();
        event.stopPropagation();
        trail.push(activeWork);
        showWork(work, true);
      } else {
        clearReaderURL();
        opener = null;
        dialog.close();
      }
    }
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeReader();
  });
  window.addEventListener('popstate', restoreReader);
  window.addEventListener('hashchange', restoreReader);
  restoreReader();
})();
