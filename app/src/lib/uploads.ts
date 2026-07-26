import { useCallback, useSyncExternalStore } from "react";
import type { Piece } from "../data/pieces";

/* 가진 작업물을 가져오는 자리. 스튜디오인데 자기 파일을 못 올리면 스튜디오가 아니다.

   파일은 브라우저 안에만 있다. 서버로 보내지 않고 objectURL 로만 참조하므로
   새로고침하면 사라진다 — 시연 단계에서 남의 원본을 우리 쪽에 쌓아 둘 이유가 없다.
   localStorage 에도 안 넣는다. glTF 하나가 용량 한도를 그대로 넘긴다. */

export type Upload = Piece & { url: string; kind: "model" | "image" };

const subs = new Set<() => void>();
let items: Upload[] = [];

const MODEL_EXT = /\.(glb|gltf)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

/** 올린 파일은 마켓 상품과 같은 모양이어야 한다 — 그래야 같은 화면이 그대로 돈다. */
function toPiece(file: File, id: number): Upload | null {
  const isModel = MODEL_EXT.test(file.name);
  const isImage = IMAGE_EXT.test(file.name) || file.type.startsWith("image/");
  if (!isModel && !isImage) return null;

  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, "");
  return {
    id,
    url,
    kind: isModel ? "model" : "image",
    t: name,
    by: "내 파일",
    cat: "prop",
    eng: ["unity"],
    /* 검수를 아직 안 돌렸다. 0 으로 두면 실버로 표시되니 중립값을 준다. */
    score: 70,
    feel: 70,
    price: 0,
    dl: 0,
    days: 0,
    tri: "—",
    tex: "—",
    desc: `${file.name}, ${(file.size / 1024 / 1024).toFixed(1)}MB. 이 브라우저에만 있습니다.`,
  };
}

/* 마켓 상품 id 와 안 겹치게 큰 수부터 내려간다. */
let nextId = 900_000;

export function useUploads() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => items,
    () => items,
  );

  const add = useCallback((files: FileList | File[]) => {
    const added = [...files].map((f) => toPiece(f, nextId++)).filter((p): p is Upload => p !== null);
    if (!added.length) return [];
    items = [...added, ...items];
    subs.forEach((cb) => cb());
    return added;
  }, []);

  const remove = useCallback((id: number) => {
    const gone = items.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    items = items.filter((p) => p.id !== id);
    subs.forEach((cb) => cb());
  }, []);

  return { list, add, remove };
}

/** 업로드 목록에서 찾는다. 라우팅으로 들어온 id 를 되살릴 때 쓴다. */
export function findUpload(id: number): Upload | undefined {
  return items.find((p) => p.id === id);
}
