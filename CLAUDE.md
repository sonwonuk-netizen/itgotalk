# CLAUDE.md — 잇고톡(itgotalk) 연산 학습 서비스

이 파일은 Claude Code가 매 세션 처음 읽는 프로젝트 안내서입니다. 작업 전에 반드시 `docs/` 문서를 함께 참고하세요.

## 프로젝트 한 줄 요약
학원·공부방이 도입해 학생에게 제공하는 **게임형 연산 훈련 웹앱(PWA)**. 학생은 "연습 3회 → 랜덤 테스트 → 시간 내 통과" 루프로 단계를 올라가고, 교사는 기록을 보고 첨삭·출력하며, 학부모는 2주 단위 리포트를 받는다.

## 문서 지도
| 파일 | 내용 | 언제 읽나 |
|---|---|---|
| `docs/PRD.md` | MVP 범위, 사용자 스토리, 수용 기준 | 기능 작업 시작 전 항상 |
| `docs/learning-engine.md` | 진도·통과 판정 규칙, 의사코드, 테스트 케이스 | 학습 로직 수정 시 |
| `docs/data-model.md` | 엔티티 설명 (`db/schema.sql`과 짝) | DB/API 작업 시 |
| `docs/screens.md` | 화면 목록, 라우트, 화면별 요소 | UI 작업 시 |
| `docs/build-prompts.md` | 단계별 개발 지시 프롬프트 (사람용) | — |
| `content/skills.csv` | 스킬(단계) 정의 | 시드 데이터 |
| `content/items_addition_sum10.csv` | 덧셈 합 10 이하 문항 (p1~p29) | 시드 데이터 |
| `content/curriculum.csv` | 교재 SA~SH 주차별 커리큘럼 | 시드 데이터 |

## 기술 스택 (기본값 — 바꾸려면 먼저 사람에게 확인)
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS, 태블릿 가로 화면 우선 반응형, PWA
- Supabase (Postgres + Auth + Row Level Security)
- 테스트: Vitest (학습 엔진은 100% 단위 테스트), Playwright (핵심 흐름 E2E)
- 패키지 매니저: pnpm

## 명령어
```bash
pnpm dev          # 개발 서버
pnpm test         # 단위 테스트
pnpm test:e2e     # E2E
pnpm lint && pnpm typecheck
pnpm db:seed      # content/*.csv → DB
```

## 도메인 규칙 (절대 어기지 말 것)
1. **통과 판정은 서버에서 한다.** 클라이언트가 보낸 소요 시간은 서버의 세션 시작/종료 시각과 대조해 검증한다.
2. **통과 조건 = 전 문항 정답 AND 소요 시간 ≤ 스킬의 time_limit_sec.** 기준값은 `skills` 테이블에서 읽고 코드에 하드코딩하지 않는다.
3. **연습 3회를 마쳐야 테스트가 열린다.** 테스트 문항은 같은 스킬 범위에서 랜덤 재배열한다.
4. **모든 시도(Attempt)는 저장한다.** 실패도 기록이며, 리포트와 진도는 Attempt에서 계산한다(파생 데이터를 직접 수정하지 않는다).
5. **회원 대부분이 만 14세 미만이다.** 학생 화면에는 실명 대신 이니셜만 표시하고, 교사는 자기 기관 학생 정보만 조회한다(RLS로 강제).
6. 학습 엔진(`src/lib/engine/`)은 React·DB에 의존하지 않는 순수 함수로 작성한다.

## 코딩 규칙
- UI 문구는 한국어. 코드·변수·커밋 메시지는 영어.
- 컴포넌트는 `src/components/`, 화면은 `src/app/` 라우트 구조를 `docs/screens.md`와 일치시킨다.
- 새 기능은 PRD의 스토리 ID(예: `ST-03`)를 커밋 메시지에 적는다.
- 확실하지 않은 요구사항은 추측해서 구현하지 말고 `docs/PRD.md`의 "미결 사항"을 확인한 뒤 질문한다.

## MVP 범위 밖 (요청 없으면 만들지 말 것)
실시간 대전, 읽고 말하는 수학(개념 트랙), 결제, 네이티브 앱, 수학 외 과목.
