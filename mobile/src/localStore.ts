import * as SQLite from "expo-sqlite";
import { featuredKanjis } from "./data";
import { Kanji, KanjiProgress, KnowledgeStatus, QuizAttempt, ReviewHistoryItem } from "./types";

const databasePromise = SQLite.openDatabaseAsync("kanjisensei.db");

export async function initializeLocalStore() {
  const database = await databasePromise;
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kanjis (
      id INTEGER PRIMARY KEY NOT NULL,
      server_id INTEGER,
      character TEXT NOT NULL UNIQUE,
      meaning TEXT NOT NULL,
      onyomi TEXT,
      kunyomi TEXT,
      stroke_count INTEGER,
      jlpt TEXT
    );
    CREATE TABLE IF NOT EXISTS kanji_progress (
      profile_id TEXT NOT NULL,
      kanji_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      favorite INTEGER NOT NULL DEFAULT 0,
      due_at TEXT,
      interval_days INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      PRIMARY KEY (profile_id, kanji_id)
    );
    CREATE TABLE IF NOT EXISTS review_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      kanji_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      due_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      correct_answers INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      completed_at TEXT NOT NULL
    );
  `);
  const kanjiColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(kanjis)");
  if (!kanjiColumns.some((column) => column.name === "server_id")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN server_id INTEGER");
  }

  for (const kanji of featuredKanjis) {
    await database.runAsync(
      `INSERT INTO kanjis (id, character, meaning, onyomi, kunyomi, stroke_count, jlpt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(character) DO NOTHING`,
      kanji.id,
      kanji.character,
      kanji.meaning,
      kanji.onyomi ?? null,
      kanji.kunyomi ?? null,
      kanji.strokeCount ?? null,
      kanji.jlpt,
    );
  }
}

export async function getLocalKanjis(): Promise<Kanji[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    id: number;
    server_id: number | null;
    character: string;
    meaning: string;
    onyomi: string | null;
    kunyomi: string | null;
    stroke_count: number | null;
    jlpt: string | null;
  }>("SELECT * FROM kanjis ORDER BY character ASC");

  return rows.map((row) => ({
    id: row.id,
    serverId: row.server_id ?? undefined,
    character: row.character,
    meaning: row.meaning,
    onyomi: row.onyomi,
    kunyomi: row.kunyomi,
    strokeCount: row.stroke_count,
    jlpt: row.jlpt,
    examples: featuredKanjis.find((kanji) => kanji.character === row.character)?.examples ?? [],
  }));
}

export async function cacheRemoteKanjis(kanjis: Kanji[]) {
  const database = await databasePromise;
  for (const kanji of kanjis) {
    await database.runAsync(
      `INSERT INTO kanjis (server_id, character, meaning, onyomi, kunyomi, stroke_count, jlpt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(character) DO UPDATE SET
         server_id = excluded.server_id,
         meaning = excluded.meaning,
         onyomi = excluded.onyomi,
         kunyomi = excluded.kunyomi,
         stroke_count = excluded.stroke_count,
         jlpt = excluded.jlpt`,
      kanji.serverId ?? kanji.id,
      kanji.character,
      kanji.meaning,
      kanji.onyomi ?? null,
      kanji.kunyomi ?? null,
      kanji.strokeCount ?? null,
      kanji.jlpt,
    );
  }
}

export async function getLocalProgress(profileId: string): Promise<KanjiProgress[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    kanji_id: number;
    status: KnowledgeStatus;
    favorite: number;
    due_at: string | null;
    interval_days: number;
    ease_factor: number;
    repetitions: number;
    last_reviewed_at: string | null;
  }>("SELECT * FROM kanji_progress WHERE profile_id = ?", profileId);

  return rows.map((row) => ({
    kanjiId: row.kanji_id,
    status: row.status,
    favorite: row.favorite === 1,
    dueAt: row.due_at,
    intervalDays: row.interval_days,
    easeFactor: row.ease_factor,
    repetitions: row.repetitions,
    lastReviewedAt: row.last_reviewed_at,
  }));
}

export async function saveLocalProgress(
  profileId: string,
  progress: KanjiProgress,
  rating?: number,
) {
  const database = await databasePromise;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO kanji_progress
         (profile_id, kanji_id, status, favorite, due_at, interval_days, ease_factor, repetitions, last_reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, kanji_id) DO UPDATE SET
         status = excluded.status,
         favorite = excluded.favorite,
         due_at = excluded.due_at,
         interval_days = excluded.interval_days,
         ease_factor = excluded.ease_factor,
         repetitions = excluded.repetitions,
         last_reviewed_at = excluded.last_reviewed_at`,
      profileId,
      progress.kanjiId,
      progress.status,
      progress.favorite ? 1 : 0,
      progress.dueAt,
      progress.intervalDays,
      progress.easeFactor,
      progress.repetitions,
      progress.lastReviewedAt,
    );

    if (rating !== undefined && progress.lastReviewedAt && progress.dueAt) {
      await transaction.runAsync(
        `INSERT INTO review_history (profile_id, kanji_id, rating, reviewed_at, due_at)
         VALUES (?, ?, ?, ?, ?)`,
        profileId,
        progress.kanjiId,
        rating,
        progress.lastReviewedAt,
        progress.dueAt,
      );
    }
  });
}

