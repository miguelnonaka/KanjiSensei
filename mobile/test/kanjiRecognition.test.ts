/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { extractCatalogKanjisFromOcr, getOcrErrorMessage, type OcrTextRecognitionResult } from "../src/ocr/kanjiRecognition.ts";
import type { Kanji } from "../src/types.ts";

const catalog = [
  { id: 1, character: "日", meaning: "dia", jlpt: "N5" },
  { id: 2, character: "月", meaning: "lua", jlpt: "N5" },
  { id: 3, character: "水", meaning: "agua", jlpt: "N5" },
] satisfies Kanji[];

function extract(result: OcrTextRecognitionResult) {
  return extractCatalogKanjisFromOcr(result, catalog).map((kanji) => kanji.character);
}

test("extrai um kanji do catalogo", () => {
  assert.deepEqual(extract({ text: "日", blocks: [] }), ["日"]);
});

test("extrai dois kanjis preservando a ordem dos elementos", () => {
  assert.deepEqual(extract({
    text: "月日",
    blocks: [{ lines: [{ elements: [{ text: "月" }, { text: "日" }] }] }],
  }), ["月", "日"]);
});

test("remove caracteres repetidos mantendo a primeira ocorrencia", () => {
  assert.deepEqual(extract({ text: "日日月日", blocks: [] }), ["日", "月"]);
});

test("ignora espacos e pontuacao sem mudar a ordem dos kanjis", () => {
  assert.deepEqual(extract({ text: "  日、 月。水! ", blocks: [] }), ["日", "月", "水"]);
});

test("retorna vazio quando o texto nao tem kanjis do catalogo", () => {
  assert.deepEqual(extract({ text: "学校かな ABC", blocks: [] }), []);
});

test("retorna vazio para resultado sem texto", () => {
  assert.deepEqual(extract({ text: "", blocks: [] }), []);
});

test("formata erro de OCR para o fluxo de camera tratar separadamente", () => {
  assert.equal(getOcrErrorMessage(new Error("Text recognition failed")), "Text recognition failed");
  assert.equal(getOcrErrorMessage("falha desconhecida"), "Tente novamente.");
});
