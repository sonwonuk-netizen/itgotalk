# 학습 엔진 명세

`src/lib/engine/`에 순수 함수로 구현한다. DB·UI 의존 금지. 아래 테스트 케이스를 Vitest로 그대로 옮긴다.

## 1. 개념
- **Skill(스킬)**: 진도 판정 단위. 예) `ADD_P2_COMM` (+2 교환법칙)
- **ItemSet(세트)**: 스킬에 속한 문항 묶음 = 원본 문서의 한 페이지 (p1, p2…)
- **Attempt(시도)**: 학생이 세트를 한 번 푼 기록. mode = `practice | test | diagnostic | race_ai`
- **SkillProgress**: 학생×스킬 상태. `locked | in_progress | passed`

## 2. 스킬 내부 패턴
각 수(+1~+5)는 `intro(도입) → intuition(직관) → commutative(교환법칙)` 순서이고, 마지막에 `complement10(10의 보수)`가 온다. 순서는 `content/skills.csv`의 `order` 컬럼이 정한다.

## 3. 세트 진행 규칙
```
state per (student, set):
  practice_count: int
  consecutive_fail: int

openTest(set) := practice_count >= 3

onAttemptFinished(attempt):
  if attempt.mode == practice:
      practice_count += 1
  if attempt.mode == test:
      if isPass(attempt):
          consecutive_fail = 0
          unlockNext(set)
      else:
          consecutive_fail += 1
          practice_count = 0          # 다시 연습 3회
          if consecutive_fail >= 3:
              assignReview(previousSkill(set.skill))
              notifyTeacher(student, set.skill)
              consecutive_fail = 0
```

## 4. 통과 판정
```
isPass(attempt, skill):
  allCorrect = attempt.correct_count == attempt.item_count
  if skill.time_rule == 'per_set':
      inTime = attempt.elapsed_ms <= skill.time_limit_sec * 1000
  else if skill.time_rule == 'per_item':
      inTime = attempt.elapsed_ms <= skill.time_limit_sec * 1000 * attempt.item_count
  return allCorrect and inTime
```
- `elapsed_ms`는 클라이언트 측정값을 쓰되, 서버 기록(`server_started_at`~`server_finished_at`)보다 1초 이상 짧으면 서버 값을 쓴다(조작 방지).

## 5. 다음 단계 열기
- 스킬 안에 다음 세트가 있으면 그 세트를 연다.
- 스킬의 마지막 세트를 통과하면 스킬 `passed`, 다음 order 스킬을 `in_progress`로.

## 6. 테스트 문항 생성
- 세트의 문항을 Fisher–Yates로 섞는다. 시드(seed)를 인자로 받아 테스트에서 재현 가능하게 한다.
- 같은 문제가 연속 두 번 나오지 않게 한다(교환법칙 쌍 2+3, 3+2는 다른 문제로 본다).

## 7. 진단 테스트
- 스킬 order 순으로 각 스킬 대표 세트 1개를 test 모드로 출제(연습 없음).
- 처음 isPass=false인 스킬을 시작 스킬로 지정. 그 이전 스킬은 모두 `passed`.
- 전부 통과하면 마지막 다음 스킬부터 시작.

## 8. 리포트 문장 생성
기간 내 스킬별로 첫 test Attempt와 마지막 test Attempt를 비교한다.
```
"{skill.name}: {M/D} {n}문항 {s}초 → {M/D} {n}문항 {s}초, {결과}"
결과 = passed ? "다음 단계 진행" : "추가 연습 진행"
```
기간 내 시도가 1회뿐이면 `"{skill.name}: {M/D} {n}문항 {s}초, {결과}"`.

## 9. 테스트 케이스 (필수)
| # | 상황 | 기대 결과 |
|---|---|---|
| T1 | 5문항 모두 정답, 11.9초, per_set 12초 | pass |
| T2 | 5문항 모두 정답, 12.0초 | pass (경계 포함) |
| T3 | 5문항 모두 정답, 12.1초 | fail |
| T4 | 4/5 정답, 8초 | fail |
| T5 | 연습 2회 후 테스트 요청 | 거부 |
| T6 | 테스트 3회 연속 실패 | 직전 스킬 복습 배정 + 교사 알림, 카운터 0 |
| T7 | 실패 2회 후 통과 | consecutive_fail = 0, 다음 세트 열림 |
| T8 | 스킬 마지막 세트 통과 | 스킬 passed, 다음 스킬 in_progress |
| T9 | 클라이언트 6초, 서버 10초 | 서버 값(10초)으로 판정 |
| T10 | per_item, 2초×7문항, 13.5초 | pass |
| T11 | 같은 seed로 셔플 2회 | 동일 순서 |
| T12 | 리포트: 9/27 18초 실패, 10/4 11초 통과 | "… 9/27 10문항 18초 → 10/4 10문항 11초, 다음 단계 진행" |
