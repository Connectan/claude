// Renderer, camera, orbit controls, environment, and view analytics.
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';

export class Stage {
  constructor(canvas, { reduceMotion = false } = {}) {
    this.canvas = canvas;
    this.reduceMotion = reduceMotion;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    this.scene = scene;

    const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
    key.position.set(2.5, 4, 3.5);
    scene.add(key, new THREE.HemisphereLight(0xfff6ec, 0x3a2a22, 0.7));

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 60);
    this.home = { pos: new THREE.Vector3(0, 1.25, 6.4), target: new THREE.Vector3(0, 1.05, 0) };
    this.camera.position.copy(this.home.pos);

    const controls = new OrbitControls(this.camera, canvas);
    controls.target.copy(this.home.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 1.1;
    controls.maxDistance = 11;
    controls.minPolarAngle = 0.12 * Math.PI;
    controls.maxPolarAngle = 0.64 * Math.PI;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.autoRotateSpeed = 1.4;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls = controls;

    this.pointer = new THREE.Vector2();
    this.pointerInside = false;
    this.pointerMoved = 0;
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.listeners = new Set();
    this.anim = null;
    this.azPrev = 0;
    this.spin = 0;

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerInside = true;
      this.pointerMoved = performance.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { this.pointerInside = false; });
    window.addEventListener('blur', () => { this.pointerInside = false; });

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    controls.addEventListener('start', () => { this.cancelAnim(); });
  }

  /** Screen areas covered by UI (CSS px). The subject is framed inside what is left. */
  setInsets(ins) {
    this.insets = { top: 0, right: 0, bottom: 0, left: 0, ...ins };
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = h > w;
    this.camera.fov = portrait ? 34 : 28;
    const ins = this.insets || { top: 0, right: 0, bottom: 0, left: 0 };
    // move the optical centre to the middle of the free area
    const ox = (ins.right - ins.left) / 2, oy = (ins.bottom - ins.top) / 2;
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) this.camera.setViewOffset(w, h, ox, oy, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.view = { w, h, portrait };
    if (this.subject) this.frame(this.subject.height, this.subject.width, { instant: true, keepUser: true });
  }

  /** Fit a subject (world units, standing on y=0) into the free screen area. */
  frame(height, width = height * 0.6, { instant = false, keepUser = false } = {}) {
    const atHome = !this.home || this.camera.position.distanceTo(this.home.pos) < 1e-3;
    this.subject = { height, width };
    const { w, h } = this.view;
    const ins = this.insets || { top: 0, right: 0, bottom: 0, left: 0 };
    const safeH = Math.max(160, h - ins.top - ins.bottom);
    const safeW = Math.max(140, w - ins.left - ins.right);
    const tanv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const m = 1.06;
    const d = Math.max((height * m * h) / (2 * tanv * safeH), (width * m * h) / (2 * tanv * safeW));
    const target = new THREE.Vector3(0, height * 0.5, 0);
    const pos = new THREE.Vector3(0, height * 0.5 + d * 0.09, d);
    this.home = { pos, target };
    if (keepUser && !atHome) return;
    this.flyTo(pos, target, instant ? 0 : 1.1);
  }

  flyTo(pos, target, dur = 1.0) {
    if (!dur || this.reduceMotion) {
      this.anim = null;
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.anim = {
      t: 0, dur,
      p0: this.camera.position.clone(), p1: pos.clone(),
      t0: this.controls.target.clone(), t1: target.clone(),
    };
  }

  cancelAnim() { this.anim = null; }

  /** world position → CSS px (null if behind camera) */
  project(v) {
    const p = v.clone().project(this.camera);
    if (p.z > 1) return null;
    return { x: (p.x * 0.5 + 0.5) * this.view.w, y: (-p.y * 0.5 + 0.5) * this.view.h };
  }

  raycast(objects) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(objects, false);
  }

  /** Point the pointer ray hits on a plane at distance `d` in front of `origin` (world), facing the camera. */
  pointerTarget(origin, out = new THREE.Vector3()) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const n = this.camera.position.clone().sub(origin).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin.clone().addScaledVector(n, 1.2));
    return this.raycaster.ray.intersectPlane(plane, out) || out.copy(this.camera.position);
  }

  get azimuth() { return this.controls.getAzimuthalAngle(); }
  get polar() { return this.controls.getPolarAngle(); }
  get distance() { return this.camera.position.distanceTo(this.controls.target); }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      if (this.anim) {
        const a = this.anim;
        a.t += dt / a.dur;
        const k = a.t >= 1 ? 1 : 1 - Math.pow(1 - a.t, 3);
        this.camera.position.lerpVectors(a.p0, a.p1, k);
        this.controls.target.lerpVectors(a.t0, a.t1, k);
        if (a.t >= 1) this.anim = null;
      }
      this.controls.update();
      const az = this.azimuth;
      let d = az - this.azPrev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      this.azPrev = az;
      this.spin = this.spin * 0.9 + (Math.abs(d) / Math.max(dt, 1e-3)) * 0.1;
      for (const fn of this.listeners) fn(dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
