import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/vocabulary-spelling.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { damerauLevenshtein, findMisspelledVocabularyWords } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const bank = [
  "environment", "government", "sustainable", "motivated", "receive", "thought",
].map((word) => ({ id: word, w: word }));

test("finds likely misspellings with the same first and last letters", () => {
  assert.deepEqual(findMisspelledVocabularyWords("We must protect the enviroment and goverment.", bank).map((word) => word.id), ["environment", "government"]);
  assert.deepEqual(findMisspelledVocabularyWords("Sustainible growth and motivted staff.", bank).map((word) => word.id), ["sustainable", "motivated"]);
  assert.deepEqual(findMisspelledVocabularyWords("We recieve a benefit.", bank).map((word) => word.id), ["receive"]);
});

test("does not flag exact words, valid inflections or different endings", () => {
  assert.deepEqual(findMisspelledVocabularyWords("environment governments motivated", bank), []);
  assert.deepEqual(findMisspelledVocabularyWords("We thought about it, though it was hard.", bank), []);
});

test("deduplicates corrections, ignores Chinese and respects the limit", () => {
  assert.deepEqual(findMisspelledVocabularyWords("motivted motivted 动机", bank).map((word) => word.id), ["motivated"]);
  assert.equal(findMisspelledVocabularyWords("enviroment goverment sustainible motivted", bank, 2).length, 2);
  assert.deepEqual(findMisspelledVocabularyWords("enviroment", bank, 0), []);
});

test("computes Damerau distance with transpositions as one edit", () => {
  assert.equal(damerauLevenshtein("recieve", "receive"), 1);
  assert.equal(damerauLevenshtein("motivted", "motivated"), 1);
  assert.equal(damerauLevenshtein("environment", "environment"), 0);
  assert.equal(damerauLevenshtein("government", "goverment"), 1);
  assert.equal(damerauLevenshtein("environment", "enviroment"), 1);
});
