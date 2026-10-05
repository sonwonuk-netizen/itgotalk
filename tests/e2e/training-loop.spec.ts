import { expect, test, type Page } from "@playwright/test";

/** Reads the problem on screen and returns the value for the box. */
async function solve(page: Page): Promise<number> {
  const p = page.getByTestId("problem");
  const [a, op, b, blank] = await Promise.all(["data-a", "data-op", "data-b", "data-blank"].map((k) => p.getAttribute(k)));
  const x = Number(a);
  const y = Number(b);
  const result = op === "+" ? x + y : op === "-" ? x - y : op === "×" ? x * y : x / y;
  return blank === "result" ? result : y;
}

async function type(page: Page, n: number) {
  for (const d of String(n)) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "확인" }).click();
}

/** Plays a whole set. `wrong` answers every item incorrectly. */
async function playSet(page: Page, { wrong = false } = {}) {
  await page.getByRole("button", { name: "시작!" }).click();
  const counter = page.getByText(/^문항 \d+ \/ \d+$/);
  await expect(counter).toBeVisible();
  const total = Number((await counter.textContent())!.split("/")[1]);
  for (let i = 1; i <= total; i++) {
    await expect(counter).toHaveText(`문항 ${i} / ${total}`);
    const answer = await solve(page);
    await type(page, wrong ? answer + 1 : answer);
  }
}

test("ST-01 → diagnostic → practice ×3 → test pass → next set opens", async ({ page }) => {
  const id = `e2e${Date.now() % 1_000_000}`;

  // Site entry: home → 학습자료실 → sign up
  await page.goto("/");
  await expect(page.getByRole("link", { name: "학습자료실 바로가기 →" })).toHaveAttribute("href", "/studyroom");
  await page.goto("/studyroom");
  await expect(page.getByRole("heading", { name: "책을쓰는 아이들 연산 훈련" })).toBeVisible();
  await page.getByRole("link", { name: "처음이에요 (가입)" }).click();

  // ST-01 signup
  await expect(page).toHaveURL(/\/signup\/student/);
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "경기 양평군" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "양평초등학교" });
  await page.getByLabel("학년", { exact: true }).selectOption("1");
  await page.locator('input[name="inviteCode"]').fill("ITGO2026");
  await page.locator('input[name="initial"]').fill("ㅌㅅ");
  await page.locator('input[name="loginId"]').fill(id);
  await page.locator('input[name="password"]').fill("1234");
  await page.locator('input[name="guardianPhone"]').fill("010-1234-5678");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();

  // ST-10 diagnostic: fail the first skill → start there
  await expect(page).toHaveURL(/\/s\/diagnostic/);
  await playSet(page, { wrong: true });
  await expect(page.getByRole("heading", { name: "진단 결과" })).toBeVisible();
  // Explanation chosen by the weakness: all answers were wrong by one → accuracy
  await expect(page.getByText("정확도", { exact: true })).toBeVisible();
  await expect(page.getByText("한 칸씩 덜 가거나 더 가는 실수가 많았어요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "더하기 1은 '바로 다음 수'예요" })).toBeVisible();
  await expect(page.getByRole("img", { name: /오른쪽으로 1칸/ })).toBeVisible();
  await page.getByRole("link", { name: "학습 화면으로" }).click();

  // Home: test is locked until 3 practices (addition card; other tracks are not started yet)
  const add = page.locator('[data-track="add"]');
  await expect(add.getByRole("heading", { name: "+1 직관" })).toBeVisible();
  await expect(page.locator('[data-track="times"]').getByRole("link", { name: "진단 테스트로 시작" })).toBeVisible();
  await expect(add.getByText("세트 1 / 2")).toBeVisible();
  await expect(add.getByRole("button", { name: /테스트/ })).toBeDisabled();

  for (let n = 1; n <= 3; n++) {
    await add.getByRole("link", { name: /연습하기/ }).click();
    await playSet(page);
    await expect(page.getByTestId("result-headline")).toHaveText("연습 완료!");
    await page.getByRole("link", { name: /학습 화면으로/ }).click();
    await expect(add.getByTestId("practice-count")).toHaveText(`${n} / 3`);
  }

  // Test opens, pass it (well under 12s)
  await add.getByRole("link", { name: /^테스트/ }).click();
  await playSet(page);
  await expect(page.getByTestId("result-headline")).toHaveText("통과!");
  await page.getByRole("link", { name: "다음 단계로" }).click();

  // Next set is open, practice counter reset, test locked again
  await expect(add.getByText("세트 2 / 2")).toBeVisible();
  await expect(add.getByTestId("practice-count")).toHaveText("0 / 3");
  await expect(add.getByRole("button", { name: /테스트/ })).toBeDisabled();
});

