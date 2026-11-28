CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ContactSubject" AS ENUM ('SHOP', 'ACCOUNT', 'PRIVACY', 'FESTIVAL', 'FANZINE', 'OTHER');
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "PrivacyAction" AS ENUM ('ACCESS', 'EXPORT', 'RECTIFY', 'ANONYMIZE', 'ERASE');

CREATE TABLE "Fanzine" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "excerpt" VARCHAR(500) NOT NULL,
  "body" TEXT NOT NULL,
  "issueLabel" VARCHAR(80),
  "status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Fanzine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FestivalEntry" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "summary" VARCHAR(600) NOT NULL,
  "body" TEXT NOT NULL,
  "location" VARCHAR(160),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FestivalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "name" VARCHAR(120),
  "email" VARCHAR(254),
  "subject" "ContactSubject" NOT NULL,
  "privacyAction" "PrivacyAction",
  "message" VARCHAR(4000) NOT NULL,
  "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Fanzine_slug_key" ON "Fanzine"("slug");
CREATE INDEX "Fanzine_status_publishedAt_idx" ON "Fanzine"("status", "publishedAt");
CREATE UNIQUE INDEX "FestivalEntry_slug_key" ON "FestivalEntry"("slug");
CREATE INDEX "FestivalEntry_status_publishedAt_idx" ON "FestivalEntry"("status", "publishedAt");
CREATE INDEX "FestivalEntry_startsAt_idx" ON "FestivalEntry"("startsAt");
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
CREATE INDEX "ContactMessage_email_createdAt_idx" ON "ContactMessage"("email", "createdAt");
CREATE INDEX "ContactMessage_userId_createdAt_idx" ON "ContactMessage"("userId", "createdAt");
