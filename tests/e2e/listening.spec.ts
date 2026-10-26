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

const section = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/listening/section-01.json"), "utf8")) as {
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

test("full listening section plays once in exam mode and records a wrong answer", async ({ page }) => {
  const writes = await mockStudy(page);
  await page.addInitScript(() => {
    class FakeUtterance {
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: FakeUtterance) {
          setTimeout(() => utterance.onend?.(), 10);
        },
      },
    });
  });

  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);

  await page.getByRole("button", { name: "练习中心", exact: true }).first().click();
  await page.locator(".practice-card").filter({ has: page.getByRole("heading", { name: /^听力/ }) }).getByRole("button", { name: "开始练习" }).click();

  await expect(page.getByRole("heading", { name: "Riverside Community Garden Volunteer Induction" })).toBeVisible();
  await expect(page.locator(".reading-question")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "练习模式 · 可重复", exact: true })).toHaveClass(/selected/);

  await page.getByRole("button", { name: "考试模式 · 只播一遍", exact: true }).click();
  await page.getByRole("button", { name: "播放听力", exact: true }).click();
  await expect(page.getByText("已播放一次", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "播放听力", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "练习模式 · 可重复", exact: true })).toBeDisabled();

  for (const question of section.questions) {
    if (question.type === "multiple-choice") {
      const card = page.locator(".reading-question").filter({ hasText: question.prompt });
      const answer = question.number === 3 ? "A" : question.answer!;
      await card.getByRole("button", { name: new RegExp(`^${answer}\\.`) }).click();
    } else {
      await page.getByLabel(`Question ${question.number} answer`).fill(question.answers![0]);
    }
  }

  const submit = page.getByRole("button", { name: "提交答案（10/10）", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator(".reading-score strong")).toHaveText("9 / 10");
  await expect(page.getByText("回答错误", { exact: true })).toHaveCount(1);
  await expect(page.getByText("参考答案", { exact: true })).toBeVisible();
  await expect(page.getByText("查看听力原文", { exact: true })).toBeVisible();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].logs).toHaveLength(1);
  expect(writes[0].logs[0]).toMatchObject({ skill: "listening", correct: 9, total: 10, minutes: 10 });
  expect(writes[0].mistakes).toHaveLength(1);
  expect(writes[0].mistakes[0]).toMatchObject({ id: "listening-01-q3", skill: "listening", mastered: false });

  await page.getByText("查看听力原文", { exact: true }).click();
  await expect(page.locator(".listening-transcript p").filter({ hasText: "The garden was created in 2005" })).toBeVisible();

  await page.getByRole("button", { name: "完成练习", exact: true }).click();
  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: /Listening Section 2 · Q3/ })).toBeVisible();
});
