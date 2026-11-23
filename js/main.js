import * as THREE from '../vendor/three/three.module.min.js';
import RIG from './rigdata.js';
import { OUTFITS, PROFILE } from './outfits.js';
import { Stage } from './stage.js';
import { buildStand } from './stand.js';
import { FaceController } from './rig.js';
import { Persona, greetingCategory } from './persona.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(`claude-nee:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`claude-nee:${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------------------------------------
// assets

const texLoader = new THREE.TextureLoader();
const cache = new Map();     // id -> Promise<{ art, eyeless, img }>  (only the shown outfit keeps GPU textures)

function loadTexture(url, onProgress) {
  return new Promise((resolve, reject) => {
    texLoader.load(url, (t) => { onProgress?.(1); resolve(t); }, undefined, reject);
  });
}

// warm the HTTP cache only (no decode / GPU upload) so switching is instant without eating memory
function prefetch(id) {
  for (const url of [`assets/art/${id}.webp`, `assets/face/${id}.png`]) {
    fetch(url, { priority: 'low' }).catch(() => {});
  }
}

async function loadOutfit(id, onProgress) {
  if (cache.has(id)) return cache.get(id);
  const p = (async () => {
    let done = 0;
    const tick = () => { done++; onProgress?.(done / 2); };
    const [art, eyeless] = await Promise.all([
      loadTexture(`assets/art/${id}.webp`, tick),
      loadTexture(`assets/face/${id}.png`, tick),
    ]);
    for (const t of [art, eyeless]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
    }
    return { art, eyeless, img: art.image, pixels: null };
  })();
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

function releaseOutfit(id) {
  const p = cache.get(id);
  if (!p) return;
  cache.delete(id);
  p.then((t) => { t.art.dispose(); t.eyeless.dispose(); t.pixels = null; }).catch(() => {});
}

/** quarter-size CPU copy of the art, built on first click (hit-testing hair / skin / clothes) */
function pixelsOf(tex) {
  if (tex.pixels) return tex.pixels;
  const img = tex.img;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = Math.round(w / 2); c.height = Math.round(h / 2);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  tex.pixels = { data: g.getImageData(0, 0, c.width, c.height).data, width: c.width, height: c.height, scale: 0.5 };
  return tex.pixels;
}

// ---------------------------------------------------------------------------------------------
// UI scaffolding

function buildWardrobe(onPick) {
  const list = $('#wardrobe');
  list.innerHTML = '';
  OUTFITS.forEach((o, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'look';
    b.dataset.id = o.id;
    b.style.setProperty('--accent', o.accent);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `
      <span class="look__thumb"><img src="assets/art/${o.id}_thumb.webp" alt="" width="96" height="96" loading="${i < 3 ? 'eager' : 'lazy'}"></span>
      <span class="look__text"><span class="look__name">${o.name}</span><span class="look__en">${o.en}</span><span class="look__tag">${o.tag}</span></span>`;
    b.addEventListener('click', () => onPick(o.id));
    li.appendChild(b);
    list.appendChild(li);
  });
}

function markWardrobe(id) {
  document.querySelectorAll('.look').forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-pressed', String(on));
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  });
}

function buildProfile() {
  const d = $('#profile');
  d.querySelector('.profile__name').textContent = PROFILE.name;
  d.querySelector('.profile__kana').textContent = PROFILE.kana;
  d.querySelector('.profile__lead').textContent = PROFILE.lead;
  const body = d.querySelector('.profile__body');
  body.innerHTML = '';
  for (const s of PROFILE.sections) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h3>${s.h}</h3><ul>${s.items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    body.appendChild(sec);
  }
}

// ---------------------------------------------------------------------------------------------
// app

class App {
  constructor() {
    this.stage = new Stage($('#stage'), { reduceMotion });
    this.face = new FaceController();
    this.persona = new Persona({
      bubble: $('#bubble'), text: $('#bubble .bubble__text'), chips: $('#bubble .bubble__chips'),
      face: this.face, reduceMotion,
    });
    this.current = null;        // { id, rd, tex, stand }
    this.switching = false;
    this.gazeFollow = store.get('gaze', true);
    this.lastInteract = performance.now();
    this.nextIdle = 26;
    this.started = performance.now();
    this.stareT = 0;
    this.pokes = [];
    this.wasInside = true;
    this.leftAt = 0;
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.faceW = new THREE.Vector3();
    this.leaveSaid = true;
  }

