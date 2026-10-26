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

export function matchVocabularyInText(text: string, words: VocabularyWord[], limit = 5): VocabularyWord[] {
  if (limit <= 0) return [];
  const index = new Map(words.map((word) => [word.w.toLowerCase(), word]));
  const matches = new Map<string, VocabularyWord>();

  for (const token of text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []) {
    const normalized = token.toLowerCase().replace(/'s$/, "");
    for (const candidate of [normalized, ...stemCandidates(normalized)]) {
      const word = index.get(candidate);
      if (word) {
        matches.set(word.id, word);
        break;
      }
    }
    if (matches.size >= limit) break;
  }

  return [...matches.values()];
}
