import { useEffect, useState } from "react";
import { bakeView, type Dir, type Material } from "../three/baker";
import { modelSrc, imageSrc, type Piece } from "../data/pieces";

const THREE_QUARTER: Dir = [1.3, 0.85, 1.6];

/**
 * 상품 그림 한 컷.
 *
 * 액자는 절대배치로 깐다. aspect-ratio 로 높이를 잡은 칸 안에서 `height: 100%` 는
 * 순환 참조라 auto 로 풀리고, 그러면 그림의 원본 높이만큼 칸이 늘어난다.
 * 3D 는 정사각으로 구워 티가 안 났지만 도트 스프라이트에서 칸이 92px 씩 커졌다.
 * inset-0 을 주면 높이가 확정돼서 max-h-full 이 제대로 걸린다.
 *
 * 안쪽 여백도 여기서 정한다. 부르는 쪽마다 다르게 주면 다시 제각각이 된다.
 */
export function Thumb({
  piece,
  dir = THREE_QUARTER,
  material = "pbr",
  className = "",
  pad = "10%",
}: {
  piece: Piece;
  dir?: Dir;
  material?: Material;
  className?: string;
  /** 액자 안쪽 여백. 칸 너비 기준이라 크기가 달라도 비율이 유지된다. */
  pad?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const model = modelSrc(piece);
  const flat = imageSrc(piece);

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

  const shown = flat ?? src;

  return (
    <span className="absolute inset-0 grid place-items-center" style={{ padding: pad }}>
      {shown ? (
        <img
          src={shown}
          alt=""
          className={[
            "max-h-full max-w-full object-contain",
            /* 도트는 보간하면 뭉개진다 */
            flat ? "[image-rendering:pixelated]" : "",
            className,
          ].join(" ")}
        />
      ) : (
        <span className="h-full w-full animate-pulse rounded-lg bg-surface-2" />
      )}
    </span>
  );
}
