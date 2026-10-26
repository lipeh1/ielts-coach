import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/vocabulary-review.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { createVocabularyReview, dueVocabularyReviews, scheduleVocabularyReview } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const today = "2026-10-12";
const tomorrow = "2026-10-13";

test("creates a new review due today", () => {
  const review = createVocabularyReview("motivate", "motivate", "manual", today);
  assert.deepEqual(review, {
    id: "motivate",
    word: "motivate",
    source: "manual",
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    due: today,
    lastReviewed: null,
  });
});

test("good ratings grow intervals from 1 to 3 to 8 days", () => {
  const first = scheduleVocabularyReview(createVocabularyReview("motivate", "motivate", "manual", today), "good", today);
  assert.deepEqual(first, {
    id: "motivate", word: "motivate", source: "manual",
    interval: 1, ease: 2.5, repetitions: 1, due: tomorrow, lastReviewed: today,
  });

  const second = scheduleVocabularyReview(first, "good", tomorrow);
  assert.equal(second.interval, 3);
  assert.equal(second.repetitions, 2);
  assert.equal(second.due, "2026-10-16");

  const third = scheduleVocabularyReview(second, "good", "2026-10-16");
  assert.equal(third.interval, 8);
  assert.equal(third.repetitions, 3);
  assert.equal(third.due, "2026-10-24");
});

test("easy ratings start at two days and raise ease", () => {
  const first = scheduleVocabularyReview(createVocabularyReview("motivate", "motivate", "manual", today), "easy", today);
  assert.equal(first.interval, 2);
  assert.equal(first.repetitions, 1);
  assert.equal(first.ease, 2.65);
  assert.equal(first.due, "2026-10-14");

  const second = scheduleVocabularyReview(first, "easy", "2026-10-14");
  assert.equal(second.interval, 7);
  assert.equal(second.ease, 2.8);
});

test("again resets repetitions and lowers ease with a floor", () => {
  const review = { ...createVocabularyReview("motivate", "motivate", "manual", today), repetitions: 3, interval: 8, ease: 2.5 };
  const again = scheduleVocabularyReview(review, "again", today);
  assert.equal(again.repetitions, 0);
  assert.equal(again.interval, 1);
  assert.equal(again.ease, 2.3);
  assert.equal(again.due, tomorrow);

  const low = scheduleVocabularyReview({ ...again, ease: 1.4 }, "again", tomorrow);
  assert.equal(low.ease, 1.3);
  const floor = scheduleVocabularyReview(low, "again", "2026-10-14");
  assert.equal(floor.ease, 1.3);
});

test("handles month boundaries", () => {
  const review = createVocabularyReview("motivate", "motivate", "manual", "2026-10-31");
  const scheduled = scheduleVocabularyReview(review, "good", "2026-10-31");
  assert.equal(scheduled.due, "2026-11-01");
});

test("returns only due reviews in date and word order", () => {
  const reviews = [
    { ...createVocabularyReview("zebra", "zebra", "manual", "2026-10-12"), due: "2026-10-12" },
    { ...createVocabularyReview("apple", "apple", "manual", "2026-10-12"), due: "2026-10-11" },
    { ...createVocabularyReview("future", "future", "manual", "2026-10-12"), due: "2026-10-13" },
  ];
  assert.deepEqual(dueVocabularyReviews(reviews, today).map((entry) => entry.id), ["apple", "zebra"]);
  assert.deepEqual(dueVocabularyReviews(reviews, tomorrow).map((entry) => entry.id), ["apple", "zebra", "future"]);
});
