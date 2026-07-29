import { REUSE_AXIS, REUSE_LABEL } from "../data/reuse";
import { t } from "../lib/locale";

/* 재사용 난도 뱃지. "재사용 쉬움/보통/어려움" 한 단어로, 어려움만 붉게 —
   장롱 위험 신호를 색으로 준다. 색은 팔레트의 경고 빨강 하나만 더 쓴다. */
const TONE: Record<string, string> = {
  낮음: "border-line text-muted",
  보통: "border-line text-faint",
  높음: "border-[#FF6B7A]/45 text-[#FF6B7A]",
};

export function ReuseBadge({ cat, className = "" }: { cat: string; className?: string }) {
  const a = REUSE_AXIS[cat];
  if (!a) return null;
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[10px] leading-none ${TONE[a.risk]} ${className}`}
    >
      {t(REUSE_LABEL[a.risk])}
    </span>
  );
}
