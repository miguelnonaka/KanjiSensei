import type { Kanji } from "./types";

export type QuizCategory = "meaning" | "reading" | "character";
export type QuizDifficulty = "basic" | "intermediate" | "advanced";

export type QuizQuestion = {
  kanji: Kanji;
  prompt: string;
  answer: string;
  choices: string[];
};

const difficultyLevels: Record<QuizDifficulty, string[]> = {
  basic: ["N5", "N4"],
  intermediate: ["N3"],
  advanced: ["N1", "N2"],
};

function answerFor(kanji: Kanji, category: QuizCategory): string {
  if (category === "meaning") return kanji.meaning;
  if (category === "character") return kanji.character;
  return [kanji.onyomi, kanji.kunyomi]
    .flatMap((reading) => reading?.split(/[;,、/／]+/u) ?? [])
    .map((reading) => reading.trim())
    .find(Boolean) ?? "";
}

export function getQuizKanjis(
  kanjis: Kanji[],
  difficulty: QuizDifficulty,
  category?: QuizCategory,
): Kanji[] {
  const allowedLevels = difficultyLevels[difficulty];
  const seenAnswers = new Set<string>();
  return kanjis.filter((kanji) => {
    if (!allowedLevels.includes(kanji.jlpt ?? "")) return false;
    if (!category) return true;
    const answer = answerFor(kanji, category);
    if (!answer || seenAnswers.has(answer)) return false;
    seenAnswers.add(answer);
    return true;
  });
}

export function createQuizQuestion(
  kanjis: Kanji[],
  index: number,
  category: QuizCategory,
): QuizQuestion | null {
  if (kanjis.length < 2) return null;
  const eligible = kanjis.filter((kanji) => answerFor(kanji, category));
  if (eligible.length < 2) return null;

  const kanji = eligible[index % eligible.length];
  const answer = answerFor(kanji, category);
  const distractors = [...new Set(eligible
    .filter((candidate) => candidate.id !== kanji.id)
    .map((candidate) => answerFor(candidate, category))
    .filter((candidate) => candidate && candidate !== answer))];
  if (!distractors.length) return null;

  const selectedDistractors = Array.from(
    { length: Math.min(3, distractors.length) },
    (_, offset) => distractors[(index + offset) % distractors.length],
  );
  const choices = [answer, ...selectedDistractors];
  const rotation = index % choices.length;
  const prompt = category === "character" ? kanji.meaning : kanji.character;
  return {
    kanji,
    prompt,
    answer,
    choices: [...choices.slice(rotation), ...choices.slice(0, rotation)],
  };
}
