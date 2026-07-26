/* 내보내기 형식.

   형식을 한 줄에 늘어놓으면 열다섯 개가 되어 아무도 못 고른다.
   사는 사람이 실제로 아는 건 확장자가 아니라 "내 엔진" 이므로,
   대상을 먼저 고르게 하고 형식은 그 아래에 접어 둔다.

   기준은 2026년 기준 엔진별 실제 임포트 지원이다.
     FBX   애니메이션과 리깅을 옮기는 산업 표준. UE5 의 주 임포트 경로다.
     GLB   메시·재질·텍스처가 한 파일에 들어간다. Godot 4 는 네이티브로 읽는다.
     OBJ   지오메트리와 기본 UV 만. 애니메이션과 PBR 재질이 없다.
     USDZ  애플 AR Quick Look 전용.
*/

export type FileKind = "3d" | "2d" | "tex" | "pack";

export type Format = {
  ext: string;
  name: string;
  kind: FileKind;
  /** 이 형식이 담는 것 */
  holds: string;
  /** 한 줄 주의사항. 없으면 비운다. */
  caveat?: string;
};

export const FORMATS: Format[] = [
  { ext: "fbx", name: "FBX", kind: "3d", holds: "메시, 리깅, 애니메이션", caveat: "텍스처는 따로 나갑니다" },
  { ext: "glb", name: "GLB", kind: "3d", holds: "메시, 재질, 텍스처 한 파일" },
  { ext: "gltf", name: "glTF", kind: "3d", holds: "메시, 재질", caveat: "텍스처가 별도 파일로 나갑니다" },
  { ext: "obj", name: "OBJ", kind: "3d", holds: "지오메트리, UV", caveat: "애니메이션과 PBR 재질이 없습니다" },
  { ext: "usdz", name: "USDZ", kind: "3d", holds: "메시, 재질", caveat: "애플 AR 전용입니다" },
  { ext: "dae", name: "Collada", kind: "3d", holds: "메시, 리깅", caveat: "오래된 파이프라인용입니다" },
  { ext: "stl", name: "STL", kind: "3d", holds: "지오메트리만", caveat: "출력용입니다. 게임에는 안 씁니다" },
  { ext: "abc", name: "Alembic", kind: "3d", holds: "구운 정점 애니메이션", caveat: "용량이 큽니다" },

  { ext: "png", name: "PNG", kind: "2d", holds: "단일 이미지, 알파 포함" },
  { ext: "webp", name: "WebP", kind: "2d", holds: "단일 이미지", caveat: "엔진에 따라 임포트가 막힙니다" },
  { ext: "tga", name: "TGA", kind: "2d", holds: "단일 이미지", caveat: "무압축이라 용량이 큽니다" },
  { ext: "sheet", name: "스프라이트 시트", kind: "2d", holds: "PNG 아틀라스와 JSON 좌표" },
  { ext: "seq", name: "PNG 시퀀스", kind: "2d", holds: "프레임별 낱장" },

  { ext: "ktx2", name: "KTX2", kind: "tex", holds: "GPU 압축 텍스처", caveat: "런타임 메모리를 크게 줄입니다" },
  { ext: "dds", name: "DDS", kind: "tex", holds: "GPU 압축 텍스처", caveat: "데스크톱 위주입니다" },
  { ext: "exr", name: "EXR", kind: "tex", holds: "HDR 텍스처" },

  { ext: "unitypackage", name: "Unity 패키지", kind: "pack", holds: "프리팹, 재질, 임포트 설정" },
  { ext: "uasset", name: "Unreal 에셋", kind: "pack", holds: "블루프린트, 머티리얼 인스턴스" },
  { ext: "zip", name: "ZIP", kind: "pack", holds: "폴더 구조 그대로" },
];

export type Target = {
  id: string;
  name: string;
  /** 무엇을 만드는 사람인가 */
  who: string;
  /** 고르면 기본으로 들어가는 형식 */
  picks: string[];
};

/* 대상을 고르면 형식이 정해진다. 사는 사람이 아는 건 확장자가 아니라 자기 엔진이다. */
export const TARGETS: Target[] = [
  { id: "unity", name: "Unity", who: "Unity 프로젝트", picks: ["fbx", "png", "unitypackage"] },
  { id: "unreal", name: "Unreal", who: "Unreal Engine 5", picks: ["fbx", "png", "uasset"] },
  { id: "godot", name: "Godot", who: "Godot 4", picks: ["glb", "png"] },
  { id: "web", name: "웹, 뷰어", who: "three.js, Babylon", picks: ["glb", "ktx2"] },
  { id: "ar", name: "AR", who: "iOS Quick Look", picks: ["usdz", "png"] },
  { id: "2d", name: "2D 게임", who: "도트, 스프라이트", picks: ["sheet", "png"] },
  { id: "dcc", name: "DCC 편집", who: "Blender, Maya", picks: ["fbx", "obj", "exr"] },
];

export function formatOf(ext: string): Format | undefined {
  return FORMATS.find((f) => f.ext === ext);
}

/** 고른 형식들의 대략 용량. 실제 파일이 없으니 텍스처 해상도에서 어림한다. */
export function estimateSize(exts: string[], tex: string): string {
  const base: Record<string, number> = { "1K": 1.4, "2K": 5.2, "4K": 19 };
  const unit = base[tex] ?? 1.4;
  const mb = exts.reduce((a, e) => {
    const f = formatOf(e);
    if (!f) return a;
    if (f.kind === "3d") return a + (e === "abc" ? 24 : 1.2);
    if (f.kind === "tex") return a + (e === "ktx2" ? unit * 0.3 : unit * 1.4);
    if (f.kind === "pack") return a + 0.4;
    return a + unit;
  }, 0);
  return `${mb.toFixed(1)} MB`;
}
