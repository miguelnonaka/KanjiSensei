import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type Request } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

export const app = express();
export const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

app.use(cors());
app.use(express.json());

function authenticatedUserId(request: Request): number | null {
  if (!jwtSecret) return null;
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || typeof payload.userId !== "number") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

function parseExamples(serialized: string | null): unknown[] {
  if (!serialized) return [];
  try {
    const examples: unknown = JSON.parse(serialized);
    return Array.isArray(examples) ? examples : [];
  } catch {
    return [];
  }
}

function compareCatalogOrder(
  left: { jlpt: string | null; catalogOrder: number | null; character: string },
  right: { jlpt: string | null; catalogOrder: number | null; character: string },
): number {
  const levelOrder = ["N5", "N4", "N3", "N2", "N1"];
  const leftLevel = levelOrder.indexOf(left.jlpt ?? "");
  const rightLevel = levelOrder.indexOf(right.jlpt ?? "");
  const levelDifference = (leftLevel < 0 ? levelOrder.length : leftLevel) -
    (rightLevel < 0 ? levelOrder.length : rightLevel);
  if (levelDifference !== 0) return levelDifference;
  const leftOrder = left.catalogOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.catalogOrder ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.character.localeCompare(right.character);
}

function orderCatalog<T extends { jlpt: string | null; catalogOrder: number | null; character: string }>(
  kanjis: T[],
): T[] {
  return kanjis.sort(compareCatalogOrder);
}

async function requireAdmin(request: Request, response: express.Response): Promise<number | null> {
  const userId = authenticatedUserId(request);
  if (!userId) {
    response.status(401).json({ message: "Autenticação necessária." });
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) {
    response.status(401).json({ message: "Usuário não encontrado." });
    return null;
  }
  if (user.role !== "ADMIN") {
    response.status(403).json({ message: "Acesso restrito a administradores." });
    return null;
  }
  return userId;
}

function parseKanjiPayload(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const jlpt = input.jlpt === null || input.jlpt === undefined ? null : input.jlpt;
  const strokeCount = input.strokeCount === null || input.strokeCount === undefined
    ? null
    : input.strokeCount;
  const examples = input.examples === undefined ? [] : input.examples;
  if (
    typeof input.character !== "string" || !input.character.trim() ||
    typeof input.meaning !== "string" || !input.meaning.trim() ||
    (input.onyomi !== undefined && input.onyomi !== null && typeof input.onyomi !== "string") ||
    (input.kunyomi !== undefined && input.kunyomi !== null && typeof input.kunyomi !== "string") ||
    (input.radical !== undefined && input.radical !== null && typeof input.radical !== "string") ||
    (input.etymology !== undefined && input.etymology !== null &&
      (typeof input.etymology !== "string" || input.etymology.length > 2000)) ||
    (input.mnemonic !== undefined && input.mnemonic !== null &&
      (typeof input.mnemonic !== "string" || input.mnemonic.length > 2000)) ||
    (strokeCount !== null && (typeof strokeCount !== "number" || !Number.isInteger(strokeCount) || strokeCount < 1 || strokeCount > 100)) ||
    (jlpt !== null && (typeof jlpt !== "string" || !["N1", "N2", "N3", "N4", "N5"].includes(jlpt))) ||
    !Array.isArray(examples) ||
    !examples.every((example) => example && typeof example === "object" &&
      typeof example.word === "string" && typeof example.reading === "string" && typeof example.meaning === "string")
  ) return null;
  return {
    character: input.character.trim(),
    meaning: input.meaning.trim(),
    onyomi: typeof input.onyomi === "string" ? input.onyomi : null,
    kunyomi: typeof input.kunyomi === "string" ? input.kunyomi : null,
    radical: typeof input.radical === "string" ? input.radical.trim() : null,
    etymology: typeof input.etymology === "string" ? input.etymology.trim() || null : null,
    mnemonic: typeof input.mnemonic === "string" ? input.mnemonic.trim() || null : null,
    strokeCount: typeof strokeCount === "number" ? strokeCount : null,
    jlpt: typeof jlpt === "string" ? jlpt : null,
    examples: JSON.stringify(examples),
  };
}

function getRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[\w-]{1,80}$/.test(value) ? value : undefined;
}

