/* 파일 해시.

   브라우저에서 SHA-256 을 낸다. 서버로 보내기 전에 계산해야 하는 이유는
   둘이다 — 키를 내용으로 정하면 같은 파일을 여러 번 올려도 자리가 하나고,
   받는 쪽이 깨진 파일을 알아챌 수 있다.

   큰 파일을 통째로 메모리에 올리지 않는다. 수백 메가짜리 모델을 ArrayBuffer
   하나로 읽으면 탭이 죽는다. 조각으로 읽어 이어 붙인다. */

const CHUNK = 8 * 1024 * 1024;

/** SHA-256 을 16진수로. 진행률을 보고 싶으면 onProgress 를 준다. */
export async function sha256(file: File, onProgress?: (ratio: number) => void): Promise<string> {
  // crypto.subtle 은 스트리밍 해시를 안 준다. 조각을 모아 한 번에 넘긴다.
  // 그래도 조각으로 읽는 이유는 File.arrayBuffer() 가 한 번에 다 올리기
  // 때문이다 — 여기서는 읽는 동안 진행률을 낼 수 있다.
  const parts: Uint8Array[] = [];
  let read = 0;

  for (let offset = 0; offset < file.size; offset += CHUNK) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, file.size));
    parts.push(new Uint8Array(await slice.arrayBuffer()));
    read += slice.size;
    onProgress?.(file.size ? read / file.size : 1);
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const joined = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    joined.set(p, at);
    at += p.length;
  }

  const digest = await crypto.subtle.digest("SHA-256", joined);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 사람이 읽는 크기. 4200000 을 그대로 보여 주면 큰지 작은지 모른다. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
