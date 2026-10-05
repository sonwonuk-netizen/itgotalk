# 데이터 모델

스키마 원본: `db/schema.sql`. 시드: `content/*.csv`.

## 관계 요약
```
regions 1─* schools 1─* profiles(student)
organizations 1─* profiles(student/teacher)
profiles(student) 1─* guardians
skills 1─* item_sets 1─* items
profiles(student) 1─* attempts *─1 item_sets
profiles(student) 1─* skill_progress *─1 skills
profiles(student) 1─* reports
attempts 1─* comments
```

## 핵심 원칙
- **Attempt가 원천 데이터**다. `skill_progress`, `reports`는 Attempt에서 계산한 결과이며, 엔진 함수만 갱신한다.
- 콘텐츠는 과목 독립 구조다. 다른 과목을 추가할 때는 `skills.book`/`pattern` 값을 늘리고 `items.op`를 확장한다.
- 학생 이름은 `profiles.full_name`에 저장하지 않아도 된다(이니셜만으로 운영 가능).

## CSV → 테이블 매핑
| CSV | 테이블 | 비고 |
|---|---|---|
| `skills.csv` | `skills` | `order`→`ord`, `set_pages`(1\|2)로 `item_sets` 생성 |
| `items_addition_sum10.csv` | `item_sets`, `items` | `set_id` 기준 그룹. `answer`를 a,op,b,blank로 재계산해 검증 |
| `curriculum.csv` | (MVP 미사용) | 2차에서 `curriculum_weeks` 테이블로 |

## 문항 표시 규칙
| blank | 화면 표시 | 예 |
|---|---|---|
| `result` | `a op b = □` | 3 + 2 = □ |
| `operand2` | `a op □ = (a op b)` | 9 + □ = 10 |
