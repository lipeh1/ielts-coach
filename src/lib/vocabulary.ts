export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof cefrLevels)[number];

export const vocabularyTopics = [
  "education", "work", "technology", "science", "environment", "health", "society",
  "government", "economy", "media", "arts", "travel", "city", "nature", "daily",
  "emotion", "thinking", "sport", "history",
] as const;
export type VocabularyTopic = (typeof vocabularyTopics)[number];

export type VocabularySense = { pos: string; zh: string; en: string };
export type VocabularyExample = { en: string; zh: string };
export type VocabularyWord = {
  id: string;
  w: string;
  uk: string;
  us: string;
  senses: VocabularySense[];
  ex: VocabularyExample[];
  col: string[];
  fam: string[];
  syn: string[];
  ant: string[];
  tip: string;
  cefr: Cefr;
  topic: VocabularyTopic;
  note: string;
};

export type VocabularyQuery = {
  q?: string;
  cefr?: string;
  topic?: string;
  page?: number;
  pageSize?: number;
};

export type VocabularyPage = {
  total: number;
  page: number;
  pageSize: number;
  words: VocabularyWord[];
};

export function isCefr(value: string): value is Cefr {
  return (cefrLevels as readonly string[]).includes(value);
}

export function isVocabularyTopic(value: string): value is VocabularyTopic {
  return (vocabularyTopics as readonly string[]).includes(value);
}

export function queryVocabulary(words: VocabularyWord[], query: VocabularyQuery = {}): VocabularyPage {
  const term = query.q?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20)));

  const filtered = words.filter((word) => {
    if (query.cefr && word.cefr !== query.cefr) return false;
    if (query.topic && word.topic !== query.topic) return false;
    if (!term) return true;
    return word.w.toLowerCase().includes(term)
      || word.senses.some((sense) => sense.zh.includes(term) || sense.en.toLowerCase().includes(term));
  });

  const start = (page - 1) * pageSize;
  return { total: filtered.length, page, pageSize, words: filtered.slice(start, start + pageSize) };
}
