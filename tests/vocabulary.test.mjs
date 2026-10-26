import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const dataset = JSON.parse(await readFile(new URL("../src/data/vocabulary.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/lib/vocabulary.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { queryVocabulary } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const fixture = [
  {
    id: "library", w: "library", uk: "/ˈlaɪbrəri/", us: "/ˈlaɪbreri/", cefr: "A1", topic: "education",
    senses: [{ pos: "n.", zh: "图书馆", en: "A place where people borrow books." }],
    ex: [{ en: "I borrowed a book.", zh: "我借了一本书。" }, { en: "Libraries matter.", zh: "图书馆很重要。" }],
    col: [], fam: [], syn: [], ant: [], tip: "", note: "",
  },
  {
    id: "motivate", w: "motivate", uk: "/ˈməʊtɪveɪt/", us: "/ˈmoʊtɪveɪt/", cefr: "B2", topic: "education",
    senses: [{ pos: "v.", zh: "激励；促使", en: "To make someone want to do something." }],
    ex: [{ en: "Teachers motivate students.", zh: "老师激励学生。" }, { en: "Policy can motivate change.", zh: "政策可以推动改变。" }],
    col: [], fam: [], syn: ["inspire"], ant: [], tip: "", note: "",
  },
  {
    id: "veto", w: "veto", uk: "/ˈviːtəʊ/", us: "/ˈviːtoʊ/", cefr: "C1", topic: "government",
    senses: [{ pos: "v.", zh: "否决", en: "To reject a proposal." }],
    ex: [{ en: "The board vetoed it.", zh: "董事会否决了它。" }, { en: "A veto can delay reform.", zh: "否决权可能拖延改革。" }],
    col: [], fam: [], syn: [], ant: ["approve"], tip: "", note: "",
  },
];

test("dataset metadata matches its word list", () => {
  assert.equal(dataset.meta.license, "CC BY 4.0");
  assert.equal(dataset.meta.attribution, "Word Atlas contributors");
  assert.equal(dataset.meta.count, dataset.words.length);
  assert.equal(dataset.words.length, 3735);
  assert.deepEqual(dataset.meta.cefr, ["B2", "C1"]);
});

test("every word has the required learning fields", () => {
  const ids = new Set();
  for (const word of dataset.words) {
    assert.equal(typeof word.id, "string");
    assert.ok(word.id.length > 0);
    assert.equal(ids.has(word.id), false, `duplicate id ${word.id}`);
    ids.add(word.id);
    assert.ok(["B2", "C1"].includes(word.cefr), `${word.id}: cefr`);
    assert.ok(dataset.meta.cefr.includes(word.cefr));
    assert.equal(word.senses.length >= 1 && word.senses.length <= 3, true, `${word.id}: senses`);
    assert.equal(word.ex.length, 2, `${word.id}: examples`);
    for (const field of ["col", "fam", "syn", "ant"]) assert.ok(Array.isArray(word[field]), `${word.id}: ${field}`);
    assert.equal(typeof word.tip, "string", `${word.id}: tip`);
  }
});

test("filters by CEFR, topic and paginates", () => {
  const b2 = queryVocabulary(fixture, { cefr: "B2" });
  assert.deepEqual(b2.words.map((word) => word.id), ["motivate"]);
  const education = queryVocabulary(fixture, { topic: "education" });
  assert.deepEqual(education.words.map((word) => word.id), ["library", "motivate"]);
  const page = queryVocabulary(fixture, { page: 2, pageSize: 2 });
  assert.equal(page.total, 3);
  assert.deepEqual(page.words.map((word) => word.id), ["veto"]);
});

test("searches the word, Chinese meaning and English definition", () => {
  assert.deepEqual(queryVocabulary(fixture, { q: "veto" }).words.map((word) => word.id), ["veto"]);
  assert.deepEqual(queryVocabulary(fixture, { q: "激励" }).words.map((word) => word.id), ["motivate"]);
  assert.deepEqual(queryVocabulary(fixture, { q: "BORROW" }).words.map((word) => word.id), ["library"]);
  assert.equal(queryVocabulary(fixture, { q: "missing" }).total, 0);
});

test("clamps page size and keeps stable empty results", () => {
  assert.equal(queryVocabulary(fixture, { pageSize: 1000 }).pageSize, 100);
  assert.equal(queryVocabulary(fixture, { pageSize: 0 }).pageSize, 1);
  const empty = queryVocabulary(fixture, { page: 10, pageSize: 10 });
  assert.equal(empty.total, 3);
  assert.deepEqual(empty.words, []);
});
