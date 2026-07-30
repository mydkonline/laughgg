import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadNormalized, frame } from "./baker";
import type { Knobs } from "../data/concepts";

/* 노브가 실제 렌더를 바꾼다. 프리셋으로 눌렀든 프롬프트로 들어왔든
   여기 도착하는 건 같은 여섯 숫자다 — 그래서 결과가 항상 재현된다.

   채도만 CSS 필터로 뺐다. 톤매핑 뒤에 거는 색 보정이라 셰이더를 건드리는 것보다
   정확하고, 캔버스 한 장에만 걸리니 다른 미리보기를 오염시키지 않는다. */

const mix = (a: number, b: number, u: number) => a + (b - a) * u;

export function Preview({
  model,
  knobs,
  spin = true,
  className,
}: {
  model: string;
  knobs: Knobs;
  spin?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* 렌더 루프는 매 프레임 최신 노브를 읽어야 한다. effect 를 다시 돌리면
     모델을 새로 받게 되므로 ref 로 흘려 넣는다. */
  const knobsRef = useRef(knobs);
  knobsRef.current = knobs;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let visible = true;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? false), { threshold: 0 });
    io.observe(canvas);

    void (async () => {
      const node = await loadNormalized(model);
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const scene = new THREE.Scene();
      const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x2a2d38, 2.0);
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(2.6, 4.2, 3.2);
      const rim = new THREE.DirectionalLight(0x7d59ea, 1.7);
      rim.position.set(-3, 1.2, -2.6);
      scene.add(hemi, key, rim);

      const pivot = new THREE.Group();
      pivot.add(node);
      scene.add(pivot);

      /* 원본 재질값을 한 번 적어 둔다. 노브는 언제나 이 값에서 상대로 움직인다 —
         안 그러면 슬라이더를 좌우로 흔들 때마다 값이 한쪽으로 흘러내린다. */
      const mats: { m: THREE.MeshStandardMaterial; r0: number; m0: number }[] = [];
      node.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof THREE.MeshStandardMaterial) {
            mats.push({ m, r0: m.roughness, m0: m.metalness });
          }
        }
      });

      /* 외곽선 — 뒷면만 그리는 사본을 살짝 키워 겹친다.
         후처리 없이 셀 셰이드 느낌을 내는 가장 싼 방법이다. */
      const outline = new THREE.Group();
      const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14141a, side: THREE.BackSide });
      node.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const shell = new THREE.Mesh(o.geometry, outlineMat);
        o.updateWorldMatrix(true, false);
        shell.applyMatrix4(o.matrixWorld);
        outline.add(shell);
      });
      pivot.add(outline);

      const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.01, 100);
      frame(camera, node, [1.3, 0.85, 1.6], 1.16);

      let t = 0;
      let lastFacet: boolean | null = null;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible || !renderer) return;
        const k = knobsRef.current;

        const tone = k.tone / 100;
        const warm = k.warm / 100;
        const gloss = k.gloss / 100;

        renderer.toneMappingExposure = mix(1.7, 0.6, tone);
        key.intensity = mix(3.3, 1.2, tone);
        hemi.intensity = mix(2.6, 0.9, tone);
        rim.intensity = mix(1.1, 2.7, tone);
        key.color.setHex(0xffffff).lerp(new THREE.Color(warm < 0.5 ? 0x9dc6ff : 0xffc27a), Math.abs(warm - 0.5) * 2);

        const flat = k.facet > 50;
        for (const { m, r0, m0 } of mats) {
          m.roughness = Math.min(1, Math.max(0.04, mix(r0 + 0.3, r0 - 0.44, gloss)));
          m.metalness = Math.min(1, Math.max(0, mix(m0, m0 + 0.55, gloss)));
          if (lastFacet !== flat) {
            m.flatShading = flat;
            m.needsUpdate = true;
          }
        }
        lastFacet = flat;

        outline.visible = k.line > 1;
        outline.scale.setScalar(1 + (k.line / 100) * 0.055);

        /* 채도는 톤매핑 뒤에 건다. 0 이면 흑백, 100 이면 두 배로 쨍하다. */
        canvas.style.filter = `saturate(${(k.sat / 50).toFixed(2)})`;

        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (spin && !reduce) t += 0.006;
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
  }, [model, spin]);

  return <canvas ref={canvasRef} className={className} />;
}
