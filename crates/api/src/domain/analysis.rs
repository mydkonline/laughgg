//! 파일에서 잰 값으로 7항목을 채점한다.
//!
//! **올리는 사람이 점수를 정하지 않는다.** 정하게 두면 다들 100 을 놓고
//! 챌린저를 받고, 그 순간 배지가 아무 의미가 없어진다 — "검증된 마켓" 이라는
//! 말이 거기서 무너진다.
//!
//! 다만 일곱 항목이 전부 파일에서 나오는 건 아니다. 정직하게 갈라 둔다.
//!
//! | 항목 | 파일에서 나오나 | 무엇으로 |
//! |---|---|---|
//! | 면 무결성 | 예 | 프리미티브당 삼각형, 인덱스 유무 |
//! | 텍스처 품질 | 예 | 임베드 텍스처 해상도 |
//! | LOD 구성 | 예 | LOD 메시 존재 |
//! | 런타임 비용 | 예 | 삼각형 수, 재질 수(드로우콜) |
//! | 통합 난이도 | 예 | 포맷, 쓰는 확장 |
//! | 코드 품질 | **아니오** | glTF 에 스크립트가 없다 |
//! | 라이선스 출처 | **아니오** | 파일로는 알 수 없다 |
//!
//! 못 재는 둘을 지어내지 않는다. 코드 품질은 메시 에셋에 해당이 없어 가중치를
//! 나머지에 나누고, 라이선스는 올리는 사람이 **출처를 신고**한다 — 점수를
//! 고르는 것과 출처를 밝히는 건 다른 일이다. 신고는 나중에 감사할 수 있다.

use serde::{Deserialize, Serialize};

/// 파일에서 실제로 잰 값. 파서가 채우고, 채점은 이걸로만 한다.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Facts {
    pub triangles: u32,
    /// 그리기 호출 수에 대략 비례한다.
    pub materials: u32,
    pub meshes: u32,
    pub primitives: u32,
    /// 임베드된 텍스처의 짧은 변 길이들. 비어 있으면 텍스처가 없다.
    pub texture_sides: Vec<u32>,
    /// 이름이 LOD 규칙을 따르는 메시가 있나.
    pub has_lod: bool,
    /// 인덱스 없는 프리미티브 수. 정점이 중복 저장돼 용량이 는다.
    pub unindexed: u32,
    /// 쓰는 glTF 확장. 많을수록 엔진이 못 읽을 확률이 는다.
    pub extensions: Vec<String>,
    pub bytes: u64,
}

/// 출처 신고. 올리는 사람이 고르고, 우리가 감사한다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    /// 직접 만들었다.
    SelfMade,
    /// CC0 등 출처가 공개된 것을 썼다.
    PublicDomain,
    /// 상업 라이선스를 샀다.
    Licensed,
    /// AI 로 만들었다. Unity 도 2026 기준 이 신고를 요구한다.
    AiGenerated,
    /// 모르겠다. 신고를 안 한 것과 같다.
    Unknown,
}

impl Origin {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::SelfMade => "self_made",
            Self::PublicDomain => "public_domain",
            Self::Licensed => "licensed",
            Self::AiGenerated => "ai_generated",
            Self::Unknown => "unknown",
        }
    }

    #[must_use]
    pub fn from_label(s: &str) -> Option<Self> {
        match s {
            "self_made" => Some(Self::SelfMade),
            "public_domain" => Some(Self::PublicDomain),
            "licensed" => Some(Self::Licensed),
            "ai_generated" => Some(Self::AiGenerated),
            "unknown" => Some(Self::Unknown),
            _ => None,
        }
    }

    /* 신고만으로 매기는 점수.

    확인된 게 아니라 신고라서 만점을 주지 않는다. 출처가 공개된 것과 산
    라이선스는 우리가 검증할 길이 있어서 높고, 직접 만들었다는 말은 확인할
    방법이 없어 중간이다.

    신고를 안 하면 60 미만이라 그 자리에서 탈락한다. 밝히지 않은 물건을
    파는 게 이 마켓이 없애려는 것이기 때문이다. */
    #[must_use]
    pub const fn declared_score(self) -> u8 {
        match self {
            Self::PublicDomain => 92,
            Self::Licensed => 88,
            Self::SelfMade => 78,
            // AI 생성은 학습 소스를 역추적할 수 없다. 밝힌 것만으로 통과선은 넘는다.
            Self::AiGenerated => 66,
            Self::Unknown => 40,
        }
    }
}

