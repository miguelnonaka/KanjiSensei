export type Screen = "splash" | "onboarding" | "login" | "home" | "search" | "study" | "progress" | "profile" | "detail";
export type User = { id: number; email: string };
export type Kanji = {
  id: number;
  character: string;
  meaning: string;
  onyomi?: string | null;
  kunyomi?: string | null;
  strokeCount?: number | null;
  jlpt: string | null;
};
export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";
