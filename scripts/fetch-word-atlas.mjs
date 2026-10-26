import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRef = "4ff9c429745c12506a9d07d3c29f0791a66191d5";
const url = `https://cdn.jsdelivr.net/gh/designfuchen/word-atlas@${sourceRef}/data/word-atlas.json`;
const outputPath = process.argv[2] ?? ".tmp/word-atlas/word-atlas.json";

const response = await fetch(url);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
const body = await response.text();
JSON.parse(body);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, body, "utf8");
console.log(`Wrote ${body.length} bytes to ${outputPath}`);
