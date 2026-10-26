export type Skill = "reading" | "listening" | "writing" | "speaking";
export type Profile = { targetBand: string; examDate: string; dailyTarget: number };
export type StudyLog = { id: string; date: string; minutes: number; skill: Skill; correct: number; total: number };
export type Mistake = { id: string; skill: Skill; question: string; reason: string; date: string; mastered: boolean };
export type FeedbackBandRecord = { TR: number; CC: number; LR: number; GRA: number };
export type FeedbackHistoryEntry = { id: string; date: string; overall: number; bands: FeedbackBandRecord };
export type VocabularyReviewSource = "manual" | "writing" | "listening" | "reading";
export type VocabularyReview = {
  id: string;
  word: string;
  source: VocabularyReviewSource;
  interval: number;
  ease: number;
  repetitions: number;
  due: string;
  lastReviewed: string | null;
};
export type SavedData = {
  profile: Profile;
  logs: StudyLog[];
  mistakes: Mistake[];
  checkIns: string[];
  feedbackHistory?: FeedbackHistoryEntry[];
  vocabularyReviews?: VocabularyReview[];
};

const skills = new Set(["listening", "reading", "writing", "speaking"]);
const bands = new Set(["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]);
const reviewSources = new Set(["manual", "writing", "listening", "reading"]);

export function defaultData(): SavedData {
  return {
    profile: { targetBand: "7.0", examDate: "", dailyTarget: 45 },
    logs: [],
    mistakes: [],
    checkIns: [],
    feedbackHistory: [],
    vocabularyReviews: [],
  };
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isBandScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 9;
}

function isFeedbackHistoryEntry(value: unknown): value is FeedbackHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || !entry.id || !isDateKey(entry.date) || !isBandScore(entry.overall)) return false;
  const bandRecord = entry.bands as Record<string, unknown> | undefined;
  if (!bandRecord || typeof bandRecord !== "object") return false;
  return (["TR", "CC", "LR", "GRA"] as const).every((key) => {
    const score = bandRecord[key];
    return isBandScore(score) && Number.isInteger(score);
  });
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isVocabularyReview(value: unknown): value is VocabularyReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Record<string, unknown>;
  return typeof review.id === "string" && review.id.length > 0
    && typeof review.word === "string" && review.word.length > 0
    && typeof review.source === "string" && reviewSources.has(review.source)
    && isNonNegativeNumber(review.interval)
    && isNonNegativeNumber(review.ease) && review.ease >= 1.3
    && isNonNegativeNumber(review.repetitions)
    && isDateKey(review.due)
    && (review.lastReviewed === null || isDateKey(review.lastReviewed));
}

export function isValidState(value: unknown): value is SavedData {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  const profile = state.profile as Record<string, unknown> | undefined;
  if (!profile || typeof profile.targetBand !== "string" || !bands.has(profile.targetBand)
    || typeof profile.dailyTarget !== "number" || ![15, 30, 45, 60, 90].includes(profile.dailyTarget)) return false;
  if (typeof profile.examDate !== "string" || (profile.examDate !== "" && !isDateKey(profile.examDate))) return false;
  if (!Array.isArray(state.logs) || !Array.isArray(state.mistakes) || !Array.isArray(state.checkIns)) return false;
  if (state.logs.some((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const log = entry as Record<string, unknown>;
    return typeof log.id !== "string" || typeof log.skill !== "string" || !skills.has(log.skill) || !isDateKey(log.date)
      || !Number.isFinite(log.minutes) || !Number.isFinite(log.correct) || !Number.isFinite(log.total);
  })) return false;
  if (state.mistakes.some((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const mistake = entry as Record<string, unknown>;
    return typeof mistake.id !== "string" || typeof mistake.skill !== "string" || !skills.has(mistake.skill) || !isDateKey(mistake.date)
      || typeof mistake.question !== "string" || typeof mistake.reason !== "string" || typeof mistake.mastered !== "boolean";
  })) return false;
  if (state.feedbackHistory !== undefined
    && (!Array.isArray(state.feedbackHistory) || state.feedbackHistory.some((entry) => !isFeedbackHistoryEntry(entry)))) return false;
  if (state.vocabularyReviews !== undefined
    && (!Array.isArray(state.vocabularyReviews) || state.vocabularyReviews.some((entry) => !isVocabularyReview(entry)))) return false;
  return state.checkIns.every(isDateKey);
}
