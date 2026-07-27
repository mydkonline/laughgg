//! GLB 파서.
//!
//! 채점에 필요한 값만 꺼낸다. 렌더링용 파서가 아니라 정점 좌표는 안 읽는다 —
//! 수백 메가짜리 버퍼를 통째로 해석할 이유가 없다.
//!
//! GLB 구조는 단순하다. 12바이트 헤더 뒤에 청크가 이어지고, 첫 청크가 JSON 이다.
//! 그 JSON 에 메시·재질·확장이 전부 들어 있고, 삼각형 수는 accessor 의 count 로
//! 나온다. 텍스처 해상도만 바이너리 청크를 들여다봐야 하는데 PNG 는 IHDR,
//! JPEG 는 SOF 마커 하나만 읽으면 된다.

use serde::Deserialize;

use crate::domain::Facts;

/// 파일이 GLB 가 아니거나 깨졌다.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GlbError {
    #[error("not a glb file")]
    NotGlb,
    #[error("unsupported glb version: {0}")]
    BadVersion(u32),
    #[error("file is truncated")]
    Truncated,
    #[error("json chunk is unreadable: {0}")]
    BadJson(String),
}

/* 매직 값을 손으로 적지 않는다.

처음에 "glTF" 를 0x46746C67 로 적었는데 대문자 T(0x54) 를 소문자(0x74) 로
썼고, "BIN\0" 은 바이트 순서를 뒤집어 적었다. 단위 테스트가 같은 틀린
상수로 파일을 만들어서 서로 통과했다 — 실제 파일을 넣어 보고서야 잡혔다.

바이트에서 유도하면 그 부류의 오타가 안 생긴다. */
const MAGIC: u32 = u32::from_le_bytes(*b"glTF");
const CHUNK_JSON: u32 = u32::from_le_bytes(*b"JSON");
const CHUNK_BIN: u32 = u32::from_le_bytes(*b"BIN\0");

#[derive(Deserialize, Default)]
struct Gltf {
    #[serde(default)]
    meshes: Vec<Mesh>,
    #[serde(default)]
    materials: Vec<serde_json::Value>,
    #[serde(default)]
    accessors: Vec<Accessor>,
    #[serde(default)]
    images: Vec<Image>,
    #[serde(default)]
    #[serde(rename = "bufferViews")]
    buffer_views: Vec<BufferView>,
    #[serde(default)]
    #[serde(rename = "extensionsUsed")]
    extensions_used: Vec<String>,
    #[serde(default)]
    nodes: Vec<Node>,
}

#[derive(Deserialize, Default)]
struct Mesh {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    primitives: Vec<Primitive>,
}

#[derive(Deserialize, Default)]
struct Primitive {
    #[serde(default)]
    indices: Option<usize>,
    #[serde(default)]
    attributes: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize, Default)]
struct Accessor {
    #[serde(default)]
    count: u32,
}

#[derive(Deserialize, Default)]
struct Image {
    #[serde(default, rename = "bufferView")]
    buffer_view: Option<usize>,
}

#[derive(Deserialize, Default)]
struct BufferView {
    #[serde(default, rename = "byteOffset")]
    byte_offset: usize,
    #[serde(rename = "byteLength")]
    byte_length: usize,
}

#[derive(Deserialize, Default)]
struct Node {
    #[serde(default)]
    name: Option<String>,
}

