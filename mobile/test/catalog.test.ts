import assert from "node:assert/strict";
import { test } from "node:test";
import { featuredKanjis } from "../src/data.ts";

test("catalogo offline contém 100 kanjis JLPT N5 válidos e sem duplicatas", () => {
  assert.equal(featuredKanjis.length, 100);
  assert.equal(new Set(featuredKanjis.map((kanji) => kanji.character)).size, 100);

  for (const kanji of featuredKanjis) {
    assert.equal(kanji.jlpt, "N5");
    assert.ok(kanji.meaning.length > 0);
    assert.ok(kanji.strokeCount && kanji.strokeCount > 0);
    assert.ok(kanji.radical);
    assert.ok(kanji.examples && kanji.examples.length > 0);
  }

  assert.equal(featuredKanjis.find((kanji) => kanji.character === "川")?.radical, "巛");
  assert.equal(featuredKanjis.find((kanji) => kanji.character === "青")?.radical, "靑");
});
