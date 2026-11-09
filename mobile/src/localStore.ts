import * as SQLite from "expo-sqlite";
import { featuredKanjis } from "./data";
import { DailyGoal, Kanji, KanjiProgress, KnowledgeStatus, QuizAttempt, ReviewHistoryItem, StudyList } from "./types";

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
      jlpt TEXT,
      radical TEXT,
      etymology TEXT,
      mnemonic TEXT,
      catalog_order INTEGER
    );
    CREATE TABLE IF NOT EXISTS kanji_progress (
      profile_id TEXT NOT NULL,
      kanji_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      favorite INTEGER NOT NULL DEFAULT 0,
      difficult INTEGER NOT NULL DEFAULT 0,
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
      completed_at TEXT NOT NULL,
      request_id TEXT
    );
    CREATE TABLE IF NOT EXISTS study_lists (
      profile_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      characters TEXT NOT NULL,
      PRIMARY KEY (profile_id, client_id)
    );
    CREATE TABLE IF NOT EXISTS daily_goals (
      profile_id TEXT PRIMARY KEY NOT NULL,
      target INTEGER NOT NULL,
      unit TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const kanjiColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(kanjis)");
  if (!kanjiColumns.some((column) => column.name === "server_id")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN server_id INTEGER");
  }
  if (!kanjiColumns.some((column) => column.name === "radical")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN radical TEXT");
  }
  if (!kanjiColumns.some((column) => column.name === "etymology")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN etymology TEXT");
  }
  if (!kanjiColumns.some((column) => column.name === "mnemonic")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN mnemonic TEXT");
  }
  if (!kanjiColumns.some((column) => column.name === "catalog_order")) {
    await database.execAsync("ALTER TABLE kanjis ADD COLUMN catalog_order INTEGER");
  }
  const progressColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(kanji_progress)");
  if (!progressColumns.some((column) => column.name === "difficult")) {
    await database.execAsync("ALTER TABLE kanji_progress ADD COLUMN difficult INTEGER NOT NULL DEFAULT 0");
  }
  const quizColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(quiz_attempts)");
  if (!quizColumns.some((column) => column.name === "request_id")) {
    await database.execAsync("ALTER TABLE quiz_attempts ADD COLUMN request_id TEXT");
  }

  for (const [index, kanji] of featuredKanjis.entries()) {
    await database.runAsync(
      `INSERT INTO kanjis (id, character, meaning, onyomi, kunyomi, stroke_count, jlpt, radical, etymology, mnemonic, catalog_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(character) DO UPDATE SET
         radical = COALESCE(kanjis.radical, excluded.radical),
         catalog_order = COALESCE(kanjis.catalog_order, excluded.catalog_order)`,
      kanji.id,
      kanji.character,
      kanji.meaning,
      kanji.onyomi ?? null,
      kanji.kunyomi ?? null,
      kanji.strokeCount ?? null,
      kanji.jlpt,
      kanji.radical ?? null,
      kanji.etymology ?? null,
      kanji.mnemonic ?? null,
      index,
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
    radical: string | null;
    etymology: string | null;
    mnemonic: string | null;
    catalog_order: number | null;
  }>(`SELECT * FROM kanjis
      ORDER BY CASE jlpt
        WHEN 'N5' THEN 0
        WHEN 'N4' THEN 1
        WHEN 'N3' THEN 2
        WHEN 'N2' THEN 3
        WHEN 'N1' THEN 4
        ELSE 5
      END, catalog_order IS NULL, catalog_order, character ASC`);

  return rows.map((row) => ({
    id: row.id,
    serverId: row.server_id ?? undefined,
    character: row.character,
    meaning: row.meaning,
    onyomi: row.onyomi,
    kunyomi: row.kunyomi,
    strokeCount: row.stroke_count,
    jlpt: row.jlpt,
    radical: row.radical,
    etymology: row.etymology,
    mnemonic: row.mnemonic,
    catalogOrder: row.catalog_order,
    examples: featuredKanjis.find((kanji) => kanji.character === row.character)?.examples ?? [],
  }));
}

export async function cacheRemoteKanjis(kanjis: Kanji[]) {
  const database = await databasePromise;
  for (const kanji of kanjis) {
    await database.runAsync(
      `INSERT INTO kanjis (server_id, character, meaning, onyomi, kunyomi, stroke_count, jlpt, radical, etymology, mnemonic, catalog_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(character) DO UPDATE SET
         server_id = excluded.server_id,
         meaning = excluded.meaning,
         onyomi = excluded.onyomi,
         kunyomi = excluded.kunyomi,
         stroke_count = excluded.stroke_count,
         jlpt = excluded.jlpt,
         radical = excluded.radical,
         etymology = excluded.etymology,
         mnemonic = excluded.mnemonic,
         catalog_order = excluded.catalog_order`,
      kanji.serverId ?? kanji.id,
      kanji.character,
      kanji.meaning,
      kanji.onyomi ?? null,
      kanji.kunyomi ?? null,
      kanji.strokeCount ?? null,
      kanji.jlpt,
      kanji.radical ?? null,
      kanji.etymology ?? null,
      kanji.mnemonic ?? null,
      kanji.catalogOrder ?? null,
    );
  }
}

export async function deleteCachedKanji(serverId: number): Promise<void> {
  const database = await databasePromise;
  const kanji = await database.getFirstAsync<{ id: number; character: string }>(
    "SELECT id, character FROM kanjis WHERE server_id = ?",
    serverId,
  );
  if (!kanji) return;
  const lists = await database.getAllAsync<{ profile_id: string; client_id: string; name: string; characters: string }>(
    "SELECT profile_id, client_id, name, characters FROM study_lists",
  );
  const pending = await database.getAllAsync<{ id: string; operation: string; payload: string }>(
    "SELECT id, operation, payload FROM sync_queue WHERE operation IN ('progress', 'study-list-save')",
  );
  const pendingIds: string[] = [];
  const pendingUpdates: Array<{ id: string; payload: string }> = [];
  for (const item of pending) {
    let payload: unknown;
    try {
      payload = JSON.parse(item.payload) as unknown;
    } catch {
      throw new Error("A fila offline está corrompida; o catálogo não foi removido do aparelho.");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("A fila offline está corrompida; o catálogo não foi removido do aparelho.");
    }
    const operation = payload as Record<string, unknown>;
    if (item.operation === "progress" && operation.kanjiId === kanji.id) {
      pendingIds.push(item.id);
    }
    if (item.operation === "study-list-save" && operation.list &&
      typeof operation.list === "object" && !Array.isArray(operation.list)) {
      const list = operation.list as Record<string, unknown>;
      if (Array.isArray(list.characters) && list.characters.includes(kanji.character)) {
        pendingUpdates.push({
          id: item.id,
          payload: JSON.stringify({ ...operation, list: { ...list, characters: list.characters.filter((value) => value !== kanji.character) } }),
        });
      }
    }
  }
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM kanji_progress WHERE kanji_id = ?", kanji.id);
    await transaction.runAsync("DELETE FROM review_history WHERE kanji_id = ?", kanji.id);
    await transaction.runAsync("DELETE FROM kanjis WHERE id = ?", kanji.id);
    for (const list of lists) {
      const characters = (JSON.parse(list.characters) as string[]).filter((character) => character !== kanji.character);
      await transaction.runAsync(
        "UPDATE study_lists SET characters = ? WHERE profile_id = ? AND client_id = ?",
        JSON.stringify(characters), list.profile_id, list.client_id,
      );
    }
    for (const id of pendingIds) {
      await transaction.runAsync("DELETE FROM sync_queue WHERE id = ?", id);
    }
    for (const update of pendingUpdates) {
      await transaction.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", update.payload, update.id);
    }
  });
}

