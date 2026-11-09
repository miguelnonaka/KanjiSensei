DROP INDEX "QuizAttempt_requestId_key";
DROP INDEX "ReviewHistory_requestId_key";

CREATE UNIQUE INDEX "QuizAttempt_userId_requestId_key"
ON "QuizAttempt"("userId", "requestId");

CREATE UNIQUE INDEX "ReviewHistory_userId_requestId_key"
ON "ReviewHistory"("userId", "requestId");
