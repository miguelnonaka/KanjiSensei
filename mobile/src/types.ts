export type Screen = "splash" | "onboarding" | "login" | "home" | "search" | "study" | "progress" | "profile" | "detail" | "camera";
export type User = { id: number; email: string; isGuest?: boolean };
export type KanjiExample = { word: string; reading: string; meaning: string };
export type Kanji = {
  id: number;
  serverId?: number;
  character: string;
  meaning: string;
  onyomi?: string | null;
  kunyomi?: string | null;
  strokeCount?: number | null;
  jlpt: string | null;
  examples?: KanjiExample[];
};
export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";
export type KnowledgeStatus = "not_started" | "learning" | "learned";
export type KanjiProgress = {
  kanjiId: number;
  status: KnowledgeStatus;
  favorite: boolean;
  dueAt: string | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string | null;
};
export type ReviewHistoryItem = {
  id: number;
  kanjiId: number;
  rating: number;
  reviewedAt: string;
  dueAt: string;
};
export type QuizAttempt = {
  id: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
};
