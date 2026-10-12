import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import type { SavedData } from "../../src/lib/study-data";

const emptyState = (): SavedData => ({
  profile: { targetBand: "7.0", examDate: "", dailyTarget: 45 },
  logs: [],
  mistakes: [],
  checkIns: [],
});

const populatedState = (): SavedData => ({
  profile: { targetBand: "7.5", examDate: "2026-12-20", dailyTarget: 60 },
  logs: [{ id: "existing-log", date: "2026-10-11", minutes: 15, skill: "reading", correct: 1, total: 1 }],
  mistakes: [{ id: "existing-mistake", skill: "reading", question: "Existing reading question", reason: "Existing explanation", date: "2026-10-11", mastered: false }],
  checkIns: ["2026-10-11"],
});

async function mockStudy(
  page: Page,
  read: (route: Route) => Promise<void>,
  write?: (route: Route) => Promise<void>,
) {
  const writes: SavedData[] = [];
  await page.route("**/api/study", async (route) => {
    if (route.request().method() === "GET") {
      await read(route);
    } else if (route.request().method() === "PUT") {
      writes.push(route.request().postDataJSON() as SavedData);
      if (write) await write(route);
      else await route.fulfill({ json: { saved: true } });
    } else {
      await route.abort();
    }
  });
  return writes;
}

async function settleRender(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function clickIfEnabled(button: Locator) {
  if (await button.isEnabled()) await button.click();
}

async function assertModificationsLocked(page: Page) {
  await clickIfEnabled(page.getByRole("button", { name: "调整目标", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await clickIfEnabled(page.getByRole("button", { name: "开始阅读练习", exact: true }).first());
  await expect(page.getByRole("heading", { name: "判断题：信息核对" })).toHaveCount(0);

  await page.getByRole("button", { name: "练习中心", exact: true }).first().click();
  await clickIfEnabled(page.locator(".practice-card").filter({ has: page.getByRole("heading", { name: /^听力/ }) }).getByRole("button", { name: "开始练习" }));
  await expect(page.getByRole("heading", { name: "场景听力：抓住细节" })).toHaveCount(0);

  await page.getByRole("button", { name: "AI 批改", exact: true }).click();
  await page.getByLabel("你的作文").fill("A sufficiently long essay cannot be saved while the server data has not loaded.");
  await expect(page.getByRole("button", { name: "提交批改", exact: true })).toBeDisabled();
}

async function openListening(page: Page) {
  await page.getByRole("button", { name: "练习中心", exact: true }).first().click();
  await page.locator(".practice-card").filter({ has: page.getByRole("heading", { name: /^听力/ }) }).getByRole("button", { name: "开始练习" }).click();
  await expect(page.getByRole("heading", { name: "场景听力：抓住细节" })).toBeVisible();
}

const failedReads = [
  { name: "HTTP failure", response: { status: 500, json: { error: "Read unavailable" } } },
  { name: "malformed JSON", response: { contentType: "application/json", body: "{not-json" } },
  { name: "missing state", response: { json: {} } },
  { name: "invalid state", response: { json: { state: { ...emptyState(), logs: [{}] } } } },
];

for (const { name, response } of failedReads) {
  test(`${name} prevents edits and never writes default records`, async ({ page }) => {
    const writes = await mockStudy(page, (route) => route.fulfill(response));
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "已暂停修改和保存" })).toBeVisible();
    await assertModificationsLocked(page);
    await settleRender(page);
    expect(writes).toEqual([]);
  });
}

test("a network read failure prevents edits and never writes default records", async ({ page }) => {
  const writes = await mockStudy(page, (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "已暂停修改和保存" })).toBeVisible();
  await assertModificationsLocked(page);
  await settleRender(page);
  expect(writes).toEqual([]);
});

test("retrying a failed read loads saved records without an initial write", async ({ page }) => {
  const state = populatedState();
  let reads = 0;
  const writes = await mockStudy(page, (route) => {
    reads += 1;
    return reads === 1
      ? route.fulfill({ status: 500, json: { error: "Read unavailable" } })
      : route.fulfill({ json: { state } });
  });
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "已暂停修改和保存" })).toBeVisible();
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(page.getByRole("button", { name: "设置目标分数" })).toContainText("7.5");
  await expect(page.getByRole("alert").filter({ hasText: "已暂停修改和保存" })).toHaveCount(0);
  await page.getByRole("button", { name: "调整目标", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("目标总分")).toHaveValue("7.5");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: "Existing reading question" })).toBeVisible();
  await settleRender(page);
  expect(reads).toBe(2);
  expect(writes).toEqual([]);
});

