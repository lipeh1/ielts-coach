import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/practice-time.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { elapsedMinutes } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("rounds elapsed time to the nearest minute with a one-minute floor", () => {
  const start = 1_000_000;
  assert.equal(elapsedMinutes(null, start), 1);
  assert.equal(elapsedMinutes(start, start + 30_000), 1);
  assert.equal(elapsedMinutes(start, start + 60_000), 1);
  assert.equal(elapsedMinutes(start, start + 89_000), 1);
  assert.equal(elapsedMinutes(start, start + 90_000), 2);
  assert.equal(elapsedMinutes(start, start + 5 * 60_000), 5);
  assert.equal(elapsedMinutes(start, start + 150_000), 3);
});

test("never reports less than one minute for clock changes", () => {
  assert.equal(elapsedMinutes(1_000_000, 900_000), 1);
});
