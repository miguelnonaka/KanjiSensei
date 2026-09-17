import assert from "node:assert/strict";
import { test, after } from "node:test";
import request from "supertest";
import { app, prisma } from "../src/app.js";

const email = `test-${Date.now()}@example.com`;
const password = "KanjiTest123";
let token = "";
let userId = 0;

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
  assert.ok(response.body.some((kanji: { character: string }) => kanji.character === "日"));
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
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
});
