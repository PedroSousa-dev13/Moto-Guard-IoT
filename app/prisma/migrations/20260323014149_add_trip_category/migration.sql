-- CreateEnum
CREATE TYPE "TripCategory" AS ENUM ('COMMUTE', 'WEEKEND_RIDE', 'TRACK_DAY', 'OFF_ROAD');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "category" "TripCategory",
ADD COLUMN "category_confidence" DOUBLE PRECISION;
