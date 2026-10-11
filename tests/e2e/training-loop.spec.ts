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
  // No invite code: 양평초등학교 is linked to 잇고 수학학원 (decided in a hidden step — no choice needed).
  await expect(page.getByTestId("signup-org")).toBeHidden();
  await expect(page.getByTestId("signup-org")).toContainText("잇고 수학학원 학생으로 가입돼요.");
  await expect(page.getByText("2. 내 계정")).toBeVisible();
  await page.locator('input[name="fullName"]').fill("김테스트");
  await page.locator('input[name="initial"]').fill("ㅌㅅ");
  await page.locator('input[name="loginId"]').fill(id);
  await page.locator('input[name="password"]').fill("1234");
  await page.locator('input[name="guardianPhone"]').fill("010-1234-5678");
  await page.locator('input[name="email"]').fill(`${id}@example.com`);
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

  // The student's name never shows on student screens (rule 5) …
  for (const path of ["/s/home", "/s/records", "/studyroom"]) {
    await page.goto(path);
    await expect(page.getByText("김테스트")).toHaveCount(0);
  }
  // … but the teacher of the academy sees it in the student list …
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("teacher");
  await page.locator('input[name="password"]').fill("teach1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/t\/students/);
  await expect(page.locator("tbody tr").filter({ hasText: "김테스트" })).toContainText("ㅌㅅ");
  // … and the 본사 관리자 member list, next to the initial.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto(`/admin/members?q=${id}`);
  const row = page.locator("tbody tr").filter({ hasText: id });
  await expect(row).toContainText("김테스트");
  await expect(row).toContainText("ㅌㅅ");
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

test("signup email and phone show in the admin member list; a malformed email is rejected", async ({ page }) => {
  const id = `mail${Date.now() % 1_000_000}`;
  const fillTeacher = async (email: string) => {
    await page.locator('input[name="inviteCode"]').fill("ITGO2026");
    await page.locator('input[name="fullName"]').fill("메일선생");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill("teach-pass-1");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill("010-9876-5432");
    await page.getByRole("button", { name: "가입 신청" }).click();
  };
  await page.goto("/signup/teacher");
  // The browser already blocks this (type="email"); switch its validation off to test the server check.
  await page.waitForLoadState("networkidle");
  await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await fillTeacher("not-an-email");
  await expect(page.getByText("이메일 주소를 확인해 주세요")).toBeVisible();
  await fillTeacher(`${id}@Example.com`); // the form is cleared after a server error
  await expect(page).toHaveURL(/\/pending/);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto(`/admin/members?q=${id}@example`);
  const row = page.locator("tbody tr").filter({ hasText: id });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("link", { name: `${id}@example.com` })).toBeVisible(); // stored lowercase
  await expect(row).toContainText("승인 대기");
  await expect(row).toContainText("010-9876-5432");

  // Phone search ignores dashes; students show their guardian's number.
  await page.goto("/admin/members?q=9876-5432");
  await expect(page.locator("tbody tr").filter({ hasText: id })).toHaveCount(1);
  await page.goto("/admin/members?q=student2");
  await expect(page.locator("tbody tr").filter({ hasText: "student2" })).toContainText("010-0000-0000학부모");
});