export async function cacheRemoteCatalog(kanjis: Kanji[]): Promise<void> {
  await cacheRemoteKanjis(kanjis);
  const database = await databasePromise;
  const current = new Set(kanjis.map((kanji) => kanji.serverId ?? kanji.id));
  const cached = await database.getAllAsync<{ server_id: number | null }>(
    "SELECT server_id FROM kanjis WHERE server_id IS NOT NULL",
  );
  for (const row of cached) {
    if (row.server_id !== null && !current.has(row.server_id)) await deleteCachedKanji(row.server_id);
  }
}

export async function clearLocalStudyData(profileId: string): Promise<void> {
  const database = await databasePromise;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM kanji_progress WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM review_history WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM quiz_attempts WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM study_lists WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM daily_goals WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM sync_queue WHERE profile_id = ?", profileId);
  });
}

export async function getLocalProgress(profileId: string): Promise<KanjiProgress[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    kanji_id: number;
    status: KnowledgeStatus;
    favorite: number;
    difficult: number;
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
    difficult: row.difficult === 1,
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
         (profile_id, kanji_id, status, favorite, difficult, due_at, interval_days, ease_factor, repetitions, last_reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, kanji_id) DO UPDATE SET
         status = excluded.status,
         favorite = excluded.favorite,
         difficult = excluded.difficult,
         due_at = excluded.due_at,
         interval_days = excluded.interval_days,
         ease_factor = excluded.ease_factor,
         repetitions = excluded.repetitions,
         last_reviewed_at = excluded.last_reviewed_at`,
      profileId,
      progress.kanjiId,
      progress.status,
      progress.favorite ? 1 : 0,
      progress.difficult ? 1 : 0,
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
    difficult: false,
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
  requestId?: string,
): Promise<QuizAttempt> {
  const database = await databasePromise;
  const completedAt = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO quiz_attempts (profile_id, correct_answers, total_questions, completed_at, request_id)
     VALUES (?, ?, ?, ?, ?)`,
    profileId,
    correctAnswers,
    totalQuestions,
    completedAt,
    requestId ?? null,
  );
  return { id: result.lastInsertRowId, correctAnswers, totalQuestions, completedAt, requestId };
}

