-- Mailing list (Phase A): Subscriber and ConsentEvent data model. Additive
-- only — no existing column, table, constraint or enum is altered or
-- dropped. Teacher.marketingConsent/marketingConsentAt are left exactly as
-- they are; this migration only adds the new, separate source of truth for
-- marketing-email eligibility described on Subscriber.
--
-- Hand-written (not `prisma migrate dev`, same reason as every prior
-- migration in this project): this database's pooled connection cannot
-- provision the shadow database `migrate dev` requires. This file's
-- contents were generated with `prisma migrate diff --from-url $DIRECT_URL
-- --to-schema-datamodel prisma/schema.prisma --script`, which only needs
-- introspection access, then reviewed by hand to confirm it is additive
-- only before being applied with `prisma migrate deploy`. The two ENABLE
-- ROW LEVEL SECURITY statements at the end were added by hand, following
-- the same defence-in-depth rationale as 20260808191626_enable_row_level_security
-- and 20260809204606_add_promo_codes: these tables hold subscriber PII and
-- must be closed to Supabase's PostgREST anon/authenticated roles from the
-- moment they exist.

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('TRAINING_REGISTRATION', 'ADMIN_MANUAL', 'MIGRATED');

-- CreateEnum
CREATE TYPE "ConsentEventType" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'RESUBSCRIBED');

-- CreateEnum
CREATE TYPE "ConsentEventSource" AS ENUM ('TRAINING_REGISTRATION', 'UNSUBSCRIBE_LINK', 'ADMIN_MANUAL', 'MIGRATED');

-- CreateEnum
CREATE TYPE "SubscriberStatusChangedBy" AS ENUM ('ADMIN');

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "emailNormalised" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL,
    "subscribedAt" TIMESTAMPTZ NOT NULL,
    "unsubscribedAt" TIMESTAMPTZ,
    "consentSource" "ConsentSource" NOT NULL,
    "consentCourseId" TEXT,
    "consentWordingVersion" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "lastMarketingEmailAt" TIMESTAMP(3),
    "marketingEmailsSent" INTEGER NOT NULL DEFAULT 0,
    "statusChangedBy" "SubscriberStatusChangedBy",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "eventType" "ConsentEventType" NOT NULL,
    "source" "ConsentEventSource" NOT NULL,
    "courseId" TEXT,
    "wordingVersion" TEXT,
    "ipHash" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_teacherId_key" ON "Subscriber"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_emailNormalised_key" ON "Subscriber"("emailNormalised");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "Subscriber_status_idx" ON "Subscriber"("status");

-- CreateIndex
CREATE INDEX "Subscriber_subscribedAt_idx" ON "Subscriber"("subscribedAt");

-- CreateIndex
CREATE INDEX "Subscriber_consentCourseId_idx" ON "Subscriber"("consentCourseId");

-- CreateIndex
CREATE INDEX "ConsentEvent_subscriberId_idx" ON "ConsentEvent"("subscriberId");

-- CreateIndex
CREATE INDEX "ConsentEvent_courseId_idx" ON "ConsentEvent"("courseId");

-- CreateIndex
CREATE INDEX "ConsentEvent_occurredAt_idx" ON "ConsentEvent"("occurredAt");

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_consentCourseId_fkey" FOREIGN KEY ("consentCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defence in depth, matching every existing table in this schema: deny all
-- PostgREST access from anon/authenticated roles. The app connects via the
-- BYPASSRLS `postgres` role, so this has no effect on application queries.
ALTER TABLE "Subscriber" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ConsentEvent" ENABLE ROW LEVEL SECURITY;
