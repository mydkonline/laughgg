import type { News } from "../../data/news";

/* 업계 소식 — 영어.

   키가 레코드 id 다. 원문을 고쳐도 안 끊긴다. 필드 단위로 겹치므로
   제목만 옮기고 본문은 나중에 채워도 그 레코드가 통째로 한국어로
   돌아가지 않는다.

   `figure` 처럼 중첩된 값은 통째로 갈아 끼운다 — 안쪽만 바꾸는 문법을
   만들면 표가 읽기 어려워지고, 어차피 두 칸짜리다. */
export const NEWS_EN: Record<string, Partial<News>> = {
  n1: {
    title: "Steam games declaring AI use passed 7,300",
    body: "Twice as many games as in 2024 now tick Valve's AI disclosure box for generative tools. The more disclosures pile up, the more review turns on how far you traced the training sources.",
    source: "Steam AI disclosure tally 2026",
    figure: { value: "7,300", label: "2× 2024" },
  },
  n2: {
    title: "90% of game developers have AI somewhere in their workflow",
    body: "From 615 respondents across the US, Korea, Norway, Finland and Sweden. 97% say generative AI is fundamentally changing the industry. With adoption near saturation, the contested ground moves from generating to selecting.",
    source: "Google Cloud Game Developer Survey 2025",
    figure: { value: "90%", label: "615 respondents across 5 countries" },
  },
  n3: {
    title: "Solo developers rose from 18% to 21%",
    body: "More developers now use AI tools on both code and art, and more of them finish a project alone. The smaller the team, the more they buy from a market instead of contracting out.",
    source: "Indie Developer Market 2026",
    figure: { value: "21%", label: "18% prior year" },
  },
  n4: {
    title: "Steam shipped 19,606 new titles in 2025, up 14.3%",
    body: "More releases means less visibility each. That is the backdrop for art quality mattering again as the thing that decides early exposure.",
    source: "Video Game Insights 2026",
    figure: { value: "19,606 titles", label: "+14.3% year over year" },
  },
  n5: {
    title: "The indie games market moves from $4.85B to $5.54B",
    body: "A market worth $4.85B in 2025 is estimated at $5.54B in 2026. Spend on development tools and assets moves the same direction.",
    source: "Indie Developer Market 2026",
    figure: { value: "$5.54B", label: "2026 estimate" },
  },
  n6: {
    title: "Over 70% of indie developers use AI tools in their workflow",
    body: "Adoption is highest among solo developers and small teams, who report 30–50% faster coding and 40% faster debugging. What to filter all that output with is the next problem.",
    source: "Indie Developer Market 2026",
    figure: { value: "70%+", label: "Highest among solo and small teams" },
  },
  a1: { title: "When generation is cheap, what gets expensive" },
  a2: { title: "Why training provenance carries the most weight" },
  a3: { title: "Why the fee is not tied to the badge" },
};
