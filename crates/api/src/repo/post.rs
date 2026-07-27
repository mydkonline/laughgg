//! 커뮤니티 글 — 뉴스, 사례, 브이로그, 기사.

use anyhow::Context as _;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use super::{RepoError, RepoResult};

/// 글 종류. 넷은 모양이 거의 같고 화면만 다르다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PostKind {
    News,
    Case,
    Vlog,
    Article,
}

impl PostKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::News => "news",
            Self::Case => "case",
            Self::Vlog => "vlog",
            Self::Article => "article",
        }
    }

    /// 화면이 넘겨주는 문자열에서 되돌린다.
    #[must_use]
    pub fn from_label(s: &str) -> Option<Self> {
        match s {
            "news" => Some(Self::News),
            "case" => Some(Self::Case),
            "vlog" => Some(Self::Vlog),
            "article" => Some(Self::Article),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Post {
    pub id: i64,
    pub kind: String,
    pub slug: String,
    pub title: String,
    pub summary: Option<String>,
    pub body: String,
    pub tag: Option<String>,
    /// 쓴 사람. 운영자가 넣은 뉴스는 비어 있다.
    pub author: Option<String>,
    pub asset_id: Option<i64>,
    pub source: Option<String>,
    pub source_url: Option<String>,
    /// 종류마다 다른 부분. 사례는 상황·문제·해결, 뉴스는 인용 수치.
    pub detail: serde_json::Value,
    pub published_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Default, Deserialize)]
pub struct PostQuery {
    /// 없으면 전부. 커뮤니티 첫 화면이 섞어서 보여 준다.
    pub kind: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PostPage {
    pub total: i64,
    pub posts: Vec<Post>,
}

/// 새 글.
#[derive(Debug, Deserialize)]
pub struct NewPost {
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub asset_id: Option<i64>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub detail: Option<serde_json::Value>,
}

/// 글이 규칙을 어긴 이유.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PostError {
    #[error("unknown post kind: {0:?}")]
    BadKind(String),
    #[error("title must not be empty")]
    EmptyTitle,
    #[error("title is too long (max {max})")]
    LongTitle { max: usize },
}

const MAX_TITLE: usize = 200;

impl NewPost {
    /// # Errors
    /// 종류가 없는 값이거나 제목이 비었거나 너무 길면 오류를 반환한다.
    pub fn validate(&self) -> Result<PostKind, PostError> {
        let kind = PostKind::from_label(&self.kind)
            .ok_or_else(|| PostError::BadKind(self.kind.clone()))?;
        let title = self.title.trim();
        if title.is_empty() {
            return Err(PostError::EmptyTitle);
        }
        // 바이트가 아니라 문자로 센다. 한글 제목이 세 배로 계산되면 멀쩡한
        // 제목이 거절된다.
        if title.chars().count() > MAX_TITLE {
            return Err(PostError::LongTitle { max: MAX_TITLE });
        }
        Ok(kind)
    }
}

const SELECT: &str = r"
    SELECT p.id, p.kind, p.slug, p.title, p.summary, p.body, p.tag,
           a.display_name, p.asset_id, p.source, p.source_url, p.detail, p.published_at
    FROM posts p
    LEFT JOIN accounts a ON a.id = p.author_id
";

/* 조건을 한 곳에서만 쓴다. 목록과 총계가 갈리면 쪽 번호가 안 맞는다.

$1 종류  $2 검색어 */
const WHERE: &str = r"
    WHERE ($1::text IS NULL OR p.kind = $1)
      AND ($2::text IS NULL OR p.title ILIKE '%' || $2 || '%' OR p.body ILIKE '%' || $2 || '%')
";

/// DB 에서 오는 글 행.
type PostRow = (
    i64,
    String,
    String,
    String,
    Option<String>,
    String,
    Option<String>,
    Option<String>,
    Option<i64>,
    Option<String>,
    Option<String>,
    serde_json::Value,
    chrono::DateTime<chrono::Utc>,
);

fn to_post(r: PostRow) -> Post {
    Post {
        id: r.0,
        kind: r.1,
        slug: r.2,
        title: r.3,
        summary: r.4,
        body: r.5,
        tag: r.6,
        author: r.7,
        asset_id: r.8,
        source: r.9,
        source_url: r.10,
        detail: r.11,
        published_at: r.12,
    }
}

/// 글 목록 한 쪽.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list_posts(pool: &PgPool, q: &PostQuery) -> RepoResult<PostPage> {
    // 종류를 잘못 적으면 빈 목록이 아니라 오류를 낸다. 오타로 0건이 나오면
    // 글이 없는 건지 이름을 틀린 건지 알 수가 없다.
    if let Some(k) = q.kind.as_deref()
        && PostKind::from_label(k).is_none()
    {
        return Err(PostError::BadKind(k.to_owned()).into());
    }

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let offset = q.offset.unwrap_or(0).max(0);

    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM posts p {WHERE}"))
        .bind(q.kind.as_deref())
        .bind(q.q.as_deref())
        .fetch_one(pool)
        .await
        .context("counting posts")?;

    let rows = sqlx::query_as::<_, PostRow>(&format!(
        "{SELECT} {WHERE} ORDER BY p.published_at DESC, p.id DESC LIMIT $3 OFFSET $4"
    ))
    .bind(q.kind.as_deref())
    .bind(q.q.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .context("listing posts")?;

    Ok(PostPage {
        total,
        posts: rows.into_iter().map(to_post).collect(),
    })
}

/// 글 하나. 주소에 쓰는 건 id 가 아니라 slug 다.
///
/// # Errors
/// 글이 없으면 오류를 반환한다.
pub async fn get_post(pool: &PgPool, slug: &str) -> RepoResult<Post> {
    let row: Option<PostRow> = sqlx::query_as(&format!("{SELECT} WHERE p.slug = $1"))
        .bind(slug)
        .fetch_optional(pool)
        .await
        .context("loading post")?;

    row.map(to_post)
        .ok_or_else(|| RepoError::PostNotFound(slug.to_owned()))
}

/* 글을 쓴다.

slug 는 제목에서 뽑되 겹치면 뒤에 숫자를 붙인다. 사람이 고르게 하려면
화면이 하나 더 필요하고, 그것 때문에 글쓰기가 막히면 안 된다.

한글 제목은 그대로 두면 slug 가 통째로 퍼센트 인코딩된다. 영문·숫자만
남기고 없으면 종류와 시각으로 대신한다. */
///
/// # Errors
/// 입력이 규칙을 어겼거나 쓰기에 실패하면 오류를 반환한다.
pub async fn create_post(pool: &PgPool, author_id: i64, input: &NewPost) -> RepoResult<Post> {
    let kind = input.validate()?;
    let base = slugify(&input.title);

    let row: PostRow = sqlx::query_as(
        r"WITH picked AS (
            SELECT CASE
                     WHEN NOT EXISTS (SELECT 1 FROM posts WHERE slug = $2) THEN $2
                     ELSE $2 || '-' || (SELECT COUNT(*) + 1 FROM posts WHERE slug LIKE $2 || '%')::text
                   END AS slug
          )
          INSERT INTO posts
            (kind, slug, title, summary, body, tag, author_id, asset_id, source, source_url, detail)
          SELECT $1, picked.slug, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, '{}'::jsonb)
          FROM picked
          RETURNING id, kind, slug, title, summary, body, tag,
                    (SELECT display_name FROM accounts WHERE id = $7),
                    asset_id, source, source_url, detail, published_at",
    )
    .bind(kind.as_str())
    .bind(&base)
    .bind(input.title.trim())
    .bind(input.summary.as_deref())
    .bind(&input.body)
    .bind(input.tag.as_deref())
    .bind(author_id)
    .bind(input.asset_id)
    .bind(input.source.as_deref())
    .bind(input.source_url.as_deref())
    .bind(input.detail.as_ref())
    .fetch_one(pool)
    .await
    .context("creating post")?;

    Ok(to_post(row))
}

