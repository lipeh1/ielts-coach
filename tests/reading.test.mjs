import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const passage = JSON.parse(await readFile(new URL("../src/data/reading/passage-01.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/lib/reading.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { gradeReadingPassage, gradeReadingQuestion, normalizeAnswer } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("passage contains four labelled paragraphs and six headings", () => {
  assert.equal(passage.version, 1);
  assert.equal(passage.title.length > 0, true);
  assert.equal(passage.minutes > 0, true);
  assert.deepEqual(passage.paragraphs.map((paragraph) => paragraph.label), ["A", "B", "C", "D"]);
  assert.deepEqual(passage.headings.map((heading) => heading.id), ["A", "B", "C", "D", "E", "F"]);
  assert.equal(passage.paragraphs.every((paragraph) => paragraph.text.length > 100), true);
});

test("has 13 questions split across the three required types", () => {
  assert.equal(passage.questions.length, 13);
  assert.deepEqual(passage.questions.map((question) => question.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const ids = new Set(passage.questions.map((question) => question.id));
  assert.equal(ids.size, passage.questions.length);

  const counts = passage.questions.reduce((result, question) => {
    result[question.type] = (result[question.type] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    "true-false-not-given": 5,
    "matching-headings": 4,
    "summary-completion": 4,
  });
});

test("every answer key is complete and evidence is verbatim", () => {
  const passageText = passage.paragraphs.map((paragraph) => paragraph.text).join(" ");
  const headingIds = new Set(passage.headings.map((heading) => heading.id));

  for (const question of passage.questions) {
    assert.equal(question.prompt.length > 0, true, `${question.id}: prompt`);
    assert.equal(question.explanation.length > 0, true, `${question.id}: explanation`);

    if (question.type === "true-false-not-given") {
      assert.equal(["True", "False", "Not Given"].includes(question.answer), true, `${question.id}: answer`);
      assert.equal(typeof question.evidence, "string", `${question.id}: evidence`);
      if (question.answer !== "Not Given") {
        assert.equal(question.evidence.length > 0, true, `${question.id}: evidence must exist`);
        assert.equal(passageText.includes(question.evidence), true, `${question.id}: evidence must be verbatim`);
      }
    } else if (question.type === "matching-headings") {
      assert.equal(headingIds.has(question.answer), true, `${question.id}: heading`);
      assert.equal(passageText.includes(question.evidence), true, `${question.id}: evidence must be verbatim`);
    } else {
      assert.equal(Array.isArray(question.answers) && question.answers.length > 0, true, `${question.id}: answers`);
      assert.equal(question.answers.every((answer) => answer.length > 0), true, `${question.id}: answer text`);
      assert.equal(passageText.includes(question.evidence), true, `${question.id}: evidence must be verbatim`);
    }
  }
});

test("grades true/false/not-given and matching headings without case sensitivity", () => {
  const tfng = passage.questions.find((question) => question.id === "q1");
  const notGiven = passage.questions.find((question) => question.id === "q3");
  const heading = passage.questions.find((question) => question.id === "q6");

  assert.deepEqual(gradeReadingQuestion(tfng, " false "), { correct: true, expected: "False" });
  assert.equal(gradeReadingQuestion(tfng, "True").correct, false);
  assert.equal(gradeReadingQuestion(notGiven, "not given").correct, true);
  assert.equal(gradeReadingQuestion(heading, "b").correct, true);
  assert.equal(gradeReadingQuestion(heading, "A").correct, false);
});

test("accepts summary alternatives and ignores trailing punctuation", () => {
  const completion = passage.questions.find((question) => question.id === "q10");
  assert.equal(gradeReadingQuestion(completion, "Drainage systems.").correct, true);
  assert.equal(gradeReadingQuestion(completion, "drains").correct, true);
  assert.equal(gradeReadingQuestion(completion, " drainage   system ").correct, true);
  assert.equal(gradeReadingQuestion(completion, "drainage").correct, false);
  assert.equal(gradeReadingQuestion(completion, "").correct, false);
  assert.equal(normalizeAnswer("  Drought-Resistant. "), "drought-resistant");
});

test("grades the full passage and counts correct answers", () => {
  const answers = Object.fromEntries(passage.questions.map((question) => [
    question.id,
    question.type === "summary-completion" ? question.answers[0] : question.answer,
  ]));
  const perfect = gradeReadingPassage(passage, answers);
  assert.equal(perfect.correct, 13);
  assert.equal(perfect.total, 13);
  assert.equal(perfect.results.every((result) => result.correct), true);

  const oneWrong = gradeReadingPassage(passage, { ...answers, q5: "True" });
  assert.equal(oneWrong.correct, 12);
  assert.equal(oneWrong.results.find((result) => result.question.id === "q5").correct, false);

  const blank = gradeReadingPassage(passage, {});
  assert.equal(blank.correct, 0);
  assert.equal(blank.total, 13);
});
