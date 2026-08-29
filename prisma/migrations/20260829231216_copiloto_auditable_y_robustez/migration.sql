-- AlterTable
ALTER TABLE "ExclusionRequirement" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedByUserId" TEXT;

-- AlterTable
ALTER TABLE "TenderDocumentBlock" ADD COLUMN     "esTabla" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "ExclusionRequirement" ADD CONSTRAINT "ExclusionRequirement_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
