import data from "@/data/listening/section-01.json";
import type { ListeningSection } from "@/lib/listening";

const source = data as unknown as ListeningSection;

export const listeningSection: ListeningSection = {
  ...source,
  questions: [...source.questions].sort((a, b) => a.number - b.number),
};
