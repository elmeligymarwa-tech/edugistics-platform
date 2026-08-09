-- Promo Codes (Phase B): permanent snapshot of a promo code's effect on a
-- single registration, written once at submission (or at promotion) and
-- never recalculated afterwards. Additive only — no existing column, table,
-- constraint or enum is altered or dropped.
--
-- Hand-written (not `prisma migrate dev`) because this database's pooled
-- connection cannot provision the shadow database `migrate dev` requires
-- (P1014 against `_prisma_migrations` in the shadow db) — the same
-- constraint noted in 20260809204606_add_promo_codes. This file's contents
-- were generated with `prisma migrate diff --from-url $DIRECT_URL
-- --to-schema-datamodel prisma/schema.prisma --script`, which only needs
-- introspection access, then reviewed by hand to confirm it is additive
-- only before being applied with `prisma migrate deploy`.

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountTypeSnapshot" "PromoCodeDiscountType",
ADD COLUMN     "discountValueSnapshot" DECIMAL(10,2),
ADD COLUMN     "finalFee" DECIMAL(10,2),
ADD COLUMN     "originalFee" DECIMAL(10,2),
ADD COLUMN     "promoAppliedAt" TIMESTAMPTZ,
ADD COLUMN     "promoCodeId" TEXT,
ADD COLUMN     "promoCodeSnapshot" TEXT;

-- CreateIndex
CREATE INDEX "Registration_promoCodeId_idx" ON "Registration"("promoCodeId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