export async function getLocalQuizAttempts(profileId: string): Promise<QuizAttempt[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{
    id: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
    request_id: string | null;
  }>("SELECT * FROM quiz_attempts WHERE profile_id = ? ORDER BY completed_at DESC", profileId);
  return rows.map((row) => ({
    id: row.id,
    correctAnswers: row.correct_answers,
    totalQuestions: row.total_questions,
    completedAt: row.completed_at,
    requestId: row.request_id ?? undefined,
  }));
}

export async function getLocalStudyLists(profileId: string): Promise<StudyList[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<{ client_id: string; name: string; characters: string }>(
    "SELECT client_id, name, characters FROM study_lists WHERE profile_id = ? ORDER BY name",
    profileId,
  );
  return rows.map((row) => ({ clientId: row.client_id, name: row.name, characters: JSON.parse(row.characters) as string[] }));
}

export async function saveLocalStudyList(profileId: string, list: StudyList): Promise<void> {
  const database = await databasePromise;
  await database.runAsync(
    `INSERT INTO study_lists (profile_id, client_id, name, characters) VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, client_id) DO UPDATE SET name = excluded.name, characters = excluded.characters`,
    profileId,
    list.clientId,
    list.name,
    JSON.stringify([...new Set(list.characters)]),
  );
}

export async function replaceLocalStudyLists(profileId: string, lists: StudyList[]): Promise<void> {
  const database = await databasePromise;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM study_lists WHERE profile_id = ?", profileId);
    for (const list of lists) {
      await transaction.runAsync(
        "INSERT INTO study_lists (profile_id, client_id, name, characters) VALUES (?, ?, ?, ?)",
        profileId,
        list.clientId,
        list.name,
        JSON.stringify([...new Set(list.characters)]),
      );
    }
  });
}

export async function deleteLocalStudyList(profileId: string, clientId: string): Promise<void> {
  const database = await databasePromise;
  await database.runAsync("DELETE FROM study_lists WHERE profile_id = ? AND client_id = ?", profileId, clientId);
}

export async function getLocalGoal(profileId: string): Promise<DailyGoal> {
  const database = await databasePromise;
  const goal = await database.getFirstAsync<{ target: number; unit: DailyGoal["unit"] }>(
    "SELECT target, unit FROM daily_goals WHERE profile_id = ?",
    profileId,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const progress = goal?.unit === "ACTIVITIES"
    ? await database.getFirstAsync<{ count: number }>(
      `SELECT
        (SELECT COUNT(*) FROM review_history WHERE profile_id = ? AND reviewed_at >= ?) +
        (SELECT COUNT(*) FROM quiz_attempts WHERE profile_id = ? AND completed_at >= ?) AS count`,
      profileId, todayIso, profileId, todayIso,
    )
    : await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(DISTINCT kanji_id) AS count FROM review_history WHERE profile_id = ? AND reviewed_at >= ?",
      profileId, todayIso,
    );
  return { target: goal?.target ?? 10, unit: goal?.unit ?? "KANJIS", progress: progress?.count ?? 0 };
}

