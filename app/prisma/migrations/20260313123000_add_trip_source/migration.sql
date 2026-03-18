-- Add trip source classification for simulator, GPX imports, and real device rides.
CREATE TYPE "TripSource" AS ENUM ('SIMULATOR', 'GPX_IMPORTED', 'DEVICE_REAL');

ALTER TABLE "trips"
ADD COLUMN "source" "TripSource" NOT NULL DEFAULT 'SIMULATOR';

-- Explicit backfill for any pre-existing rows.
UPDATE "trips"
SET "source" = 'SIMULATOR'
WHERE "source" IS NULL;
