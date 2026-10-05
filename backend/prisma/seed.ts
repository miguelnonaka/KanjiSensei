import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const kanjis = [
  {
    character: "日",
    meaning: "dia; sol",
    onyomi: "ニチ, ジツ",
    kunyomi: "ひ, か",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "人",
    meaning: "pessoa",
    onyomi: "ジン, ニン",
    kunyomi: "ひと",
    strokeCount: 2,
    jlpt: "N5",
  },
  {
    character: "水",
    meaning: "água",
    onyomi: "スイ",
    kunyomi: "みず",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "火",
    meaning: "fogo",
    onyomi: "カ",
    kunyomi: "ひ",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "学",
    meaning: "estudo; aprender",
    onyomi: "ガク",
    kunyomi: "まなぶ",
    strokeCount: 8,
    jlpt: "N5",
  },
  {
    character: "食",
    meaning: "comer; comida",
    onyomi: "ショク",
    kunyomi: "たべる",
    strokeCount: 9,
    jlpt: "N5",
  },
  {
    character: "見",
    meaning: "ver",
    onyomi: "ケン",
    kunyomi: "みる",
    strokeCount: 7,
    jlpt: "N5",
  },
  {
    character: "行",
    meaning: "ir; realizar",
    onyomi: "コウ",
    kunyomi: "いく",
    strokeCount: 6,
    jlpt: "N5",
  },
  {
    character: "木",
    meaning: "árvore; madeira",
    onyomi: "モク",
    kunyomi: "き",
    strokeCount: 4,
    jlpt: "N5",
  },
  {
    character: "山",
    meaning: "montanha",
    onyomi: "サン",
    kunyomi: "やま",
    strokeCount: 3,
    jlpt: "N5",
  },
  { character: "一", meaning: "um", onyomi: "イチ, イツ", kunyomi: "ひと", strokeCount: 1, jlpt: "N5" },
  { character: "二", meaning: "dois", onyomi: "ニ", kunyomi: "ふた", strokeCount: 2, jlpt: "N5" },
  { character: "三", meaning: "três", onyomi: "サン", kunyomi: "みっ", strokeCount: 3, jlpt: "N5" },
  { character: "四", meaning: "quatro", onyomi: "シ", kunyomi: "よん, よ", strokeCount: 5, jlpt: "N5" },
  { character: "五", meaning: "cinco", onyomi: "ゴ", kunyomi: "いつ", strokeCount: 4, jlpt: "N5" },
  { character: "六", meaning: "seis", onyomi: "ロク", kunyomi: "むっ", strokeCount: 4, jlpt: "N5" },
  { character: "七", meaning: "sete", onyomi: "シチ", kunyomi: "なな", strokeCount: 2, jlpt: "N5" },
  { character: "八", meaning: "oito", onyomi: "ハチ", kunyomi: "やっ", strokeCount: 2, jlpt: "N5" },
  { character: "九", meaning: "nove", onyomi: "キュウ, ク", kunyomi: "ここの", strokeCount: 2, jlpt: "N5" },
  { character: "十", meaning: "dez", onyomi: "ジュウ", kunyomi: "とお", strokeCount: 2, jlpt: "N5" },
  { character: "月", meaning: "lua; mês", onyomi: "ゲツ, ガツ", kunyomi: "つき", strokeCount: 4, jlpt: "N5" },
  { character: "川", meaning: "rio", onyomi: "セン", kunyomi: "かわ", strokeCount: 3, jlpt: "N5" },
  { character: "本", meaning: "livro; origem", onyomi: "ホン", kunyomi: "もと", strokeCount: 5, jlpt: "N5" },
  { character: "中", meaning: "meio; dentro", onyomi: "チュウ", kunyomi: "なか", strokeCount: 4, jlpt: "N5" },
  { character: "上", meaning: "acima", onyomi: "ジョウ", kunyomi: "うえ", strokeCount: 3, jlpt: "N5" },
  { character: "下", meaning: "abaixo", onyomi: "カ, ゲ", kunyomi: "した", strokeCount: 3, jlpt: "N5" },
  { character: "金", meaning: "ouro; dinheiro", onyomi: "キン", kunyomi: "かね", strokeCount: 8, jlpt: "N5" },
  { character: "土", meaning: "terra; solo", onyomi: "ド, ト", kunyomi: "つち", strokeCount: 3, jlpt: "N5" },
  { character: "年", meaning: "ano", onyomi: "ネン", kunyomi: "とし", strokeCount: 6, jlpt: "N5" },
  { character: "大", meaning: "grande", onyomi: "ダイ, タイ", kunyomi: "おお", strokeCount: 3, jlpt: "N5" },
  { character: "小", meaning: "pequeno", onyomi: "ショウ", kunyomi: "ちい", strokeCount: 3, jlpt: "N5" },
  { character: "今", meaning: "agora", onyomi: "コン", kunyomi: "いま", strokeCount: 4, jlpt: "N5" },
];