/// GLB 바이트에서 채점에 쓸 값을 뽑는다.
///
/// # Errors
/// GLB 가 아니거나 잘렸거나 JSON 이 깨졌으면 [`GlbError`] 를 반환한다.
pub fn read(bytes: &[u8]) -> Result<Facts, GlbError> {
    if bytes.len() < 20 {
        return Err(GlbError::Truncated);
    }
    if u32(bytes, 0) != MAGIC {
        return Err(GlbError::NotGlb);
    }
    let version = u32(bytes, 4);
    if version != 2 {
        return Err(GlbError::BadVersion(version));
    }

    // 청크를 훑어 JSON 과 BIN 의 위치를 찾는다.
    let mut json: Option<&[u8]> = None;
    let mut bin: Option<&[u8]> = None;
    let mut at = 12;
    while at + 8 <= bytes.len() {
        let len = u32(bytes, at) as usize;
        let kind = u32(bytes, at + 4);
        let start = at + 8;
        let end = start.checked_add(len).ok_or(GlbError::Truncated)?;
        if end > bytes.len() {
            return Err(GlbError::Truncated);
        }
        match kind {
            CHUNK_JSON => json = Some(&bytes[start..end]),
            CHUNK_BIN => bin = Some(&bytes[start..end]),
            // 모르는 청크는 건너뛴다. 명세가 그렇게 하라고 한다.
            _ => {}
        }
        at = end;
    }

    let json = json.ok_or(GlbError::Truncated)?;
    let g: Gltf = serde_json::from_slice(json).map_err(|e| GlbError::BadJson(e.to_string()))?;

    let mut triangles = 0_u32;
    let mut primitives = 0_u32;
    let mut unindexed = 0_u32;

    for m in &g.meshes {
        for p in &m.primitives {
            primitives += 1;
            // 인덱스가 있으면 삼각형 수 = 인덱스 수 / 3.
            if let Some(a) = p.indices.and_then(|i| g.accessors.get(i)) {
                triangles += a.count / 3;
            } else {
                unindexed += 1;
                // 인덱스가 없으면 정점이 그대로 삼각형이다.
                if let Some(a) = p
                    .attributes
                    .get("POSITION")
                    .and_then(serde_json::Value::as_u64)
                    .and_then(|i| g.accessors.get(usize::try_from(i).unwrap_or(usize::MAX)))
                {
                    triangles += a.count / 3;
                }
            }
        }
    }

    /* LOD 판정.

    glTF 에 LOD 표준이 없다. 관례는 이름이다 — Blender·Unity·Unreal 이
    공통으로 _LOD0, _LOD1 같은 접미사를 쓴다. 메시와 노드 양쪽을 본다. */
    let has_lod = g
        .meshes
        .iter()
        .filter_map(|m| m.name.as_deref())
        .chain(g.nodes.iter().filter_map(|n| n.name.as_deref()))
        .any(is_lod_name);

    // 텍스처 해상도. 짧은 변만 쓴다 — 정사각형이 아닐 때 큰 쪽으로 재면
    // 가느다란 텍스처가 좋은 걸로 잡힌다.
    let mut texture_sides = Vec::new();
    if let Some(bin) = bin {
        for img in &g.images {
            let Some(view) = img.buffer_view.and_then(|i| g.buffer_views.get(i)) else {
                continue;
            };
            let start = view.byte_offset;
            let end = start.saturating_add(view.byte_length).min(bin.len());
            if start >= end {
                continue;
            }
            if let Some((w, h)) = image_size(&bin[start..end]) {
                texture_sides.push(w.min(h));
            }
        }
    }

    Ok(Facts {
        triangles,
        materials: u32::try_from(g.materials.len()).unwrap_or(u32::MAX),
        meshes: u32::try_from(g.meshes.len()).unwrap_or(u32::MAX),
        primitives,
        texture_sides,
        has_lod,
        unindexed,
        extensions: g.extensions_used,
        bytes: bytes.len() as u64,
    })
}

/// `Rock_LOD0`, `tree lod 1`, `Wall-lod2` 를 다 잡는다.
fn is_lod_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower
        .split(|c: char| !c.is_ascii_alphanumeric())
        .any(|part| {
            part == "lod"
                || (part.starts_with("lod")
                    && part[3..].chars().all(|c| c.is_ascii_digit())
                    && part.len() > 3)
        })
}

