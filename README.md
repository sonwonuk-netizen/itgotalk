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

학생 가입 초대 코드: `ITGO2026` (다른 기관 접근 규칙 확인용: `SUNNY001`)

```bash
pnpm test           # 엔진 T1~T12 + 콘텐츠 검증 + 접근 규칙(rls.test) + 서버 훈련 루프
pnpm test:e2e       # 가입 → 진단 → 연습 3회 → 테스트 통과 → 다음 세트 열림
pnpm lint && pnpm typecheck
pnpm db:seed        # CSV를 검증해 로컬 DB에 반영 (--reset: 초기화). dev 서버를 끈 상태에서 실행
```

## 데이터베이스: 로컬 SQLite → Cloudflare D1
D1은 SQLite이므로, 로컬에서도 Node 내장 `node:sqlite`(`.data/itgotalk.sqlite`)로 같은 SQL을 씁니다.
- `migrations/*.sql` — 스키마. 로컬은 `src/lib/db/migrate.ts`가, D1은 `wrangler d1 migrations apply`가 적용
- 날짜는 ISO 문자열, 불리언은 0/1, JSON은 문자열로 저장 → `src/lib/db/sqlite.ts`가 컬럼 이름 규칙으로 변환 (`*_at` → Date 등)
- **접근 규칙**: D1에는 RLS가 없어서, 사용자 대신 읽는 쿼리는 모두 `asUser()`/`asAnon()`을 거치고
  `src/lib/db/scope.ts`가 쿼리 속 테이블마다 "볼 수 있는 행만 남긴 CTE"를 씌웁니다. 이 경로는 읽기 전용입니다.
- 쓰기는 서버에서 권한을 확인한 뒤 `asService()`로 실행 (D1은 트랜잭션이 없으므로 문장 하나하나가 안전하게 작성)

## Cloudflare 배포 (Workers + D1)
```bash
pnpm db:migrate:remote                 # migrations/ → D1
pnpm db:seed:sql [--admin <아이디>]    # .data/d1-seed.sql 생성 (콘텐츠 + 선택: 본사 관리자 계정, 비밀번호는 한 번만 출력)
pnpm db:seed:remote                    # 위 파일을 D1에 실행
pnpm cf:deploy                         # OpenNext 빌드 → Workers 배포
pnpm cf:preview                        # 배포 전 로컬 workerd + 로컬 D1로 확인 (먼저 --local로 migrations/seed 적용)
```
비밀값: `wrangler secret put SESSION_SECRET`, `wrangler secret put CRON_SECRET`. 운영 DB에는 데모 계정을 만들지 않습니다.

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
migrations/0001_schema.sql       SQLite(Cloudflare D1) 스키마
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
