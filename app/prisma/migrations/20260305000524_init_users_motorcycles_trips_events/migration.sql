-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('HARD_BRAKING', 'EXCESSIVE_LEAN', 'HIGH_VIBRATION', 'OVERHEAT', 'LOW_VOLTAGE', 'CRASH_DETECTED', 'RAPID_ACCELERATION', 'TIRE_PRESSURE_LOW', 'OIL_PRESSURE_LOW');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brand" TEXT,
    "year" INTEGER,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motorcycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "motorcycle_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "distance_km" DOUBLE PRECISION,
    "max_speed_kmh" DOUBLE PRECISION,
    "avg_speed_kmh" DOUBLE PRECISION,
    "max_roll_deg" DOUBLE PRECISION,
    "max_g_force" DOUBLE PRECISION,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_events" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "speed_kmh" DOUBLE PRECISION,
    "roll_deg" DOUBLE PRECISION,
    "g_force" DOUBLE PRECISION,
    "engine_temp_c" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");

-- CreateIndex
CREATE INDEX "trips_motorcycle_id_idx" ON "trips"("motorcycle_id");

-- CreateIndex
CREATE INDEX "trips_started_at_idx" ON "trips"("started_at");

-- CreateIndex
CREATE INDEX "trip_events_trip_id_idx" ON "trip_events"("trip_id");

-- CreateIndex
CREATE INDEX "trip_events_type_idx" ON "trip_events"("type");

-- CreateIndex
CREATE INDEX "trip_events_severity_idx" ON "trip_events"("severity");

-- CreateIndex
CREATE INDEX "trip_events_occurred_at_idx" ON "trip_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "motorcycles" ADD CONSTRAINT "motorcycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "motorcycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
