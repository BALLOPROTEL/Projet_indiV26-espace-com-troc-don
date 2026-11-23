-- #111 - Participant-owned conversations for Marketplace proposals.
SET search_path TO "marketplace";

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_proposalId_key"
  ON "Conversation"("proposalId");
CREATE INDEX "Conversation_ownerId_updatedAt_idx"
  ON "Conversation"("ownerId", "updatedAt");
CREATE INDEX "Conversation_requesterId_updatedAt_idx"
  ON "Conversation"("requesterId", "updatedAt");
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx"
  ON "ConversationMessage"("conversationId", "createdAt");
CREATE INDEX "ConversationMessage_conversationId_readAt_idx"
  ON "ConversationMessage"("conversationId", "readAt");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConversationMessage"
  ADD CONSTRAINT "ConversationMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
