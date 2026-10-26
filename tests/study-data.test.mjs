import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/study-data.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { defaultData, isValidState } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function populatedData() {
  return {
    profile: { targetBand: "7.5", examDate: "2026-12-20", dailyTarget: 60 },
    logs: [{ id: "log-1", date: "2026-10-12", minutes: 10, skill: "listening", correct: 1, total: 1 }],
    mistakes: [{ id: "mistake-1", skill: "reading", question: "True or false?", reason: "Find the evidence.", date: "2026-10-11", mastered: false }],
    checkIns: ["2026-10-12"],
    feedbackHistory: [{ id: "writing-1", date: "2026-10-12", overall: 6.5, bands: { TR: 6, CC: 7, LR: 6, GRA: 7 } }],
    vocabularyReviews: [{ id: "motivate", word: "motivate", source: "manual", interval: 1, ease: 2.5, repetitions: 1, due: "2026-10-13", lastReviewed: "2026-10-12" }],
  };
}

test("accepts initial data and existing populated study records", () => {
  assert.equal(isValidState(defaultData()), true);
  assert.equal(isValidState(populatedData()), true);
});

test("default data returns independent objects and lists", () => {
  const first = defaultData();
  first.profile.targetBand = "9.0";
  first.checkIns.push("2026-10-12");
  first.feedbackHistory.push({ id: "writing-1", date: "2026-10-12", overall: 6.5, bands: { TR: 6, CC: 7, LR: 6, GRA: 7 } });
  first.vocabularyReviews.push({ id: "motivate", word: "motivate", source: "manual", interval: 0, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: null });
  assert.equal(defaultData().profile.targetBand, "7.0");
  assert.deepEqual(defaultData().checkIns, []);
  assert.deepEqual(defaultData().feedbackHistory, []);
  assert.deepEqual(defaultData().vocabularyReviews, []);
});

test("accepts legacy state without feedback history or vocabulary reviews", () => {
  const legacy = populatedData();
  delete legacy.feedbackHistory;
  delete legacy.vocabularyReviews;
  assert.equal(isValidState(legacy), true);
});

test("rejects malformed vocabulary review entries", () => {
  for (const vocabularyReviews of [
    {},
    [null],
    [{ id: 1, word: "motivate", source: "manual", interval: 0, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "", source: "manual", interval: 0, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "unknown", interval: 0, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "manual", interval: -1, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "manual", interval: 0, ease: 1.2, repetitions: 0, due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "manual", interval: 0, ease: 2.5, repetitions: "0", due: "2026-10-12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "manual", interval: 0, ease: 2.5, repetitions: 0, due: "2026/10/12", lastReviewed: null }],
    [{ id: "motivate", word: "motivate", source: "manual", interval: 0, ease: 2.5, repetitions: 0, due: "2026-10-12", lastReviewed: "yesterday" }],
  ]) {
    const value = populatedData();
    value.vocabularyReviews = vocabularyReviews;
    assert.equal(isValidState(value), false, JSON.stringify(vocabularyReviews));
  }
});

test("rejects malformed feedback history entries", () => {
  for (const feedbackHistory of [
    {},
    [null],
    [{ id: 1, date: "2026-10-12", overall: 6.5, bands: { TR: 6, CC: 7, LR: 6, GRA: 7 } }],
    [{ id: "writing-1", date: "2026/10/12", overall: 6.5, bands: { TR: 6, CC: 7, LR: 6, GRA: 7 } }],
    [{ id: "writing-1", date: "2026-10-12", overall: "6.5", bands: { TR: 6, CC: 7, LR: 6, GRA: 7 } }],
    [{ id: "writing-1", date: "2026-10-12", overall: 6.5 }],
    [{ id: "writing-1", date: "2026-10-12", overall: 6.5, bands: { TR: 6, CC: 7, LR: 6 } }],
    [{ id: "writing-1", date: "2026-10-12", overall: 6.5, bands: { TR: 6.5, CC: 7, LR: 6, GRA: 7 } }],
    [{ id: "writing-1", date: "2026-10-12", overall: 6.5, bands: { TR: 10, CC: 7, LR: 6, GRA: 7 } }],
  ]) {
    const value = populatedData();
    value.feedbackHistory = feedbackHistory;
    assert.equal(isValidState(value), false, JSON.stringify(feedbackHistory));
  }
});

test("rejects absent state, partial objects and missing collections", () => {
  for (const value of [null, undefined, {}, [], "", { profile: defaultData().profile }]) {
    assert.equal(isValidState(value), false);
  }
  for (const key of ["logs", "mistakes", "checkIns"]) {
    const value = populatedData();
    delete value[key];
    assert.equal(isValidState(value), false, `missing ${key}`);
    assert.equal(isValidState({ ...populatedData(), [key]: {} }), false, `non-array ${key}`);
  }
});

test("rejects profile values that previously passed through string or numeric coercion", () => {
  for (const profile of [
    { targetBand: 7.5 },
    { targetBand: "4.5" },
    { dailyTarget: "45" },
    { dailyTarget: 20 },
    { examDate: null },
    { examDate: "20/12/2026" },
  ]) {
    const value = populatedData();
    value.profile = { ...value.profile, ...profile };
    assert.equal(isValidState(value), false, JSON.stringify(profile));
  }
});

test("rejects malformed logs rather than loading them as a valid snapshot", () => {
  for (const log of [
    null,
    { skill: "math" },
    { id: 1 },
    { date: "2026/10/12" },
    { minutes: "10" },
    { correct: Number.NaN },
    { total: Number.POSITIVE_INFINITY },
  ]) {
    const value = populatedData();
    value.logs = [log === null ? null : { ...value.logs[0], ...log }];
    assert.equal(isValidState(value), false);
  }
});

test("rejects malformed mistakes and check-in dates", () => {
  for (const mistake of [null, { skill: "math" }, { question: null }, { reason: 1 }, { mastered: "false" }, { date: "yesterday" }]) {
    const value = populatedData();
    value.mistakes = [mistake === null ? null : { ...value.mistakes[0], ...mistake }];
    assert.equal(isValidState(value), false);
  }
  assert.equal(isValidState({ ...populatedData(), checkIns: [null] }), false);
  assert.equal(isValidState({ ...populatedData(), checkIns: ["2026/10/12"] }), false);
});
