(() => {
  function constrain(camera, viewport, scene) {
    const scale = Math.max(.12, Math.min(3, camera.scale));
    const limit = (offset, size, space) => size * scale <= space
      ? (space - size * scale) / 2
      : Math.max(space - size * scale - 70, Math.min(70, offset));
    return {scale, x:limit(camera.x, scene.width, viewport.width), y:limit(camera.y, scene.height, viewport.height)};
  }

  function fit(viewport, scene) {
    const scale = Math.min((viewport.width - 28) / scene.width, (viewport.height - 28) / scene.height, 1);
    return constrain({scale, x:0, y:0}, viewport, scene);
  }

  function zoom(camera, factor, point, viewport, scene) {
    const scale = Math.max(.12, Math.min(3, camera.scale * factor));
    const ratio = scale / camera.scale;
    return constrain({scale, x:point.x - (point.x - camera.x) * ratio,
      y:point.y - (point.y - camera.y) * ratio}, viewport, scene);
  }

  function focus(point, viewport, scene) {
    const scale = Math.min(1, Math.max(.72, (viewport.width - 28) / scene.width));
    return constrain({scale, x:viewport.width / 2 - point.x * scale,
      y:viewport.height / 2 - point.y * scale}, viewport, scene);
  }

  if (typeof module !== 'undefined') module.exports = {constrain, fit, zoom, focus};
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-world-grove]');
  if (!root) return;
  const chronicle = root.closest('[data-chronicle]');
  const viewportElement = root.querySelector('[data-grove-viewport]');
  const plane = root.querySelector('[data-grove-camera]');
  const scenes = [...root.querySelectorAll('[data-grove-scene]')];
  const select = root.querySelector('[data-grove-select]');
  const current = root.querySelector('[data-grove-current]');
  const home = root.querySelector('[data-grove-home]');
  const back = root.querySelector('[data-grove-back]');
  const fitButton = root.querySelector('[data-grove-fit]');
  const earliest = root.querySelector('[data-grove-earliest]');
  const latest = root.querySelector('[data-grove-latest]');
  const touch = root.querySelector('[data-grove-touch]');
  const expand = root.querySelector('[data-grove-expand]');
  const zoomLabel = root.querySelector('[data-grove-zoom-label]');
  const status = root.querySelector('[data-grove-status]');
  const zoomButtons = [...root.querySelectorAll('[data-grove-zoom]')];
  const nodeNav = root.querySelector('[data-grove-node-nav]');
  const nodeSteps = [...root.querySelectorAll('[data-grove-step]')];
  const position = root.querySelector('[data-grove-position]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const chinese = document.documentElement.lang.startsWith('zh');
  const say = (zh, en) => chinese ? zh : en;
  let sceneElement = scenes[0];
  let camera = {x:0, y:0, scale:1};
  let scene = {width:1400, height:760};
  let viewport = {width:1, height:1};
  let frame = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let touchActive = false;
  let era = null;
  let cursor = 0;
  const pointers = new Map();

  function draw() {
    plane.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    const percent = Math.round(camera.scale * 100);
    zoomLabel.textContent = percent + '%';
    root.dataset.groveScale = camera.scale.toFixed(3);
    zoomButtons.forEach(button => { button.disabled = Number(button.dataset.groveZoom) > 0 ? camera.scale >= 2.999 : camera.scale <= .121; });
  }

  function move(next, animate = true) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    const destination = constrain(next, viewport, scene);
    if (!animate || reduced.matches || chronicle.classList.contains('world-motion-paused')) {
      camera = destination;
      draw();
      return;
    }
    const start = {...camera};
    const started = performance.now();
    function step(now) {
      const portion = Math.min(1, Math.max(0, (now - started) / 240));
      const amount = 1 - (1 - portion) ** 3;
      camera = {x:start.x + (destination.x - start.x) * amount,
        y:start.y + (destination.y - start.y) * amount,
        scale:start.scale + (destination.scale - start.scale) * amount};
      draw();
      frame = portion < 1 ? requestAnimationFrame(step) : null;
    }
    frame = requestAnimationFrame(step);
  }

  function pointOf(leaf) {
    return {x:Number(leaf.dataset.groveX), y:Number(leaf.dataset.groveY)};
  }

  function selectedLeaves() {
    return [...sceneElement.querySelectorAll('[data-grove-year]')];
  }

  function jumpToLeaf(leaf) {
    if (leaf) {
      updateNodeNavigation(selectedLeaves().indexOf(leaf));
      move(focus(pointOf(leaf), viewport, scene));
    }
  }

  function updateNodeNavigation(index) {
    const leaves = selectedLeaves();
    cursor = Math.max(0, Math.min(leaves.length - 1, index));
    nodeNav.hidden = leaves.length === 0;
    position.textContent = `${cursor + 1} / ${leaves.length}`;
    nodeSteps.forEach(button => { button.disabled = !leaves[cursor + Number(button.dataset.groveStep)]; });
    leaves.forEach((leaf, leafIndex) => leaf.classList.toggle('is-current', leafIndex === cursor));
  }

  function selectTopic(name) {
    window.dispatchEvent(new CustomEvent('world:select-topic', {detail:name}));
  }

  function markPeriod(moveCamera) {
    const leaves = selectedLeaves();
    leaves.forEach(leaf => {
      const year = Number(leaf.dataset.groveYear);
      leaf.classList.toggle('is-other-period', Boolean(era && (year < era.start || year > era.end)));
    });
    const matching = leaves.filter(leaf => !leaf.classList.contains('is-other-period'));
    root.querySelectorAll('[data-grove-field]').forEach(link => {
      const field = scenes.find(item => item.dataset.groveScene === link.dataset.groveField);
      const present = [...field.querySelectorAll('[data-grove-year]')].some(leaf => !era ||
        Number(leaf.dataset.groveYear) >= era.start && Number(leaf.dataset.groveYear) <= era.end);
      link.classList.toggle('is-other-period', !present);
    });
    if (era && leaves.length) {
      status.textContent = matching.length ? say(`这一时段收录了 ${matching.length} 个节点；淡色节点属于其他时期。`, `${matching.length} selected milestones in this period; dimmed milestones belong to other periods.`)
        : say('这条线还没有收录这个时段的节点，不代表当时没有进展。', 'This field has no selected milestones for this period yet. That is a coverage gap, not an absence of progress.');
      if (moveCamera && matching.length) jumpToLeaf(matching[0]);
    } else status.textContent = leaves.length
      ? say(`这条线收录了 ${leaves.length} 个节点，从下向上读。`, `${leaves.length} selected milestones. Read upward from the earliest.`)
      : say('点一个枝干，继续向里看。', 'Open a branch to explore its history.');
  }

  function restore() {
    const requested = chronicle.dataset.topic || 'all';
    const next = scenes.find(item => item.dataset.groveScene === requested) || scenes[0];
    if (next === sceneElement && root.dataset.ready === 'true') return;
    sceneElement = next;
    scenes.forEach(item => { item.hidden = item !== next; });
    scene = {width:Number(next.dataset.groveWidth), height:Number(next.dataset.groveHeight)};
    plane.style.width = scene.width + 'px';
    plane.style.height = scene.height + 'px';
    select.value = next.dataset.groveScene;
    home.disabled = select.value === 'all';
    back.disabled = home.disabled;
    current.textContent = home.disabled ? say('全景', 'Overview') : next.dataset.groveTitle;
    earliest.hidden = latest.hidden = home.disabled;
    root.dataset.ready = 'true';
    root.dataset.groveTopic = select.value;
    updateNodeNavigation(0);
    const start = viewport.width < 680 ? pointOf(selectedLeaves()[0] || {dataset:{groveX:700, groveY:scene.height - 380}}) : {x:700, y:scene.height - 380};
    move(home.disabled ? fit(viewport, scene) : focus(start, viewport, scene), false);
    markPeriod(true);
  }

  function resize() {
    const box = viewportElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const center = {x:(viewport.width / 2 - camera.x) / camera.scale, y:(viewport.height / 2 - camera.y) / camera.scale};
    viewport = {width:box.width, height:box.height};
    const selected = selectedLeaves()[cursor];
    const target = viewport.width < 680 && selected ? pointOf(selected) : center;
    move(root.dataset.ready === 'true' && sceneElement.dataset.groveScene !== 'all'
      ? focus(target, viewport, scene) : fit(viewport, scene), false);
  }

  root.querySelectorAll('[data-grove-field]').forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    selectTopic(link.dataset.groveField);
  }));
  select.disabled = fitButton.disabled = touch.disabled = false;
  expand.disabled = false;
  expand.addEventListener('click', () => {
    const expanded = root.classList.toggle('grove-expanded');
    expand.textContent = expanded ? say('收起画布', 'Smaller canvas') : say('扩大画布', 'Larger canvas');
    expand.setAttribute('aria-expanded', String(expanded));
    resize();
  });
  select.addEventListener('change', () => selectTopic(select.value));
  home.addEventListener('click', () => selectTopic('all'));
  back.addEventListener('click', () => selectTopic('all'));
  fitButton.addEventListener('click', () => move(fit(viewport, scene)));
  earliest.addEventListener('click', () => jumpToLeaf(selectedLeaves()[0]));
  latest.addEventListener('click', () => jumpToLeaf(selectedLeaves().at(-1)));
  nodeSteps.forEach(button => button.addEventListener('click', () => jumpToLeaf(selectedLeaves()[cursor + Number(button.dataset.groveStep)])));
  zoomButtons.forEach(button => button.addEventListener('click', () => move(zoom(camera,
    Number(button.dataset.groveZoom) > 0 ? 1.35 : 1 / 1.35, {x:viewport.width / 2, y:viewport.height / 2}, viewport, scene))));
  touch.addEventListener('click', () => {
    touchActive = !touchActive;
    touch.setAttribute('aria-pressed', String(touchActive));
    viewportElement.classList.toggle('is-touch-active', touchActive);
    status.textContent = touchActive ? say('触屏拖动已开启，双指可缩放；再点一次关闭。', 'Touch navigation is on. Drag or pinch; press again to return to page scrolling.') : say('已恢复页面滚动。', 'Page scrolling restored.');
  });
  viewportElement.addEventListener('wheel', event => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const box = viewportElement.getBoundingClientRect();
    move(zoom(camera, Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * .006),
      {x:event.clientX - box.left, y:event.clientY - box.top}, viewport, scene), false);
  }, {passive:false});
  viewportElement.addEventListener('keydown', event => {
    if (event.target !== viewportElement || event.altKey || event.ctrlKey || event.metaKey) return;
    const shifts = {ArrowLeft:[70, 0], ArrowRight:[-70, 0], ArrowUp:[0, 70], ArrowDown:[0, -70]};
    if (shifts[event.key]) {
      event.preventDefault();
      const [horizontal, vertical] = shifts[event.key];
      move({...camera, x:camera.x + horizontal, y:camera.y + vertical});
    } else if (['+', '=', '-', '0', 'Escape'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Escape') selectTopic('all');
      else if (event.key === '0') move(fit(viewport, scene));
      else move(zoom(camera, event.key === '-' ? 1 / 1.35 : 1.35,
        {x:viewport.width / 2, y:viewport.height / 2}, viewport, scene));
    }
  });
  viewportElement.addEventListener('focusin', event => {
    const leaf = event.target.closest('[data-grove-x]');
    if (!leaf || event.target.matches(':active')) return;
    const rect = leaf.getBoundingClientRect();
    const box = viewportElement.getBoundingClientRect();
    if (rect.left < box.left || rect.right > box.right || rect.top < box.top || rect.bottom > box.bottom) {
      if (leaf.hasAttribute('data-grove-year')) jumpToLeaf(leaf);
      else move(focus(pointOf(leaf), viewport, scene));
    }
  });
  function gesturePoints() {
    const values = [...pointers.values()];
    if (values.length < 2) return {center:values[0], distance:0};
    return {center:{x:(values[0].x + values[1].x) / 2, y:(values[0].y + values[1].y) / 2},
      distance:Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)};
  }
  viewportElement.addEventListener('pointerdown', event => {
    if (event.button > 0 || event.pointerType === 'touch' && !touchActive) return;
    const box = viewportElement.getBoundingClientRect();
    pointers.set(event.pointerId, {x:event.clientX - box.left, y:event.clientY - box.top});
    const points = gesturePoints();
    gesture = {...points, camera:{...camera}, moved:false};
    if (!event.target.closest('a')) viewportElement.focus({preventScroll:true});
  });
  viewportElement.addEventListener('pointermove', event => {
    if (!gesture || !pointers.has(event.pointerId)) return;
    const box = viewportElement.getBoundingClientRect();
    pointers.set(event.pointerId, {x:event.clientX - box.left, y:event.clientY - box.top});
    const points = gesturePoints();
    const horizontal = points.center.x - gesture.center.x;
    const vertical = points.center.y - gesture.center.y;
    if (!gesture.moved && Math.hypot(horizontal, vertical) < 5 && points.distance === gesture.distance) return;
    gesture.moved = true;
    viewportElement.setPointerCapture(event.pointerId);
    viewportElement.classList.add('is-dragging');
    const enlarged = gesture.distance > 0 ? zoom(gesture.camera, points.distance / gesture.distance, gesture.center, viewport, scene) : gesture.camera;
    move({...enlarged, x:enlarged.x + horizontal, y:enlarged.y + vertical}, false);
  });
  function release(event) {
    if (gesture?.moved) suppressClickUntil = performance.now() + 350;
    pointers.delete(event.pointerId);
    if (viewportElement.hasPointerCapture(event.pointerId)) viewportElement.releasePointerCapture(event.pointerId);
    gesture = pointers.size ? {...gesturePoints(), camera:{...camera}, moved:false} : null;
    viewportElement.classList.remove('is-dragging');
  }
  viewportElement.addEventListener('pointerup', release);
  viewportElement.addEventListener('dragstart', event => event.preventDefault());
  viewportElement.addEventListener('pointercancel', release);
  viewportElement.addEventListener('pointerleave', event => {
    if (!viewportElement.hasPointerCapture(event.pointerId)) release(event);
  });
  viewportElement.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const leaf = event.target.closest('[data-grove-year]');
    if (leaf) updateNodeNavigation(selectedLeaves().indexOf(leaf));
  }, true);
  window.addEventListener('world:era-change', event => {
    const changed = era?.start !== event.detail?.start || era?.end !== event.detail?.end;
    era = event.detail;
    markPeriod(changed);
  });
  window.addEventListener('hashchange', restore);
  window.addEventListener('popstate', restore);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame !== null) { cancelAnimationFrame(frame); frame = null; }
  });
  reduced.addEventListener?.('change', () => move(camera, false));
  resize();
  restore();
  const chosen = chronicle.querySelector('[data-world-era][aria-pressed="true"]');
  if (chosen?.dataset.eraStart) era = {start:Number(chosen.dataset.eraStart), end:Number(chosen.dataset.eraEnd)};
  markPeriod(Boolean(era));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(viewportElement);
  else window.addEventListener('resize', resize);
})();
