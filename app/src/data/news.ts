/* 커뮤니티 읽을거리.

   뉴스는 출처가 있는 것만 싣는다. 요약은 우리가 쓰되 숫자는 원문 그대로 옮기고,
   원문 링크를 같이 낸다 — 출처 없는 업계 소식은 소문이지 뉴스가 아니다.

   기사는 우리가 쓴 분석이다. 남의 이름을 빌리지 않는다. */

export type News = {
  id: string;
  /** 며칠 전인지. 고정 날짜를 박으면 몇 달 뒤에 유물처럼 보인다. */
  daysAgo: number;
  tag: "시장" | "기술" | "정책" | "도구";
  title: string;
  body: string;
  /** 기사에서 인용한 수치 */
  figure?: { value: string; label: string };
  source: string;
  url: string;
};

export const NEWS: News[] = [
  {
    id: "n1",
    daysAgo: 2,
    tag: "시장",
    title: "AI 사용을 공시한 스팀 게임이 7,300종을 넘겼다",
    body: "밸브가 요구하는 AI 사용 공시란에 생성 도구 사용을 적은 게임이 2024년의 두 배가 됐다. 공시가 늘수록 학습 소스를 어디까지 밝혀야 하는지가 심의 쟁점으로 올라온다.",
    figure: { value: "7,300종", label: "2024년의 2배" },
    source: "Steam AI 공시 집계 2026",
    url: "https://aibuzz.blog/ai-in-gaming-game-development/",
  },
  {
    id: "n2",
    daysAgo: 5,
    tag: "기술",
    title: "게임 개발자 90%가 작업 흐름에 AI를 넣었다",
    body: "미국, 한국, 노르웨이, 핀란드, 스웨덴 5개국 615명 조사 결과다. 97%는 생성형 AI가 업계를 근본적으로 바꾸고 있다고 답했다. 도입률이 포화에 가까워지면서 경쟁 지점이 생성에서 선별로 옮겨 간다.",
    figure: { value: "90%", label: "5개국 615명 조사" },
    source: "Google Cloud 게임 개발자 조사 2025",
    url: "https://aibuzz.blog/ai-in-gaming-game-development/",
  },
  {
    id: "n3",
    daysAgo: 9,
    tag: "시장",
    title: "1인 개발자 비중이 18%에서 21%로 올랐다",
    body: "코드와 에셋 양쪽에서 AI 도구를 쓰는 개발자가 늘면서 혼자 프로젝트를 끝내는 비율이 올라갔다. 팀이 작아질수록 외주 대신 마켓에서 사 오는 비중이 커진다.",
    figure: { value: "21%", label: "전년 18%" },
    source: "Indie Developer Market 2026",
    url: "https://fungies.io/indie-developer-market-analysis-2026/",
  },
  {
    id: "n4",
    daysAgo: 14,
    tag: "시장",
    title: "2025년 스팀 신작이 19,606종으로 14.3% 늘었다",
    body: "출시 수가 늘어난 만큼 개별 게임이 확보하는 노출은 줄었다. 아트 품질이 초기 노출을 가르는 변수로 다시 올라오는 배경이다.",
    figure: { value: "19,606종", label: "전년 대비 +14.3%" },
    source: "Video Game Insights 2026",
    url: "https://www.shanethegamer.com/research/indie-games-statistics/",
  },
  {
    id: "n5",
    daysAgo: 21,
    tag: "도구",
    title: "인디 게임 시장이 48.5억 달러에서 55.4억 달러로",
    body: "2025년 48.5억 달러였던 인디 게임 시장이 2026년 55.4억 달러로 추정된다. 개발 도구와 에셋 지출도 같은 방향으로 움직인다.",
    figure: { value: "55.4억 달러", label: "2026년 추정" },
    source: "Indie Developer Market 2026",
    url: "https://fungies.io/indie-developer-market-analysis-2026/",
  },
  {
    id: "n6",
    daysAgo: 28,
    tag: "정책",
    title: "인디 개발자 70% 이상이 작업 흐름에 AI 도구를 쓴다",
    body: "1인과 소규모 팀에서 도입률이 가장 높다. 코딩 생산성 30~50%, 디버깅 40% 단축을 보고한다. 늘어난 산출물을 무엇으로 거를 것인가가 다음 문제다.",
    figure: { value: "70%+", label: "1인·소규모 팀 최다" },
    source: "Indie Developer Market 2026",
    url: "https://fungies.io/indie-developer-market-analysis-2026/",
  },
];