for (const [answer, correct] of [["A quiet desk", true], ["A new laptop", false], ["A meeting room", false]] as const) {
  test(`listening grades ${answer} as ${correct ? "correct" : "incorrect"}`, async ({ page }) => {
    const writes = await mockStudy(page, (route) => route.fulfill({ json: { state: null } }));
    await page.goto("/");
    await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);
    await openListening(page);
    await settleRender(page);
    expect(writes).toEqual([]);

    await page.getByRole("button", { name: answer, exact: true }).click();
    await page.getByRole("button", { name: "提交答案", exact: true }).click();
    await expect(page.getByText(correct ? "回答正确" : "再看一下原文依据", { exact: true })).toBeVisible();
    await expect(page.getByText("学习记录已保存到服务端。", { exact: true })).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].logs).toHaveLength(1);
    expect(writes[0].logs[0]).toMatchObject({ skill: "listening", correct: correct ? 1 : 0, total: 1 });
    expect(writes[0].checkIns).toHaveLength(1);
    expect(writes[0].mistakes).toHaveLength(correct ? 0 : 1);
    if (!correct) expect(writes[0].mistakes[0]).toMatchObject({ skill: "listening", mastered: false });

    await page.getByRole("button", { name: /错题复练/ }).first().click();
    await expect(page.getByRole("heading", { name: correct ? "暂时没有待复习错题" : "听力细节：What does the speaker need for the report?", exact: true })).toBeVisible();
  });
}

test("editing a loaded profile retains existing records and does not save on load", async ({ page }) => {
  const state = populatedState();
  const writes = await mockStudy(page, (route) => route.fulfill({ json: { state } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "设置目标分数" })).toContainText("7.5");
  await page.getByRole("button", { name: "学习进度", exact: true }).click();
  await expect(page.getByText("2026-10-11 · 1/1 题正确", { exact: true })).toBeVisible();
  await settleRender(page);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "设置目标分数" }).click();
  await page.getByLabel("目标总分").selectOption("8.0");
  await page.getByRole("button", { name: "保存目标", exact: true }).click();
  await expect(page.getByText("学习记录已保存到服务端。", { exact: true })).toBeVisible();
  expect(writes).toEqual([{ ...state, profile: { ...state.profile, targetBand: "8.0" } }]);
});

test("a delayed read prevents edits until the saved snapshot arrives", async ({ page }) => {
  let releaseRead!: () => void;
  const readPending = new Promise<void>((resolve) => { releaseRead = resolve; });
  const state = populatedState();
  const writes = await mockStudy(page, async (route) => {
    await readPending;
    await route.fulfill({ json: { state } });
  });
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。", { exact: true })).toBeVisible();
  await assertModificationsLocked(page);
  expect(writes).toEqual([]);
  releaseRead();
  await expect(page.getByRole("button", { name: "设置目标分数" })).toContainText("7.5");
  await settleRender(page);
  expect(writes).toEqual([]);
});

test("a failed write reports the error and permits retrying unchanged settings", async ({ page }) => {
  let attempts = 0;
  const writes = await mockStudy(
    page,
    (route) => route.fulfill({ json: { state: null } }),
    (route) => {
      attempts += 1;
      return attempts === 1
        ? route.fulfill({ status: 500, json: { error: "模拟保存失败" } })
        : route.fulfill({ json: { saved: true } });
    },
  );
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);
  await page.getByRole("button", { name: "调整目标", exact: true }).click();
  await page.getByLabel("目标总分").selectOption("8.0");
  await page.getByRole("button", { name: "保存目标", exact: true }).click();
  await expect(page.getByText("模拟保存失败", { exact: true })).toBeVisible();
  await expect(page.getByText("学习记录已保存到服务端。", { exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(1);
  await page.getByRole("button", { name: "调整目标", exact: true }).click();
  await expect(page.getByLabel("目标总分")).toHaveValue("8.0");
  await page.getByRole("button", { name: "保存目标", exact: true }).click();
  await expect(page.getByText("学习记录已保存到服务端。", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});
