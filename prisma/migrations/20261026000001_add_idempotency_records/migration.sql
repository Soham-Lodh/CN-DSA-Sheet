-- Add idempotency ledger + reverse-lookup index for affected-sheet discovery.
-- Safe to run on the existing schema (applied with `prisma migrate deploy`).

CREATE TYPE "IdempotencyState" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB,
    "state" "IdempotencyState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_userId_route_key_key" ON "idempotency_records"("userId", "route", "key");
CREATE INDEX "idempotency_records_createdAt_idx" ON "idempotency_records"("createdAt");

CREATE INDEX "sheet_questions_questionId_idx" ON "sheet_questions"("questionId");
