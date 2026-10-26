import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/feedback.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { calculateOverallBand, countWords, normalizeEvidence, splitParagraphs, validateFeedback } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const essay = "Some people believe that remote work improves productivity. They argue that employees save commuting time and can focus on deep work.\n\nOthers argue that offices support collaboration. This essay discusses both views and gives my opinion.";
const names = ["TR · 任务回应", "CC · 连贯与衔接", "LR · 词汇资源", "GRA · 语法多样性与准确性"];

function validFeedback(overrides = {}) {
  return {
    overallBand: 9,
    criteria: [
      { name: names[0], band: 6, observation: "任务有回应。", evidence: "Some people believe that remote work improves productivity.", suggestion: "补足双方论证。" },
      { name: names[1], band: 7, observation: "衔接清楚。", evidence: "This essay discusses both views", suggestion: "减少机械连接词。" },
      { name: names[2], band: 6, observation: "词汇够用。", evidence: "collaboration", suggestion: "增加搭配变化。" },
      { name: names[3], band: 7, observation: "句式有变化。", evidence: "Others argue that offices support collaboration.", suggestion: "检查冠词。" },
    ],
    polish: [
      { paragraph: 1, rewrite: "Some people argue that remote work raises productivity because it saves commuting time and allows deep focus.", translation: "有些人认为远程工作能提高生产率，因为它节省通勤时间并支持深度专注。" },
      { paragraph: 2, rewrite: "Others claim that offices encourage collaboration; this essay examines both views before giving my opinion.", translation: "另一些人认为办公室有助于协作；本文会讨论双方观点，再给出我的看法。" },
    ],
    nextStep: "下一次先写清每段中心句。",
    ...overrides,
  };
}

function expectReject(overrides, pattern) {
  assert.throws(() => validateFeedback(validFeedback(overrides), essay), pattern);
}

test("counts words and splits paragraphs on blank lines", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n\t "), 0);
  assert.equal(countWords("one  two\nthree\tfour"), 4);
  assert.equal(splitParagraphs(essay).length, 2);
  assert.equal(splitParagraphs("One paragraph only.").length, 1);
  assert.equal(splitParagraphs("  A.\n\n\n B. \n\n C. ").length, 3);
});

test("calculates overall band from the four criteria and rounds to half bands", () => {
  assert.equal(calculateOverallBand([6, 6, 6, 6]), 6);
  assert.equal(calculateOverallBand([6, 7, 6, 7]), 6.5);
  assert.equal(calculateOverallBand([6.5, 6.5, 6, 6.5]), 6.5);
  assert.equal(calculateOverallBand([5, 5, 5, 6]), 5.5);
  assert.equal(calculateOverallBand([6, 6, 6, 7]), 6.5);
  assert.equal(calculateOverallBand([6, 6, 6, 6.5]), 6);
  assert.throws(() => calculateOverallBand([6, 6, 6]), /four/);
});

test("accepts four fixed criteria, paragraph polish and ignores the model overall band", () => {
  const report = validateFeedback(validFeedback(), essay);
  assert.equal(report.overallBand, 6.5);
  assert.deepEqual(report.criteria.map((criterion) => criterion.name), names);
  assert.deepEqual(report.criteria.map((criterion) => criterion.band), [6, 7, 6, 7]);
  assert.equal(report.criteria.every((criterion) => criterion.evidenceMissing === false), true);
  assert.deepEqual(report.polish.map((paragraph) => paragraph.paragraph), [1, 2]);
  assert.equal(report.polish[0].original, splitParagraphs(essay)[0]);
  assert.equal(report.polish[1].original, splitParagraphs(essay)[1]);
  assert.equal(report.nextStep, "下一次先写清每段中心句。");
});

test("blanks evidence that is not a verbatim substring and marks it missing", () => {
  const raw = validFeedback();
  raw.criteria[0].evidence = "This sentence was invented by the model.";
  raw.criteria[1].evidence = "   ";
  const report = validateFeedback(raw, essay);
  assert.equal(report.criteria[0].evidence, "");
  assert.equal(report.criteria[0].evidenceMissing, true);
  assert.equal(report.criteria[1].evidence, "");
  assert.equal(report.criteria[1].evidenceMissing, true);
  assert.equal(report.criteria[2].evidence, "collaboration");
});

test("normalizes quotes and whitespace when validating evidence", () => {
  const raw = validFeedback();
  raw.criteria[0].evidence = `“${raw.criteria[0].evidence}”`;
  raw.criteria[1].evidence = raw.criteria[1].evidence.replace(/ /g, "   ");
  const report = validateFeedback(raw, essay);
  assert.equal(report.criteria[0].evidenceMissing, false);
  assert.equal(report.criteria[1].evidenceMissing, false);
  assert.equal(report.criteria[0].evidence, "Some people believe that remote work improves productivity.");

  const ellipsis = validFeedback();
  ellipsis.criteria[0].evidence = `${ellipsis.criteria[0].evidence} ...`;
  assert.equal(validateFeedback(ellipsis, essay).criteria[0].evidenceMissing, true);
  assert.equal(normalizeEvidence("  “Hello   world.”  "), "Hello world.");
});

test("rejects extra, renamed, reordered or non-object criteria", () => {
  expectReject({ criteria: [...validFeedback().criteria, validFeedback().criteria[0]] }, /exactly four/);
  const renamed = validFeedback().criteria;
  renamed[0] = { ...renamed[0], name: "TA · 任务回应" };
  expectReject({ criteria: renamed }, /must be TR/);
  const reordered = validFeedback().criteria;
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  expectReject({ criteria: reordered }, /must be TR/);
  expectReject({ criteria: [null, ...validFeedback().criteria.slice(1)] }, /not an object/);
  expectReject({ criteria: "not an array" }, /exactly four/);
});

test("rejects decimal, string, negative and out-of-range bands", () => {
  for (const band of [6.5, "6", -1, 10, Number.NaN, null]) {
    const raw = validFeedback();
    raw.criteria[0] = { ...raw.criteria[0], band };
    expectReject({ criteria: raw.criteria }, /integer band/);
  }
});

test("rejects missing explanations and next step", () => {
  const raw = validFeedback();
  raw.criteria[0] = { ...raw.criteria[0], observation: "  " };
  expectReject({ criteria: raw.criteria }, /observation/);
  const noSuggestion = validFeedback();
  noSuggestion.criteria[1] = { ...noSuggestion.criteria[1], suggestion: "" };
  expectReject({ criteria: noSuggestion.criteria }, /suggestion/);
  expectReject({ nextStep: "" }, /nextStep/);
  expectReject({ criteria: undefined }, /exactly four/);
});

test("requires one polish entry per paragraph with ordered non-empty text", () => {
  expectReject({ polish: undefined }, /polish every/);
  expectReject({ polish: [] }, /polish every/);
  expectReject({ polish: [validFeedback().polish[0]] }, /polish every/);

  const wrongOrder = validFeedback();
  wrongOrder.polish = [
    { ...wrongOrder.polish[0], paragraph: 2 },
    { ...wrongOrder.polish[1], paragraph: 1 },
  ];
  expectReject({ polish: wrongOrder.polish }, /out of order/);

  const emptyRewrite = validFeedback();
  emptyRewrite.polish[0] = { ...emptyRewrite.polish[0], rewrite: "  " };
  expectReject({ polish: emptyRewrite.polish }, /rewrite/);

  const emptyTranslation = validFeedback();
  emptyTranslation.polish[1] = { ...emptyTranslation.polish[1], translation: "" };
  expectReject({ polish: emptyTranslation.polish }, /translation/);
});