/// 내 글만 지운다. 남의 글을 지우려 하면 없는 것으로 본다.
///
/// # Errors
/// 글이 없거나 내 것이 아니면 오류를 반환한다.
pub async fn delete_post(pool: &PgPool, author_id: i64, slug: &str) -> RepoResult<()> {
    let done = sqlx::query("DELETE FROM posts WHERE slug = $1 AND author_id = $2")
        .bind(slug)
        .bind(author_id)
        .execute(pool)
        .await
        .context("deleting post")?;

    if done.rows_affected() == 0 {
        return Err(RepoError::PostNotFound(slug.to_owned()));
    }
    Ok(())
}

/// 제목에서 주소에 쓸 수 있는 조각을 만든다.
fn slugify(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed: String = cleaned
        .split('-')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    // 한글만 있는 제목은 여기서 빈 문자열이 된다. 그때는 종류로 대신한다.
    if trimmed.is_empty() {
        "post".to_owned()
    } else {
        trimmed.chars().take(80).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::{NewPost, PostError, PostKind, slugify};

    fn post(kind: &str, title: &str) -> NewPost {
        NewPost {
            kind: kind.into(),
            title: title.into(),
            summary: None,
            body: String::new(),
            tag: None,
            asset_id: None,
            source: None,
            source_url: None,
            detail: None,
        }
    }

    #[test]
    fn every_kind_round_trips() {
        for k in [
            PostKind::News,
            PostKind::Case,
            PostKind::Vlog,
            PostKind::Article,
        ] {
            assert_eq!(PostKind::from_label(k.as_str()), Some(k));
        }
        assert_eq!(PostKind::from_label("blog"), None);
    }

    #[test]
    fn an_unknown_kind_is_rejected() {
        assert_eq!(
            post("blog", "제목").validate(),
            Err(PostError::BadKind("blog".into()))
        );
    }

    #[test]
    fn an_empty_title_is_rejected() {
        assert_eq!(post("news", "   ").validate(), Err(PostError::EmptyTitle));
    }

    #[test]
    fn title_length_is_counted_in_characters() {
        // 한글 201자는 UTF-8 로 603바이트다. 바이트로 세면 멀쩡한 제목이 거절된다.
        let ok = post("news", &"가".repeat(200));
        assert!(ok.validate().is_ok());
        assert_eq!(
            post("news", &"가".repeat(201)).validate(),
            Err(PostError::LongTitle { max: 200 })
        );
    }

    #[test]
    fn slugs_stay_url_safe() {
        assert_eq!(slugify("Gothic Statue 3D"), "gothic-statue-3d");
        assert_eq!(slugify("  Hello,  World!  "), "hello-world");
        // 한글만 있으면 남는 게 없다. 통째로 인코딩되느니 기본값을 쓴다.
        assert_eq!(slugify("도트 게임에 3D 에셋"), "3d");
        assert_eq!(slugify("한글만"), "post");
    }
}
