import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api, type Blocked, type MarketAsset } from "../lib/api";
import { useAccount } from "../lib/account";
import { useCart } from "../lib/cart";
import { BADGE_LABEL, RankIcon, badgeKeyOf, badgeOf } from "../components/Rank";
import { Thumb } from "../components/Thumb";
import { PIECES, type Piece } from "../data/pieces";
import { t } from "../lib/locale";

/* 정적 배포엔 백엔드가 없다. 서버가 안 닿으면 로컬 카탈로그(PIECES)로 채운다 —
   마켓·상세·씬은 이미 로컬을 쓰는데 카트만 API 에 매여 빈 화면이 났다.
   서버 배지 문자열은 badgeKeyOf 가 되받으므로 점수에서 되돌려 만든다. */
const SERVER_BADGE: Record<string, string> = {
  chal: "challenger",
  dia: "diamond",
  plat: "platinum",
  silv: "silver",
};
function pieceToAsset(p: Piece): MarketAsset {
  return {
    id: p.id,
    title: p.t,
    creator: p.by,
    category: p.cat,
    engine: p.eng[0] ?? "any",
    art_style: "",
    price_usd: p.price,
    total: null,
    badge: SERVER_BADGE[badgeOf(p.score)] ?? null,
  };
}

/* 장바구니.

   나이키, ASOS, Zappos 를 보고 뼈대를 가져왔다.
     두 칸        왼쪽에 담긴 것, 오른쪽에 주문 요약. 요약은 따라 붙는다
     한 칸 CTA    결제 버튼이 화면에서 제일 눈에 띄는 하나여야 한다
     비용 전부    카트에서 낼 값이 전부 보인다. 마지막에 붙는 게 없다
     빈 화면      막다른 길이 아니라 되돌아가는 자리로 쓴다
     나중에       지금 안 사는 걸 지우는 것 말고 둘 자리를 준다

   그대로 안 가져온 것도 있다.

   **수량이 없다.** 파는 게 파일이라 두 개를 사도 받는 게 같다. 수량 조절을
   달면 같은 파일 값을 두 번 내는 길만 열린다.

   **배송비와 세금이 없다.** 카트 이탈의 제일 큰 이유가 마지막에 붙는
   비용인데(Baymard 기준 49%) 여기는 붙을 게 없다. 그러면 그 자리를 비워
   두는 대신 없다고 적는 게 낫다 — 안 적으면 있을까 봐 망설인다.

   대신 이 시장에만 있는 것을 넣었다. 옷으로 치면 사이즈에 해당하는 게
   **엔진**이다. 유니티 프로젝트에 언리얼 전용을 담아 두면 결제까지는
   멀쩡히 되고 열어 보고서야 안 맞는 걸 안다. */

