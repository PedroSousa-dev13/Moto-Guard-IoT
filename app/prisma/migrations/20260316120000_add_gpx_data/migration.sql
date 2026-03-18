CREATE TABLE "gpx_data" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "waypoints" JSONB NOT NULL,
    "bounds" JSONB NOT NULL,
    "total_time" INTEGER,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpx_data_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gpx_data_trip_id_key" ON "gpx_data"("trip_id");

ALTER TABLE "gpx_data" ADD CONSTRAINT "gpx_data_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

