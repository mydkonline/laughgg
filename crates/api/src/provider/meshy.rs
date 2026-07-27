//! Meshy — text-to-3D.
//!
//! 1순위로 고른 이유는 결과물 성향이다. 우리 마켓 주력이 스타일라이즈 게임
//! 에셋이고, Meshy 는 거기에 맞는다. 오토리깅이 붙어 있어 캐릭터 에셋의
//! 후처리 부담도 준다.
//!
//! Rodin 이 품질은 제일 좋지만 월 $120 최소 약정이라, 생성량이 확정되기 전에
//! 묶이는 게 맞지 않는다. 자세한 비교는 `docs/ai-generation.md`.

use serde::Deserialize;

use super::{Generated, Generator, Progress, ProviderError, Spec};
use crate::domain::{ArtStyle, Quality};

const BASE: &str = "https://api.meshy.ai/openapi/v2";
const NAME: &str = "meshy";

#[derive(Clone)]
pub struct Meshy {
    api_key: String,
    http: reqwest::Client,
}

impl Meshy {
    /// 환경변수에서 읽는다. 없으면 생성을 끈다.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Some(Self {
            api_key: std::env::var("MESHY_API_KEY").ok()?,
            http: reqwest::Client::new(),
        })
    }

    /// 우리 말을 Meshy 말로. 매핑을 한 곳에 모아 두면 제공자가 바뀔 때
    /// 고칠 데가 하나다.
    const fn style(art_style: ArtStyle) -> &'static str {
        match art_style {
            ArtStyle::Realistic => "realistic",
            // Meshy 에는 lowpoly/pixel 이 따로 없다. sculpture 가 제일 가깝다.
            ArtStyle::Stylized | ArtStyle::Lowpoly | ArtStyle::Pixel => "sculpture",
        }
    }

    const fn polycount(quality: Quality) -> u32 {
        match quality {
            Quality::Draft => 10_000,
            Quality::Standard => 30_000,
            Quality::High => 100_000,
        }
    }
}

#[derive(Deserialize)]
struct StartResponse {
    result: String,
}

#[derive(Deserialize)]
struct TaskResponse {
    status: String,
    #[serde(default)]
    progress: u8,
    #[serde(default)]
    model_urls: Option<ModelUrls>,
    #[serde(default)]
    thumbnail_url: Option<String>,
    #[serde(default)]
    task_error: Option<TaskError>,
}

#[derive(Deserialize)]
struct ModelUrls {
    #[serde(default)]
    glb: Option<String>,
}

#[derive(Deserialize)]
struct TaskError {
    #[serde(default)]
    message: String,
}

/// 응답이 문제인지 우리가 문제인지 갈라 준다.
fn classify(err: &reqwest::Error) -> ProviderError {
    // 4xx 는 우리 요청이 틀린 것이다. 몇 번을 보내도 같다.
    // 그 외(연결 실패, 5xx, 타임아웃)는 다시 해 볼 값이 있다.
    let client_fault = err
        .status()
        .is_some_and(|s| s.is_client_error() && s != reqwest::StatusCode::TOO_MANY_REQUESTS);

    if client_fault {
        ProviderError::Rejected {
            provider: NAME,
            message: err.to_string(),
        }
    } else {
        ProviderError::Unavailable {
            provider: NAME,
            message: err.to_string(),
        }
    }
}

impl Generator for Meshy {
    fn name(&self) -> &'static str {
        NAME
    }

    async fn start(&self, spec: Spec<'_>) -> Result<String, ProviderError> {
        let body = serde_json::json!({
            "mode": "preview",
            "prompt": spec.prompt,
            "art_style": Self::style(spec.art_style),
            "target_polycount": Self::polycount(spec.quality),
        });

        let res: StartResponse = self
            .http
            .post(format!("{BASE}/text-to-3d"))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| classify(&e))?
            .error_for_status()
            .map_err(|e| classify(&e))?
            .json()
            .await
            .map_err(|e| classify(&e))?;

        Ok(res.result)
    }

    async fn poll(&self, provider_ref: &str) -> Result<Progress, ProviderError> {
        let task: TaskResponse = self
            .http
            .get(format!("{BASE}/text-to-3d/{provider_ref}"))
            .bearer_auth(&self.api_key)
            .send()
            .await
            .map_err(|e| classify(&e))?
            .error_for_status()
            .map_err(|e| classify(&e))?
            .json()
            .await
            .map_err(|e| classify(&e))?;

        match task.status.as_str() {
            "SUCCEEDED" => {
                let model_url = task.model_urls.and_then(|u| u.glb).ok_or_else(|| {
                    ProviderError::Unavailable {
                        provider: NAME,
                        message: "succeeded without a model url".to_owned(),
                    }
                })?;
                Ok(Progress::Done(Generated {
                    model_url,
                    thumbnail_url: task.thumbnail_url,
                }))
            }
            "FAILED" | "CANCELED" => Ok(Progress::Failed(
                task.task_error
                    .map_or_else(|| format!("meshy task {}", task.status), |e| e.message),
            )),
            // PENDING / IN_PROGRESS
            _ => Ok(Progress::Running(task.progress.min(100))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Meshy;
    use crate::domain::{ArtStyle, Quality};

    #[test]
    fn quality_maps_to_rising_polycounts() {
        let draft = Meshy::polycount(Quality::Draft);
        let standard = Meshy::polycount(Quality::Standard);
        let high = Meshy::polycount(Quality::High);
        assert!(draft < standard && standard < high);
        // 0 이면 제공자가 거절한다. 크레딧을 깎은 뒤라 되돌리는 일이 생긴다.
        assert!(draft > 0);
    }

    #[test]
    fn every_style_maps_to_something_meshy_knows() {
        // Meshy 가 아는 값은 둘뿐이다. 우리 넷이 전부 그 안에 떨어져야 한다.
        for s in [
            ArtStyle::Realistic,
            ArtStyle::Stylized,
            ArtStyle::Lowpoly,
            ArtStyle::Pixel,
        ] {
            let mapped = Meshy::style(s);
            assert!(
                matches!(mapped, "realistic" | "sculpture"),
                "{s:?} → {mapped}"
            );
        }
    }
}
