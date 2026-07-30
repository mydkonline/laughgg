//! 실제 GLB 파일로 파서를 확인한다.
//!
//! 합성 바이트로 만든 단위 테스트만으로는 진짜 파일을 읽는지 모른다.
//! 실제 파일에는 내가 안 만든 청크와 확장이 들어 있다.

use laughgg_api::{analyzer::analyze_file, domain::Origin};

/* 진짜 GLB 하나.

마켓 화면이 이미 쓰는 파일을 그대로 가리킨다. 테스트 폴더에 복사본을
두면 213KB 가 두 벌이 되고, 어느 쪽이 원본인지와 그 출처(Kenney, CC0 —
CREDITS.md)가 흐려진다. */
const SAMPLE: &[u8] = include_bytes!("../../../assets/dungeon/character-human.glb");

#[test]
fn a_real_glb_is_read_without_guessing() {
    let a = analyze_file("character-human.glb", SAMPLE, Origin::PublicDomain)
        .expect("Poly Haven CC0 모델을 못 읽으면 파서가 잘못된 것이다");

    // 빈 모델로 잡히면 안 된다. 그러면 0점이 나간다.
    assert!(a.runtime_cost > 0, "삼각형을 못 셌다");
    assert!(a.mesh_integrity > 0);

    // 라이선스는 신고에서 온다. CC0 신고면 높아야 한다.
    assert_eq!(a.license_clean, Origin::PublicDomain.declared_score());

    // 메시 에셋이라 코드 품질은 해당 없음이다.
    assert!(a.code_quality.is_none());

    assert!(a.total > 0 && a.total <= 100, "총점 범위: {}", a.total);
}

/* 같은 파일이면 같은 점수가 나와야 한다.

채점에 난수나 시각이 섞이면 올릴 때마다 배지가 달라진다. */
#[test]
fn scoring_is_deterministic() {
    let a = analyze_file("x.glb", SAMPLE, Origin::SelfMade).expect("읽기");
    let b = analyze_file("x.glb", SAMPLE, Origin::SelfMade).expect("읽기");
    assert_eq!(a.total, b.total);
    assert_eq!(a.notes, b.notes);
}

/// 출처 신고만 바꿔도 점수가 움직인다. 파일은 그대로다.
#[test]
fn the_declared_origin_moves_the_score() {
    let declared = analyze_file("x.glb", SAMPLE, Origin::PublicDomain).expect("읽기");
    let hidden = analyze_file("x.glb", SAMPLE, Origin::Unknown).expect("읽기");

    assert!(
        declared.total > hidden.total,
        "출처를 밝힌 쪽이 높아야 한다: {} vs {}",
        declared.total,
        hidden.total
    );
    assert!(hidden.license_clean < 60, "안 밝히면 통과선 아래");
}

/// 점수가 깎였으면 이유가 있어야 한다.
#[test]
fn every_score_comes_with_readable_notes() {
    let a = analyze_file("x.glb", SAMPLE, Origin::SelfMade).expect("읽기");
    // 이 모델은 텍스처가 임베드 안 돼 있어서 적어도 그 지적은 나온다.
    assert!(!a.notes.is_empty(), "점수만 주면 무엇을 고쳐야 할지 모른다");
    for n in &a.notes {
        assert!(!n.is_empty());
    }
}
