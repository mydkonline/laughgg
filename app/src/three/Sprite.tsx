import { useEffect, useRef, useState } from "react";
import { bakeView, type Dir } from "./baker";
import { rasterize } from "../lib/raster";
import type { Knobs, RasterSet } from "../data/concepts";
import { modelSrc, imageSrc, type Piece } from "../data/pieces";

/* 3D 를 2D 게임에 넣을 수 있게 만드는 자리.
   모델을 한 각도로 구운 다음 래스터 파이프라인에 태운다. 원래 2D 인 스프라이트도
   같은 파이프라인을 탄다 — 그래서 3D 상품과 도트 상품이 같은 프리셋로 맞춰진다.

   스프라이트는 정지 그림이다. 돌릴 이유가 없으니 노브가 바뀔 때만 다시 굽는다. */

const FRONT: Dir = [1.3, 0.85, 1.6];
const W = 520;
const H = 390;

export function Sprite({
  piece,
  knobs,
  raster,
  className,
}: {
  piece: Piece;
  knobs: Knobs;
  raster: RasterSet;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  /* 원본 한 장은 한 번만 구한다. 노브를 흔들 때마다 3D 를 다시 굽지 않는다. */
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);

    const model = modelSrc(piece);
    const flat = imageSrc(piece);
    if (!model && !flat) {
      setFailed(true);
      return;
    }
    const url = model ? bakeView(model, FRONT, "pbr") : Promise.resolve(flat!);

    void url
      .then(
        (u) =>
          new Promise<HTMLImageElement>((ok, no) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => ok(img);
            img.onerror = no;
            img.src = u;
          }),
      )
      .then((img) => alive && setSrc(img))
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
    };
  }, [piece]);

  /* 노브가 바뀌면 이미 가진 원본을 다시 민다. 한 프레임 안에 끝난다. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return;
    const canvas = rasterize(src, W, H, { knobs, ...raster });
    canvas.className = "h-full w-full object-contain [image-rendering:pixelated]";
    host.replaceChildren(canvas);
  }, [src, knobs, raster]);

  if (failed) {
    return <p className="grid h-full w-full place-items-center text-xs text-faint">모델을 불러오지 못했습니다</p>;
  }
  return (
    <div ref={hostRef} className={`h-full w-full ${className ?? ""}`}>
      {!src && <div className="h-full w-full animate-pulse rounded-lg bg-surface-2" />}
    </div>
  );
}
