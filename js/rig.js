// Face rig: blink / gaze / blush applied directly while sampling the original illustration.
// Every coordinate here is in source-image pixels (x → right, y → down), the same space the
// curves in rigdata.js were measured in. Ported 1:1 from tools/build_face.py `simulate()`.
import * as THREE from '../vendor/three/three.module.min.js';

export const RIG_GLSL = /* glsl */ `
uniform sampler2D uArt;
uniform sampler2D uEyeless;
uniform sampler2D uCurves;
uniform vec2  uImg;
uniform vec4  uBox;
uniform vec2  uEyeX[2];
uniform vec4  uIris[2];
uniform int   uEyeCount;
uniform vec2  uOpen;
uniform vec2  uGaze;
uniform float uBlush;

vec4 artPx(vec2 px) { return texture2D(uArt, vec2(px.x / uImg.x, 1.0 - px.y / uImg.y)); }
vec4 eyelessPx(vec2 px) {
  return texture2D(uEyeless, vec2((px.x - uBox.x) / uBox.z, 1.0 - (px.y - uBox.y) / uBox.w));
}
vec3 rigCurves(int e, float x) {
  vec2 ex = uEyeX[e];
  float t = clamp((x - ex.x) / (ex.y - ex.x), 0.0, 1.0) * 47.0;
  int i0 = int(floor(t));
  int i1 = min(i0 + 1, 47);
  vec3 a = texelFetch(uCurves, ivec2(i0, e), 0).rgb;
  vec3 b = texelFetch(uCurves, ivec2(i1, e), 0).rgb;
  return mix(a, b, fract(t));
}

vec4 rigSample(vec2 px) {
  vec4 base = artPx(px);
  vec3 col = base.rgb;
  bool inBox = px.x >= uBox.x && px.y >= uBox.y && px.x <= uBox.x + uBox.z && px.y <= uBox.y + uBox.w;
  if (inBox) {
    for (int e = 0; e < 2; e++) {
      if (e >= uEyeCount) break;
      vec2 ex = uEyeX[e];
      if (px.x < ex.x - 0.5 || px.x > ex.y + 0.5) continue;
      vec3 c = rigCurves(e, px.x);
      float top = c.x, lid = c.y, low = c.z;
      if (px.y < top - 3.0 || px.y > low + 2.0) continue;
      float o = (e == 0) ? uOpen.x : uOpen.y;
      float T  = max(lid - top, 0.5);
      float Lb = mix(low - 0.35, lid, o);
      float Tn = T * (0.7 + 0.3 * o);
      float Lt = Lb - Tn;
      float m  = 1.2 * (1.0 - o);
      float sLt = smoothstep(Lt - 0.5, Lt + 0.5, px.y);
      float sLb = smoothstep(Lb - 0.5, Lb + 0.5, px.y);
      float wSkin = (1.0 - sLt) * smoothstep(top - m - 0.5, top - m + 0.5, px.y) * step(o, 0.999);
      float wLash = sLt * (1.0 - sLb);
      float wInt  = sLb * (1.0 - smoothstep(low - 0.1, low + 0.9, px.y));
      float wOrig = clamp(1.0 - wSkin - wLash - wInt, 0.0, 1.0);
      vec4 ir = uIris[e];
      float sc = ir.z / 8.0;
      vec2 dd = (px - ir.xy) / vec2(ir.z * 1.3, ir.z * 1.3 * ir.w);
      float w = 1.0 - smoothstep(0.45, 1.0, length(dd));
      w *= smoothstep(0.0, 1.6, px.y - Lb) * smoothstep(0.0, 1.6, low - px.y);
      vec2 q = px - uGaze * sc * w;
      float lashY = clamp(top + (px.y - Lt) * T / Tn, top - 0.5, lid + 0.5);
      vec3 r = eyelessPx(px).rgb * wSkin
             + artPx(vec2(px.x, lashY)).rgb * wLash
             + artPx(q).rgb * wInt
             + col * wOrig;
      float endw = smoothstep(ex.x - 0.5, ex.x + 1.5, px.x) * (1.0 - smoothstep(ex.y - 1.5, ex.y + 0.5, px.x));
      col = mix(col, r, endw);
    }
    col = mix(base.rgb, col, eyelessPx(px).a);   // alpha 0 = hair strand in front of the eye: keep original
  }
  if (uBlush > 0.001) {
    for (int e = 0; e < 2; e++) {
      if (e >= uEyeCount) break;
      vec4 ir = uIris[e];
      vec2 cc = ir.xy + vec2(0.0, 2.6 * ir.z);
      float d = length((px - cc) / vec2(2.3 * ir.z, 1.0 * ir.z));
      float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
      float mx = max(base.r, max(base.g, base.b)), mn = min(base.r, min(base.g, base.b));
      float sat = (mx - mn) / max(mx, 1e-4);
      float skin = smoothstep(0.45, 0.7, lum) * (1.0 - smoothstep(0.45, 0.7, sat));
      float k = (1.0 - smoothstep(0.15, 1.0, d)) * uBlush * 0.42 * skin;
      col = mix(col, col * vec3(1.0, 0.70, 0.72), k);
    }
  }
  return vec4(col, base.a);
}
`;

