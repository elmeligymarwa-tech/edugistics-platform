-- Mailing list (Phase C): landing page subscribers and marketing templates.
-- Additive in effect — no existing table, column, row or constraint is
-- dropped or narrowed. The two exceptions are both explicitly requested and
-- both backward compatible:
--   1. Subscriber.teacherId becomes nullable (a landing page subscriber has
--      no teacher yet) — every existing Subscriber row already has a
--      teacherId, so relaxing this constraint changes no existing data.
--   2. The teacherId foreign key is recreated with ON DELETE SET NULL
--      instead of the implicit RESTRICT, consistent with the column now
--      being optional. Teacher rows are never deleted by this application,
--      so this has no practical effect on existing data either.
-- Everything else is a pure addition: two new enum values, two new nullable
-- columns on Subscriber, and one new table.
--
-- Hand-written (not `prisma migrate dev`, same reason as every prior
-- migration in this project): this database's pooled connection cannot
-- provision the shadow database `migrate dev` requires. Generated with
-- `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel
-- prisma/schema.prisma --script`, reviewed by hand, then applied with
-- `prisma migrate deploy`.

-- AlterEnum
ALTER TYPE "ConsentEventSource" ADD VALUE 'LANDING_PAGE';

-- AlterEnum
ALTER TYPE "ConsentSource" ADD VALUE 'LANDING_PAGE';

-- DropForeignKey
ALTER TABLE "Subscriber" DROP CONSTRAINT "Subscriber_teacherId_fkey";

-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN     "emailOriginal" TEXT,
ADD COLUMN     "fullName" TEXT,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MarketingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingTemplate_archivedAt_idx" ON "MarketingTemplate"("archivedAt");

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defence in depth, matching every existing table in this schema: deny all
-- PostgREST access from anon/authenticated roles. The app connects via the
-- BYPASSRLS `postgres` role, so this has no effect on application queries.
ALTER TABLE "MarketingTemplate" ENABLE ROW LEVEL SECURITY;