export async function saveLocalGoal(profileId: string, goal: Pick<DailyGoal, "target" | "unit">): Promise<void> {
  const database = await databasePromise;
  await database.runAsync(
    `INSERT INTO daily_goals (profile_id, target, unit, progress) VALUES (?, ?, ?, 0)
     ON CONFLICT(profile_id) DO UPDATE SET target = excluded.target, unit = excluded.unit`,
    profileId, goal.target, goal.unit,
  );
}

export async function enqueueSyncOperation(
  profileId: string,
  id: string,
  operation: string,
  payload: unknown,
): Promise<void> {
  const database = await databasePromise;
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_queue (id, profile_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    id, profileId, operation, JSON.stringify(payload), new Date().toISOString(),
  );
}

export async function getPendingSyncOperations(profileId: string) {
  const database = await databasePromise;
  return database.getAllAsync<{ id: string; operation: string; payload: string }>(
    "SELECT id, operation, payload FROM sync_queue WHERE profile_id = ? ORDER BY created_at",
    profileId,
  );
}

export async function removePendingSyncOperation(id: string): Promise<void> {
  const database = await databasePromise;
  await database.runAsync("DELETE FROM sync_queue WHERE id = ?", id);
}

export async function createLocalBackup(profileId: string, owner: string) {
  const goal = await getLocalGoal(profileId);
  const [progress, reviews] = await Promise.all([
    getLocalProgress(profileId),
    getLocalReviewHistory(profileId),
  ]);
  const kanjis = await getLocalKanjis();
  return {
    format: "kanjisensei-study-backup",
    version: 1,
    owner,
    createdAt: new Date().toISOString(),
    progress: progress.flatMap((item) => {
      const kanji = kanjis.find((value) => value.id === item.kanjiId);
      return kanji ? [{ ...item, character: kanji.character }] : [];
    }),
    reviews: reviews.flatMap((item) => {
      const kanji = kanjis.find((value) => value.id === item.kanjiId);
      return kanji ? [{ ...item, character: kanji.character }] : [];
    }),
    quizzes: await getLocalQuizAttempts(profileId),
    lists: await getLocalStudyLists(profileId),
    goal: { target: goal.target, unit: goal.unit },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function restoreLocalBackup(profileId: string, owner: string, value: unknown): Promise<void> {
  if (!isRecord(value) || value.format !== "kanjisensei-study-backup" || value.version !== 1 ||
    value.owner !== owner || !Array.isArray(value.progress) || !Array.isArray(value.reviews) ||
    !Array.isArray(value.quizzes) || !Array.isArray(value.lists) || !isRecord(value.goal)) {
    throw new Error("Arquivo de backup inválido ou pertencente a outro perfil.");
  }
  const progress = value.progress;
  const reviews = value.reviews;
  const quizzes = value.quizzes;
  const lists = value.lists;
  const goal = value.goal;
  const validProgress = progress.every((item) => isRecord(item) &&
    typeof item.kanjiId === "number" && Number.isInteger(item.kanjiId) &&
    typeof item.character === "string" &&
    ["not_started", "learning", "learned"].includes(String(item.status)) &&
    typeof item.favorite === "boolean" && typeof item.difficult === "boolean" &&
    (item.dueAt === null || typeof item.dueAt === "string") &&
    typeof item.intervalDays === "number" && typeof item.easeFactor === "number" &&
    typeof item.repetitions === "number" &&
    (item.lastReviewedAt === null || typeof item.lastReviewedAt === "string"));
  const validReviews = reviews.every((item) => isRecord(item) &&
    typeof item.kanjiId === "number" && Number.isInteger(item.kanjiId) &&
    typeof item.character === "string" &&
    typeof item.rating === "number" && Number.isInteger(item.rating) && item.rating >= 0 && item.rating <= 5 &&
    typeof item.reviewedAt === "string" && !Number.isNaN(Date.parse(item.reviewedAt)) &&
    typeof item.dueAt === "string" && !Number.isNaN(Date.parse(item.dueAt)));
  const validQuizzes = quizzes.every((item) => isRecord(item) &&
    typeof item.correctAnswers === "number" && Number.isInteger(item.correctAnswers) && item.correctAnswers >= 0 &&
    typeof item.totalQuestions === "number" && Number.isInteger(item.totalQuestions) && item.totalQuestions >= 1 &&
    item.correctAnswers <= item.totalQuestions &&
    typeof item.completedAt === "string" && !Number.isNaN(Date.parse(item.completedAt)));
  const validLists = lists.every((item) => isRecord(item) &&
    typeof item.clientId === "string" && typeof item.name === "string" &&
    Array.isArray(item.characters) && item.characters.every((character) => typeof character === "string"));
  const validGoal = typeof goal.target === "number" && Number.isInteger(goal.target) &&
    goal.target >= 1 && goal.target <= 1000 && ["KANJIS", "ACTIVITIES"].includes(String(goal.unit));
  if (!validProgress || !validReviews || !validQuizzes || !validLists || !validGoal) {
    throw new Error("O backup contém dados inválidos; nenhum dado foi alterado.");
  }

  const database = await databasePromise;
  const localKanjis = await getLocalKanjis();
  const kanjiIdsByCharacter = new Map(localKanjis.map((kanji) => [kanji.character, kanji.id]));
  const referencedCharacters = [
    ...progress.map((item) => (item as Record<string, unknown>).character as string),
    ...reviews.map((item) => (item as Record<string, unknown>).character as string),
  ];
  if (referencedCharacters.some((character) => !kanjiIdsByCharacter.has(character))) {
    throw new Error("O backup referencia kanjis que não estão no catálogo deste aparelho.");
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM kanji_progress WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM review_history WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM quiz_attempts WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM study_lists WHERE profile_id = ?", profileId);
    await transaction.runAsync("DELETE FROM daily_goals WHERE profile_id = ?", profileId);
    for (const raw of progress) {
      const item = raw as Record<string, unknown>;
      await transaction.runAsync(
        `INSERT INTO kanji_progress
          (profile_id, kanji_id, status, favorite, difficult, due_at, interval_days, ease_factor, repetitions, last_reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        profileId, kanjiIdsByCharacter.get(item.character as string)!, item.status as string, item.favorite ? 1 : 0,
        item.difficult ? 1 : 0, item.dueAt as string | null, item.intervalDays as number,
        item.easeFactor as number, item.repetitions as number, item.lastReviewedAt as string | null,
      );
    }
    for (const raw of reviews) {
      const item = raw as Record<string, unknown>;
      await transaction.runAsync(
        "INSERT INTO review_history (profile_id, kanji_id, rating, reviewed_at, due_at) VALUES (?, ?, ?, ?, ?)",
        profileId, kanjiIdsByCharacter.get(item.character as string)!, item.rating as number, item.reviewedAt as string, item.dueAt as string,
      );
    }
    for (const raw of quizzes) {
      const item = raw as Record<string, unknown>;
      await transaction.runAsync(
        "INSERT INTO quiz_attempts (profile_id, correct_answers, total_questions, completed_at) VALUES (?, ?, ?, ?)",
        profileId, item.correctAnswers as number, item.totalQuestions as number, item.completedAt as string,
      );
    }
    for (const raw of lists) {
      const item = raw as Record<string, unknown>;
      await transaction.runAsync(
        "INSERT INTO study_lists (profile_id, client_id, name, characters) VALUES (?, ?, ?, ?)",
        profileId, item.clientId as string, item.name as string, JSON.stringify(item.characters),
      );
    }
    await transaction.runAsync(
      "INSERT INTO daily_goals (profile_id, target, unit, progress) VALUES (?, ?, ?, 0)",
      profileId, goal.target as number, goal.unit as string,
    );
    await transaction.runAsync("DELETE FROM sync_queue WHERE profile_id = ?", profileId);
  });
}