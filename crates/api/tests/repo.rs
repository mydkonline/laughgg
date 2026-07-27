//! 저장소 통합 테스트.
//!
//! 도메인 테스트는 순수 함수만 본다. 정작 결함이 나온 곳은 SQL 이었다 —
//! 조인이 행을 복제했고, 없는 자원이 500 으로 나갔고, 재검수가 에셋을 늘렸다.
//! 셋 다 손으로 curl 해서 찾았다. 여기서 다시 못 생기게 잡아 둔다.
//!
//! `#[sqlx::test]` 가 테스트마다 빈 DB 를 만들고 마이그레이션을 돌린 뒤
//! 끝나면 지운다. 테스트끼리 상태를 공유하지 않으므로 순서에 기대지 않는다.

use laughgg_api::{
    domain::{Badge, ReviewScores},
    repo::{self, AssetQuery, GameQuery, NewAsset, RepoError},
};
use sqlx::PgPool;

/// 모든 항목이 같은 점수인 검수. 총점이 그 값과 같아진다.
fn scores(v: u8) -> ReviewScores {
    ReviewScores {
        mesh_integrity: v,
        texture_quality: v,
        lod_setup: v,
        runtime_cost: v,
        license_clean: v,
        code_quality: v,
        integration: v,
    }
}

fn new_asset(handle: &str, title: &str, scores: ReviewScores) -> NewAsset {
    NewAsset {
        creator_handle: handle.into(),
        title: title.into(),
        category: "prop".into(),
        engine: "unity".into(),
        art_style: "realistic".into(),
        price_usd: 30.0,
        scores,
    }
}

#[sqlx::test]
async fn create_asset_scores_and_badges_in_one_go(pool: PgPool) {
    let r = repo::create_asset(&pool, &new_asset("sh", "Gothic Statue", scores(90)))
        .await
        .expect("등록이 실패하면 안 된다");

    assert_eq!(r.total, 90);
    assert_eq!(r.badge, Badge::Challenger);
    assert!(r.production_ready);
    assert!(!r.license_blocked);
    // 수수료 8% 단일. 정산 미리보기가 도메인 규칙을 그대로 따라야 한다.
    assert!((r.settlement_preview.creator_usd - 27.6).abs() < 1e-9);
}

/* 재검수가 에셋을 늘리면 안 된다.

한때 POST /review 가 등록 핸들러를 가리켰다. 재검수를 부를 때마다 같은
에셋이 새로 생겼고, 마켓에 중복 상품이 쌓였다. */
#[sqlx::test]
async fn reviewing_again_adds_a_review_not_an_asset(pool: PgPool) {
    let created = repo::create_asset(&pool, &new_asset("sh", "Gothic Statue", scores(90)))
        .await
        .expect("등록");

    let again = repo::review_asset(&pool, created.asset_id, scores(40))
        .await
        .expect("재검수");

    assert_eq!(again.asset_id, created.asset_id, "같은 에셋이어야 한다");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.assets, 1, "재검수로 에셋이 늘면 안 된다");
    assert_eq!(m.reviewed, 2, "검수는 두 건이어야 한다");
}

/* 목록은 에셋당 한 줄이다.

검수가 여러 건 붙으면 LEFT JOIN 이 행을 복제한다. 재검수를 고치고 나서야
드러난 결함이라, 검수가 하나뿐일 때만 테스트하면 다시 놓친다. */
#[sqlx::test]
async fn list_shows_one_row_per_asset_with_the_latest_review(pool: PgPool) {
    let created = repo::create_asset(&pool, &new_asset("sh", "Gothic Statue", scores(90)))
        .await
        .expect("등록");
    repo::review_asset(&pool, created.asset_id, scores(40))
        .await
        .expect("재검수");

    let rows = repo::list_assets(&pool, &AssetQuery::default())
        .await
        .expect("목록");

    assert_eq!(rows.len(), 1, "검수 두 건이어도 한 줄이어야 한다");
    assert_eq!(rows[0].total, Some(40), "최신 검수가 붙어야 한다");
    assert_eq!(rows[0].badge.as_deref(), Some("silver"));
}

