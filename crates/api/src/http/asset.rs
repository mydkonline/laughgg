//! 에셋 등록, 검수, 목록, 상세.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde_json::json;

use super::{ApiResult, AppState, auth::CurrentAccount};
use crate::repo::{self, AssetQuery, NewAsset};

/// 목록 한 쪽. 전체 건수를 같이 준다 — 없으면 쪽 번호를 못 그린다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let page = repo::list_assets(&st.pool, &q).await?;
    Ok(Json(json!(page)))
}

/// 네 축의 선택지와 개수. 목록과 같은 조건을 받는다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn facets(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let f = repo::asset_facets(&st.pool, &q).await?;
    Ok(Json(json!(f)))
}

/// 에셋 하나. 항목별 점수와 판매 수가 붙는다.
///
/// # Errors
/// 에셋이 없으면 오류를 반환한다.
pub async fn get(
    State(st): State<AppState>,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    let detail = repo::get_asset(&st.pool, id).await?;
    Ok(Json(json!(detail)))
}

/* 에셋 등록.

로그인이 필요하다. 창작자를 문자열로 받으면 남의 이름으로 올릴 수 있고,
그 이름이 곧 정산 대상이 된다. 올린 사람이 창작자다. */
///
/// # Errors
/// 로그인이 없거나 점수가 규칙을 어기면 오류를 반환한다.
pub async fn create(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Json(input): Json<NewAsset>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let asset_id = repo::create_asset(&st.pool, account.id, &input).await?;

    /* 배지는 아직 없다.

    파일을 뜯어야 채점이 되는데 파일은 스토리지에 있다. 등록만 끝내고
    분석은 따로 온다 — 그 전까지 이 에셋은 배지가 없고, 배지가 없으면
    팔리지도 않는다. 안 재고 배지를 주는 게 문제였다. */
    Ok((
        StatusCode::CREATED,
        Json(json!({ "asset_id": asset_id, "status": "pending_analysis" })),
    ))
}

/* 올린 파일을 분석한다.

파일을 다시 받는다. 스토리지에서 가져오면 좋지만 아직 안 붙어 있고,
무엇보다 **점수를 클라이언트가 보내지 않는다** 는 게 핵심이다 — 파일은
위조할 수 있어도 그 파일의 삼각형 수는 파일이 정한다.

상한을 건다. 분석에 파일을 통째로 메모리에 올려야 해서, 큰 파일은
스토리지가 붙은 뒤 워커가 처리한다. */
///
/// # Errors
/// 로그인이 없거나, 남의 에셋이거나, 파일을 못 읽으면 오류를 반환한다.
pub async fn analyze(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Path(id): Path<i64>,
    body: axum::body::Bytes,
) -> ApiResult<Json<serde_json::Value>> {
    // 내 에셋만 분석한다. 남의 것을 채점하면 배지를 남이 정하게 된다.
    let owns: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM assets a JOIN creators c ON c.id = a.creator_id
         WHERE a.id = $1 AND c.account_id = $2)",
    )
    .bind(id)
    .bind(account.id)
    .fetch_one(&st.pool)
    .await
    .map_err(|e| super::ApiError::internal(format!("ownership check failed: {e}")))?;
    if !owns {
        return Err(crate::repo::RepoError::Forbidden.into());
    }

    let (filename, origin) = sqlx::query_as::<_, (Option<String>, String)>(
        "SELECT file_key, origin FROM assets WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&st.pool)
    .await
    .map_err(|e| super::ApiError::internal(format!("loading asset: {e}")))?;

    let filename = filename.unwrap_or_else(|| "unknown".into());
    let origin =
        crate::domain::Origin::from_label(&origin).unwrap_or(crate::domain::Origin::Unknown);

    let analysis = crate::analyzer::analyze_file(&filename, &body, origin)
        .map_err(|e| super::ApiError::bad_request(e.to_string()))?;

    let facts = serde_json::json!({ "bytes": body.len() });
    let result = repo::record_analysis(&st.pool, id, &analysis, &facts).await?;

    Ok(Json(json!({
        "asset_id": result.asset_id,
        "total": result.total,
        "badge": result.badge,
        "production_ready": result.production_ready,
        "license_blocked": result.license_blocked,
        "scores": {
            "mesh_integrity": analysis.mesh_integrity,
            "texture_quality": analysis.texture_quality,
            "lod_setup": analysis.lod_setup,
            "runtime_cost": analysis.runtime_cost,
            "license_clean": analysis.license_clean,
            "integration": analysis.integration,
            "code_quality": analysis.code_quality,
        },
        "notes": analysis.notes,
    })))
}

/* 손으로 점수를 넣는 경로는 없다.

한때 POST /assets/{id}/review 가 있었다. 로그인도 안 받고 일곱 항목을
그대로 받아 배지를 새로 찍었다. 등록에서 점수를 뺀 뒤에도 이 문이 열려
있었으니, 아무나 남의 에셋에 100 점을 꽂아 챌린저를 만들 수 있었다.

채점하는 길은 analyze 하나다. */
