-- CreateEnum
CREATE TYPE "DrivingStyle" AS ENUM ('AGGRESSIVE', 'DEFENSIVE', 'ECONOMY');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "driving_style" "DrivingStyle";
