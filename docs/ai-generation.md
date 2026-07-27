# AI 에셋 생성 — 조사와 설계

프롬프트로 3D 에셋을 만들어 마켓에 올린다. 이 문서는 어떤 생성 서비스를 어떻게
붙일지, 그리고 그걸 받쳐야 하는 백엔드가 어떤 모양이어야 하는지를 적는다.

작성 2026-07-27 · 조사 대상은 아래 각주 참조

---

## 1. 어떤 서비스를 붙이나

먼저 짚어야 할 게 있다. **Seedance는 영상 생성 모델이다.** ByteDance가 만든
text/image-to-video 모델이라 게임 에셋(3D 메시)과는 다른 물건이다. 우리가 필요한
건 text/image-to-3D 쪽이고, 2026년 기준 실사용 가능한 API는 셋이다.

| | 강점 | API | 대략 단가 |
|---|---|---|---|
| **Meshy** | 스타일라이즈 에셋, 오토리깅 내장 | 비동기 + 폴링/콜백 | 생성당 $0.05–0.20 |
| **Tripo3D** | 빠른 초안, 쓸 만한 무료 티어 | 비동기 + 폴링 | 무료 티어 있음 |
| **Rodin** | 고밀도 지오메트리, 제어 정밀 | 비동기 | Business $120/월부터 |

**우리 선택: Meshy를 1순위, Tripo3D를 폴백.**

이유가 셋이다. 우리 마켓의 주력이 스타일라이즈 게임 에셋이라 Meshy의 결과물
성향이 맞는다. 오토리깅이 붙어 있어 캐릭터 에셋의 후처리 부담이 준다. Rodin은
품질이 제일 좋지만 월 $120 최소 약정이라, 생성량이 확정되기 전에 묶이는 게 맞지
않는다.

폴백을 두는 이유는 단가가 아니라 가용성이다. 생성 API는 큐가 밀리면 수 분씩
걸리고, 한 곳이 죽으면 우리 기능도 같이 죽는다. 어댑터를 하나 두고 제공자를
갈아 끼울 수 있게 한다.

### 공통 흐름

셋 다 같은 모양이다. **비동기 작업 + 상태 폴링(또는 콜백)** 이다.

```
POST  /v2/text-to-3d        { prompt, art_style, ... }  → { task_id }
GET   /v2/text-to-3d/{id}                               → { status, progress, model_urls }
```

동기 응답이 아니라는 게 설계를 통째로 정한다. HTTP 요청 안에서 기다릴 수 없다 —
생성이 30초에서 5분 걸리는데 그동안 워커를 붙잡고 있으면 동시 접속 몇십 명에
서버가 멈춘다. **그래서 작업 큐가 필요하다.** 인프라 얘기가 여기서 시작된다.

---

## 2. 백엔드 아키텍처

목표: **동시 접속 10,000명**, 생성 작업이 밀려도 API 응답은 안 느려지는 구조.

### 2.1 큐를 무엇으로 하나

Redis + 별도 브로커를 쓰지 않는다. **Postgres `SELECT ... FOR UPDATE SKIP LOCKED`**
로 간다.

근거는 셋이다.

**첫째, 규모가 맞는다.** SKIP LOCKED 기반 Postgres 큐는 시간당 5만 작업까지
별도 브로커 없이 버틴다. 우리 상한을 잡아 보면 — 동시 접속 10,000명 중 생성을
누르는 비율을 넉넉히 5%로 잡아도 500건이고, 한 건에 3분이면 시간당 10,000건이다.
한 자릿수 배수 여유가 있다.

**둘째, 트랜잭션이 하나로 묶인다.** 크레딧 차감과 작업 등록이 같은 트랜잭션에
들어간다. Redis를 쓰면 "크레딧은 깎였는데 작업은 안 들어간" 상태가 생기고, 그걸
막으려면 결국 보상 트랜잭션을 짜야 한다.

**셋째, 운영할 것이 안 는다.** Redis를 넣으면 상태를 가진 서비스가 하나 더
생긴다. 백업, 페일오버, 모니터링이 다 두 배가 된다. 지금 우리 인원으로 그걸
감당할 이유가 없다.

바꿔 말하면 — **시간당 5만 건을 넘기면 그때 브로커로 옮긴다.** 그 시점이
오면 워커 인터페이스만 남기고 저장소를 바꾸면 되도록 짜 둔다.

```sql
-- 워커가 작업을 집는다. SKIP LOCKED 라 워커끼리 안 기다린다.
UPDATE gen_jobs SET status = 'running', started_at = now(), worker_id = $1
WHERE id = (
    SELECT id FROM gen_jobs
    WHERE status = 'queued' AND run_after <= now()
    ORDER BY priority DESC, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING *;
```

`LISTEN/NOTIFY`로 깨운다. 폴링만 두면 유휴 시 지연이 폴링 주기만큼 생기고,
주기를 줄이면 빈 쿼리가 계속 돈다.

### 2.2 마스터 / 슬레이브

두 층에서 나뉜다. 섞어 부르면 헷갈리므로 이름을 갈라 둔다.