/** Build the uniforms for one outfit. `tex` = { art, eyeless } THREE.Textures. */
export function createRigUniforms(rd, tex) {
  const n = rd.eyes.length;
  const curves = new Float32Array(48 * 2 * 4);
  rd.eyes.forEach((e, k) => {
    for (let i = 0; i < 48; i++) {
      const o = (k * 48 + i) * 4;
      curves[o] = e.top[i]; curves[o + 1] = e.lid[i]; curves[o + 2] = e.low[i]; curves[o + 3] = 1;
    }
  });
  const curveTex = new THREE.DataTexture(curves, 48, 2, THREE.RGBAFormat, THREE.FloatType);
  curveTex.minFilter = curveTex.magFilter = THREE.NearestFilter;
  curveTex.needsUpdate = true;
  const eyeX = [new THREE.Vector2(), new THREE.Vector2()];
  const iris = [new THREE.Vector4(), new THREE.Vector4()];
  rd.eyes.forEach((e, k) => {
    eyeX[k].set(e.x0, e.x1);
    iris[k].set(e.iris[0], e.iris[1], e.iris[2], e.iris[3]);
  });
  const b = rd.faceBox;
  return {
    uArt: { value: tex.art },
    uEyeless: { value: tex.eyeless },
    uCurves: { value: curveTex },
    uImg: { value: new THREE.Vector2(rd.img[0], rd.img[1]) },
    uBox: { value: new THREE.Vector4(b[0], b[1], b[2], b[3]) },
    uEyeX: { value: eyeX },
    uIris: { value: iris },
    uEyeCount: { value: n },
    uOpen: { value: new THREE.Vector2(1, 1) },
    uGaze: { value: new THREE.Vector2(0, 0) },
    uBlush: { value: 0 },
  };
}

// ---------------------------------------------------------------------------------------------
// FaceController: natural blink timing, saccadic gaze, expressions. Drives any number of
// uniform sets (the same face can be on the acrylic print and on the 3D figure).

// Lids only move for a real blink, a wink, or a closed-eye smile: half-lowered lids held for
// seconds expose the inpainted skin, so emotion is carried by gaze + blush instead.
const EXPR = {
  neutral:  { open: [1, 1], blush: 0 },
  smile:    { open: [1, 1], blush: 0.18 },
  shy:      { open: [1, 1], blush: 0.9, look: [-1.9, 0.7] },
  pout:     { open: [1, 1], blush: 0.45, look: [1.7, 0.3] },
  wink:     { open: [0, 1], blush: 0.3 },
  content:  { open: [0, 0], blush: 0.4 },
  puzzled:  { open: [1, 1], blush: 0.2, look: [-1.7, -0.8] },
  surprised:{ open: [1, 1], blush: 0 },
};

