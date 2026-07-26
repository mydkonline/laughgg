import { useEffect, useRef } from "react";

/* 국경이 없는 공급.
   창작자가 어디서 올리든 같은 기준으로 채점한다는 걸 지도 하나로 말한다.
   캔버스 하나에 정사영으로 그린다 — three 를 하나 더 띄울 이유가 없다. */

/** 대륙 윤곽. 정확한 국경이 아니라 실루엣만 필요하다. */
const LAND: [number, number][][] = [
  [[-168, 65], [-140, 70], [-120, 72], [-95, 74], [-80, 73], [-62, 60], [-55, 50], [-66, 45], [-70, 42],
   [-76, 35], [-81, 25], [-97, 26], [-105, 20], [-115, 30], [-125, 40], [-130, 55], [-150, 60], [-168, 65]],
  [[-81, 10], [-60, 12], [-50, 0], [-35, -5], [-38, -15], [-48, -25], [-58, -35], [-65, -45], [-72, -52],
   [-75, -45], [-71, -30], [-70, -18], [-78, -5], [-81, 10]],
  [[-10, 36], [0, 40], [12, 45], [30, 45], [45, 42], [60, 45], [80, 50], [100, 55], [120, 55], [140, 50],
   [150, 60], [170, 68], [140, 72], [100, 76], [60, 72], [30, 70], [10, 62], [-8, 58], [-10, 36]],
  [[-17, 15], [0, 15], [15, 12], [32, 15], [42, 12], [48, 0], [40, -12], [32, -26], [20, -34], [12, -20],
   [8, -5], [-5, 5], [-17, 15]],
  [[113, -22], [130, -12], [142, -10], [150, -22], [153, -30], [148, -38], [135, -38], [120, -34], [113, -22]],
];

/* 창작자와 게임사가 있는 곳. maker 는 공급, studio 는 수요다.

   네 번째 값은 진출 단계다. 양면 시장이라 순서가 곧 전략이 된다 — 공급이
   비어 있는 채로 수요를 열면 살 게 없는 마켓이 되고, 그 첫인상은 되돌리기
   어렵다. 그래서 생산 허브가 앞에 오고 최대 구매처가 마지막에 온다. */
export const CITIES: [string, number, number, "maker" | "studio", number][] = [
  ["서울", 37.57, 126.98, "maker", 1],
  ["도쿄", 35.68, 139.69, "studio", 2],
  ["호치민", 10.82, 106.63, "maker", 3],
  ["마닐라", 14.6, 120.98, "maker", 3],
  ["방갈로르", 12.97, 77.59, "maker", 3],
  ["바르샤바", 52.23, 21.01, "maker", 4],
  ["키이우", 50.45, 30.52, "maker", 4],
  ["로스앤젤레스", 34.05, -118.24, "studio", 5],
  ["몬트리올", 45.5, -73.57, "studio", 5],
  ["헬싱키", 60.17, 24.94, "studio", 5],
];

const RAD = Math.PI / 180;

/** 점이 다각형 안에 있는가. 격자를 육지에만 남기려고 쓴다. */
function inPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* 육지 점은 한 번만 만든다. 매 프레임 다각형 검사를 돌리면 프레임이 떨어진다. */
const LAND_DOTS: [number, number][] = (() => {
  const dots: [number, number][] = [];
  for (let lat = -78; lat <= 84; lat += 3) {
    /* 위도가 높을수록 경도 간격을 벌린다. 안 그러면 극지방에 점이 뭉친다. */
    const step = 3 / Math.max(0.22, Math.cos(lat * RAD));
    for (let lon = -180; lon <= 180; lon += step) {
      if (LAND.some((poly) => inPoly(lon, lat, poly))) dots.push([lon, lat]);
    }
  }
  return dots;
})();

