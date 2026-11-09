/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { createQuizQuestion, getQuizKanjis } from "../src/quiz.ts";
import type { Kanji } from "../src/types.ts";

const kanjis = [
  { id: 1, character: "日", meaning: "dia", onyomi: "ニチ, ジツ", jlpt: "N5" },
  { id: 2, character: "月", meaning: "lua", onyomi: "ゲツ", kunyomi: "つき", jlpt: "N5" },
  { id: 3, character: "水", meaning: "água", onyomi: "スイ", jlpt: "N4" },
  { id: 4, character: "政", meaning: "política", onyomi: "セイ", jlpt: "N3" },
  { id: 5, character: "氏", meaning: "sobrenome", onyomi: "シ", jlpt: "N1" },
] satisfies Kanji[];

test("filtra o catálogo por dificuldade JLPT", () => {
  assert.deepEqual(getQuizKanjis(kanjis, "basic").map((kanji) => kanji.character), ["日", "月", "水"]);
  assert.deepEqual(getQuizKanjis(kanjis, "intermediate").map((kanji) => kanji.character), ["政"]);
  assert.deepEqual(getQuizKanjis(kanjis, "advanced").map((kanji) => kanji.character), ["氏"]);
});

test("gera perguntas de significado e leitura com opções distintas", () => {
  const basic = getQuizKanjis(kanjis, "basic");
  const meaning = createQuizQuestion(basic, 0, "meaning");
  assert.equal(meaning?.prompt, "日");
  assert.equal(meaning?.answer, "dia");
  assert.ok(meaning?.choices.includes("dia"));
  assert.equal(new Set(meaning?.choices).size, meaning?.choices.length);

  const reading = createQuizQuestion(basic, 0, "reading");
  assert.equal(reading?.answer, "ニチ");
});

test("pergunta de caractere parte do significado e não gera quiz sem distratores", () => {
  const question = createQuizQuestion(getQuizKanjis(kanjis, "basic"), 0, "character");
  assert.equal(question?.prompt, "dia");
  assert.equal(question?.answer, "日");
  assert.equal(createQuizQuestion([kanjis[0]], 0, "meaning"), null);
});
