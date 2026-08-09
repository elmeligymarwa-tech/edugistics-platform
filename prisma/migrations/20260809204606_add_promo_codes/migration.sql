-- Promo Codes (Phase A): data model and admin management only.
-- Additive only — no existing column, table, constraint or enum is
-- altered or dropped. Hand-written (not `prisma migrate dev`) because the
-- shared database this project migrates against currently also carries an
-- unrelated, unmerged feature branch's tables (EmailCampaign,
-- EmailCampaignRecipient, and five Course columns) that this branch's
-- schema.prisma doesn't know about; an auto-generated diff against the live
-- database would have proposed dropping all of that. Every statement below
-- was reviewed to touch only PromoCode/PromoCodeCourse.

-- CreateEnum
CREATE TYPE "PromoCodeDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" "PromoCodeDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "appliesToAllCourses" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "maxTotalUses" INTEGER,
    "maxUsesPerTeacher" INTEGER NOT NULL DEFAULT 1,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeCourse" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCodeCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_archivedAt_idx" ON "PromoCode"("archivedAt");

-- CreateIndex
CREATE INDEX "PromoCode_startsAt_idx" ON "PromoCode"("startsAt");

-- CreateIndex
CREATE INDEX "PromoCode_expiresAt_idx" ON "PromoCode"("expiresAt");

-- CreateIndex: uniqueness of `code` enforced only among non-archived rows,
-- so an archived code's value can be reused by a new code. Prisma's schema
-- DSL can't express a partial index, hence this is hand-written rather than
-- a plain @unique on the `code` column.
CREATE UNIQUE INDEX "PromoCode_code_active_key" ON "PromoCode"("code") WHERE "archivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "PromoCodeCourse_promoCodeId_idx" ON "PromoCodeCourse"("promoCodeId");

-- CreateIndex
CREATE INDEX "PromoCodeCourse_courseId_idx" ON "PromoCodeCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeCourse_promoCodeId_courseId_key" ON "PromoCodeCourse"("promoCodeId", "courseId");

-- AddForeignKey
ALTER TABLE "PromoCodeCourse" ADD CONSTRAINT "PromoCodeCourse_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeCourse" ADD CONSTRAINT "PromoCodeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security: same defence-in-depth as every other table in this
-- schema (see 20260808191626_enable_row_level_security) — the app connects
-- via a BYPASSRLS role so this has no effect on application queries; it
-- only closes off Supabase's automatic PostgREST exposure of these two new
-- tables to the anon/authenticated roles.
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCodeCourse" ENABLE ROW LEVEL SECURITY;