**DB 복제 — 프라이머리 / 리플리카**

```
                  ┌─────────────┐
   쓰기 ─────────▶│  프라이머리  │
                  └──────┬──────┘
                         │ 스트리밍 복제
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │ 리플리카1 │          │ 리플리카2 │◀── 읽기
        └──────────┘          └──────────┘
```

읽기를 리플리카로 보낸다. 우리 트래픽은 압도적으로 읽기다 — 마켓 목록, 패싯,
게임 목록, 상세. 쓰기는 등록·주문·생성 요청뿐이다.

**주의할 점 하나.** 복제는 비동기라 방금 쓴 걸 리플리카에서 못 읽을 수 있다.
등록 직후 상세를 보러 가면 404가 나는 식이다. 그래서 **쓰기 직후 같은 요청
흐름에서의 읽기는 프라이머리로 보낸다.** 이걸 안 지키면 "올렸는데 없어요"
문의가 계속 들어온다.

**워커 — 리더 / 팔로워**

워커는 다 같다. 아무나 작업을 집는다. 다만 **혼자만 해야 하는 일**이 있다 —
만료 세션 정리, 만료 허가 정리, 죽은 작업 회수. 여럿이 동시에 하면 중복
처리되거나 서로 밟는다.

Postgres 어드바이저리 락으로 리더를 뽑는다. 별도 조정 서비스(etcd, Consul)를
안 넣는다.

```rust
// 트랜잭션 레벨 락을 쓴다. 세션 레벨은 워커가 죽으면 락이 남는다.
let is_leader: bool = sqlx::query_scalar("SELECT pg_try_advisory_xact_lock($1)")
    .bind(LEADER_LOCK_KEY)
    .fetch_one(&mut *tx)
    .await?;
```

### 2.3 전체 그림

```
                        ┌──────────────┐
     10,000 접속 ──────▶│ 로드밸런서    │
                        └──────┬───────┘
                   ┌───────────┼───────────┐
                   ▼           ▼           ▼
              ┌────────┐  ┌────────┐  ┌────────┐
              │ API 1  │  │ API 2  │  │ API 3  │   무상태. 세션은 DB에 있다
              └───┬────┘  └───┬────┘  └───┬────┘
                  └───────────┼───────────┘
                              ▼
                    ┌───────────────────┐
        ┌──────────▶│    Postgres       │◀── 읽기: 리플리카
        │  작업 큐   │  프라이머리        │
        │           └───────────────────┘
        │                     ▲
   ┌────┴─────┬───────────────┘
   ▼          ▼
┌───────┐ ┌───────┐
│워커 1  │ │워커 2  │  ← 하나가 리더(정리 작업 담당)
│(리더)  │ │       │
└───┬───┘ └───┬───┘
    └─────────┴────────▶ Meshy / Tripo3D API
```

API 노드는 **무상태**다. 세션이 DB에 있어서 어느 노드로 붙어도 같다. 이게
수평 확장의 전제고, 우리는 처음부터 그렇게 짜 뒀다 — JWT 대신 서버 세션을
고른 게 여기서 값을 한다.

### 2.4 왜 워커를 따로 두나

같은 바이너리에 `--worker` 플래그로 뜬다. 별도 크레이트를 안 만드는 이유는
도메인 로직을 공유해야 해서다 — 생성 결과에 배지를 매기는 건 API가 하든 워커가
하든 같은 규칙이어야 한다.

대신 프로세스는 나눈다. 생성 작업이 밀려도 API 응답이 안 느려지려면 그 둘이
같은 스레드 풀을 안 써야 한다.

---

## 3. 관측 — Grafana

붙일 값은 셋으로 나뉜다.

**RED — API가 건강한가**
- `http_requests_total{route,method,status}` — 요청 수
- `http_request_duration_seconds{route}` — 지연 (히스토그램, p50/p95/p99)
- 오류율은 위 둘에서 나온다

**큐 — 생성이 밀리는가**
- `gen_jobs_queued` — 대기 중 작업 수. **이게 계속 늘면 워커를 늘려야 한다**
- `gen_jobs_wait_seconds` — 큐에 머문 시간
- `gen_jobs_duration_seconds{provider,status}` — 생성 소요
- `gen_jobs_total{provider,status}` — 성공/실패 누계

**외부 — 남의 서비스가 문제인가**
- `provider_requests_total{provider,status}`
- `provider_duration_seconds{provider}`

이게 있어야 "느리다"는 신고가 왔을 때 **우리가 느린 건지 Meshy가 느린 건지**
가 구분된다. 그 구분이 안 되면 엉뚱한 데를 고치게 된다.

경보는 셋만 건다. 많이 걸면 아무도 안 본다.

| 경보 | 조건 | 왜 |
|---|---|---|
| 큐 적체 | `gen_jobs_queued > 500` 5분 지속 | 워커 부족. 사용자가 기다린다 |
| API 지연 | p95 > 1s 5분 지속 | 사람이 느끼는 임계 |
| 제공자 실패 | 실패율 > 20% 5분 | 폴백으로 넘길 시점 |