test("test cannot be started before 3 practices, even by URL (T5 on the server)", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("student2");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/s\/home/);
  const href = await page.locator('[data-track="add"]').getByRole("link", { name: /연습하기/ }).getAttribute("href");
  await page.goto(href!.replace("mode=practice", "mode=test"));
  await page.getByRole("button", { name: "시작!" }).click();
  await expect(page.getByText("연습을 3번 마치면 테스트가 열려요")).toBeVisible();
});

test("teacher sees only own students; another org's teacher sees none", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("teacher");
  await page.locator('input[name="password"]').fill("teach1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/t\/students/);
  await expect(page.getByRole("link", { name: "ㅂㅈ" })).toBeVisible();
  await page.getByRole("link", { name: "ㅂㅈ" }).click();
  await expect(page.getByText("스킬 진행표")).toBeVisible();
});

test("1~9 빨리 누르기: start without diagnostic, tap 1→9, practice is counted", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("student2");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/s\/home/);

  const tap =page.locator('[data-track="tap"]');
  await tap.getByRole("button", { name: "시작하기" }).click();
  await expect(tap.getByRole("heading", { name: "1~9 빨리 누르기 1단계" })).toBeVisible();
  await tap.getByRole("link", { name: /연습하기/ }).click();

  await page.getByRole("button", { name: "시작!" }).click();
  // One wrong tap first (shakes, counted as a mistake), then 1→9 in order.
  await page.getByRole("button", { name: "숫자 2" }).click();
  for (let n = 1; n <= 9; n++) {
    await expect(page.getByText(`다음 숫자: ${n}`)).toBeVisible();
    await page.getByRole("button", { name: `숫자 ${n}` }).click();
  }
  await expect(page.getByTestId("result-headline")).toHaveText("연습 완료!");
  await page.getByRole("link", { name: /학습 화면으로/ }).click();
  await expect(page.locator('[data-track="tap"]').getByTestId("practice-count")).toHaveText("1 / 3");
});

test("진단 테스트: 학습자료실 ① → one question per screen → resume → submit → result", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("student1");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/s\//);

  await page.goto("/studyroom");
  await expect(page.getByTestId("step-assessment")).toHaveAttribute("href", "/s/assessment");
  await page.goto("/s/assessment");
  await page.getByRole("button", { name: "진단 테스트 시작" }).click();
  await expect(page).toHaveURL(/\/s\/assessment\/[0-9a-f-]+$/);

  const q = page.getByTestId("assessment-question");
  await expect(q).toContainText("15");
  await expect(q.locator(".katex").first()).toBeVisible(); // equations rendered by KaTeX
  // 15 + 4 = □□ : two one-digit boxes, typing moves to the next box
  await expect(q.getByRole("textbox")).toHaveCount(2);
  await q.getByRole("textbox").first().click();
  await page.keyboard.type("19");
  await expect(q.getByRole("textbox").nth(1)).toHaveValue("9");
  await page.getByRole("button", { name: "다음 →" }).click();
  await expect(page.getByRole("button", { name: /^2 \// })).toBeVisible();
  await q.getByRole("textbox").first().click();
  await page.keyboard.type("30"); // 22 + 7 → wrong on purpose
  await page.getByRole("button", { name: "다음 →" }).click();
  await expect(page.getByRole("button", { name: /^3 \// })).toBeVisible();

  // Leave and come back: answers are kept and we resume at the first unanswered question.
  await page.goto("/s/assessment");
  await page.getByRole("button", { name: "이어서 풀기" }).click();
  await expect(page.getByRole("button", { name: /^3 \// })).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByTestId("assessment-score")).toHaveText(/^1 \/ \d+$/);
});
