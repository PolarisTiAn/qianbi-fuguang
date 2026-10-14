'use strict';

const points = [
  { title: '从一重山，走向另一重山', short: '山峦相叠', category: '山水', x: .49, y: .20, image: 1,
    text: '先从画面的上方看起。山体的轮廓相互叠接，浅绿、赭红与留白交错。试着沿山脊移动目光，再向下寻找建筑，你会发现画面用高低与遮挡，把许多景物组织在一起。', prompt: '细看一下：你能找到几层相互遮挡的山？' },
  { title: '在殿宇之间，读一座院落', short: '殿宇院落', category: '建筑', x: .48, y: .63, image: 2,
    text: '视线移向中部的建筑群。屋顶、围墙与院落相互衔接，层层展开。先看单座建筑，再看它与周围山体的关系：画中的空间既有可以辨认的局部，也需要我们把不同视角连接起来。', prompt: '细看一下：屋顶与围墙如何围合出院落？' },
  { title: '让目光，沿道路前行', short: '道路相连', category: '路径', x: .26, y: .78, image: 3,
    text: '山水之间的路径，把原本分散的景物串联起来。沿着较浅的带状区域观察，留意道路如何绕过山体、靠近建筑。把视线当作脚步，你可以用自己的节奏，重新组织这幅画的观看顺序。', prompt: '试着找一条路：它从哪里来，又向哪里延伸？' },
  { title: '山间的建筑，不止一处', short: '山间殿阁', category: '建筑', x: .72, y: .50, image: 4,
    text: '把目光从中部移向右侧，会看到更多被山体分隔的建筑。它们的尺度与排列并不完全相同。对照两个区域的屋顶、院落和山势，看看重复的建筑元素怎样形成不同的画面节奏。', prompt: '对照一下：这里的建筑与中部院落有什么不同？' },
  { title: '细读山水间的疏与密', short: '疏密之间', category: '构图', x: .13, y: .40, image: 5,
    text: '从左侧局部开始，比较密集的轮廓与相对舒展的色块。有的地方建筑和山线聚在一起，有的地方留出较大空隙。疏密变化帮助目光停顿，也让细节丰富的长幅画面仍然保有层次。', prompt: '停一停：你的目光最先落在哪一处？' },
  { title: '斑驳之中，也有时间', short: '岁月肌理', category: '肌理', x: .89, y: .72, image: 6,
    text: '放大画面右侧，留意颜色深浅、表面斑驳与轮廓的变化。这些都是当前图像中可以观察到的状态。仅凭照片不能确定每处变化的成因，也不能据此推断原色；保留原图，是进一步理解的起点。', prompt: '想一想：哪些细节看得见，哪些判断还需要资料？' }
];
// A single left-to-right route drives both the reading map and 3D picking.
points.sort((a, b) => a.x - b.x);
window.QianbiPoints = points.map(({ x, y }) => ({ x, y }));
const $ = selector => document.querySelector(selector);
const viewer = $('#viewer');
const stage = $('#art-stage');
const layout = $('.explorer-layout');
const mural = $('#mural-image');
const visited = new Set();
const naturalWidth = 3286;
const naturalHeight = 955;
let baseScale = 1;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let selected = 0;
let tourStep = -1;
const route = points.map((_, index) => index);
const stationNames = points.map((point, index) => `第 ${index + 1} 站 · ${point.short}`);
const pointers = new Map();
let priorSize = { width: 0, height: 0 };

