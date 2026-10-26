import data from "@/data/reading/passage-01.json";
import type { ReadingPassage } from "@/lib/reading";

const source = data as unknown as ReadingPassage;

export const readingPassage: ReadingPassage = {
  ...source,
  questions: [...source.questions].sort((a, b) => a.number - b.number),
};
