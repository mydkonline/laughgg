import { useState } from "react";
import { Link } from "react-router-dom";

import { SCENE_GAMES } from "../data/scenes";
import { PIECES } from "../data/pieces";
import { Stage } from "./GameStage";
import { t } from "../lib/locale";

/* 홈의 시연.

   글로 "게임 컨셉에 맞춰 변환합니다" 라고 쓰면 아무도 안 믿는다. 같은 에셋이
   원본일 때와 맞췄을 때 어떻게 다른지 한 화면에서 보여 주는 게 이 제품의
   전부라, 히어로 바로 다음에 온다.

   씬 페이지의 무대를 그대로 쓴다. 여기서 본 것과 들어가서 본 것이 달라지면
   시연이 아니라 광고가 된다.

   게임은 넷만 낸다. 홈에서 196개를 고르게 할 이유가 없다. 넷은 시각 방향이
   전부 다른 것으로 골랐다 — 다크 판타지, 사이버펑크, 로우폴리, 코지 픽셀.
   비슷한 걸 넷 늘어놓으면 "게임마다 다르다" 는 말이 그림으로 안 선다. */

const PICKS = ["diablo4", "cyberpunk", "valheim", "stardew"];

export function HomeStage() {
  const games = PICKS.map((id) => SCENE_GAMES.find((g) => g.id === id)).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );
  const fallback = SCENE_GAMES.slice(0, 4);
  const list = games.length >= 2 ? games : fallback;

  const [id, setId] = useState(list[0]!.id);
  const [fit, setFit] = useState(true);
  const game = list.find((g) => g.id === id) ?? list[0]!;

  // 무대 앞자리에 세울 에셋. 마켓 상위 하나면 충분하다.
  const hero = PIECES.find((p) => p.m)?.m;

  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1240px] px-5 py-16">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold text-ink">{t("정합")}</h2>
          <p className="text-xs text-muted">{t("같은 에셋이 게임마다 다르게 맞춰집니다.")}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {list.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setId(g.id)}
              aria-pressed={g.id === game.id}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs",
                g.id === game.id
                  ? "border-transparent bg-ink font-bold text-ground"
                  : "border-line text-muted hover:border-accent hover:text-ink",
              ].join(" ")}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.sw }} />
              {g.n}
            </button>
          ))}

          {/* 원본과 맞춤을 오갈 수 있어야 무엇이 달라졌는지 안다. */}
          <span className="ml-auto flex overflow-hidden rounded-full border border-line">
            {[
              [false, "원본 그대로"],
              [true, "이 게임에 맞춤"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setFit(v as boolean)}
                aria-pressed={fit === v}
                className={[
                  "cursor-pointer border-0 px-3 py-1.5 text-xs",
                  fit === v ? "bg-ink font-bold text-ground" : "bg-transparent text-muted hover:text-ink",
                ].join(" ")}
              >
                {label as string}
              </button>
            ))}
          </span>
        </div>

        <div className="mt-4">
          <Stage game={game} fit={fit} hero={hero} className="aspect-[21/9] min-h-[280px]" />
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-faint">
            {game.cat}, {game.sub}
          </span>
          <Link
            to="/scene"
            className="ml-auto text-xs font-semibold text-accent no-underline hover:underline"
          >
            {t("게임 196종에서 고르기")}
          </Link>
        </p>
      </div>
    </section>
  );
}
