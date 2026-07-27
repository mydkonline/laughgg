//! 저장소 통합 테스트.
//!
//! 도메인 테스트는 순수 함수만 본다. 정작 결함이 나온 곳은 SQL 이었다 —
//! 조인이 행을 복제했고, 없는 자원이 500 으로 나갔고, 재검수가 에셋을 늘렸다.
//! 셋 다 손으로 curl 해서 찾았다. 여기서 다시 못 생기게 잡아 둔다.
//!
//! `#[sqlx::test]` 가 테스트마다 빈 DB 를 만들고 마이그레이션을 돌린 뒤
//! 끝나면 지운다. 테스트끼리 상태를 공유하지 않으므로 순서에 기대지 않는다.

use laughgg_api::{
    domain::{Credentials, Facts, Origin},
    repo::{self, AssetQuery, GameQuery, NewAsset, RepoError},
};
use sqlx::PgPool;

/// 모든 항목이 같은 점수인 검수. 총점이 그 값과 같아진다.
/// 등록에는 로그인이 필요하다. 테스트마다 계정을 하나 만들어 쓴다.
async fn an_account(pool: &PgPool, email: &str) -> i64 {
    repo::sign_up(
        pool,
        &Credentials {
            email: email.into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입")
    .id
}

/* 점수를 안 넘긴다.

등록에는 점수가 없다. 서버가 파일을 뜯어 매기고, 여기서는 출처만 신고한다. */
fn new_asset(title: &str) -> NewAsset {
    NewAsset {
        title: title.into(),
        category: "prop".into(),
        engine: "unity".into(),
        art_style: "realistic".into(),
        price_usd: 30.0,
        origin: "self_made".into(),
        file: None,
    }
}

/* 마이그레이션이 마켓 카탈로그를 시드한다.

그래서 테스트가 시작될 때 이미 에셋이 27점 들어 있다. "테이블이 비어
있다" 를 전제로 세면 시드가 늘 때마다 관계없는 테스트가 깨진다.
대신 시작값을 재 두고 늘어난 만큼을 본다 — 봐야 할 건 이 테스트가
무엇을 만들었나지 테이블에 몇 줄 있나가 아니다. */
async fn baseline(pool: &PgPool) -> laughgg_api::repo::Metrics {
    repo::metrics(pool).await.expect("시작 집계")
}

/// 방금 만든 것만 목록으로 본다. 시드가 섞이면 첫 줄이 내 것이 아니다.
async fn only(pool: &PgPool, ids: &[i64]) -> laughgg_api::repo::AssetPage {
    let list = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
    repo::list_assets(
        pool,
        &AssetQuery {
            ids: Some(list),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("목록")
}

/* 등록은 배지를 안 준다.

파일을 뜯어야 채점이 되는데 파일은 스토리지에 있다. 등록과 분석을 나눴고,
분석 전까지는 배지가 없다 — 배지가 없으면 팔리지도 않는다. 안 재고 배지를
주는 게 문제였다. */
#[sqlx::test]
async fn creating_an_asset_leaves_it_unreviewed(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let id = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록이 실패하면 안 된다");

    let d = repo::get_asset(&pool, id).await.expect("상세");
    assert!(d.row.badge.is_none(), "안 쟀는데 배지가 붙으면 안 된다");
    assert!(d.row.total.is_none());
}

/// 무난한 사실을 만든다.
fn ordinary_facts() -> Facts {
    Facts {
        triangles: 8_000,
        materials: 1,
        meshes: 1,
        primitives: 1,
        texture_sides: vec![2048],
        ..Facts::default()
    }
}

/* 분석 결과가 배지가 된다.

점수는 analyzer 가 만들고 저장소는 옮기기만 한다. 옮기면서 고치면 화면에
뜬 점수와 저장된 점수가 갈린다. */
#[sqlx::test]
async fn analysis_produces_the_badge(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let id = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");

    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    let r = repo::record_analysis(&pool, id, &analysis, &serde_json::json!({}))
        .await
        .expect("분석 기록");

    assert_eq!(r.total, analysis.total, "저장소가 점수를 고치면 안 된다");
    assert!(r.production_ready, "출처가 공개된 무난한 에셋: {}", r.total);

    let d = repo::get_asset(&pool, id).await.expect("상세");
    assert_eq!(d.row.total, Some(i16::from(analysis.total)));
}

/* 출처를 안 밝히면 못 판다.

다른 점수가 아무리 좋아도 그렇다. 밝히지 않은 물건을 파는 게 이 마켓이
없애려는 것이다. */
#[sqlx::test]
async fn an_undeclared_asset_cannot_be_sold(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let id = repo::create_asset(&pool, who, &new_asset("Sneaky"))
        .await
        .expect("등록");

    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::Unknown);
    let r = repo::record_analysis(&pool, id, &analysis, &serde_json::json!({}))
        .await
        .expect("분석 기록");

    assert!(r.license_blocked);
    assert!(!r.production_ready);

    let err = repo::record_sale(&pool, id, &repo::NewSale::default())
        .await
        .expect_err("출처 불명은 못 판다");
    assert!(matches!(err, RepoError::AssetNotSellable { .. }), "{err:?}");
}

/* 다시 분석해도 에셋이 늘면 안 된다.

한때 POST /review 가 등록 핸들러를 가리켰다. 재검수를 부를 때마다 같은
에셋이 새로 생겼고, 마켓에 중복 상품이 쌓였다. 그 경로는 없어졌지만
같은 실수를 분석 쪽에서 되풀이할 수 있다. */
#[sqlx::test]
async fn analyzing_again_adds_a_review_not_an_asset(pool: PgPool) {
    let start = baseline(&pool).await;
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");

    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::SelfMade);
    let again = repo::record_analysis(&pool, created, &analysis, &serde_json::json!({}))
        .await
        .expect("재분석");

    assert_eq!(again.asset_id, created, "같은 에셋이어야 한다");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.assets - start.assets, 1, "재분석으로 에셋이 늘면 안 된다");
    assert_eq!(
        m.reviewed - start.reviewed,
        1,
        "등록은 검수를 안 만든다. 분석 한 건이다"
    );
}

/* 목록은 에셋당 한 줄이다.

검수가 여러 건 붙으면 LEFT JOIN 이 행을 복제한다. 재검수를 고치고 나서야
드러난 결함이라, 검수가 하나뿐일 때만 테스트하면 다시 놓친다. */
#[sqlx::test]
async fn list_shows_one_row_per_asset_with_the_latest_review(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");

    // 두 번 분석해서 검수 행을 둘로 만든다. 하나뿐이면 복제를 못 잡는다.
    let first = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    repo::record_analysis(&pool, created, &first, &serde_json::json!({}))
        .await
        .expect("첫 분석");
    let empty = laughgg_api::domain::analyze(&Facts::default(), Origin::Unknown);
    repo::record_analysis(&pool, created, &empty, &serde_json::json!({}))
        .await
        .expect("재분석");

    let page = only(&pool, &[created]).await;

    assert_eq!(page.total, 1, "검수 두 건이어도 한 줄이어야 한다");
    assert_eq!(page.assets.len(), 1);
    assert_eq!(
        page.assets[0].total,
        Some(i16::from(empty.total)),
        "최신 검수가 붙어야 한다"
    );
    assert_eq!(page.assets[0].badge.as_deref(), Some("silver"));
}

#[sqlx::test]
async fn analyzing_a_missing_asset_is_not_found(pool: PgPool) {
    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::SelfMade);
    let err = repo::record_analysis(&pool, 9999, &analysis, &serde_json::json!({}))
        .await
        .expect_err("없는 에셋은 실패해야 한다");

    assert!(
        matches!(err, RepoError::AssetNotFound(9999)),
        "종류가 달라지면 HTTP 상태 코드가 틀려진다: {err:?}"
    );
}

