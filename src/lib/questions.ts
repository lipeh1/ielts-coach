export const task2TypeLabels = {
  opinion: "观点",
  discussion: "讨论",
  advantages: "利弊",
  problemSolution: "问题解决",
  twoPart: "双问题",
} as const;

export type Task2Type = keyof typeof task2TypeLabels;
export type Task2Question = { id: string; type: Task2Type; prompt: string };

export function isTask2Type(value: string): value is Task2Type {
  return Object.prototype.hasOwnProperty.call(task2TypeLabels, value);
}

export function pickDailyQuestion(questions: Task2Question[], dateKey: string): Task2Question {
  if (questions.length === 0) throw new Error("Question bank is empty");
  const day = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);
  const index = Number.isFinite(day) ? ((day % questions.length) + questions.length) % questions.length : 0;
  return questions[index];
}
