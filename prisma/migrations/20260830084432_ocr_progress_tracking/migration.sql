-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "extractionStartedAt" TIMESTAMP(3),
ADD COLUMN     "ocrPagesProcessed" INTEGER,
ADD COLUMN     "ocrPagesTotal" INTEGER;
