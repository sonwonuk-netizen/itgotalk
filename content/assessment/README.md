# 진단 평가 콘텐츠 — 「읽고 말하는 수학 4~7학년 테스트」

원본: 평가 지도안 PDF (2026-08-14, 14쪽). 문항 12개 섹션, **129문항 / 답칸 170개**.
웹 화면(“진단 평가” 메뉴)은 이 폴더의 데이터를 읽어서 그리면 됩니다. 이 폴더는 데이터와 변환 도구만 포함하고, 앱 코드는 바꾸지 않았습니다.

## 왜 DB(JSON)인가 — HTML이 아니라
- PDF의 한글은 대부분 **글자가 아닌 그림(벡터 경로)**이라 텍스트 추출이 되지 않습니다(숫자만 일부 추출됨). 그래서 화면을 보고 문항을 구조화했습니다.
- 문항을 HTML로 통째로 만들면 보이기만 할 뿐 **채점·답 저장·문항 재사용·통계**가 안 됩니다.
- 그래서 **문항 = 데이터(JSON/DB)**, **화면 = 데이터를 그리는 컴포넌트**로 나눴습니다. `preview.html`은 그 렌더 결과를 미리 확인하는 용도입니다.
- 수식은 **LaTeX(KaTeX로 렌더)**, 그림은 **SVG/PNG 파일**, 답칸은 **입력 필드**입니다.

## 파일
| 파일 | 용도 |
|---|---|
| `assessment_4-7.json` | 원본 데이터(웹에서 바로 import 가능) |
| `schema.sql` | Postgres/Supabase 테이블 4개: `assessments → assessment_sections → assessment_parts → assessment_items` |
| `seed.sql` | 위 테이블에 넣는 데이터 (JSON에서 생성) |
| `figures/` | 그림 3개 (모두 `*.svg` 벡터. `s11-q3-semicircles.png`는 이전 버전, 미사용) |
| `preview.html` | 변환 확인용 렌더(정답 표시). 브라우저로 열면 됨 |
| `tools/build.py` | **원본 소스.** 문항 정의 + 정답 계산 → json/sql/html 생성 |
| `tools/verify_numbers.py` | PDF 텍스트층의 숫자와 변환 결과 숫자 대조 |
| `tools/verify_db.mjs` | schema+seed를 실제 Postgres(PGlite)에 넣어 정합성 검사 |
| `tools/extract_figures.py` | PDF에서 그림 잘라내기 |

수정 방법: `tools/build.py`를 고치고 `py content/assessment/tools/build.py` → json/sql/html이 다시 만들어집니다. (json/sql을 직접 고치지 마세요.)

**앱 DB 적재:** `supabase/migrations/20261005000600_assessments.sql`(= schema.sql), `20261005000700_assessment_seed.sql`(= seed.sql에서 begin/commit 제거)로 등록되어 있어 서버 시작 시 자동 적용됩니다. 이미 적용된 DB에서 문항을 고치면 seed 마이그레이션을 다시 쓰는 대신 **새 마이그레이션**(update/delete+insert)을 추가하세요.

## 데이터 구조 (문항 1개)
```json
{
  "id": "s05-p2-02", "label": "②", "type": "fill", "grading": "auto",
  "stem": [ {"t": "rich", "v": "$2\\dfrac{1}{4}-\\dfrac{3}{4}=$"}, {"t": "blank", "id": "b1"} ],
  "blanks": [ {"id": "b1", "kind": "rational", "answer": "3/2", "accept": ["1 1/2"]} ],
  "tags": ["frac_sub_mixed"]
}
```
- `stem`: 순서대로 그리면 됩니다. `rich`는 일반 텍스트 + `$…$` 인라인 수식 → KaTeX `renderMathInElement`(delimiter `$`). `blank`는 그 자리에 입력칸.
- 구조: 섹션(PDF 한 쪽) → 파트(PDF의 왼쪽/오른쪽 단) → 문항.
- `type`: `fill`(빈칸), `select_many`(보기 중 모두 고르기 — `choices`, 정답은 `blanks[0].answer`에 쉼표로), `free`(서술), `group`(제목만 있는 묶음 머리글).
- `grading`: `auto` 자동 / `manual` 교사 채점 / `mixed` 숫자는 자동, 식·설명은 교사.
- `blanks[].kind` → 채점 규칙(`assessment.grading_kinds`에도 있음):
  `int` · `rational`(값이 같으면 정답: 3/2 = 6/4 = 1 1/2) · `decimal`(25.31) · `set` · `ox`(O/X) · `compare`(<,>,=) · `expr`(식, `accept` 목록) · `text`(교사 채점, `model_answer` 참고).
- `parts[].timed: true` — PDF에 “____초” 칸이 있는 단. 그 단을 푸는 데 걸린 시간을 기록하세요(연산 훈련과 같은 방식).
- `teacher_note`(섹션) — PDF의 파란 “메모”. **교사 화면에만** 보여 주세요.
- `model_answer`, `review_note`, `blanks[].answer`는 **학생에게 제출 전 보내지 마세요.**

