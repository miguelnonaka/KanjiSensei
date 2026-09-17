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
    character: "学",
    meaning: "estudo; aprender",
    onyomi: "ガク",
    kunyomi: "まなぶ",
    strokeCount: 8,
    jlpt: "N5",
  },
];

async function main() {
  for (const kanji of kanjis) {
    await prisma.kanji.upsert({
      where: { character: kanji.character },
      update: kanji,
      create: kanji,
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