import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { PIECES, modelSrc, imageSrc, isModel, type Piece } from "../data/pieces";
import { loadNormalized, frame } from "../three/baker";
import { useCart } from "../lib/cart";
import { Thumb } from "../components/Thumb";
import { t } from "../lib/locale";

/* 뷰어. 산 에셋을 뜯어보는 자리다.

   마켓의 썸네일은 파는 쪽이 고른 각도이고, 여기서는 사는 쪽이 보고 싶은 대로 본다.
   그래서 각도·재질·와이어프레임을 직접 만질 수 있어야 한다.

   3D, 2D, VR 셋을 한 화면에 둔 이유는 같은 에셋을 보는 방식만 다르기 때문이다.
   에셋 종류에 따라 쓸 수 있는 탭이 갈린다 — 도트에 VR 은 의미가 없다. */

type Tab = "3D" | "2D" | "VR";

export function Viewer() {
  const { ids: cartIds } = useCart();
  const pool = useMemo(() => {
    const inCart = PIECES.filter((p) => cartIds.includes(p.id));
    return inCart.length ? inCart : PIECES.slice(0, 12);
  }, [cartIds]);

  const [pieceId, setPieceId] = useState(() => pool[0]?.id ?? 1);
  const piece = pool.find((p) => p.id === pieceId) ?? pool[0]!;
  const [tab, setTab] = useState<Tab>("3D");

  /* 3D 가 없는 도트 상품은 2D 로만 본다. 탭이 남아 있으면 빈 화면이 나온다. */
  const can: Record<Tab, boolean> = {
    "3D": isModel(piece),
    "2D": true,
    VR: isModel(piece),
  };
  useEffect(() => {
    if (!can[tab]) setTab("2D");
  }, [pieceId]);

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">{t("AI 뷰어")}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t("에셋 뜯어보기")}</h1>
        <p className="mt-2 text-xs text-muted">{t("각도와 재질을 직접 만져 보고 삽니다.")}</p>
      </header>

      {/* 무엇을 볼지 */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-faint">{cartIds.length ? t("장바구니") : t("마켓 상위")}</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pool.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPieceId(p.id)}
              aria-pressed={p.id === piece.id}
              className={[
                "w-20 flex-none cursor-pointer overflow-hidden rounded-lg border bg-surface p-1.5",
                p.id === piece.id ? "border-accent" : "border-line hover:border-chrome-600",
              ].join(" ")}
            >
              <span className="relative block aspect-square">
                <Thumb piece={p} pad="8%" />
              </span>
              <span className="block truncate pt-1 text-[10px] text-faint">{p.t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 어떻게 볼지 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["3D", "2D", "VR"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={!can[t]}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40",
              tab === t
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-faint">{piece.t}</span>
      </div>

      {tab === "3D" && <Viewer3D piece={piece} />}
      {tab === "2D" && <Viewer2D piece={piece} />}
      {tab === "VR" && <ViewerVR piece={piece} />}
    </main>
  );
}

/* ── 3D ─────────────────────────────────────────────────────────────── */

const SHADING = [
  ["pbr", "재질"],
  ["wire", "와이어프레임"],
  ["normal", "노멀"],
  ["flat", "면"],
] as const;
type Shading = (typeof SHADING)[number][0];

function Viewer3D({ piece }: { piece: Piece }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [shading, setShading] = useState<Shading>("pbr");
  const [spin, setSpin] = useState(true);
  const [stat, setStat] = useState<{ tri: number; mat: number } | null>(null);
  const shadeRef = useRef(shading);
  const spinRef = useRef(spin);
  shadeRef.current = shading;
  spinRef.current = spin;

  useEffect(() => {
    const canvas = ref.current;
    const url = modelSrc(piece);
    if (!canvas || !url) return;

    let raf = 0;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;

    void (async () => {
      const node = await loadNormalized(url);
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2d38, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(2.6, 4.2, 3.2);
      const rim = new THREE.DirectionalLight(0x7d59ea, 1.6);
      rim.position.set(-3, 1.2, -2.6);
      scene.add(key, rim);
      scene.add(node);

      /* 원본 재질을 들고 있어야 재질 보기로 되돌아올 수 있다. */
      const originals: { mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
      let tri = 0;
      let mats = 0;
      node.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        originals.push({ mesh: o, mat: o.material });
        const g = o.geometry;
        tri += g.index ? g.index.count / 3 : g.attributes.position!.count / 3;
        mats += Array.isArray(o.material) ? o.material.length : 1;
      });
      setStat({ tri: Math.round(tri), mat: mats });

      const camera = new THREE.PerspectiveCamera(35, 16 / 10, 0.01, 100);
      const sphere = frame(camera, node, [1.3, 0.85, 1.6], 1.3);

      controls = new OrbitControls(camera, canvas);
      controls.target.copy(sphere.center);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = sphere.radius * 1.1;
      controls.maxDistance = sphere.radius * 8;
      controls.update();

      let applied: Shading | null = null;
      const apply = (mode: Shading) => {
        for (const { mesh, mat } of originals) {
          if (mode === "pbr") mesh.material = mat;
          else if (mode === "wire")
            mesh.material = new THREE.MeshBasicMaterial({ color: 0x7d59ea, wireframe: true });
          else if (mode === "normal") mesh.material = new THREE.MeshNormalMaterial();
          else mesh.material = new THREE.MeshStandardMaterial({ color: 0xb7b7c9, flatShading: true });
        }
      };

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!renderer) return;
        if (applied !== shadeRef.current) {
          apply(shadeRef.current);
          applied = shadeRef.current;
        }
        /* 자동 회전은 손을 대는 순간 멈춘다. 만지는 중에 돌면 조작이 어긋난다. */
        if (controls) controls.autoRotate = spinRef.current;
        controls?.update();

        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      if (controls) controls.autoRotateSpeed = 1.2;
      loop();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls?.dispose();
      renderer?.dispose();
    };
  }, [piece]);

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
        <canvas ref={ref} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SHADING.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setShading(k)}
            aria-pressed={shading === k}
            className={[
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs",
              shading === k ? "border-accent text-ink" : "border-line text-faint hover:text-ink",
            ].join(" ")}
          >
            {t(label)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSpin((v) => !v)}
          aria-pressed={spin}
          className={[
            "cursor-pointer rounded-lg border px-3 py-1.5 text-xs",
            spin ? "border-accent text-ink" : "border-line text-faint hover:text-ink",
          ].join(" ")}
        >
          {t("자동 회전")}
        </button>

        {stat && (
          <span className="ml-auto text-xs text-faint">
            {t("삼각면")} <b className="num text-ink">{stat.tri.toLocaleString("ko-KR")}</b>
            <span className="mx-2">·</span>
            {t("머티리얼")} <b className="num text-ink">{stat.mat}</b>
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-faint">{t("끌어서 돌리고 휠로 확대합니다.")}</p>
    </div>
  );
}

/* ── 2D ─────────────────────────────────────────────────────────────── */

function Viewer2D({ piece }: { piece: Piece }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(4);
  const [grid, setGrid] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  /* 3D 상품은 한 컷 구워서 본다. 2D 뷰어의 목적은 픽셀을 보는 것이라
     소스가 무엇이든 결국 그림 한 장이면 된다. */
  useEffect(() => {
    let alive = true;
    const flat = imageSrc(piece);
    if (flat) {
      setSrc(flat);
      return;
    }
    const url = modelSrc(piece);
    if (!url) return;
    void import("../three/baker").then(({ bakeView }) =>
      bakeView(url, [1.3, 0.85, 1.6], "pbr").then((u) => alive && setSrc(u)),
    );
    return () => {
      alive = false;
    };
  }, [piece]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return;
    const img = new Image();
    img.onload = () => {
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      host.replaceChildren(img);
    };
    img.src = src;
    img.className = "block max-w-none";
    img.style.imageRendering = "pixelated";
  }, [src]);

  useEffect(() => {
    const img = hostRef.current?.firstElementChild as HTMLImageElement | undefined;
    if (!img || !size) return;
    img.style.width = `${size.w * zoom}px`;
    img.style.height = `${size.h * zoom}px`;
    /* 알파 보기는 배경을 지워 투명 영역을 드러낸다. 도트는 여백이 곧 품질이다. */
    img.style.filter = alpha ? "grayscale(1) brightness(3)" : "none";
  }, [zoom, alpha, size]);

  return (
    <div>
      <div
        className="relative aspect-[16/10] overflow-auto rounded-2xl border border-line"
        style={{
          background: grid
            ? "repeating-conic-gradient(var(--surface-2) 0% 25%, var(--ground) 0% 50%) 50% / 16px 16px"
            : "var(--surface)",
        }}
      >
        <div ref={hostRef} className="grid min-h-full min-w-full place-items-center p-6" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2.5 text-xs text-faint">
          {t("배율")}
          <input
            type="range"
            min={1}
            max={12}
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
            className="w-32 accent-[var(--accent)]"
          />
          <b className="num text-ink">{zoom}×</b>
        </label>

        {[
          [grid, setGrid, "격자"],
          [alpha, setAlpha, "알파"],
        ].map(([on, set, label], i) => (
          <button
            key={i}
            type="button"
            onClick={() => (set as (v: boolean) => void)(!(on as boolean))}
            aria-pressed={on as boolean}
            className={[
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs",
              on ? "border-accent text-ink" : "border-line text-faint hover:text-ink",
            ].join(" ")}
          >
            {label as string}
          </button>
        ))}

        {size && (
          <span className="ml-auto text-xs text-faint">
            {t("원본")} <b className="num text-ink">{size.w}×{size.h}</b>
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-faint">{t("배율을 올리면 픽셀 경계가 그대로 드러납니다.")}</p>
    </div>
  );
}

/* ── VR ─────────────────────────────────────────────────────────────── */

function ViewerVR({ piece }: { piece: Piece }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    /* WebXR 이 없는 브라우저가 아직 많다. 버튼을 띄우기 전에 물어본다. */
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr;
    if (!xr) {
      setSupported(false);
      return;
    }
    xr.isSessionSupported("immersive-vr").then(setSupported).catch(() => setSupported(false));
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const url = modelSrc(piece);
    if (!canvas || !url || supported === null) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let button: HTMLElement | null = null;

    void (async () => {
      const node = await loadNormalized(url);
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.xr.enabled = true;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2d38, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(2, 4, 3);
      scene.add(key);

      /* 헤드셋 안에서는 실제 크기가 중요하다. 1.4m 높이에 60cm 크기로 세운다 —
         손에 드는 물건을 눈높이에 두면 크기 감각이 틀어진다. */
      const stand = new THREE.Group();
      stand.add(node);
      stand.scale.setScalar(0.6);
      stand.position.set(0, 1.4, -1.2);
      scene.add(stand);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(3, 48),
        new THREE.MeshBasicMaterial({ color: 0x31313c, transparent: true, opacity: 0.35 }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const camera = new THREE.PerspectiveCamera(60, 16 / 10, 0.05, 40);
      camera.position.set(0, 1.6, 0.6);

      if (supported && btnRef.current) {
        button = VRButton.createButton(renderer);
        button.style.position = "static";
        button.style.width = "auto";
        button.style.padding = "10px 20px";
        button.style.font = "inherit";
        button.style.border = "0";
        button.style.borderRadius = "8px";
        button.style.background = "var(--accent)";
        button.style.color = "#fff";
        button.style.opacity = "1";
        btnRef.current.replaceChildren(button);
      }

      renderer.setAnimationLoop(() => {
        if (!renderer) return;
        if (!renderer.xr.isPresenting) {
          const w = canvas.clientWidth || 1;
          const h = canvas.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          stand.rotation.y += 0.004;
        }
        renderer.render(scene, camera);
      });
    })();

    return () => {
      disposed = true;
      renderer?.setAnimationLoop(null);
      renderer?.dispose();
      button?.remove();
    };
  }, [piece, supported]);

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
        <canvas ref={ref} className="h-full w-full" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div ref={btnRef} className="[&_button]:cursor-pointer" />
        <span className="text-xs text-faint">
          {supported === null
            ? "기기를 확인하는 중입니다"
            : supported
              ? "헤드셋에서 실제 크기로 봅니다. 눈높이 1.4m, 60cm 크기로 세웁니다."
              : "이 브라우저는 WebXR 을 지원하지 않습니다. Quest 브라우저나 WebXR 확장이 있는 데스크톱에서 열어 주세요."}
        </span>
      </div>
    </div>
  );
}
