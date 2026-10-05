# 잇고톡 연산 학습 MVP

## 실행하기
```bash
pnpm install
pnpm dev            # http://localhost:3000  (첫 실행 시 DB 생성 + content/*.csv + 데모 계정 시드)
```
| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `student1` | `1234` | 학생 (진단 전 → 입회 진단부터) |
| `student2` | `1234` | 학생 (2주 학습 기록 있음) |
| `teacher` | `teach1234` | 선생님 (잇고 수학학원) |
| `director` | `teach1234` | 원장 (교사 승인, 초대코드) |
| `admin` | `admin1234` | 본사 관리자 |

학생 가입 초대 코드: `ITGO2026` (다른 기관 RLS 확인용: `SUNNY001`)

```bash
pnpm test           # 엔진 T1~T12 + 콘텐츠 검증 + RLS + 서버 훈련 루프 (60개)
pnpm test:e2e       # 가입 → 진단 → 연습 3회 → 테스트 통과 → 다음 세트 열림
pnpm lint && pnpm typecheck
pnpm db:seed        # CSV를 검증해 로컬 DB에 반영 (--reset: 초기화). dev 서버를 끈 상태에서 실행
pnpm db:seed:sql    # supabase/seed.sql 생성 (Supabase용)
```

## 데이터베이스: 로컬 PGlite → Supabase
Docker/Supabase 없이 바로 돌도록 로컬에서는 **PGlite(WASM으로 돌아가는 실제 Postgres)** 를 씁니다.
스키마·RLS는 Supabase와 같은 SQL입니다.
- `supabase/migrations/*` — 스키마(`db/schema.sql` 그대로) + 보조 테이블 + RLS 정책
- `db/local/00_supabase_stub.sql` — 로컬 전용: Supabase가 기본 제공하는 `auth.users`, `auth.uid()`, `anon/authenticated` 역할 흉내
- 사용자 대신 읽는 쿼리는 모두 `asUser()`로 `authenticated` 역할 + JWT sub를 설정한 채 실행 → **RLS가 실제 경계**
- 엔진 결과 쓰기(시도 저장·진도 갱신)는 서버에서 검증 후 `asService()`로 실행

Supabase로 옮길 때: 마이그레이션을 `supabase db push`, 로그인을 Supabase Auth로 교체(`src/lib/auth/`), `src/lib/db/client.ts`의 연결을 Postgres 연결로 교체.

## 코드 지도
```
src/lib/engine/      순수 학습 엔진 (통과 판정, 진도, 셔플, 진단, 리포트 문장, AI 속도)
src/lib/content/     CSV 파서·검증 (시드와 관리자 업로드가 같은 함수 사용)
src/lib/server/      서버 전용: 풀이 시작/채점/진도 반영, 리포트 생성·발송(ReportSender)
src/app/s|t|r|admin  docs/screens.md 라우트 그대로
```

---

# 잇고톡 개발 키트 (Claude Code 입력 자료)

한글(hwp) 기획 자료 4건과 서비스 기획서를 Claude Code가 바로 읽을 수 있는 형태로 옮긴 폴더입니다.

## 사용법
1. 이 폴더 전체를 새 Git 저장소 루트에 복사합니다.
2. 터미널에서 `claude`를 실행합니다. (CLAUDE.md는 자동으로 읽힙니다)
3. `docs/build-prompts.md`의 프롬프트를 0단계부터 순서대로 붙여 넣습니다.

## 구성
```
CLAUDE.md                        프로젝트 규칙·스택·문서 지도 (Claude Code가 자동 로드)
docs/PRD.md                      MVP 요구사항, 사용자 스토리, 수용 기준, 미결 사항
docs/learning-engine.md          진도·통과 판정 규칙, 의사코드, 테스트 케이스 12개
docs/data-model.md               엔티티 관계, CSV 매핑, 문항 표시 규칙
docs/screens.md                  화면·라우트 명세, 문항 화면 레이아웃
docs/build-prompts.md            단계별 개발 프롬프트 (0~10단계)
db/schema.sql                    PostgreSQL(Supabase) 스키마
content/skills.csv               스킬 15개 (+1~+5 도입·직관·교환법칙, 10의 보수)
content/items_addition_sum10.csv 덧셈 합 10 이하 문항 174개 (p1~p29)
content/curriculum.csv           교재 SA~SH 주차별 커리큘럼 (1~68주 + 번호 없는 6개)
```

## 원본 대비 정정한 부분 (검수 필요)
- 문항: p9~12 페이지 라벨 정정, **p21~22는 원본이 p15~16과 중복이라 +4 교환법칙 문항을 새로 작성** (note 컬럼에 표시)
- 커리큘럼: 주차 번호 56~59·50 → 46~50, '지관' → '직관', 45주 과정수학 공란 표시
- 모든 문항 정답은 계산으로 재생성해 검증함

## 먼저 정해야 할 것
`docs/PRD.md` 6장 미결 사항 Q1~Q5 (통과 시간 기준, 리포트 주기, 교사 열람 범위 등)
