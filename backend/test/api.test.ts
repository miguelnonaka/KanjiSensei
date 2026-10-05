import assert from "node:assert/strict";
import { test, after } from "node:test";
import request from "supertest";
import { app, prisma } from "../src/app.js";

const email = `test-${Date.now()}@example.com`;
const password = "KanjiTest123";
let token = "";
let userId = 0;
let kanjiId = 0;

test("health check responde que a API está funcionando", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "kanjisensei-backend",
  });
});

test("cadastro rejeita senha curta", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "123" });

  assert.equal(response.status, 400);
});

test("cadastro cria usuário e retorna token", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: `  ${email.toUpperCase()} `, password });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, email);
  assert.equal(typeof response.body.token, "string");
  assert.notEqual(response.body.token, "");
  token = response.body.token;
  userId = response.body.user.id;

  const savedUser = await prisma.user.findUnique({ where: { id: userId } });
  assert.ok(savedUser);
  assert.notEqual(savedUser.passwordHash, password);
});

test("login rejeita senha incorreta", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "senha-incorreta" });

  assert.equal(response.status, 401);
});

test("login e sessão retornam o usuário autenticado", async () => {
  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.email, email);

  const sessionResponse = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${loginResponse.body.token}`);

  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionResponse.body.user.id, userId);
});

test("sessão sem token é rejeitada", async () => {
  const response = await request(app).get("/api/auth/me");

  assert.equal(response.status, 401);
});

test("lista de kanjis retorna dados persistidos", async () => {
  await prisma.kanji.upsert({
    where: { character: "日" },
    update: {},
    create: {
      character: "日",
      meaning: "dia; sol",
      onyomi: "ニチ, ジツ",
      kunyomi: "ひ, か",
      strokeCount: 4,
      jlpt: "N5",
    },
  });

  const response = await request(app)
    .get("/api/kanjis")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 32);
  assert.ok(response.body.some((kanji: { character: string }) => kanji.character === "日"));
  const sun = response.body.find((kanji: { character: string }) => kanji.character === "日");
  kanjiId = sun.id;
  assert.ok(Array.isArray(sun.examples));
  assert.equal(sun.examples[0]?.word, "日本");
});

test("progresso e favoritos exigem autenticação e são persistidos", async () => {
  const unauthorized = await request(app).get("/api/me/kanjis");
  assert.equal(unauthorized.status, 401);

  const saved = await request(app)
    .put(`/api/me/kanjis/${kanjiId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "learning", favorite: true });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, "learning");
  assert.equal(saved.body.favorite, true);

  const list = await request(app)
    .get("/api/me/kanjis")
    .set("Authorization", `Bearer ${token}`);
  assert.ok(list.body.some((entry: { kanjiId: number }) => entry.kanjiId === kanjiId));
});

test("revisão registra agenda SRS e histórico", async () => {
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const lastReviewedAt = new Date().toISOString();
  const saved = await request(app)
    .put(`/api/me/kanjis/${kanjiId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "learned", favorite: true, dueAt, intervalDays: 1, easeFactor: 2.6, repetitions: 1, lastReviewedAt, rating: 4 });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.intervalDays, 1);

  const reviews = await request(app)
    .get("/api/me/reviews")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(reviews.status, 200);
  assert.equal(reviews.body[0].kanjiId, kanjiId);
  assert.equal(reviews.body[0].rating, 4);
});

test("progresso rejeita status e avaliação inválidos", async () => {
  const invalidStatus = await request(app)
    .put(`/api/me/kanjis/${kanjiId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "mastered" });
  const invalidRating = await request(app)
    .put(`/api/me/kanjis/${kanjiId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ rating: 8 });
  assert.equal(invalidStatus.status, 400);
  assert.equal(invalidRating.status, 400);
});

test("tentativas de quiz exigem autenticação e persistem pontuação", async () => {
  const unauthorized = await request(app).post("/api/me/quizzes").send({ correctAnswers: 3, totalQuestions: 5 });
  assert.equal(unauthorized.status, 401);

  const invalid = await request(app)
    .post("/api/me/quizzes")
    .set("Authorization", `Bearer ${token}`)
    .send({ correctAnswers: 6, totalQuestions: 5 });
  assert.equal(invalid.status, 400);

  const saved = await request(app)
    .post("/api/me/quizzes")
    .set("Authorization", `Bearer ${token}`)
    .send({ correctAnswers: 4, totalQuestions: 5 });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.correctAnswers, 4);

  const history = await request(app)
    .get("/api/me/quizzes")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(history.status, 200);
  assert.equal(history.body[0].totalQuestions, 5);
});

test("lista de kanjis filtra por nível JLPT", async () => {
  await prisma.kanji.upsert({
    where: { character: "食" },
    update: { jlpt: "N4" },
    create: { character: "食", meaning: "comer; comida", strokeCount: 9, jlpt: "N4" },
  });

  const response = await request(app).get("/api/kanjis?jlpt=N4");

  assert.equal(response.status, 200);
  assert.ok(response.body.length > 0);
  assert.ok(response.body.every((kanji: { jlpt: string }) => kanji.jlpt === "N4"));
});

test("lista de kanjis rejeita nível JLPT inválido", async () => {
  const response = await request(app).get("/api/kanjis?jlpt=N6");

  assert.equal(response.status, 400);
});

after(async () => {
  if (userId) {
    await prisma.quizAttempt.deleteMany({ where: { userId } });
    await prisma.reviewHistory.deleteMany({ where: { userId } });
    await prisma.userKanji.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
});
