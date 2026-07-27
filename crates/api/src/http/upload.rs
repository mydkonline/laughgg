//! 업로드 자리 발급.
//!
//! 파일은 이 서버를 안 지나간다. 어디에 올릴지와 어떤 키를 쓸지만 정해 주고,
//! 실제 전송은 클라이언트가 스토리지로 직접 한다.
//!
//! 키를 서버가 정하는 게 핵심이다. 클라이언트가 정하면 `uploads/` 밖이나
//! 남의 접두사를 적어 보낼 수 있다. 등록할 때 한 번 더 검사하지만, 애초에
//! 안 만들어 주는 게 낫다.

use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ApiError, ApiResult, AppState, auth::CurrentAccount};
use crate::repo;

/// 스토리지 설정. 없으면 업로드를 끈다.
#[derive(Clone)]
pub struct StorageConfig {
    /// 올릴 곳의 기본 주소. 여기에 키를 붙여 PUT 한다.
    pub base_url: String,
    /// 받을 때 쓰는 공개 주소. 보통 CDN 이라 올리는 곳과 다르다.
    pub public_url: String,
}

impl StorageConfig {
    /// 환경변수에서 읽는다. 하나라도 없으면 업로드를 끈다.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let base_url = std::env::var("STORAGE_UPLOAD_URL").ok()?;
        let public_url = std::env::var("STORAGE_PUBLIC_URL").unwrap_or_else(|_| base_url.clone());
        Some(Self {
            base_url: base_url.trim_end_matches('/').to_owned(),
            public_url: public_url.trim_end_matches('/').to_owned(),
        })
    }
}

#[derive(Deserialize)]
pub struct UploadRequest {
    /// 사람이 고른 파일 이름. 확장자만 쓴다.
    pub filename: String,
    pub bytes: i64,
    /// 브라우저가 계산한 SHA-256. 같은 파일을 두 번 올리지 않게 한다.
    pub sha256: String,
}

#[derive(Serialize)]
pub struct UploadTarget {
    /// 등록할 때 그대로 돌려보낼 키.
    pub file_key: String,
    /// 여기로 PUT 한다.
    pub upload_url: String,
    pub public_url: String,
}

/* 확장자만 남긴다.

파일 이름을 그대로 키에 넣으면 경로 구분자나 한글이 섞인다. 이름은 등록
정보에 따로 들어가므로 키는 내용 해시로 충분하다 — 같은 파일을 여러 번
올려도 자리가 하나다. */
fn extension(filename: &str) -> Option<&str> {
    let ext = filename.rsplit_once('.')?.1;
    let ok = ext.len() <= 8 && !ext.is_empty() && ext.chars().all(|c| c.is_ascii_alphanumeric());
    ok.then_some(ext)
}

/// 올릴 자리를 발급한다.
///
/// # Errors
/// 로그인이 없거나, 스토리지가 꺼져 있거나, 이름·해시가 이상하면 오류를 반환한다.
pub async fn intent(
    State(st): State<AppState>,
    CurrentAccount(_account): CurrentAccount,
    Json(req): Json<UploadRequest>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let cfg = st
        .storage
        .as_ref()
        .ok_or_else(|| ApiError::unavailable("file storage is not configured on this server"))?;

    let ext = extension(&req.filename)
        .ok_or_else(|| ApiError::bad_request("filename needs a simple extension"))?;

    let sha = req.sha256.to_lowercase();
    if sha.len() != 64 || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::bad_request("sha256 must be 64 hex characters"));
    }

    // 상한은 등록 때와 같은 값을 쓴다. 여기서만 통과시키면 올리고 나서 거절된다.
    let file = repo::AssetFile {
        file_key: format!("uploads/{}/{}.{ext}", &sha[..2], sha),
        file_bytes: req.bytes,
        file_sha256: sha,
    };
    file.validate()
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(json!(UploadTarget {
            upload_url: format!("{}/{}", cfg.base_url, file.file_key),
            public_url: format!("{}/{}", cfg.public_url, file.file_key),
            file_key: file.file_key,
        })),
    ))
}

#[cfg(test)]
mod tests {
    use super::extension;

    #[test]
    fn ordinary_extensions_pass() {
        for (name, want) in [
            ("statue.glb", "glb"),
            ("sprite.PNG", "PNG"),
            ("pack.zip", "zip"),
            ("my model v2.gltf", "gltf"),
        ] {
            assert_eq!(extension(name), Some(want), "{name}");
        }
    }

    #[test]
    fn anything_odd_is_refused() {
        // 확장자가 없거나, 너무 길거나, 경로가 섞였거나.
        for bad in [
            "statue",
            "statue.",
            ".glb.",
            "x.verylongextension",
            "a.gl/b",
            "a.글비",
        ] {
            assert_eq!(extension(bad), None, "{bad:?}");
        }
    }
}