/// 채점 결과. 항목별 점수와 왜 그렇게 나왔는지.
#[derive(Debug, Clone, Serialize)]
pub struct Analysis {
    pub mesh_integrity: u8,
    pub texture_quality: u8,
    pub lod_setup: u8,
    pub runtime_cost: u8,
    pub license_clean: u8,
    pub integration: u8,
    /// 메시 에셋에는 코드가 없다. 해당 없음이면 가중치를 나머지에 나눈다.
    pub code_quality: Option<u8>,
    pub total: u8,
    /// 사람이 읽는 이유. 점수만 주면 무엇을 고쳐야 할지 모른다.
    pub notes: Vec<String>,
}

/* 삼각형 수로 런타임 비용을 잰다.

게임 에셋 하나가 몇 만 삼각형을 넘으면 그 자체로 프레임을 먹는다.
반대로 너무 적으면 형태가 안 나온다 — 100 삼각형짜리는 쓸 데가 없다. */
const IDEAL_TRIS_LOW: u32 = 500;
const IDEAL_TRIS_HIGH: u32 = 30_000;
const TOO_MANY_TRIS: u32 = 150_000;

/// 텍스처가 이보다 작으면 가까이서 뭉갠다.
const MIN_TEXTURE: u32 = 512;
/// 이보다 크면 메모리만 먹는다. 4K 는 대부분의 소품에 과하다.
const BIG_TEXTURE: u32 = 4096;

/// 잰 값과 출처 신고로 채점한다.
///
/// 항목마다 함수를 나눈다. 한 함수에 몰면 어느 조건이 어느 점수를 만드는지
/// 읽기가 어려워지고, 하나를 고칠 때 옆을 건드리게 된다.
#[must_use]
pub fn score(facts: &Facts, origin: Origin) -> Analysis {
    let mut notes = Vec::new();

    let runtime_cost = runtime(facts, &mut notes);
    let mesh_integrity = mesh(facts, &mut notes);
    let texture_quality = texture(facts, &mut notes);
    let lod_setup = lod(facts, &mut notes);
    let integration = integration(facts, &mut notes);

    let license_clean = origin.declared_score();
    if origin == Origin::Unknown {
        notes.push("출처를 밝히지 않아 노출에서 제외됩니다.".into());
    }

    // glTF 에는 스크립트가 없다. 지어내지 않고 해당 없음으로 둔다.
    let code_quality = None;

    let total = weighted(
        mesh_integrity,
        texture_quality,
        lod_setup,
        runtime_cost,
        license_clean,
        integration,
        code_quality,
    );

    Analysis {
        mesh_integrity,
        texture_quality,
        lod_setup,
        runtime_cost,
        license_clean,
        integration,
        code_quality,
        total,
        notes,
    }
}