test("본사 관리자 edits member info: student details + password, teacher approval", async ({ page }) => {
  const loginAs = async (id: string, pw: string) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
  };
  await loginAs("admin", "admin1234");
  await expect(page).toHaveURL(/\/admin\//);

  // Student: name, grade, guardian phone and a new password.
  await page.goto("/admin/members?q=student1");
  await page.locator("tbody tr").filter({ hasText: "student1" }).getByRole("link", { name: "수정" }).click();
  await expect(page.getByRole("heading", { name: /회원 정보 수정/ })).toContainText("student1");
  await page.locator('input[name="phone"]').fill("010-12"); // invalid → error, typed values kept
  await page.locator('input[name="fullName"]').fill("이수정");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("학부모 휴대폰 번호를 확인하세요")).toBeVisible();
  await expect(page.locator('input[name="fullName"]')).toHaveValue("이수정");
  await page.locator('input[name="phone"]').fill("010-2222-3333");
  await page.locator('select[name="grade"]').selectOption("3");
  await page.locator('input[name="newPassword"]').fill("5678");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했습니다. 비밀번호도 바꿨습니다.")).toBeVisible();
  await expect(page.locator('input[name="fullName"]')).toHaveValue("이수정");
  await page.goto("/admin/members?q=student1");
  const row = page.locator("tbody tr").filter({ hasText: "student1" });
  await expect(row).toContainText("이수정");
  await expect(row).toContainText("010-2222-3333");
  await expect(row).toContainText("3학년");

  // Teacher: approve a pending signup.
  const tid = `apv${Date.now() % 1_000_000}`;
  await page.context().clearCookies();
  await page.goto("/signup/teacher");
  await page.locator('input[name="inviteCode"]').fill("ITGO2026");
  await page.locator('input[name="fullName"]').fill("승인대기");
  await page.locator('input[name="loginId"]').fill(tid);
  await page.locator('input[name="password"]').fill("teach-pass-1");
  await page.getByRole("button", { name: "가입 신청" }).click();
  await expect(page).toHaveURL(/\/pending/);
  await loginAs("admin", "admin1234");
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto(`/admin/members?q=${tid}`);
  await page.locator("tbody tr").filter({ hasText: tid }).getByRole("link", { name: "수정" }).click();
  await page.locator('input[name="approved"]').check();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했습니다.")).toBeVisible();
  await page.goto(`/admin/members?q=${tid}`);
  await expect(page.locator("tbody tr").filter({ hasText: tid })).toContainText("활성");

  // The new student password works; the old one does not.
  await loginAs("student1", "1234");
  await expect(page.getByText("아이디 또는 비밀번호가 맞지 않아요.")).toBeVisible();
  await loginAs("student1", "5678");
  await expect(page).toHaveURL(/\/s\//);
});

