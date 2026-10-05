-- CreateTable
CREATE TABLE "ReviewHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rating" INTEGER NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "kanjiId" INTEGER NOT NULL,
    CONSTRAINT "ReviewHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewHistory_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserKanji" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_UserKanji" ("createdAt", "favorite", "id", "kanjiId", "status", "updatedAt", "userId") SELECT "createdAt", "favorite", "id", "kanjiId", "status", "updatedAt", "userId" FROM "UserKanji";
DROP TABLE "UserKanji";
ALTER TABLE "new_UserKanji" RENAME TO "UserKanji";
CREATE UNIQUE INDEX "UserKanji_userId_kanjiId_key" ON "UserKanji"("userId", "kanjiId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ReviewHistory_userId_reviewedAt_idx" ON "ReviewHistory"("userId", "reviewedAt");
