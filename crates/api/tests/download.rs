//! 업로드와 다운로드 통합 테스트.
//!
//! 파는 물건에 실제로 파일이 붙는가, 그리고 안 산 사람이 못 받는가.

use laughgg_api::{
    domain::{Credentials, Facts, Origin},
    repo::{self, AssetFile, FileError, NewAsset, RepoError},
};
use sqlx::PgPool;

fn a_file() -> AssetFile {
    AssetFile {
        file_key: "uploads/2026/gothic-statue.glb".into(),
        file_bytes: 4_200_000,
        file_sha256: "a".repeat(64),
    }
}

fn an_asset(title: &str, file: Option<AssetFile>) -> NewAsset {
    NewAsset {
        title: title.into(),
        category: "prop".into(),
        engine: "unity".into(),
        art_style: "realistic".into(),
        price_usd: 30.0,
        origin: "self_made".into(),
        file,
    }
}

/* 검수를 붙인다.

등록만으로는 못 판다. 파일을 뜯어야 채점이 되고, 채점 전에는 배지가 없다 —
배지가 없으면 팔리지도 않는다. 테스트도 그 순서를 따라야 한다. */
async fn review(pool: &PgPool, asset_id: i64, origin: Origin) {
    let facts = Facts {
        triangles: 8_000,
        materials: 1,
        meshes: 1,
        primitives: 1,
        texture_sides: vec![2048],
        ..Facts::default()
    };
    let analysis = laughgg_api::domain::analyze(&facts, origin);
    repo::record_analysis(pool, asset_id, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");
}

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

/* 키를 그대로 믿으면 안 된다.

클라이언트가 정하는 값이라 상위 경로나 남의 접두사를 적어 보낼 수 있다.
스토리지에서 경로로 해석되면 남의 파일을 가리키게 된다. */
#[test]
fn a_key_outside_the_uploads_prefix_is_rejected() {
    for bad in [
        "etc/passwd",
        "/uploads/x.glb",
        "uploads/../../secrets/x.glb",
        "uploads\\x.glb",
    ] {
        let f = AssetFile {
            file_key: bad.into(),
            ..a_file()
        };
        assert!(
            matches!(f.validate(), Err(FileError::BadKey)),
            "{bad:?} 는 거절해야 한다"
        );
    }
    assert!(a_file().validate().is_ok());
}

#[test]
fn a_malformed_digest_is_rejected() {
    for bad in ["", "abc", &"z".repeat(64), &"a".repeat(63)] {
        let f = AssetFile {
            file_sha256: bad.into(),
            ..a_file()
        };
        assert!(matches!(f.validate(), Err(FileError::BadDigest)), "{bad:?}");
    }
}

#[test]
fn an_absurd_file_size_is_rejected() {
    for bytes in [0, -1, 3 * 1024 * 1024 * 1024] {
        let f = AssetFile {
            file_bytes: bytes,
            ..a_file()
        };
        assert!(
            matches!(f.validate(), Err(FileError::TooLarge { .. })),
            "{bytes}"
        );
    }
}

#[sqlx::test]
async fn a_bad_file_key_fails_the_upload(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let bad = AssetFile {
        file_key: "../../etc/passwd".into(),
        ..a_file()
    };
    let err = repo::create_asset(&pool, who, &an_asset("Sneaky", Some(bad)))
        .await
        .expect_err("거절해야 한다");
    assert!(matches!(err, RepoError::File(_)), "{err:?}");

    /* 이 계정 앞으로 남은 게 없어야 한다.

    한때 `COUNT(*) = 0` 으로 봤는데, 마이그레이션이 카탈로그를 시드하면서
    27 이 나왔다. 전체를 세면 시드가 늘 때마다 이 테스트가 깨진다 — 봐야
    할 건 거절된 등록이 행을 남겼는지지 테이블이 비었는지가 아니다. */
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM assets a JOIN creators c ON c.id = a.creator_id
         WHERE c.account_id = $1",
    )
    .bind(who)
    .fetch_one(&pool)
    .await
    .expect("개수");
    assert_eq!(count, 0, "거절된 업로드가 행을 남기면 안 된다");
}

/* 파일이 없는 에셋은 다운로드 허가를 못 낸다.

허가만 내고 받을 게 없으면 사용자는 링크를 눌러 보고 나서야 안다. */
#[sqlx::test]
async fn an_asset_without_a_file_cannot_be_downloaded(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let asset = repo::create_asset(&pool, who, &an_asset("Draft", None))
        .await
        .expect("등록");

    // 만든 사람인데도 받을 게 없다.
    let err = repo::grant_download(&pool, who, asset)
        .await
        .expect_err("파일이 없다");
    assert!(matches!(err, RepoError::NoFile(_)), "{err:?}");
}

