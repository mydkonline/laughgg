import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { PIECES, CHECKS, CAT_NAME, ENGINE_NAME, type Piece } from "../data/pieces";
import { RankIcon, badgeOf, BADGE_LABEL } from "../components/Rank";
import { Thumb } from "../components/Thumb";
import { Spin } from "../three/Spin";
import { bakeView, type Dir, type Material } from "../three/baker";
import { useCart } from "../lib/cart";
import { won, num } from "../lib/format";

/* 상품 상세는 사이드 패널이 아니라 제 주소를 가진 페이지다.
   나이키도 아마존도 PDP 는 별도 페이지다 — 링크가 공유되고 뒤로가기가 맞는다. */

const VIEWS: { dir: Dir; mat: Material; label: string }[] = [
  { dir: [1.3, 0.85, 1.6], mat: "pbr", label: "3/4" },
  { dir: [0, 0.1, 2], mat: "pbr", label: "정면" },
  { dir: [0.2, 2, 0.35], mat: "pbr", label: "위" },
  { dir: [1.3, 0.85, 1.6], mat: "wire", label: "와이어프레임" },
];

const PAY = ["VISA", "Mastercard", "Maestro", "PayPal", "AMEX"];

export function Product() {
  const { id } = useParams();
  const piece = PIECES.find((p) => p.id === Number(id));
  if (!piece) return <Navigate to="/market" replace />;
  return <Detail key={piece.id} p={piece} />;
}

