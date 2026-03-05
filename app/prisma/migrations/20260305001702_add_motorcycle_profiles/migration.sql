/*
  Warnings:

  - You are about to drop the column `model` on the `motorcycles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "motorcycles" DROP COLUMN "model",
ADD COLUMN     "profile_id" TEXT;

-- CreateTable
CREATE TABLE "motorcycle_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "example" TEXT,
    "cc_min" INTEGER NOT NULL,
    "cc_max" INTEGER NOT NULL,
    "max_speed_kmh" INTEGER NOT NULL,
    "max_rpm" INTEGER NOT NULL,
    "engine_temp_min" INTEGER NOT NULL,
    "engine_temp_max" INTEGER NOT NULL,
    "voltage_min" DOUBLE PRECISION NOT NULL,
    "voltage_max" DOUBLE PRECISION NOT NULL,
    "typical_max_roll_deg" INTEGER NOT NULL,
    "avg_weight_kg" INTEGER NOT NULL,
    "crash_roll_threshold" INTEGER NOT NULL,
    "crash_pitch_threshold" INTEGER NOT NULL,
    "crash_g_force" DOUBLE PRECISION NOT NULL,
    "crash_confirm_sec" INTEGER NOT NULL,
    "critical_rpm" INTEGER NOT NULL,
    "critical_temp" INTEGER NOT NULL,
    "critical_voltage" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motorcycle_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_profiles_name_key" ON "motorcycle_profiles"("name");

-- AddForeignKey
ALTER TABLE "motorcycles" ADD CONSTRAINT "motorcycles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "motorcycle_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
