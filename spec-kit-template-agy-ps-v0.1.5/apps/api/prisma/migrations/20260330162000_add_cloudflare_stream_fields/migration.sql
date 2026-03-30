-- AlterTable
ALTER TABLE "Video"
ADD COLUMN     "cfStreamVideoId" TEXT,
ADD COLUMN     "playbackPolicy" TEXT NOT NULL DEFAULT 'signed',
ADD COLUMN     "streamReadyToStream" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "streamStatus" TEXT,
ADD COLUMN     "streamThumbnailUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN    "sourceUrl";

-- CreateIndex
CREATE UNIQUE INDEX "Video_cfStreamVideoId_key" ON "Video"("cfStreamVideoId");
