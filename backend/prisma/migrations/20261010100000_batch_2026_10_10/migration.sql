-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "otaGroup" TEXT NOT NULL DEFAULT 'stable';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LessonPlan" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MyopiaReminder" ADD COLUMN     "rested" BOOLEAN,
ADD COLUMN     "restedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PracticeRecord" ADD COLUMN     "practiceType" TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" INTEGER;

-- CreateTable
CREATE TABLE "OtaRelease" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "packageUrl" TEXT NOT NULL,
    "checksum" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'stable',
    "action" TEXT NOT NULL DEFAULT 'release',
    "rollbackToVersion" TEXT,
    "note" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtaRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Box_otaGroup_idx" ON "Box"("otaGroup");

-- CreateIndex
CREATE INDEX "PracticeRecord_sessionId_practiceType_idx" ON "PracticeRecord"("sessionId", "practiceType");

-- CreateIndex
CREATE INDEX "PracticeRecord_practiceType_createdAt_idx" ON "PracticeRecord"("practiceType", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_status_reviewedAt_idx" ON "Submission"("status", "reviewedAt");