수집은 Prometheus가 `/metrics`를 긁어 가는 방식이다. 푸시 게이트웨이를 안
쓰는 이유는 API 노드가 여럿이라 어느 노드 값인지 구분되어야 하기 때문이다.

---

## 4. Rust 쪽 구성

`rust-engineering` 표준을 따른다.

**크레이트 구성**

```
crates/api/
  src/domain/       판정과 계산. 바깥을 모른다
    gen.rs          생성 요청 규칙, 크레딧 계산
  src/repo/         Postgres 질의
    job.rs          큐 — 넣기, 집기, 끝내기, 회수
  src/provider/     외부 생성 서비스
    mod.rs          trait Generator — 제공자를 갈아 끼우는 자리
    meshy.rs
    tripo.rs
  src/worker/       작업 처리
    mod.rs          루프, 리더 선출, 우아한 종료
  src/metrics.rs    Prometheus 노출
  src/http/
    gen.rs          생성 요청·조회 라우트
```

**의존 방향은 그대로 한 방향이다.** `provider`와 `worker`가 늘어도
`domain`은 아무것도 모른다.

**오류 처리** — 라이브러리 경계는 `thiserror`로 종류를 남기고, 부르는 쪽이
분기하지 않는 곳만 `anyhow`. 이미 `RepoError`가 그 모양이다.

**async** — 블로킹 금지. 생성 API 호출은 `reqwest`(이미 있다), 재시도는
지수 백오프. `select!` 안에서 상태를 들고 있지 않는다 — 취소되면 그 상태가
사라진다.

**우아한 종료** — 워커가 작업을 잡은 채로 죽으면 그 작업은 `running`에
남는다. 종료 신호를 받으면 진행 중인 작업만 끝내고 새 작업을 안 집는다.
그래도 죽는 경우가 있으므로 **회수(reaper)** 를 둔다 — `started_at`이
타임아웃을 넘긴 `running` 작업을 `queued`로 되돌린다. 리더만 한다.

**멱등성** — 제공자 콜백은 여러 번 온다. Stripe에서 이미 겪었다. 작업
상태를 `running`일 때만 바꾸고, 이미 끝난 건 조용히 넘긴다.

---

## 5. 크레딧

생성은 돈이 든다. 무제한으로 열면 한 사람이 API 요금을 태울 수 있다.

- 요청 시점에 크레딧을 **먼저 깎는다.** 끝나고 깎으면 큐에 쌓아 놓고 도망갈 수 있다
- 실패하면 **되돌린다.** 우리 잘못이나 제공자 잘못으로 실패한 걸 사용자가 물면 안 된다
- 차감과 작업 등록이 **같은 트랜잭션**이다. 이게 Postgres 큐를 고른 이유 중 하나다

---

## 6. 단계

1. 스키마 — `gen_jobs`, `credits`, `credit_ledger`
2. 도메인 — 생성 요청 규칙, 크레딧 계산 (순수 함수, 테스트 먼저)
3. 저장소 — SKIP LOCKED 큐, 크레딧 원장
4. 제공자 — `trait Generator` + Meshy 구현. 자격증명 없으면 503
5. 워커 — 루프, 리더 선출, 회수, 우아한 종료
6. 관측 — `/metrics`, Grafana 대시보드 정의(JSON)
7. HTTP — 생성 요청, 상태 조회, 목록
8. 화면 — AI 에셋 생성 메뉴

각 단계마다 테스트를 붙인다. 특히 큐는 **워커 둘이 같은 작업을 안 집는지**를
반드시 확인한다 — 이게 깨지면 요금이 두 배로 나가고, 눈으로는 안 보인다.

---

## 각주 — 조사 출처

- 3D 생성 API 비교: [3DAI Studio, Best 3D Model Generation APIs in 2026](https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026), [Neural4D 벤치마크](https://www.neural4d.com/features/neural4d-vs-tripo-vs-meshy-vs-rodin)
- 비동기 작업 패턴·단가: [Poyo, Meshy/Tripo3D API](https://poyo.ai/hub/meshy-tripo-3d-api-now-available)
- 게임 에셋 적합성: [Meshy, Best AI Tools for 3D Game Assets](https://www.meshy.ai/blog/best-ai-tools-for-3d-game-assets)
- Postgres 큐 처리량과 SKIP LOCKED: [PostgreSQL LISTEN/NOTIFY as a lightweight job queue](https://dev.to/software_mvp-factory/postgresql-listennotify-as-a-lightweight-job-queue-replacing-redis-for-your-startups-background-4g8j)
- 어드바이저리 락과 리더 선출: [PostgreSQL Advisory Locks for Distributed Job Scheduling](https://mvpfactory.io/blog/postgresql-advisory-locks-for-distributed-job-scheduling-skip-locked-lock)

단가와 처리량은 인용값이고, 우리 트래픽 추정(생성 전환율 5%, 건당 3분)과
경보 임계는 우리가 세운 가정이다. 둘을 섞지 않는다.
