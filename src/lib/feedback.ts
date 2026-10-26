export const criterionNames = [
  "TR · 任务回应",
  "CC · 连贯与衔接",
  "LR · 词汇资源",
  "GRA · 语法多样性与准确性",
] as const;

export type CriterionName = (typeof criterionNames)[number];

export type FeedbackCriterion = {
  name: CriterionName;
  band: number;
  observation: string;
  evidence: string;
  evidenceMissing: boolean;
  suggestion: string;
};

export type PolishParagraph = {
  paragraph: number;
  original: string;
  rewrite: string;
  translation: string;
};

export type FeedbackReport = {
  demo: boolean;
  submissionId: string;
  wordCount: number;
  overallBand: number;
  criteria: FeedbackCriterion[];
  polish: PolishParagraph[] | null;
  nextStep: string;
};

export function countWords(essay: string): number {
  const trimmed = essay.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function splitParagraphs(essay: string): string[] {
  return essay.trim().split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function calculateOverallBand(bands: number[]): number {
  if (bands.length !== 4 || bands.some((band) => !Number.isFinite(band))) {
    throw new Error("Overall band requires four finite criterion bands");
  }
  return Math.round((bands.reduce((sum, band) => sum + band, 0) / bands.length) * 2) / 2;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`AI feedback is missing ${field}`);
  return value.trim();
}

export function validateFeedback(raw: unknown, essay: string) {
  if (!raw || typeof raw !== "object") throw new Error("AI feedback is not an object");
  const input = raw as { criteria?: unknown; polish?: unknown; nextStep?: unknown };
  if (!Array.isArray(input.criteria) || input.criteria.length !== 4) {
    throw new Error("AI feedback must contain exactly four criteria");
  }

  const criteria = input.criteria.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("AI feedback criterion is not an object");
    const criterion = item as Record<string, unknown>;
    const expectedName = criterionNames[index];
    if (criterion.name !== expectedName) throw new Error(`AI feedback criterion ${index} must be ${expectedName}`);
    if (typeof criterion.band !== "number" || !Number.isInteger(criterion.band) || criterion.band < 0 || criterion.band > 9) {
      throw new Error(`AI feedback criterion ${expectedName} must use an integer band from 0 to 9`);
    }
    if (typeof criterion.evidence !== "string") throw new Error(`AI feedback criterion ${expectedName} is missing evidence`);

    const evidence = criterion.evidence.trim();
    const evidenceMissing = !evidence || !essay.includes(evidence);

    return {
      name: expectedName,
      band: criterion.band,
      observation: requireText(criterion.observation, `${expectedName} observation`),
      evidence: evidenceMissing ? "" : evidence,
      evidenceMissing,
      suggestion: requireText(criterion.suggestion, `${expectedName} suggestion`),
    } satisfies FeedbackCriterion;
  });

  const paragraphs = splitParagraphs(essay);
  if (!Array.isArray(input.polish) || input.polish.length !== paragraphs.length) {
    throw new Error("AI feedback must polish every essay paragraph");
  }
  const polish = input.polish.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("AI polish item is not an object");
    const paragraph = item as Record<string, unknown>;
    if (paragraph.paragraph !== index + 1) throw new Error(`AI polish paragraph ${index + 1} is out of order`);
    return {
      paragraph: index + 1,
      original: paragraphs[index],
      rewrite: requireText(paragraph.rewrite, `polish paragraph ${index + 1} rewrite`),
      translation: requireText(paragraph.translation, `polish paragraph ${index + 1} translation`),
    } satisfies PolishParagraph;
  });

  return {
    overallBand: calculateOverallBand(criteria.map((criterion) => criterion.band)),
    criteria,
    polish,
    nextStep: requireText(input.nextStep, "nextStep"),
  };
}
