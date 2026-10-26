import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv[2] ?? ".tmp/word-atlas/word-atlas.json";
const outputPath = process.argv[3] ?? "src/data/vocabulary.json";
const levels = new Set(["B2", "C1"]);
const topics = new Set([
  "education", "work", "technology", "science", "environment", "health", "society",
  "government", "economy", "media", "arts", "travel", "city", "nature", "daily",
  "emotion", "thinking", "sport", "history",
]);

const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(source)) throw new Error(`${sourcePath} must contain an array`);

const words = [];
const seen = new Set();
for (const entry of source) {
  if (!levels.has(entry.cefr)) continue;
  const id = entry.id;
  if (typeof id !== "string" || !id) throw new Error(`Entry is missing id: ${JSON.stringify(entry.w)}`);
  if (seen.has(id)) throw new Error(`Duplicate id: ${id}`);
  if (typeof entry.w !== "string" || !entry.w) throw new Error(`${id}: missing w`);
  if (typeof entry.uk !== "string" || typeof entry.us !== "string") throw new Error(`${id}: missing IPA`);
  if (!Array.isArray(entry.senses) || entry.senses.length < 1 || entry.senses.length > 3) throw new Error(`${id}: invalid senses`);
  if (!Array.isArray(entry.ex) || entry.ex.length !== 2) throw new Error(`${id}: expected 2 examples`);
  if (!topics.has(entry.topic)) throw new Error(`${id}: unknown topic ${entry.topic}`);
  for (const field of ["col", "fam", "syn", "ant"]) {
    if (!Array.isArray(entry[field])) throw new Error(`${id}: ${field} must be an array`);
  }
  seen.add(id);
  words.push({
    id,
    w: entry.w,
    uk: entry.uk,
    us: entry.us,
    senses: entry.senses.map((sense) => ({ pos: sense.pos, zh: sense.zh, en: sense.en })),
    ex: entry.ex.map((example) => ({ en: example.en, zh: example.zh })),
    col: entry.col,
    fam: entry.fam,
    syn: entry.syn,
    ant: entry.ant,
    tip: entry.tip,
    cefr: entry.cefr,
    topic: entry.topic,
    note: entry.note ?? "",
  });
}

const dataset = {
  meta: {
    id: "word-atlas-b2-c1",
    version: 1,
    source: "https://github.com/designfuchen/word-atlas",
    sourceRef: "4ff9c429745c12506a9d07d3c29f0791a66191d5",
    retrievedAt: new Date().toISOString().slice(0, 10),
    license: "CC BY 4.0",
    attribution: "Word Atlas contributors",
    cefr: [...levels],
    count: words.length,
  },
  words,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(dataset), "utf8");
console.log(`Wrote ${words.length} ${dataset.meta.cefr.join("/")} words to ${outputPath}`);
