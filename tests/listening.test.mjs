import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const section = JSON.parse(await readFile(new URL("../src/data/listening/section-01.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/lib/listening.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { gradeListeningQuestion, gradeListeningSection, normalizeAnswer } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("section has a 3-4 minute script and ten questions", () => {
  assert.equal(section.version, 1);
  assert.equal(section.title.length > 0, true);
  assert.equal(section.audioMinutes, 4);
  assert.equal(section.practiceMinutes, 10);
  assert.equal(Array.isArray(section.script) && section.script.length >= 8, true);

  const words = section.script.join(" ").trim().split(/\s+/).length;
  assert.equal(words >= 450 && words <= 700, true, `script has ${words} words`);

  assert.equal(section.questions.length, 10);
  assert.deepEqual(section.questions.map((question) => question.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const ids = new Set(section.questions.map((question) => question.id));
  assert.equal(ids.size, section.questions.length);

  const counts = section.questions.reduce((result, question) => {
    result[question.type] = (result[question.type] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { "multiple-choice": 4, "note-completion": 6 });
});

test("answer keys and evidence are complete", () => {
  const scriptText = section.script.join(" ");
  for (const question of section.questions) {
    assert.equal(question.prompt.length > 0, true, `${question.id}: prompt`);
    assert.equal(question.explanation.length > 0, true, `${question.id}: explanation`);
    assert.equal(scriptText.includes(question.evidence), true, `${question.id}: evidence must be verbatim`);

    if (question.type === "multiple-choice") {
      assert.equal(question.options.length, 3, `${question.id}: options`);
      assert.equal(question.options.some((option) => option.id === question.answer), true, `${question.id}: answer option`);
    } else {
      assert.equal(Array.isArray(question.answers) && question.answers.length > 0, true, `${question.id}: answers`);
      assert.equal(question.answers.every((answer) => answer.length > 0), true, `${question.id}: answer text`);
    }
  }
});

test("grades multiple choice without case sensitivity", () => {
  const question = section.questions.find((entry) => entry.id === "q1");
  assert.deepEqual(gradeListeningQuestion(question, "a"), { correct: true, expected: "A · To welcome new volunteers" });
  assert.equal(gradeListeningQuestion(question, "B").correct, false);
  assert.equal(gradeListeningQuestion(question, "").correct, false);
});

test("accepts note completion alternatives and ignores punctuation", () => {
  const six = section.questions.find((entry) => entry.id === "q5");
  const fortyFive = section.questions.find((entry) => entry.id === "q6");
  const openDay = section.questions.find((entry) => entry.id === "q9");
  const office = section.questions.find((entry) => entry.id === "q10");

  assert.equal(gradeListeningQuestion(six, "six").correct, true);
  assert.equal(gradeListeningQuestion(six, "6.").correct, true);
  assert.equal(gradeListeningQuestion(fortyFive, "forty five").correct, true);
  assert.equal(gradeListeningQuestion(fortyFive, "forty-five").correct, true);
  assert.equal(gradeListeningQuestion(openDay, "June 12").correct, true);
  assert.equal(gradeListeningQuestion(openDay, "12 June.").correct, true);
  assert.equal(gradeListeningQuestion(office, "The Volunteer Office").correct, true);
  assert.equal(gradeListeningQuestion(office, "office").correct, false);
  assert.equal(normalizeAnswer("  45. "), "45");
});

test("grades the full section and counts correct answers", () => {
  const answers = Object.fromEntries(section.questions.map((question) => [
    question.id,
    question.type === "multiple-choice" ? question.answer : question.answers[0],
  ]));
  const perfect = gradeListeningSection(section, answers);
  assert.equal(perfect.correct, 10);
  assert.equal(perfect.total, 10);

  const oneWrong = gradeListeningSection(section, { ...answers, q3: "A" });
  assert.equal(oneWrong.correct, 9);
  assert.equal(oneWrong.results.find((result) => result.question.id === "q3").correct, false);

  const blank = gradeListeningSection(section, {});
  assert.equal(blank.correct, 0);
  assert.equal(blank.total, 10);
});