type BackupSnapshot = {
  version: 1;
  progress: Array<{
    kanjiId: number;
    status: string;
    favorite: boolean;
    difficult: boolean;
    dueAt: string | null;
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    lastReviewedAt: string | null;
  }>;
  reviews: Array<{ kanjiId: number; rating: number; reviewedAt: string; dueAt: string }>;
  quizzes: Array<{ correctAnswers: number; totalQuestions: number; completedAt: string }>;
  lists: Array<{ clientId: string; name: string; characters: string[] }>;
  goal: { target: number; unit: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseBackupSnapshot(value: unknown): BackupSnapshot | null {
  if (!isRecord(value) || value.version !== 1 ||
    !Array.isArray(value.progress) || !Array.isArray(value.reviews) ||
    !Array.isArray(value.quizzes) || !Array.isArray(value.lists)) return null;

  const validProgress = value.progress.every((item) => isRecord(item) &&
    typeof item.kanjiId === "number" && Number.isSafeInteger(item.kanjiId) && item.kanjiId > 0 &&
    typeof item.status === "string" && ["not_started", "learning", "learned"].includes(item.status) &&
    typeof item.favorite === "boolean" && typeof item.difficult === "boolean" &&
    (item.dueAt === null || (typeof item.dueAt === "string" && !Number.isNaN(Date.parse(item.dueAt)))) &&
    typeof item.intervalDays === "number" && Number.isInteger(item.intervalDays) && item.intervalDays >= 0 &&
    typeof item.easeFactor === "number" && Number.isFinite(item.easeFactor) &&
    typeof item.repetitions === "number" && Number.isInteger(item.repetitions) && item.repetitions >= 0 &&
    (item.lastReviewedAt === null || (typeof item.lastReviewedAt === "string" && !Number.isNaN(Date.parse(item.lastReviewedAt)))));
  const validReviews = value.reviews.every((item) => isRecord(item) &&
    typeof item.kanjiId === "number" && Number.isSafeInteger(item.kanjiId) && item.kanjiId > 0 &&
    typeof item.rating === "number" && Number.isInteger(item.rating) && item.rating >= 0 && item.rating <= 5 &&
    typeof item.reviewedAt === "string" && !Number.isNaN(Date.parse(item.reviewedAt)) &&
    typeof item.dueAt === "string" && !Number.isNaN(Date.parse(item.dueAt)));
  const validQuizzes = value.quizzes.every((item) => isRecord(item) &&
    typeof item.correctAnswers === "number" && Number.isInteger(item.correctAnswers) && item.correctAnswers >= 0 &&
    typeof item.totalQuestions === "number" && Number.isInteger(item.totalQuestions) && item.totalQuestions >= 1 &&
    item.correctAnswers <= item.totalQuestions &&
    typeof item.completedAt === "string" && !Number.isNaN(Date.parse(item.completedAt)));
  const validLists = value.lists.every((item) => isRecord(item) &&
    typeof item.clientId === "string" && /^[\w-]{1,80}$/.test(item.clientId) &&
    typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 60 &&
    Array.isArray(item.characters) && item.characters.every((character) => typeof character === "string"));
  const goal = value.goal === null || (isRecord(value.goal) &&
    typeof value.goal.target === "number" && Number.isInteger(value.goal.target) &&
    value.goal.target >= 1 && value.goal.target <= 1000 &&
    (value.goal.unit === "KANJIS" || value.goal.unit === "ACTIVITIES"));
  if (!validProgress || !validReviews || !validQuizzes || !validLists || !goal) return null;
  return value as BackupSnapshot;
}

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "kanjisensei-backend" });
});

app.post("/api/auth/register", async (request, response) => {
  const email = typeof request.body.email === "string"
    ? request.body.email.trim().toLowerCase()
    : "";
  const password = typeof request.body.password === "string"
    ? request.body.password
    : "";

  if (!email || !email.includes("@") || password.length < 8) {
    response.status(400).json({
      message: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres.",
    });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    response.status(409).json({ message: "Este e-mail já está cadastrado." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: adminEmails.includes(email) ? "ADMIN" : "USER" },
    select: { id: true, email: true, role: true },
  });
  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });

  response.status(201).json({ token, user });
});

