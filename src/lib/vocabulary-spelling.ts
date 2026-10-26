import type { VocabularyWord } from "@/lib/vocabulary";

function stemCandidates(token: string): string[] {
  if (token.length < 5) return [];
  const candidates = new Set<string>();
  if (token.endsWith("ies")) candidates.add(`${token.slice(0, -3)}y`);
  if (token.endsWith("es")) candidates.add(token.slice(0, -2));
  if (token.endsWith("s")) candidates.add(token.slice(0, -1));
  if (token.endsWith("ed")) {
    candidates.add(token.slice(0, -2));
    candidates.add(token.slice(0, -1));
  }
  if (token.endsWith("ing")) {
    candidates.add(token.slice(0, -3));
    candidates.add(`${token.slice(0, -3)}e`);
  }
  if (token.endsWith("ly")) candidates.add(token.slice(0, -2));
  return [...candidates].filter((candidate) => candidate.length >= 3);
}

export function damerauLevenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, row) => {
    const values = new Array<number>(cols).fill(0);
    values[0] = row;
    return values;
  });
  for (let col = 1; col < cols; col += 1) distances[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + cost,
      );
      if (row > 1 && col > 1 && a[row - 1] === b[col - 2] && a[row - 2] === b[col - 1]) {
        distances[row][col] = Math.min(distances[row][col], distances[row - 2][col - 2] + 1);
      }
    }
  }

  return distances[rows - 1][cols - 1];
}

export function findMisspelledVocabularyWords(text: string, words: VocabularyWord[], limit = 5): VocabularyWord[] {
  if (limit <= 0) return [];
  const exact = new Set(words.map((word) => word.w.toLowerCase()));
  const buckets = new Map<string, VocabularyWord[]>();
  for (const word of words) {
    const candidate = word.w.toLowerCase();
    if (candidate.length < 5) continue;
    const key = `${candidate[0]}|${candidate[candidate.length - 1]}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(word);
    buckets.set(key, bucket);
  }

  const matches = new Map<string, VocabularyWord>();
  for (const token of text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []) {
    const normalized = token.toLowerCase().replace(/'s$/, "");
    if (normalized.length < 6) continue;
    if (exact.has(normalized)) continue;
    if (stemCandidates(normalized).some((candidate) => exact.has(candidate))) continue;

    const bucket = buckets.get(`${normalized[0]}|${normalized[normalized.length - 1]}`);
    if (!bucket) continue;
    for (const word of bucket) {
      const candidate = word.w.toLowerCase();
      if (Math.abs(candidate.length - normalized.length) > 1) continue;
      if (damerauLevenshtein(normalized, candidate) === 1) {
        matches.set(word.id, word);
        break;
      }
    }
    if (matches.size >= limit) break;
  }

  return [...matches.values()];
}
