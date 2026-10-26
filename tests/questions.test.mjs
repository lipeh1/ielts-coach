import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const data = JSON.parse(await readFile(new URL("../src/data/questions/task2.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/lib/questions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { isTask2Type, pickDailyQuestion, task2TypeLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("question bank has 20 unique tagged prompts", () => {
  assert.equal(data.version, 1);
  assert.equal(data.questions.length, 20);

  const ids = new Set();
  const prompts = new Set();
  const counts = {};
  for (const question of data.questions) {
    assert.equal(typeof question.id, "string");
    assert.ok(question.id.length > 0);
    assert.equal(ids.has(question.id), false, `duplicate id ${question.id}`);
    ids.add(question.id);
    assert.equal(isTask2Type(question.type), true, `unknown type ${question.type}`);
    assert.equal(typeof question.prompt, "string");
    assert.ok(question.prompt.length >= 60, `${question.id} prompt is too short`);
    assert.equal(prompts.has(question.prompt), false, `duplicate prompt ${question.id}`);
    prompts.add(question.prompt);
    counts[question.type] = (counts[question.type] ?? 0) + 1;
  }

  assert.deepEqual(Object.keys(task2TypeLabels), ["opinion", "discussion", "advantages", "problemSolution", "twoPart"]);
  for (const type of Object.keys(task2TypeLabels)) assert.equal(counts[type], 4, `${type} count`);
});

test("rotates one question per day and is stable within a day", () => {
  const first = pickDailyQuestion(data.questions, "2026-10-26");
  const same = pickDailyQuestion(data.questions, "2026-10-26");
  const next = pickDailyQuestion(data.questions, "2026-10-27");
  assert.equal(first.id, same.id);
  assert.notEqual(first.id, next.id);
  assert.equal(data.questions.includes(first), true);
});

test("falls back to the first question for invalid dates and rejects empty banks", () => {
  assert.equal(pickDailyQuestion(data.questions, "not-a-date").id, data.questions[0].id);
  assert.throws(() => pickDailyQuestion([], "2026-10-26"), /empty/);
});

test("guards against prototype keys when checking question types", () => {
  assert.equal(isTask2Type("toString"), false);
  assert.equal(isTask2Type("discussion"), true);
});