app.post("/api/auth/login", async (request, response) => {
  const email = typeof request.body.email === "string"
    ? request.body.email.trim().toLowerCase()
    : "";
  const password = typeof request.body.password === "string"
    ? request.body.password
    : "";
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    response.status(401).json({ message: "E-mail ou senha inválidos." });
    return;
  }

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
  response.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.get("/api/auth/me", async (request, response) => {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!token) {
    response.status(401).json({ message: "Token de autenticação ausente." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || typeof payload.userId !== "number") {
      response.status(401).json({ message: "Token inválido." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      response.status(401).json({ message: "Usuário não encontrado." });
      return;
    }

    response.json({ user });
  } catch {
    response.status(401).json({ message: "Token inválido ou expirado." });
  }
});

app.get("/api/kanjis", async (request, response) => {
  const jlpt = typeof request.query.jlpt === "string"
    ? request.query.jlpt.toUpperCase()
    : undefined;
  const validJlptLevels = ["N1", "N2", "N3", "N4", "N5"];
  const radical = typeof request.query.radical === "string" ? request.query.radical.trim() : undefined;
  const meaning = typeof request.query.meaning === "string" ? request.query.meaning.trim() : undefined;
  const minStrokes = request.query.minStrokes === undefined ? undefined : Number(request.query.minStrokes);
  const maxStrokes = request.query.maxStrokes === undefined ? undefined : Number(request.query.maxStrokes);
  const sort = typeof request.query.sort === "string" ? request.query.sort : undefined;

  if (jlpt && !validJlptLevels.includes(jlpt)) {
    response.status(400).json({ message: "Nível JLPT inválido." });
    return;
  }
  if (
    (minStrokes !== undefined && (!Number.isInteger(minStrokes) || minStrokes < 1 || minStrokes > 100)) ||
    (maxStrokes !== undefined && (!Number.isInteger(maxStrokes) || maxStrokes < 1 || maxStrokes > 100)) ||
    (minStrokes !== undefined && maxStrokes !== undefined && minStrokes > maxStrokes) ||
    (sort !== undefined && !["character", "jlpt", "strokes"].includes(sort))
  ) {
    response.status(400).json({ message: "Filtro ou ordenação inválidos." });
    return;
  }

  const kanjis = await prisma.kanji.findMany({
    where: {
      ...(jlpt ? { jlpt } : {}),
      ...(radical ? { radical } : {}),
      ...(meaning ? { meaning: { contains: meaning } } : {}),
      ...(minStrokes !== undefined || maxStrokes !== undefined
        ? { strokeCount: { ...(minStrokes !== undefined ? { gte: minStrokes } : {}), ...(maxStrokes !== undefined ? { lte: maxStrokes } : {}) } }
        : {}),
    },
  });
  const sortedKanjis = sort === "character"
    ? kanjis.sort((left, right) => left.character.localeCompare(right.character))
    : sort === "strokes"
      ? kanjis.sort((left, right) =>
        (left.strokeCount ?? Number.MAX_SAFE_INTEGER) - (right.strokeCount ?? Number.MAX_SAFE_INTEGER) ||
        compareCatalogOrder(left, right))
      : orderCatalog(kanjis);
  response.json(sortedKanjis.map(({ examples, ...kanji }) => ({
    ...kanji,
    examples: parseExamples(examples),
  })));
});

app.get("/api/radicals", async (_request, response) => {
  const radicals = await prisma.kanji.findMany({
    where: { radical: { not: null } },
    distinct: ["radical"],
    select: { radical: true },
    orderBy: { radical: "asc" },
  });
  response.json(radicals.flatMap(({ radical }) => radical ? [radical] : []));
});

app.get("/api/admin/kanjis", async (request, response) => {
  if (await requireAdmin(request, response) === null) return;
  const kanjis = orderCatalog(await prisma.kanji.findMany());
  response.json(kanjis.map(({ examples, ...kanji }) => ({ ...kanji, examples: parseExamples(examples) })));
});

app.post("/api/admin/kanjis", async (request, response) => {
  if (await requireAdmin(request, response) === null) return;
  const data = parseKanjiPayload(request.body);
  if (!data) {
    response.status(400).json({ message: "Dados do kanji inválidos." });
    return;
  }
  if (await prisma.kanji.findUnique({ where: { character: data.character }, select: { id: true } })) {
    response.status(409).json({ message: "Este kanji já existe." });
    return;
  }
  const kanji = await prisma.kanji.create({ data });
  response.status(201).json({ ...kanji, examples: parseExamples(kanji.examples) });
});

app.put("/api/admin/kanjis/:kanjiId", async (request, response) => {
  if (await requireAdmin(request, response) === null) return;
  const kanjiId = Number(request.params.kanjiId);
  const data = parseKanjiPayload(request.body);
  if (!Number.isSafeInteger(kanjiId) || kanjiId < 1 || !data) {
    response.status(400).json({ message: "Dados do kanji inválidos." });
    return;
  }
  const existing = await prisma.kanji.findUnique({ where: { id: kanjiId }, select: { id: true } });
  if (!existing) {
    response.status(404).json({ message: "Kanji não encontrado." });
    return;
  }
  const duplicate = await prisma.kanji.findUnique({ where: { character: data.character }, select: { id: true } });
  if (duplicate && duplicate.id !== kanjiId) {
    response.status(409).json({ message: "Este kanji já existe." });
    return;
  }
  const kanji = await prisma.kanji.update({ where: { id: kanjiId }, data });
  response.json({ ...kanji, examples: parseExamples(kanji.examples) });
});

app.delete("/api/admin/kanjis/:kanjiId", async (request, response) => {
  if (await requireAdmin(request, response) === null) return;
  const kanjiId = Number(request.params.kanjiId);
  if (!Number.isSafeInteger(kanjiId) || kanjiId < 1) {
    response.status(400).json({ message: "Identificador de kanji inválido." });
    return;
  }
  const existing = await prisma.kanji.findUnique({ where: { id: kanjiId }, select: { id: true } });
  if (!existing) {
    response.status(404).json({ message: "Kanji não encontrado." });
    return;
  }
  await prisma.$transaction([
    prisma.studyListItem.deleteMany({ where: { kanjiId } }),
    prisma.reviewHistory.deleteMany({ where: { kanjiId } }),
    prisma.userKanji.deleteMany({ where: { kanjiId } }),
    prisma.kanji.delete({ where: { id: kanjiId } }),
  ]);
  response.status(204).end();
});

app.get("/api/admin/users", async (request, response) => {
  if (await requireAdmin(request, response) === null) return;
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
  response.json(users);
});

app.put("/api/admin/users/:userId/role", async (request, response) => {
  const adminId = await requireAdmin(request, response);
  if (adminId === null) return;
  const userId = Number(request.params.userId);
  const role = request.body?.role;
  if (!Number.isSafeInteger(userId) || userId < 1 || (role !== "USER" && role !== "ADMIN")) {
    response.status(400).json({ message: "Usuário ou permissão inválidos." });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) {
    response.status(404).json({ message: "Usuário não encontrado." });
    return;
  }
  if (target.role === "ADMIN" && role === "USER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      response.status(409).json({ message: "O sistema precisa manter ao menos um administrador." });
      return;
    }
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });
  response.json(user);
});

app.get("/api/me/kanjis", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }

  const entries = await prisma.userKanji.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  response.json(entries.map((entry) => ({
    kanjiId: entry.kanjiId,
    status: entry.status,
    favorite: entry.favorite,
    difficult: entry.difficult,
    dueAt: entry.dueAt?.toISOString() ?? null,
    intervalDays: entry.intervalDays,
    easeFactor: entry.easeFactor,
    repetitions: entry.repetitions,
    lastReviewedAt: entry.lastReviewedAt?.toISOString() ?? null,
  })));
});

