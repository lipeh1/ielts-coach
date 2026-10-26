import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import type { SavedData } from "../../src/lib/study-data";

const names = ["TR · 任务回应", "CC · 连贯与衔接", "LR · 词汇资源", "GRA · 语法多样性与准确性"];
const evidence = [
  "Remote work can improve productivity.",
  "This essay discusses both views",
  "collaboration",
  "Offices support collaboration.",
];
const essay = "Remote work can improve productivity. Offices support collaboration. This essay discusses both views and gives my opinion. Some people prefer working from home, while others value the office. In my view, a hybrid model is best because it balances focus and teamwork.";

function reportFor(text: string) {
  const low = text.includes("LOW_BAND");
  const fake = text.includes("FAKE_EVIDENCE");
  const bands = low ? [5, 7, 6, 7] : [6, 7, 6, 7];
  return {
    demo: false,
    submissionId: `writing-ui-${createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24)}`,
    wordCount: text.trim().split(/\s+/).length,
    overallBand: 6.5,
    criteria: names.map((name, index) => ({
      name,
      band: bands[index],
      observation: `第 ${index + 1} 项观察。`,
      evidence: fake && index === 0 ? "Not in the essay." : evidence[index],
      evidenceMissing: fake && index === 0,
      suggestion: `第 ${index + 1} 项建议。`,
    })),
    polish: [{
      paragraph: 1,
      original: text,
      rewrite: `${text.replace("Some people prefer working from home", "Some employees prefer remote work")} This sentence has been revised for clarity.`,
      translation: "这是润色稿的中文翻译。",
    }],
    nextStep: "下一次先写清每段中心句。",
  };
}

async function mockApis(page: Page) {
  const writes: SavedData[] = [];
  const feedbackBodies: { essay: string; prompt?: string }[] = [];
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
  await page.route("**/api/feedback", async (route) => {
    const body = route.request().postDataJSON() as { essay: string; prompt?: string };
    feedbackBodies.push(body);
    await route.fulfill({ json: reportFor(body.essay) });
  });
  return { writes, feedbackBodies };
}

async function submit(page: Page, text: string) {
  await page.getByRole("button", { name: "AI 批改", exact: true }).click();
  await page.getByLabel("你的作文").fill(text);
  const [response] = await Promise.all([
    page.waitForResponse((item) => item.url().includes("/api/feedback") && item.request().method() === "POST"),
    page.getByRole("button", { name: "提交批改", exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "你的写作反馈" })).toBeVisible();
}

test("writing feedback shows the server report and records a low-band mistake only once", async ({ page }) => {
  const { writes, feedbackBodies } = await mockApis(page);
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);

  await submit(page, essay);
  expect(feedbackBodies.at(-1)?.prompt).toContain("Discuss both views");
  await expect(page.getByText("42 词 · 未达建议长度（不扣分）")).toBeVisible();
  await expect(page.getByText("本项未找到可核验原文")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "润色稿" })).toBeVisible();
  await expect(page.locator(".polish-translation span")).toHaveText("中文翻译");
  await expect(page.locator(".polish-rewrite ins").first()).toBeVisible();
  await expect(page.locator(".polish-rewrite del").first()).toBeVisible();
  await expect.poll(() => writes.at(-1)?.mistakes.length).toBe(0);

  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: "暂时没有待复习错题" })).toBeVisible();

  const lowEssay = `${essay} LOW_BAND`;
  await submit(page, lowEssay);
  await expect.poll(() => writes.at(-1)?.mistakes.length).toBe(1);

  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: "Writing Task 2 · TR · 任务回应" })).toBeVisible();

  await submit(page, lowEssay);
  await expect.poll(() => writes.at(-1)?.logs.length).toBe(3);
  expect(writes.at(-1)?.mistakes.length).toBe(1);
  await page.getByRole("button", { name: /错题复练/ }).first().click();
  await expect(page.getByRole("heading", { name: "Writing Task 2 · TR · 任务回应" })).toHaveCount(1);

  await submit(page, `${essay} FAKE_EVIDENCE`);
  await expect(page.getByText("本项未找到可核验原文")).toBeVisible();
});
