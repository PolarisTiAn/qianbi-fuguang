import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import wallURL from '../assets/west-wall.webp';

const el = id => document.getElementById(id);
const stage = el('gallery-stage');
const frame = el('gallery-frame');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const viewpointNames = { entrance: '洞口 / 循光而入', overview: '主室 / 初见西壁', front: '西壁 / 一壁山河', detail: '近观 / 山水之间', cutaway: '剖视 / 空间关系' };
const viewDescriptions = { entrance: '从明处，走向壁画所在的幽微深处。', overview: '面向西壁，看见上下层壁画与主室的关系。', front: '上部《五台山图》 · 下层壁画', detail: '沿着山势与屋宇，慢慢靠近。', cutaway: '隐去部分墙面，理解壁画如何留在一室之中。' };
const colorStages = window.QianbiColor.stages;
let pavilion = null;
let active = false;
let inView = false;
let spinning = false;
let colorPlaying = false;
let currentView = 'entrance';

function announce(text) { el('gallery-status').textContent = text; }
function readMural(index) {
  setSpinning(false);
  document.dispatchEvent(new CustomEvent('gallery:read', { detail: { index } }));
}
function setSpinning(value) {
  if (pavilion && value && (currentView === 'cutaway' || currentView === 'entrance' || pavilion.transition)) pavilion.setView('overview', true);
  spinning = value;
  el('gallery-auto').setAttribute('aria-pressed', String(value));
  el('gallery-auto').textContent = value ? '暂停环视' : '缓缓环视';
  if (pavilion && value) pavilion.orbitAngle = pavilion.controls.getAzimuthalAngle();
}
function setActive(value) {
  active = value;
  frame.dataset.state = value ? 'active' : 'idle';
  el('gallery-entry').hidden = value;
  el('gallery-toolbar').hidden = !value;
  el('gallery-scene-caption').hidden = !value;
  el('gallery-leave').hidden = !value;
  el('gallery-colorbar').hidden = !value || currentView === 'entrance';
  el('threshold-prompt').hidden = !value || currentView !== 'entrance';
  if (pavilion) pavilion.renderer.domElement.hidden = !value;
  if (!value) {
    setSpinning(false);
    setColorPlaying(false);
    el('gallery-wall-info').hidden = true;
  }
  syncPlayback();
}

function setColorStage(index) {
  if (!pavilion) return;
  pavilion.setColorStage(Number(index));
}
function setColorPlaying(value) {
  colorPlaying = value;
  el('gallery-color-play').setAttribute('aria-pressed', String(value));
  el('gallery-color-play').textContent = value ? '暂停复色过程' : '播放复色过程';
  if (value && window.__qianbiColorStage >= 3) {
    window.dispatchEvent(new CustomEvent('qianbi:color-playback', { detail: { stage: 0 } }));
  }
}
function syncPlayback() {
  if (!pavilion) return;
  const playing = active && inView && !document.hidden;
  pavilion.renderer.setAnimationLoop(playing ? pavilion.tick : null);
  if (!playing) pavilion.previousTime = null;
  frame.dataset.rendering = String(playing);
}

function textureFromCanvas(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function plasterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(256, 256);
  let seed = 61;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = 178 + (seed % 43);
    data.data[i] = value; data.data[i + 1] = value; data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const texture = textureFromCanvas(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 3);
  return texture;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => reject(new Error('image-timeout')), 15000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('image-load')); };
    image.src = url;
  });
}

function colorTexture(image, index) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(2560,image.naturalWidth);
  canvas.height = Math.round(image.naturalHeight*canvas.width/image.naturalWidth);
  const ctx = canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
  pixels.data.set(window.QianbiColor.transform(pixels.data,index));
  ctx.putImageData(pixels,0,0);
  return textureFromCanvas(canvas);
}

async function loadColorStages(url) {
  const image = await loadImage(url);
  return colorStages.map((_, index) => colorTexture(image, index));
}