#[sqlx::test]
async fn reviewing_a_missing_asset_is_not_found(pool: PgPool) {
    let err = repo::review_asset(&pool, 9999, scores(80))
        .await
        .expect_err("없는 에셋은 실패해야 한다");

    assert!(
        matches!(err, RepoError::AssetNotFound(9999)),
        "종류가 달라지면 HTTP 상태 코드가 틀려진다: {err:?}"
    );
}

#[sqlx::test]
async fn out_of_range_scores_are_rejected_before_touching_the_database(pool: PgPool) {
    let bad = ReviewScores {
        runtime_cost: 200,
        ..scores(80)
    };
    let err = repo::create_asset(&pool, &new_asset("sh", "Bad", bad))
        .await
        .expect_err("범위 밖 점수는 실패해야 한다");

    assert!(matches!(err, RepoError::Score(_)), "{err:?}");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.assets, 0, "거절된 요청이 행을 남기면 안 된다");
}

/* 같은 창작자가 두 번 올려도 계정은 하나다. */
#[sqlx::test]
async fn the_same_creator_is_reused(pool: PgPool) {
    repo::create_asset(&pool, &new_asset("sh", "First", scores(80)))
        .await
        .expect("첫 등록");
    repo::create_asset(&pool, &new_asset("sh", "Second", scores(80)))
        .await
        .expect("두 번째 등록");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.assets, 2);
    assert_eq!(m.creators, 1, "핸들이 같으면 창작자는 하나다");
}

/* 탈락률은 같은 스냅숏에서 나와야 한다. 나눠 세면 100% 를 넘을 수 있다. */
#[sqlx::test]
async fn rejection_rate_is_computed_from_the_same_snapshot(pool: PgPool) {
    // 라이선스가 60 미만이면 다른 점수와 무관하게 탈락한다.
    let blocked = ReviewScores {
        license_clean: 10,
        ..scores(100)
    };
    repo::create_asset(&pool, &new_asset("a", "Blocked", blocked))
        .await
        .expect("탈락 에셋");
    repo::create_asset(&pool, &new_asset("b", "Passed", scores(90)))
        .await
        .expect("통과 에셋");

    let m = repo::metrics(&pool).await.expect("집계");
    assert_eq!(m.reviewed, 2);
    assert_eq!(m.rejected, 1);
    assert!((m.rejection_rate - 50.0).abs() < f64::EPSILON);
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
    let blocked = ReviewScores {
        license_clean: 10,
        ..scores(100)
    };
    let created = repo::create_asset(&pool, &new_asset("sh", "Blocked", blocked))
        .await
        .expect("등록");
    assert_eq!(created.badge, Badge::Silver);

    let err = repo::record_sale(&pool, created.asset_id, &repo::NewSale::default())
        .await
        .expect_err("실버는 팔리면 안 된다");
    assert!(matches!(err, RepoError::AssetNotSellable { .. }), "{err:?}");
}

#[sqlx::test]
async fn selling_records_the_fee_and_shows_up_in_metrics(pool: PgPool) {
    let created = repo::create_asset(&pool, &new_asset("sh", "Gothic Statue", scores(90)))
        .await
        .expect("등록");

    let sale = repo::record_sale(&pool, created.asset_id, &repo::NewSale::default())
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
    let created = repo::create_asset(&pool, &new_asset("sh", "Gothic Statue", scores(90)))
        .await
        .expect("등록");

    let err = repo::record_sale(
        &pool,
        created.asset_id,
        &repo::NewSale {
            studio: Some("없는 스튜디오".into()),
        },
    )
    .await
    .expect_err("없는 스튜디오는 실패해야 한다");
    assert!(matches!(err, RepoError::StudioNotFound(_)), "{err:?}");
}
