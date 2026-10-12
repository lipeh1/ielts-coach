export type Skill = "reading" | "listening" | "writing" | "speaking";
export type Profile = { targetBand: string; examDate: string; dailyTarget: number };
export type StudyLog = { id: string; date: string; minutes: number; skill: Skill; correct: number; total: number };
export type Mistake = { id: string; skill: Skill; question: string; reason: string; date: string; mastered: boolean };
export type SavedData = { profile: Profile; logs: StudyLog[]; mistakes: Mistake[]; checkIns: string[] };

const skills = new Set(["listening", "reading", "writing", "speaking"]);
const bands = new Set(["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]);

export function defaultData(): SavedData {
  return {
    profile: { targetBand: "7.0", examDate: "", dailyTarget: 45 },
    logs: [],
    mistakes: [],
    checkIns: [],
  };
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  return state.checkIns.every(isDateKey);
}