app.put("/api/me/kanjis/:kanjiId", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }

  const kanjiId = Number(request.params.kanjiId);
  const body = request.body && typeof request.body === "object"
    ? request.body as Record<string, unknown>
    : {};
  const statuses = ["not_started", "learning", "learned"];
  const status = body.status;
  const rating = body.rating;
  const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
  const lastReviewedAt = typeof body.lastReviewedAt === "string"
    ? new Date(body.lastReviewedAt)
    : null;

  if (!Number.isSafeInteger(kanjiId) || kanjiId < 1) {
    response.status(400).json({ message: "Identificador de kanji inválido." });
    return;
  }
  if (status !== undefined && (typeof status !== "string" || !statuses.includes(status))) {
    response.status(400).json({ message: "Status de estudo inválido." });
    return;
  }
  if (body.favorite !== undefined && typeof body.favorite !== "boolean") {
    response.status(400).json({ message: "Favorito deve ser verdadeiro ou falso." });
    return;
  }
  if (body.difficult !== undefined && typeof body.difficult !== "boolean") {
    response.status(400).json({ message: "Dificuldade deve ser verdadeira ou falsa." });
    return;
  }
  if (rating !== undefined && (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 5)) {
    response.status(400).json({ message: "Avaliação deve ser um inteiro entre 0 e 5." });
    return;
  }
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    response.status(400).json({ message: "Data de revisão inválida." });
    return;
  }
  if (lastReviewedAt && Number.isNaN(lastReviewedAt.getTime())) {
    response.status(400).json({ message: "Data da revisão inválida." });
    return;
  }

  const kanji = await prisma.kanji.findUnique({ where: { id: kanjiId }, select: { id: true } });
  if (!kanji) {
    response.status(404).json({ message: "Kanji não encontrado." });
    return;
  }

  const existing = await prisma.userKanji.findUnique({
    where: { userId_kanjiId: { userId, kanjiId } },
  });
  const updateData = {
    status: typeof status === "string" ? status : existing?.status ?? "not_started",
    favorite: typeof body.favorite === "boolean" ? body.favorite : existing?.favorite ?? false,
    difficult: typeof body.difficult === "boolean" ? body.difficult : existing?.difficult ?? false,
    dueAt: dueAt ?? existing?.dueAt ?? null,
    intervalDays: typeof body.intervalDays === "number" && Number.isInteger(body.intervalDays) && body.intervalDays >= 0
      ? body.intervalDays
      : existing?.intervalDays ?? 0,
    easeFactor: typeof body.easeFactor === "number" && Number.isFinite(body.easeFactor)
      ? Math.max(1.3, Math.min(5, body.easeFactor))
      : existing?.easeFactor ?? 2.5,
    repetitions: typeof body.repetitions === "number" && Number.isInteger(body.repetitions) && body.repetitions >= 0
      ? body.repetitions
      : existing?.repetitions ?? 0,
    lastReviewedAt: lastReviewedAt ?? existing?.lastReviewedAt ?? null,
  };

  const saved = await prisma.$transaction(async (transaction) => {
    const entry = await transaction.userKanji.upsert({
      where: { userId_kanjiId: { userId, kanjiId } },
      update: updateData,
      create: { userId, kanjiId, ...updateData },
    });
    const requestId = getRequestId(body.requestId);
    if (rating !== undefined && entry.dueAt && !(requestId && await transaction.reviewHistory.findUnique({
      where: { userId_requestId: { userId, requestId } },
    }))) {
      await transaction.reviewHistory.create({
        data: {
          userId,
          kanjiId,
          rating,
          requestId,
          reviewedAt: entry.lastReviewedAt ?? new Date(),
          dueAt: entry.dueAt,
        },
      });
    }
    return entry;
  });

  response.json({
    kanjiId: saved.kanjiId,
    status: saved.status,
    favorite: saved.favorite,
    difficult: saved.difficult,
    dueAt: saved.dueAt?.toISOString() ?? null,
    intervalDays: saved.intervalDays,
    easeFactor: saved.easeFactor,
    repetitions: saved.repetitions,
    lastReviewedAt: saved.lastReviewedAt?.toISOString() ?? null,
  });
});