export function Cart() {
  const auth = useAccount();
  const nav = useNavigate();
  const cart = useCart();

  const [assets, setAssets] = useState<Map<number, MarketAsset>>(new Map());
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  /* 담긴 것과 나중 것을 한 번에 가져온다. 따로 부르면 나중 칸이 늦게
     차면서 페이지가 한 번 더 뛴다. */
  const wanted = useMemo(
    () => [...new Set([...cart.ids, ...cart.later])],
    [cart.ids, cart.later],
  );
  const key = wanted.join(",");

  useEffect(() => {
    if (wanted.length === 0) {
      setAssets(new Map());
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .assetsByIds(wanted)
      .then((page) => {
        if (!alive) return;
        setAssets(new Map(page.assets.map((a) => [a.id, a])));
        setError(null);
      })
      .catch(() => {
        if (!alive) return;
        // 서버가 없으면 로컬 카탈로그로 채운다. 담긴 id 가 로컬에도 없을 때만 오류.
        const local = new Map<number, MarketAsset>();
        for (const id of wanted) {
          const p = PIECES.find((x) => x.id === id);
          if (p) local.set(id, pieceToAsset(p));
        }
        setAssets(local);
        setError(local.size ? null : t("담긴 것을 불러오지 못했습니다."));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // key 로 비교한다. 배열은 매번 새 객체라 그대로 넣으면 계속 다시 부른다.
  }, [key]);

  /* 결제 전에 서버에 물어본다.

     장바구니는 브라우저에 있어서 지난주 상태가 그대로 남아 있다. 그새
     내려갔을 수도 있고, 다른 기기에서 이미 샀을 수도 있다. */
  useEffect(() => {
    if (auth.status !== "signed" || cart.ids.length === 0) {
      setBlocked([]);
      return;
    }
    let alive = true;
    api
      .reviewCart(cart.ids)
      .then((r) => alive && setBlocked(r.blocked))
      .catch(() => alive && setBlocked([]));
    return () => {
      alive = false;
    };
  }, [auth.status, cart.ids.join(",")]);

  const blockedIds = useMemo(() => new Set(blocked.map((b) => b.asset_id)), [blocked]);

  const lines = cart.ids.map((id) => assets.get(id)).filter((a): a is MarketAsset => !!a);
  const laterLines = cart.later
    .map((id) => assets.get(id))
    .filter((a): a is MarketAsset => !!a);

  /* 살 수 있는 줄만 센다.

     막힌 줄을 빼는 건 서버가 보내 준 목록으로 하고, 개수도 그 결과에서
     센다. `담긴 수 - 막힌 수` 로 계산하면 마켓에서 내려간 것이 양쪽에
     다르게 잡혀 음수가 나온다. */
  const payable = lines.filter((a) => !blockedIds.has(a.id));
  const subtotal = payable.reduce((sum, a) => sum + a.price_usd, 0);

  const checkout = useCallback(async () => {
    if (auth.status !== "signed") {
      nav("/join?mode=login");
      return;
    }
    setError(null);
    setPaying(true);
    try {
      const session = await api.checkoutCart(cart.ids);
      // 결제창은 Stripe 도메인이다. 카드 정보는 우리 쪽을 안 지나간다.
      window.location.href = session.checkout_url;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.status === 503
            ? t("결제가 아직 연결되지 않았습니다.")
            : e.message
          : t("결제창을 열지 못했습니다."),
      );
      setPaying(false);
    }
  }, [auth.status, cart.ids, nav]);

  if (loading && wanted.length > 0) {
    return <main className="mx-auto max-w-[980px] px-5 py-16 text-xs text-faint">{t("불러오는 중")}</main>;
  }

  if (cart.ids.length === 0) {
    return <Empty later={laterLines} onMove={cart.moveToCart} onDrop={cart.dropLater} />;
  }

  const ready = payable.length > 0 && blocked.length === 0;

  return (
    <main className="mx-auto max-w-[980px] px-5 py-12 pb-32 lg:pb-12">
      <p className="text-xs tracking-wide text-accent">{t("결제 전")}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">
        {t("장바구니")} <span className="num ml-1 text-faint">{cart.ids.length}</span>
      </h1>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
        {/* 담긴 것 */}
        <section className="min-w-0 flex-1">
          {lines.map((a) => (
            <Line
              key={a.id}
              asset={a}
              blocked={blocked.find((b) => b.asset_id === a.id)?.reason}
              onRemove={() => cart.remove(a.id)}
              onLater={() => cart.keepForLater(a.id)}
            />
          ))}

          {/* 담았는데 목록에서 사라진 것. 없어진 에셋이라 서버가 안 준다. */}
          {cart.ids.length > lines.length && (
            <p className="mt-4 text-xs text-faint">
              {t("{n}개는 지금 마켓에 없습니다.", { n: cart.ids.length - lines.length })}
            </p>
          )}

          {laterLines.length > 0 && (
            <section className="mt-12">
              <p className="mb-4 text-base font-bold text-ink">
                {t("나중에")} <span className="num ml-1 text-xs text-faint">{laterLines.length}</span>
              </p>
              {laterLines.map((a) => (
                <Line
                  key={a.id}
                  asset={a}
                  muted
                  onRemove={() => cart.dropLater(a.id)}
                  onMove={() => cart.moveToCart(a.id)}
                />
              ))}
            </section>
          )}
        </section>

        {/* 주문 요약. 스크롤을 따라 붙는다 — 담긴 게 많아도 결제가 안 사라진다. */}
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[300px]">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-bold text-ink">{t("주문 요약")}</p>

            {/* 단위를 갈라 쓴다. 개수는 "개", 점수는 "점" 이다.
                한 화면에서 `94점`(점수) 과 `4점`(개수) 이 같이 뜨면 어느
                쪽이 무엇인지 매번 다시 읽어야 한다.

                소계 줄이 없다.

                배송도 세금도 없어서 소계와 결제 금액이 늘 같은 숫자다. 같은
                값을 두 번 적으면 위쪽이 "에셋 4개 = $64" 처럼 읽힌다. 그
                자리에는 값 대신 무엇을 사는지를 둔다. */}
            <dl className="mt-4 flex flex-col gap-2.5">
              <Row label={t("에셋")} value={t("{n}개", { n: payable.length })} />
              <Grades assets={payable} />
              {/* 붙을 게 없다는 걸 적는다. 안 적으면 있을까 봐 망설인다. */}
              <Row label={t("배송")} value={t("없음")} faint />
              <Row label={t("세금")} value={t("없음")} faint />
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-xs text-ink">{t("결제 금액")}</span>
              <b className="num text-2xl text-ink">{usd(subtotal)}</b>
            </div>

            {blocked.length > 0 && (
              <p className="mt-4 rounded-xl border border-accent px-3.5 py-2.5 text-[10px] leading-relaxed text-muted">
                {t("{n}개를 빼야 결제할 수 있습니다.", { n: blocked.length })}
              </p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-[10px] leading-relaxed text-ink">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void checkout()}
              disabled={!ready || paying}
              className="mt-5 hidden w-full cursor-pointer rounded-xl border-0 bg-accent px-6 py-4 text-xs font-bold text-ground hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 lg:block"
            >
              {paying ? t("결제창을 여는 중") : t(auth.status === "signed" ? "결제하기" : "로그인하고 결제")}
            </button>

            {/* 버튼 아래에 둔다. 누르기 직전에 읽는 말이다. */}
            <p className="mt-4 text-[10px] leading-relaxed text-faint">
              {t(
                "카드 번호는 우리 서버를 지나가지 않습니다. 결제창은 Stripe 가 띄웁니다. 결제가 끝나면 내 라이브러리에서 바로 받습니다.",
              )}
            </p>
          </div>

          <EngineNote assets={payable} />
        </aside>
      </div>

      {/* 모바일은 아래에 고정한다. 엄지가 닿는 자리다. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ground/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[980px] items-center gap-4">
          <span className="num shrink-0 text-base font-bold text-ink">{usd(subtotal)}</span>
          <button
            type="button"
            onClick={() => void checkout()}
            disabled={!ready || paying}
            className="min-w-0 flex-1 cursor-pointer rounded-xl border-0 bg-accent px-5 py-3.5 text-xs font-bold text-ground disabled:opacity-40"
          >
            {paying ? t("결제창을 여는 중") : t(auth.status === "signed" ? "결제하기" : "로그인하고 결제")}
          </button>
        </div>
      </div>
    </main>
  );
}

/* 담긴 것 한 줄.

   그림이 먼저 온다. 카트에서 하는 일이 "내가 담은 게 이게 맞나" 를 보는
   것이라, 제목만 늘어놓으면 비슷한 이름끼리 헷갈린다. 작게 둔다 — 여기서
   고르는 게 아니라 확인만 한다.

   카탈로그 id 와 서버 id 가 같아서 번호로 찾는다. 마이그레이션이 그렇게
   맞춰 뒀다. 올라온 지 얼마 안 된 에셋(1000번대)은 아직 미리보기가 없어
   빈 액자로 둔다 — 자리를 안 비우면 줄 높이가 제각각이 된다. */
function Line({
  asset,
  blocked,
  muted,
  onRemove,
  onLater,
  onMove,
}: {
  asset: MarketAsset;
  blocked?: string;
  muted?: boolean;
  onRemove: () => void;
  onLater?: () => void;
  onMove?: () => void;
}) {
  const badge = badgeKeyOf(asset.badge);
  const piece = PIECES.find((p) => p.id === asset.id);
  return (
    <article
      className={[
        "flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line py-4",
        muted ? "opacity-60" : "",
      ].join(" ")}
    >
      <Link
        to={`/market/${asset.id}`}
        aria-hidden
        tabIndex={-1}
        className="relative block aspect-square w-14 shrink-0 rounded-lg bg-surface"
      >
        {piece && <Thumb piece={piece} pad="12%" />}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {badge && <RankIcon badge={badge} size={14} className="shrink-0" />}
          <Link
            to={`/market/${asset.id}`}
            className="min-w-0 truncate text-xs font-bold text-ink no-underline hover:text-accent"
          >
            {asset.title}
          </Link>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint">
          <span>{asset.creator}</span>
          <span className="text-muted">{asset.engine.toUpperCase()}</span>
          {badge && <span>{t(BADGE_LABEL[badge])}</span>}
          {asset.total !== null && <span>
              {t("분석")} <b className="num text-muted">{asset.total}</b>
            </span>}
        </p>

        {blocked && (
          <p className="mt-2 text-[10px] text-accent">
            {t(blocked)} — {t("빼고 결제해 주세요")}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-3">
          {onLater && (
            <button
              type="button"
              onClick={onLater}
              className="cursor-pointer border-0 bg-transparent p-0 text-[10px] text-faint hover:text-ink"
            >
              {t("나중에")}
            </button>
          )}
          {onMove && (
            <button
              type="button"
              onClick={onMove}
              className="cursor-pointer border-0 bg-transparent p-0 text-[10px] text-muted hover:text-ink"
            >
              {t("장바구니로")}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer border-0 bg-transparent p-0 text-[10px] text-faint hover:text-ink"
          >
            {t("빼기")}
          </button>
        </div>
      </div>

      <b className="num shrink-0 text-xs text-ink">{usd(asset.price_usd)}</b>
    </article>
  );
}

/* 엔진이 섞였는가.

   옷으로 치면 사이즈다. 유니티 프로젝트에 언리얼 전용이 섞여 있으면
   결제까지는 멀쩡히 되고, 열어 보고서야 안 맞는 걸 안다. 하나로 통일돼
   있으면 아무 말도 안 한다 — 문제 없을 때 뜨는 알림은 다음번에 안 읽힌다. */
function EngineNote({ assets }: { assets: MarketAsset[] }) {
  const engines = [...new Set(assets.map((a) => a.engine).filter((e) => e !== "any"))];
  if (engines.length < 2) return null;
  return (
    <p className="mt-4 rounded-2xl border border-line px-4 py-3 text-[10px] leading-relaxed text-muted">
      {t("엔진이 {list} 로 섞여 있습니다. 한 프로젝트에 쓸 것이라면 확인해 주세요.", {
        list: engines.map((e) => e.toUpperCase()).join(", "),
      })}
    </p>
  );
}

/* 빈 장바구니.

   막다른 길로 두지 않는다. 여기서 나갈 곳이 없으면 뒤로가기밖에 할 게
   없고, 나중에 담아 둔 것이 있으면 그게 곧 돌아올 이유다. */
function Empty({
  later,
  onMove,
  onDrop,
}: {
  later: MarketAsset[];
  onMove: (id: number) => void;
  onDrop: (id: number) => void;
}) {
  return (
    <main className="mx-auto max-w-[600px] px-5 py-16">
      <h1 className="text-2xl font-bold text-ink">{t("장바구니가 비었습니다")}</h1>
      <p className="mt-2 text-xs text-muted">
        {t("마켓에 올라온 것은 전부 채점을 받은 것입니다.")}
      </p>
      <Link
        to="/market"
        className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-xs font-bold text-ground no-underline hover:bg-accent-strong"
      >
        {t("마켓 둘러보기")}
      </Link>

      {later.length > 0 && (
        <section className="mt-12">
          <p className="mb-4 text-base font-bold text-ink">
            {t("나중에")} <span className="num ml-1 text-xs text-faint">{later.length}</span>
          </p>
          {later.map((a) => (
            <Line key={a.id} asset={a} muted onRemove={() => onDrop(a.id)} onMove={() => onMove(a.id)} />
          ))}
        </section>
      )}
    </main>
  );
}

/* 담긴 것의 배지 구성.

   이 마켓에서 값보다 먼저 보는 게 배지다. 소계를 적던 자리에 이걸 두면
   "챌린저 하나에 다이아 둘" 처럼 무엇을 사는지가 한 줄로 읽힌다.

   높은 것부터 적는다. 담긴 순서대로 두면 볼 때마다 자리가 바뀐다. */
const ORDER = ["chal", "dia", "plat", "silv"] as const;

function Grades({ assets }: { assets: MarketAsset[] }) {
  const count = new Map<string, number>();
  for (const a of assets) {
    const k = badgeKeyOf(a.badge);
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const rows = ORDER.filter((k) => count.has(k));
  if (rows.length === 0) return null;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-faint">{t("배지")}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap justify-end gap-x-2.5 gap-y-1">
        {rows.map((k) => (
          <span key={k} className="flex items-center gap-1 whitespace-nowrap">
            <RankIcon badge={k} size={12} className="shrink-0" />
            <span className="text-xs text-muted">{t(BADGE_LABEL[k])}</span>
            <b className="num text-xs text-ink">{count.get(k)}</b>
          </span>
        ))}
      </dd>
    </div>
  );
}

function Row({ label, value, faint }: { label: string; value: string; faint?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className={`num m-0 text-xs ${faint ? "text-faint" : "text-muted"}`}>{value}</dd>
    </div>
  );
}

/** 값은 늘 같은 꼴로 적는다. 자리마다 다르면 합이 맞는지 눈으로 못 센다. */
function usd(v: number) {
  return `$${v.toFixed(2)}`;
}
