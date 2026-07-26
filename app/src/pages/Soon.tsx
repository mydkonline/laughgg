/* 아직 옮기지 않은 페이지. 기존 정적 빌드에는 그대로 살아 있다. */
export function Soon({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-24">
      <h1 className="text-4xl font-bold text-ink">{title}</h1>
      <p className="mt-4 text-base text-muted">
        React 로 옮기는 중입니다. 마켓부터 옮기고 있고, 이 페이지는 아직 기존 정적 빌드에 있습니다.
      </p>
    </main>
  );
}