app.get("/api/me/reviews", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }

  const reviews = await prisma.reviewHistory.findMany({
    where: { userId },
    include: { kanji: { select: { character: true } } },
    orderBy: { reviewedAt: "desc" },
    take: 100,
  });
  response.json(reviews.map((review) => ({
    id: review.id,
    kanjiId: review.kanjiId,
    character: review.kanji.character,
    rating: review.rating,
    reviewedAt: review.reviewedAt.toISOString(),
    dueAt: review.dueAt.toISOString(),
  })));
});

app.get("/api/me/quizzes", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
    take: 50,
  });
  response.json(attempts.map((attempt) => ({
    id: attempt.id,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt.toISOString(),
  })));
});

app.post("/api/me/quizzes", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }

  const body = request.body && typeof request.body === "object"
    ? request.body as Record<string, unknown>
    : {};
  const { correctAnswers, totalQuestions } = body;
  if (
    typeof correctAnswers !== "number" || !Number.isInteger(correctAnswers) || correctAnswers < 0 ||
    typeof totalQuestions !== "number" || !Number.isInteger(totalQuestions) || totalQuestions < 1 ||
    correctAnswers > totalQuestions
  ) {
    response.status(400).json({ message: "Informe uma pontuação válida para o quiz." });
    return;
  }

  const requestId = getRequestId(body.requestId);
  if (requestId) {
    const existing = await prisma.quizAttempt.findUnique({
      where: { userId_requestId: { userId, requestId } },
    });
    if (existing) {
      response.status(200).json({
        id: existing.id,
        correctAnswers: existing.correctAnswers,
        totalQuestions: existing.totalQuestions,
        completedAt: existing.completedAt.toISOString(),
      });
      return;
    }
  }
  const attempt = await prisma.quizAttempt.create({
    data: { userId, correctAnswers, totalQuestions, requestId },
  });
  response.status(201).json({
    id: attempt.id,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt.toISOString(),
  });
});

