import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SavedData } from "../../src/lib/study-data";

type Question = {
  id: string;
  number: number;
  type: string;
  prompt: string;
  answer?: string;
  answers?: string[];
};

const passage = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/reading/passage-01.json"), "utf8")) as {
  questions: Question[];
};

async function mockStudy(page: Page) {
  const writes: SavedData[] = [];
  await page.route("**/api/study", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { state: null } });
    } else if (route.request().method() === "PUT") {
      writes.push(route.request().postDataJSON() as SavedData);
      await route.fulfill({ json: { saved: true } });
    } else {
      await route.abort();
    }
  });
  return writes;
}

test("full reading passage grades 13 questions and records the wrong answer", async ({ page }) => {
  const writes = await mockStudy(page);
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);

  await page.getByRole("button", { name: "练习中心", exact: true }).first().click();
  await page.locator(".practice-card").filter({ has: page.getByRole("heading", { name: /^阅读/ }) }).getByRole("button", { name: "开始练习" }).click();

  await expect(page.getByRole("heading", { name: "Green Roofs in Modern Cities" })).toBeVisible();
  await expect(page.locator(".reading-paragraph-label")).toHaveCount(4);
  await expect(page.locator(".reading-question")).toHaveCount(13);

  for (const question of passage.questions) {
    if (question.type === "true-false-not-given") {
      const card = page.locator(".reading-question").filter({ hasText: question.prompt });
      await card.getByRole("button", { name: question.number === 1 ? "True" : question.answer!, exact: true }).click();
    } else if (question.type === "matching-headings") {
      await page.getByLabel(`Question ${question.number} heading`).selectOption(question.answer!);
    } else {
      await page.getByLabel(`Question ${question.number} answer`).fill(question.answers![0]);
    }
  }

  const submit = page.getByRole("button", { name: "提交答案（13/13）", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator(".reading-score strong")).toHaveText("12 / 13");
  await expect(page.getByText("回答错误", { exact: true })).toHaveCount(1);
  await expect(page.getByText("参考答案", { exact: true })).toBeVisible();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].logs).toHaveLength(1);
  expect(writes[0].logs[0]).toMatchObject({ skill: "reading", correct: 12, total: 13, minutes: 20 });
  expect(writes[0].mistakes).toHaveLength(1);
  expect(writes[0].mistakes[0]).toMatchObject({ id: "reading-01-q1", skill: "reading", mastered: false });

  await page.getByRole("button", { name: "完成练习", exact: true }).click();
  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: /Passage 1 · Q1: Green roofs can only be installed/ })).toBeVisible();
});
