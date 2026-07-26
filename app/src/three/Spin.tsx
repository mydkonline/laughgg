import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadNormalized, frame } from "./baker";

/* 회전 시연 — 상품 영상을 만들 수 없으니 실제 모델을 그 자리에서 돌린다.
   화면 밖으로 나가면 멈춘다. 목록에 여럿 떠 있어도 GPU 를 붙잡지 않는다. */
export function Spin({ model, className }: { model: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let raf = 0;
    let live = false;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((e) => (live = e[0]?.isIntersecting ?? false), { threshold: 0 });
    io.observe(canvas);

    void (async () => {
      const node = await loadNormalized(model);
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2d38, 2.1));
      const key = new THREE.DirectionalLight(0xfff3e2, 2.4);
      key.position.set(2.6, 4.2, 3.2);
      const rim = new THREE.DirectionalLight(0x7d59ea, 1.7);
      rim.position.set(-3, 1.2, -2.6);
      scene.add(key, rim);

      const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.01, 100);
      const pivot = new THREE.Group();
      pivot.add(node);
      scene.add(pivot);
      frame(camera, pivot, [1.3, 0.85, 1.6], 1.12);

      let t = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!live || !renderer) return;
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (!reduce) t += 0.008;
        pivot.rotation.y = t;
        renderer.render(scene, camera);
      };
      loop();
    })();

    return () => {
      disposed = true;
      io.disconnect();
      cancelAnimationFrame(raf);
      renderer?.dispose();
    };
  }, [model]);

  return <canvas ref={ref} className={className} />;
}
