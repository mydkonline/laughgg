//! 파일을 뜯어 채점에 쓸 값을 잰다.
//!
//! **올리는 사람이 점수를 정하지 않는다.** 여기가 그 약속을 지키는 자리다.
//!
//! 지금은 GLB 만 읽는다. FBX 는 바이너리 명세가 크고 버전마다 달라서 파서를
//! 새로 쓰는 일이 되고, PNG·ZIP 은 애초에 잴 게 다르다. 못 읽는 형식은
//! 읽은 척하지 않고 그렇다고 말한다 — 읽은 척하면 엉뚱한 배지가 나간다.

pub mod glb;

use crate::domain::{Analysis, Facts, Origin, analyze};

/// 파일을 못 읽은 이유.
#[derive(Debug, thiserror::Error)]
pub enum AnalyzeError {
    /// 우리가 아직 안 읽는 형식이다.
    #[error("cannot analyze {0:?} files yet")]
    Unsupported(String),

    #[error(transparent)]
    Glb(#[from] glb::GlbError),
}

/// 확장자로 형식을 고르고 채점한다.
///
/// # Errors
/// 못 읽는 형식이거나 파일이 깨졌으면 [`AnalyzeError`] 를 반환한다.
pub fn analyze_file(
    filename: &str,
    bytes: &[u8],
    origin: Origin,
) -> Result<Analysis, AnalyzeError> {
    let ext = filename
        .rsplit_once('.')
        .map_or("", |(_, e)| e)
        .to_ascii_lowercase();

    let facts: Facts = match ext.as_str() {
        "glb" => glb::read(bytes)?,
        other => return Err(AnalyzeError::Unsupported(other.to_owned())),
    };

    Ok(analyze(&facts, origin))
}

#[cfg(test)]
mod tests {
    use super::{AnalyzeError, analyze_file};
    use crate::domain::Origin;

    #[test]
    fn an_unsupported_format_says_so_instead_of_guessing() {
        // 읽은 척하면 엉뚱한 배지가 나간다.
        for name in ["model.fbx", "sprite.png", "pack.zip", "noext"] {
            assert!(
                matches!(
                    analyze_file(name, b"whatever", Origin::SelfMade),
                    Err(AnalyzeError::Unsupported(_))
                ),
                "{name}"
            );
        }
    }

    #[test]
    fn a_broken_glb_is_an_error_not_a_zero_score() {
        assert!(matches!(
            analyze_file("model.glb", b"not a glb", Origin::SelfMade),
            Err(AnalyzeError::Glb(_))
        ));
    }
}