  async init() {
    buildWardrobe((id) => this.select(id, { speak: true }));
    buildProfile();
    this.bindUI();
    this.measureUI();
    const params = new URLSearchParams(location.search);
    const start = OUTFITS.find((o) => o.id === params.get('look'))?.id || store.get('look', OUTFITS[0].id);
    const bar = $('#loader .loader__bar span');
    await this.select(OUTFITS.some((o) => o.id === start) ? start : OUTFITS[0].id, {
      instant: true, onProgress: (p) => { bar.style.transform = `scaleX(${0.15 + p * 0.85})`; },
    });
    this.stage.onFrame((dt) => this.frame(dt));
    this.stage.start();
    document.body.classList.add('is-ready');
    window.__claudeBooted = true;
    setTimeout(() => $('#loader')?.remove(), 900);

    const visits = store.get('visits', 0);
    store.set('visits', visits + 1);
    setTimeout(() => this.persona.say(visits > 0 && Math.random() < 0.5 ? 'returning' : greetingCategory(), { priority: 3, force: true }), 900);

    // warm the rest of the wardrobe in the background
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    idle(() => OUTFITS.forEach((o, i) => setTimeout(() => prefetch(o.id), 400 * i)));
  }

  async select(id, { instant = false, speak = false, onProgress } = {}) {
    if (this.switching) { this.pending = { id, speak }; markWardrobe(id); return; }
    if (this.current?.id === id) return;
    this.switching = true;
    markWardrobe(id);
    document.body.classList.add('is-busy');
    try {
      const tex = await loadOutfit(id, onProgress);
      const rd = RIG[id];
      const stand = buildStand(rd, tex);
      const old = this.current;
      this.current = { id, rd, tex, stand };
      this.face.targets = [];
      this.face.attach(stand.uniforms);
      this.stage.scene.add(stand.group);
      await this.transition(old?.stand, stand, instant);
      if (old) { old.stand.dispose(); releaseOutfit(old.id); }
      this.stage.frame(stand.anchors.top.y + 0.08, stand.anchors.width + 0.1, { instant: instant && !old });
      store.set('look', id);
      const url = new URL(location.href);
      url.searchParams.set('look', id);
      history.replaceState(null, '', url);
      document.documentElement.style.setProperty('--accent', OUTFITS.find((o) => o.id === id).accent);
      this.face.blink();
      if (speak) setTimeout(() => this.persona.say(`outfit.${id}`, { priority: 4, force: true }), instant ? 0 : 250);
    } catch (err) {
      console.error(err);
      this.toast('読み込みに失敗したわ。通信を確認して、もう一度選んで。');
      markWardrobe(this.current?.id);
    } finally {
      this.switching = false;
      document.body.classList.remove('is-busy');
      const next = this.pending;
      this.pending = null;
      if (next && next.id !== this.current?.id) this.select(next.id, { speak: next.speak });
    }
  }

