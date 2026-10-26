import type { VocabularyReview } from "@/lib/study-data";

export type ReviewRating = "again" | "good" | "easy";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createVocabularyReview(id: string, word: string, source: VocabularyReview["source"], today: string): VocabularyReview {
  return {
    id,
    word,
    source,
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    due: today,
    lastReviewed: null,
  };
}

export function scheduleVocabularyReview(entry: VocabularyReview, rating: ReviewRating, today: string): VocabularyReview {
  let repetitions = entry.repetitions;
  let interval = entry.interval;
  let ease = entry.ease;

  if (rating === "again") {
    repetitions = 0;
    interval = 1;
    ease = Math.max(1.3, round(ease - 0.2));
  } else if (rating === "good") {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(interval * ease));
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 2 : Math.max(1, Math.round(interval * ease * 1.3));
    ease = Math.min(3, round(ease + 0.15));
  }

  return {
    ...entry,
    repetitions,
    interval,
    ease,
    due: addDays(today, interval),
    lastReviewed: today,
  };
}

export function dueVocabularyReviews(reviews: VocabularyReview[], today: string): VocabularyReview[] {
  return reviews
    .filter((entry) => entry.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.word.localeCompare(b.word));
}
