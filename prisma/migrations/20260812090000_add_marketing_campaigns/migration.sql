-- Mailing list (Phase D): campaign send history for marketing email.
-- Purely additive — no existing table, column, row or constraint is
-- dropped, narrowed or renamed. Adds one new enum and two new tables.
--
-- Hand-written (not `prisma migrate dev`, same reason as every prior
-- migration in this project): this database's pooled connection cannot
-- provision the shadow database `migrate dev` requires. Generated with
-- `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel
-- prisma/schema.prisma --script`, reviewed by hand, then applied with
-- `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "MarketingRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "templateId" TEXT,
    "createdBy" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "status" "MarketingRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingCampaign_templateId_idx" ON "MarketingCampaign"("templateId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_createdAt_idx" ON "MarketingCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_campaignId_idx" ON "MarketingCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_subscriberId_idx" ON "MarketingCampaignRecipient"("subscriberId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_status_idx" ON "MarketingCampaignRecipient"("status");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defence in depth, matching every existing table in this schema: deny all
-- PostgREST access from anon/authenticated roles. The app connects via the
-- BYPASSRLS `postgres` role, so this has no effect on application queries.
ALTER TABLE "MarketingCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketingCampaignRecipient" ENABLE ROW LEVEL SECURITY;
