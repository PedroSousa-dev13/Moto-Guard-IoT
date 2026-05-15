-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'ENGINE_OVERREV';
ALTER TYPE "EventType" ADD VALUE 'WHEELIE_DETECTED';
ALTER TYPE "EventType" ADD VALUE 'STOPPIE_DETECTED';
ALTER TYPE "EventType" ADD VALUE 'SAFETY_SYSTEM_ACTIVE';

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "stopped_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_token" TEXT,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false;
