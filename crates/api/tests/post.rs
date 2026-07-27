//! 커뮤니티 글 통합 테스트.
//!
//! 사례는 지금까지 브라우저 localStorage 에만 있었다. 기기를 바꾸면 사라지고
//! 남에게 안 보였다 — 커뮤니티인데 혼자만 보는 상태였다.

use laughgg_api::{
    domain::Credentials,
    repo::{self, NewPost, PostQuery, RepoError},
};
use sqlx::PgPool;

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

fn a_post(kind: &str, title: &str) -> NewPost {
    NewPost {
        kind: kind.into(),
        title: title.into(),
        summary: Some("한 줄 요약".into()),
        body: "본문".into(),
        tag: None,
        asset_id: None,
        source: None,
        source_url: None,
        detail: None,
    }
}

#[sqlx::test]
async fn a_post_is_written_and_read_back(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let made = repo::create_post(&pool, who, &a_post("case", "Gothic Statue in a pixel game"))
        .await
        .expect("작성");

    assert_eq!(made.kind, "case");
    assert_eq!(made.slug, "gothic-statue-in-a-pixel-game");
    assert_eq!(made.author.as_deref(), Some("sh"), "글쓴이가 붙어야 한다");

    let read = repo::get_post(&pool, &made.slug).await.expect("조회");
    assert_eq!(read.id, made.id);
    assert_eq!(read.summary.as_deref(), Some("한 줄 요약"));
}

/// 제목이 같아도 주소가 겹치면 안 된다.
#[sqlx::test]
async fn duplicate_titles_get_distinct_slugs(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let first = repo::create_post(&pool, who, &a_post("case", "Same Title"))
        .await
        .expect("첫 글");
    let second = repo::create_post(&pool, who, &a_post("case", "Same Title"))
        .await
        .expect("둘째 글");

    assert_ne!(first.slug, second.slug, "주소가 겹치면 한쪽을 못 연다");
    assert_eq!(
        repo::get_post(&pool, &second.slug).await.expect("조회").id,
        second.id
    );
}

/// 한글만 있는 제목도 열리는 주소가 나와야 한다.
#[sqlx::test]
async fn a_korean_only_title_still_gets_a_usable_slug(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let made = repo::create_post(&pool, who, &a_post("news", "게임 아트 외주 시장"))
        .await
        .expect("작성");

    assert!(
        made.slug
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-'),
        "주소에 퍼센트 인코딩이 필요한 글자가 남았다: {}",
        made.slug
    );
    assert!(repo::get_post(&pool, &made.slug).await.is_ok());
}

/* 종류를 잘못 적으면 빈 목록이 아니라 오류다.

오타로 0건이 나오면 글이 없는 건지 이름을 틀린 건지 알 수가 없다. */
#[sqlx::test]
async fn an_unknown_kind_is_an_error_not_an_empty_list(pool: PgPool) {
    let err = repo::list_posts(
        &pool,
        &PostQuery {
            kind: Some("blog".into()),
            ..PostQuery::default()
        },
    )
    .await
    .expect_err("없는 종류");
    assert!(matches!(err, RepoError::Post(_)), "{err:?}");
}

#[sqlx::test]
async fn listing_filters_by_kind_and_search(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    for (kind, title) in [
        ("news", "Market report"),
        ("news", "Engine share"),
        ("case", "Pixel workflow"),
        ("vlog", "Studio tour"),
    ] {
        repo::create_post(&pool, who, &a_post(kind, title))
            .await
            .expect("작성");
    }

    let all = repo::list_posts(&pool, &PostQuery::default())
        .await
        .expect("전체");
    assert_eq!(all.total, 4, "종류를 안 주면 넷을 섞어서 준다");

    let news = repo::list_posts(
        &pool,
        &PostQuery {
            kind: Some("news".into()),
            ..PostQuery::default()
        },
    )
    .await
    .expect("뉴스만");
    assert_eq!(news.total, 2);

    let found = repo::list_posts(
        &pool,
        &PostQuery {
            q: Some("pixel".into()),
            ..PostQuery::default()
        },
    )
    .await
    .expect("검색");
    assert_eq!(found.total, 1);
}

/// 종류마다 다른 부분은 JSONB 로 들어간다.
#[sqlx::test]
async fn the_detail_payload_round_trips(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let mut input = a_post("case", "Pixel workflow");
    input.detail = Some(serde_json::json!({
        "situation": "2D 도트로 만든 던전에 3D 모델을 넣어야 했습니다.",
        "problem": "해상도와 음영이 달라 도트 타일 옆에서 혼자 튑니다.",
        "steps": ["형식을 2D 스프라이트로 바꾼다", "팔레트를 6색으로 고정한다"]
    }));

    let made = repo::create_post(&pool, who, &input).await.expect("작성");
    let read = repo::get_post(&pool, &made.slug).await.expect("조회");
    assert_eq!(read.detail["steps"][1], "팔레트를 6색으로 고정한다");
}

/* 남의 글은 못 지운다.

있는지 없는지를 알려 주면 그게 곧 남의 글 목록이 된다. 둘 다 같은 오류다. */
#[sqlx::test]
async fn only_the_author_can_delete(pool: PgPool) {
    let mine = an_account(&pool, "mine@op.gg").await;
    let other = an_account(&pool, "other@op.gg").await;
    let made = repo::create_post(&pool, mine, &a_post("case", "My Post"))
        .await
        .expect("작성");

    let err = repo::delete_post(&pool, other, &made.slug)
        .await
        .expect_err("남의 글");
    assert!(matches!(err, RepoError::PostNotFound(_)), "{err:?}");
    assert!(
        repo::get_post(&pool, &made.slug).await.is_ok(),
        "아직 살아 있어야 한다"
    );

    repo::delete_post(&pool, mine, &made.slug)
        .await
        .expect("내 글 삭제");
    assert!(repo::get_post(&pool, &made.slug).await.is_err());
}

#[sqlx::test]
async fn an_empty_title_is_refused(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let err = repo::create_post(&pool, who, &a_post("case", "   "))
        .await
        .expect_err("빈 제목");
    assert!(matches!(err, RepoError::Post(_)), "{err:?}");

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM posts")
        .fetch_one(&pool)
        .await
        .expect("개수");
    assert_eq!(count, 0, "거절된 글이 행을 남기면 안 된다");
}