/* 이미지 크기.

전체를 디코딩하지 않는다. PNG 는 IHDR 이 항상 16바이트 위치에 있고,
JPEG 는 SOF 마커를 찾으면 된다. 그 두 개가 glTF 가 허용하는 전부다. */
fn image_size(data: &[u8]) -> Option<(u32, u32)> {
    // PNG: 시그니처 8 + 길이 4 + "IHDR" 4 = 16 부터 폭·높이
    if data.len() >= 24 && data.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some((be32(data, 16), be32(data, 20)));
    }

    // JPEG: 0xFFD8 로 시작하고 SOF0/1/2 마커에 크기가 있다.
    if data.len() >= 4 && data[0] == 0xFF && data[1] == 0xD8 {
        let mut i = 2;
        while i + 9 < data.len() {
            if data[i] != 0xFF {
                i += 1;
                continue;
            }
            let marker = data[i + 1];
            // SOF0 baseline, SOF1 extended, SOF2 progressive
            if matches!(marker, 0xC0..=0xC2) {
                let h = u32::from(be16(data, i + 5));
                let w = u32::from(be16(data, i + 7));
                return Some((w, h));
            }
            // 마커 길이만큼 건너뛴다. 길이가 0 이면 무한 루프가 되므로 막는다.
            let len = usize::from(be16(data, i + 2));
            if len < 2 {
                return None;
            }
            i += 2 + len;
        }
    }
    None
}

fn u32(b: &[u8], at: usize) -> u32 {
    u32::from_le_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]])
}
fn be32(b: &[u8], at: usize) -> u32 {
    u32::from_be_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]])
}
fn be16(b: &[u8], at: usize) -> u16 {
    u16::from_be_bytes([b[at], b[at + 1]])
}

#[cfg(test)]
mod tests {
    use super::{GlbError, image_size, is_lod_name, read};

    /// 최소한의 GLB 를 만든다. 실제 파일 없이 파서를 검증한다.
    fn glb(json: &str, bin: Option<&[u8]>) -> Vec<u8> {
        let mut out = Vec::new();
        let jbytes = json.as_bytes();
        // 청크는 4바이트 정렬이어야 한다.
        let jpad = (4 - jbytes.len() % 4) % 4;
        let jlen = jbytes.len() + jpad;
        let blen = bin.map_or(0, |b| b.len() + (4 - b.len() % 4) % 4);
        let total = 12 + 8 + jlen + if bin.is_some() { 8 + blen } else { 0 };

        out.extend_from_slice(&super::MAGIC.to_le_bytes());
        out.extend_from_slice(&2_u32.to_le_bytes());
        out.extend_from_slice(
            &u32::try_from(total)
                .expect("테스트 파일은 작다")
                .to_le_bytes(),
        );

        out.extend_from_slice(
            &u32::try_from(jlen)
                .expect("테스트 파일은 작다")
                .to_le_bytes(),
        );
        out.extend_from_slice(&super::CHUNK_JSON.to_le_bytes());
        out.extend_from_slice(jbytes);
        out.extend(std::iter::repeat_n(b' ', jpad));

        if let Some(b) = bin {
            let bpad = (4 - b.len() % 4) % 4;
            out.extend_from_slice(
                &u32::try_from(b.len() + bpad)
                    .expect("테스트 파일은 작다")
                    .to_le_bytes(),
            );
            out.extend_from_slice(&super::CHUNK_BIN.to_le_bytes());
            out.extend_from_slice(b);
            out.extend(std::iter::repeat_n(0_u8, bpad));
        }
        out
    }

    #[test]
    fn a_plain_model_is_measured() {
        let f = read(&glb(
            r#"{"meshes":[{"name":"Rock","primitives":[{"indices":0,"attributes":{"POSITION":1}}]}],
                "accessors":[{"count":300},{"count":150}],
                "materials":[{}],
                "extensionsUsed":["KHR_texture_transform"]}"#,
            None,
        ))
        .expect("읽기");