const examples: Record<string, { word: string; reading: string; meaning: string }[]> = {
  "日": [{ word: "日本", reading: "にほん", meaning: "Japão" }, { word: "毎日", reading: "まいにち", meaning: "todos os dias" }],
  "水": [{ word: "水曜日", reading: "すいようび", meaning: "quarta-feira" }, { word: "水道", reading: "すいどう", meaning: "abastecimento de água" }],
  "火": [{ word: "火曜日", reading: "かようび", meaning: "terça-feira" }, { word: "花火", reading: "はなび", meaning: "fogos de artifício" }],
  "学": [{ word: "学校", reading: "がっこう", meaning: "escola" }, { word: "学生", reading: "がくせい", meaning: "estudante" }],
  "食": [{ word: "食べ物", reading: "たべもの", meaning: "comida" }, { word: "食事", reading: "しょくじ", meaning: "refeição" }],
  "見": [{ word: "見る", reading: "みる", meaning: "ver" }, { word: "意見", reading: "いけん", meaning: "opinião" }],
  "行": [{ word: "行く", reading: "いく", meaning: "ir" }, { word: "銀行", reading: "ぎんこう", meaning: "banco" }],
  "木": [{ word: "木曜日", reading: "もくようび", meaning: "quinta-feira" }, { word: "木材", reading: "もくざい", meaning: "madeira" }],
  "山": [{ word: "火山", reading: "かざん", meaning: "vulcão" }, { word: "山道", reading: "やまみち", meaning: "trilha de montanha" }],
  "人": [{ word: "人間", reading: "にんげん", meaning: "ser humano" }, { word: "日本人", reading: "にほんじん", meaning: "japonês" }],
  "一": [{ word: "一つ", reading: "ひとつ", meaning: "um (objeto)" }, { word: "一人", reading: "ひとり", meaning: "uma pessoa" }],
  "二": [{ word: "二つ", reading: "ふたつ", meaning: "dois (objetos)" }, { word: "二人", reading: "ふたり", meaning: "duas pessoas" }],
  "三": [{ word: "三つ", reading: "みっつ", meaning: "três (objetos)" }, { word: "三日", reading: "みっか", meaning: "dia três; três dias" }],
  "四": [{ word: "四つ", reading: "よっつ", meaning: "quatro (objetos)" }, { word: "四月", reading: "しがつ", meaning: "abril" }],
  "五": [{ word: "五つ", reading: "いつつ", meaning: "cinco (objetos)" }, { word: "五時", reading: "ごじ", meaning: "cinco horas" }],
  "六": [{ word: "六つ", reading: "むっつ", meaning: "seis (objetos)" }, { word: "六日", reading: "むいか", meaning: "dia seis; seis dias" }],
  "七": [{ word: "七つ", reading: "ななつ", meaning: "sete (objetos)" }, { word: "七時", reading: "しちじ", meaning: "sete horas" }],
  "八": [{ word: "八つ", reading: "やっつ", meaning: "oito (objetos)" }, { word: "八月", reading: "はちがつ", meaning: "agosto" }],
  "九": [{ word: "九つ", reading: "ここのつ", meaning: "nove (objetos)" }, { word: "九月", reading: "くがつ", meaning: "setembro" }],
  "十": [{ word: "十", reading: "とお", meaning: "dez" }, { word: "十月", reading: "じゅうがつ", meaning: "outubro" }],
  "月": [{ word: "月", reading: "つき", meaning: "lua" }, { word: "月曜日", reading: "げつようび", meaning: "segunda-feira" }],
  "川": [{ word: "川", reading: "かわ", meaning: "rio" }, { word: "小川", reading: "おがわ", meaning: "riacho" }],
  "本": [{ word: "本", reading: "ほん", meaning: "livro" }, { word: "日本", reading: "にほん", meaning: "Japão" }],
  "中": [{ word: "中", reading: "なか", meaning: "dentro" }, { word: "中国", reading: "ちゅうごく", meaning: "China" }],
  "上": [{ word: "上", reading: "うえ", meaning: "acima" }, { word: "上手", reading: "じょうず", meaning: "habilidoso" }],
  "下": [{ word: "下", reading: "した", meaning: "abaixo" }, { word: "地下", reading: "ちか", meaning: "subsolo" }],
  "金": [{ word: "お金", reading: "おかね", meaning: "dinheiro" }, { word: "金曜日", reading: "きんようび", meaning: "sexta-feira" }],
  "土": [{ word: "土", reading: "つち", meaning: "terra" }, { word: "土曜日", reading: "どようび", meaning: "sábado" }],
  "年": [{ word: "今年", reading: "ことし", meaning: "este ano" }, { word: "来年", reading: "らいねん", meaning: "ano que vem" }],
  "大": [{ word: "大きい", reading: "おおきい", meaning: "grande" }, { word: "大学", reading: "だいがく", meaning: "universidade" }],
  "小": [{ word: "小さい", reading: "ちいさい", meaning: "pequeno" }, { word: "小学校", reading: "しょうがっこう", meaning: "escola primária" }],
  "今": [{ word: "今", reading: "いま", meaning: "agora" }, { word: "今日", reading: "きょう", meaning: "hoje" }],
};

async function main() {
  for (const kanji of kanjis) {
    const data = { ...kanji, examples: JSON.stringify(examples[kanji.character] ?? []) };
    await prisma.kanji.upsert({
      where: { character: kanji.character },
      update: data,
      create: data,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });