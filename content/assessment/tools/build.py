"""
읽고 말하는 수학 4~7학년 진단 평가 — source of truth for the converted PDF.

    py content/assessment/tools/build.py

writes (next to this folder):
    assessment_4-7.json   items for the web / DB (stem segments + blanks + answers)
    seed.sql              rows for schema.sql (Postgres / Supabase)
    preview.html          static render (KaTeX) used to check the conversion against the PDF

Stem format: list of segments
    {"t": "rich", "v": "text with $latex$"}   — render with KaTeX auto-render ($…$ inline)
    {"t": "blank", "id": "b1"}                — an answer input
Answers are computed here (Fraction), never typed by hand, so a typo in a stem
shows up as a wrong answer in the side-by-side check rather than going unnoticed.
"""
from __future__ import annotations

import json
import math
import re
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩"


# ── helpers ────────────────────────────────────────────────────────────────
def fmt(v) -> str:
    """Canonical answer string: ints as-is, fractions as a/b (negative sign in front)."""
    if isinstance(v, F):
        if v.denominator == 1:
            return str(v.numerator)
        return f"{v.numerator}/{v.denominator}"
    if isinstance(v, float):
        return f"{v:.10g}"
    return str(v)


def mixed(v: F) -> str:
    """5/2 → '2 1/2' (display alternative accepted for proper grading)."""
    if v.denominator == 1 or abs(v) < 1:
        return fmt(v)
    w = int(v)  # toward zero
    r = abs(v - w)
    return f"{w} {r.numerator}/{r.denominator}"


def segs(spec: str) -> list[dict]:
    """'$15 \\times$ [[b1]] $= 60$' → rich/blank segments."""
    out = []
    for i, part in enumerate(re.split(r"\[\[(\w+)\]\]", spec)):
        if i % 2:
            out.append({"t": "blank", "id": part})
        elif part.strip():
            out.append({"t": "rich", "v": part.strip()})
    return out


def decimal_str(v: F) -> str:
    """Exact decimal for terminating fractions: 2531/100 → '25.31'."""
    d = v.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    assert d == 1, f"{v} is not a terminating decimal"
    s = f"{float(v):.10f}".rstrip("0").rstrip(".")
    assert F(s) == v
    return s


def blank(bid, answer, kind="int", accept=None, **extra):
    if kind == "decimal" and isinstance(answer, (F, int)):
        answer = decimal_str(F(answer))
    b = {"id": bid, "kind": kind, "answer": fmt(answer)}
    acc = set(accept or [])
    if isinstance(answer, F) and answer.denominator != 1:
        acc.add(mixed(answer))
    if acc - {b["answer"]}:
        b["accept"] = sorted(acc - {b["answer"]})
    b.update(extra)
    return b


def item(label, stem, blanks=(), *, type_="fill", grading="auto", choices=None, model=None, figure=None, note=None, tags=()):
    it = {"label": label, "type": type_, "stem": segs(stem) if isinstance(stem, str) else stem,
          "blanks": list(blanks), "grading": grading}
    if choices is not None:
        it["choices"] = choices
    if model is not None:
        it["model_answer"] = model
    if figure:
        it["figure"] = figure
    if note:
        it["review_note"] = note
    if tags:
        it["tags"] = list(tags)
    return it


def lx(n):  # LaTeX-safe number
    return str(n)


# ── content ────────────────────────────────────────────────────────────────
sections = []


def section(no, title, page, parts, teacher_note=None, pdf_title=None):
    s = {"no": no, "title": title, "pdf_page": page, "parts": parts}
    if teacher_note:
        s["teacher_note"] = teacher_note
    if pdf_title and pdf_title != title:
        s["pdf_title"] = pdf_title  # as printed in the PDF (kept for traceability)
    sections.append(s)


def part(title, items, timed=False):
    p = {"title": title, "items": items}
    if timed:
        p["timed"] = True  # PDF shows "____초": record the seconds taken for the column
    return p


def add_rows(pairs, tag):
    # one input box per digit of the answer (연산 테스트 덧셈)
    return [item(CIRCLED[i], f"${a} + {b} =$ [[b1]]", [blank("b1", a + b, digits=len(str(a + b)))], tags=[tag]) for i, (a, b) in enumerate(pairs)]


def missing_add_rows(pairs, tag):
    return [item(CIRCLED[i], f"${a} + ($ [[b1]] $) = {t}$", [blank("b1", t - a)], tags=[tag]) for i, (a, t) in enumerate(pairs)]


