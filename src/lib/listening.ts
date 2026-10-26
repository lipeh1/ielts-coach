export type ListeningOption = { id: string; text: string };

export type ListeningMultipleChoiceQuestion = {
  id: string;
  number: number;
  type: "multiple-choice";
  prompt: string;
  options: ListeningOption[];
  answer: string;
  explanation: string;
  evidence: string;
};

export type ListeningCompletionQuestion = {
  id: string;
  number: number;
  type: "note-completion";
  prompt: string;
  answers: string[];
  explanation: string;
  evidence: string;
};

export type ListeningQuestion = ListeningMultipleChoiceQuestion | ListeningCompletionQuestion;

export type ListeningSection = {
  id: string;
  version: number;
  title: string;
  audioMinutes: number;
  practiceMinutes: number;
  audioFile?: string;
  script: string[];
  questions: ListeningQuestion[];
};

export type ListeningQuestionResult = {
  question: ListeningQuestion;
  answer: string;
  correct: boolean;
  expected: string;
};

export type ListeningResult = {
  correct: number;
  total: number;
  results: ListeningQuestionResult[];
};

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
}

function expectedAnswer(question: ListeningQuestion): string {
  if (question.type === "multiple-choice") {
    const option = question.options.find((entry) => entry.id === question.answer);
    return option ? `${question.answer} · ${option.text}` : question.answer;
  }
  return question.answers.join(" / ");
}

export function gradeListeningQuestion(question: ListeningQuestion, rawAnswer: string): { correct: boolean; expected: string } {
  const answer = rawAnswer.trim();
  if (!answer) return { correct: false, expected: expectedAnswer(question) };

  if (question.type === "multiple-choice") {
    return { correct: answer.toUpperCase() === question.answer.toUpperCase(), expected: expectedAnswer(question) };
  }

  return {
    correct: question.answers.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer)),
    expected: expectedAnswer(question),
  };
}

export function gradeListeningSection(section: ListeningSection, answers: Record<string, string>): ListeningResult {
  const results = section.questions.map((question) => {
    const answer = answers[question.id] ?? "";
    return { question, answer, ...gradeListeningQuestion(question, answer) };
  });
  return { correct: results.filter((result) => result.correct).length, total: results.length, results };
}
