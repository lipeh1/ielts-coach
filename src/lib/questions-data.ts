import data from "@/data/questions/task2.json";
import { pickDailyQuestion, type Task2Question } from "@/lib/questions";

const questions = data.questions as unknown as Task2Question[];

export function getDailyTask2Question(dateKey: string): Task2Question {
  return pickDailyQuestion(questions, dateKey);
}

export function getTask2QuestionById(id: string): Task2Question | null {
  return questions.find((question) => question.id === id) ?? null;
}