/// 삼각형 수와 재질 수. 둘 다 프레임을 먹는다.
fn runtime(facts: &Facts, notes: &mut Vec<String>) -> u8 {
    let base = if facts.triangles == 0 {
        notes.push("삼각형이 없습니다. 빈 모델이거나 읽지 못했습니다.".into());
        0
    } else if facts.triangles > TOO_MANY_TRIS {
        notes.push(format!(
            "삼각형 {}개는 게임 에셋 하나로는 너무 많습니다.",
            facts.triangles
        ));
        30
    } else if facts.triangles > IDEAL_TRIS_HIGH {
        // 3만~15만 구간에서 선형으로 깎는다.
        let over = f64::from(facts.triangles - IDEAL_TRIS_HIGH)
            / f64::from(TOO_MANY_TRIS - IDEAL_TRIS_HIGH);
        notes.push("삼각형이 많습니다. LOD 를 붙이면 좋습니다.".into());
        pct(90.0 - over * 55.0)
    } else if facts.triangles < IDEAL_TRIS_LOW {
        notes.push("삼각형이 적습니다. 형태가 단순하거나 잘린 모델일 수 있습니다.".into());
        70
    } else {
        95
    };

    // 재질 수는 드로우콜로 이어진다. 하나짜리가 제일 싸다.
    if facts.materials > 8 {
        notes.push(format!(
            "재질이 {}개입니다. 드로우콜이 그만큼 늘어납니다.",
            facts.materials
        ));
        base.saturating_sub(15)
    } else {
        base
    }
}

/// 인덱스 유무와 프리미티브 쪼개짐.
fn mesh(facts: &Facts, notes: &mut Vec<String>) -> u8 {
    if facts.triangles == 0 {
        0
    } else if facts.unindexed > 0 {
        notes.push(format!(
            "인덱스 없는 프리미티브가 {}개입니다. 정점이 중복 저장됩니다.",
            facts.unindexed
        ));
        60
    } else if facts.primitives > facts.meshes * 4 {
        notes.push("메시 하나에 프리미티브가 많이 쪼개져 있습니다.".into());
        75
    } else {
        92
    }
}

/// 임베드 텍스처의 짧은 변.
fn texture(facts: &Facts, notes: &mut Vec<String>) -> u8 {
    match facts.texture_sides.iter().min() {
        None => {
            notes.push("임베드된 텍스처가 없습니다. 재질만 있는 모델입니다.".into());
            55
        }
        Some(&side) if side < MIN_TEXTURE => {
            notes.push(format!("텍스처가 {side}px 입니다. 가까이서 뭉갭니다."));
            50
        }
        Some(&side) if side > BIG_TEXTURE => {
            notes.push(format!("텍스처가 {side}px 입니다. 메모리를 많이 씁니다."));
            75
        }
        Some(_) => 90,
    }
}

/// 무거운 모델에 LOD 가 없으면 실제로 문제다. 가벼우면 없어도 된다.
fn lod(facts: &Facts, notes: &mut Vec<String>) -> u8 {
    if facts.has_lod {
        90
    } else if facts.triangles > IDEAL_TRIS_HIGH {
        notes.push("무거운 모델인데 LOD 가 없습니다.".into());
        40
    } else {
        70
    }
}

/// 엔진이 못 읽을 확장을 쓰는가.
fn integration(facts: &Facts, notes: &mut Vec<String>) -> u8 {
    let odd: Vec<&str> = facts
        .extensions
        .iter()
        .map(String::as_str)
        .filter(|e| !COMMON_EXTENSIONS.contains(e))
        .collect();

    if odd.is_empty() {
        return 92;
    }
    notes.push(format!(
        "엔진이 못 읽을 수 있는 확장을 {}개 씁니다: {}",
        odd.len(),
        odd.join(", ")
    ));
    // 확장 하나당 15점씩 깎는다.
    let penalty = u8::try_from(odd.len().saturating_mul(15).min(85)).unwrap_or(85);
    85_u8.saturating_sub(penalty)
}

/// 대부분의 엔진이 읽는 확장. 이 밖은 임포트가 막힐 수 있다.
const COMMON_EXTENSIONS: &[&str] = &[
    "KHR_materials_unlit",
    "KHR_texture_transform",
    "KHR_materials_emissive_strength",
    "KHR_mesh_quantization",
    "KHR_draco_mesh_compression",
    "KHR_lights_punctual",
    "KHR_materials_ior",
    "KHR_materials_specular",
    "KHR_texture_basisu",
];