function Detail({ p }: { p: Piece }) {
  const badge = badgeOf(p.score);
  const { add, has } = useCart();
  const [shot, setShot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  /* 검수 점수는 종합에서 항목별로 흩뜨려 만든다. 상품마다 같은 모양이 나오게
     id 를 씨앗으로 쓴다 — 새로고침해도 숫자가 흔들리지 않아야 한다. */
  const scores = CHECKS.map((_, i) => {
    const base = i === 5 ? p.feel : p.score;
    const jitter = [(p.id * 7) % 9 - 4, (p.id * 11) % 7 - 3, (p.id * 13) % 5 - 2,
                    (p.id * 17) % 11 - 5, (p.id * 19) % 9 - 4, 0][i] ?? 0;
    return Math.max(31, Math.min(99, base + jitter));
  });

  const stars = (3.9 + ((p.id * 7) % 11) / 10).toFixed(1);
  const reviews = 20 + (p.id * 37) % 180;
  const also = PIECES.filter((o) => o.cat === p.cat && o.id !== p.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-20">
      <Link to="/market" className="inline-block py-4 text-xs text-faint no-underline hover:text-ink">
        ← 마켓
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 갤러리 */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface p-8">
            {spinning && p.m ? (
              <Spin model={p.m} className="h-full w-full" />
            ) : (
              <GalleryShot piece={p} view={VIEWS[shot] ?? VIEWS[0]!} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {p.m &&
              VIEWS.map((v, i) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => {
                    setShot(i);
                    setSpinning(false);
                  }}
                  aria-pressed={!spinning && shot === i}
                  className={[
                    "cursor-pointer rounded-lg border px-3 py-1.5 text-xs",
                    !spinning && shot === i
                      ? "border-accent text-ink"
                      : "border-line text-faint hover:text-ink",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              ))}
            {p.m && (
              <button
                type="button"
                onClick={() => setSpinning((s) => !s)}
                aria-pressed={spinning}
                className={[
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs",
                  spinning ? "border-accent text-ink" : "border-line text-faint hover:text-ink",
                ].join(" ")}
              >
                회전 시연
              </button>
            )}
          </div>
        </div>

        {/* 구매 패널 */}
        <aside className="lg:sticky lg:top-[120px] lg:self-start">
          <span className="text-xs text-faint">{CAT_NAME[p.cat]}</span>
          <h1 className="mt-1 text-2xl font-bold text-ink">{p.t}</h1>
          <p className="mt-1 text-xs text-faint">{p.by}</p>

          <div className="mt-4 flex items-center gap-3">
            <b className="text-base text-ink">{stars}</b>
            <span className="text-xs text-faint">리뷰 {reviews}개</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-extrabold text-accent">
              <RankIcon badge={badge} size={14} />
              {BADGE_LABEL[badge]}
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-3 border-t border-line pt-5">
            <b className="text-4xl font-bold text-ink">{won(p.price)}</b>
            <span className="text-xs text-faint">
              {p.price ? `창작자에게 ${won(Math.round(p.price * 0.92 * 100) / 100)} 정산` : "무료 배포"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => add(p.id)}
            className="mt-5 w-full cursor-pointer rounded-xl border-0 bg-accent px-4 py-3.5 text-base font-bold text-white hover:bg-accent-strong"
          >
            {has(p.id) ? "장바구니에 있음" : "장바구니에 담기"}
          </button>

          <ul className="mt-4 flex list-none flex-col gap-2 border-t border-line pt-4 pl-0 text-xs text-muted">
            <li>결제 즉시 내려받습니다. 배송이 없습니다.</li>
            <li>내려받기 전이면 <b className="text-ink">7일 안에 전액 환불</b>됩니다.</li>
            <li>검수 <b className="text-ink">7항목</b>을 통과한 에셋만 올라옵니다.</li>
          </ul>

          {/* 결제 수단 — 아이콘 없이 워드마크 텍스트로만 */}
          <div className="mt-4 border-t border-line pt-4">
            <span className="text-xs font-bold tracking-wide text-ink">Secure checkout</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PAY.map((b) => (
                <span key={b} className="rounded border border-line px-2 py-1 text-[10px] font-bold text-faint">
                  {b}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              국내 결제는 <b className="text-ink">토스페이먼츠</b>, 해외 결제는 <b className="text-ink">Stripe</b>가
              처리합니다. 카드 정보는 PG사 서버에만 저장되며 LaughGG는 보관하지 않습니다.
            </p>
          </div>
        </aside>
      </div>

      {/* 본문 */}
      <div className="mt-12 max-w-[760px]">
        <Acc title="상품 설명" open>
          <p className="text-base leading-relaxed text-muted">{p.desc}</p>
        </Acc>

        <Acc title={`검수 리포트 · 종합 ${p.score}점`}>
          <div className="flex flex-col gap-2.5">
            {CHECKS.map((c, i) => {
              const v = scores[i] ?? 0;
              const pass = v >= 70;
              return (
                /* 열은 셋뿐이다 — 항목명 · 막대 · 점수 */
                <div key={c.k} className="grid grid-cols-[minmax(0,1fr)_96px_34px] items-center gap-3 text-base">
                  <span className="min-w-0 text-muted">
                    {c.k} <span className="text-faint">{c.d}</span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <b
                      className={`block h-full ${pass ? "bg-accent" : "bg-[#FF6B7A]"}`}
                      style={{ width: `${v}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-ink">{v}</span>
                </div>
              );
            })}
          </div>
        </Acc>

        <Acc title="기술 사양">
          <dl className="m-0 flex flex-col">
            <Kv k="폴리곤" v={p.tri} />
            <Kv k="텍스처" v={p.tex} />
            <Kv k="지원 엔진" v={p.eng.map((e) => ENGINE_NAME[e]).join(" · ")} />
            <Kv k="내려받기" v={`${num(p.dl)}회`} />
            <Kv k="최근 갱신" v={`${p.days}일 전`} />
          </dl>
        </Acc>
      </div>

      {also.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-ink">같은 분류에서 점수가 높은 것</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
            {also.map((o) => (
              <Link
                key={o.id}
                to={`/market/${o.id}`}
                className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface no-underline hover:border-accent"
              >
                <div className="aspect-[4/3] bg-gradient-to-b from-surface-2 to-surface p-4">
                  <Thumb piece={o} />
                </div>
                <div className="flex items-baseline justify-between gap-2 p-3.5">
                  <span className="text-base font-bold text-ink">{o.t}</span>
                  <span className="text-base text-muted">{won(o.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function GalleryShot({ piece, view }: { piece: Piece; view: (typeof VIEWS)[number] }) {
  const [src, setSrc] = useState<string | null>(null);
  const model = piece.m;

  useEffect(() => {
    if (!model) return;
    let alive = true;
    setSrc(null);
    bakeView(model, view.dir, view.mat)
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [model, view]);

  if (piece.img) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}assets/${piece.img}.png`}
        alt={piece.t}
        className="h-full w-full object-contain [image-rendering:pixelated]"
      />
    );
  }
  return src ? (
    <img src={src} alt={piece.t} className="h-full w-full object-contain" />
  ) : (
    <div className="h-full w-full animate-pulse rounded-xl bg-surface-2" />
  );
}

function Acc({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="border-b border-line">
      <summary className="cursor-pointer list-none py-4 text-base font-bold text-ink">{title}</summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line-soft py-1.5 text-base last:border-b-0">
      <dt className="text-faint">{k}</dt>
      <dd className="m-0 tabular-nums text-muted">{v}</dd>
    </div>
  );
}