app.get("/api/me/study-lists", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const lists = await prisma.studyList.findMany({
    where: { userId },
    include: { items: { include: { kanji: { select: { character: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  response.json(lists.map((list) => ({
    clientId: list.clientId,
    name: list.name,
    characters: list.items.map((item) => item.kanji.character),
  })));
});

app.put("/api/me/study-lists/:clientId", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const { clientId } = request.params;
  const { name, characters } = request.body ?? {};
  if (
    !/^[\w-]{1,80}$/.test(clientId) ||
    typeof name !== "string" || !name.trim() || name.trim().length > 60 ||
    !Array.isArray(characters) || characters.length > 200 ||
    !characters.every((character: unknown) => typeof character === "string")
  ) {
    response.status(400).json({ message: "Lista de estudo inválida." });
    return;
  }
  const uniqueCharacters = [...new Set(characters as string[])];
  const kanjis = await prisma.kanji.findMany({
    where: { character: { in: uniqueCharacters } },
    select: { id: true, character: true },
  });
  if (kanjis.length !== uniqueCharacters.length) {
    response.status(400).json({ message: "A lista contém kanjis inexistentes." });
    return;
  }
  const list = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.studyList.upsert({
      where: { userId_clientId: { userId, clientId } },
      update: { name: name.trim() },
      create: { userId, clientId, name: name.trim() },
    });
    await transaction.studyListItem.deleteMany({ where: { listId: saved.id } });
    if (kanjis.length) {
      await transaction.studyListItem.createMany({
        data: kanjis.map((kanji) => ({ listId: saved.id, kanjiId: kanji.id })),
      });
    }
    return saved;
  });
  response.json({ clientId: list.clientId, name: list.name, characters: uniqueCharacters });
});

app.delete("/api/me/study-lists/:clientId", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  await prisma.studyList.deleteMany({ where: { userId, clientId: request.params.clientId } });
  response.status(204).end();
});

async function getGoalProgress(userId: number, unit: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const reviews = unit === "KANJIS"
    ? await prisma.reviewHistory.findMany({
      where: { userId, reviewedAt: { gte: today } },
      distinct: ["kanjiId"],
      select: { kanjiId: true },
    }).then((items) => items.length)
    : await prisma.reviewHistory.count({ where: { userId, reviewedAt: { gte: today } } });
  const quizzes = unit === "ACTIVITIES"
    ? await prisma.quizAttempt.count({ where: { userId, completedAt: { gte: today } } })
    : 0;
  return reviews + quizzes;
}

app.get("/api/me/goal", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const goal = await prisma.dailyGoal.findUnique({ where: { userId } });
  const target = goal?.target ?? 10;
  const unit = goal?.unit ?? "KANJIS";
  response.json({ target, unit, progress: await getGoalProgress(userId, unit) });
});

app.put("/api/me/goal", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const { target, unit } = request.body ?? {};
  if (!Number.isInteger(target) || target < 1 || target > 1000 || !["KANJIS", "ACTIVITIES"].includes(unit)) {
    response.status(400).json({ message: "Informe uma meta de 1 a 1000 kanjis ou atividades." });
    return;
  }
  await prisma.dailyGoal.upsert({
    where: { userId },
    update: { target, unit },
    create: { userId, target, unit },
  });
  response.json({ target, unit, progress: await getGoalProgress(userId, unit) });
});