class Pavilion {
  constructor(wallStages) {
    this.wallStages = wallStages;
    this.textures = new Set(wallStages);
    this.pickable = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 650 ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a231e');
    this.camera = new THREE.PerspectiveCamera(48, 1, .1, 65);
    this.camera.position.set(5.8, 4.3, 12);
    const canvas = this.renderer.domElement;
    canvas.id = 'gallery-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '莫高窟第61窟西壁原位构视：方向键转向，加减号拉近拉远，Home 归位。也可使用下方视角按钮。');
    canvas.setAttribute('aria-describedby', 'gallery-help');
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }), { capture: true });
    canvas.addEventListener('wheel', event => {
      if (document.activeElement !== canvas) event.stopImmediatePropagation();
    }, { capture: true, passive: true });
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 2.85, -6.45);
    this.controls.enableDamping = !reducedMotion.matches;
    this.controls.dampingFactor = .085;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.8;
    this.controls.maxDistance = 13.5;
    this.controls.minAzimuthAngle = -.48;
    this.controls.maxAzimuthAngle = .48;
    this.controls.minPolarAngle = 1.32;
    this.controls.maxPolarAngle = 1.76;
    this.controls.rotateSpeed = .48;
    this.controls.zoomSpeed = .7;
    this.controls.addEventListener('start', () => { setSpinning(false); this.transition = null; });
    this.controls.update();
    this.build();
    this.bindInteraction(canvas);
    this.tick = this.tick.bind(this);
    stage.append(canvas);
    this.resize();
    this.setView('entrance', true);
    this.render();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      setActive(false);
      frame.dataset.state = 'error';
      el('gallery-entry-message').textContent = '画面已暂停。点击进入可重新进入构视。';
      announce('3D 画面已暂停，可重新进入构视，或继续细读画卷。');
      this.destroy();
      pavilion = null;
    });
  }
  own(texture) { this.textures.add(texture); return texture; }
  box(w, h, d, x, y, z, material, parent = this.scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  build() {
    const plaster = this.own(plasterTexture());
    const earth = new THREE.MeshStandardMaterial({ color: '#9d876c', map: plaster, roughness: 1 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: '#756c58', map: plaster, roughness: 1, side: THREE.DoubleSide });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#8a775b', map: plaster, roughness: 1 });
    this.roof = new THREE.Group();
    this.scene.add(this.roof);
    const W = 13, D = 13, H = W * 1427 / 3286;
    this.box(W + .44, .24, D + .44, 0, -.12, 0, floorMaterial);
    this.box(W + .44, H, .22, 0, H / 2, -6.61, earth);
    this.southWall = this.box(.22, H, D, -6.61, H / 2, 0, earth);
    this.northWall = this.box(.22, H, D, 6.61, H / 2, 0, earth);
    this.eastWall = new THREE.Group(); this.scene.add(this.eastWall);
    this.box(5.3, H, .22, -3.85, H / 2, 6.61, earth, this.eastWall);
    this.box(5.3, H, .22, 3.85, H / 2, 6.61, earth, this.eastWall);
    this.box(2.4, H - 3, .22, 0, (H + 3) / 2, 6.61, earth, this.eastWall);
    // Four sloping faces and a flat central panel follow the inverted-funnel
    // ceiling visible in the supplied cave photograph. Dimensions are schematic.
    const bottom = [[-6.5,H,-6.5],[6.5,H,-6.5],[6.5,H,6.5],[-6.5,H,6.5]];
    const top = [[-1.6,8,-1.6],[1.6,8,-1.6],[1.6,8,1.6],[-1.6,8,1.6]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...bottom[i],...bottom[j],...top[j],...top[i]],3));
      geometry.setIndex([0,1,2,0,2,3]); geometry.computeVertexNormals();
      this.roof.add(new THREE.Mesh(geometry, roofMaterial));
    }
    this.box(3.2,.08,3.2,0,8,0,roofMaterial,this.roof);
    // One continuous image fills the west wall. No display frame or decorative strip.
    this.wallMaterial = new THREE.MeshBasicMaterial({ map: this.wallStages[0], toneMapped: false });
    this.wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(W,H),this.wallMaterial);
    this.wallMesh.position.set(0,H / 2,-6.48);
    this.wallMesh.name = 'west-wall-source-image';
    this.scene.add(this.wallMesh); this.pickable.push(this.wallMesh);
    this.colorOverlayMaterial = new THREE.MeshBasicMaterial({map:this.wallStages[1],toneMapped:false,transparent:true,opacity:0,depthWrite:false});
    this.colorOverlay = new THREE.Mesh(new THREE.PlaneGeometry(W,H),this.colorOverlayMaterial);
    this.colorOverlay.position.copy(this.wallMesh.position); this.colorOverlay.position.z += .003;
    this.scene.add(this.colorOverlay);
    // A neutral mass indicates the raised central platform visible in the source
    // photograph; no statues or unverified decoration are invented.
    const platformMaterial = new THREE.MeshStandardMaterial({color:'#82705a',map:plaster,roughness:1});
    this.platform = this.box(4.2,.65,4.5,0,.325,-.6,platformMaterial);
    this.box(4.7,.2,5.0,0,.1,-.35,platformMaterial);
    // Fine dashed edges make the omitted surfaces readable in the cutaway view.
    this.cutawayEdges = new THREE.Group(); this.scene.add(this.cutawayEdges);
    for (const box of [this.southWall,this.northWall,...this.eastWall.children]) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineDashedMaterial({color:'#c9b78d',dashSize:.16,gapSize:.12,transparent:true,opacity:.65}));
      lines.position.copy(box.position); lines.computeLineDistances(); this.cutawayEdges.add(lines);
    }
    // Interpretive entrance and passage, not a surveyed Cave 61 facade.
    this.passage = new THREE.Group(); this.scene.add(this.passage);
    const rock = new THREE.MeshStandardMaterial({color:'#b39a79',map:plaster,roughness:1});
    this.box(10,.2,9,0,-.14,11,earth,this.passage);
    this.box(.3,3.2,3.9,-1.35,1.6,8.5,earth,this.passage);
    this.box(.3,3.2,3.9,1.35,1.6,8.5,earth,this.passage);
    this.box(3,.25,3.9,0,3.32,8.5,roofMaterial,this.passage);
    this.box(3.8,7,.8,-3.25,3.5,10.45,rock,this.passage);
    this.box(3.8,7,.8,3.25,3.5,10.45,rock,this.passage);
    this.box(2.7,3.8,.8,0,5.1,10.45,rock,this.passage);
    const entranceLight = new THREE.PointLight('#ffe4b5',35,12);
    entranceLight.position.set(0,4,14); this.passage.add(entranceLight);
    this.scene.add(new THREE.HemisphereLight('#eee0c8','#3c3930',2.2));
    const key = new THREE.DirectionalLight('#fff1d8',2.2); key.position.set(1,7,9);
    this.scene.add(key);
    const bounce = new THREE.PointLight('#c7d6c6',24,18); bounce.position.set(-4,4,0); this.scene.add(bounce);
    this.scene.updateMatrixWorld(true);
  }
  setColorStage(value) {
    const amount = THREE.MathUtils.clamp(Number(value) || 0,0,3);
    const base = Math.floor(amount), next = Math.min(3,base+1);
    if (this.wallMaterial.map !== this.wallStages[base]) {
      this.wallMaterial.map = this.wallStages[base]; this.wallMaterial.needsUpdate = true;
    }
    if (this.colorOverlayMaterial.map !== this.wallStages[next]) {
      this.colorOverlayMaterial.map = this.wallStages[next]; this.colorOverlayMaterial.needsUpdate = true;
    }
    this.colorOverlayMaterial.opacity = amount - base;
    frame.dataset.colorStage = amount.toFixed(2);
    if (active && inView) this.render();
  }
  resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    this.camera.aspect = width / height;
    this.camera.fov = currentView === 'cutaway' ? 48 : currentView === 'entrance' ? 58 : width < 600 ? 80 : 56;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }
  setView(name, immediate = false) {
    if (!viewpointNames[name]) return;
    setSpinning(false);
    const previousView = currentView;
    // Flush damping under the old limits, before assigning a new viewpoint.
    this.controls.enableDamping = false;
    if (!this.transition) this.controls.update();
    this.controls.enableDamping = !reducedMotion.matches;
    currentView = name;
    frame.dataset.view = name;
    el('gallery-wall-info').hidden = true;
    document.querySelectorAll('[data-gallery-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryView === name)));
    el('gallery-scene-caption').firstElementChild.textContent = viewpointNames[name];
    el('gallery-scene-caption').lastElementChild.textContent = viewDescriptions[name];
    const narrow = stage.clientWidth < 600;
    const isCutaway = name === 'cutaway';
    const isEntrance = name === 'entrance';
    if (isEntrance) setColorPlaying(false);
    this.controls.enableRotate = !isEntrance;
    this.controls.enableZoom = !isEntrance;
    this.roof.visible = !isCutaway;
    this.northWall.visible = !isCutaway;
    this.eastWall.visible = !isCutaway;
    this.passage.visible = !isCutaway;
    this.cutawayEdges.visible = isCutaway;
    this.scene.background.set(isEntrance ? '#b9a68a' : '#1a231e');
    el('threshold-prompt').hidden = !active || !isEntrance;
    el('gallery-colorbar').hidden = !active || isEntrance;
    for (const id of ['gallery-auto', 'gallery-zoom-in', 'gallery-zoom-out']) el(id).disabled = isEntrance;
    this.controls.minDistance = isCutaway ? 17 : isEntrance ? 18 : 3.8;
    this.controls.maxDistance = isCutaway ? 43 : isEntrance ? 23 : 13.5;
    this.controls.minPolarAngle = isCutaway ? .3 : isEntrance ? 1.48 : 1.32;
    this.controls.maxPolarAngle = isCutaway ? 1.25 : isEntrance ? 1.66 : 1.76;
    this.controls.minAzimuthAngle = isCutaway ? .05 : isEntrance ? -.1 : -.48;
    this.controls.maxAzimuthAngle = isCutaway ? 1.4 : isEntrance ? .1 : .48;
    this.camera.fov = isCutaway ? 48 : isEntrance ? 58 : narrow ? 80 : 56;
    this.camera.updateProjectionMatrix();
    const presets = {
      entrance: { position: [0,1.7,14.5], target: [0,2,-6.45] },
      overview: { position: [0,1.9,4.7], target: [0,2.85,-6.45] },
      front: { position: [0,2.85,6], target: [0,2.85,-6.45] },
      detail: { position: [1.2,3.65,-1.9], target: [.5,3.7,-6.45] },
      cutaway: { position: narrow ? [24,24,31] : [16,16,21], target: [0,2,0] }
    };
    const preset = presets[name];
    const endPosition = new THREE.Vector3(...preset.position);
    const endTarget = new THREE.Vector3(...preset.target);
    // Returning to the doorway or switching to a cutaway does not cross walls.
    if (immediate || reducedMotion.matches || isEntrance || isCutaway || previousView === 'cutaway') {
      this.transition = null;
      this.controls.enabled = true;
      this.camera.position.copy(endPosition); this.controls.target.copy(endTarget); this.controls.update(); this.render();
    } else {
      this.controls.enabled = false;
      this.transition = { elapsed: 0, duration: previousView === 'entrance' ? 2.8 : 1.15, position: this.camera.position.clone(), target: this.controls.target.clone(), endPosition, endTarget };
    }
    frame.dataset.transitioning = String(Boolean(this.transition));
    announce(isEntrance ? '已抵达洞口。点击沿甬道入窟，进入主室。洞口为简化空间示意。' : `已切换至${viewpointNames[name]}。拖动可调整视角，点击壁画可进入细读。`);
  }
  dolly(factor) {
    if (this.transition || currentView === 'entrance') return;
    this.transition = null; setSpinning(false);
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(offset); this.controls.update(); this.render();
  }
  bindInteraction(canvas) {
    let clickStart = null;
    const touches = new Set();
    canvas.addEventListener('pointerdown', event => {
      touches.add(event.pointerId);
      if (touches.size > 1) clickStart = null;
      else clickStart = { x: event.clientX, y: event.clientY, moved: false, time: performance.now() };
    });
    canvas.addEventListener('pointermove', event => {
      if (clickStart && Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) > 7) clickStart.moved = true;
    });
    canvas.addEventListener('pointerup', event => {
      touches.delete(event.pointerId);
      if (!clickStart || clickStart.moved || performance.now() - clickStart.time > 600 || event.button !== 0) { clickStart = null; return; }
      clickStart = null;
      if (this.transition || currentView === 'entrance') return;
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
      const hit = ray.intersectObjects(this.pickable)[0];
      if (!hit) return;
      const wallY = (1-hit.uv.y)*1427;
      if (wallY >= 955) {
        el('gallery-wall-info').hidden = false;
        announce('西壁下层为佛传故事画，尚未配置局部讲解。可查看来源原图。');
        return;
      }
      let index;
      {
        const coords = window.QianbiPoints.map(point => [point.x, point.y]);
        const distances = coords.map(([x, y]) => Math.hypot((x - hit.uv.x) * 3.4, y - wallY / 955));
        index = distances.indexOf(Math.min(...distances));
      }
      readMural(index);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => { touches.delete(event.pointerId); clickStart = null; });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') { setActive(false); el('gallery-enter').focus({ preventScroll: true }); return; }
      if (this.transition || (currentView === 'entrance' && event.key !== 'Home')) return;
      if (event.key === 'Home') return this.setView('overview');
      if (['+', '='].includes(event.key)) return this.dolly(.88);
      if (event.key === '-') return this.dolly(1.14);
      setSpinning(false); this.transition = null;
      const spherical = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= .07;
      if (event.key === 'ArrowRight') spherical.theta += .07;
      if (event.key === 'ArrowUp') spherical.phi -= .05;
      if (event.key === 'ArrowDown') spherical.phi += .05;
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      this.controls.update(); this.render();
    });
  }
  render() {
    if (currentView !== 'cutaway' && currentView !== 'entrance' && !this.transition) {
      this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x,-6.05,6.05);
      this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y,.85,5.2);
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z,-2.9,6.15);
    }
    this.camera.lookAt(this.controls.target);
    this.renderer.render(this.scene, this.camera);
  }
  tick(time) {
    const dt = Math.min((time - (this.previousTime || time)) / 1000, .05);
    this.previousTime = time;
    if (colorPlaying) {
      const amount = Math.min(3, (window.__qianbiColorStage || 0) + dt / 4);
      window.dispatchEvent(new CustomEvent('qianbi:color-playback', { detail: { stage: amount } }));
      if (amount === 3) setColorPlaying(false);
    }
    if (this.transition) {
      this.transition.elapsed += dt;
      const t = THREE.MathUtils.clamp(this.transition.elapsed / this.transition.duration, 0, 1);
      const ease = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.transition.position, this.transition.endPosition, ease);
      this.controls.target.lerpVectors(this.transition.target, this.transition.endTarget, ease);
      if (t === 1) {
        this.transition = null;
        this.controls.enabled = true;
        frame.dataset.transitioning = 'false';
      }
    } else if (spinning) {
      this.orbitDirection ??= 1;
      this.orbitAngle += dt * .055 * this.orbitDirection;
      if (this.orbitAngle > .4) { this.orbitAngle = .4; this.orbitDirection = -1; }
      else if (this.orbitAngle < -.4) { this.orbitAngle = -.4; this.orbitDirection = 1; }
      const spherical = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      spherical.theta = this.orbitAngle;
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    }
    if (!this.transition) this.controls.update(dt);
    this.render();
  }
  destroy() {
    this.renderer.setAnimationLoop(null); this.controls.dispose();
    const materials = new Set(), geometries = new Set();
    this.scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

window.QianbiGallery = {
  async enter() {
    if (!pavilion) {
      const wallStages = await loadColorStages(wallURL);
      try { pavilion = new Pavilion(wallStages); }
      catch (error) { wallStages.forEach(texture => texture.dispose()); throw error; }
    }
    setActive(true);
    pavilion.setView('entrance', true);
    el('gallery-entry-message').textContent = '先在洞口停一停，再沿甬道走进第 61 窟。';
    pavilion.setColorStage(window.__qianbiColorStage ?? 0);
    pavilion.resize();
    pavilion.renderer.domElement.focus({ preventScroll: true });
    announce('已抵达洞口。点击沿甬道入窟，开始观看。');
  }
};
new ResizeObserver(() => pavilion?.resize()).observe(stage);
new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncPlayback(); }, { threshold: 0 }).observe(stage);
document.addEventListener('visibilitychange', syncPlayback);
reducedMotion.addEventListener('change', () => {
  if (pavilion) pavilion.controls.enableDamping = !reducedMotion.matches;
  if (reducedMotion.matches) { setSpinning(false); if (pavilion?.transition) pavilion.setView(currentView, true); }
});
el('gallery-leave').addEventListener('click', () => { setActive(false); el('gallery-enter').focus({ preventScroll: true }); });
el('gallery-auto').addEventListener('click', () => { if (pavilion) setSpinning(!spinning); });
el('gallery-walk').addEventListener('click', () => { pavilion?.setView('overview'); pavilion?.renderer.domElement.focus({ preventScroll: true }); });
el('gallery-reset').addEventListener('click', () => pavilion?.setView('overview'));
el('gallery-zoom-in').addEventListener('click', () => pavilion?.dolly(.84));
el('gallery-zoom-out').addEventListener('click', () => pavilion?.dolly(1.19));
el('gallery-read').addEventListener('click', () => readMural(null));
document.querySelectorAll('[data-gallery-view]').forEach(button => button.addEventListener('click', () => pavilion?.setView(button.dataset.galleryView)));
window.addEventListener('qianbi:color-stage-changed', event => setColorStage(event.detail.stage));
el('gallery-color-play').addEventListener('click', () => setColorPlaying(!colorPlaying));
el('gallery-color-range').addEventListener('input', () => setColorPlaying(false));
document.querySelectorAll('[data-color-stage]').forEach(button => button.addEventListener('click', () => setColorPlaying(false)));
el('gallery-wall-info-close').addEventListener('click', () => {
  el('gallery-wall-info').hidden = true;
  pavilion?.renderer.domElement.focus({ preventScroll: true });
});