test("본사 관리자 deletes a member (with learning history); cannot delete own account", async ({ page }) => {
  const loginAs = async (id: string, pw: string) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
  };
  await loginAs("admin", "admin1234");
  await expect(page).toHaveURL(/\/admin\//);

  // Own account: no delete.
  await page.goto("/admin/members?q=admin");
  await page.locator("tbody tr").filter({ hasText: "본사 관리자" }).getByRole("link", { name: "수정" }).click();
  await expect(page.getByText("지금 로그인한 본사 관리자 계정은 삭제할 수 없습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "회원 삭제" })).toHaveCount(0);

  // student2 has two weeks of attempts and progress (demo seed).
  await page.goto("/admin/members?q=student2");
  await page.locator("tbody tr").filter({ hasText: "student2" }).getByRole("link", { name: "수정" }).click();
  await page.locator('input[name="confirmLoginId"]').fill("student");
  await page.getByRole("button", { name: "회원 삭제" }).click();
  await expect(page.getByText('확인을 위해 아이디 "student2"를 정확히 입력하세요.')).toBeVisible();
  await page.locator('input[name="confirmLoginId"]').fill("student2");
  await page.getByRole("button", { name: "회원 삭제" }).click();
  await expect(page).toHaveURL(/\/admin\/members\?deleted=student2/);
  await expect(page.getByText("student2 을(를) 삭제했습니다.")).toBeVisible();
  await page.goto("/admin/members?q=student2");
  await expect(page.getByText("조건에 맞는 회원이 없습니다.")).toBeVisible();

  await loginAs("student2", "1234");
  await expect(page.getByText("아이디 또는 비밀번호가 맞지 않아요.")).toBeVisible();
  await loginAs("teacher", "teach1234");
  await expect(page).toHaveURL(/\/t\/students/);
  await expect(page.locator("tbody").getByText("ㅂㅈ")).toHaveCount(0);
});

test("student signup joins the academy linked to the school (none / one / several); admin links schools", async ({ page }) => {
  const tag = Date.now() % 1_000_000;
  const loginAs = async (id: string, pw: string) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
  };
  const signup = async (region: string, school: string, id: string, pickOrg?: string) => {
    await page.context().clearCookies();
    await page.goto("/signup/student");
    await page.getByLabel("지역", { exact: true }).selectOption({ label: region });
    await page.getByLabel("학교", { exact: true }).selectOption({ label: school });
    await page.getByLabel("학년", { exact: true }).selectOption("2");
    if (pickOrg) {
      await expect(page.getByTestId("signup-org")).toBeVisible(); // several academies: the student picks
      await page.getByLabel("학원 · 공부방", { exact: true }).selectOption({ label: pickOrg });
    } else {
      await expect(page.getByTestId("signup-org")).toBeHidden();
    }
    await page.locator('input[name="fullName"]').fill(`학생${id}`);
    await page.locator('input[name="initial"]').fill("ㅎㅅ");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill("1234");
    await page.locator('input[name="guardianPhone"]').fill("010-1234-5678");
    await page.locator('input[name="consent"]').check();
    await page.getByRole("button", { name: "가입하고 시작하기" }).click();
    await expect(page).toHaveURL(/\/s\/diagnostic/);
  };
  const orgOf = async (id: string) => {
    await loginAs("admin", "admin1234");
    await expect(page).toHaveURL(/\/admin\//);
    await page.goto(`/admin/members?q=${id}`);
    return page.locator("tbody tr").filter({ hasText: id }).locator("td").nth(7).innerText();
  };

  // No academy linked to 대치초등학교 yet → joins without one.
  await page.goto("/signup/student");
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "서울 강남구" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "대치초등학교" });
  await expect(page.getByTestId("signup-org")).toBeHidden();
  await expect(page.getByTestId("signup-org")).toContainText("연결된 학원·공부방이 아직 없어요");
  await signup("서울 강남구", "대치초등학교", `none${tag}`);
  expect((await orgOf(`none${tag}`)).trim()).toBe("-");

  // Admin creates an academy for 용문초등학교 (region + school in the new-organization form).
  await page.goto("/admin/orgs");
  await page.locator('input[name="name"]').fill(`용문학원${tag}`);
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "경기 양평군" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "용문초등학교" });
  await page.locator('input[name="directorName"]').fill("용문원장");
  await page.locator('input[name="loginId"]').fill(`ym${tag}`);
  await page.locator('input[name="password"]').fill("director-pass-1");
  await page.getByRole("button", { name: "기관 만들기" }).click();
  await expect(page.getByText(`용문학원${tag} 생성 완료`)).toBeVisible();
  await signup("경기 양평군", "용문초등학교", `one${tag}`);
  expect(await orgOf(`one${tag}`)).toContain(`용문학원${tag}`);

  // Link the existing 햇살 공부방 to 양평초등학교 too → the student picks between two.
  await page.goto("/admin/orgs");
  const row = page.locator("tbody tr").filter({ hasText: "햇살 공부방" });
  await row.locator('select[name="schoolId"]').selectOption({ label: "경기 양평군 · 양평초등학교" });
  await row.getByRole("button", { name: "저장" }).click();
  await expect(row.locator('select[name="schoolId"]')).toHaveValue(/.+/);
  await signup("경기 양평군", "양평초등학교", `two${tag}`, "햇살 공부방");
  expect(await orgOf(`two${tag}`)).toContain("햇살 공부방");
});

