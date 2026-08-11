-- Replaces the Item 4 courseDate/endDate range with explicit CourseSession
-- rows — a multi-day course is a set of specific dates the admin picked one
-- at a time (e.g. four non-consecutive Saturdays), not a consecutive-day
-- span. Hand-written, not `prisma migrate dev` (same reason as
-- 20260809204606_add_promo_codes and every other hand-written migration in
-- this project): `migrate dev` needs a shadow database, and
-- 20260808191626_enable_row_level_security enables RLS on
-- "_prisma_migrations" itself with zero policies, which makes that table
-- invisible to migrate dev's shadow-database bookkeeping (P1014: "The
-- underlying table for model `_prisma_migrations` does not exist") even
-- though the app's own BYPASSRLS role is unaffected.
--
-- Safety check performed before writing this migration: confirmed via a
-- direct read-only query against the live database that 0 of the 2 existing
-- Course rows have a non-null endDate, so dropping the column loses no data
-- — Item 4 was never merged and no production registration flow ever wrote
-- to it.

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "endDate",
ALTER COLUMN "durationMinutes" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CourseSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseSession_courseId_idx" ON "CourseSession"("courseId");

-- CreateIndex: the same date cannot be added to the same course twice.
CREATE UNIQUE INDEX "CourseSession_courseId_sessionDate_key" ON "CourseSession"("courseId", "sessionDate");

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: same defence-in-depth as every other table in this
-- schema (see 20260808191626_enable_row_level_security) — the app connects
-- via a BYPASSRLS role so this has no effect on application queries; it
-- only closes off Supabase's automatic PostgREST exposure of this new table
-- to the anon/authenticated roles.
ALTER TABLE "CourseSession" ENABLE ROW LEVEL SECURITY;
