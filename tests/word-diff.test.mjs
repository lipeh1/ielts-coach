import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/word-diff.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { diffWords } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function render(tokens, types) {
  return tokens.filter((token) => types.includes(token.type)).map((token) => token.text).join(" ");
}

test("returns no changes for identical text", () => {
  assert.deepEqual(diffWords("The office is quiet.", "The office is quiet."), [
    { type: "same", text: "The office is quiet." },
  ]);
});

test("marks additions in red-ready tokens", () => {
  const tokens = diffWords("The office is quiet.", "The office is very quiet.");
  assert.deepEqual(tokens, [
    { type: "same", text: "The office is" },
    { type: "add", text: "very" },
    { type: "same", text: "quiet." },
  ]);
});

test("marks deletions with removed tokens", () => {
  const tokens = diffWords("The office is very quiet.", "The office is quiet.");
  assert.deepEqual(tokens, [
    { type: "same", text: "The office is" },
    { type: "remove", text: "very" },
    { type: "same", text: "quiet." },
  ]);
});

test("reconstructs both versions from same/add and same/remove tokens", () => {
  const original = "Some people prefer working from home, while others value the office.";
  const revised = "Some employees prefer remote work, while others value the office.";
  const tokens = diffWords(original, revised);
  assert.equal(render(tokens, ["same", "remove"]), original);
  assert.equal(render(tokens, ["same", "add"]), revised);
  assert.equal(tokens.some((token) => token.type === "add"), true);
  assert.equal(tokens.some((token) => token.type === "remove"), true);
});

test("handles empty strings and keeps punctuation attached", () => {
  assert.deepEqual(diffWords("", ""), []);
  assert.deepEqual(diffWords("Hello, world!", ""), [{ type: "remove", text: "Hello, world!" }]);
  assert.deepEqual(diffWords("", "Hello, world!"), [{ type: "add", text: "Hello, world!" }]);
});