test("본사 관리자 writes 공지사항 and 자주하는 질문; the site shows them as plain text", async ({ page }) => {
  const tag = Date.now() % 1_000_000;
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);

  // From the public page: the 글쓰기 shortcut (admins only).
  await page.goto("/notice");
  await page.getByRole("link", { name: "글쓰기" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/new\?board=notice/);
  await page.locator('input[name="title"]').fill(`겨울방학 안내 ${tag}`);
  await page.locator('textarea[name="body"]').fill("첫째 줄\n<b>굵게 아님</b>");
  await page.locator('input[name="pinned"]').check();
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\?board=notice&saved=1/);

  await page.goto("/admin/posts/new?board=faq");
  await page.locator('input[name="title"]').fill(`진단 테스트는 몇 분 걸리나요? ${tag}`);
  await page.locator('textarea[name="body"]').fill("보통 20분 정도 걸려요.");
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page).toHaveURL(/board=faq&saved=1/);

  // Signed out, the site shows both.
  await page.context().clearCookies();
  await page.goto("/notice");
  await expect(page.getByRole("link", { name: "글쓰기" })).toHaveCount(0);
  await page.getByRole("link", { name: new RegExp(`겨울방학 안내 ${tag}`) }).click();
  await expect(page.getByText("<b>굵게 아님</b>")).toBeVisible(); // escaped, not rendered as HTML
  await page.goto("/FAQ");
  await page.getByText(`진단 테스트는 몇 분 걸리나요? ${tag}`).click();
  await expect(page.getByText("보통 20분 정도 걸려요.")).toBeVisible();

  // Edit, then delete.
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto("/admin/posts?board=faq");
  await page.locator("tbody tr").filter({ hasText: `${tag}` }).getByRole("link", { name: "수정" }).click();
  await page.locator('textarea[name="body"]').fill("보통 15분 정도 걸려요.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/board=faq&saved=1/);
  await page.goto("/FAQ");
  await page.getByText(`진단 테스트는 몇 분 걸리나요? ${tag}`).click();
  await expect(page.getByText("보통 15분 정도 걸려요.")).toBeVisible();
  await page.goto("/admin/posts?board=faq");
  await page.locator("tbody tr").filter({ hasText: `${tag}` }).getByRole("link", { name: "수정" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "글 삭제" }).click();
  await expect(page).toHaveURL(/board=faq&deleted=1/);
  await page.goto("/FAQ");
  await expect(page.getByText(`진단 테스트는 몇 분 걸리나요? ${tag}`)).toHaveCount(0);
});

test("본사 관리자 deletes an organization: staff accounts removed, students kept without one", async ({ page }) => {
  const tag = Date.now() % 1_000_000;
  const loginAs = async (id: string, pw: string) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(id);
    await page.locator('input[name="password"]').fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
  };
  await loginAs("admin", "admin1234");
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto("/admin/orgs");
  await page.locator('input[name="name"]').fill(`삭제학원${tag}`);
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "서울 강남구" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "대치초등학교" });
  await page.locator('input[name="directorName"]').fill("삭제원장");
  await page.locator('input[name="loginId"]').fill(`del${tag}`);
  await page.locator('input[name="password"]').fill("director-pass-1");
  await page.getByRole("button", { name: "기관 만들기" }).click();
  await expect(page.getByText(`삭제학원${tag} 생성 완료`)).toBeVisible();

  // A student joins it through the school.
  await page.context().clearCookies();
  await page.goto("/signup/student");
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "서울 강남구" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "대치초등학교" });
  await page.getByLabel("학년", { exact: true }).selectOption("1");
  await page.locator('input[name="fullName"]').fill("남는학생");
  await page.locator('input[name="initial"]').fill("ㄴㅎ");
  await page.locator('input[name="loginId"]').fill(`stay${tag}`);
  await page.locator('input[name="password"]').fill("1234");
  await page.locator('input[name="guardianPhone"]').fill("010-1234-5678");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL(/\/s\/diagnostic/);

  await loginAs("admin", "admin1234");
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto("/admin/orgs");
  const row = page.locator("tbody tr").filter({ hasText: `삭제학원${tag}` });
  await row.getByText("삭제", { exact: true }).click();
  await row.locator('input[name="confirmName"]').fill("틀린이름");
  await row.getByRole("button", { name: "기관 삭제" }).click();
  await expect(row.getByText("정확히 입력하세요")).toBeVisible();
  await row.locator('input[name="confirmName"]').fill(`삭제학원${tag}`);
  await row.getByRole("button", { name: "기관 삭제" }).click();
  await expect(page.getByText(`삭제학원${tag} 기관을 삭제했습니다. 원장·선생님 계정 1개를 지웠고, 학생 1명은 소속 없음으로 남겼습니다.`)).toBeVisible();

  await page.goto(`/admin/members?q=stay${tag}`);
  const student = page.locator("tbody tr").filter({ hasText: `stay${tag}` });
  await expect(student).toHaveCount(1);
  expect((await student.locator("td").nth(7).innerText()).trim()).toBe("-");
  await page.goto(`/admin/members?q=del${tag}`);
  await expect(page.getByText("조건에 맞는 회원이 없습니다.")).toBeVisible();
});

