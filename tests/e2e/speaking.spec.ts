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

test("speaking practice records audio and allows local playback", async ({ page }) => {
  const writes = await mockStudy(page);
  await page.addInitScript(() => {
    class FakeMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      stream: unknown;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(stream: unknown) {
        this.stream = stream;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["fake audio"], { type: "audio/webm" }) });
        setTimeout(() => this.onstop?.(), 10);
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });

  await page.goto("/");
  await expect(page.getByText("正在读取学习记录，载入后即可开始练习。")).toHaveCount(0);
  await page.getByRole("button", { name: "练习中心", exact: true }).first().click();
  await page.locator(".practice-card").filter({ has: page.getByRole("heading", { name: /^口语/ }) }).getByRole("button", { name: "开始练习" }).click();
  await expect(page.getByRole("heading", { name: "Part 2：个人经历" })).toBeVisible();
  await expect(page.getByText("准备录音", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "开始录音", exact: true }).click();
  await expect(page.getByText("正在录音", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.getByText("录音完成", { exact: true })).toBeVisible();

  const playback = page.locator("audio.recording-playback");
  await expect(playback).toBeVisible();
  await expect(playback).toHaveAttribute("src", /^blob:/);

  await page.getByRole("button", { name: "完成口语练习", exact: true }).click();
  await expect(page.getByText("练习完成", { exact: true })).toBeVisible();
  await expect(page.getByText(/本次用时 1 分钟/)).toBeVisible();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].logs[0]).toMatchObject({ skill: "speaking", minutes: 1, correct: 0, total: 0 });
  expect(writes[0].mistakes).toHaveLength(0);
});