points.forEach((point, index) => {
  const marker = document.createElement('button');
  marker.className = 'marker';
  marker.style.left = `${point.x * 100}%`;
  marker.style.top = `${point.y * 100}%`;
  marker.textContent = String(index + 1).padStart(2, '0');
  marker.setAttribute('aria-label', `观察点${index + 1}：${point.short}`);
  marker.setAttribute('aria-pressed', 'false');
  marker.addEventListener('click', () => { exitTour(false); selectPoint(index); });
  $('#map-markers').append(marker);

  const chip = document.createElement('button');
  chip.className = 'hotspot-chip';
  chip.setAttribute('aria-pressed', 'false');
  chip.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${point.short}`;
  chip.addEventListener('click', () => { exitTour(false); selectPoint(index); });
  $('#hotspot-list').append(chip);
  const mapPoint = marker.cloneNode(true);
  mapPoint.className = 'locator-point';
  mapPoint.setAttribute('aria-label', `定位第${index + 1}处：${point.short}`);
  mapPoint.addEventListener('click', () => { exitTour(false); selectPoint(index); });
  $('#locator-map').append(mapPoint);
});

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function renderPosition() {
  const scale = baseScale * zoom;
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  offsetX = width <= viewer.clientWidth ? (viewer.clientWidth - width) / 2 : clamp(offsetX, viewer.clientWidth - width, 0);
  offsetY = height <= viewer.clientHeight ? (viewer.clientHeight - height) / 2 : clamp(offsetY, viewer.clientHeight - height, 0);
  stage.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
  stage.style.setProperty('--inverse-scale', String(1 / scale));
  $('#zoom-value').value = `${zoom.toFixed(1)}×`;
  $('#zoom-out').disabled = zoom <= 1.001;
  $('#zoom-in').disabled = zoom >= 3.999;
  const box = $('#locator-window');
  box.style.left = `${clamp(-offsetX / width, 0, 1) * 100}%`;
  box.style.top = `${clamp(-offsetY / height, 0, 1) * 100}%`;
  box.style.width = `${Math.min(1, viewer.clientWidth / width) * 100}%`;
  box.style.height = `${Math.min(1, viewer.clientHeight / height) * 100}%`;
}

function measureViewer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  const previousScale = baseScale * zoom;
  const centerX = priorSize.width ? (priorSize.width / 2 - offsetX) / previousScale : naturalWidth / 2;
  const centerY = priorSize.height ? (priorSize.height / 2 - offsetY) / previousScale : naturalHeight / 2;
  baseScale = Math.min(width / naturalWidth, height / naturalHeight);
  stage.style.width = `${naturalWidth}px`;
  stage.style.height = `${naturalHeight}px`;
  offsetX = width / 2 - centerX * baseScale * zoom;
  offsetY = height / 2 - centerY * baseScale * zoom;
  priorSize = { width, height };
  renderPosition();
}

function zoomAt(nextZoom, x = viewer.clientWidth / 2, y = viewer.clientHeight / 2) {
  const newZoom = clamp(nextZoom, 1, 4);
  const ratio = newZoom / zoom;
  offsetX = x - (x - offsetX) * ratio;
  offsetY = y - (y - offsetY) * ratio;
  zoom = newZoom;
  renderPosition();
}

function resetView() {
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  renderPosition();
}

function selectPoint(index, focusImage = true) {
  selected = index;
  const point = points[index];
  layout.classList.remove('detail-closed');
  visited.add(index);
  $('#detail-kicker').textContent = `观看线索 / ${String(index + 1).padStart(2, '0')}`;
  $('#detail-title').textContent = point.title;
  $('#detail-category').textContent = `${point.category} · 画面观察`;
  $('#detail-description').textContent = point.text;
  $('#look-prompt').textContent = point.prompt;
  $('#detail-image').src = `assets/detail-${point.image}.webp`;
  $('#detail-image').alt = `${point.short}的壁画局部`;
  $('#reading-position').textContent = `第 ${String(index + 1).padStart(2, '0')} 处 / 共 06 处`;
  $('#reading-current').textContent = point.short;
  $('#point-prev').disabled = index === 0;
  $('#point-next').hidden = index === points.length - 1;
  $('#reading-color').hidden = index !== points.length - 1;
  $('#view-count').textContent = `已看 ${visited.size} / 6`;
  document.querySelectorAll('.marker').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(i === index));
    button.classList.toggle('visited', visited.has(i));
  });
  document.querySelectorAll('.locator-point').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  document.querySelectorAll('.hotspot-chip').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  $('#explorer-status').textContent = `${point.short}。${point.title}。${point.text}`;
  if (focusImage) {
    measureViewer();
    zoom = window.innerWidth <= 600 ? 3.2 : 2.2;
    offsetX = viewer.clientWidth / 2 - point.x * naturalWidth * baseScale * zoom;
    offsetY = viewer.clientHeight / 2 - point.y * naturalHeight * baseScale * zoom;
    renderPosition();
  }
}

function showTourStep() {
  selectPoint(route[tourStep]);
  $('#tour-title').textContent = stationNames[tourStep];
  $('#tour-progress').textContent = `${tourStep + 1} / ${route.length}`;
  $('#explorer-status').textContent = tourStep === route.length - 1 ? '已到第六处。可以继续探索，或点击去看复色。' : `${stationNames[tourStep]}，共${route.length}站。${points[route[tourStep]].text}`;
}
function startTour() {
  if (viewer.classList.contains('expanded')) toggleExpanded(false);
  tourStep = 0;
  $('#tour-bar').hidden = false;
  showTourStep();
  $('#explore').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
function exitTour(reset = true) {
  const wasActive = tourStep !== -1;
  tourStep = -1;
  $('#tour-bar').hidden = true;
  if (reset) resetView();
  if (wasActive) $('#explorer-status').textContent = '已返回自由探索。';
}

function stepPoint(delta) {
  if (tourStep >= 0) {
    tourStep = clamp(tourStep + delta, 0, route.length - 1);
    showTourStep();
  } else selectPoint(clamp(selected + delta, 0, points.length - 1));
}
$('#point-prev').addEventListener('click', () => stepPoint(-1));
$('#point-next').addEventListener('click', () => stepPoint(1));
$('#reading-color').addEventListener('click', () => exitTour(false));
document.querySelectorAll('[data-start-tour]').forEach(button => button.addEventListener('click', startTour));
$('#tour-exit').addEventListener('click', () => { exitTour(); viewer.focus({ preventScroll: true }); });
$('#zoom-in').addEventListener('click', () => zoomAt(zoom + .35));
$('#zoom-out').addEventListener('click', () => zoomAt(zoom - .35));
$('#reset-view').addEventListener('click', resetView);
$('#close-detail').addEventListener('click', () => {
  exitTour(false);
  layout.classList.add('detail-closed');
  measureViewer();
  resetView();
  viewer.focus({ preventScroll: true });
});

let beforeExpandFocus = null;
function toggleExpanded(force) {
  const expanded = typeof force === 'boolean' ? force : !viewer.classList.contains('expanded');
  if (expanded) beforeExpandFocus = document.activeElement;
  viewer.classList.toggle('expanded', expanded);
  document.body.style.overflow = expanded ? 'hidden' : '';
  // Expanded mode is a modal reading surface; background controls are not focusable.
  const main = $('main');
  Array.from(main.children).filter(el => el.id !== 'explore').forEach(el => { el.inert = expanded; });
  for (const selector of ['.site-header', '.site-footer', '.explore .section-heading', '.explore-topline', '.detail-panel', '.viewer-bottom', '.reading-nav', '.reading-location', '.tour-bar']) $(selector).inert = expanded;
  $('#expand-view').setAttribute('aria-pressed', String(expanded));
  $('#expand-view').setAttribute('aria-label', expanded ? '退出展开画面' : '展开画面');
  $('#expand-view').textContent = expanded ? '×' : '⤢';
  viewer.setAttribute('aria-label', expanded ? '展开的五台山图，按 Escape 退出' : '可拖动缩放的五台山图');
  measureViewer();
  if (expanded) viewer.focus({ preventScroll: true });
  else beforeExpandFocus?.focus({ preventScroll: true });
}
$('#expand-view').addEventListener('click', () => toggleExpanded());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (viewer.classList.contains('expanded')) toggleExpanded(false);
    else if (tourStep >= 0) { exitTour(); viewer.focus({ preventScroll: true }); }
  }
  if (event.key === 'Tab' && viewer.classList.contains('expanded')) {
    const focusable = [...viewer.querySelectorAll('button:not(:disabled)')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === viewer)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

viewer.addEventListener('wheel', event => {
  if (!viewer.contains(document.activeElement)) return;
  event.preventDefault();
  const rect = viewer.getBoundingClientRect();
  zoomAt(zoom * Math.exp(-event.deltaY * .002), event.clientX - rect.left, event.clientY - rect.top);
}, { passive: false });

function localPointer(event) {
  const rect = viewer.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
viewer.addEventListener('pointerdown', event => {
  if (event.target.closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
  viewer.focus({ preventScroll: true });
  pointers.set(event.pointerId, localPointer(event));
  viewer.setPointerCapture(event.pointerId);
  viewer.classList.add('dragging');
});
viewer.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  const old = pointers.get(event.pointerId);
  const next = localPointer(event);
  if (pointers.size === 1) {
    offsetX += next.x - old.x;
    offsetY += next.y - old.y;
    pointers.set(event.pointerId, next);
    renderPosition();
    return;
  }
  const others = [...pointers.entries()].filter(([id]) => id !== event.pointerId);
  const other = others[0][1];
  const oldDistance = Math.hypot(old.x - other.x, old.y - other.y);
  const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
  const oldCenter = { x: (old.x + other.x) / 2, y: (old.y + other.y) / 2 };
  const nextCenter = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
  if (oldDistance > 0) zoomAt(zoom * newDistance / oldDistance, oldCenter.x, oldCenter.y);
  offsetX += nextCenter.x - oldCenter.x;
  offsetY += nextCenter.y - oldCenter.y;
  pointers.set(event.pointerId, next);
  renderPosition();
});
function releasePointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size === 0) viewer.classList.remove('dragging');
}
viewer.addEventListener('pointerup', releasePointer);
viewer.addEventListener('pointercancel', releasePointer);
viewer.addEventListener('lostpointercapture', releasePointer);
viewer.addEventListener('keydown', event => {
  if (event.target !== viewer) return;
  const handled = ['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (!handled.includes(event.key)) return;
  event.preventDefault();
  if (['+', '='].includes(event.key)) zoomAt(zoom + .35);
  else if (event.key === '-') zoomAt(zoom - .35);
  else if (event.key === 'Home') resetView();
  else {
    if (event.key === 'ArrowLeft') offsetX += 50;
    if (event.key === 'ArrowRight') offsetX -= 50;
    if (event.key === 'ArrowUp') offsetY += 50;
    if (event.key === 'ArrowDown') offsetY -= 50;
    renderPosition();
  }
});

const compareRange = $('#compare-range');
function updateCompare() {
  $('#compare').style.setProperty('--split', `${compareRange.value}%`);
  compareRange.setAttribute('aria-valuetext', `左侧原图占${compareRange.value}%，右侧调色实验占${100 - Number(compareRange.value)}%`);
}
compareRange.addEventListener('input', updateCompare);
$('#reset-compare').addEventListener('click', () => { compareRange.value = '50'; updateCompare(); });
function setColorProcess(stage) {
  const amount = Math.max(0, Math.min(3, Number(stage) || 0));
  const index = Math.round(amount);
  const stages = window.QianbiColor.stages;
  const from = stages[Math.floor(amount)], to = stages[Math.min(3, Math.floor(amount) + 1)];
  const mix = key => from[key] + (to[key] - from[key]) * (amount % 1);
  window.__qianbiColorStage = amount;
  $('#compare').style.setProperty('--compare-filter', amount === 0 ? 'none' : `saturate(${mix('saturation')}) brightness(${mix('brightness')}) contrast(${mix('contrast')})`);
  $('#compare-adjusted').alt = `${stages[index].name}阶段的数字视觉实验`;
  $('.adjusted-label').textContent = stages[index].name;
  $('#color-stage-description').textContent = stages[index].description;
  $('#gallery-color-range').value = String(amount);
  $('#gallery-color-range').setAttribute('aria-valuetext', stages[index].name);
  $('#gallery-color-caption').textContent = stages[index].name;
  document.querySelectorAll('[data-color-stage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.colorStage) === index)));
  const colorStatus = `色彩阶段：${stages[index].name}。${stages[index].description}`;
  if ($('#gallery-status').textContent !== colorStatus) $('#gallery-status').textContent = colorStatus;
  window.dispatchEvent(new CustomEvent('qianbi:color-stage-changed', { detail: { stage: amount } }));
}
document.querySelectorAll('[data-color-stage]').forEach(button => button.addEventListener('click', () => setColorProcess(button.dataset.colorStage)));
$('#gallery-color-range').addEventListener('input', event => setColorProcess(event.target.value));
window.addEventListener('qianbi:color-playback', event => setColorProcess(event.detail.stage));
document.querySelectorAll('[data-compare]').forEach(button => button.addEventListener('click', () => {
  const label = button.dataset.compare === '1' ? '山峦' : '建筑群';
  $('#compare-original').src = `assets/detail-${button.dataset.compare}.webp`;
  $('#compare-original').alt = `${label}壁画局部原图`;
  $('#compare-adjusted').src = `assets/detail-${button.dataset.compare}.webp`;
  $('#compare-adjusted').alt = `${label}壁画局部数字调色实验`;
  document.querySelectorAll('[data-compare]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  compareRange.value = '50';
  updateCompare();
}));

mural.addEventListener('error', () => { $('#image-error').hidden = false; });
mural.addEventListener('load', () => { $('#image-error').hidden = true; });
new ResizeObserver(measureViewer).observe(viewer);
measureViewer();
selectPoint(0, false);
updateCompare();
setColorProcess(0);

// Both viewing experiences use the same documented observation points.
document.addEventListener('gallery:read', event => {
  exitTour(false);
  const index = Number(event.detail?.index);
  if (event.detail?.index != null && Number.isInteger(index) && index >= 0 && index < points.length) selectPoint(index);
  else resetView();
  $('#explore').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  viewer.focus({ preventScroll: true });
});

// Keep chapter orientation visible without adding scroll work to the 3D loop.
const chapterObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const link of document.querySelectorAll('.journey-path a, .site-header nav a')) {
      if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', link.closest('.journey-path') ? 'step' : 'location');
      else link.removeAttribute('aria-current');
    }
  }
}, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
for (const id of ['story', 'gallery', 'explore', 'color']) chapterObserver.observe(document.getElementById(id));