const ease = (t) => t * t * (3 - 2 * t);

export class FaceController {
  constructor() {
    this.targets = [];
    this.open = [1, 1];
    this.exprOpen = [1, 1];
    this.blush = 0;
    this.expr = 'neutral';
    this.exprUntil = 0;
    this.gaze = new THREE.Vector2();
    this.gazeGoal = new THREE.Vector2();
    this.saccade = new THREE.Vector2();
    this.nextSaccade = 0;
    this.blinkT = null;
    this.blinkDelay = 0;
    this.blinkQueue = 0;
    this.nextBlink = 1.2;
    this.time = 0;
    this.enabled = true;
  }

  attach(uniforms) { if (!this.targets.includes(uniforms)) this.targets.push(uniforms); }
  detach(uniforms) { this.targets = this.targets.filter((u) => u !== uniforms); }

  /** gaze goal in iris-pixel units (≈ ±3.2 horizontal, ±1.6 vertical) */
  lookAt(gx, gy) { this.gazeGoal.set(gx, gy); }

  blink(double = false) {
    if (this.blinkT !== null || this.blinkDelay > 0) { if (double) this.blinkQueue = 1; return; }
    this.blinkT = 0;
    this.blinkQueue = double ? 1 : 0;
  }

  setExpression(name, seconds = 2.4) {
    this.expr = EXPR[name] ? name : 'neutral';
    this.exprUntil = this.time + seconds;
    if (name === 'surprised') this.blink(true);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.expr !== 'neutral' && t > this.exprUntil) this.expr = 'neutral';
    const ex = EXPR[this.expr];

    // expression easing
    const k = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < 2; i++) this.exprOpen[i] += (ex.open[i] - this.exprOpen[i]) * k;
    this.blush += (ex.blush - this.blush) * (1 - Math.exp(-dt * 3));

    // blink: close 75ms (accelerating), hold 45ms, open 125ms (decelerating)
    if (this.enabled && t > this.nextBlink && this.blinkT === null && this.blinkDelay <= 0) {
      this.blink(Math.random() < 0.14);
      this.nextBlink = t + 1.8 + Math.random() * 4.6;
    }
    let lid = 1;
    if (this.blinkT !== null) {
      this.blinkT += dt;
      const a = 0.075, h = 0.045, b = 0.125, bt = this.blinkT;
      if (bt < a) lid = 1 - ease(bt / a);
      else if (bt < a + h) lid = 0;
      else if (bt < a + h + b) lid = ease((bt - a - h) / b);
      else {
        this.blinkT = null;
        if (this.blinkQueue > 0) { this.blinkQueue--; this.blinkDelay = 0.09; }
      }
    } else if (this.blinkDelay > 0) {
      this.blinkDelay -= dt;
      if (this.blinkDelay <= 0) this.blinkT = 0;
    }

    this.open[0] = Math.min(this.exprOpen[0], 1) * lid;
    this.open[1] = Math.min(this.exprOpen[1], 1) * lid;

    // gaze: expression overrides, otherwise follow goal + tiny idle saccades
    const goal = ex.look ? new THREE.Vector2(ex.look[0], ex.look[1]) : this.gazeGoal;
    if (t > this.nextSaccade) {
      this.saccade.set((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.2);
      this.nextSaccade = t + 1.2 + Math.random() * 2.4;
    }
    const gx = goal.x + this.saccade.x, gy = goal.y + this.saccade.y;
    const gk = 1 - Math.exp(-dt * 11);
    this.gaze.x += (gx - this.gaze.x) * gk;
    this.gaze.y += (gy - this.gaze.y) * gk;

    for (const u of this.targets) {
      u.uOpen.value.set(this.open[0], this.open[1]);
      u.uGaze.value.copy(this.gaze);
      u.uBlush.value = this.blush;
    }
  }
}