def missing_mul_rows(pairs, tag):
    out = []
    for i, (a, t) in enumerate(pairs):
        assert t % a == 0, (a, t)
        out.append(item(CIRCLED[i], f"${a} \\times ($ [[b1]] $) = {t}$", [blank("b1", t // a)], tags=[tag]))
    return out


# 1. 연산 테스트 (1) — p.2
section(1, "연산 테스트 (1)", 2, [
    part("받아올림 있는 2위+1위 덧셈", add_rows([(15, 4), (22, 7), (59, 9), (32, 6), (24, 6), (22, 9), (19, 8), (36, 8), (28, 7), (27, 6)], "add_2d1d"), timed=True),
    part("덧셈 가역 (□ 구하기)", missing_add_rows([(4, 11), (5, 13), (8, 17), (5, 14), (7, 15), (8, 14), (7, 15), (3, 12), (9, 16), (8, 17)], "add_inverse_1d"), timed=True),
], teacher_note="27+6= 과 같은 받아 올림이 있는 2위+1위 테스트의 목적은 덧셈의 직관에 관한 내용을 테스트하는 과정입니다.")

# 2. 연산 테스트 (2) — p.3
section(2, "연산 테스트 (2)", 3, [
    part("2위+2위 덧셈", add_rows([(57, 25), (25, 57), (27, 49), (76, 18), (45, 17), (49, 49), (58, 39), (36, 27), (78, 24), (36, 69)], "add_2d2d"), timed=True),
    part("덧셈 가역 (형식은 덧셈, 내용은 뺄셈)", missing_add_rows([(23, 31), (87, 92), (78, 85), (56, 65), (67, 74), (37, 46), (64, 72), (28, 34), (86, 93), (67, 75)], "add_inverse_2d"), timed=True),
], teacher_note="앞 페이지와 같은 내용입니다. 67 + ( )=75는 형식은 덧셈, 내용은 뺄셈으로 이 과정의 평가로 기본 연산에 대해 평가합니다.")

# 3. 연산 테스트 (3) — p.4  (PDF prints "(2)": duplicate numbering)
sec3_right = [
    item("1)", "$\\begin{array}{r} 63 \\\\ \\times\\;\\;\\, 7 \\\\ \\hline \\end{array}$ [[b1]]", [blank("b1", 63 * 7)], tags=["mul_vertical"]),
    item("2)", "$\\begin{array}{r} 63 \\\\ \\times\\; 57 \\\\ \\hline \\end{array}$ [[b1]]", [blank("b1", 63 * 57)], tags=["mul_vertical"]),
    item("3)", "다음식의 ( )에 알맞은 수를 쓰시오. $219 \\times 7 = ($ [[b1]] $) \\times 7 + ($ [[b2]] $) \\times 7 + ($ [[b3]] $) \\times 7$",
         [blank("b1", 200), blank("b2", 10), blank("b3", 9)], tags=["mul_distributive"]),
    item("4)", "다음 곱셈을 완성하시오. $\\begin{array}{r} 219 \\\\ \\times\\;\\;\\;\\, 7 \\\\ \\hline \\end{array}$ "
               "[[p1]] $= ($ [[m1]] $) \\times 7$, [[p2]] $= ($ [[m2]] $) \\times 7$, [[p3]] $= ($ [[m3]] $) \\times 7$, 합 [[sum]]",
         [blank("p1", 1400), blank("m1", 200), blank("p2", 70), blank("m2", 10), blank("p3", 63), blank("m3", 9), blank("sum", 219 * 7)],
         note="PDF는 세로셈 칸(부분곱 3칸 + 합) 그림입니다. 웹에서는 세로 배치(부분곱 입력칸을 자릿수에 맞춰 오른쪽 정렬)로 그리는 것을 권장합니다.",
         tags=["mul_partial_products"]),
    item("5)", "다음을 계산하고 검산하시오. $63 \\div 4 =$ 몫 [[q]] 나머지 [[r]] / 검산: $4 \\times ($ [[c1]] $) + ($ [[c2]] $) = 63$",
         [blank("q", 63 // 4), blank("r", 63 % 4), blank("c1", 63 // 4), blank("c2", 63 % 4)],
         note="PDF는 장제법 기호 4)63 와 '검산: ____' 입니다. 검산 칸을 식으로 구조화했습니다.", tags=["div_remainder"]),
]
section(3, "연산 테스트 (3)", 4, [
    part("곱셈의 가역", missing_mul_rows([(15, 60), (15, 90), (18, 36), (18, 126), (17, 51), (17, 85), (16, 32), (16, 112), (14, 28), (14, 98)], "mul_inverse_2d1d")),
    part("곱셈과 나눗셈", sec3_right),
], pdf_title="연산 테스트 (2)",
    teacher_note="14×( ) = 28과 14×( )=98은 곱의 끝자리 수가 같은 연산 법칙을 확인하는 과정입니다. "
                 "14×( )곱의 끝자리 8인 경우는 4×2와 4×7입니다. 4×7=4×(5+2)=4×5+4×2 "
                 "짝수의 곱은 이렇게 끝자리의 수가 ×1과 ×6이 같고, ×2와 ×7, ×3과 ×8, ×4와 ×9의 끝자리의 수가 같음을 알 수 있습니다. "
                 "모두 곱셈의 합과 차의 법칙을 통해 규칙을 찾을 수 있습니다. 이는 3의 배수, 9의 배수 판정법을 학습하는 기초가 됩니다.")

# 4. 연산 테스트 (4) — p.5  (PDF prints "(3)")
mult3 = [10101, 304, 8040, 98, 136, 201]
mult45 = [3105, 305, 2040, 999, 126, 3060, 1710, 215, 1440, 225]
parity = [("2\\times 8", True), ("2\\times a", True), ("2\\times 5-1", False), ("2\\times a-1", False), ("2\\times 9+2", True), ("2\\times b+1", False)]
assert all((2 * 8) % 2 == 0 for _ in [0]) and (2 * 5 - 1) % 2 == 1 and (2 * 9 + 2) % 2 == 0
section(4, "연산 테스트 (4)", 5, [
    part("곱셈의 가역", missing_mul_rows([(56, 392), (35, 175), (68, 612), (76, 228), (48, 240), (59, 413), (37, 333), (83, 581), (92, 276), (43, 344)], "mul_inverse_2d1d_3d")),
    part("짝수, 홀수, 배수", [
        item("1.", "다음에서 3의 배수를 찾아 ○표 하세요.", type_="select_many",
             choices=[str(n) for n in mult3], blanks=[blank("sel", ",".join(str(n) for n in mult3 if n % 3 == 0), kind="set")], tags=["multiple_of_3"]),
        item("2.", "다음에서 9의 배수이며 동시에 5의 배수를 찾아 ○표 하세요.", type_="select_many",
             choices=[str(n) for n in mult45], blanks=[blank("sel", ",".join(str(n) for n in mult45 if n % 45 == 0), kind="set")], tags=["multiple_of_9_and_5"]),
        item("3.", [{"t": "rich", "v": "다음에서 “짝수” ○표, “홀수”이면 ×표를 하시오. ($a, b$는 자연수)"}] +
             [seg for i, (e, _) in enumerate(parity) for seg in ({"t": "rich", "v": f"{CIRCLED[i]} ${e}$"}, {"t": "blank", "id": f"b{i+1}"})],
             [blank(f"b{i+1}", "O" if even else "X", kind="ox") for i, (_, even) in enumerate(parity)],
             note="②④⑥의 a, b는 PDF에 조건이 없어 '자연수'로 가정했습니다.", tags=["even_odd"]),
    ]),
], pdf_title="연산 테스트 (3)",
    teacher_note="어떤 수×2는 2의 배수, 2의 배수 + 2의 배수=2의 배수⇒2×a+2×b=2×(a+b) "
                 "같은 연산 법칙으로 3의 배수+ 3의 배수=3의 배수⇒3×a+3×b=3×(a+b) "
                 "이러한 규칙으로 자연수의 각 자리 숫자의 합이 3의 배수가 되면 3의 배수, 각 자리 숫자의 배수가 9의 배수가 되면 그 수는 9의 배수가 되는 법칙을 이해하면 큰 수의 연산도 쉽게 할 수 있습니다.")

# 5. 공배수, 공약수, 분수 — p.6
eq23 = [(3, 5), (4, 6), (9, 15), (16, 24), (22, 33)]
section(5, "공배수, 공약수, 분수", 6, [
    part("공배수와 공약수", [
        item("1.", "24와 28의 최대공약수를 구하시오. (나눗셈 사다리: $\\big)\\,24\\quad 28$) [[b1]]", [blank("b1", math.gcd(24, 28))], tags=["gcd"]),
        item("2.", "24와 28의 최소공배수를 구하시오. (나눗셈 사다리: $\\big)\\,24\\quad 28$) [[b1]]", [blank("b1", math.lcm(24, 28))], tags=["lcm"]),
    ]),
    part("분수", [
        item("①", "$\\dfrac{5}{6}-\\dfrac{1}{3}=$ [[b1]]", [blank("b1", F(5, 6) - F(1, 3), kind="rational")], tags=["frac_sub"]),
        item("②", "$2\\dfrac{1}{4}-\\dfrac{3}{4}=$ [[b1]]", [blank("b1", F(9, 4) - F(3, 4), kind="rational")], tags=["frac_sub_mixed"]),
        item("③", "$\\dfrac{3}{5}$의 단위분수를 쓰시오. [[b1]]", [blank("b1", F(1, 5), kind="rational")], tags=["unit_fraction"]),
        item("④", "$1-\\dfrac{1}{3}=$ [[b1]]", [blank("b1", 1 - F(1, 3), kind="rational")], tags=["frac_sub"]),
        item("⑤", "$2\\dfrac{1}{3}-\\dfrac{1}{2}=$ [[b1]]", [blank("b1", F(7, 3) - F(1, 2), kind="rational")], tags=["frac_sub_mixed"]),
        item("⑥", "피자 한 판의 $\\dfrac{2}{5}$만큼 먹었다. 먹고 남은 피자는 얼마인가? [[b1]] 판, [[b2]] 조각",
             [blank("b1", 1 - F(2, 5), kind="rational"), blank("b2", 3)],
             note="'조각' 답(3)은 피자를 5조각으로 나눴다고 가정한 값입니다. PDF에 조각 수 조건이 없어 확인이 필요합니다.", tags=["frac_word"]),
        item("⑦", "$\\dfrac{2}{3}$와 크기가 같은 분수를 모두 고르시오.", type_="select_many",
             choices=[f"{n}/{d}" for n, d in eq23],
             blanks=[blank("sel", ",".join(f"{n}/{d}" for n, d in eq23 if F(n, d) == F(2, 3)), kind="set")], tags=["equivalent_fraction"]),
    ]),
], teacher_note="본 테스트 과정에는 없는 내용으로 중1 과정에서 학습하는 거듭제곱을 “읽고 말하는 수학” 에서는 2권에서 학습합니다. "
                "자연수의 짝수와 배수, 소수와 합성수, 약수와 인수 등 개념을 정확하게 학습하게 되면 수학이라는 학문의 부분과 전체를 이해하는 데 도움이 됩니다.")

# 6. 연산 법칙과 응용문제 — p.7
section(6, "연산 법칙과 응용문제", 7, [
    part("법칙적 계산", [
        item("①", "$36\\times 12-36\\times 2 = 36\\times($ [[b1]] $)$", [blank("b1", 12 - 2)], tags=["distributive"]),
        item("②", "$251\\times 3+251\\times 7=251\\times($ [[b1]] $+$ [[b2]] $)$", [blank("b1", 3), blank("b2", 7)], tags=["distributive"]),
        item("③", "$2519\\times 99=2519\\times($ [[b1]] $)-2519$", [blank("b1", 100)], tags=["distributive"]),
        item("④", "$3+5\\times 2-3 =$ [[b1]]", [blank("b1", 3 + 5 * 2 - 3)], tags=["order_of_operations"]),
        item("⑤", "$3+6\\times 2-(8+4) =$ [[b1]]", [blank("b1", 3 + 6 * 2 - (8 + 4))], tags=["order_of_operations"]),
        item("⑥", "$3+3+3+3+3=3\\times($ [[b1]] $)$ / $☆+☆+☆+☆+☆=☆\\times($ [[b2]] $)$ / $a+a+a+a=a\\times($ [[b3]] $)$ / $25\\times 4+25+25=25\\times($ [[b4]] $)$",
             [blank("b1", 5), blank("b2", 5), blank("b3", 4), blank("b4", 4 + 1 + 1)], tags=["repeated_addition"]),
        item("⑦", "$a\\times 3=\\color{red}{3a}$ 이면 ($a\\times 3$은 $a$가 셋.) / $3a+3a=$ [[b1]] / $3a-2a=$ [[b2]]",
             [blank("b1", "6a", kind="expr", accept=["6*a", "6×a"]), blank("b2", "a", kind="expr", accept=["1a"])], tags=["like_terms"]),
    ]),
    part("응용문제", [
        item("①", "다음을 계산하고 구하는 방법을 설명하시오. $\\dfrac{1}{4}\\times\\dfrac{1}{3}=$ [[b1]] / 설명: [[ex]]",
             [blank("b1", F(1, 4) * F(1, 3), kind="rational"), blank("ex", "", kind="text")], grading="mixed",
             model="분자끼리, 분모끼리 곱합니다. 1/4의 1/3은 한 칸을 다시 3등분한 것이라 전체의 1/12입니다.", tags=["frac_mul"]),
        item("②", "$\\dfrac{1}{4}\\div\\dfrac{1}{3}=$ [[b1]] / 설명: [[ex]]",
             [blank("b1", F(1, 4) / F(1, 3), kind="rational"), blank("ex", "", kind="text")], grading="mixed",
             model="나누는 수의 역수를 곱합니다: 1/4 × 3/1 = 3/4. (1/3이 1/4 안에 3/4번 들어감)",
             note="PDF에는 번호가 ①만 있고 두 번째 문항은 번호가 없습니다. ②로 붙였습니다.", tags=["frac_div"]),
        item("③", "달걀 한 판의 $\\dfrac{2}{3}$을 먹었다. 먹고 남은 달걀 수를 구하시오. 식: [[expr]] 답: [[b1]] 개",
             [blank("expr", "30×(1-2/3)", kind="text"), blank("b1", 30 * (1 - F(2, 3)))], grading="mixed",
             model="30 × (1 − 2/3) = 10 (개)", note="달걀 한 판 = 30개로 가정했습니다(문제에 개수 없음).", tags=["frac_word"]),
        item("④", "사과 한 상자의 $\\dfrac{2}{3}$를 먹었다. 먹고 남은 양을 분수로 나타내시오. [[b1]]",
             [blank("b1", 1 - F(2, 3), kind="rational")], tags=["frac_word"]),
    ]),
], teacher_note="법칙적 연산을 인지 여부를 확인하는 테스트 페이지입니다. "
                "곱셈과 나눗셈을 기계적인 연산이 아닌 234×5는 234가 다섯이라는 개념의 인지 여부를 확인합니다. "
                "분수의 곱셈은 왜 “분자끼리 곱하고 분모끼리 곱하는” 원리의 이해 여부를 확인하는 페이지입니다. 분수의 나눗셈은 왜 역수로 곱하는지 등을 테스트합니다. "
                "분수 나머지 비율의 이해. 사과를 2/5의 나머지를 구체적인 것과 형식적인 내용을 모두 인지하는지를 확인합니다.")

# 7. 소수와 절댓값 — p.8
cmp = lambda x, y: "<" if x < y else ">" if x > y else "="
pairs7 = [(-5, 7), (-5, 1), (-8, 6), (-8, 10)]
cmp_items = []
for i, (x, y) in enumerate(pairs7):
    cmp_items.append(item(CIRCLED[i], f"${x}$ [[b1]] $+{y}$ / $|{x}|$ [[b2]] $|+{y}|$",
                          [blank("b1", cmp(x, y), kind="compare"), blank("b2", cmp(abs(x), abs(y)), kind="compare")], tags=["abs_compare"]))
expr3 = F(9) - (F(-1, 5) + (-(7 ** 2)) - (-12))
section(7, "소수와 절댓값", 8, [
    part("소수", [
        item("①", "다음 소수를 읽으시오. $34.1107$: [[b1]]", [blank("b1", "삼십사 점 일일영칠", kind="text", accept=["삼십사점일일영칠"])], tags=["decimal_read"]),
        item("②", "다음을 계산하시오. $25.12+0.19=$ [[b1]] / $25.12-0.19=$ [[b2]] / $0.1\\times 0.1=$ [[b3]] / $3.14\\times 99+3.14=$ [[b4]] / $0.1\\div 0.1=$ [[b5]]",
             [blank("b1", F("25.12") + F("0.19"), kind="decimal"), blank("b2", F("25.12") - F("0.19"), kind="decimal"),
              blank("b3", F("0.1") * F("0.1"), kind="decimal"), blank("b4", F("3.14") * 99 + F("3.14"), kind="decimal"),
              blank("b5", F("0.1") / F("0.1"), kind="decimal")], tags=["decimal_calc"]),
        item("③", "다음 소수를 분수로 나타내시오. $0.125 =$ [[b1]]", [blank("b1", F("0.125"), kind="rational")], tags=["decimal_to_fraction"]),
        item("④", "시간의 분 단위 45분을 시 단위로 바꿔 분수와 소수로 나타내시오. 분수: [[b1]] 시간 / 소수: [[b2]] 시간",
             [blank("b1", F(45, 60), kind="rational"), blank("b2", F(45, 60), kind="decimal")], tags=["time_fraction"]),
    ]),
    part("절댓값", [
        item("1.", "“절댓값”을 설명하시오. [[ex]]", [blank("ex", "", kind="text")], type_="free", grading="manual",
             model="수직선에서 0으로부터 그 수까지의 거리. 부호를 뗀 크기이며 항상 0 이상입니다.", tags=["abs_concept"]),
        item("2.", "다음 두 수의 크기와 절댓값의 크기를 비교하세요. (○ 안에 >, =, <)", [], type_="group", grading="auto", tags=["abs_compare"]),
        *cmp_items,
        item("3.①", "$+4-(-5)=$ [[b1]]", [blank("b1", 4 - (-5))], tags=["integer_calc"]),
        item("3.②", "$(-3)-(+2)+(-3)=$ [[b1]]", [blank("b1", (-3) - 2 + (-3))], tags=["integer_calc"]),
        item("3.③", "$9-\\left\\{-\\dfrac{1}{5}+(-7^{2})-(-12)\\right\\} =$ [[b1]]", [blank("b1", expr3, kind="rational", accept=["46.2"])],
             note="(-7²)는 7에만 지수가 붙은 표기(= -49)로 읽었습니다. (-7)²(=49)를 의도했다면 답은 -259/5 입니다.", tags=["integer_calc"]),
    ]),
])

# 8. 문자와 식 (1) — p.9
ox9 = [("a<0", "a", "양수", False), ("a<0", "-a", "양수", True), ("a>0", "a", "양수", True), ("a>0", "-a", "양수", False),
       ("a<0", "|a|=-a 이면 -a", "양수", True), ("a<0", "|a|=-a 이면 -a", "음수", False)]
a9, b9 = F(-1, 6), F(-2, 3)
ox_items = []
for i, (cond, what, sign, ok) in enumerate(ox9):
    if "|a|" in what:
        body = f"${cond}$고 $|a|=-a$ 이면 $-a$는 {sign}{'이다' if sign == '음수' else ''}."
    else:
        body = f"${cond}$일 때 ${what}$ 는 {sign}."
    ox_items.append(item(CIRCLED[i], f"{body} ( [[b1]] )", [blank("b1", "O" if ok else "X", kind="ox")], tags=["sign_reasoning"]))
section(8, "문자와 식 (1)", 9, [
    part("1. 다음 문제에서 ( )에 맞으면 ○표 틀리면 ×표를 하시오.", ox_items),
    part("2. $a=\\left(-\\dfrac{1}{6}\\right),\\ b=\\left(-\\dfrac{2}{3}\\right)$일 때 다음을 계산하시오.", [
        item("①", "$2a=$ [[b1]]", [blank("b1", 2 * a9, kind="rational")], tags=["substitution"]),
        item("②", "$-\\dfrac{5}{6}b=$ [[b1]]", [blank("b1", F(-5, 6) * b9, kind="rational")], tags=["substitution"]),
    ]),
])


# 9. 문자와 식 (2) — p.10: solve linear equations exactly
def solve_linear(lhs, rhs):
    """lhs/rhs: functions of x returning Fraction; solve lhs(x)=rhs(x) (linear)."""
    f0 = lhs(F(0)) - rhs(F(0))
    f1 = lhs(F(1)) - rhs(F(1))
    x = -f0 / (f1 - f0)
    assert lhs(x) == rhs(x)
    return x


eqs = [
    ("①", "3x-2 = 12+4x", lambda x: 3 * x - 2, lambda x: 12 + 4 * x),
    ("②", "5(2-2x) = -5x+15", lambda x: 5 * (2 - 2 * x), lambda x: -5 * x + 15),
    ("③", "\\dfrac{x-2}{6}-\\dfrac{2x-1}{3} = \\dfrac{3}{2}", lambda x: (x - 2) / 6 - (2 * x - 1) / 3, lambda x: F(3, 2)),
    ("④", "\\dfrac{1}{3}x-0.5(x-1) = 2-\\dfrac{1-3x}{2}", lambda x: F(1, 3) * x - F(1, 2) * (x - 1), lambda x: 2 - (1 - 3 * x) / 2),
]
section(9, "문자와 식 (2)", 10, [
    part("다음 방정식의 해를 구하여라.", [
        item(lbl, f"${tex}$ / $x=$ [[b1]]", [blank("b1", solve_linear(l, r), kind="rational")], tags=["linear_equation"]) for lbl, tex, l, r in eqs
    ]),
])

# 10. 비와 비율 (1) — p.11  (PDF numbers the 4th block "2." again)
section(10, "비와 비율 (1)", 11, [
    part("비와 비율", [
        item("1.", "다음 비의 기준량과 비교량을 쓰시오. $4 : 8 \\rightarrow$ 기준량: [[b1]] 비교량: [[b2]]", [blank("b1", 8), blank("b2", 4)], tags=["ratio_terms"]),
        item("2.", "비의 값을 설명하시오. 설명: [[ex]]", [blank("ex", "", kind="text")], type_="free", grading="manual",
             model="비교하는 양을 기준량으로 나눈 값(비교하는 양 ÷ 기준량). 예) 4:8의 비의 값은 4/8 = 1/2.", tags=["ratio_value"]),
        item("3.①", "다음 비의 값을 백분율로 나타내시오. $\\dfrac{7}{5} =$ [[b1]] $\\%$", [blank("b1", F(7, 5) * 100, kind="decimal")], tags=["percent"]),
        item("3.②", "$1 : 8 =$ [[b1]] $\\%$", [blank("b1", F(1, 8) * 100, kind="decimal")], tags=["percent"]),
    ]),
    part("2. 다음을 계산하여라", [  # PDF numbers this block "2." a second time
        item("①", "30,000원을 1년에 10%의 이율로 이자를 받기로 하고 3년간 예금하면 3년 후 받을 금액은 얼마인가? [[b1]] 원",
             [blank("b1", 30000 + 30000 * F(1, 10) * 3)],
             note="단리로 계산(39,000원)했습니다. 복리로 의도했다면 39,930원입니다. 학년(초6 비율)상 단리가 자연스럽지만 확인이 필요합니다.", tags=["interest"]),
        item("②", "농도 20%의 소금물 250g에는 소금이 몇 g 녹아있는가? [[b1]] g", [blank("b1", 250 * F(20, 100))], tags=["concentration"]),
    ]),
], pdf_title="비와 비율 (1)")

# 11. 비와 비율 (2) — p.12  (PDF prints "(1)" again)
R = F(10, 2)  # big semicircle radius: diameter 4+2+4
perim_pi = R + F(4, 2) + F(1) + F(4, 2)  # half-circumferences / π: π·r each
area_pi = R ** 2 / 2 - (F(2) ** 2 / 2 + F(1) ** 2 / 2 + F(2) ** 2 / 2)
sides = [F(36) * k / 12 for k in (5, 4, 3)]
ab = (F(3, 14) / F(1, 4))  # a/b
section(11, "비와 비율 (2)", 12, [
    part("도형과 비", [
        item("1.", "세 변의 길이의 비가 5:4:3인 직각삼각형의 둘레가 36㎝일 때, 이 삼각형의 넓이를 구하시오. [[b1]] ㎠",
             [blank("b1", sides[1] * sides[2] / 2)], figure="figures/s11-q1-triangle.svg", tags=["ratio_geometry"]),
        item("2.", "$\\dfrac{1}{4}a = \\dfrac{3}{14}b$일 때 $a$와 $b$를 가장 작은 자연수의 비를 구하시오. $a : b =$ [[b1]] $:$ [[b2]]",
             [blank("b1", ab.numerator), blank("b2", ab.denominator)], tags=["ratio_simplest"]),
        item("3.", "다음 색칠한 부분의 둘레와 넓이를 구하는 식을 쓰시오. 둘레: [[b1]] ㎝ / 넓이: [[b2]] ㎠",
             [blank("b1", f"{fmt(perim_pi)}π", kind="expr", accept=[f"{float(perim_pi * F('3.14')):g}", "10*π", "10pi"]),
              blank("b2", f"{fmt(area_pi)}π", kind="expr", accept=[f"{float(area_pi * F('3.14')):g}", "8*π", "8pi"])],
             grading="mixed", figure="figures/s11-q3-semicircles.svg",
             model="둘레 = (10×π÷2) + (4×π÷2) + (2×π÷2) + (4×π÷2) = 10π (π=3.14이면 31.4㎝). "
                   "넓이 = (5×5×π÷2) − (2×2×π÷2 + 1×1×π÷2 + 2×2×π÷2) = 8π (π=3.14이면 25.12㎠).",
             note="'식을 쓰시오'라 채점은 식 확인(수동)을 권장합니다. 숫자 답은 참고용입니다.", tags=["circle_area_perimeter"]),
        item("4.", "다음 도형에서 $\\angle x$의 값을 구하시오. [[b1]] °",
             [blank("b1", 24)], figure="figures/s11-q4-angle.svg",
             note="그림의 같은 길이 표시가 BD=BC=CD(정삼각형)라서 ∠BCD=60°, ∠ACB=180−84−60=36°, ∠ABC=120°, x=24°입니다. "
                  "교과서의 흔한 유형(AB=BC=CD, 외각 84°)이라면 x=28°이므로 그림 의도를 확인해 주세요.", tags=["angle_isosceles"]),
    ]),
], pdf_title="비와 비율 (1)")
assert sum(sides) == 36 and sides[1] ** 2 + sides[2] ** 2 == sides[0] ** 2
assert (180 - 84 - 60) == 36 and 180 - 120 - 36 == 24

# 12. 응용문제 및 평가 — p.13
section(12, "응용문제 및 평가", 13, [
    part("1. 다항식의 합과 차. $A=2x+2y,\\ B=-2x-3y$ 일 때 다음을 계산하시오.", [
        item("①", "$A+B=$ [[b1]]", [blank("b1", "-y", kind="expr", accept=["-1y", "0x-y"])], tags=["polynomial"]),
        item("②", "$A-B=$ [[b1]]", [blank("b1", "4x+5y", kind="expr", accept=["5y+4x"])], tags=["polynomial"]),
    ]),
    part("2. 다음을 계산하시오.", [
        item("①", "$(a+b)^{2}=$ [[b1]]", [blank("b1", "a^2+2ab+b^2", kind="expr", accept=["a²+2ab+b²"])], tags=["expansion"]),
        item("②", "$\\dfrac{1}{(a+b)}+\\dfrac{1}{(a-b)}=$ [[b1]]", [blank("b1", "2a/(a^2-b^2)", kind="expr", accept=["2a/((a+b)(a-b))", "2a/(a²-b²)"])], tags=["rational_expression"]),
    ]),
    part("3. 다음 해를 구하는 식을 쓰시오.", [
        item("1)", "연속하는 세 짝수의 합이 42일 때, 이 세 짝수를 구하는 식을 쓰시오. 식: [[expr]] 세 짝수: [[b1]], [[b2]], [[b3]]",
             [blank("expr", "", kind="text"), blank("b1", 12), blank("b2", 14), blank("b3", 16)], grading="mixed",
             model="연속하는 세 짝수의 합은 x−2, x, x+2, 연속하는 세 짝수를 구하는 식은 x−2+x+x+2=42 ⇒ 3x=42 ⇒ x=14",
             note="PDF에 파란 글씨로 예시 답이 적혀 있습니다(교사용 예시). 학생 화면에는 숨기고 해설로 쓰는 것을 권장합니다.", tags=["linear_word"]),
        item("2)", "어느 농장에서 오리와 염소를 합해 20마리를 기르는데 다리를 세어보니 다리의 합이 54개이다. 이 농장에서 기르는 염소와 오리는 각각 몇 마리인가? 식: [[expr]] 염소: [[b1]] 마리, 오리: [[b2]] 마리",
             [blank("expr", "", kind="text"), blank("b1", 7), blank("b2", 13)], grading="mixed",
             model="오리를 x마리라 하면 2x + 4(20−x) = 54 ⇒ x = 13. 오리 13마리, 염소 7마리", tags=["linear_word"]),
    ]),
])
assert 2 * 13 + 4 * 7 == 54 and 13 + 7 == 20 and 12 + 14 + 16 == 42

assessment = {
    "id": "rsm-4-7-diagnostic-2026-08",
    "title": "읽고 말하는 수학",
    "subtitle": "4~7학년 테스트 (진단 평가)",
    "publisher": "책을 쓰는 아이들",
    "source": {"file": "평가 지도안 (2026-08-14).pdf", "pages": 14, "converted": "2026-10-05",
               "excluded": "학생 개인정보(학생 평가 문장, 학생 평가표)는 문항 데이터에서 제외했습니다."},
    "grading_kinds": {
        "int": "정수. 공백·쉼표 제거 후 비교",
        "rational": "분수/정수. 값이 같으면 정답(약분 전·대분수·소수 허용 여부는 교사 설정)",
        "decimal": "소수. 값 비교(25.31 = 25.310)",
        "set": "선택형. 정답 집합과 정확히 일치",
        "ox": "O/X",
        "compare": "<, >, =",
        "expr": "식. accept 목록과 공백 무시 비교, 애매하면 교사 확인",
        "text": "서술/식 쓰기. 교사 채점(model_answer 참고)",
    },
    "evaluation_template": {
        "title": "4~7학년 테스트",
        "fields": ["이름", "학년", "진도", "학교명", "관리 교사", "평가 내용", "학습 과정: 수 개념", "학습 과정: 연산"],
        "note": "PDF p.14 평가표의 항목만 옮겼습니다. 실제 학생 값은 학생 기록(DB)에 저장하세요.",
    },
    "sections": sections,
}

# ids + counts
n_items = n_blanks = 0
for s in sections:
    for pi, p in enumerate(s["parts"]):
        for ii, it in enumerate(p["items"]):
            it["id"] = f"s{s['no']:02d}-p{pi + 1}-{ii + 1:02d}"
            n_items += 1
            n_blanks += len(it["blanks"])
            # every [[id]] in the stem has a blank spec and vice versa
            stem_ids = [g["id"] for g in it["stem"] if g["t"] == "blank"]
            spec_ids = [b["id"] for b in it["blanks"]]
            if it["type"] != "select_many":
                assert stem_ids == spec_ids, (it["id"], stem_ids, spec_ids)
assessment["stats"] = {"sections": len(sections), "items": n_items, "blanks": n_blanks}

(ROOT / "assessment_4-7.json").write_text(json.dumps(assessment, ensure_ascii=False, indent=2), encoding="utf-8")


# ── seed.sql ───────────────────────────────────────────────────────────────
def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


aid = assessment["id"]
sql = ["-- Generated by content/assessment/tools/build.py — do not edit by hand.", "begin;",
       f"insert into assessments (id, title, subtitle, publisher, source, grading_kinds, evaluation_template) values ("
       f"{q(aid)}, {q(assessment['title'])}, {q(assessment['subtitle'])}, {q(assessment['publisher'])}, {q(assessment['source'])}, "
       f"{q(assessment['grading_kinds'])}, {q(assessment['evaluation_template'])}) on conflict (id) do nothing;"]
for s in sections:
    sid = f"{aid}:s{s['no']:02d}"
    sql.append(f"insert into assessment_sections (id, assessment_id, ord, title, pdf_title, pdf_page, teacher_note) values "
               f"({q(sid)}, {q(aid)}, {s['no']}, {q(s['title'])}, {q(s.get('pdf_title'))}, {s['pdf_page']}, {q(s.get('teacher_note'))});")
    for pi, p in enumerate(s["parts"]):
        pid = f"{sid}:p{pi + 1}"
        sql.append(f"insert into assessment_parts (id, section_id, ord, title, timed) values ({q(pid)}, {q(sid)}, {pi + 1}, {q(p['title'])}, {q(bool(p.get('timed')))});")
        for ii, it in enumerate(p["items"]):
            sql.append(
                "insert into assessment_items (id, part_id, ord, label, type, grading, stem, blanks, choices, model_answer, figure, review_note, tags) values ("
                f"{q(aid + ':' + it['id'])}, {q(pid)}, {ii + 1}, {q(it['label'])}, {q(it['type'])}, {q(it['grading'])}, {q(it['stem'])}, {q(it['blanks'])}, "
                f"{q(it.get('choices'))}, {q(it.get('model_answer'))}, {q(it.get('figure'))}, {q(it.get('review_note'))}, "
                f"{'array[' + ','.join(q(t) for t in it.get('tags', [])) + ']::text[]' if it.get('tags') else 'null'});")
sql.append("commit;")
(ROOT / "seed.sql").write_text("\n".join(sql) + "\n", encoding="utf-8")


# ── preview.html (conversion check) ────────────────────────────────────────
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_stem(it, show_answers):
    by_id = {b["id"]: b for b in it["blanks"]}
    out = []
    for g in it["stem"]:
        if g["t"] == "rich":
            out.append(f'<span class="rich">{esc(g["v"])}</span>')
        else:
            b = by_id[g["id"]]
            ans = esc(b["answer"]) if b["answer"] else "✎"
            if b["kind"] == "expr" and b["answer"] and "π" not in b["answer"]:
                ans = f"${ans}$"
            out.append(f'<span class="blank" title="{esc(b["kind"])}">{ans if show_answers else "&nbsp;"}</span>')
    if it["type"] == "select_many":
        sel = set(it["blanks"][0]["answer"].split(","))
        out.append('<div class="choices">' + "".join(
            f'<span class="choice{" on" if show_answers and c in sel else ""}">{esc(c) if "/" not in c else "$\\dfrac{" + c.split("/")[0] + "}{" + c.split("/")[1] + "}$"}</span>'
            for c in it["choices"]) + "</div>")
    return "".join(out)


body = []
for s in sections:
    body.append(f'<section><h2>{s["no"]}. {esc(s["title"])} <small>PDF p.{s["pdf_page"]}'
                f'{" · PDF 제목: " + esc(s["pdf_title"]) if s.get("pdf_title") else ""}</small></h2><div class="cols">')
    for p in s["parts"]:
        body.append(f'<div class="part"><h3><span class="rich">{esc(p["title"])}</span>{" <em>⏱ 초</em>" if p.get("timed") else ""}</h3><ol>')
        for it in p["items"]:
            fig = f'<img src="{it["figure"]}" alt="" class="fig">' if it.get("figure") else ""
            rn = f'<div class="review">검토: {esc(it["review_note"])}</div>' if it.get("review_note") else ""
            ma = f'<div class="model">모범답안: {esc(it["model_answer"])}</div>' if it.get("model_answer") else ""
            body.append(f'<li><b class="lbl">{esc(it["label"])}</b> {render_stem(it, True)}{fig}{ma}{rn}</li>')
        body.append("</ol></div>")
    body.append("</div>")
    if s.get("teacher_note"):
        body.append(f'<div class="memo">메모(교사용): <span class="rich">{esc(s["teacher_note"])}</span></div>')
    body.append("</section>")

html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>진단 평가 변환 미리보기</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{{delimiters:[{{left:'$',right:'$',display:false}}],throwOnError:false}});document.body.dataset.ready=1"></script>
<style>
body{{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;margin:0;padding:16px;background:#f6f7fb;color:#1f2937;word-break:keep-all}}
header{{max-width:1100px;margin:0 auto 16px}} section{{max-width:1100px;margin:0 auto 20px;background:#fff;border-radius:14px;padding:18px 22px;box-shadow:0 1px 3px #0001}}
h2{{margin:0 0 12px;font-size:20px}} h2 small{{font-weight:400;color:#6b7280;font-size:13px;margin-left:8px}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:24px}} @media(max-width:760px){{.cols{{grid-template-columns:1fr}}}}
h3{{font-size:15px;color:#374151;margin:0 0 8px}} h3 em{{font-style:normal;color:#b45309;font-size:12px;margin-left:6px}}
ol{{list-style:none;padding:0;margin:0}} li{{padding:7px 0;border-bottom:1px dashed #e5e7eb;line-height:2.1;font-size:17px}}
.lbl{{color:#2563eb;margin-right:4px}}
.blank{{display:inline-block;min-width:2.6em;padding:0 .4em;margin:0 .2em;border-bottom:2px solid #10b981;color:#047857;font-weight:700;text-align:center;line-height:1.6}}
.choices{{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}} .choice{{padding:2px 10px;border:1px solid #d1d5db;border-radius:999px}} .choice.on{{border:2px solid #10b981;background:#ecfdf5}}
.fig{{display:block;max-width:260px;margin:6px 0}} .memo{{margin-top:12px;padding:10px 12px;border:1px dotted #93c5fd;color:#1d4ed8;font-size:14px;line-height:1.8}}
.model{{font-size:13px;color:#4b5563;line-height:1.6}} .review{{font-size:13px;color:#b91c1c;line-height:1.6}}
</style></head><body>
<header><h1 style="margin:0">{esc(assessment['title'])} — {esc(assessment['subtitle'])}</h1>
<p style="color:#6b7280">변환 확인용 미리보기 · 섹션 {len(sections)} · 문항 {n_items} · 답칸 {n_blanks} · 초록 밑줄 = 계산으로 검증한 정답 · 빨간 글씨 = 원본 확인 필요</p></header>
{''.join(body)}
</body></html>"""
(ROOT / "preview.html").write_text(html, encoding="utf-8")
print(f"ok: {len(sections)} sections, {n_items} items, {n_blanks} blanks")
