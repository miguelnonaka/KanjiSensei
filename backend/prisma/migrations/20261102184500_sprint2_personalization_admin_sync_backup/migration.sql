-- AlterTable
ALTER TABLE "Kanji" ADD COLUMN "radical" TEXT;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN "requestId" TEXT;

-- AlterTable
ALTER TABLE "ReviewHistory" ADD COLUMN "requestId" TEXT;

-- CreateTable
CREATE TABLE "StudyList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "StudyList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyListItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listId" INTEGER NOT NULL,
    "kanjiId" INTEGER NOT NULL,
    CONSTRAINT "StudyListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyListItem_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyGoal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "target" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'KANJIS',
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "DailyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Backup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "updatedAt")
SELECT "createdAt", "email", "id", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_UserKanji" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "difficult" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" DATETIME,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "kanjiId" INTEGER NOT NULL,
    CONSTRAINT "UserKanji_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserKanji_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserKanji" ("createdAt", "dueAt", "easeFactor", "favorite", "id", "intervalDays", "kanjiId", "lastReviewedAt", "repetitions", "status", "updatedAt", "userId")
SELECT "createdAt", "dueAt", "easeFactor", "favorite", "id", "intervalDays", "kanjiId", "lastReviewedAt", "repetitions", "status", "updatedAt", "userId" FROM "UserKanji";
DROP TABLE "UserKanji";
ALTER TABLE "new_UserKanji" RENAME TO "UserKanji";
CREATE UNIQUE INDEX "UserKanji_userId_kanjiId_key" ON "UserKanji"("userId", "kanjiId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StudyList_userId_clientId_key" ON "StudyList"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyListItem_listId_kanjiId_key" ON "StudyListItem"("listId", "kanjiId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoal_userId_key" ON "DailyGoal"("userId");

-- CreateIndex
CREATE INDEX "Backup_userId_createdAt_idx" ON "Backup"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_requestId_key" ON "QuizAttempt"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHistory_requestId_key" ON "ReviewHistory"("requestId");