export type Article = {
  id: string;
  daysAgo: number;
  /** 읽는 데 걸리는 시간. 목록에서 고를 때 제일 먼저 보는 값이다. */
  minutes: number;
  kind: "분석" | "기준" | "기록";
  title: string;
  lead: string;
  /** 소제목과 본문. 긴 글은 소제목이 있어야 훑힌다. */
  body: [string, string][];
};

export const ARTICLES: Article[] = [
  {
    id: "a1",
    daysAgo: 3,
    minutes: 6,
    kind: "분석",
    title: "생성이 흔해지면 무엇이 비싸지는가",
    lead: "만드는 비용이 0에 수렴할 때 값이 붙는 건 만든 물건이 아니라 그 물건이 쓸 만하다는 보증이다.",
    body: [
      [
        "공급이 아니라 선별이 병목이다",
        "생성 도구로 하루에 모델 수백 개를 뽑을 수 있게 되면서, 개발팀의 시간은 만드는 데서 고르는 데로 옮겨 갔다. 파이프라인 담당자가 하루에 볼 수 있는 에셋 수는 그대로인데 후보만 100배가 됐다. 병목은 공급이 아니라 선별에 있다.",
      ],
      [
        "품질은 개별 값이 아니라 관계 값이다",
        "잘 만든 에셋이라도 프로젝트 톤과 어긋나면 못 쓴다. 열 개를 뽑으면 열 개가 다 다른 세계관이라는 말이 그래서 나온다. 절대 품질보다 정합성이 먼저 걸린다.",
      ],
      [
        "그래서 재는 쪽에 값이 붙는다",
        "만드는 능력이 흔해질수록 판별 기준이 희소해진다. 우리가 에셋을 만들지 않고 점수를 만드는 이유다.",
      ],
    ],
  },
  {
    id: "a2",
    daysAgo: 11,
    minutes: 8,
    kind: "기준",
    title: "학습 소스를 왜 가장 무겁게 보는가",
    lead: "7항목 중 라이선스 출처에 22%를 준 이유. 다른 여섯 항목은 고칠 수 있고 이것만 못 고친다.",
    body: [
      [
        "고칠 수 있는 문제와 못 고치는 문제",
        "면이 지저분하면 리토폴로지하면 되고, 드로우콜이 많으면 아틀라스로 합치면 된다. 전부 시간 문제다. 하지만 학습 소스에 남의 저작물이 섞였다면 그 에셋은 손볼 방법이 없다. 되돌릴 수 없는 항목에 가중치를 몰아야 하는 이유다.",
      ],
      [
        "구매자가 지는 위험이다",
        "출처가 불분명한 재료가 섞이면 문제가 되는 건 만든 사람이 아니라 그걸 출시한 게임이다. 위험을 지는 쪽이 사는 쪽이라, 사기 전에 알려 줘야 한다.",
      ],
      [
        "역추적이 기술 과제다",
        "생성 결과물만 보고 학습 소스를 되짚는 일은 쉽지 않다. 그래서 여기가 경쟁 지점이 된다. 누구나 만들 수 있게 된 다음에도 이건 어렵다.",
      ],
    ],
  },
  {
    id: "a3",
    daysAgo: 24,
    minutes: 5,
    kind: "기록",
    title: "수수료를 배지에 연동하지 않기로 한 이유",
    lead: "높은 배지에 낮은 수수료를 매기는 안을 검토했다가 접었다.",
    body: [
      [
        "검토한 안",
        "배지가 높을수록 수수료를 깎아 주면 창작자가 점수를 올릴 동기가 생긴다. 얼핏 맞는 설계로 보였다.",
      ],
      [
        "접은 이유",
        "채점하는 쪽이 수수료도 정하면, 점수를 낮게 주는 게 우리 이익이 된다. 이해가 충돌하는 구조는 아무리 잘 운영해도 신뢰를 못 받는다.",
      ],
      [
        "대신 노출로 보상한다",
        "수수료는 8% 단일로 고정하고, 배지는 목록에서의 자리만 정한다. 점수를 높게 주는 것이 우리에게 손해가 되지 않으므로 채점을 왜곡할 이유가 없다.",
      ],
    ],
  },
];
