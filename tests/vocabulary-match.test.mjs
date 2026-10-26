import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/vocabulary-match.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { matchVocabularyInText } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const bank = [
  "government", "sustainable", "pollution", "motivate", "induction", "structural", "reinforcement",
].map((word) => ({ id: word, w: word }));

test("matches exact vocabulary in case-insensitive text order", () => {
  const matches = matchVocabularyInText("Sustainable development must reduce pollution.", bank);
  assert.deepEqual(matches.map((word) => word.id), ["sustainable", "pollution"]);
});

test("matches simple plurals, past tense and other stems", () => {
  assert.deepEqual(matchVocabularyInText("Governments should act.", bank).map((word) => word.id), ["government"]);
  assert.deepEqual(matchVocabularyInText("The team was motivated.", bank).map((word) => word.id), ["motivate"]);
  assert.deepEqual(matchVocabularyInText("The induction covers structural reinforcement.", bank).map((word) => word.id), ["induction", "structural", "reinforcement"]);
});

test("deduplicates words, ignores Chinese and respects the limit", () => {
  assert.deepEqual(matchVocabularyInText("sustainable sustainable 可持续", bank).map((word) => word.id), ["sustainable"]);
  assert.equal(matchVocabularyInText("sustainable pollution government", bank, 2).length, 2);
  assert.deepEqual(matchVocabularyInText("sustainable", bank, 0), []);
});