/* 같은 창작자가 두 번 올려도 계정은 하나다. */
#[sqlx::test]
async fn the_same_creator_is_reused(pool: PgPool) {
    let start = baseline(&pool).await;
    let who = an_account(&pool, "sh@op.gg").await;
    repo::create_asset(&pool, who, &new_asset("First"))
        .await
        .expect("첫 등록");
    repo::create_asset(&pool, who, &new_asset("Second"))
        .await
        .expect("두 번째 등록");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.assets - start.assets, 2);
    assert_eq!(
        m.creators - start.creators,
        1,
        "핸들이 같으면 창작자는 하나다"
    );
}

/* 탈락률은 같은 스냅숏에서 나와야 한다. 나눠 세면 100% 를 넘을 수 있다. */
#[sqlx::test]
async fn rejection_rate_is_computed_from_the_same_snapshot(pool: PgPool) {
    let start = baseline(&pool).await;
    let who = an_account(&pool, "sh@op.gg").await;

    // 출처를 안 밝히면 다른 점수와 무관하게 탈락한다.
    let blocked = repo::create_asset(&pool, who, &new_asset("Blocked"))
        .await
        .expect("탈락 에셋");
    let a1 = laughgg_api::domain::analyze(&ordinary_facts(), Origin::Unknown);
    repo::record_analysis(&pool, blocked, &a1, &serde_json::json!({}))
        .await
        .expect("분석");

    let passed = repo::create_asset(&pool, who, &new_asset("Passed"))
        .await
        .expect("통과 에셋");
    let a2 = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    repo::record_analysis(&pool, passed, &a2, &serde_json::json!({}))
        .await
        .expect("분석");

    /* 비율은 전체에서 나온다. 시드가 전부 통과라 50% 가 안 나온다 —
    여기서 볼 것은 둘이 같은 스냅숏에서 나왔는가다. */
    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.reviewed - start.reviewed, 2);
    assert_eq!(m.rejected - start.rejected, 1);
    // 비율은 소수 한 자리로 반올림해서 내보낸다.
    #[expect(clippy::cast_precision_loss, reason = "건수는 f64 로 정확히 담긴다")]
    let expected = (1000.0 * m.rejected as f64 / m.reviewed as f64).round() / 10.0;
    assert!(
        (m.rejection_rate - expected).abs() < 1e-9,
        "탈락률이 같은 스냅숏의 두 값에서 나와야 한다: {m:?}"
    );
}