  transition(oldStand, newStand, instant) {
    const g = newStand.group;
    if (instant || reduceMotion) {
      if (oldStand) this.stage.scene.remove(oldStand.group);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let t = 0;
      g.rotation.y = 0.9; g.scale.setScalar(0.94);
      newStand.uniforms.uFade.value = 0;
      const off = this.stage.onFrame((dt) => {
        t = Math.min(1, t + dt / 0.7);
        const k = 1 - Math.pow(1 - t, 3);
        if (oldStand) {
          const o = oldStand.group;
          o.rotation.y = -0.9 * k;
          o.scale.setScalar(1 - 0.06 * k);
          oldStand.uniforms.uFade.value = 1 - Math.min(1, t * 1.8);
          o.visible = t < 0.55;
        }
        g.rotation.y = 0.9 * (1 - k);
        g.scale.setScalar(0.94 + 0.06 * k);
        newStand.uniforms.uFade.value = Math.max(0, (t - 0.25) / 0.75);
        if (t >= 1) {
          off();
          if (oldStand) this.stage.scene.remove(oldStand.group);
          resolve();
        }
      });
    });
  }

  // ------------------------------------------------------------------------------------------
  frame(dt) {
    const cur = this.current;
    if (!cur) return;
    const st = this.stage;
    const { stand } = cur;
    const now = performance.now();

    // ---- gaze ----
    const faceW = stand.group.localToWorld(this.faceW.copy(stand.anchors.face));
    const pointerFresh = st.pointerInside && now - st.pointerMoved < 6000;
    const target = this.gazeFollow && pointerFresh ? st.pointerTarget(faceW, this.tmpV2) : this.tmpV2.copy(st.camera.position);
    const tl = stand.group.worldToLocal(target).sub(stand.anchors.face);
    const len = tl.length() || 1;
    // soft, saturating response: eyes reach ~2.4px only when you are far off to the side
    let gx = 2.4 * Math.tanh(1.7 * tl.x / len), gy = 1.0 * Math.tanh(1.7 * -tl.y / len);
    if (tl.z < 0) { gx *= 0.4; gy *= 0.4; }
    this.face.lookAt(gx, gy);
    this.face.update(dt);

    // ---- bubble follows the head ----
    this.placeBubble(stand);

    // ---- view-driven lines ----
    const az = Math.abs(st.azimuth);
    if (st.spin > 3.2) this.persona.say('spin', { priority: 2 });
    else if (az > 2.35) this.persona.say('back', { priority: 2 });
    else if (st.polar > 0.6 * Math.PI) this.persona.say('low', { priority: 2 });
    const faceDist = st.camera.position.distanceTo(faceW);
    if (faceDist < 1.35) this.persona.say('close', { priority: 2 });
    else if (st.distance > 10) this.persona.say('far', { priority: 1 });

    // staring: pointer resting on the face
    if (pointerFresh && !this.persona.speaking) {
      const hit = this.hitTest();
      this.stareT = hit?.region === 'face' ? this.stareT + dt : 0;
      if (this.stareT > 3.8) { this.stareT = 0; this.persona.say('stare', { priority: 2 }); this.bump(); }
    }

    // pointer left / came back (desktop only — touch has no hover)
    if (matchMedia('(hover: hover)').matches) {
      if (!st.pointerInside && this.wasInside) { this.leftAt = now; this.leaveSaid = false; }
      if (!st.pointerInside && !this.leaveSaid && now - this.leftAt > 2500) { this.leaveSaid = true; this.persona.say('leave', { priority: 1 }); }
      if (st.pointerInside && !this.wasInside && this.leftAt && now - this.leftAt > 6000) this.persona.say('backIn', { priority: 2 });
      this.wasInside = st.pointerInside;
    }

    // idle chatter
    const idleFor = (now - Math.max(this.lastInteract, this.persona.lastSpoke)) / 1000;
    if (idleFor > this.nextIdle && !this.persona.speaking && !document.hidden) {
      this.persona.say('idle', { priority: 1, force: true });
      this.nextIdle = 24 + Math.random() * 18;
    }
    if ((now - this.started) / 1000 > 300) this.persona.say('longStay', { priority: 1 });
  }

  bump() { this.lastInteract = performance.now(); }

  /** UI rectangles (CSS px), re-measured on resize. */
  measureUI() {
    const r = (sel) => $(sel)?.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const brand = r('.brand'), ward = r('.wardrobe'), dock = r('.dock');
    const wide = w > 960;
    this.ui = { w, h, wide, brand, ward, dock };
    const bottomUI = Math.min(dock.top, wide ? h : ward.top);
    this.stage.setInsets({
      top: wide ? Math.max(28, brand.bottom * 0.55) : brand.bottom + 8,
      bottom: h - bottomUI + 10,
      left: wide ? 28 : 8,
      right: wide ? w - ward.left + 16 : 8,
    });
  }

  placeBubble(stand) {
    const el = $('#bubble');
    if (el.hidden || !this.ui) return;
    const st = this.stage;
    const g = stand.group;
    const head = st.project(g.localToWorld(this.tmpV.copy(stand.anchors.head)));
    const face = st.project(g.localToWorld(this.tmpV.copy(stand.anchors.face)));
    const topP = st.project(g.localToWorld(this.tmpV.copy(stand.anchors.top)));
    const side = st.project(g.localToWorld(this.tmpV.copy(stand.anchors.face).add(new THREE.Vector3(0.13, 0, 0))));
    const { w, h, wide, brand, ward, dock } = this.ui;
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const pad = 12;
    const fr = face && side ? Math.max(24, Math.abs(side.x - face.x)) : 40;
    const faceBox = face ? { l: face.x - fr, r: face.x + fr, t: face.y - fr * 1.25, b: face.y + fr * 1.1 } : null;
    const blockers = [brand, dock, wide ? ward : null, faceBox && { left: faceBox.l, right: faceBox.r, top: faceBox.t, bottom: faceBox.b }].filter(Boolean);
    const overlap = (x, y) => blockers.reduce((acc, q) => {
      const ox = Math.max(0, Math.min(x + bw, q.right) - Math.max(x, q.left));
      const oy = Math.max(0, Math.min(y + bh, q.bottom) - Math.max(y, q.top));
      return acc + ox * oy * (q === blockers[blockers.length - 1] && faceBox ? 4 : 1);
    }, 0);
    const clampX = (x) => Math.max(pad, Math.min(w - bw - pad, x));
    const clampY = (y) => Math.max(pad, Math.min(h - bh - pad, y));
    const cands = [];
    if (head && face) {
      cands.push({ x: head.x - 56 - bw, y: head.y - bh * 0.6, side: 'right' });        // left of her head
      cands.push({ x: head.x + 56, y: head.y - bh * 0.6, side: 'left' });              // right of her head
      if (topP) cands.push({ x: head.x - bw / 2, y: topP.y - bh - 14, side: 'down' });  // above her head
      cands.push({ x: face.x - bw / 2, y: faceBox.b + 18, side: 'up' });               // under her chin
    } else {
      cands.push({ x: (w - bw) / 2, y: h * 0.18, side: 'down' });
    }
    let best = null;
    for (const c of cands) {
      const x = clampX(c.x), y = clampY(c.y);
      const cost = overlap(x, y) + (Math.abs(x - c.x) + Math.abs(y - c.y)) * 2;
      if (!best || cost < best.cost - 1) best = { x, y, side: c.side, cost };
      if (cost === 0) break;
    }
    // keep the choice stable while she talks: only switch if clearly better
    if (this._bubble && this._bubble.side !== best.side) {
      const keep = cands.find((c) => c.side === this._bubble.side);
      if (keep) {
        const x = clampX(keep.x), y = clampY(keep.y);
        const cost = overlap(x, y) + (Math.abs(x - keep.x) + Math.abs(y - keep.y)) * 2;
        if (cost <= best.cost + 400) best = { x, y, side: keep.side, cost };
      }
    }
    this._bubble = best;
    el.style.transform = `translate3d(${best.x.toFixed(1)}px, ${best.y.toFixed(1)}px, 0)`;
    el.dataset.side = best.side;
  }

  /** what is under the pointer: { region: 'face'|'hair'|'skin'|'body'|'acrylic', px } */
  hitTest() {
    const cur = this.current;
    if (!cur) return null;
    const { stand, rd, tex } = cur;
    const hits = this.stage.raycast([stand.print, stand.slab, stand.base]);
    if (!hits.length) return null;
    const hp = hits.find((h) => h.object === stand.print);
    if (!hp) return { region: 'acrylic' };
    const [W, H] = rd.img;
    const px = hp.uv.x * W, py = (1 - hp.uv.y) * H;
    const d = pixelsOf(tex);
    const i = (Math.floor(py * d.scale) * d.width + Math.floor(px * d.scale)) * 4;
    if (d.data[i + 3] < 110) return { region: 'acrylic' };
    const e = rd.eyes;
    const fx = e.reduce((a, q) => a + q.iris[0], 0) / e.length;
    const fy = e.reduce((a, q) => a + q.iris[1], 0) / e.length;
    const span = Math.max(40, Math.abs(e[0].iris[0] - (e[1]?.iris[0] ?? e[0].iris[0])) * 1.25);
    if (((px - fx) / span) ** 2 + ((py - fy - span * 0.25) / (span * 1.05)) ** 2 < 1) return { region: 'face', px, py };
    const r = d.data[i] / 255, g = d.data[i + 1] / 255, b = d.data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx || 1);
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = ((g - b) / (mx - mn)) % 6; else if (mx === g) hue = (b - r) / (mx - mn) + 2; else hue = (r - g) / (mx - mn) + 4;
      hue *= 60; if (hue < 0) hue += 360;
    }
    if (sat > 0.5 && mx > 0.55 && hue > 5 && hue < 38) return { region: 'hair', px, py };
    if (sat < 0.33 && mx > 0.82 && r >= g && g >= b) return { region: 'skin', px, py };
    return { region: 'body', px, py };
  }

  poke(hit) {
    this.bump();
    const now = performance.now();
    this.pokes = this.pokes.filter((t) => now - t < 3500);
    this.pokes.push(now);
    if (this.pokes.length >= 5) { this.pokes = []; this.persona.say('pokeSpam', { priority: 4, force: true }); return; }
    const region = hit.region === 'skin' ? 'body' : hit.region;
    this.face.blink(Math.random() < 0.3);
    this.persona.say(region, { priority: 3 });
  }

  focusFace() {
    const s = this.current.stand;
    const f = s.group.localToWorld(s.anchors.face.clone());
    const dir = this.stage.camera.position.clone().sub(f).normalize();
    this.stage.flyTo(f.clone().addScaledVector(dir, 1.6), f, 0.9);
  }

  resetView() {
    this.stage.controls.autoRotate = false;
    $('#btn-auto').setAttribute('aria-pressed', 'false');
    this.stage.flyTo(this.stage.home.pos, this.stage.home.target, 0.9);
  }

  bindUI() {
    const canvas = $('#stage');
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; this.bump(); });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 6 || !quick) return;
      const hit = this.hitTest();
      if (hit) this.poke(hit);
    });
    canvas.addEventListener('dblclick', () => {
      const hit = this.hitTest();
      if (hit?.region === 'face') this.focusFace();
      else this.resetView();
    });
    canvas.addEventListener('wheel', () => this.bump(), { passive: true });

    $('#btn-auto').addEventListener('click', (e) => {
      const on = !this.stage.controls.autoRotate;
      this.stage.controls.autoRotate = on;
      e.currentTarget.setAttribute('aria-pressed', String(on));
      if (on) this.persona.say('autoOn', { priority: 2 });
      this.bump();
    });
    $('#btn-front').addEventListener('click', () => { this.resetView(); this.persona.say('reset', { priority: 2 }); this.bump(); });
    const gazeBtn = $('#btn-gaze');
    gazeBtn.setAttribute('aria-pressed', String(this.gazeFollow));
    gazeBtn.addEventListener('click', () => {
      this.gazeFollow = !this.gazeFollow;
      store.set('gaze', this.gazeFollow);
      gazeBtn.setAttribute('aria-pressed', String(this.gazeFollow));
      this.persona.say(this.gazeFollow ? 'gazeOn' : 'gazeOff', { priority: 3, force: true });
      this.bump();
    });
    $('#btn-shot').addEventListener('click', () => this.snapshot());
    const dlg = $('#profile');
    $('#btn-profile').addEventListener('click', () => { dlg.showModal(); this.bump(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('.profile__close').addEventListener('click', () => dlg.close());

    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));

    window.addEventListener('resize', () => this.measureUI());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, dialog[open]')) return;
      const i = OUTFITS.findIndex((o) => o.id === this.current?.id);
      if (e.key === 'ArrowRight') this.select(OUTFITS[(i + 1) % OUTFITS.length].id, { speak: true });
      else if (e.key === 'ArrowLeft') this.select(OUTFITS[(i - 1 + OUTFITS.length) % OUTFITS.length].id, { speak: true });
      else if (e.key.toLowerCase() === 'r') this.resetView();
      else if (e.key.toLowerCase() === 'a') $('#btn-auto').click();
      else return;
      this.bump();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.bump(); });
  }

  setMode(mode) {
    if (mode === 'figure') {
      this.toast('フィギュアは今、外部AIで造形中よ。完成したらここに並ぶわ。');
      this.persona.say('modeStand', { priority: 1 });
    }
  }

  snapshot() {
    const r = this.stage.renderer;
    r.render(this.stage.scene, this.stage.camera);
    r.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `claude-nee-${this.current.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
    this.face.setExpression('smile', 2);
    this.toast('撮ったわよ。……ちゃんと可愛く写ってる？');
    this.bump();
  }

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('is-on'), 3200);
  }
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

if (!webglOK()) {
  window.__claudeBootFail?.('このブラウザでは 3D 表示（WebGL2）が使えないみたい。……絵だけでも、見ていって。');
} else {
  const app = new App();
  window.claudeNee = app; // handy from the devtools console
  app.init().catch((e) => {
    console.error(e);
    window.__claudeBootFail?.('起動に失敗したわ。最新の Chrome / Safari で開き直してみて。');
  });
}
