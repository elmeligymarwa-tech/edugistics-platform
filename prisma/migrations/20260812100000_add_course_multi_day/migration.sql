-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "isMultiDay" BOOLEAN NOT NULL DEFAULT false;