## 응답 저장(제안)
문항 데이터와 학생 응답은 분리합니다. 예: `assessment_attempts(id, student_id, assessment_id, started_at, finished_at)` + `assessment_responses(attempt_id, item_id, blank_id, given, correct, seconds)`. 채점은 서버에서 `kind`별 규칙으로.

## 변환 검증 결과
1. **숫자 대조** (`verify_numbers.py`): PDF 텍스트층에서 뽑은 숫자가 모두 변환본에 있음. 차이는 ① 세로셈(PDF가 `6 3`처럼 한 자리씩 찍음 — 자릿수 단위로는 일치) ② PDF에서 그림으로만 그려진 수식(10쪽 방정식 등 → 아래 3번에서 눈으로 확인).
2. **정답**: 모든 자동채점 답은 `build.py`에서 `Fraction`으로 계산(손으로 입력하지 않음). 방정식은 해를 다시 대입해 검산, 도형·응용문제는 assert로 확인.
3. **화면 대조**: `preview.html`을 브라우저로 렌더해 12개 섹션을 PDF 쪽과 나란히 비교 → 문항·순서·수식 모두 일치. KaTeX 오류 0건.
4. **DB 적재** (`verify_db.mjs`): schema+seed가 Postgres에 오류 없이 들어가고, 섹션 12 / 문항 129 / 답칸 170, 답 없는 자동채점 칸 0, 문항에 없는 답칸 0.

## 확인이 필요한 것 (데이터의 `review_note`, preview에서 빨간 글씨)
| 문항 | 내용 |
|---|---|
| 7. 3.③ `9−{−1/5+(−7²)−(−12)}` | `(−7²)` = −49로 읽음 → 답 231/5. `(−7)²`라면 −259/5 |
| 11. 4 각 x | 그림의 같은 길이 표시가 BD=BC=CD → x=24°. 흔한 유형(AB=BC=CD)이면 28° |
| 10. ① 이자 | 단리 39,000원으로 함. 복리면 39,930원 |
| 5. ⑥ 피자 “__조각” | 5조각으로 가정 → 3조각 |
| 6. ③ 달걀 한 판 | 30개로 가정 → 10개 |
| 4. 3 짝수·홀수 | a, b를 자연수로 가정 |
| 6. 응용 ② | PDF에 번호 없음 → ②로 붙임 |
| 12. 3-1) | PDF에 파란 예시 답이 적혀 있음 → 학생 화면에서는 숨기고 해설로 |
| 3. 4)·5) | 세로셈·장제법 그림을 입력칸 구조로 바꿈 → 웹에서 세로 배치로 그리기 권장 |

**PDF 자체의 번호 오류**(데이터는 바로잡고 원래 제목은 `pdf_title`에 보관): 4쪽 “연산 테스트 (2)”→(3), 5쪽 “(3)”→(4), 12쪽 “비와 비율 (1)”→(2), 11쪽 “2.”가 두 번 나옴(그대로 둠).

## 개인정보 — 변환하지 않은 것
- 원본 PDF에 들어 있던 **학생 개인정보는 모두 제외**했습니다: 2쪽 메모 중 특정 학생에 대한 평가 문장, 14쪽 학생 평가표의 내용(이름·학년·평가 내용·연락처 등). 학생 이름은 이 폴더의 어떤 파일에도 없습니다.
- 평가표는 **항목 이름만** `evaluation_template`에 있습니다. 실제 학생 값은 학생 기록(DB, RLS 적용)에만 저장하세요.
- 원본 PDF는 저장소에 올리지 마세요(`.gitignore`에 추가해 둠).

## 접근 권한 (RLS) — 화면 만들 때 꼭 지킬 것
`rls.sql` (= `supabase/migrations/20261005000800_assessment_rls.sql`). Load order: `schema.sql` → `rls.sql` → `seed.sql`.

| 누가 | 읽는 곳 | 보이는 것 |
|---|---|---|
| 비로그인(anon) | — | 없음 |
| 학생 등 로그인 사용자 | `assessment_items_student` 뷰 | 문제(stem·choices·그림)와 답칸의 `id`·`kind`만. **정답 없음** |
| 승인된 교사·원장, 관리자 | `assessment_items_staff`, `assessment_sections_staff` 뷰 | 정답·모범답안·검토 메모·교사용 메모 전부 |
| 관리자 | 테이블 직접 | 수정 가능 (다른 사람은 수정 불가) |

- 학생이 `assessment_items.blanks`·`model_answer`, `assessment_sections.teacher_note`를 직접 읽으면 `permission denied`가 납니다(의도된 동작).
- **채점은 서버에서** 서비스 권한으로 정답과 비교하세요. 정답을 브라우저로 보내지 마세요.
- 검증: `tests/unit/rls.test.ts`의 "진단 평가" 테스트 4개.
