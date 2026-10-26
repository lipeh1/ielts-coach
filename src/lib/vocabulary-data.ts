import dataset from "@/data/vocabulary.json";
import { queryVocabulary, type VocabularyPage, type VocabularyQuery, type VocabularyWord } from "@/lib/vocabulary";

type VocabularyMeta = {
  id: string;
  version: number;
  source: string;
  sourceRef: string;
  retrievedAt: string;
  license: string;
  attribution: string;
  cefr: string[];
  count: number;
};

const parsed = dataset as unknown as { meta: VocabularyMeta; words: VocabularyWord[] };
const byId = new Map(parsed.words.map((word) => [word.id, word]));

export const vocabularyMeta = parsed.meta;

export function findVocabularyWord(id: string): VocabularyWord | null {
  return byId.get(id) ?? null;
}

export function listVocabulary(query: VocabularyQuery): VocabularyPage {
  return queryVocabulary(parsed.words, query);
}
