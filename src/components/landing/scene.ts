import * as THREE from 'three';
import { G_ANCHORS, gx, oy, pz, U_PLANE_Z, Z_UNSTATED, type SceneInput } from './sceneData';

/**
 * Condition space: a three.js scene driven by scroll progress. Hairline grids, fog into the background colour,
 * size-attenuated points; no bloom, no emissive glow. All text lives in DOM overlays positioned from here.
 */

const PAPER = new THREE.Color('#F3F0E8');
const NIGHT = new THREE.Color('#0D0D0C');
const INK = new THREE.Color('#141413');
const NIGHT_INK = new THREE.Color('#ECE8DE');
const COBALT = new THREE.Color('#1F3A93');
const COBALT_NIGHT = new THREE.Color('#8EA2F0');
const SIGNAL = new THREE.Color('#E34A1E');

export const STOPS = [0, 0.16, 0.32, 0.48, 0.64, 0.8, 0.96];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface FrameState {
  p: number;
  darkness: number;
  bg: string;
}

export interface SceneHandle {
  dispose(): void;
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  input: SceneInput;
  labels: Record<string, HTMLElement | null>;
  getProgress: () => number;
  onFrame: (s: FrameState) => void;
  reducedPointer: boolean;
}

interface Keyframe {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

export function createScene(opts: SceneOptions): SceneHandle {
  const { canvas, container, input, labels, getProgress, onFrame } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER.clone(), 14, 34);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  const world = new THREE.Group();
  scene.add(world);