test("6-character initials; 본사 관리자 writes 교육이야기 next to the story moved from the old page", async ({ page }) => {
  const tag = Date.now() % 1_000_000;
  await page.goto("/signup/student");
  await page.getByLabel("지역", { exact: true }).selectOption({ label: "경기 양평군" });
  await page.getByLabel("학교", { exact: true }).selectOption({ label: "양평초등학교" });
  await page.getByLabel("학년", { exact: true }).selectOption("4");
  // An earlier test links a second academy to 양평초등학교; pick ours when asked.
  if (await page.getByTestId("signup-org").isVisible()) {
    await page.getByLabel("학원 · 공부방", { exact: true }).selectOption({ label: "잇고 수학학원" });
  }
  await page.locator('input[name="fullName"]').fill("여섯글자");
  await page.locator('input[name="initial"]').fill("ㄱㄴㄷㄹㅁㅂㅅ"); // 7 typed, the field keeps 6
  await expect(page.locator('input[name="initial"]')).toHaveValue("ㄱㄴㄷㄹㅁㅂ");
  await page.locator('input[name="loginId"]').fill(`six${tag}`);
  await page.locator('input[name="password"]').fill("1234");
  await page.locator('input[name="guardianPhone"]').fill("010-1234-5678");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL(/\/s\/diagnostic/);
  await page.goto("/s/home");
  await expect(page.getByLabel("이니셜 ㄱㄴㄷㄹㅁㅂ").first()).toBeVisible();

  // 교육이야기: the old hard-coded story is now a post, and admins can add more.
  await page.context().clearCookies();
  await page.goto("/education");
  await expect(page.getByText('1편-"읽고 말하는 수학"')).toBeVisible();
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto("/education");
  await page.getByRole("link", { name: "글쓰기" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/new\?board=education/);
  await page.locator('input[name="title"]').fill(`2편-"쓰는 수학" ${tag}`);
  await page.locator('textarea[name="body"]').fill("아이들이 직접 책을 씁니다.");
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page).toHaveURL(/board=education&saved=1/);
  await page.goto("/education");
  await page.getByText(`2편-"쓰는 수학" ${tag}`).click();
  await expect(page.getByText("아이들이 직접 책을 씁니다.")).toBeVisible();
});

test("방문 통계: visits are counted per day and shown to 본사 관리자", async ({ page, request }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await page.goto("/notice");
  await page.goto("/FAQ");
  // Admin pages are never counted.
  expect((await request.post("/api/track", { data: { path: "/admin/members" } })).status()).toBe(204);

  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin1234");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.getByRole("link", { name: "방문 통계" }).click();
  await expect(page.getByRole("heading", { name: "방문 통계" })).toBeVisible();
  const tile = (label: string) => page.locator("div").filter({ has: page.getByText(label, { exact: true }) }).locator("div.text-3xl").first();
  expect(Number((await tile("오늘 방문자").innerText()).replace(/,/g, ""))).toBeGreaterThanOrEqual(1);
  expect(Number((await tile("오늘 페이지뷰").innerText()).replace(/,/g, ""))).toBeGreaterThanOrEqual(3);
  const top = page.locator("section").filter({ hasText: "많이 본 페이지" });
  await expect(top.getByText("/notice", { exact: true })).toBeVisible();
  await expect(top.getByText("/admin/members")).toHaveCount(0);
  await page.getByRole("link", { name: "최근 7일" }).click();
  await expect(page.locator("section").filter({ hasText: "날짜별" }).locator("tbody tr")).toHaveCount(7);
});