export async function getLocalReviewHistory(profileId: string): Promise<ReviewHistoryItem[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    id: number;
    kanji_id: number;
    rating: number;
    reviewed_at: string;
    due_at: string;
  }>("SELECT * FROM review_history WHERE profile_id = ? ORDER BY reviewed_at DESC", profileId);

  return rows.map((row) => ({
    id: row.id,
    kanjiId: row.kanji_id,
    rating: row.rating,
    reviewedAt: row.reviewed_at,
    dueAt: row.due_at,
  }));
}

export function emptyProgress(kanjiId: number): KanjiProgress {
  return {
    kanjiId,
    status: "not_started",
    favorite: false,
    dueAt: null,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewedAt: null,
  };
}

export function getReviewSchedule(
  previous: KanjiProgress,
  rating: number,
): Pick<KanjiProgress, "status" | "dueAt" | "intervalDays" | "easeFactor" | "repetitions" | "lastReviewedAt"> {
  const reviewedAt = new Date();
  const intervalDays = rating < 3
    ? 1
    : previous.repetitions === 0
      ? 1
      : previous.repetitions === 1
        ? 3
        : Math.max(1, Math.round(previous.intervalDays * previous.easeFactor));
  const easeFactor = Math.max(
    1.3,
    previous.easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02),
  );
  const dueAt = new Date(reviewedAt);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    status: (rating >= 4 ? "learned" : "learning") as KnowledgeStatus,
    dueAt: dueAt.toISOString(),
    intervalDays,
    easeFactor,
    repetitions: rating < 3 ? 0 : previous.repetitions + 1,
    lastReviewedAt: reviewedAt.toISOString(),
  };
}

export async function saveLocalQuizAttempt(
  profileId: string,
  correctAnswers: number,
  totalQuestions: number,
): Promise<QuizAttempt> {
  const database = await databasePromise;
  const completedAt = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO quiz_attempts (profile_id, correct_answers, total_questions, completed_at)
     VALUES (?, ?, ?, ?)`,
    profileId,
    correctAnswers,
    totalQuestions,
    completedAt,
  );
  return { id: result.lastInsertRowId, correctAnswers, totalQuestions, completedAt };
}

export async function getLocalQuizAttempts(profileId: string): Promise<QuizAttempt[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    id: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
  }>("SELECT * FROM quiz_attempts WHERE profile_id = ? ORDER BY completed_at DESC", profileId);
  return rows.map((row) => ({
    id: row.id,
    correctAnswers: row.correct_answers,
    totalQuestions: row.total_questions,
    completedAt: row.completed_at,
  }));
}