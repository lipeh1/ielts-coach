import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import type { SavedData } from "../../src/lib/study-data";

const names = ["TR · 任务回应", "CC · 连贯与衔接", "LR · 词汇资源", "GRA · 语法多样性与准确性"];
const bands = [6, 7, 6, 7];
const evidence = "The city should protect its environment.";

function reportFor(text: string) {
  return {
    demo: false,
    submissionId: `writing-${createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24)}`,
    wordCount: text.trim().split(/\s+/).length,
    overallBand: 6.5,
    criteria: names.map((name, index) => ({
      name,
      band: bands[index],
      observation: index === 2 ? "建议补充细节。" : "观察。",
      evidence,
      evidenceMissing: false,
      suggestion: index === 2 ? "建议补充细节。" : "建议。",
    })),
    polish: [{ paragraph: 1, original: text, rewrite: text, translation: "译文。" }],
    nextStep: "下一步。",
  };
}

async function mockApis(page: Page) {
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
  await page.route("**/api/feedback", async (route) => {
    const body = route.request().postDataJSON() as { essay: string };
    await route.fulfill({ json: reportFor(body.essay) });
  });
  return writes;
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

test("adds a misspelled vocabulary word only after the second occurrence", async ({ page }) => {
  const writes = await mockApis(page);
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);

  await submit(page, "The city should protect its environment. We must also consider motivted citizens and cleaner transport.");
  await expect.poll(() => writes.at(-1)?.vocabularySignals?.find((signal) => signal.id === "motivated")?.count).toBe(1);
  expect((writes.at(-1)?.vocabularyReviews ?? []).some((review) => review.id === "motivated")).toBe(false);

  await submit(page, "The city should protect its environment. A motivted workforce can support cleaner transport and better public services.");
  await expect.poll(() => writes.at(-1)?.vocabularySignals?.find((signal) => signal.id === "motivated")?.count).toBe(2);
  await expect.poll(() => (writes.at(-1)?.vocabularyReviews ?? []).some((review) => review.id === "motivated" && review.source === "writing")).toBe(true);
});