/* 패싯은 자기 축을 빼고 센다.

엔진을 고른 뒤에도 엔진 목록은 그대로여야 다른 엔진으로 갈아탈 수 있다.
자기 축까지 좁히면 고르는 순간 나머지가 0 이 되어 빠져나올 수가 없다. */
#[sqlx::test]
async fn facets_exclude_their_own_axis(pool: PgPool) {
    let all = repo::game_facets(&pool, &GameQuery::default())
        .await
        .expect("전체 패싯");
    assert!(all.engine.len() > 1, "시드에 엔진이 여럿 있어야 한다");

    let unity = all
        .engine
        .iter()
        .find(|f| f.value == "Unity")
        .expect("시드에 Unity 가 있어야 한다")
        .count;

    let picked = repo::game_facets(
        &pool,
        &GameQuery {
            engine: Some("Unity".into()),
            ..GameQuery::default()
        },
    )
    .await
    .expect("좁힌 패싯");

    assert_eq!(
        picked.engine.len(),
        all.engine.len(),
        "엔진 축은 자기 조건을 안 받으므로 선택지 수가 그대로다"
    );

    let narrowed: i64 = picked.scale.iter().map(|f| f.count).sum();
    assert_eq!(narrowed, unity, "다른 축은 Unity 로 좁혀져야 한다");
}

