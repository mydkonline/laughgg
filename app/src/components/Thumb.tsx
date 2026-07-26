import { useEffect, useState } from "react";
import { bakeView, type Dir, type Material } from "../three/baker";
import type { Piece } from "../data/pieces";

const THREE_QUARTER: Dir = [1.3, 0.85, 1.6];

/** 모델 한 컷. 굽는 동안은 자리만 잡아 둬 레이아웃이 밀리지 않는다. */
export function Thumb({
  piece,
  dir = THREE_QUARTER,
  material = "pbr",
  className = "",
}: {
  piece: Piece;
  dir?: Dir;
  material?: Material;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const model = piece.m;

  useEffect(() => {
    if (!model) return;
    let alive = true;
    bakeView(model, dir, material)
      .then((url) => alive && setSrc(url))
      .catch(() => {
        /* 모델을 못 받으면 빈 자리로 둔다. 카드 자체는 계속 눌린다. */
      });
    return () => {
      alive = false;
    };
  }, [model, dir, material]);

  /* 도트 상품은 파일이 하나뿐이라 구울 것이 없다. 픽셀이 뭉개지지 않게 둔다. */
  if (piece.img) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}assets/${piece.img}.png`}
        alt=""
        className={`h-full w-full object-contain [image-rendering:pixelated] ${className}`}
      />
    );
  }

  return src ? (
    <img src={src} alt="" className={`h-full w-full object-contain ${className}`} />
  ) : (
    <div className={`h-full w-full animate-pulse bg-surface-2 ${className}`} />
  );
}
