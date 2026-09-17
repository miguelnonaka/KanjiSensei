export type Kanji = {
  id: number;
  character: string;
  meaning: string;
  onyomi?: string | null;
  kunyomi?: string | null;
  strokeCount?: number | null;
  jlpt: string | null;
};

export const featuredKanjis: Kanji[] = [
  { id: 1, character: "日", meaning: "dia / sol", onyomi: "ニチ", kunyomi: "ひ", strokeCount: 4, jlpt: "N5" },
  { id: 2, character: "水", meaning: "água", onyomi: "スイ", kunyomi: "みず", strokeCount: 4, jlpt: "N5" },
  { id: 3, character: "火", meaning: "fogo", onyomi: "カ", kunyomi: "ひ", strokeCount: 4, jlpt: "N5" },
  { id: 4, character: "学", meaning: "estudar / aprender", onyomi: "ガク", kunyomi: "まなぶ", strokeCount: 8, jlpt: "N5" },
  { id: 5, character: "食", meaning: "comer / comida", onyomi: "ショク", kunyomi: "たべる", strokeCount: 9, jlpt: "N5" },
  { id: 6, character: "見", meaning: "ver", onyomi: "ケン", kunyomi: "みる", strokeCount: 7, jlpt: "N5" },
  { id: 7, character: "行", meaning: "ir", onyomi: "コウ", kunyomi: "いく", strokeCount: 6, jlpt: "N5" },
  { id: 8, character: "木", meaning: "árvore", onyomi: "モク", kunyomi: "き", strokeCount: 4, jlpt: "N5" },
  { id: 9, character: "山", meaning: "montanha", onyomi: "サン", kunyomi: "やま", strokeCount: 3, jlpt: "N5" },
  { id: 10, character: "人", meaning: "pessoa", onyomi: "ジン / ニン", kunyomi: "ひと", strokeCount: 2, jlpt: "N5" },
];

export const onboardingSlides = [
  { character: "学", title: "Aprenda no seu ritmo", text: "Organize seus estudos e acompanhe sua evolução.", color: "#B4232F" },
  { character: "見", title: "Reconheça kanjis", text: "Use a câmera ou desenhe um kanji para identificá-lo.", color: "#263238" },
  { character: "覚", title: "Não esqueça o que aprendeu", text: "Revise seus kanjis utilizando repetição espaçada.", color: "#2E7DAF" },
];