/* 가중치. `domain::score` 와 같은 값이다.

코드 품질이 해당 없음이면 그 8%를 나머지에 비례해 나눈다. 0 점으로 두면
메시 에셋이 전부 8점씩 손해를 보는데, 없는 항목으로 깎을 이유가 없다. */
const W_MESH: u32 = 15;
const W_TEXTURE: u32 = 13;
const W_LOD: u32 = 12;
const W_RUNTIME: u32 = 18;
const W_LICENSE: u32 = 22;
const W_INTEGRATION: u32 = 12;
const W_CODE: u32 = 8;

fn weighted(
    mesh: u8,
    texture: u8,
    lod: u8,
    runtime: u8,
    license: u8,
    integration: u8,
    code: Option<u8>,
) -> u8 {
    let mut sum = u32::from(mesh) * W_MESH
        + u32::from(texture) * W_TEXTURE
        + u32::from(lod) * W_LOD
        + u32::from(runtime) * W_RUNTIME
        + u32::from(license) * W_LICENSE
        + u32::from(integration) * W_INTEGRATION;
    let mut total_weight = W_MESH + W_TEXTURE + W_LOD + W_RUNTIME + W_LICENSE + W_INTEGRATION;

    if let Some(c) = code {
        sum += u32::from(c) * W_CODE;
        total_weight += W_CODE;
    }

    // 가중치 합으로 나눈다. 코드 품질이 빠지면 92 로 나뉘어 나머지가 커진다.
    let avg = (sum + total_weight / 2) / total_weight;
    u8::try_from(avg.min(100)).unwrap_or(100)
}

/// 0..=100 으로 좁힌다.
fn pct(v: f64) -> u8 {
    let c = v.clamp(0.0, 100.0);
    // 0..=100 으로 좁힌 뒤라 변환은 실패하지 않는다.
    #[expect(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "위에서 좁혔다"
    )]
    let out = c.round() as u8;
    out
}

#[cfg(test)]
mod tests {
    use super::{Facts, Origin, score};

    /// 무난한 게임 에셋 하나.
    fn ordinary() -> Facts {
        Facts {
            triangles: 8_000,
            materials: 1,
            meshes: 1,
            primitives: 1,
            texture_sides: vec![2048],
            has_lod: false,
            unindexed: 0,
            extensions: vec!["KHR_texture_transform".into()],
            bytes: 4_000_000,
        }
    }

    #[test]
    fn an_ordinary_asset_passes() {
        let a = score(&ordinary(), Origin::SelfMade);
        assert!(a.total >= 70, "무난한 에셋이 탈락하면 안 된다: {a:?}");
        assert!(a.code_quality.is_none(), "메시 에셋에는 코드가 없다");
    }

    /* 출처를 안 밝히면 탈락한다.

    다른 점수가 아무리 좋아도 그렇다. 밝히지 않은 물건을 파는 게 이 마켓이
    없애려는 것이다. */
    #[test]
    fn an_undeclared_origin_is_flagged() {
        let a = score(&ordinary(), Origin::Unknown);
        assert!(a.license_clean < 60, "신고 없으면 통과선 아래여야 한다");
        assert!(
            a.notes.iter().any(|n| n.contains("출처")),
            "왜 깎였는지 알려 줘야 한다: {:?}",
            a.notes
        );
    }

    #[test]
    fn declared_origins_are_ordered_by_how_verifiable_they_are() {
        // 확인할 길이 있는 것일수록 높다. 만점은 아무에게도 안 준다 —
        // 확인된 게 아니라 신고이기 때문이다.
        assert!(Origin::PublicDomain.declared_score() > Origin::SelfMade.declared_score());
        assert!(Origin::Licensed.declared_score() > Origin::AiGenerated.declared_score());
        assert!(Origin::Unknown.declared_score() < 60);
        for o in [
            Origin::PublicDomain,
            Origin::Licensed,
            Origin::SelfMade,
            Origin::AiGenerated,
        ] {
            assert!(o.declared_score() < 100, "{o:?} 에 만점을 주면 안 된다");
        }
    }

