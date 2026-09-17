import { app, prisma } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`KanjiSensei backend running on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