#[sqlx::test]
async fn a_stranger_cannot_get_a_download_grant(pool: PgPool) {
    let maker = an_account(&pool, "maker@op.gg").await;
    let stranger = an_account(&pool, "stranger@op.gg").await;
    let asset = repo::create_asset(&pool, maker, &an_asset("Gothic Statue", Some(a_file())))
        .await
        .expect("등록");

    let err = repo::grant_download(&pool, stranger, asset)
        .await
        .expect_err("안 산 사람은 못 받는다");
    assert!(matches!(err, RepoError::Forbidden), "{err:?}");

    // 만든 사람은 받을 수 있다.
    assert!(repo::grant_download(&pool, maker, asset).await.is_ok());
}

#[sqlx::test]
async fn buying_opens_the_download(pool: PgPool) {
    let maker = an_account(&pool, "maker@op.gg").await;
    let buyer = an_account(&pool, "buyer@op.gg").await;
    let asset = repo::create_asset(&pool, maker, &an_asset("Gothic Statue", Some(a_file())))
        .await
        .expect("등록");

    assert!(
        repo::grant_download(&pool, buyer, asset).await.is_err(),
        "사기 전에는 못 받는다"
    );

    review(&pool, asset, Origin::PublicDomain).await;
    let order = repo::open_order(&pool, buyer, &[asset])
        .await
        .expect("주문");
    repo::attach_provider_ref(&pool, order.id, "cs_dl")
        .await
        .expect("세션 id");
    repo::mark_paid(&pool, "cs_dl").await.expect("결제");

    let grant = repo::grant_download(&pool, buyer, asset)
        .await
        .expect("결제했으면 받을 수 있다");
    let file = repo::redeem_download(&pool, &grant.token)
        .await
        .expect("허가 사용");
    assert_eq!(file.file_key, a_file().file_key);
    assert_eq!(file.file_bytes, Some(a_file().file_bytes));
}

/// 허가 토큰 원문은 DB 에 없어야 한다. 세션과 같은 이유다.
#[sqlx::test]
async fn only_the_hash_of_the_grant_is_stored(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    let asset = repo::create_asset(&pool, who, &an_asset("Gothic Statue", Some(a_file())))
        .await
        .expect("등록");
    let grant = repo::grant_download(&pool, who, asset).await.expect("허가");

    let hit: Option<String> =
        sqlx::query_scalar("SELECT token_hash FROM download_grants WHERE token_hash = $1")
            .bind(&grant.token)
            .fetch_optional(&pool)
            .await
            .expect("조회");
    assert!(hit.is_none(), "토큰 원문이 그대로 저장돼 있다");
}

#[sqlx::test]
async fn a_forged_or_expired_token_is_refused(pool: PgPool) {
    let err = repo::redeem_download(&pool, "deadbeef")
        .await
        .expect_err("아무 값이나 통하면 안 된다");
    assert!(matches!(err, RepoError::GrantNotFound), "{err:?}");

    // 만료된 허가도 없는 것으로 본다.
    let who = an_account(&pool, "sh@op.gg").await;
    let asset = repo::create_asset(&pool, who, &an_asset("Gothic Statue", Some(a_file())))
        .await
        .expect("등록");
    let grant = repo::grant_download(&pool, who, asset).await.expect("허가");

    sqlx::query("UPDATE download_grants SET expires_at = now() - interval '1 minute'")
        .execute(&pool)
        .await
        .expect("만료 처리");

    let err = repo::redeem_download(&pool, &grant.token)
        .await
        .expect_err("만료된 허가");
    assert!(matches!(err, RepoError::GrantNotFound), "{err:?}");

    let purged = repo::purge_expired_grants(&pool).await.expect("정리");
    assert_eq!(purged, 1);
}

/* 환불이나 계정 정리로 소유가 사라지면 발급해 둔 허가도 안 통해야 한다. */
#[sqlx::test]
async fn a_grant_stops_working_when_ownership_goes_away(pool: PgPool) {
    let maker = an_account(&pool, "maker@op.gg").await;
    let buyer = an_account(&pool, "buyer@op.gg").await;
    let asset = repo::create_asset(&pool, maker, &an_asset("Gothic Statue", Some(a_file())))
        .await
        .expect("등록");

    review(&pool, asset, Origin::PublicDomain).await;
    let order = repo::open_order(&pool, buyer, &[asset])
        .await
        .expect("주문");
    repo::attach_provider_ref(&pool, order.id, "cs_refund")
        .await
        .expect("세션 id");
    repo::mark_paid(&pool, "cs_refund").await.expect("결제");

    let grant = repo::grant_download(&pool, buyer, asset)
        .await
        .expect("허가");

    // 환불. 허가는 아직 살아 있지만 소유가 사라졌다.
    sqlx::query("UPDATE orders SET status = 'refunded' WHERE id = $1")
        .bind(order.id)
        .execute(&pool)
        .await
        .expect("환불 처리");

    let err = repo::redeem_download(&pool, &grant.token)
        .await
        .expect_err("환불하면 못 받아야 한다");
    assert!(matches!(err, RepoError::Forbidden), "{err:?}");
}
