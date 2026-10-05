import type { Kanji } from "../types";

type OcrTextElement = { text?: string | null };
type OcrTextLine = { text?: string | null; elements?: OcrTextElement[] | null };
type OcrTextBlock = { text?: string | null; lines?: OcrTextLine[] | null };
export type OcrTextRecognitionResult = { text?: string | null; blocks?: OcrTextBlock[] | null };

function pushText(target: string[], value?: string | null) {
  if (typeof value === "string" && value.trim()) target.push(value);
}

export function getOrderedOcrTextSegments(result: OcrTextRecognitionResult): string[] {
  const segments: string[] = [];

  for (const block of result.blocks ?? []) {
    const blockSegments: string[] = [];
    for (const line of block.lines ?? []) {
      const elementTexts = (line.elements ?? []).flatMap((element) => typeof element.text === "string" && element.text.trim() ? [element.text] : []);
      if (elementTexts.length) {
        blockSegments.push(...elementTexts);
      } else {
        pushText(blockSegments, line.text);
      }
    }
    if (blockSegments.length) {
      segments.push(...blockSegments);
    } else {
      pushText(segments, block.text);
    }
  }

  if (!segments.length) pushText(segments, result.text);
  return segments;
}

export function extractCatalogKanjisFromOcr(result: OcrTextRecognitionResult, kanjis: Kanji[]): Kanji[] {
  const byCharacter = new Map(kanjis.map((kanji) => [kanji.character.normalize("NFKC"), kanji]));
  const seen = new Set<string>();
  const matches: Kanji[] = [];

  for (const segment of getOrderedOcrTextSegments(result)) {
    for (const character of segment.normalize("NFKC")) {
      const kanji = byCharacter.get(character);
      if (kanji && !seen.has(kanji.character)) {
        seen.add(kanji.character);
        matches.push(kanji);
      }
    }
  }

  return matches;
}

export function getOcrErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "Tente novamente.";
}
