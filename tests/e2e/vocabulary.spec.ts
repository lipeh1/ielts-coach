import { expect, test, type Page } from "@playwright/test";
import type { SavedData } from "../../src/lib/study-data";

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

test("browse a word, add it to review, reveal and rate it", async ({ page }) => {
  const writes = await mockStudy(page);
  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);

  await page.getByRole("button", { name: "词汇", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "词汇", exact: true })).toBeVisible();
  await expect(page.getByText("还没有加入复习的单词")).toBeVisible();

  await page.getByRole("tab", { name: "词库", exact: true }).click();
  await page.getByLabel("搜索词汇").fill("motivate");
  await page.getByRole("button", { name: "搜索", exact: true }).click();

  const item = page.locator(".vocab-list-item").filter({ hasText: "motivate" }).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.locator(".vocab-detail-head h2")).toHaveText("motivate");
  await page.getByRole("button", { name: "加入复习", exact: true }).click();
  await expect(page.getByRole("button", { name: "已在复习", exact: true })).toBeDisabled();

  await page.getByRole("tab", { name: /今日复习/ }).click();
  await expect(page.locator(".vocab-word")).toHaveText("motivate");
  await page.getByRole("button", { name: "显示答案", exact: true }).click();
  await expect(page.locator(".vocab-sense strong").filter({ hasText: "激励" }).first()).toBeVisible();
  await page.locator(".vocab-rating button.good").click();
  await expect(page.getByText("今天没有到期单词")).toBeVisible();

  await expect.poll(() => writes.at(-1)?.vocabularyReviews?.[0]?.repetitions).toBe(1);
  const review = writes.at(-1)?.vocabularyReviews?.[0];
  expect(review).toMatchObject({
    id: "motivate",
    word: "motivate",
    source: "manual",
    interval: 1,
    ease: 2.5,
    repetitions: 1,
  });
  expect(review?.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(review?.due).not.toBe(review?.lastReviewed);
  expect(writes.at(-1)?.checkIns).toHaveLength(1);
});
