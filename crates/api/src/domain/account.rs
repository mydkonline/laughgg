//! 계정 입력 규칙.
//!
//! 이메일 형태와 비밀번호 최소 조건은 저장소도 HTTP 도 아닌 판정이다.
//! 여기 두면 어느 경로로 들어오든 같은 규칙을 받는다.

use serde::Deserialize;

/// 가입·로그인 입력이 규칙을 어긴 이유.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CredentialError {
    #[error("email must contain a name, an @, and a domain")]
    BadEmail,
    #[error("password must be at least {min} characters")]
    ShortPassword { min: usize },
    #[error("password must be at most {max} characters")]
    LongPassword { max: usize },
    #[error("display name must not be empty")]
    EmptyName,
}

/// 가입 입력.
#[derive(Debug, Clone, Deserialize)]
pub struct Credentials {
    pub email: String,
    pub password: String,
    /// 없으면 이메일의 앞부분을 쓴다.
    #[serde(default)]
    pub display_name: Option<String>,
}

/* 비밀번호 길이 하한은 8 이다. OWASP 권장이 8 이고, 그보다 짧으면 Argon2 를
써도 사전 공격에 버티지 못한다.

상한을 두는 이유는 다르다. Argon2 는 입력이 길수록 오래 걸려서, 상한이
없으면 누구나 긴 문자열 하나로 서버 CPU 를 태울 수 있다. */
const MIN_PASSWORD: usize = 8;
const MAX_PASSWORD: usize = 256;

impl Credentials {
    /// 이메일과 비밀번호가 최소 조건을 만족하는지 본다.
    ///
    /// 이메일은 형태만 본다. 실제로 받는 주소인지는 메일을 보내 봐야 알 수
    /// 있고, 정규식으로 RFC 를 흉내 내면 멀쩡한 주소를 거절하게 된다.
    ///
    /// # Errors
    /// 규칙을 어기면 [`CredentialError`] 를 반환한다.
    pub fn validate(&self) -> Result<(), CredentialError> {
        if !is_email_shaped(&self.email) {
            return Err(CredentialError::BadEmail);
        }
        // 바이트가 아니라 문자로 센다. 한글 비밀번호가 세 배로 계산되면
        // 여덟 자를 넣었는데 통과하는 일이 생긴다.
        let len = self.password.chars().count();
        if len < MIN_PASSWORD {
            return Err(CredentialError::ShortPassword { min: MIN_PASSWORD });
        }
        if len > MAX_PASSWORD {
            return Err(CredentialError::LongPassword { max: MAX_PASSWORD });
        }
        if self.name().is_empty() {
            return Err(CredentialError::EmptyName);
        }
        Ok(())
    }

    /// 화면에 뜰 이름. 안 주면 이메일 앞부분을 쓴다.
    #[must_use]
    pub fn name(&self) -> &str {
        match self.display_name.as_deref().map(str::trim) {
            Some(n) if !n.is_empty() => n,
            _ => self.email.split('@').next().unwrap_or("").trim(),
        }
    }
}

/// 이름, @, 점 있는 도메인. 그 이상은 안 본다.
#[must_use]
pub fn is_email_shaped(email: &str) -> bool {
    let email = email.trim();
    if email.len() > 254 || email.contains(char::is_whitespace) {
        return false;
    }
    let Some((name, domain)) = email.split_once('@') else {
        return false;
    };
    !name.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !email.contains("@@")
}

#[cfg(test)]
mod tests {
    use super::{CredentialError, Credentials, is_email_shaped};

    fn creds(email: &str, password: &str) -> Credentials {
        Credentials {
            email: email.into(),
            password: password.into(),
            display_name: None,
        }
    }

    #[test]
    fn email_shape_accepts_ordinary_addresses() {
        for ok in ["sh@op.gg", "a.b+tag@sub.example.co.kr", "x_y@e.io"] {
            assert!(is_email_shaped(ok), "{ok} 는 통과해야 한다");
        }
    }

    #[test]
    fn email_shape_rejects_obvious_breakage() {
        for bad in [
            "",
            "sh",
            "sh@",
            "@op.gg",
            "sh@opgg",
            "sh @op.gg",
            "a@@b.com",
            "sh@.gg",
            "sh@gg.",
        ] {
            assert!(!is_email_shaped(bad), "{bad:?} 는 거절해야 한다");
        }
    }

    #[test]
    fn password_length_is_counted_in_characters_not_bytes() {
        // 한글 일곱 자는 UTF-8 로 21바이트다. 바이트로 세면 통과해 버린다.
        let short = creds("sh@op.gg", "일곱글자임다");
        assert_eq!(
            short.validate(),
            Err(CredentialError::ShortPassword { min: 8 })
        );
        assert!(creds("sh@op.gg", "여덟글자입니다요").validate().is_ok());
    }

    #[test]
    fn absurdly_long_passwords_are_rejected() {
        // 상한이 없으면 긴 문자열 하나로 Argon2 를 태울 수 있다.
        let long = creds("sh@op.gg", &"a".repeat(1000));
        assert_eq!(
            long.validate(),
            Err(CredentialError::LongPassword { max: 256 })
        );
    }

    #[test]
    fn display_name_falls_back_to_the_email_local_part() {
        assert_eq!(creds("sh@op.gg", "goodpassword").name(), "sh");

        let named = Credentials {
            display_name: Some("  SH  ".into()),
            ..creds("sh@op.gg", "goodpassword")
        };
        assert_eq!(named.name(), "SH", "앞뒤 공백은 떼야 한다");

        let blank = Credentials {
            display_name: Some("   ".into()),
            ..creds("sh@op.gg", "goodpassword")
        };
        assert_eq!(blank.name(), "sh", "공백뿐이면 없는 것으로 본다");
    }

    #[test]
    fn bad_email_is_rejected_before_password_length() {
        assert_eq!(
            creds("nope", "short").validate(),
            Err(CredentialError::BadEmail)
        );
    }
}