        assert_eq!(f.triangles, 100, "인덱스 300개면 삼각형 100개");
        assert_eq!(f.materials, 1);
        assert_eq!(f.meshes, 1);
        assert_eq!(f.primitives, 1);
        assert_eq!(f.unindexed, 0);
        assert!(!f.has_lod);
        assert_eq!(f.extensions, ["KHR_texture_transform"]);
    }

    /* 인덱스가 없으면 정점이 그대로 삼각형이다.

    이걸 안 세면 인덱스 없는 모델의 삼각형이 0 으로 잡히고, 빈 모델로
    오해해서 0 점이 나간다. */
    #[test]
    fn an_unindexed_primitive_still_counts_triangles() {
        let f = read(&glb(
            r#"{"meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}],
                "accessors":[{"count":90}]}"#,
            None,
        ))
        .expect("읽기");

        assert_eq!(f.triangles, 30);
        assert_eq!(f.unindexed, 1, "인덱스 없는 것을 세야 감점할 수 있다");
    }

    #[test]
    fn lod_names_are_recognized() {
        for name in ["Rock_LOD0", "tree lod 1", "Wall-lod2", "PROP_Lod3"] {
            assert!(is_lod_name(name), "{name}");
        }
        for name in ["Rock", "flood_gate", "lodge", "cloud"] {
            assert!(!is_lod_name(name), "{name} 은 LOD 가 아니다");
        }
    }

    #[test]
    fn lod_is_found_on_meshes_or_nodes() {
        let from_mesh = read(&glb(
            r#"{"meshes":[{"name":"Rock_LOD0","primitives":[]}]}"#,
            None,
        ))
        .expect("읽기");
        assert!(from_mesh.has_lod);

        let from_node = read(&glb(
            r#"{"meshes":[{"name":"Rock","primitives":[]}],"nodes":[{"name":"Rock_LOD1"}]}"#,
            None,
        ))
        .expect("읽기");
        assert!(from_node.has_lod, "노드 이름도 봐야 한다");
    }

    #[test]
    fn png_dimensions_come_out() {
        // PNG 시그니처 + IHDR 길이/타입 + 폭·높이
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&13_u32.to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&2048_u32.to_be_bytes());
        png.extend_from_slice(&1024_u32.to_be_bytes());
        png.extend_from_slice(&[8, 6, 0, 0, 0]);
        assert_eq!(image_size(&png), Some((2048, 1024)));
    }

    #[test]
    fn a_texture_is_measured_by_its_short_side() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&13_u32.to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&4096_u32.to_be_bytes());
        png.extend_from_slice(&256_u32.to_be_bytes());
        png.extend_from_slice(&[8, 6, 0, 0, 0]);

        let json = format!(
            r#"{{"images":[{{"bufferView":0}}],"bufferViews":[{{"byteOffset":0,"byteLength":{}}}]}}"#,
            png.len()
        );
        let f = read(&glb(&json, Some(&png))).expect("읽기");
        assert_eq!(
            f.texture_sides,
            vec![256],
            "긴 변으로 재면 가느다란 텍스처가 좋은 걸로 잡힌다"
        );
    }

    #[test]
    fn broken_input_is_refused_not_guessed() {
        assert_eq!(read(b"").expect_err("빈 입력"), GlbError::Truncated);
        assert_eq!(
            read(&[0_u8; 32]).expect_err("GLB 가 아니다"),
            GlbError::NotGlb
        );

        // 버전이 1 이면 구조가 다르다. 읽은 척하면 엉뚱한 점수가 나간다.
        let mut v1 = glb(r#"{"meshes":[]}"#, None);
        v1[4..8].copy_from_slice(&1_u32.to_le_bytes());
        assert_eq!(read(&v1).expect_err("버전 1"), GlbError::BadVersion(1));

        // JSON 이 깨졌으면 빈 모델이 아니라 오류다.
        let bad = glb(r#"{"meshes":[  "#, None);
        assert!(matches!(read(&bad), Err(GlbError::BadJson(_))));
    }

    #[test]
    fn a_truncated_chunk_is_caught() {
        let mut g = glb(r#"{"meshes":[]}"#, None);
        // 청크 길이를 파일보다 크게 만든다.
        g[12..16].copy_from_slice(&9999_u32.to_le_bytes());
        assert_eq!(read(&g).expect_err("잘린 청크"), GlbError::Truncated);
    }
}
