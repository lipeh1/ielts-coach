import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const dataSource = await readFile(new URL("../src/lib/study-data.ts", import.meta.url), "utf8");
const dataModuleUrl = moduleUrl(transpile(dataSource));
const { defaultData } = await import(dataModuleUrl);
const require = createRequire(import.meta.url);
const nextServerUrl = pathToFileURL(require.resolve("next/server")).href;
const routeSource = await readFile(new URL("../src/app/api/study/route.ts", import.meta.url), "utf8");
const routeModuleUrl = moduleUrl(transpile(routeSource)
  .replace('"@/lib/study-data"', JSON.stringify(dataModuleUrl))
  .replace('"next/server"', JSON.stringify(nextServerUrl)));

// The actual route captures its storage directory at import time. Redirect only
// that capture, then restore the working directory before running any tests.
const storageRoot = await mkdtemp(path.join(tmpdir(), "ielts-coach-storage-test-"));
const originalDirectory = process.cwd();
let route;
try {
  process.chdir(storageRoot);
  route = await import(routeModuleUrl);
} finally {
  process.chdir(originalDirectory);
}
after(async () => { await rm(storageRoot, { recursive: true, force: true }); });

const storageDir = path.join(storageRoot, "data");
const storageFile = path.join(storageDir, "study-state.json");

function populatedData() {
  return {
    ...defaultData(),
    profile: { targetBand: "7.5", examDate: "2026-12-20", dailyTarget: 60 },
    logs: [{ id: "existing-log", date: "2026-10-12", minutes: 10, skill: "listening", correct: 1, total: 1 }],
    mistakes: [{ id: "existing-mistake", skill: "reading", question: "True or false?", reason: "Use the passage.", date: "2026-10-11", mastered: false }],
    checkIns: ["2026-10-12"],
  };
}

function putRequest(state) {
  return new Request("http://localhost/api/study", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

test("GET confirms a missing file is empty without creating it", async () => {
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { state: null });
  await assert.rejects(readFile(storageFile), { code: "ENOENT" });
});

test("PUT followed by GET preserves every field of existing study records", async () => {
  const state = populatedData();
  const saved = await route.PUT(putRequest(state));
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { saved: true });
  assert.deepEqual(JSON.parse(await readFile(storageFile, "utf8")), state);
  const loaded = await route.GET();
  assert.equal(loaded.status, 200);
  assert.deepEqual(await loaded.json(), { state });
});

test("GET rejects malformed, incomplete and literal null stored data without changing it", async (context) => {
  context.mock.method(console, "error", () => {});
  await mkdir(storageDir, { recursive: true });
  for (const contents of ["{broken-json", "{}", "null"]) {
    await writeFile(storageFile, contents, "utf8");
    const response = await route.GET();
    assert.equal(response.status, 500, contents);
    assert.equal(typeof (await response.json()).error, "string");
    assert.equal(await readFile(storageFile, "utf8"), contents);
  }
});

test("PUT rejects invalid data and preserves the prior file byte for byte", async () => {
  const existing = JSON.stringify(populatedData(), null, 2);
  await writeFile(storageFile, existing, "utf8");
  const invalidState = populatedData();
  invalidState.profile.dailyTarget = "60";
  const response = await route.PUT(putRequest(invalidState));
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
  assert.equal(await readFile(storageFile, "utf8"), existing);
});