    #[test]
    fn an_empty_model_scores_zero_where_it_matters() {
        let empty = Facts {
            triangles: 0,
            ..Facts::default()
        };
        let a = score(&empty, Origin::SelfMade);
        assert_eq!(a.runtime_cost, 0);
        assert_eq!(a.mesh_integrity, 0);
        assert!(a.total < 70, "빈 모델이 통과하면 안 된다: {}", a.total);
    }

    #[test]
    fn a_heavy_model_without_lod_is_penalized() {
        let heavy = Facts {
            triangles: 120_000,
            ..ordinary()
        };
        let a = score(&heavy, Origin::SelfMade);
        assert!(a.lod_setup < 50, "무거운데 LOD 가 없으면 깎여야 한다");
        assert!(a.runtime_cost < 90);
        assert!(a.notes.iter().any(|n| n.contains("LOD")), "{:?}", a.notes);

        // LOD 를 붙이면 올라간다.
        let with_lod = Facts {
            has_lod: true,
            ..heavy
        };
        assert!(score(&with_lod, Origin::SelfMade).total > a.total);
    }

    #[test]
    fn missing_textures_are_noticed() {
        let bare = Facts {
            texture_sides: vec![],
            ..ordinary()
        };
        let a = score(&bare, Origin::SelfMade);
        assert!(a.texture_quality < 70);
        assert!(a.notes.iter().any(|n| n.contains("텍스처")));
    }

    #[test]
    fn a_tiny_texture_scores_lower_than_a_right_sized_one() {
        let small = Facts {
            texture_sides: vec![128],
            ..ordinary()
        };
        assert!(
            score(&small, Origin::SelfMade).texture_quality
                < score(&ordinary(), Origin::SelfMade).texture_quality
        );
    }

    #[test]
    fn exotic_extensions_hurt_integration() {
        let odd = Facts {
            extensions: vec!["VENDOR_secret_sauce".into(), "ANOTHER_weird_thing".into()],
            ..ordinary()
        };
        let a = score(&odd, Origin::SelfMade);
        assert!(
            a.integration < 70,
            "엔진이 못 읽을 확장은 감점: {}",
            a.integration
        );
        assert!(a.notes.iter().any(|n| n.contains("확장")));
    }

    /* 코드 품질을 빼도 총점이 안 깎인다.

    0 점으로 두면 메시 에셋이 전부 8점씩 손해를 본다. 없는 항목으로 깎을
    이유가 없다. */
    #[test]
    fn a_missing_check_is_not_counted_as_zero() {
        let a = score(&ordinary(), Origin::PublicDomain);
        // 나머지 여섯이 다 90 근처면 총점도 그래야 한다.
        assert!(
            a.total >= 80,
            "코드 품질이 없다고 총점이 깎였다: {} (항목: {} {} {} {} {} {})",
            a.total,
            a.mesh_integrity,
            a.texture_quality,
            a.lod_setup,
            a.runtime_cost,
            a.license_clean,
            a.integration
        );
    }

    #[test]
    fn notes_explain_every_deduction() {
        // 점수만 주면 무엇을 고쳐야 할지 모른다.
        let bad = Facts {
            triangles: 200_000,
            materials: 20,
            texture_sides: vec![64],
            unindexed: 3,
            extensions: vec!["VENDOR_weird".into()],
            ..ordinary()
        };
        let a = score(&bad, Origin::Unknown);
        assert!(
            a.notes.len() >= 5,
            "깎인 만큼 이유가 있어야 한다: {:?}",
            a.notes
        );
    }
}
