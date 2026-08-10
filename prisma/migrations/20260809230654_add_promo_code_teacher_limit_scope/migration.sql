-- Promo Codes (Phase C): lets an admin scope maxUsesPerTeacher to a single
-- course rather than across all courses. Additive only — no existing
-- column, table, constraint or enum is altered or dropped.
--
-- The new column defaults to 'ALL_COURSES', so every existing promo code
-- keeps exactly its current meaning (a teacher's uses counted across every
-- course) with no data migration required — this is a NOT NULL column with
-- a DEFAULT, so Postgres backfills every existing row in place.
--
-- Hand-written (not `prisma migrate dev`) because this database's pooled
-- connection cannot provision the shadow database `migrate dev` requires
-- (P1014 against `_prisma_migrations` in the shadow db) — the same
-- constraint noted in 20260809204606_add_promo_codes and
-- 20260809222349_add_promo_code_snapshot_to_registration. This file's
-- contents were generated with `prisma migrate diff --from-url $DIRECT_URL
-- --to-schema-datamodel prisma/schema.prisma --script`, which only needs
-- introspection access, then reviewed by hand to confirm it is additive
-- only before being applied with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "PromoCodeTeacherLimitScope" AS ENUM ('ALL_COURSES', 'PER_COURSE');

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "maxUsesPerTeacherScope" "PromoCodeTeacherLimitScope" NOT NULL DEFAULT 'ALL_COURSES';