/* 목록과 패싯이 같은 조건을 써야 한다. 어긋나면 "62개" 라 써 놓고 12줄만 나온다. */
#[sqlx::test]
async fn list_total_matches_the_facet_count(pool: PgPool) {
    let q = GameQuery {
        engine: Some("Unity".into()),
        ..GameQuery::default()
    };

    let page = repo::list_games(&pool, &q).await.expect("목록");
    let facets = repo::game_facets(&pool, &GameQuery::default())
        .await
        .expect("패싯");
    let from_facet = facets
        .engine
        .iter()
        .find(|f| f.value == "Unity")
        .expect("Unity")
        .count;

    assert_eq!(page.total, from_facet);
}

/* JSONB 포함 조건. 스택은 게임마다 항목 수가 달라 컬럼으로 못 편다. */
#[sqlx::test]
async fn stack_filter_matches_by_tool_name(pool: PgPool) {
    let page = repo::list_games(
        &pool,
        &GameQuery {
            uses: Some("Steam Workshop".into()),
            ..GameQuery::default()
        },
    )
    .await
    .expect("스택 조회");

    assert!(page.total > 0, "시드에 Steam Workshop 을 쓰는 게임이 있다");
    assert!(
        page.total < 200,
        "조건이 안 걸리면 212 가 그대로 나온다 — 한때 실제로 그랬다"
    );
    assert!(
        page.games.iter().all(|g| {
            g.stack
                .as_array()
                .is_some_and(|xs| xs.iter().any(|x| x["name"] == "Steam Workshop"))
        }),
        "걸러진 행은 전부 그 도구를 써야 한다"
    );
}

/* 검수를 통과하지 못한 에셋은 못 판다.

배지 실버는 노출 제외인데, 노출이 안 되는 물건이 팔렸다면 우회 경로가
있다는 뜻이다. 규칙이 API 경계에서만 지켜지면 규칙이 아니라 권고가 된다. */
#[sqlx::test]
async fn a_silver_asset_cannot_be_sold(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Blocked"))
        .await
        .expect("등록");

    // 출처를 안 밝히면 실버다. 다른 점수가 아무리 좋아도 그렇다.
    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::Unknown);
    let r = repo::record_analysis(&pool, created, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");
    assert!(r.license_blocked);

    let err = repo::record_sale(&pool, created, &repo::NewSale::default())
        .await
        .expect_err("실버는 팔리면 안 된다");
    assert!(matches!(err, RepoError::AssetNotSellable { .. }), "{err:?}");
}

