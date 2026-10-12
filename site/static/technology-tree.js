(() => {
  const tree = document.querySelector('[data-technology-tree]');
  if (!tree) return;
  const chronicle = tree.querySelector('[data-chronicle]');
  const panels = [...tree.querySelectorAll('[data-tree-panel]')];
  const links = [...tree.querySelectorAll('[data-tree-branch]')];
  const languageLinks = [...document.querySelectorAll('[data-language-switch]')];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'overview';
  let redraw = () => {};

  function showBranch(name, focus) {
    const panel = panels.find(item => item.dataset.treePanel === name);
    if (!panel) return false;
    selected = name;
    panels.forEach(item => { item.hidden = item !== panel; });
    links.forEach(link => {
      if (link.dataset.treeBranch === name) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    tree.dataset.selected = name;
    if (focus) {
      panel.focus({preventScroll: true});
      const rectangle = panel.getBoundingClientRect();
      if (rectangle.top < 70 || rectangle.top > innerHeight * .8) {
        panel.scrollIntoView({behavior: motion.matches ? 'auto' : 'smooth', block: 'start'});
      }
    }
    redraw();
    return true;
  }

  function restoreBranch() {
    const hash = location.hash.slice(1);
    let identifier = hash;
    try { identifier = decodeURIComponent(hash); }
    catch { identifier = ''; }
    const target = document.getElementById(identifier);
    const parentPanel = target && target.closest('[data-tree-panel]');
    showBranch(parentPanel ? parentPanel.dataset.treePanel : 'overview', false);
    languageLinks.forEach(link => { link.hash = hash; });
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#branch-"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const name = link.hash.slice('#branch-'.length);
    if (!showBranch(name, true)) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    window.dispatchEvent(new Event('hashchange'));
  });
  window.addEventListener('hashchange', restoreBranch);
  window.addEventListener('popstate', restoreBranch);
  restoreBranch();

  if (chronicle) return;

  const canvas = tree.querySelector('canvas');
  const context = canvas && canvas.getContext('2d');
  if (!context) return;
  const scene = tree.querySelector('.tree-scene');
  const curves = [
    {name: 'rl', points: [[500,616],[495,510],[455,380],[500,91]]},
    {name: 'language', points: [[490,455],[420,360],[270,320],[220,217]]},
    {name: 'vision', points: [[485,380],[590,300],[690,245],[780,189]]},
    {name: 'robotics', points: [[490,460],[650,445],[725,440],[820,413]]},
    {name: 'systems', points: [[490,510],[350,465],[245,475],[180,441]]}
  ];
  let seed = 733;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pointAt(points, fraction) {
    const remaining = 1 - fraction;
    return [0, 1].map(axis => remaining ** 3 * points[0][axis] + 3 * remaining ** 2 * fraction * points[1][axis] + 3 * remaining * fraction ** 2 * points[2][axis] + fraction ** 3 * points[3][axis]);
  }
  const particles = [];
  function addTwig(origin, angle, length, name, fraction, depth) {
    const bend = (random() - .5) * .6;
    const end = [origin[0] + Math.cos(angle + bend) * length, origin[1] + Math.sin(angle + bend) * length];
    const controls = [origin,
      [origin[0] + Math.cos(angle) * length * .3, origin[1] + Math.sin(angle) * length * .3],
      [end[0] - Math.cos(angle + bend) * length * .3, end[1] - Math.sin(angle + bend) * length * .3], end];
    const count = Math.ceil(length * .7);
    for (let index = 0; index < count; index++) {
      const position = pointAt(controls, index / count);
      particles.push({name, horizontal: position[0] + (random() - .5) * 2,
        vertical: position[1] + (random() - .5) * 2, radius: .3 + random() * .6,
        phase: random() * 6.28, bright: random() * .5, fraction});
    }
    if (depth > 0) {
      addTwig(pointAt(controls, .58), angle - .55, length * .48, name, fraction, depth - 1);
      addTwig(pointAt(controls, .8), angle + .5, length * .4, name, fraction, depth - 1);
    }
  }
  curves.forEach(curve => {
    for (let index = 0; index < 230; index++) {
      const fraction = random();
      const position = pointAt(curve.points, fraction);
      const spread = 4 + 16 * Math.sin(fraction * Math.PI);
      particles.push({name: curve.name, horizontal: position[0] + (random() - .5) * spread, vertical: position[1] + (random() - .5) * spread, radius: .35 + random() * 1.1, phase: random() * 6.28, bright: random(), fraction});
    }
    for (let twig = 1; twig < 8; twig++) {
      const fraction = .12 + twig / 10;
      const origin = pointAt(curve.points, fraction);
      const next = pointAt(curve.points, fraction + .02);
      const side = twig % 2 ? 1 : -1;
      const angle = Math.atan2(next[1] - origin[1], next[0] - origin[0]) + side * (.48 + random() * .32);
      addTwig(origin, angle, 38 + random() * 52, curve.name, fraction, 1);
    }
  });
  for (let root = 0; root < 7; root++) {
    const spread = (root - 3) * 45;
    for (let index = 0; index < 35; index++) {
      const fraction = index / 35;
      particles.push({name: 'roots', horizontal: 500 + spread * fraction, vertical: 616 + 52 * Math.sin(fraction * Math.PI / 2), radius: .35 + random() * .7, phase: random() * 6.28, bright: random() * .3});
    }
  }
  for (let index = 0; index < 90; index++) {
    particles.push({name: 'background', horizontal: 60 + random() * 880, vertical: 20 + random() * 630, radius: .3 + random() * .6, phase: random() * 6.28, bright: .1});
  }
  let frame = 0;
  let visible = true;
  let ink = '240,240,240';
  let lastTime = 0;
  function draw(time = 0) {
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    context.clearRect(0, 0, width, height);
    particles.forEach(particle => {
      const active = selected === 'overview' || selected === particle.name || particle.name === 'roots';
      const shimmer = motion.matches ? .8 : .68 + .22 * Math.sin(time * .0007 + particle.phase);
      const pulse = !motion.matches && selected === particle.name ? Math.max(0, 1 - Math.abs(particle.fraction - (time * .00016 % 1)) * 12) : 0;
      const opacity = Math.min(.9, (active ? .65 : .18) * shimmer + particle.bright * .1 + pulse * .35);
      const horizontal = particle.horizontal * width / 1000;
      const vertical = particle.vertical * height / 700;
      if (active && particle.bright > .94) {
        const glow = context.createRadialGradient(horizontal, vertical, 0, horizontal, vertical, 7);
        glow.addColorStop(0, `rgba(${ink},${opacity * .7})`);
        glow.addColorStop(1, `rgba(${ink},0)`);
        context.fillStyle = glow;
        context.fillRect(horizontal - 7, vertical - 7, 14, 14);
      }
      context.fillStyle = `rgba(${ink},${opacity})`;
      context.beginPath();
      context.arc(horizontal, vertical, particle.radius, 0, Math.PI * 2);
      context.fill();
    });
  }
  function animate(time) {
    frame = 0;
    if (time - lastTime > 45) { draw(time); lastTime = time; }
    if (visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(animate);
  }
  function refresh() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    draw();
    if (visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(animate);
  }
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(scene.clientWidth * ratio);
    canvas.height = Math.round(scene.clientHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    refresh();
  }
  function theme() {
    ink = document.documentElement.dataset.theme === 'light' ? '38,43,47' : '240,240,240';
    refresh();
  }
  redraw = refresh;
  new ResizeObserver(resize).observe(scene);
  new MutationObserver(theme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; refresh(); }, {threshold: .05}).observe(scene);
  document.addEventListener('visibilitychange', refresh);
  motion.addEventListener('change', refresh);
  theme();
  resize();
  tree.classList.add('tree-canvas-ready');
})();
