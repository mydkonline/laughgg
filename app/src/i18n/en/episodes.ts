import type { Episode } from "../../data/episodes";

/* 개발 브이로그 — 영어.

   키가 회차 번호다. 편마다 질답이 붙는데 `qa` 는 배열이라 통째로 갈아
   끼운다 — 안쪽 항목만 겹치는 문법을 만들면 순서가 어긋났을 때 질문과
   답이 섞인다. */
export const EPISODES_EN: Record<string, Partial<Episode>> = {
  1: {
    t: "Silhouette first",
    cap: "Blockout, 412 polygons",
    body: "You do not start with detail. First it has to read as a shape you can name from across the room. Get this wrong and no amount of polish later saves it.",
    qa: [
      [
        "Why start with a blockout?",
        "In a game most things are small on screen. If the silhouette does not separate at that size, no texture will fix it. The shape is decided here.",
      ],
    ],
  },
  2: {
    t: "Locking the form in high poly",
    cap: "High poly, 84,000 polygons",
    body: "Detail goes on top of the blockout — the fuller on the blade, the wrap on the grip, the pattern on the guard. This mesh never ships. It exists to bake a normal map.",
    qa: [
      [
        "Is 84,000 polygons not heavy?",
        "It is fine, because this is the source for the normal bake, not the final asset. What ships is the low poly in the next episode.",
      ],
    ],
  },
  3: {
    t: "Retopology — this is where the score is decided",
    cap: "Low poly, 2,140 polygons, 96% quads",
    body: "This is the step the mesh integrity check looks at. Scatter triangles around and faces fold during animation. Quad ratio is up to 96%.",
    qa: [
      ["What did it score on the first submission?", "68. It lost points on mesh integrity. After redoing the retopology it came back 89."],
      ["Does resubmitting cost anything?", "No. There is no cap on re-registrations, so I kept resubmitting until it passed."],
    ],
  },
  4: {
    t: "Unwrapped the UVs and baked the textures",
    cap: "2048² texture, one atlas",
    body: "Splitting textures across several sheets adds draw calls. One sword, one 2048 atlas. This is what the runtime cost score is reading.",
    qa: [
      [
        "Would 4K not be better?",
        "If the texture is bigger than the pixels the sword occupies on screen, it is waste. Submitting at 4K actually scored lower on performance.",
      ],
    ],
  },
  5: {
    t: "Built three LOD steps",
    cap: "LOD0 2,140 / LOD1 820 / LOD2 260",
    body: "There is no reason to draw 2,000 polygons at distance. Three steps. That alone visibly changes frame time in a scene with a lot of these placed.",
    qa: [
      [
        "Can you not just use an automatic LOD tool?",
        "You can. Auto-generated LOD2 sometimes breaks the silhouette though, so I redid LOD2 by hand.",
      ],
    ],
  },
  6: {
    t: "Put it on an actual game screen",
    cap: "In-game placement, scaled against the character",
    body: "I dropped it onto a real game background in the LaughGG demo view. In hand the sword read bigger than expected, so it came down 12%. You never catch that in a viewport.",
    qa: [
      [
        "Can you run the demo before registering?",
        "You can, and I would recommend it. Scale and tone problems are cheapest to fix right there.",
      ],
    ],
  },
  7: {
    t: "Registered it, and got Challenger",
    cap: "Final, total 94",
    body: "Six of the seven checks cleared 90. Code quality was lowest at 82 — managing shader variants through scripts is what caught. That is the thing to fix on the next asset.",
    qa: [
      [
        "What about the material provenance score?",
        "98. Everything was made from scratch and I submitted the licenses of the reference photos as a list. Under 60 on that check and nothing else matters.",
      ],
    ],
  },
};