#[sqlx::test]
async fn selling_records_the_fee_and_shows_up_in_metrics(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");
    // 팔려면 먼저 검수를 받아야 한다. 안 재고 파는 게 문제였다.
    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    repo::record_analysis(&pool, created, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");

    let sale = repo::record_sale(&pool, created, &repo::NewSale::default())
        .await
        .expect("판매");

    // 30 달러 × 8% = 2.4. 창작자가 27.6 을 가져간다.
    assert!((sale.settlement.fee_usd - 2.4).abs() < 1e-9);
    assert!((sale.settlement.creator_usd - 27.6).abs() < 1e-9);

    let m = repo::metrics(&pool).await.expect("집계");
    assert!(
        (m.monthly_fee_usd - 2.4).abs() < 1e-9,
        "판매가 수수료 매출에 잡혀야 한다: {}",
        m.monthly_fee_usd
    );
}

#[sqlx::test]
async fn selling_an_unreviewed_asset_is_rejected(pool: PgPool) {
    // 검수 없이 에셋만 넣는다. 정상 경로로는 만들 수 없는 상태라 직접 만든다.
    sqlx::query("INSERT INTO creators (handle, display_name) VALUES ('sh','sh')")
        .execute(&pool)
        .await
        .expect("창작자");
    let id: i64 = sqlx::query_scalar(
        r"INSERT INTO assets (creator_id, title, category, engine, price_usd, art_style)
          SELECT id, 'Raw', 'prop', 'unity', 30.0, 'realistic' FROM creators WHERE handle='sh'
          RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("에셋");

    let err = repo::record_sale(&pool, id, &repo::NewSale::default())
        .await
        .expect_err("검수 전에는 못 판다");
    assert!(matches!(err, RepoError::AssetNotReviewed(_)), "{err:?}");
}

#[sqlx::test]
async fn an_unknown_studio_is_rejected(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");
    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    repo::record_analysis(&pool, created, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");

    let err = repo::record_sale(
        &pool,
        created,
        &repo::NewSale {
            studio: Some("없는 스튜디오".into()),
        },
    )
    .await
    .expect_err("없는 스튜디오는 실패해야 한다");
    assert!(matches!(err, RepoError::StudioNotFound(_)), "{err:?}");
}

/* 쪽을 넘겨도 배지 순서가 유지되어야 한다.

예전에는 다 받아 온 뒤 Rust 에서 다시 정렬했다. 쪽을 나누는 순간 그게
안 된다 — 첫 쪽 안에서만 순서가 맞고 넘기면 뒤섞인다. */
#[sqlx::test]
async fn paging_keeps_the_badge_order(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    /* 배지가 갈리게 만든다.

    출처 신고가 라이선스 점수를 정하고, 그게 총점을 통해 배지로 이어진다.
    정렬이 없으면 넣은 순서가 그대로 나온다. */
    let mut mine = Vec::new();
    for (title, origin) in [
        ("low", Origin::Unknown),
        ("mid", Origin::AiGenerated),
        ("high", Origin::PublicDomain),
    ] {
        let id = repo::create_asset(&pool, who, &new_asset(title))
            .await
            .expect("등록");
        let analysis = laughgg_api::domain::analyze(&ordinary_facts(), origin);
        repo::record_analysis(&pool, id, &analysis, &serde_json::json!({}))
            .await
            .expect("분석");
        mine.push(id);
    }
    // 시드를 빼고 방금 만든 셋만 본다. 안 그러면 쪽마다 시드가 섞인다.
    let ids = mine
        .iter()
        .map(i64::to_string)
        .collect::<Vec<_>>()
        .join(",");

    let first = repo::list_assets(
        &pool,
        &AssetQuery {
            ids: Some(ids.clone()),
            limit: Some(1),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("첫 쪽");
    assert_eq!(first.total, 3, "총계는 쪽 크기와 무관해야 한다");
    let first_badge = first.assets[0].badge.clone().expect("배지");

    let second = repo::list_assets(
        &pool,
        &AssetQuery {
            ids: Some(ids.clone()),
            limit: Some(1),
            offset: Some(1),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("둘째 쪽");
    let second_badge = second.assets[0].badge.clone().expect("배지");

    let third = repo::list_assets(
        &pool,
        &AssetQuery {
            ids: Some(ids),
            limit: Some(1),
            offset: Some(2),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("셋째 쪽");
    let third_badge = third.assets[0].badge.clone().expect("배지");

    /* 쪽을 넘겨도 순서가 유지되어야 한다.

    예전에는 다 받아 온 뒤 Rust 에서 다시 정렬했다. 쪽을 나누는 순간
    첫 쪽 안에서만 순서가 맞고 넘기면 뒤섞인다. */
    let weight = |b: &str| match b {
        "challenger" => 8,
        "diamond" => 4,
        "platinum" => 2,
        _ => 1,
    };
    assert!(
        weight(&first_badge) >= weight(&second_badge),
        "{first_badge} 가 {second_badge} 보다 뒤에 왔다"
    );
    assert!(
        weight(&second_badge) >= weight(&third_badge),
        "{second_badge} 가 {third_badge} 보다 뒤에 왔다"
    );
}

#[sqlx::test]
async fn asset_detail_carries_per_check_scores(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let created = repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");
    let analysis = laughgg_api::domain::analyze(&ordinary_facts(), Origin::PublicDomain);
    repo::record_analysis(&pool, created, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");

    let d = repo::get_asset(&pool, created).await.expect("상세");
    assert_eq!(d.row.title, "Gothic Statue");
    assert_eq!(d.sold, 0);
    let scores = d.scores.expect("검수했으면 항목별 점수가 있어야 한다");
    assert_eq!(scores["license_clean"], i64::from(analysis.license_clean));
    assert_eq!(scores["runtime_cost"], i64::from(analysis.runtime_cost));

    repo::record_sale(&pool, created, &repo::NewSale::default())
        .await
        .expect("판매");
    let after = repo::get_asset(&pool, created).await.expect("상세");
    assert_eq!(after.sold, 1, "판매 수가 붙어야 한다");
}

#[sqlx::test]
async fn a_missing_asset_detail_is_not_found(pool: PgPool) {
    let err = repo::get_asset(&pool, 9999).await.expect_err("없는 에셋");
    assert!(matches!(err, RepoError::AssetNotFound(9999)), "{err:?}");
}

/// 에셋 패싯도 자기 축을 빼고 센다. 게임 쪽과 같은 규칙이다.
#[sqlx::test]
async fn asset_facets_exclude_their_own_axis(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    // 배지 축을 보려면 검수가 있어야 한다. 출처 신고로 배지가 갈린다.
    for (title, origin) in [
        ("a", Origin::PublicDomain),
        ("b", Origin::PublicDomain),
        ("c", Origin::Unknown),
    ] {
        let id = repo::create_asset(&pool, who, &new_asset(title))
            .await
            .expect("등록");
        let analysis = laughgg_api::domain::analyze(&ordinary_facts(), origin);
        repo::record_analysis(&pool, id, &analysis, &serde_json::json!({}))
            .await
            .expect("분석");
    }

    let all = repo::asset_facets(&pool, &AssetQuery::default())
        .await
        .expect("전체 패싯");
    // 어떤 배지가 나오는지는 채점기가 정한다. 여기서는 축이 갈리는지만 본다.
    let top = all.badge.first().expect("배지 축이 비었다");
    let top_value = top.value.clone();
    let top_count = top.count;
    assert!(
        all.badge.len() >= 2,
        "출처가 다르면 배지도 갈려야 한다: {:?}",
        all.badge
    );

    let picked = repo::asset_facets(
        &pool,
        &AssetQuery {
            badge: Some(top_value),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("좁힌 패싯");

    assert_eq!(
        picked.badge.len(),
        all.badge.len(),
        "배지 축은 자기 조건을 안 받으므로 선택지가 그대로다"
    );
    let narrowed: i64 = picked.category.iter().map(|f| f.count).sum();
    assert_eq!(narrowed, top_count, "다른 축은 고른 배지로 좁혀져야 한다");
}

/// 제목과 창작자 이름 양쪽으로 검색된다.
#[sqlx::test]
async fn searching_matches_title_or_creator(pool: PgPool) {
    // 창작자 이름은 계정에서 온다. 이메일 앞부분이 표시 이름이 된다.
    let who = an_account(&pool, "nordveil@op.gg").await;
    repo::create_asset(&pool, who, &new_asset("Gothic Statue"))
        .await
        .expect("등록");

    /* 시드 카탈로그에도 "Gothic Statue" 가 있다. 제목으로 세면 둘이 잡히니
    창작자 이름처럼 이 테스트만 쓰는 말로 확인한다. */
    for needle in ["nordveil", "NORDVEIL"] {
        let page = repo::list_assets(
            &pool,
            &AssetQuery {
                q: Some(needle.into()),
                ..AssetQuery::default()
            },
        )
        .await
        .expect("검색");
        assert_eq!(page.total, 1, "{needle:?} 로 찾아야 한다");
    }

    let miss = repo::list_assets(
        &pool,
        &AssetQuery {
            q: Some("없는말".into()),
            ..AssetQuery::default()
        },
    )
    .await
    .expect("검색");
    assert_eq!(miss.total, 0);
}
