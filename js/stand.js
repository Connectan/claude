// Acrylic stand ("アクスタ"): the original illustration printed inside a clear acrylic slab
// cut along the character's silhouette, standing in an acrylic base. Works with zero 3D data,
// and the printed face is fully rigged (blink / gaze / blush).
import * as THREE from '../vendor/three/three.module.min.js';
import { RIG_GLSL, createRigUniforms } from './rig.js';

export const PRINT_HEIGHT = 2.0;       // world units for the full source image height
const SLAB = 0.05;                     // acrylic thickness
const BASE_H = 0.07;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
${RIG_GLSL}
uniform float uFade;
varying vec2 vUv;
void main() {
  vec2 px = vec2(vUv.x * uImg.x, (1.0 - vUv.y) * uImg.y);
  vec4 c = rigSample(px);
  float a = c.a * uFade;
  if (a < 0.5) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <colorspace_fragment>
}`;

export function pxToLocal(rd, px, py, out = new THREE.Vector3()) {
  const [W, H] = rd.img;
  const s = PRINT_HEIGHT / H;
  const yOff = 0.035 - (0.5 - rd.bbox[3] / H) * PRINT_HEIGHT;  // tab bottom sits in the base slot
  return out.set((px / W - 0.5) * W * s, (0.5 - py / H) * PRINT_HEIGHT + yOff, 0);
}

export function buildStand(rd, tex) {
  const [W, H] = rd.img;
  const s = PRINT_HEIGHT / H;
  const group = new THREE.Group();
  group.name = 'stand';

  // ---- printed illustration (opaque + alpha-to-coverage so it shows through the acrylic) ----
  const uniforms = createRigUniforms(rd, tex);
  uniforms.uFade = { value: 1 };
  const printMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.DoubleSide, alphaToCoverage: true,
  });
  const center = pxToLocal(rd, W / 2, H / 2);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(W * s, PRINT_HEIGHT), printMat);
  print.position.copy(center);
  print.name = 'print';
  group.add(print);

  // ---- acrylic slab cut along the outline ----
  const shape = new THREE.Shape(rd.outline.map(([x, y]) => {
    const v = pxToLocal(rd, x, y);
    return new THREE.Vector2(v.x, v.y);
  }));
  const slabGeo = new THREE.ExtrudeGeometry(shape, {
    depth: SLAB, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 4,
  });
  slabGeo.translate(0, 0, -SLAB / 2);
  const mats = acrylicMaterials();
  const slab = new THREE.Mesh(slabGeo, [mats.fill, mats.edge]);
  slab.name = 'slab';
  slab.renderOrder = 2;
  const gloss = new THREE.Mesh(slabGeo, mats.gloss);
  gloss.renderOrder = 3;
  gloss.raycast = () => {};
  group.add(slab, gloss);

  // ---- base ----
  const xs = rd.outline.map(([x]) => x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const figW = (maxX - minX) * s;
  const bw = Math.max(0.95, Math.min(figW * 0.78, 1.5)), bd = 0.62;
  const r = 0.16;
  const bs = new THREE.Shape();
  bs.moveTo(-bw / 2 + r, -bd / 2);
  bs.lineTo(bw / 2 - r, -bd / 2); bs.quadraticCurveTo(bw / 2, -bd / 2, bw / 2, -bd / 2 + r);
  bs.lineTo(bw / 2, bd / 2 - r); bs.quadraticCurveTo(bw / 2, bd / 2, bw / 2 - r, bd / 2);
  bs.lineTo(-bw / 2 + r, bd / 2); bs.quadraticCurveTo(-bw / 2, bd / 2, -bw / 2, bd / 2 - r);
  bs.lineTo(-bw / 2, -bd / 2 + r); bs.quadraticCurveTo(-bw / 2, -bd / 2, -bw / 2 + r, -bd / 2);
  const baseGeo = new THREE.ExtrudeGeometry(bs, {
    depth: BASE_H, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 10,
  });
  baseGeo.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseGeo, [mats.baseFill, mats.baseEdge]);
  base.position.y = -0.012;
  base.renderOrder = 2;
  const baseGloss = new THREE.Mesh(baseGeo, mats.baseGloss);
  baseGloss.position.copy(base.position);
  baseGloss.renderOrder = 3;
  baseGloss.raycast = () => {};
  group.add(baseGloss);
  const tab = pxToLocal(rd, (minX + maxX) / 2, rd.bbox[3]);
  base.position.x = tab.x * 0.0; // keep the base centred under the figure's mass
  base.name = 'base';
  group.add(base);

  // floor contact shadow
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(bw * 2.4, bd * 3.2), new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55,
  }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = -0.013;
  sh.renderOrder = -1;
  group.add(sh);

  // anchors for the speech bubble / gaze
  const eyes = rd.eyes.map((e) => e.iris);
  const fx = eyes.reduce((a, e) => a + e[0], 0) / eyes.length;
  const fy = eyes.reduce((a, e) => a + e[1], 0) / eyes.length;
  const face = pxToLocal(rd, fx, fy);
  const head = pxToLocal(rd, fx, fy - H * 0.085);
  const top = pxToLocal(rd, fx, Math.min(...rd.outline.map((p) => p[1])));
  const bottom = pxToLocal(rd, fx, rd.bbox[3]);

  return {
    group, uniforms, print, slab, base,
    anchors: { face, head, top, bottom, height: top.y - bottom.y, width: figW },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      uniforms.uCurves.value.dispose();
    },
  };
}

// Clear acrylic without a transmission pass: a faint tint (normal blend) + environment
// reflections added on top (additive, black albedo so only the specular survives) + brighter
// polished edges. Reads as clear plastic on both the light and dark page backgrounds.
function acrylicMaterials() {
  const fill = new THREE.MeshBasicMaterial({
    color: 0xeef6ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
  });
  const baseFill = new THREE.MeshBasicMaterial({
    color: 0xe6f0f8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  });
  // polished edges: a cool grey that reads on both the cream and the dark backdrop
  const edge = new THREE.MeshPhysicalMaterial({
    color: 0xb9c7d2, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.55,
    envMapIntensity: 0.9, depthWrite: false,
  });
  // additive in colour only: the canvas is transparent over the CSS backdrop, so adding to the
  // alpha channel would turn the slab into an opaque sheet. Plain dielectric (F0 = 4%).
  const gloss = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.06, metalness: 0, ior: 1.49, specularIntensity: 1,
    envMapIntensity: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  // on the cream page, grazing reflections on the base top read as a solid white slab: damp them
  const light = !matchMedia('(prefers-color-scheme: dark)').matches;
  gloss.envMapIntensity = light ? 0.3 : 0.55;
  const baseGloss = gloss.clone();
  baseGloss.envMapIntensity = light ? 0.12 : 0.4;
  const baseEdge = edge.clone();
  baseEdge.opacity = light ? 0.38 : 0.55;
  if (light) { baseFill.color.set(0xb7c4cf); baseFill.opacity = 0.13; }
  return { fill, baseFill, edge, gloss, baseGloss, baseEdge };
}

let _shadow;
function shadowTexture() {
  if (_shadow) return _shadow;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, 'rgba(40,22,12,0.55)');
  grd.addColorStop(0.35, 'rgba(40,22,12,0.28)');
  grd.addColorStop(1, 'rgba(40,22,12,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  _shadow = new THREE.CanvasTexture(c);
  _shadow.colorSpace = THREE.SRGBColorSpace;
  return _shadow;
}
