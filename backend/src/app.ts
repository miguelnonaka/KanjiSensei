import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
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
  response.json(kanjis);
});