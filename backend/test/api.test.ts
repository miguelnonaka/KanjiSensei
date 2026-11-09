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
  assert.ok(response.body.length >= 2383);
  assert.deepEqual(response.body.slice(0, 3).map((kanji: { character: string }) => kanji.character), ["日", "一", "国"]);
  assert.equal(response.body[0].jlpt, "N5");
  assert.equal(response.body.at(-1).jlpt, "N1");
  assert.ok(response.body.some((kanji: { character: string }) => kanji.character === "日"));
  const station = response.body.find((kanji: { character: string }) => kanji.character === "駅");
  assert.equal(station.jlpt, "N4");
  assert.equal(station.strokeCount, 14);
  assert.ok(station.examples.some((example: { word: string }) => example.word === "駅前"));
  assert.ok(response.body.some((kanji: { character: string }) => kanji.character === "右"));
  const sun = response.body.find((kanji: { character: string }) => kanji.character === "日");
  kanjiId = sun.id;
  assert.ok(Array.isArray(sun.examples));
  assert.equal(sun.examples[0]?.word, "日本");

  const n1 = await request(app).get("/api/kanjis?jlpt=N1");
  assert.equal(n1.status, 200);
  assert.equal(n1.body.length, 1345);
  assert.ok(n1.body.some((kanji: { character: string }) => kanji.character === "氏"));
  assert.deepEqual(n1.body.slice(0, 3).map((kanji: { character: string }) => kanji.character), ["氏", "統", "保"]);
  assert.deepEqual(n1.body.slice(0, 3).map((kanji: { catalogOrder: number }) => kanji.catalogOrder), [0, 1, 2]);

  const n2 = await request(app).get("/api/kanjis?jlpt=N2");
  assert.equal(n2.status, 200);
  assert.equal(n2.body.length, 398);
  assert.ok(n2.body.some((kanji: { character: string }) => kanji.character === "党"));
  assert.deepEqual(n2.body.slice(0, 3).map((kanji: { character: string }) => kanji.character), ["党", "協", "総"]);
});

test("radicais e filtros por traços consultam o catálogo", async () => {
  const radical = await request(app).get("/api/radicals");
  assert.equal(radical.status, 200);
  assert.ok(radical.body.includes("日"));

  const filtered = await request(app).get("/api/kanjis?radical=%E6%97%A5&minStrokes=4&maxStrokes=4&sort=strokes");
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.some((kanji: { character: string }) => kanji.character === "日"));
  const invalid = await request(app).get("/api/kanjis?minStrokes=9&maxStrokes=2");
  assert.equal(invalid.status, 400);
  const meaning = await request(app).get("/api/kanjis?meaning=sol");
  assert.ok(meaning.body.some((kanji: { character: string }) => kanji.character === "日"));
});

test("painel e operações administrativas verificam a permissão no backend", async () => {
  const forbidden = await request(app)
    .get("/api/admin/kanjis")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(forbidden.status, 403);

  const managedUser = await prisma.user.create({
    data: { email: `role-${Date.now()}@example.com`, passwordHash: "unused" },
  });
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  try {
    const created = await request(app)
      .post("/api/admin/kanjis")
      .set("Authorization", `Bearer ${token}`)
      .send({
        character: `試${Date.now()}`,
        meaning: "teste",
        onyomi: "シ",
        kunyomi: "こころみる",
        radical: "言",
        strokeCount: 13,
        jlpt: "N3",
        etymology: "Informação etimológica cadastrada manualmente.",
        mnemonic: "Uma frase original para ajudar a lembrar o caractere.",
        examples: [{ word: "試験", reading: "しけん", meaning: "prova" }],
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.etymology, "Informação etimológica cadastrada manualmente.");
    assert.equal(created.body.mnemonic, "Uma frase original para ajudar a lembrar o caractere.");

    const updated = await request(app)
      .put(`/api/admin/kanjis/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...created.body, meaning: "experimento" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.meaning, "experimento");
    assert.equal(updated.body.mnemonic, created.body.mnemonic);
    const publicCatalog = await request(app).get("/api/kanjis?meaning=experimento");
    const publicKanji = publicCatalog.body.find((kanji: { character: string }) =>
      kanji.character === created.body.character);
    assert.equal(publicKanji.etymology, created.body.etymology);
    assert.equal(publicKanji.mnemonic, created.body.mnemonic);

    const role = await request(app)
      .put(`/api/admin/users/${managedUser.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "ADMIN" });
    assert.equal(role.status, 200);
    assert.equal(role.body.role, "ADMIN");
    const users = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    assert.ok(users.body.some((user: { id: number }) => user.id === managedUser.id));

    const deleted = await request(app)
      .delete(`/api/admin/kanjis/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(deleted.status, 204);
  } finally {
    await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });
    await prisma.user.delete({ where: { id: managedUser.id } });
  }
});

test("progresso e favoritos exigem autenticação e são persistidos", async () => {
  const unauthorized = await request(app).get("/api/me/kanjis");
  assert.equal(unauthorized.status, 401);

  const saved = await request(app)
    .put(`/api/me/kanjis/${kanjiId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "learning", favorite: true, difficult: true });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, "learning");
  assert.equal(saved.body.favorite, true);
  assert.equal(saved.body.difficult, true);

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

  const requestId = `quiz-${Date.now()}`;
  const syncedAttempt = await request(app)
    .post("/api/me/quizzes")
    .set("Authorization", `Bearer ${token}`)
    .send({ correctAnswers: 2, totalQuestions: 3, requestId });
  const retriedAttempt = await request(app)
    .post("/api/me/quizzes")
    .set("Authorization", `Bearer ${token}`)
    .send({ correctAnswers: 2, totalQuestions: 3, requestId });
  assert.equal(syncedAttempt.status, 201);
  assert.equal(retriedAttempt.status, 200);
  assert.equal(retriedAttempt.body.id, syncedAttempt.body.id);
});

test("listas, metas e backups ficam associados ao usuário", async () => {
  const list = await request(app)
    .put("/api/me/study-lists/revisao-n5")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Revisão N5", characters: ["日", "水"] });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.characters.sort(), ["日", "水"]);

  const lists = await request(app)
    .get("/api/me/study-lists")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(lists.body[0].name, "Revisão N5");

  const goal = await request(app)
    .put("/api/me/goal")
    .set("Authorization", `Bearer ${token}`)
    .send({ target: 5, unit: "ACTIVITIES" });
  assert.equal(goal.status, 200);
  assert.equal(goal.body.target, 5);

  const backup = await request(app)
    .post("/api/me/backups")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(backup.status, 201);
  const backups = await request(app)
    .get("/api/me/backups")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(backups.body[0].id, backup.body.id);

  const changedGoal = await request(app)
    .put("/api/me/goal")
    .set("Authorization", `Bearer ${token}`)
    .send({ target: 2, unit: "KANJIS" });
  assert.equal(changedGoal.body.target, 2);
  const restored = await request(app)
    .post(`/api/me/backups/${backup.body.id}/restore`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(restored.status, 200);
  const restoredGoal = await request(app)
    .get("/api/me/goal")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(restoredGoal.body.target, 5);
  assert.equal(restoredGoal.body.unit, "ACTIVITIES");
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
    await prisma.backup.deleteMany({ where: { userId } });
    await prisma.dailyGoal.deleteMany({ where: { userId } });
    await prisma.studyList.deleteMany({ where: { userId } });
    await prisma.quizAttempt.deleteMany({ where: { userId } });
    await prisma.reviewHistory.deleteMany({ where: { userId } });
    await prisma.userKanji.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
});
