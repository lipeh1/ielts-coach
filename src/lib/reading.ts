export type ReadingParagraph = { label: string; text: string };
export type ReadingHeading = { id: string; text: string };

export type ReadingTfngQuestion = {
  id: string;
  number: number;
  type: "true-false-not-given";
  prompt: string;
  answer: "True" | "False" | "Not Given";
  explanation: string;
  evidence: string;
};

export type ReadingHeadingQuestion = {
  id: string;
  number: number;
  type: "matching-headings";
  prompt: string;
  answer: string;
  explanation: string;
  evidence: string;
};

export type ReadingCompletionQuestion = {
  id: string;
  number: number;
  type: "summary-completion";
  prompt: string;
  answers: string[];
  explanation: string;
  evidence: string;
};

export type ReadingQuestion = ReadingTfngQuestion | ReadingHeadingQuestion | ReadingCompletionQuestion;

export type ReadingPassage = {
  id: string;
  version: number;
  title: string;
  minutes: number;
  paragraphs: ReadingParagraph[];
  headings: ReadingHeading[];
  questions: ReadingQuestion[];
};

export type ReadingQuestionResult = {
  question: ReadingQuestion;
  answer: string;
  correct: boolean;
  expected: string;
};

export type ReadingResult = {
  correct: number;
  total: number;
  results: ReadingQuestionResult[];
};

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
}

function expectedAnswer(question: ReadingQuestion): string {
  return question.type === "summary-completion" ? question.answers.join(" / ") : question.answer;
}

export function gradeReadingQuestion(question: ReadingQuestion, rawAnswer: string): { correct: boolean; expected: string } {
  const answer = rawAnswer.trim();
  if (!answer) return { correct: false, expected: expectedAnswer(question) };

  switch (question.type) {
    case "true-false-not-given":
      return { correct: normalizeAnswer(answer) === normalizeAnswer(question.answer), expected: question.answer };
    case "matching-headings":
      return { correct: answer.toUpperCase() === question.answer.toUpperCase(), expected: question.answer };
    case "summary-completion":
      return {
        correct: question.answers.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer)),
        expected: question.answers.join(" / "),
      };
  }
}

export function gradeReadingPassage(passage: ReadingPassage, answers: Record<string, string>): ReadingResult {
  const results = passage.questions.map((question) => {
    const answer = answers[question.id] ?? "";
    return { question, answer, ...gradeReadingQuestion(question, answer) };
  });
  return { correct: results.filter((result) => result.correct).length, total: results.length, results };
}
