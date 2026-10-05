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
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
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
  response.json({ token, user: { id: user.id, email: user.email } });
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
      select: { id: true, email: true },
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

  if (jlpt && !validJlptLevels.includes(jlpt)) {
    response.status(400).json({ message: "Nível JLPT inválido." });
    return;
  }

  const kanjis = await prisma.kanji.findMany({
    where: jlpt ? { jlpt } : undefined,
    orderBy: { character: "asc" },
  });
  response.json(kanjis.map(({ examples, ...kanji }) => ({
    ...kanji,
    examples: parseExamples(examples),
  })));
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
    if (rating !== undefined && entry.dueAt) {
      await transaction.reviewHistory.create({
        data: {
          userId,
          kanjiId,
          rating,
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

  const attempt = await prisma.quizAttempt.create({
    data: { userId, correctAnswers, totalQuestions },
  });
  response.status(201).json({
    id: attempt.id,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt.toISOString(),
  });
});