export function Globe({ className, focus }: { className?: string; focus?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  /* 값은 ref 로 들고 있는다. 단계가 바뀔 때마다 캔버스를 다시 세우면
     지구가 원점으로 튕겨 돌아간다 — 돌리던 각도가 사라진다. */
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let spin = -0.6;
    /* 관성. 놓아도 잠깐 더 돌아야 손으로 민 느낌이 난다. */
    let velocity = reduce ? 0 : 0.0016;
    let dragging = false;
    let lastX = 0;
    let raf = 0;
    let live = true;

    const io = new IntersectionObserver((e) => (live = e[0]?.isIntersecting ?? true));
    io.observe(canvas);

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";

    /** 경위도를 화면 좌표로. z 가 음수면 지구 뒤편이라 안 그린다. */
    const project = (lat: number, lon: number, cx: number, cy: number, r: number) => {
      const p = lat * RAD;
      const l = (lon + spin / RAD) * RAD;
      const x = Math.cos(p) * Math.sin(l);
      const y = Math.sin(p);
      const z = Math.cos(p) * Math.cos(l);
      return { x: cx + x * r, y: cy - y * r, z };
    };

    const draw = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      const dpr = Math.min(devicePixelRatio, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 8;

      /* 바다. 아주 옅게 깔아야 육지 점이 떠 보인다. */
      const sea = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      sea.addColorStop(0, color("--surface-2"));
      sea.addColorStop(1, color("--ground"));
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color("--line");
      ctx.lineWidth = 1;
      ctx.stroke();

      /* 위도선. 구라는 걸 알려 주는 최소한의 단서다. */
      ctx.globalAlpha = 0.22;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lat, lon, cx, cy, r);
          if (p.z < 0) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(p.x, p.y);
          else {
            ctx.moveTo(p.x, p.y);
            started = true;
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 육지는 점 격자로 찍는다. 면으로 칠하면 지도가 되고, 점이면 신호가 된다.
         뒤쪽 점은 흐리게 남겨 구라는 게 드러나게 한다. */
      ctx.fillStyle = color("--faint");
      const dot = Math.max(1, r / 150);
      for (const [lon, lat] of LAND_DOTS) {
        const p = project(lat, lon, cx, cy, r);
        if (p.z < 0) continue;
        ctx.globalAlpha = 0.14 + p.z * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, dot, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* 도시. 앞면에 있는 것만 이름을 붙인다.
         단계를 짚으면 그 단계만 남기고 나머지는 죽인다 — 지우지는 않는다.
         사라지면 전체 계획이 몇 개짜리였는지가 같이 사라진다. */
      const pick = focusRef.current;
      for (const [name, lat, lon, role, phase] of CITIES) {
        const p = project(lat, lon, cx, cy, r);
        if (p.z < 0.05) continue;
        const lit = !pick || phase === pick;
        const accent = role === "maker" ? color("--accent") : color("--ink");
        ctx.globalAlpha = (0.4 + p.z * 0.6) * (lit ? 1 : 0.18);

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, lit ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = (0.18 + p.z * 0.22) * (lit ? 1 : 0.15);
        ctx.beginPath();
        ctx.arc(p.x, p.y, lit ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (p.z > 0.55) {
          ctx.globalAlpha = (0.35 + p.z * 0.4) * (lit ? 1 : 0.2);
          ctx.fillStyle = color("--muted");
          ctx.font = "11px Roboto, system-ui, sans-serif";
          ctx.fillText(name, p.x + 9, p.y + 4);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!live) return;
      if (!dragging) {
        spin += velocity;
        /* 손을 뗀 뒤에는 기본 속도로 수렴한다 */
        velocity += ((reduce ? 0 : 0.0016) - velocity) * 0.03;
      }
      draw();
    };
    loop();

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin += dx * 0.006;
      velocity = dx * 0.006;
    };
    const up = () => (dragging = false);

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return <canvas ref={ref} className={`cursor-grab touch-none active:cursor-grabbing ${className ?? ""}`} />;
}
