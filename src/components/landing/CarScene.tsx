import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CarFeature = "dpf" | "adblue" | "egr" | "pops" | "popcorn";

interface Props {
  active: CarFeature | null;
  labels: Record<CarFeature, string>;
}

// Car runs along X (front = +X), Y is up, Z is width (+Z = right side).
const COLORS: Record<CarFeature, number> = {
  dpf: 0xf97316,
  adblue: 0x3b82f6,
  egr: 0xeab308,
  pops: 0xef4444,
  popcorn: 0xef4444,
};

const ANCHORS: Record<CarFeature, THREE.Vector3> = {
  dpf: new THREE.Vector3(0.35, 0.37, 0.35),
  adblue: new THREE.Vector3(-1.75, 0.66, -0.4),
  egr: new THREE.Vector3(1.55, 1.12, 0),
  pops: new THREE.Vector3(-2.38, 0.38, 0.45),
  popcorn: new THREE.Vector3(-2.38, 0.38, 0.45),
};

const VIEWS: Record<CarFeature | "overview", { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: { pos: new THREE.Vector3(5.6, 2.8, 6.0), target: new THREE.Vector3(0, 0.6, 0) },
  dpf: { pos: new THREE.Vector3(0.9, 1.2, 4.6), target: new THREE.Vector3(0.1, 0.45, 0.3) },
  adblue: { pos: new THREE.Vector3(-3.4, 1.9, -4.0), target: new THREE.Vector3(-1.1, 0.5, -0.1) },
  egr: { pos: new THREE.Vector3(4.2, 3.0, 2.8), target: new THREE.Vector3(1.4, 0.9, 0.1) },
  pops: { pos: new THREE.Vector3(-5.8, 1.4, 3.0), target: new THREE.Vector3(-2.0, 0.5, 0.35) },
  popcorn: { pos: new THREE.Vector3(-5.8, 1.4, 3.0), target: new THREE.Vector3(-2.0, 0.5, 0.35) },
};

function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(2.2, 0.3);
  s.lineTo(1.88, 0.3);
  s.absarc(1.4, 0.38, 0.48, 0, Math.PI, false);
  s.lineTo(0.92, 0.3);
  s.lineTo(-0.92, 0.3);
  s.lineTo(-0.92, 0.38);
  s.absarc(-1.4, 0.38, 0.48, 0, Math.PI, false);
  s.lineTo(-1.88, 0.3);
  s.lineTo(-2.2, 0.32);
  s.lineTo(-2.28, 0.55);
  s.lineTo(-2.25, 0.85);
  s.lineTo(-2.05, 0.98);
  s.lineTo(-1.6, 1.0);
  s.quadraticCurveTo(-1.2, 1.3, -0.8, 1.4);
  s.lineTo(0.3, 1.42);
  s.quadraticCurveTo(0.7, 1.3, 1.05, 1.0);
  s.lineTo(1.9, 0.9);
  s.quadraticCurveTo(2.25, 0.85, 2.28, 0.6);
  s.lineTo(2.2, 0.3);
  return s;
}

function tube(points: number[][], radius: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 10, false), mat);
}

function canister(radius: number, length: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28), mat);
  m.rotation.z = Math.PI / 2;
  return m;
}

function flameTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,230,1)");
  grd.addColorStop(0.25, "rgba(255,190,80,0.9)");
  grd.addColorStop(0.6, "rgba(255,80,20,0.35)");
  grd.addColorStop(1, "rgba(255,40,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export const CarScene: React.FC<Props> = ({ active, labels }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef<CarFeature | null>(active);
  const viewChangedRef = useRef(true);

  useEffect(() => {
    activeRef.current = active;
    viewChangedRef.current = true;
    if (labelTextRef.current && active) {
      labelTextRef.current.textContent = labels[active];
    }
  }, [active, labels]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.copy(VIEWS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(VIEWS.overview.target);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.autoRotateSpeed = 0.6;
    // On phones a drag on the canvas would trap page scrolling; use the buttons there.
    controls.enabled = !coarse;
    if (coarse) renderer.domElement.style.touchAction = "pan-y";

    let tweening = true;
    controls.addEventListener("start", () => {
      tweening = false;
    });

    // ── Lights ──
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 3);
    scene.add(key);

    // ── Floor ──
    const grid = new THREE.GridHelper(14, 28, 0x3a3a3a, 0x262626);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.45, 1);
    shadow.position.y = 0.002;
    scene.add(shadow);

    // ── Body shell (x-ray) ──
    const depth = 1.5;
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.08,
      bevelSegments: 4,
      curveSegments: 24,
    });
    bodyGeo.translate(0, 0, -depth / 2);
    const shell = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0xdfe6ee,
        transparent: true,
        opacity: 0.07,
        roughness: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    scene.add(shell);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyGeo, 28),
      new THREE.LineBasicMaterial({ color: 0xe5e5e5, transparent: true, opacity: 0.4 })
    );
    scene.add(edges);

    // Window line on both sides
    const glassMat = new THREE.LineBasicMaterial({ color: 0xe5e5e5, transparent: true, opacity: 0.3 });
    for (const z of [0.88, -0.88]) {
      const pts = [
        [-1.5, 1.0], [-1.12, 1.27], [-0.8, 1.35], [0.3, 1.37], [0.65, 1.27], [0.95, 1.02], [-1.5, 1.0],
      ].map(([x, y]) => new THREE.Vector3(x, y, z));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), glassMat));
      const pillar = [new THREE.Vector3(-0.15, 1.0, z), new THREE.Vector3(-0.15, 1.37, z)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pillar), glassMat));
    }

    // Lights on the car for orientation
    for (const z of [0.55, -0.55]) {
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.08, 0.32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      head.position.set(2.29, 0.74, z);
      scene.add(head);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.07, 0.36),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      tail.position.set(-2.3, 0.84, z);
      scene.add(tail);
    }

    // ── Wheels ──
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 });
    for (const x of [1.4, -1.4]) {
      for (const z of [0.8, -0.8]) {
        const w = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 32), tireMat);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 20), rimMat);
        w.add(tire, rim);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.38, z);
        scene.add(w);
      }
    }

    // ── Drivetrain (neutral) ──
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.45 });
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.85), metal);
    engine.position.set(1.55, 0.72, 0);
    scene.add(engine);
    const turbo = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 12, 24), metal);
    turbo.position.set(1.15, 0.72, 0.42);
    scene.add(turbo);
    scene.add(
      tube(
        [
          [1.15, 0.65, 0.42], [1.0, 0.45, 0.4], [0.75, 0.37, 0.35], [0.0, 0.37, 0.35],
          [-1.0, 0.37, 0.35], [-1.9, 0.37, 0.4], [-2.3, 0.38, 0.45],
        ],
        0.045,
        metal
      )
    );

    // ── Feature parts ──
    const featureMats = {} as Record<CarFeature, THREE.MeshStandardMaterial>;
    (Object.keys(COLORS) as CarFeature[]).forEach((f) => {
      featureMats[f] = new THREE.MeshStandardMaterial({
        color: COLORS[f],
        emissive: COLORS[f],
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.5,
        transparent: true,
      });
    });

    const dpf = canister(0.15, 0.75, featureMats.dpf);
    dpf.position.copy(ANCHORS.dpf);
    scene.add(dpf);

    const scr = canister(0.14, 0.6, featureMats.adblue);
    scr.position.set(-0.65, 0.37, 0.35);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.42), featureMats.adblue);
    tank.position.set(-1.75, 0.5, -0.4);
    const doseLine = tube(
      [[-1.55, 0.45, -0.3], [-1.0, 0.39, -0.05], [-0.3, 0.39, 0.25], [-0.18, 0.43, 0.35]],
      0.018,
      featureMats.adblue
    );
    const injector = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 12), featureMats.adblue);
    injector.position.set(-0.18, 0.46, 0.35);
    scene.add(scr, tank, doseLine, injector);

    const egrTube = tube(
      [[1.12, 0.78, 0.38], [1.25, 1.0, 0.25], [1.55, 1.06, 0.0], [1.8, 0.96, -0.25]],
      0.035,
      featureMats.egr
    );
    const egrValve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 20), featureMats.egr);
    egrValve.position.set(1.55, 1.08, 0);
    scene.add(egrTube, egrValve);

    const tip = canister(0.065, 0.16, featureMats.pops);
    tip.position.set(-2.32, 0.38, 0.45);
    scene.add(tip);

    // ── Exhaust flames ──
    const flameTex = flameTexture();
    type P = { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number };
    const pool: P[] = [];
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flameTex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        })
      );
      s.visible = false;
      scene.add(s);
      pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1 });
    }
    const tipLight = new THREE.PointLight(0xff7a1a, 0, 3);
    tipLight.position.set(-2.5, 0.42, 0.45);
    scene.add(tipLight);
    let flash = 0;

    const burst = (count: number, power: number) => {
      let n = 0;
      for (const p of pool) {
        if (p.life > 0) continue;
        p.life = p.max = 0.12 + Math.random() * 0.18;
        p.s.position.set(-2.41, 0.38 + (Math.random() - 0.5) * 0.03, 0.45 + (Math.random() - 0.5) * 0.03);
        p.v.set(-(1.2 + Math.random() * 1.6) * power, (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * 0.6);
        p.s.visible = true;
        if (++n >= count) break;
      }
      flash = Math.max(flash, 1.6 * power);
    };

    let nextPop = 0;
    let popQueue = 0;
    let cutPhase = 0;

    // ── Label ──
    const anchorScreen = new THREE.Vector3();

    // ── Size ──
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      // Pull back on narrow screens so the whole car stays in frame.
      camera.zoom = w < 520 ? 0.72 : 1;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(wrap);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) {
        clock.getDelta();
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const cur = activeRef.current;

      if (viewChangedRef.current) {
        viewChangedRef.current = false;
        tweening = true;
        nextPop = t + 0.3;
        popQueue = 0;
        cutPhase = t;
      }

      const view = VIEWS[cur ?? "overview"];
      if (tweening) {
        const k = reduceMotion ? 1 : 1 - Math.pow(0.02, dt);
        camera.position.lerp(view.pos, k);
        controls.target.lerp(view.target, k);
        if (camera.position.distanceTo(view.pos) < 0.01) tweening = false;
      }
      controls.autoRotate = !cur && !tweening && !reduceMotion;

      // Highlight the active feature, fade the rest.
      (Object.keys(featureMats) as CarFeature[]).forEach((f) => {
        const m = featureMats[f];
        const on = cur === f || (cur === "popcorn" && f === "pops");
        const pulse = 0.55 + 0.35 * Math.sin(t * 4);
        m.emissiveIntensity = on ? pulse : cur ? 0.02 : 0.15;
        m.opacity = !cur || on ? 1 : 0.18;
      });

      // Exhaust: pops = irregular crackles on overrun, popcorn = rapid hardcut bursts.
      if (cur === "pops" && t >= nextPop) {
        if (popQueue <= 0) popQueue = 1 + Math.floor(Math.random() * 3);
        burst(10 + Math.floor(Math.random() * 8), 0.8 + Math.random() * 0.6);
        popQueue--;
        nextPop = t + (popQueue > 0 ? 0.08 + Math.random() * 0.12 : 0.7 + Math.random() * 0.9);
      }
      if (cur === "popcorn" && t >= nextPop) {
        const inCut = (t - cutPhase) % 2.2 < 1.4;
        if (inCut) {
          burst(7, 0.9);
          nextPop = t + 0.11;
        } else {
          nextPop = t + 0.1;
        }
      }

      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.s.visible = false;
          continue;
        }
        const a = p.life / p.max;
        p.s.position.addScaledVector(p.v, dt);
        p.s.scale.setScalar(0.12 + (1 - a) * 0.28);
        (p.s.material as THREE.SpriteMaterial).opacity = a;
      }
      flash *= Math.pow(0.002, dt);
      tipLight.intensity = flash * 3;

      controls.update();
      renderer.render(scene, camera);

      // Label follows the active part.
      const label = labelRef.current;
      if (label) {
        if (cur) {
          anchorScreen.copy(ANCHORS[cur]).project(camera);
          const x = (anchorScreen.x * 0.5 + 0.5) * wrap.clientWidth;
          const y = (-anchorScreen.y * 0.5 + 0.5) * wrap.clientHeight;
          label.style.opacity = "1";
          label.style.transform = `translate(${x}px, ${y}px)`;
        } else {
          label.style.opacity = "0";
        }
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      flameTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full h-full cursor-grab active:cursor-grabbing">
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 transition-opacity duration-300"
        style={{ opacity: 0 }}
      >
        <span className="absolute -left-[5px] -top-[5px] w-[10px] h-[10px] rounded-full border-2 border-white bg-[#d7261e]" />
        <span className="absolute left-0 top-0 w-12 h-px bg-white/70 origin-left -rotate-[35deg]" />
        <span
          ref={labelTextRef}
          className="absolute left-[38px] -top-[44px] whitespace-nowrap font-tech text-[11px] uppercase tracking-wider bg-white text-black px-2 py-1"
        />
      </div>
    </div>
  );
};

export default CarScene;
