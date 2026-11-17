/*
  Warnings:

  - You are about to alter the column `x` on the `Character` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `y` on the `Character` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `found` on the `GameSession` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `radius` to the `Character` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_gameId_fkey";

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "radius" INTEGER NOT NULL,
ALTER COLUMN "x" SET DATA TYPE INTEGER,
ALTER COLUMN "y" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "found";

-- CreateTable
CREATE TABLE "GameFind" (
    "sessionId" TEXT NOT NULL,
    "characterId" INTEGER NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameFind_pkey" PRIMARY KEY ("sessionId","characterId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "GameSession_gameId_scoreMs_idx" ON "GameSession"("gameId", "scoreMs");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFind" ADD CONSTRAINT "GameFind_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFind" ADD CONSTRAINT "GameFind_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