  const lineMats: Array<{ mat: THREE.LineBasicMaterial; base: number }> = [];
  const lineMat = (opacity: number) => {
    const mat = new THREE.LineBasicMaterial({ color: INK.clone(), transparent: true, opacity, depthWrite: false });
    lineMats.push({ mat, base: opacity });
    return mat;
  };
  const segs = (pts: number[][], mat: THREE.LineBasicMaterial) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const l = new THREE.LineSegments(g, mat);
    world.add(l);
    return l;
  };

  // Gravity planes: a hairline lattice at each labelled gravity level.
  const gridMat = lineMat(0.12);
  const edgeMat = lineMat(0.42);
  const zTicks = [30, 50, 100, 200].map(pz);
  const yTicks = [20, 30, 40, 50, 60, 70, 80, 90].map(oy);
  for (const g of G_ANCHORS) {
    const x = gx(g);
    const grid: number[][] = [];
    for (const y of yTicks) grid.push([x, y, -4], [x, y, 4]);
    for (const z of zTicks) grid.push([x, -4, z], [x, 4, z]);
    segs(grid, gridMat);
    segs(
      [
        [x, -4, -4], [x, 4, -4], [x, 4, -4], [x, 4, 4], [x, 4, 4], [x, -4, 4], [x, -4, 4], [x, -4, -4],
      ],
      edgeMat,
    );
  }
  // Floor rails connecting the planes.
  const floor: number[][] = [];
  for (const z of [-4, ...zTicks, 4]) floor.push([-6, -4, z], [6, -4, z]);
  segs(floor, gridMat);
  // Back plane for findings that do not state pressure.
  const backMat = lineMat(0.16);
  const back: number[][] = [[-6, -4, Z_UNSTATED], [6, -4, Z_UNSTATED], [6, -4, Z_UNSTATED], [6, 4, Z_UNSTATED], [6, 4, Z_UNSTATED], [-6, 4, Z_UNSTATED], [-6, 4, Z_UNSTATED], [-6, -4, Z_UNSTATED]];
  for (const y of yTicks) back.push([-6, y, Z_UNSTATED], [6, y, Z_UNSTATED]);
  segs(back, backMat);

  // Lunar slab (0.05–0.27 g).
  const x0 = gx(0.05);
  const x1 = gx(0.27);
  const slabMat = new THREE.MeshBasicMaterial({ color: INK.clone(), transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 8, 8), slabMat);
  slab.position.set((x0 + x1) / 2, 0, 0);
  world.add(slab);
  const slabEdgeMat = lineMat(0.0);
  const slabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), slabEdgeMat);
  slabEdges.position.copy(slab.position);
  world.add(slabEdges);

  // Points: cobalt fill = PSI-backed, vermilion outline = non-PSI / analogue; size by tier, size-attenuated.
  const n = input.points.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const kind = new Float32Array(n);
  input.points.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    size[i] = p.tier === 1 ? 17 : p.tier === 2 ? 13.5 : p.tier === 3 ? 11 : 9;
    kind[i] = p.psi ? 0 : 1;
  });
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCobalt: { value: COBALT.clone() },
      uSignal: { value: SIGNAL.clone() },
      uPR: { value: renderer.getPixelRatio() },
      uScale: { value: 14 },
      uFogNear: { value: 14 },
      uFogFar: { value: 34 },
    },
    vertexShader: `
      attribute float size; attribute float kind;
      uniform float uPR; uniform float uScale;
      varying float vKind; varying float vDepth;
      void main() {
        vKind = kind;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_PointSize = size * uPR * (uScale / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uCobalt; uniform vec3 uSignal; uniform float uFogNear; uniform float uFogFar;
      varying float vKind; varying float vDepth;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float edge = 1.0 - smoothstep(0.44, 0.5, d);
        if (edge <= 0.0) discard;
        vec3 col = uCobalt;
        float a = edge;
        if (vKind > 0.5) { col = uSignal; a *= smoothstep(0.30, 0.35, d); }
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        a *= 1.0 - fog * 0.85;
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  world.add(new THREE.Points(pGeo, pMat));

  // Mission rings (billboarded); Artemis in vermilion.
  const ringObjs: Array<{ obj: THREE.Object3D; mats: THREE.LineBasicMaterial[] }> = [];
  const circle = (r: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) pts.push(new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * r, Math.sin((i / 64) * Math.PI * 2) * r, 0));
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  for (const r of input.rings) {
    const g = new THREE.Group();
    g.position.set(r.x, r.y, r.z);
    const mats: THREE.LineBasicMaterial[] = [];
    if (r.highlight) {
      for (const rad of [0.34, 0.46]) {
        const m = new THREE.LineBasicMaterial({ color: SIGNAL.clone(), transparent: true, opacity: 1, depthWrite: false });
        g.add(new THREE.Line(circle(rad), m));
      }
    } else {
      const m = lineMat(0.55);
      mats.push(m);
      g.add(new THREE.Line(circle(0.3), m));
    }
    world.add(g);
    ringObjs.push({ obj: g, mats });
  }

  // Schematic U-curve on the side plane, drawn by scroll; vermilion only on the lunar point.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(gx(0), 3.4, U_PLANE_Z),
    new THREE.Vector3(gx(0.06), 0.2, U_PLANE_Z),
    new THREE.Vector3(gx(0.17), -2.5, U_PLANE_Z),
    new THREE.Vector3(gx(0.38), -1.6, U_PLANE_Z),
    new THREE.Vector3(gx(0.7), 0.0, U_PLANE_Z),
    new THREE.Vector3(gx(1), 1.4, U_PLANE_Z),
  ]);
  const uPts = curve.getPoints(160);
  const uGeo = new THREE.BufferGeometry().setFromPoints(uPts);
  const uMat = lineMat(0.95);
  const uLine = new THREE.Line(uGeo, uMat);
  uGeo.setDrawRange(0, 0);
  world.add(uLine);
  const uFrameMat = lineMat(0.0);
  segs([[-6, -4, U_PLANE_Z], [6, -4, U_PLANE_Z], [-6, -4, U_PLANE_Z], [-6, 4, U_PLANE_Z]], uFrameMat);
  const lunarDotMat = new THREE.LineBasicMaterial({ color: SIGNAL.clone(), transparent: true, opacity: 0, depthWrite: false });
  const lunarDot = new THREE.Line(circle(0.16), lunarDotMat);
  lunarDot.position.set(gx(0.17), -2.5, U_PLANE_Z);
  world.add(lunarDot);

  // Camera keyframes.
  const a = input.artemis ?? { x: gx(0.17), y: oy(34), z: pz(56.5) };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const KF: Keyframe[] = [
    { pos: V(0, 1.2, 19), target: V(0, 0, 0) },
    { pos: V(12.5, 2.4, 9.5), target: V(6, 0, 0) },
    { pos: V(-12.5, 2.8, 9), target: V(-6, 0, 0) },
    { pos: V(gx(0.17) + 0.6, 2.6, 10.5), target: V(gx(0.17), 0, 0) },
    { pos: V(a.x + 2.2, a.y + 1.2, a.z + 3.6), target: V(a.x, a.y, a.z) },
    { pos: V(0, 0, 17.5), target: V(0, 0, U_PLANE_Z) },
    { pos: V(0, 0.2, 24), target: V(0, 0, 0) },
  ];
  const camPos = KF[0].pos.clone();
  const camTarget = KF[0].target.clone();
  const goalPos = new THREE.Vector3();
  const goalTarget = new THREE.Vector3();

  // Labels projected from world anchors.
  const anchors: Array<{ key: string; v: THREE.Vector3; show: (p: number) => number }> = [
    ...G_ANCHORS.map((g) => ({ key: `g${g}`, v: V(gx(g), 4.55, 4), show: (p: number) => smooth(0.09, 0.15, p) * (1 - smooth(0.9, 0.95, p)) })),
    { key: 'o2lo', v: V(-6.4, -4, 4), show: (p) => smooth(0.1, 0.16, p) * (1 - smooth(0.9, 0.95, p)) },
    { key: 'o2hi', v: V(-6.4, 4, 4), show: (p) => smooth(0.1, 0.16, p) * (1 - smooth(0.9, 0.95, p)) },
    { key: 'kpa', v: V(6.3, -4.3, 0), show: (p) => smooth(0.1, 0.16, p) * (1 - smooth(0.9, 0.95, p)) },
    { key: 'unstated', v: V(-6, 4.4, Z_UNSTATED), show: (p) => smooth(0.2, 0.28, p) * (1 - smooth(0.42, 0.48, p)) },
    { key: 'artemis', v: V(a.x + 0.55, a.y + 0.55, a.z), show: (p) => smooth(0.55, 0.62, p) * (1 - smooth(0.72, 0.78, p)) },
    { key: 'schematic', v: V(0, -4.5, U_PLANE_Z), show: (p) => smooth(0.72, 0.78, p) * (1 - smooth(0.88, 0.93, p)) },
    { key: 'lunarpoint', v: V(gx(0.17) + 0.3, -2.9, U_PLANE_Z), show: (p) => smooth(0.76, 0.8, p) * (1 - smooth(0.88, 0.93, p)) },
  ];
  const tmp = new THREE.Vector3();

  let width = 1;
  let height = 1;
  const resize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = 14 * (height / 900);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // Pointer parallax (max ~3°), eased; disabled for touch and reduced motion.
  let tiltX = 0;
  let tiltY = 0;
  let goalTiltX = 0;
  let goalTiltY = 0;
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || opts.reducedPointer) return;
    goalTiltY = ((e.clientX / window.innerWidth) * 2 - 1) * 0.052;
    goalTiltX = ((e.clientY / window.innerHeight) * 2 - 1) * 0.035;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(container);

  const bg = new THREE.Color();
  const lineCol = new THREE.Color();
  const cob = new THREE.Color();
  let raf = 0;
  let last = performance.now();
  const t0 = last;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = getProgress();

    // Keyframe interpolation (eased), then damped follow.
    let i = 0;
    while (i < STOPS.length - 2 && p > STOPS[i + 1]) i++;
    const t = easeInOut(Math.min(1, Math.max(0, (p - STOPS[i]) / (STOPS[i + 1] - STOPS[i]))));
    goalPos.lerpVectors(KF[i].pos, KF[i + 1].pos, t);
    goalTarget.lerpVectors(KF[i].target, KF[i + 1].target, t);
    const fit = Math.min(1.9, Math.max(1, 1.55 / Math.max(0.3, camera.aspect)));
    if (fit > 1) goalPos.sub(goalTarget).multiplyScalar(fit).add(goalTarget);
    const k = 1 - Math.exp(-dt * 5);
    camPos.lerp(goalPos, k);
    camTarget.lerp(goalTarget, k);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // Idle rotation + pointer tilt, only in the hero.
    const idle = 1 - smooth(0, 0.07, p);
    tiltX += (goalTiltX - tiltX) * k;
    tiltY += (goalTiltY - tiltY) * k;
    const el = (now - t0) / 1000;
    world.rotation.y = idle * (Math.sin(el * 0.08) * 0.22 + tiltY);
    world.rotation.x = idle * tiltX;

    // Paper → night → paper.
    const darkness = smooth(0.03, 0.12, p) * (1 - smooth(0.88, 0.94, p));
    bg.copy(PAPER).lerp(NIGHT, darkness);
    (scene.fog as THREE.Fog).color.copy(bg);
    lineCol.copy(INK).lerp(NIGHT_INK, darkness);
    for (const { mat, base } of lineMats) {
      mat.color.copy(lineCol);
      mat.opacity = base;
    }
    cob.copy(COBALT).lerp(COBALT_NIGHT, darkness);
    pMat.uniforms.uCobalt.value.copy(cob);

    // Lunar slab emphasis around chapter c; U-curve draws in chapter e.
    const slabOn = smooth(0.4, 0.47, p) * (1 - smooth(0.6, 0.66, p));
    slabMat.color.copy(lineCol);
    slabMat.opacity = 0.07 * slabOn;
    slabEdgeMat.opacity = 0.75 * slabOn;
    const draw = smooth(0.7, 0.82, p);
    uGeo.setDrawRange(0, Math.floor(draw * uPts.length));
    uFrameMat.opacity = 0.45 * smooth(0.7, 0.74, p) * (1 - smooth(0.9, 0.94, p));
    uMat.opacity = 0.95 * (1 - smooth(0.9, 0.94, p));
    lunarDotMat.opacity = smooth(0.78, 0.82, p) * (1 - smooth(0.9, 0.94, p));
    lunarDot.quaternion.copy(camera.quaternion);
    for (const r of ringObjs) r.obj.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);

    // DOM labels.
    for (const an of anchors) {
      const node = labels[an.key];
      if (!node) continue;
      tmp.copy(an.v).applyMatrix4(world.matrixWorld).project(camera);
      const on = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      const o = on ? an.show(p) : 0;
      node.style.opacity = String(o);
      node.style.transform = `translate(${((tmp.x + 1) / 2) * width}px, ${((1 - tmp.y) / 2) * height}px)`;
      node.style.color = darkness > 0.5 ? '#ECE8DE' : '#141413';
    }

    onFrame({ p, darkness, bg: `#${bg.getHexString()}` });
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