app.get("/api/me/backups", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const backups = await prisma.backup.findMany({
    where: { userId },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  response.json(backups.map((backup) => ({ id: backup.id, createdAt: backup.createdAt.toISOString() })));
});

app.post("/api/me/backups", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const [progress, reviews, quizzes, lists, goal] = await Promise.all([
    prisma.userKanji.findMany({ where: { userId }, select: {
      kanjiId: true, status: true, favorite: true, difficult: true, dueAt: true,
      intervalDays: true, easeFactor: true, repetitions: true, lastReviewedAt: true,
    } }),
    prisma.reviewHistory.findMany({ where: { userId }, select: { kanjiId: true, rating: true, reviewedAt: true, dueAt: true } }),
    prisma.quizAttempt.findMany({ where: { userId }, select: { correctAnswers: true, totalQuestions: true, completedAt: true } }),
    prisma.studyList.findMany({
      where: { userId },
      include: { items: { include: { kanji: { select: { character: true } } } } },
    }),
    prisma.dailyGoal.findUnique({ where: { userId }, select: { target: true, unit: true } }),
  ]);
  const snapshot = {
    version: 1,
    progress: progress.map((item) => ({ ...item, dueAt: item.dueAt?.toISOString() ?? null, lastReviewedAt: item.lastReviewedAt?.toISOString() ?? null })),
    reviews: reviews.map((item) => ({ ...item, reviewedAt: item.reviewedAt.toISOString(), dueAt: item.dueAt.toISOString() })),
    quizzes: quizzes.map((item) => ({ ...item, completedAt: item.completedAt.toISOString() })),
    lists: lists.map((list) => ({ clientId: list.clientId, name: list.name, characters: list.items.map((item) => item.kanji.character) })),
    goal,
  };
  const backup = await prisma.backup.create({ data: { userId, data: JSON.stringify(snapshot) } });
  response.status(201).json({ id: backup.id, createdAt: backup.createdAt.toISOString() });
});

app.post("/api/me/backups/:backupId/restore", async (request, response) => {
  const userId = authenticatedUserId(request);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    response.status(401).json({ message: "Autenticação necessária." });
    return;
  }
  const backupId = Number(request.params.backupId);
  const backup = Number.isSafeInteger(backupId) && backupId > 0
    ? await prisma.backup.findFirst({ where: { id: backupId, userId } })
    : null;
  if (!backup) {
    response.status(404).json({ message: "Backup não encontrado para esta conta." });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(backup.data) as unknown;
  } catch {
    response.status(422).json({ message: "O conteúdo do backup está corrompido." });
    return;
  }
  const snapshot = parseBackupSnapshot(parsed);
  if (!snapshot) {
    response.status(422).json({ message: "O formato do backup não é compatível." });
    return;
  }
  const characters = snapshot.lists.flatMap((list) => list.characters);
  const referencedKanjis = new Set([
    ...snapshot.progress.map((item) => item.kanjiId),
    ...snapshot.reviews.map((item) => item.kanjiId),
  ]);
  const knownKanjis = await prisma.kanji.findMany({
    where: { OR: [
      { id: { in: [...referencedKanjis] } },
      { character: { in: characters } },
    ] },
    select: { id: true, character: true },
  });
  if (
    knownKanjis.filter((kanji) => referencedKanjis.has(kanji.id)).length !== referencedKanjis.size ||
    characters.some((character) => !knownKanjis.some((kanji) => kanji.character === character))
  ) {
    response.status(422).json({ message: "O backup referencia kanjis que não existem mais." });
    return;
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.userKanji.deleteMany({ where: { userId } });
    await transaction.reviewHistory.deleteMany({ where: { userId } });
    await transaction.quizAttempt.deleteMany({ where: { userId } });
    await transaction.studyList.deleteMany({ where: { userId } });
    await transaction.dailyGoal.deleteMany({ where: { userId } });
    for (const item of snapshot.progress) {
      await transaction.userKanji.create({ data: { userId, ...item, dueAt: item.dueAt ? new Date(item.dueAt) : null, lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt) : null } });
    }
    for (const item of snapshot.reviews) {
      await transaction.reviewHistory.create({ data: { userId, ...item, reviewedAt: new Date(item.reviewedAt), dueAt: new Date(item.dueAt) } });
    }
    for (const item of snapshot.quizzes) {
      await transaction.quizAttempt.create({ data: { userId, ...item, completedAt: new Date(item.completedAt) } });
    }
    for (const item of snapshot.lists) {
      const saved = await transaction.studyList.create({ data: { userId, clientId: item.clientId, name: item.name } });
      const listKanjis = knownKanjis.filter((kanji) => item.characters.includes(kanji.character));
      if (listKanjis.length) {
        await transaction.studyListItem.createMany({ data: listKanjis.map((kanji) => ({ listId: saved.id, kanjiId: kanji.id })) });
      }
    }
    if (snapshot.goal) {
      await transaction.dailyGoal.create({ data: { userId, ...snapshot.goal } });
    }
  });
  response.json({ restored: true });
});